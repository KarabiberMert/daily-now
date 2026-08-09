/* Tam ekran okuyucu — PDF'ler icin surekli kaydirmali render, native
 * (PDF'siz, dogrudan JSON'dan gelen) haberler icin duz HTML sayfa. */

import { loadDoc, renderPage } from './pdf.js';
import { fileOf } from './library.js';
import { patchArticle, state } from './store.js';
import { $, esc, formatDay, formatSize, toast } from './util.js';
import { t, pick } from './i18n.js';

let doc = null;
let article = null;
let scale = 1;
let objectUrl = null;
let observer = null;
let rendered = new Set();
let pageEls = [];

const el = {};

export function initReader() {
  el.root = $('#reader');
  el.body = $('#rdBody');
  el.wrap = $('#rdCanvasWrap');
  el.title = $('#rdTitle');
  el.sub = $('#rdSub');
  el.pages = $('#rdPages');
  el.pageInput = $('#rdPageInput');
  el.star = $('#rdStar');
  el.download = $('#rdDownload');
  el.pager = document.querySelector('.pager');
  el.zoomOut = $('#rdZoomOut');
  el.zoomIn = $('#rdZoomIn');

  $('#rdClose').onclick = close;
  $('#rdPrev').onclick = () => goTo(currentPage() - 1);
  $('#rdNext').onclick = () => goTo(currentPage() + 1);
  $('#rdZoomIn').onclick = () => setScale(scale * 1.25);
  $('#rdZoomOut').onclick = () => setScale(scale / 1.25);
  el.star.onclick = toggleStar;
  el.pageInput.onchange = () => goTo(parseInt(el.pageInput.value, 10) || 1);

  document.addEventListener('keydown', onKey);
}

export function isOpen() { return !el.root.hidden; }

export async function openArticle(a) {
  article = a;
  el.root.hidden = false;
  document.body.style.overflow = 'hidden';
  el.title.textContent = pick(a.title);
  el.star.classList.toggle('on', !!a.starred);

  if (state.settings.markReadOnOpen && !a.read) patchArticle(a.id, { read: true });

  if (a.kind === 'native') return openNative(a);
  return openPdf(a);
}

/* ────────────────────────── native (PDF'siz) sayfa ────────────────────────── */

function setPdfControlsVisible(visible) {
  if (el.pager) el.pager.hidden = !visible;
  el.zoomOut.hidden = !visible;
  el.zoomIn.hidden = !visible;
  el.download.hidden = !visible;
}

function safeHref(u) {
  return /^https?:\/\//i.test(u || '') ? u : '';
}

function renderBullets(bullets) {
  return '<ul class="na-bullets">' + bullets.map(b => {
    if (typeof b === 'string') return `<li>${esc(b)}</li>`;
    const uri = safeHref(b.url);
    const src = b.source || '';
    let link = '';
    if (uri) link = `<a class="na-src" href="${esc(uri)}" target="_blank" rel="noopener noreferrer">${
      esc(t('reader.source', { source: src || t('reader.link') }))}</a>`;
    else if (src) link = `<span class="na-src">${esc(t('reader.source', { source: src }).replace(/ ↗$/, ''))}</span>`;
    return `<li>${esc(pick(b.text) || '')}${link ? `<div class="na-src-row">${link}</div>` : ''}</li>`;
  }).join('') + '</ul>';
}

function renderNative(a) {
  const parts = [];
  const kicker = pick(a.kicker);
  if (kicker) parts.push(`<div class="na-kicker">${esc(String(kicker).toLocaleUpperCase())}</div>`);
  parts.push(`<h1 class="na-headline">${esc(pick(a.title))}</h1>`);
  const bylineParts = [pick(a.source), formatDay(a.date), a.author].filter(Boolean);
  parts.push(`<div class="na-byline">${bylineParts.map(esc).join('  ·  ')}</div>`);
  const lead = pick(a.lead);
  if (lead) parts.push(`<p class="na-lead">${esc(lead)}</p>`);

  for (const block of a.body || []) {
    if (typeof block === 'string') { parts.push(`<p class="na-p">${esc(block)}</p>`); continue; }
    const heading = pick(block.heading), body = pick(block.text);
    if (heading) parts.push(`<h2 class="na-h2">${esc(heading)}</h2>`);
    if (body) parts.push(`<p class="na-p">${esc(body)}</p>`);
    if (block.bullets && block.bullets.length) parts.push(renderBullets(block.bullets));
  }

  const quote = pick(a.quote);
  if (quote) parts.push(`<blockquote class="na-quote">“${esc(String(quote).replace(/^[“"]|[”"]$/g, ''))}”</blockquote>`);
  const topUri = safeHref(a.url);
  if (topUri) parts.push(`<div class="na-footnote"><a href="${esc(topUri)}" target="_blank" rel="noopener noreferrer">${
    esc(t('reader.source', { source: pick(a.source) || t('reader.link') }))}</a></div>`);

  return `<article class="native-page">${parts.join('\n')}</article>`;
}

function openNative(a) {
  el.sub.textContent = [a.source, formatDay(a.date)].filter(Boolean).join('  ·  ');
  setPdfControlsVisible(false);
  el.wrap.innerHTML = renderNative(a);
  el.body.scrollTop = 0;
}

/* ────────────────────────── PDF ────────────────────────── */

async function openPdf(a) {
  setPdfControlsVisible(true);
  el.sub.textContent = [pick(a.source), formatDay(a.date),
                        a.pages ? t('row.pages', { n: a.pages }) : '', formatSize(a.size)]
    .filter(Boolean).join('  ·  ');
  el.wrap.innerHTML = `<div class="empty" style="border:0"><div class="em-ico">◌</div><p>${t('reader.opening')}</p></div>`;
  el.pages.textContent = a.pages || 1;
  el.pageInput.value = 1;

  let file;
  try {
    file = await fileOf(a);
  } catch (e) {
    el.wrap.innerHTML = `<div class="empty"><div class="em-ico">⚠</div><h3>${t('reader.failTitle')}</h3><p>${esc(e.message)}</p></div>`;
    return;
  }

  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  el.download.href = objectUrl;
  el.download.download = a.fileName || 'haber.pdf';

  try {
    const buf = await file.arrayBuffer();
    if (doc) { try { await doc.destroy(); } catch {} }
    doc = await loadDoc(buf);
  } catch (e) {
    el.wrap.innerHTML = `<div class="empty"><div class="em-ico">⚠</div><h3>${t('reader.pdfFail')}</h3><p>${esc(e.message)}</p></div>`;
    return;
  }

  el.pages.textContent = doc.numPages;
  scale = fitScale(await firstPageWidth());
  await buildPages();
}

async function firstPageWidth() {
  const p = await doc.getPage(1);
  const vp = p.getViewport({ scale: 1 });
  p.cleanup();
  return { w: vp.width, h: vp.height };
}

function fitScale({ w }) {
  const avail = Math.min(el.body.clientWidth - 48, 900);
  return Math.max(0.5, Math.min(2.4, avail / w));
}

async function buildPages() {
  const { w, h } = await firstPageWidth();
  rendered = new Set();
  pageEls = [];
  el.wrap.innerHTML = '';
  if (observer) observer.disconnect();

  for (let i = 1; i <= doc.numPages; i++) {
    const c = document.createElement('canvas');
    c.dataset.page = i;
    c.style.width = Math.round(w * scale) + 'px';
    c.style.height = Math.round(h * scale) + 'px';
    el.wrap.appendChild(c);
    pageEls.push(c);
  }

  observer = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const n = +e.target.dataset.page;
      draw(n);
      if (e.intersectionRatio > 0.35) el.pageInput.value = n;
    }
  }, { root: el.body, rootMargin: '400px 0px', threshold: [0, 0.4] });

  pageEls.forEach(c => observer.observe(c));
  el.body.scrollTop = 0;
}

async function draw(n) {
  const key = `${n}@${scale.toFixed(2)}`;
  if (rendered.has(key)) return;
  rendered.add(key);
  const canvas = pageEls[n - 1];
  if (!canvas || !doc) return;
  try { await renderPage(doc, n, scale, canvas); }
  catch (e) { rendered.delete(key); console.warn('render', n, e); }
}

function currentPage() { return parseInt(el.pageInput.value, 10) || 1; }

function goTo(n) {
  if (!doc) return;
  n = Math.max(1, Math.min(doc.numPages, n));
  el.pageInput.value = n;
  const c = pageEls[n - 1];
  if (c) el.body.scrollTo({ top: c.offsetTop - 18, behavior: 'smooth' });
  draw(n);
}

async function setScale(next) {
  if (!doc) return;
  scale = Math.max(0.4, Math.min(3.5, next));
  const page = currentPage();
  await buildPages();
  goTo(page);
}

async function toggleStar() {
  if (!article) return;
  const a = await patchArticle(article.id, { starred: !article.starred });
  el.star.classList.toggle('on', !!a.starred);
  toast(a.starred ? t('toast.starred') : t('toast.unstarred'), 'ok');
}

export function close() {
  el.root.hidden = true;
  document.body.style.overflow = '';
  if (observer) { observer.disconnect(); observer = null; }
  if (doc) { doc.destroy().catch(() => {}); doc = null; }
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
  el.wrap.innerHTML = '';
  article = null;
}

function onKey(e) {
  if (el.root.hidden) return;
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'Escape') { e.preventDefault(); close(); }
  else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === 'j') { e.preventDefault(); goTo(currentPage() + 1); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'k') { e.preventDefault(); goTo(currentPage() - 1); }
  else if (e.key === '+' || e.key === '=') { e.preventDefault(); setScale(scale * 1.25); }
  else if (e.key === '-') { e.preventDefault(); setScale(scale / 1.25); }
  else if (e.key === 's') { e.preventDefault(); toggleStar(); }
}
