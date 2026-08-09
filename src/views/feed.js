/* Akış — kategori seçim ekranı.
 *
 * Burada haber listesi yok: ekranda yalnızca kategori kartları durur. Bir karta
 * basınca o kategorinin bütün gündemi popup sayfada açılır (views/category.js)
 * ve okuma orada yapılır. Bu dosya kartların beslendiği süzülmüş story listesini
 * üretir; kategori sayfası da aynı listeyi kullanır, böylece kart üstündeki
 * sayı ile içeride görünen başlık sayısı hep birbirini tutar.
 */

import { state, catOf, isStoryRead, isStoryStarred } from '../store.js';
import { collectStories } from '../stories.js';
import { countByCategory, categoryCardsHtml } from '../categories.js';
import { dayKey, dayKeyOffset, formatDay } from '../util.js';
import { t } from '../i18n.js';

/** Seçili aralık ve süzgeçlerden geçen bütün başlıklar (kategori ayrımı yapmadan). */
export function visibleStories() {
  const f = state.filters;

  let docs = state.articles.filter(a => !a.missing);
  if (f.range === 'today') {
    const today = dayKey();
    docs = docs.filter(a => a.date >= today);
  } else if (f.range === '7' || f.range === '30') {
    const from = dayKeyOffset(+f.range - 1);
    docs = docs.filter(a => a.date >= from);
  }
  if (f.tag) docs = docs.filter(a => (a.tags || []).includes(f.tag));

  // Kategori story'ye ait olduğu belgeden geliyor.
  const catByDoc = new Map(docs.map(a => [a.id, catOf(a)]));
  let stories = collectStories(docs);
  for (const s of stories) s.category = catByDoc.get(s.articleId);

  if (f.unread) stories = stories.filter(s => !isStoryRead(s.key));
  if (f.starred) stories = stories.filter(s => isStoryStarred(s.key));
  return stories;
}

export function unreadStoryCount() {
  return collectStories(state.articles.filter(a => !a.missing))
    .filter(s => !isStoryRead(s.key)).length;
}

/** "1 okunmadi" ile "{n} okunmadi" arasindaki tekil/cogul farki. */
export function unreadLabel(n) {
  return n === 1 ? t('unread.one') : t('feed.unreadN', { n });
}

export function renderFeed(root) {
  const f = state.filters;
  const list = visibleStories();

  document.getElementById('feedCats').innerHTML = categoryCardsHtml(
    countByCategory(list, s => s.category),
    countByCategory(list.filter(s => !isStoryRead(s.key)), s => s.category),
  );

  document.getElementById('feedTitle').textContent =
    f.range === 'today' ? t('feed.today')
    : f.range === 'all' ? t('feed.all')
    : t('feed.lastDays', { n: f.range });

  const unread = list.filter(s => !isStoryRead(s.key)).length;
  const stamp = f.range === 'today' ? `${formatDay(dayKey())} · ` : '';
  const count = list.length === 1 ? t('feed.countOne') : t('feed.count', { n: list.length });
  const status = list.length
    ? `${stamp}${count} · ${unread ? unreadLabel(unread) : t('feed.allRead')}`
    : `${stamp}${t('feed.none')}`;
  const lastUpdate = list.reduce((latest, s) => {
    const v = s.fetchedAt || s.time || '';
    return v > latest ? v : latest;
  }, '');
  document.getElementById('feedSub').textContent = lastUpdate
    ? `${status} · ${t('feed.lastUpdate', { t: lastUpdate })}`
    : status;

  root.innerHTML = list.length ? '' : emptyState();
}

function emptyState() {
  const f = state.filters;
  const filtered = f.unread || f.starred || f.tag || f.range !== 'all';

  if (state.articles.length && filtered) {
    return `<div class="empty">
      <div class="em-ico">◍</div>
      <h3>${t('empty.filtered.title')}</h3>
      <p>${t('empty.filtered.text')}</p>
      <button class="btn" data-act="clear-filters">${t('empty.filtered.btn')}</button>
    </div>`;
  }

  if (state.serverInbox) {
    return `<div class="empty">
      <div class="em-ico">📥</div>
      <h3>${t('empty.waiting.title')}</h3>
      <p>${t('empty.waiting.text')}</p>
      <button class="btn btn-primary" data-act="sync">${t('empty.waiting.btn')}</button>
    </div>`;
  }

  return `<div class="empty">
    <div class="em-ico">🔌</div>
    <h3>${t('empty.offline.title')}</h3>
    <p>${t('empty.offline.text')}</p>
    <button class="btn btn-primary" data-act="sync">${t('empty.offline.btn')}</button>
  </div>`;
}
