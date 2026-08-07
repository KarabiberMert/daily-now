/* pdf.js sarmalayicisi — metin cikarimi, kapak onizlemesi, sayfa render. */

import * as pdfjs from '../vendor/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

// Gomulu olmayan standart fontlar (Helvetica, Times, Courier…) icin yerel font verisi.
const STANDARD_FONTS = new URL('../vendor/standard_fonts/', import.meta.url).href;

/** ArrayBuffer -> pdf.js dokumani. Not: pdf.js buffer'i "transfer" eder,
 *  bu yuzden her cagriya kendi kopyasini veriyoruz. */
export function loadDoc(buffer) {
  return pdfjs.getDocument({
    data: buffer.slice(0),
    isEvalSupported: false,
    standardFontDataUrl: STANDARD_FONTS,
  }).promise;
}

/** PDF'in gomulu meta verisi (Title / Author / Subject / Keywords). */
export async function readMeta(doc) {
  try {
    const { info } = await doc.getMetadata();
    return {
      title: clean(info && info.Title),
      author: clean(info && info.Author),
      subject: clean(info && info.Subject),
      keywords: clean(info && info.Keywords),
      created: parsePdfDate(info && info.CreationDate),
    };
  } catch { return {}; }
}

/** Tum sayfalarin metni. Sayfa basina bir string dizisi doner. */
export async function extractText(doc, maxPages = 60) {
  const pages = [];
  const n = Math.min(doc.numPages, maxPages);
  for (let i = 1; i <= n; i++) {
    try {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      let out = '';
      let lastY = null;
      for (const item of tc.items) {
        if (!('str' in item)) continue;
        const y = item.transform ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) out += '\n';
        out += item.str;
        if (item.hasEOL) out += '\n';
        lastY = y;
      }
      pages.push(out.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim());
      page.cleanup();
    } catch { pages.push(''); }
  }
  return pages;
}

/** Ilk sayfadan kucuk bir kapak gorseli (JPEG data URL).
 *  intent:'print' bilincli bir tercih: pdf.js ekran render'ini
 *  requestAnimationFrame'e bagliyor ve sekme arka plandayken rAF durdugu icin
 *  is hic bitmiyor. Kapak uretimi gorunmez bir islem oldugundan rAF'a
 *  ihtiyaci yok. Yine de asilma ihtimaline karsi zaman asimi var. */
export async function makeCover(doc, width = 420, timeoutMs = 15000) {
  let page = null, task = null;
  try {
    page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: width / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    task = page.render({ canvasContext: ctx, viewport, intent: 'print' });
    let timer;
    const timeout = new Promise((_, rej) => {
      timer = setTimeout(() => rej(new Error('kapak zaman asimi')), timeoutMs);
    });
    try {
      await Promise.race([task.promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch (e) {
    if (task) { try { task.cancel(); } catch {} }
    console.warn('Kapak olusturulamadi:', e && e.message);
    return null;
  } finally {
    if (page) { try { page.cleanup(); } catch {} }
  }
}

/** Okuyucu icin tek sayfa render. */
export async function renderPage(doc, pageNo, scale, canvas) {
  const page = await doc.getPage(pageNo);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const viewport = page.getViewport({ scale: scale * dpr });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.width = Math.ceil(viewport.width / dpr) + 'px';
  canvas.style.height = Math.ceil(viewport.height / dpr) + 'px';
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return page;
}

function clean(v) {
  if (typeof v !== 'string') return '';
  const t = v.replace(/\s+/g, ' ').trim();
  // Word/LaTeX gibi araclarin biraktigi ise yaramaz basliklari ele
  if (/^(untitled|microsoft word|document\d*)$/i.test(t)) return '';
  return t;
}

/** "D:20260807143000+03'00'" -> ISO tarih */
function parsePdfDate(v) {
  if (typeof v !== 'string') return null;
  const m = v.match(/^D?:?(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return null;
  const d = new Date(
    +m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)
  );
  return isNaN(d) ? null : d.toISOString();
}
