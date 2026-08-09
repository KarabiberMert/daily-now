/* Daily Now — uygulama girisi: yonlendirme, olaylar, senkron. */

import { state, loadAll, subscribe, saveSettings, upsert, get,
         patchArticle, tags } from './store.js';
import { probeServerInbox, syncInbox } from './library.js';
import { initReader, openArticle, isOpen as readerOpen } from './reader.js';
import { bindCards } from './cards.js';
import { renderFeed, unreadStoryCount } from './views/feed.js';
import { initCategorySheet, openCategory, isOpen as sheetOpen } from './views/category.js';
import { renderSearch } from './views/search.js';
import { renderStats } from './views/stats.js';
import { $, $$, esc, debounce, toast } from './util.js';
import { t, lang, setLang, LANGS, onLangChange, months, days } from './i18n.js';

const VIEWS = ['feed', 'search', 'stats'];
const body = {
  feed: $('#feedBody'), search: $('#searchBody'), stats: $('#statsBody'),
};

/* ────────────────────────── boot ────────────────────────── */

(async function boot() {
  applyTheme(localStorage.getItem('dn-theme') || 'dark');
  document.documentElement.lang = lang();
  applyStaticI18n();

  try {
    await loadAll();
  } catch (err) {
    // Acilis ekraninda sessizce asili kalmaktansa nedenini soyleyelim.
    return bootFailed(err);
  }
  applyTheme(state.settings.theme);

  state.serverInbox = await probeServerInbox();

  initReader();
  // Popup kapanınca akış tazelensin: içeride okunan başlıklar sönükleşsin.
  initCategorySheet({ onChange: render });
  buildLangSwitch();
  buildTabbar();
  wireEvents();
  subscribe(onChange);
  // Dil degisince hem sabit metinler hem de cizilmis gorunumler tazelenir.
  onLangChange(() => { applyStaticI18n(); buildLangSwitch(); buildTabbar(); render(); });

  render();
  $('#app').hidden = false;
  const boot = $('#boot');
  boot.classList.add('out');
  setTimeout(() => boot.remove(), 400);

  if (state.serverInbox && state.settings.autoSync) sync({ quiet: true });
  startAutoRefresh();
  registerSW();
})();

function bootFailed(err) {
  console.error('Boot failed:', err);
  $('#boot').innerHTML = `
    <div class="boot-mark">DN</div>
    <div class="boot-error">
      <strong>${t('boot.failed')}</strong>
      <p>${esc(err && err.message || t('boot.unknown'))}</p>
      <button class="btn" onclick="location.reload()">${t('boot.retry')}</button>
    </div>`;
}

/* ────────────────────────── render ────────────────────────── */

function onChange() {
  render();
}

function render() {
  renderChrome();
  const v = state.view;
  if (v === 'feed') renderFeed(body.feed);
  else if (v === 'search') renderSearch(body.search, state.query);
  else if (v === 'stats') renderStats(body.stats);
}

function renderChrome() {
  const now = new Date();
  $('#brandDate').textContent = lang() === 'tr'
    ? `${now.getDate()} ${months()[now.getMonth()]} ${days()[now.getDay()]}`
    : `${months()[now.getMonth()]} ${now.getDate()} · ${days()[now.getDay()]}`;

  const n = unreadStoryCount();
  const badge = $('#badgeUnread');
  badge.hidden = !n;
  badge.textContent = n;

  $$('.nav-item').forEach(b => b.classList.toggle('is-active', b.dataset.view === state.view));
  $$('#tabbar button').forEach(b => b.classList.toggle('is-active', b.dataset.view === state.view));
  $$('#feedRange button').forEach(b => b.classList.toggle('is-active', b.dataset.range === state.filters.range));
  $$('#filterRow .pill[data-filter]').forEach(b => b.classList.toggle('on', !!state.filters[b.dataset.filter]));

  const tagList = tags();
  $('#sideTags').hidden = !tagList.length;
  $('#tagChips').innerHTML = tagList.slice(0, 14).map(x =>
    `<button class="chip ${state.filters.tag === x.name ? 'on' : ''}" data-tag="${esc(x.name)}">${esc(x.name)}<i>${x.count}</i></button>`
  ).join('');

  // aktif filtre rozetleri
  const af = [];
  if (state.filters.tag) af.push(`<button class="pill on" data-clear="tag">#${esc(state.filters.tag)}</button>`);
  $('#activeFilters').innerHTML = af.join('');
}

function go(view) {
  if (!VIEWS.includes(view)) return;
  state.view = view;
  $$('.view').forEach(s => s.classList.toggle('is-active', s.dataset.view === view));
  $('#views').scrollTop = 0;
  closeSidebar();
  render();
}

/* ────────────────────────── events ────────────────────────── */

function wireEvents() {
  $('#nav').addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (b) go(b.dataset.view);
  });

  $('#tabbar').addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (b) go(b.dataset.view);
  });

  $('#feedRange').addEventListener('click', e => {
    const b = e.target.closest('[data-range]');
    if (!b) return;
    state.filters.range = b.dataset.range;
    render();
  });

  // Kategori seçenekleri: tıklayınca o kategorinin bütün gündemi popup açılır.
  $('#feedCats').addEventListener('click', e => {
    const b = e.target.closest('[data-cat-open]');
    if (b) openCategory(b.dataset.catOpen);
  });

  $('#filterRow').addEventListener('click', e => {
    const f = e.target.closest('[data-filter]');
    if (f) { state.filters[f.dataset.filter] = !state.filters[f.dataset.filter]; render(); return; }
    const c = e.target.closest('[data-clear]');
    if (c) { state.filters[c.dataset.clear] = null; render(); }
  });

  $('#sidebar').addEventListener('click', e => {
    const tg = e.target.closest('[data-tag]');
    if (tg) { state.filters.tag = state.filters.tag === tg.dataset.tag ? null : tg.dataset.tag; go('feed'); return; }
  });

  $('#btnMenu').onclick = () => $('#sidebar').classList.toggle('open');
  $('#scrim').onclick = closeSidebar;
  $('#btnTheme').onclick = () => saveSettings({ theme: state.settings.theme === 'dark' ? 'light' : 'dark' })
    .then(() => applyTheme(state.settings.theme));

  $('#langSwitch').addEventListener('click', e => {
    const b = e.target.closest('[data-lang]');
    if (b) setLang(b.dataset.lang);
  });

  const searchInput = $('#globalSearch');
  const runSearch = debounce(() => {
    state.query = searchInput.value;
    if (state.query.trim().length >= 2 && state.view !== 'search') go('search');
    else if (state.view === 'search') renderSearch(body.search, state.query);
  }, 180);
  searchInput.addEventListener('input', runSearch);
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') { searchInput.value = ''; state.query = ''; searchInput.blur(); go('feed'); }
  });

  // arama sonuclari hala belge acar
  bindCards(body.search, {
    onOpen: id => { const a = get(id); if (a) openArticle(a); },
    onStar: async id => {
      const a = get(id);
      if (a) { await patchArticle(id, { starred: !a.starred }); }
    },
  });

  // data-act delegasyonu (tum gorunumler)
  document.addEventListener('click', onAction);
  document.addEventListener('keydown', onKey);
}

async function onAction(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;

  if (act === 'sync') sync();
  else if (act === 'clear-filters') {
    state.filters = { range: 'all', unread: false, starred: false, tag: null };
    render();
  }
}

function onKey(e) {
  // Okuyucu ya da kategori sayfası açıkken kısayollar arkadaki akışı gezdirmesin.
  if (readerOpen() || sheetOpen()) return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault(); $('#globalSearch').focus(); $('#globalSearch').select(); return;
  }
  if (typing) return;

  if (e.key === '/') { e.preventDefault(); $('#globalSearch').focus(); }
  else if (e.key >= '1' && e.key <= '3') go(VIEWS[+e.key - 1]);
  else if (e.key.toLowerCase() === 'r') sync();
}

/* ────────────────────────── senkron / alma ────────────────────────── */

/** inbox/ klasörünü tarar ve yeni haberleri arşive alır. */
async function sync({ quiet = false } = {}) {
  if (state.syncing) return;

  state.serverInbox = await probeServerInbox();
  if (!state.serverInbox) {
    renderChrome();
    if (!quiet) toast(t('toast.offline'), 'err');
    return;
  }
  lastInboxSignature = signatureOf(state.serverInbox);

  state.syncing = true;
  renderChrome();

  let result = null, error = null;
  try {
    result = await syncInbox(state.serverInbox, state.articles);
    upsert(result.imported);
  } catch (err) {
    console.error(err);
    error = err.message || String(err);
  } finally {
    state.syncing = false;
    // Bir şey değişmediyse tüm görünümü yeniden çizmiyoruz: arka planda dakikada
    // bir tarandığı için, açtığın satırları kapatmak ve kaydırmayı bozmak olurdu.
    if (error || (result && (result.imported.length || result.missing))) render();
    else renderChrome();
  }

  if (error) { if (!quiet) toast(t('toast.syncFail', { err: error }), 'err'); return; }
  if (result.failed.length) toast(t('toast.readFail', { n: result.failed.length }), 'err');
  if (result.imported.length) toast(t('toast.imported', { n: result.imported.length }), 'ok');
  else if (!quiet) toast(result.missing ? t('toast.removed', { n: result.missing }) : t('toast.noNew'), 'ok');
}

/* ── açıkken kendiliğinden tazeleme ──
 * Uygulama eskiden yalnızca açılışta tarıyordu; Cowork sen uygulamayı açıkken
 * haber bıraktığında bunun farkına varmıyordu. Artık sekme öndeyken dakikada bir
 * ve her odağa dönüşte inbox'ın parmak izine bakılıyor, yalnızca değiştiyse
 * gerçek tarama yapılıyor.                                                    */

const POLL_MS = 60_000;
let lastInboxSignature = '';

function signatureOf(index) {
  const entries = [...(index.files || []), ...(index.articles || [])];
  let sum = 0;
  for (const e of entries) sum += (e.size || 0) + (e.mtime || 0);
  return `${entries.length}:${sum}`;
}

function startAutoRefresh() {
  const tick = async () => {
    if (!state.settings.autoSync || state.syncing || document.hidden) return;
    const index = await probeServerInbox();
    if (!index) return;

    const sig = signatureOf(index);
    state.serverInbox = index;
    if (sig === lastInboxSignature) { renderChrome(); return; }  // değişiklik yok
    await sync({ quiet: true });
  };

  setInterval(tick, POLL_MS);
  window.addEventListener('focus', tick);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
}

/* ────────────────────────── yardimcilar ────────────────────────── */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('dn-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'light' ? '#f6f4ef' : '#0a0c11';
}

/** index.html'deki sabit metinleri secili dile cevirir. */
function applyStaticI18n() {
  $$('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  $$('[data-i18n-placeholder]').forEach(n => { n.placeholder = t(n.dataset.i18nPlaceholder); });
  $$('[data-i18n-title]').forEach(n => { n.title = t(n.dataset.i18nTitle); });
  $$('[data-i18n-aria]').forEach(n => { n.setAttribute('aria-label', t(n.dataset.i18nAria)); });
  document.title = 'Daily Now';
}

function buildLangSwitch() {
  $('#langSwitch').innerHTML = LANGS.map(l => `
    <button data-lang="${l.id}" class="${l.id === lang() ? 'is-active' : ''}"
            title="${esc(l.label)}" lang="${l.id}">${l.short}</button>`).join('');
}

function buildTabbar() {
  $('#tabbar').innerHTML = $$('.nav-item').map(b => `
    <button data-view="${b.dataset.view}" class="${b.dataset.view === state.view ? 'is-active' : ''}">
      ${b.querySelector('svg').outerHTML}
      <span>${b.querySelector('span').textContent}</span>
    </button>`).join('');
}

function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#scrim').hidden = true;
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Konsoldan hata ayiklama icin kucuk bir kanca.
window.DailyNow = { state, sync, go, render };

// mobilde kenar cubugu acikken karartma
new MutationObserver(() => {
  $('#scrim').hidden = !$('#sidebar').classList.contains('open');
}).observe($('#sidebar'), { attributes: true, attributeFilter: ['class'] });
