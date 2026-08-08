/* Kategori sayfası — akıştaki kategori kartına basınca açılan popup.
 *
 * Okuma buranın işi: tek sayfada o kategorinin bütün gündemi, her başlık için
 * uzun Türkçe özet, varsa maddeler, yıldız düğmesi ve kaynağa giden bağlantı.
 * Ana akışta liste olmadığı için okundu/yıldız etkileşimi de burada yaşıyor.
 * En altta aynı kategoriden, seçili aralığın dışında kalan eski başlıklar durur.
 */

import { state, catOf, get, isStoryRead, isStoryStarred,
         markStoryRead, toggleStoryStar } from '../store.js';
import { collectStories, storyTime } from '../stories.js';
import { visibleStories } from './feed.js';
import { CATEGORY_LABEL, toneOf } from '../categories.js';
import { openArticle } from '../reader.js';
import { $, esc, formatDay, relativeDay, dayKeyOffset } from '../util.js';

let onNavigate = null;
let seen = null;      // görünen başlıkları okundu sayan kaydırma dinleyicisi
const el = {};

export function initCategorySheet({ onChange } = {}) {
  onNavigate = onChange;
  el.root = $('#sheet');
  el.panel = el.root.querySelector('.sheet-panel');
  el.body = $('#sheetBody');
  el.kicker = $('#sheetKicker');
  el.title = $('#sheetTitle');
  el.sub = $('#sheetSub');

  el.root.addEventListener('click', onClick);

  document.addEventListener('keydown', e => {
    if (!isOpen() || e.key !== 'Escape') return;
    e.preventDefault();
    close();
  });
}

async function onClick(e) {
  if (e.target.closest('[data-sheet-close]')) return close();

  const star = e.target.closest('[data-story-star]');
  if (star) {
    const on = await toggleStoryStar(star.dataset.storyStar);
    star.classList.toggle('on', on);
    return;
  }

  const doc = e.target.closest('[data-open-doc]');
  if (doc) {
    const article = get(doc.dataset.openDoc);
    if (!article) return;
    markStoryRead(doc.dataset.storyKey);
    close();
    openArticle(article);
    return;
  }

  const link = e.target.closest('a[data-story-link]');
  if (link) markStoryRead(link.dataset.storyLink);   // yeni sekmede açılır
}

export function isOpen() { return !!el.root && !el.root.hidden; }

export function close() {
  if (!el.root) return;
  el.root.hidden = true;
  document.body.style.overflow = '';
  stopWatch();
  el.body.innerHTML = '';
  if (onNavigate) onNavigate();
}

/* Ana ekranda liste kalmadığı için "okundu" burada oluşuyor: bir başlık
   panelin üst üçte ikisine girdiyse okunmuş sayılır. Popup açılır açılmaz
   hepsini birden işaretlemek, daha okumadan rozeti sıfırlardı.
   Oran değil konum ölçülüyor: uzun bir haber panele hiç sığmayabilir. */
function watchRead() {
  stopWatch();
  const pending = new Set(
    [...el.body.querySelectorAll('[data-story-read]')]
      .filter(n => !isStoryRead(n.dataset.storyRead)));
  if (!pending.size) return;

  const check = () => {
    const box = el.body.getBoundingClientRect();
    const limit = box.top + box.height * .65;
    for (const n of pending) {
      const r = n.getBoundingClientRect();
      if (r.top < limit && r.bottom > box.top) {
        pending.delete(n);
        n.classList.add('is-read');
        markStoryRead(n.dataset.storyRead);
      }
    }
    if (!pending.size) stopWatch();
  };

  let last = 0;
  seen = () => {
    const t = performance.now();
    if (t - last < 100) return;   // kaydırma sırasında saniyede en çok 10 ölçüm
    last = t;
    check();
  };
  el.body.addEventListener('scroll', seen, { passive: true });
  check();
}

function stopWatch() {
  if (seen) el.body.removeEventListener('scroll', seen);
  seen = null;
}

/** Kategorinin bütün gündemini tek sayfada açar. */
export function openCategory(categoryId) {
  const label = CATEGORY_LABEL[categoryId] || 'Gündem';

  // Ana ekranla aynı süzgeçlerden geçmiş liste — kart üstündeki sayı ile burada
  // görünen başlık sayısı hep aynı olsun diye.
  const current = visibleStories().filter(s => s.category === categoryId);
  const older = olderStories(categoryId);

  el.panel.style.setProperty('--tone', toneOf(categoryId));
  el.kicker.textContent = label.toUpperCase();
  el.title.textContent = `${label} Gündemi`;
  const days = new Set(current.map(s => s.date));
  el.sub.textContent = current.length
    ? `${current.length} başlık · ${days.size === 1 ? formatDay(current[0].date) : `${days.size} gün`}`
    : 'Bu aralıkta başlık yok';

  el.body.innerHTML = (current.length
    ? current.map((s, i) => storyPage(s, i + 1)).join('')
    : `<div class="empty" style="margin:20px 0"><div class="em-ico">◍</div>
         <h3>Bu aralıkta başlık yok</h3>
         <p>Üstteki gün aralığını genişlet ya da yeni bir gündem yayınlat.</p></div>`
  ) + relatedHtml(older, label);

  el.root.hidden = false;
  el.body.scrollTop = 0;
  document.body.style.overflow = 'hidden';
  el.panel.focus?.();
  watchRead();
}

/** Seçili aralığın dışında kalan, aynı kategoriden eski başlıklar. */
function olderStories(categoryId) {
  const from = rangeStart();
  if (!from) return [];
  const docs = state.articles.filter(a => !a.missing);
  const catByDoc = new Map(docs.map(a => [a.id, catOf(a)]));
  return collectStories(docs)
    .filter(s => catByDoc.get(s.articleId) === categoryId && s.date < from)
    .slice(0, 12);
}

function rangeStart() {
  const r = state.filters.range;
  if (r === 'today') return dayKeyOffset(0);
  if (r === '7' || r === '30') return dayKeyOffset(+r - 1);
  return null;   // tümü
}

/** Her başlığın altındaki eylem: önce kaynak sayfası, o yoksa haberin kendi
 *  belgesi. İkisi de yoksa elimizde adresi olmayan bir kaynak var demektir. */
function actionHtml(s) {
  if (s.url) {
    return `<a class="ss-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"
               data-story-link="${esc(s.key)}">${esc(s.source || 'Kaynak')} sayfasına git ↗</a>`;
  }
  if (s.articleId && get(s.articleId)) {
    const what = s.isDocument ? 'Haberin tamamını aç' : 'Özetin tamamını aç';
    return `<button class="ss-link ss-link-btn" data-open-doc="${esc(s.articleId)}"
                    data-story-key="${esc(s.key)}">${what} ↗</button>`;
  }
  return s.source ? `<span class="ss-src">${esc(s.source)}</span>` : '';
}

function storyPage(s, rank) {
  const time = storyTime(s);
  const rel = relativeDay(s.date);
  const detail = s.detail.length
    ? s.detail.map(p => `<p>${esc(p)}</p>`).join('')
    : (s.summary ? `<p>${esc(s.summary)}</p>` : '');

  const points = s.points.length
    ? `<ul class="ss-points">${s.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`
    : '';

  const stamp = [s.source, rel || formatDay(s.date), time].filter(Boolean).join(' · ');
  const fetchedBadge = s.fetchedAt ? `
    <span class="ss-fetched" title="Ollama bu haberi ${esc(s.fetchedAt)}'de işleyip yayınladı">
      <svg class="ss-fetched-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 2.6-6.4M3 4v5h5"/></svg>
      ${esc(s.fetchedAt)}’de güncellendi
    </span>` : '';

  return `
  <article class="ss ${isStoryRead(s.key) ? 'is-read' : ''}" data-story-read="${esc(s.key)}">
    <div class="ss-top">
      <span class="ss-rank">${String(rank).padStart(2, '0')}</span>
      <div class="ss-head">
        ${s.title ? `<h3>${esc(s.title)}</h3>` : ''}
        <div class="ss-stamp">${esc(stamp)}${fetchedBadge}</div>
      </div>
      <button class="ss-star ${isStoryStarred(s.key) ? 'on' : ''}"
              data-story-star="${esc(s.key)}" aria-label="Yıldızla">
        <svg viewBox="0 0 24 24"><path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9Z"/></svg>
      </button>
    </div>
    ${s.title && s.summary ? `<p class="ss-lead">${esc(s.summary)}</p>` : ''}
    <div class="ss-detail">${detail}${points}</div>
    <div class="ss-foot">${actionHtml(s)}</div>
  </article>`;
}

function relatedHtml(older, label) {
  if (!older.length) return '';
  return `
  <section class="sheet-related">
    <h4>İlgili diğer başlıklar</h4>
    <p class="sr-note">${esc(label)} kategorisinden daha önceki gündemler</p>
    <ul>
      ${older.map(s => {
        const text = esc(s.title || s.summary || '');
        const meta = `<span>${esc(s.source || '')}${s.source ? ' · ' : ''}${esc(formatDay(s.date))}</span>`;
        return s.url
          ? `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"
                    data-story-link="${esc(s.key)}">${text} ↗</a>${meta}</li>`
          : `<li><span class="sr-plain">${text}</span>${meta}</li>`;
      }).join('')}
    </ul>
  </section>`;
}
