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

/** Sol menüdeki kaynak çipleri haber kaynaklarını (AA, Reuters…) sayar. */
export function storySources() {
  const m = new Map();
  for (const s of collectStories(state.articles.filter(a => !a.missing))) {
    if (s.source) m.set(s.source, (m.get(s.source) || 0) + 1);
  }
  return Array.from(m, ([name, count]) => ({ name, count })).sort((x, y) => y.count - x.count);
}

export function unreadStoryCount() {
  return collectStories(state.articles.filter(a => !a.missing))
    .filter(s => !isStoryRead(s.key)).length;
}

export function renderFeed(root) {
  const f = state.filters;
  const list = visibleStories();

  document.getElementById('feedCats').innerHTML = categoryCardsHtml(
    countByCategory(list, s => s.category),
    countByCategory(list.filter(s => !isStoryRead(s.key)), s => s.category),
  );

  document.getElementById('feedTitle').textContent =
    f.range === 'today' ? 'Bugünün gündemi'
    : f.range === 'all' ? 'Tüm gündem'
    : `Son ${f.range} gün`;

  const unread = list.filter(s => !isStoryRead(s.key)).length;
  const stamp = f.range === 'today' ? `${formatDay(dayKey())} · ` : '';
  const status = list.length
    ? `${stamp}${list.length} başlık${unread ? ` · ${unread} okunmadı` : ' · hepsi okundu'}`
    : `${stamp}Henüz başlık yok`;
  document.getElementById('feedSub').textContent = `${status} · her gün 07:00’de güncellenir`;

  root.innerHTML = list.length ? '' : emptyState();
}

function emptyState() {
  const f = state.filters;
  const filtered = f.unread || f.starred || f.tag || f.range !== 'all';

  if (state.articles.length && filtered) {
    return `<div class="empty">
      <div class="em-ico">◍</div>
      <h3>Bu filtreyle başlık yok</h3>
      <p>Filtreleri temizleyip tüm gündeme bakabilirsin.</p>
      <button class="btn" data-act="clear-filters">Filtreleri temizle</button>
    </div>`;
  }

  if (state.serverInbox) {
    return `<div class="empty">
      <div class="em-ico">📥</div>
      <h3>Bugünün gündemi henüz gelmedi</h3>
      <p>Gündem her gün sabah 07:00’de otomatik güncelleniyor.</p>
      <button class="btn btn-primary" data-act="sync">Yenile</button>
    </div>`;
  }

  return `<div class="empty">
    <div class="em-ico">🔌</div>
    <h3>Gündem şu an okunamıyor</h3>
    <p>Bağlantını kontrol edip tekrar dene.</p>
    <button class="btn btn-primary" data-act="sync">Tekrar dene</button>
  </div>`;
}
