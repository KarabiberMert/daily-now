/* Arama görünümü — başlık, kaynak, etiket, özet ve PDF tam metni. */

import { state } from '../store.js';
import { rowHtml } from '../cards.js';
import { esc, fold } from '../util.js';
import { t, pick } from '../i18n.js';

const FIELD_WEIGHT = { title: 12, source: 6, tags: 6, summary: 3, text: 1 };

export function search(query) {
  const q = fold(query).trim();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const results = [];

  for (const a of state.articles) {
    if (a.missing) continue; // inbox'tan kaldirilmis (eski format vb.) — sonuclarda gizle

    // fold() iki dilli alanlari da duzlestiriyor: Ingilizce arayuzdeyken
    // Turkce ceviride gecen bir kelime de sonuc getirsin diye.
    const fields = {
      title: fold(a.title),
      source: fold(a.source),
      tags: fold((a.tags || []).join(' ')),
      summary: fold(a.summary),
      text: fold(a.text || ''),
    };

    let score = 0;
    let hitIndex = -1;
    let allMatched = true;

    for (const term of terms) {
      let termScore = 0;
      for (const [name, weight] of Object.entries(FIELD_WEIGHT)) {
        const idx = fields[name].indexOf(term);
        if (idx === -1) continue;
        termScore += weight;
        if (name === 'title' && idx === 0) termScore += 6;
        if (name === 'text' && hitIndex === -1) hitIndex = idx;
      }
      if (!termScore) { allMatched = false; break; }
      score += termScore;
    }
    if (!allMatched) continue;

    if (!a.read) score += 2;
    results.push({ article: a, score, hitIndex, terms });
  }

  return results.sort((x, y) => y.score - x.score || (x.article.date < y.article.date ? 1 : -1)).slice(0, 120);
}

export function renderSearch(root, query) {
  const sub = document.getElementById('searchSub');
  const q = query.trim();

  if (q.length < 2) {
    sub.textContent = t('search.sub');
    root.innerHTML = `<div class="empty">
      <div class="em-ico">⌕</div>
      <h3>${t('search.promptTitle')}</h3>
      <p>${t('search.promptText')}</p>
    </div>`;
    return;
  }

  const results = search(q);
  sub.textContent = results.length
    ? t('search.results', { n: results.length, q })
    : t('search.noneSub', { q });

  if (!results.length) {
    root.innerHTML = `<div class="empty">
      <div class="em-ico">∅</div>
      <h3>${t('search.noneTitle')}</h3>
      <p>${t('search.noneText')}</p>
    </div>`;
    return;
  }

  root.innerHTML = `<div class="rows">${
    results.map(r => rowHtml(r.article, {
      titleHtml: highlight(articleTitle(r.article), r.terms),
      bodyHtml: snippet(r, 190),
    })).join('')
  }</div>`;
}

function snippet(r, len) {
  const a = r.article;
  if (r.hitIndex >= 0 && a.text) {
    const start = Math.max(0, r.hitIndex - 60);
    const raw = a.text.slice(start, start + len).replace(/\s+/g, ' ').trim();
    return (start > 0 ? '…' : '') + highlight(raw, r.terms) + '…';
  }
  return highlight(articleSummary(a).slice(0, len), r.terms);
}

/** Aksan-duyarsiz eslesmeyi orijinal metin uzerinde isaretler. */
function highlight(text, terms) {
  if (!text) return '';
  const folded = fold(text);
  const marks = [];
  for (const term of terms) {
    let i = folded.indexOf(term);
    while (i !== -1) { marks.push([i, i + term.length]); i = folded.indexOf(term, i + term.length); }
  }
  if (!marks.length) return esc(text);

  marks.sort((a, b) => a[0] - b[0]);
  const merged = [marks[0]];
  for (const m of marks.slice(1)) {
    const last = merged[merged.length - 1];
    if (m[0] <= last[1]) last[1] = Math.max(last[1], m[1]);
    else merged.push(m);
  }

  let out = '', cursor = 0;
  for (const [s, e] of merged) {
    out += esc(text.slice(cursor, s)) + '<mark>' + esc(text.slice(s, e)) + '</mark>';
    cursor = e;
  }
  return out + esc(text.slice(cursor));
}

/* Baslik/ozet iki dilli olabilir — sonuc satirinda secili dildeki hali gosterilir. */
function articleTitle(a) { return String(pick(a.title) || ''); }
function articleSummary(a) { return String(pick(a.summary) || ''); }
