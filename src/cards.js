/* Arama sonucu satiri. */

import { esc } from './util.js';
import { t, pick } from './i18n.js';

export function rowHtml(a, snippet = '') {
  const thumb = a.cover
    ? `<img class="row-thumb" src="${a.cover}" alt="" loading="lazy">`
    : `<div class="row-thumb"></div>`;
  return `
  <article class="row" data-id="${a.id}" tabindex="0" role="button">
    ${thumb}
    <div class="row-main">
      <h3>${snippet.titleHtml || esc(pick(a.title))}</h3>
      <div class="snip">${snippet.bodyHtml || esc(pick(a.summary) || '')}</div>
      <div class="row-meta">
        <b>${esc(pick(a.source))}</b>
        <span>${esc(a.date)}</span>
        ${a.pages ? `<span>${esc(t('row.pages', { n: a.pages }))}</span>` : ''}
        ${(a.tags || []).slice(0, 3).map(tag => `<span>#${esc(tag)}</span>`).join('')}
        ${a.read ? '' : `<span style="color:var(--accent)">${t('row.unread')}</span>`}
      </div>
    </div>
  </article>`;
}

/** Kart/satir tiklamalarini tek yerden bagla. */
export function bindCards(root, { onOpen, onStar }) {
  root.addEventListener('click', e => {
    const star = e.target.closest('[data-star]');
    if (star) { e.stopPropagation(); onStar(star.dataset.star); return; }
    const item = e.target.closest('[data-id]');
    if (item) onOpen(item.dataset.id);
  });
  root.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('[data-id]');
    if (item) { e.preventDefault(); onOpen(item.dataset.id); }
  });
}
