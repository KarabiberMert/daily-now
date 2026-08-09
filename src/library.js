/* Kutuphane: gelen kutusundan PDF alma ve ust veri cozumleme.
 *
 * Tek kaynak var: DailyNews/inbox/. Indeks statik bir dosya —
 * inbox/index.json — publish_news.py her yayindan sonra kendisi yeniden
 * yazar. Uygulama bunu duz HTTP GET ile okuyor; ister yerel serve.py,
 * ister statik bir barindirma (Cloudflare Pages vb.) sundugu icin sunucu
 * tarafi kod gerekmiyor, tarayici klasor izni de (File System Access API)
 * gerekmiyor.
 */

import { Articles, Files } from './db.js';
import { loadDoc, readMeta, extractText, makeCover } from './pdf.js';
import { dayKey, uid, allText } from './util.js';
import { t, isLangMap } from './i18n.js';

export const INBOX_URL = 'inbox/';
const INDEX_URL = 'inbox/index.json';

/* ────────────────────────── ust veri cozumleme ────────────────────────── */

/** Dosya adindan tarih / kaynak / baslik cikarir.
 *  Onerilen bicim:  2026-08-07__Reuters__Fed faiz kararini acikladi.pdf */
export function parseFileName(fileName) {
  let base = fileName.replace(/\.pdf$/i, '').trim();
  const out = { date: null, source: '', title: '' };

  const dm = base.match(/^(\d{4})[-._]?(\d{2})[-._]?(\d{2})\s*(?:__|[_\-–—.\s])\s*/);
  if (dm) {
    out.date = `${dm[1]}-${dm[2]}-${dm[3]}`;
    base = base.slice(dm[0].length);
  }

  let rest = base;
  const dbl = rest.split(/__+/);
  if (dbl.length >= 2 && dbl[0].trim()) {
    out.source = dbl[0].trim();
    rest = dbl.slice(1).join(' — ');
  } else {
    const dash = rest.split(/\s+[—–]\s+|\s+-\s+/);
    if (dash.length >= 2 && dash[0].trim().length <= 28) {
      out.source = dash[0].trim();
      rest = dash.slice(1).join(' — ');
    } else {
      const us = rest.match(/^([^\s_]{2,20})_(.+)$/);
      if (us) { out.source = us[1]; rest = us[2]; }
    }
  }

  rest = rest.replace(/_+/g, ' ');
  // slug bicimindeyse ("fed-faiz-karari") tireleri bosluga cevir
  if (!/\s/.test(rest) && rest.includes('-')) rest = rest.replace(/-+/g, ' ');
  out.title = rest.replace(/\s+/g, ' ').trim();
  out.source = out.source.replace(/[-_]+/g, ' ').trim();
  return out;
}

function splitTags(v) {
  if (Array.isArray(v)) return v.map(t => String(t).trim()).filter(Boolean).slice(0, 8);
  if (typeof v === 'string') return v.split(/[,;|]/).map(t => t.trim()).filter(Boolean).slice(0, 8);
  return [];
}

/**
 * Metin alanini kirpar. Iki dilli alanlarda ({en, tr}) yapiyi bozmadan
 * her dili ayri ayri kirpar — String() ile duzlestirmek "[object Object]"
 * uretirdi.
 */
function clamp(v, max) {
  if (isLangMap(v)) {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = String(val == null ? '' : val).slice(0, max);
    return out;
  }
  return String(v == null ? '' : v).slice(0, max);
}

function firstSentences(text, max = 220) {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const dot = cut.lastIndexOf('. ');
  return (dot > 90 ? cut.slice(0, dot + 1) : cut.trimEnd() + '…');
}

/* ────────────────────────── tek dosya alma ────────────────────────── */

/**
 * @param {File}   file   PDF dosyasi
 * @param {object} opts   { sidecar, path, fingerprint, existing }
 */
export async function importPdf(file, opts = {}) {
  const sidecar = opts.sidecar || {};
  const buffer = await file.arrayBuffer();

  let doc = null, meta = {}, pageTexts = [], cover = null, pages = 0;
  try {
    doc = await loadDoc(buffer);
    pages = doc.numPages;
    meta = await readMeta(doc);
    pageTexts = await extractText(doc);
    cover = await makeCover(doc);
  } catch (err) {
    console.warn('PDF okunamadi:', file.name, err);
  } finally {
    if (doc) { try { await doc.destroy(); } catch {} }
  }

  const fromName = parseFileName(file.name);
  const text = pageTexts.join('\n\n').trim();

  // Baslik icin en iyi aday: sidecar > PDF ust verisi > dosya adi > metnin ilk satiri
  const firstLine = (pageTexts[0] || '')
    .split('\n').map(s => s.trim()).find(s => s.length > 12 && s.length < 140) || '';

  const title =
    sidecar.title || meta.title || fromName.title || firstLine || file.name.replace(/\.pdf$/i, '');


  const date =
    sidecar.date ||
    fromName.date ||
    (meta.created ? dayKey(new Date(meta.created)) : null) ||
    dayKey(new Date(file.lastModified || Date.now()));

  const existing = opts.existing;
  const path = opts.path || file.name;

  const article = {
    id: existing ? existing.id : uid(),
    fingerprint: opts.fingerprint || `${path}|${file.size}|${file.lastModified || 0}`,
    path,
    fileName: file.name,

    title: clamp(title, 260),
    source: clamp(sidecar.source || meta.author || fromName.source || 'Daily Now', 60),
    author: sidecar.author || meta.author || '',
    category: sidecar.category || '',
    summary: clamp(sidecar.summary || meta.subject || firstSentences(text), 600),
    url: sidecar.url || '',
    tags: splitTags(sidecar.tags || meta.keywords),

    date,
    publishedAt: sidecar.publishedAt || meta.created || new Date(file.lastModified || Date.now()).toISOString(),
    addedAt: existing ? existing.addedAt : new Date().toISOString(),

    pages,
    size: file.size,
    cover,
    text: text.slice(0, 400000),

    read: existing ? existing.read : !!sidecar.read,
    starred: existing ? existing.starred : !!sidecar.starred,
    missing: false,
  };

  // Dosyanin kendisi de saklaniyor ki sunucu kapaliyken bile haber acilabilsin.
  await Files.put(article.id, file);
  await Articles.put(article);
  return article;
}

/** Article -> Blob. */
export async function fileOf(article) {
  const blob = await Files.get(article.id);
  if (!blob) throw new Error(t('reader.failTitle'));
  return blob;
}

/* ────────────────────────── native (PDF'siz) haber ────────────────────────── */

/** body bloklarindan ve story listesinden arama icin duz metin cikarir. */
/* Arama icin duz metin. Iki dilli alanlarin her iki karsiligi da giriyor ki
   Ingilizce arayuzdeyken Turkce ceviride gecen kelimeyle de arama yapilabilsin. */
function flattenBody(data) {
  const parts = [allText(data.title), allText(data.lead)];
  for (const s of data.stories || []) {
    parts.push(allText(s.title), allText(s.summary || s.text), allText(s.detail),
               allText(s.points), allText(s.source));
  }
  for (const block of data.body || []) {
    if (typeof block === 'string') { parts.push(block); continue; }
    parts.push(allText(block.heading), allText(block.text));
    for (const b of block.bullets || []) parts.push(typeof b === 'string' ? b : allText(b.text));
  }
  parts.push(allText(data.quote));
  return parts.filter(Boolean).join('\n\n');
}

/**
 * PDF'siz, dogrudan JSON'dan uretilen bir "native" haber sayfasi alir.
 * @param {object} data  inbox/index.json'daki tam JSON (path, size, mtime dahil)
 * @param {object} opts  { fingerprint, existing }
 */
export async function importArticle(data, opts = {}) {
  const path = data.path;
  const text = flattenBody(data);
  const existing = opts.existing;
  const mtime = data.mtime || Date.now();

  const article = {
    id: existing ? existing.id : uid(),
    fingerprint: opts.fingerprint || `${path}|${data.size || 0}|${mtime}`,
    path,
    fileName: path.split('/').pop(),
    kind: 'native',

    title: clamp(data.title || t('article.untitled'), 260),
    source: clamp(data.source || 'Daily Now', 60),
    author: data.author || '',
    category: data.category || '',
    kicker: data.kicker || '',
    summary: clamp(data.summary || firstSentences(text), 600),
    url: data.url || '',
    tags: splitTags(data.tags),

    date: data.date || dayKey(new Date(mtime)),
    publishedAt: data.publishedAt || new Date(mtime).toISOString(),
    addedAt: existing ? existing.addedAt : new Date().toISOString(),

    pages: 0,
    size: data.size || 0,
    cover: null,
    lead: data.lead || '',
    body: Array.isArray(data.body) ? data.body : [],
    stories: Array.isArray(data.stories) ? data.stories : [],
    quote: data.quote || '',
    text: text.slice(0, 400000),

    read: existing ? existing.read : !!data.read,
    starred: existing ? existing.starred : !!data.starred,
    missing: false,
  };

  await Articles.put(article);
  return article;
}

/* ────────────────────────── gelen kutusu ────────────────────────── */

/** inbox/index.json okunabiliyor mu? Degilse null doner. */
export async function probeServerInbox() {
  if (location.protocol === 'file:') return null;
  try {
    const res = await fetch(INDEX_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.ok ? data : null;
  } catch {
    return null;
  }
}

/** inbox/ ile arsivi esitler: yeni/degismis PDF'leri ve native JSON haberleri iceri alir. */
export async function syncInbox(index, existingArticles, onProgress) {
  const byPath = new Map(existingArticles.map(a => [a.path, a]));
  const nativeList = index.articles || [];

  const pdfJobs = index.files.filter(f => {
    const prev = byPath.get(f.path);
    return !prev || prev.fingerprint !== fingerprintOf(f) || prev.missing;
  });
  const nativeJobs = nativeList.filter(a => {
    const prev = byPath.get(a.path);
    return !prev || prev.fingerprint !== fingerprintOf(a) || prev.missing;
  });

  const total = pdfJobs.length + nativeJobs.length;
  const imported = [];
  const failed = [];

  for (let i = 0; i < pdfJobs.length; i++) {
    const f = pdfJobs[i];
    if (onProgress) onProgress(i, total, f.path);
    try {
      const res = await fetch(INBOX_URL + encodePath(f.path), { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const name = f.path.split('/').pop();
      const file = new File([blob], name, { type: 'application/pdf', lastModified: f.mtime });

      imported.push(await importPdf(file, {
        sidecar: index.sidecars[f.path.replace(/\.pdf$/i, '')] || {},
        path: f.path,
        // Parmak izi sunucunun bildirdigi boyut/zamandan kuruluyor; File nesnesinin
        // kendi lastModified'ine guvenilmiyor.
        fingerprint: fingerprintOf(f),
        existing: byPath.get(f.path),
      }));
    } catch (e) {
      console.warn('inbox alinamadi:', f.path, e);
      failed.push(f.path);
    }
  }

  for (let i = 0; i < nativeJobs.length; i++) {
    const a = nativeJobs[i];
    if (onProgress) onProgress(pdfJobs.length + i, total, a.path);
    try {
      imported.push(await importArticle(a, {
        fingerprint: fingerprintOf(a),
        existing: byPath.get(a.path),
      }));
    } catch (e) {
      console.warn('native haber alinamadi:', a.path, e);
      failed.push(a.path);
    }
  }

  // Klasorden silinenler arsivde kalir ama "eksik" isaretlenir.
  const present = new Set([...index.files.map(f => f.path), ...nativeList.map(a => a.path)]);
  const gone = [];
  for (const [path, art] of byPath) {
    if (!present.has(path) && !art.missing) { art.missing = true; gone.push(art); }
  }
  if (gone.length) await Articles.putMany(gone);

  if (onProgress) onProgress(total, total, '');
  return { imported, failed, total: index.files.length + nativeList.length, missing: gone.length };
}

const fingerprintOf = f => `${f.path}|${f.size}|${f.mtime}`;

function encodePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

export async function removeArticle(article) {
  await Articles.del(article.id);
  await Files.del(article.id);
}
