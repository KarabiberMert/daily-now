/* Dil katmani — arayuz metinleri ve iki dilli haber alanlari.
 *
 * Uygulama varsayilan olarak Ingilizce acilir; sag ustteki secici Turkce'ye
 * gecirir. Secim localStorage'da tutulur (IndexedDB ayarlarindan once, ilk
 * boyama sirasinda gerektigi icin).
 *
 * Haber icerigi de iki dilli: bir alan ya duz metin (her dilde ayni) ya da
 * { "en": "...", "tr": "..." } bicimindedir. pick() dogru karsiligi secer,
 * eksikse Ingilizce'ye duser.
 */

export const LANGS = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'tr', label: 'Türkçe',  short: 'TR' },
];

export const DEFAULT_LANG = 'en';
const LANG_IDS = new Set(LANGS.map(l => l.id));
const STORAGE_KEY = 'dn-lang';

let current = read();
const subs = new Set();

function read() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && LANG_IDS.has(saved)) return saved;
  } catch {}
  return DEFAULT_LANG;
}

export function lang() { return current; }

export function setLang(id) {
  if (!LANG_IDS.has(id) || id === current) return false;
  current = id;
  try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  document.documentElement.lang = id;
  subs.forEach(fn => fn(id));
  return true;
}

/** Dil degisiminde yeniden cizim icin. */
export function onLangChange(fn) { subs.add(fn); return () => subs.delete(fn); }

/* ────────────────────── iki dilli icerik alanlari ────────────────────── */

/** { en: …, tr: … } bicimli bir deger mi? */
export function isLangMap(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length > 0 && keys.every(k => LANG_IDS.has(k.toLowerCase()));
}

/**
 * Bir icerik alanindan secili dildeki karsiligi cikarir.
 * Duz metin/dizi oldugu gibi doner; dil haritasiysa secili dil, o yoksa
 * Ingilizce, o da yoksa elde ne varsa.
 */
export function pick(v, l = current) {
  if (!isLangMap(v)) return v;
  const map = {};
  for (const [k, val] of Object.entries(v)) map[k.toLowerCase()] = val;
  const hit = map[l] ?? map[DEFAULT_LANG];
  if (hit != null && hit !== '' && !(Array.isArray(hit) && !hit.length)) return hit;
  for (const id of LANG_IDS) if (map[id] != null && map[id] !== '') return map[id];
  return '';
}

/**
 * Bir nesnedeki alani okur. Hem `title: {en, tr}` hem de `title_en` / `title_tr`
 * yazimini destekler — gunluk rutin hangisini yazarsa yazsin calissin diye.
 */
export function field(obj, name, l = current) {
  if (!obj) return undefined;
  const suffixed = obj[`${name}_${l}`];
  if (suffixed != null && suffixed !== '') return suffixed;
  const fallback = obj[`${name}_${DEFAULT_LANG}`];
  if (obj[name] == null && fallback != null) return fallback;
  return pick(obj[name], l);
}

/* ────────────────────────── tarih / sayi ────────────────────────── */

const MONTHS = {
  en: ['January','February','March','April','May','June',
       'July','August','September','October','November','December'],
  tr: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
       'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
};

const DAYS = {
  en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  tr: ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'],
};

export const months = (l = current) => MONTHS[l] || MONTHS.en;
export const days   = (l = current) => DAYS[l]   || DAYS.en;
export const locale = (l = current) => (l === 'tr' ? 'tr-TR' : 'en-US');

/* ────────────────────────── arayuz metinleri ────────────────────────── */

const STRINGS = {
  /* kabuk */
  'app.tagline':        { en: 'The day’s important news, every morning in one place.',
                          tr: 'Günün önemli haberleri, her sabah tek yerden.' },
  'nav.feed':           { en: 'Feed',      tr: 'Akış' },
  'nav.stats':          { en: 'Stats',     tr: 'İstatistik' },
  'nav.search':         { en: 'Search',    tr: 'Arama' },
  'side.tags':          { en: 'Tags',      tr: 'Etiketler' },
  'search.placeholder': { en: 'Search the news — headline, source, tag, full text…',
                          tr: 'Haberlerde ara — başlık, kaynak, etiket, tam metin…' },
  'a11y.menu':          { en: 'Menu',      tr: 'Menü' },
  'a11y.theme':         { en: 'Theme',     tr: 'Tema' },
  'a11y.language':      { en: 'Language',  tr: 'Dil' },
  'a11y.close':         { en: 'Close',     tr: 'Kapat' },
  'a11y.star':          { en: 'Star',      tr: 'Yıldızla' },
  'a11y.prevPage':      { en: 'Previous page', tr: 'Önceki sayfa' },
  'a11y.nextPage':      { en: 'Next page', tr: 'Sonraki sayfa' },
  'a11y.zoomOut':       { en: 'Zoom out',  tr: 'Uzaklaş' },
  'a11y.zoomIn':        { en: 'Zoom in',   tr: 'Yakınlaş' },
  'a11y.download':      { en: 'Download',  tr: 'İndir' },

  /* acilis hatasi */
  'boot.failed':        { en: 'The app could not start', tr: 'Uygulama açılamadı' },
  'boot.unknown':       { en: 'Unknown error',  tr: 'Bilinmeyen hata' },
  'boot.retry':         { en: 'Try again',      tr: 'Yeniden dene' },

  /* akis */
  'feed.today':         { en: 'Today’s agenda',  tr: 'Bugünün gündemi' },
  'feed.all':           { en: 'All news',        tr: 'Tüm gündem' },
  'feed.lastDays':      { en: 'Last {n} days',   tr: 'Son {n} gün' },
  'range.today':        { en: 'Today',   tr: 'Bugün' },
  'range.7':            { en: '7 days',  tr: '7 gün' },
  'range.30':           { en: '30 days', tr: '30 gün' },
  'range.all':          { en: 'All',     tr: 'Tümü' },
  'filter.unread':      { en: 'Unread',  tr: 'Okunmamış' },
  'filter.starred':     { en: 'Starred', tr: 'Yıldızlı' },
  'feed.count':         { en: '{n} headlines', tr: '{n} başlık' },
  'feed.countOne':      { en: '1 headline',    tr: '1 başlık' },
  'feed.unreadN':       { en: '{n} unread',    tr: '{n} okunmadı' },
  'feed.allRead':       { en: 'all read',      tr: 'hepsi okundu' },
  'feed.none':          { en: 'No headlines yet', tr: 'Henüz başlık yok' },
  'feed.lastUpdate':    { en: 'updated {t}',   tr: 'son güncelleme {t}' },

  'empty.filtered.title': { en: 'No headlines match this filter',
                            tr: 'Bu filtreyle başlık yok' },
  'empty.filtered.text':  { en: 'Clear the filters to see the whole agenda.',
                            tr: 'Filtreleri temizleyip tüm gündeme bakabilirsin.' },
  'empty.filtered.btn':   { en: 'Clear filters', tr: 'Filtreleri temizle' },
  'empty.waiting.title':  { en: 'Today’s agenda hasn’t arrived yet',
                            tr: 'Bugünün gündemi henüz gelmedi' },
  'empty.waiting.text':   { en: 'The agenda refreshes automatically at regular intervals.',
                            tr: 'Gündem düzenli aralıklarla otomatik güncelleniyor.' },
  'empty.waiting.btn':    { en: 'Refresh', tr: 'Yenile' },
  'empty.offline.title':  { en: 'The agenda can’t be loaded right now',
                            tr: 'Gündem şu an okunamıyor' },
  'empty.offline.text':   { en: 'Check your connection and try again.',
                            tr: 'Bağlantını kontrol edip tekrar dene.' },
  'empty.offline.btn':    { en: 'Try again', tr: 'Tekrar dene' },

  /* kategori sayfasi */
  'cat.pageTitle':      { en: '{label}',            tr: '{label} Gündemi' },
  'cat.open':           { en: 'open',               tr: 'gündemi aç' },
  'cat.headlines':      { en: '{n} headlines',      tr: '{n} başlık' },
  'cat.headlinesOne':   { en: '1 headline',         tr: '1 başlık' },
  'cat.unreadTag':      { en: '{n} unread',         tr: '{n} okunmadı' },
  'cat.days':           { en: '{n} days',           tr: '{n} gün' },
  'cat.emptyTitle':     { en: 'No headlines in this range',
                          tr: 'Bu aralıkta başlık yok' },
  'cat.emptyText':      { en: 'Widen the date range above, or wait for the next update.',
                          tr: 'Üstteki gün aralığını genişlet ya da bir sonraki güncellemeyi bekle.' },
  'cat.sourceLink':     { en: 'Read at {source} ↗', tr: '{source} sayfasına git ↗' },
  'cat.sourceFallback': { en: 'the source',         tr: 'Kaynak' },
  'cat.openFull':       { en: 'Open the full story ↗', tr: 'Haberin tamamını aç ↗' },
  'cat.openSummary':    { en: 'Open the full summary ↗', tr: 'Özetin tamamını aç ↗' },
  'cat.related':        { en: 'Earlier headlines',  tr: 'İlgili diğer başlıklar' },
  'cat.relatedNote':    { en: 'Older agendas from {label}',
                          tr: '{label} kategorisinden daha önceki gündemler' },
  'cat.updatedAt':      { en: 'updated at {t}',     tr: '{t}’de güncellendi' },
  'cat.updatedTip':     { en: 'This story was processed and published at {t}',
                          tr: 'Bu haber {t}’de işlenip yayınlandı' },

  /* arama */
  'search.title':       { en: 'Search', tr: 'Arama' },
  'search.sub':         { en: 'Searches headlines, sources, tags, summaries and full text.',
                          tr: 'Başlık, kaynak, etiket, özet ve tam metinde arar.' },
  'search.promptTitle': { en: 'What are you looking for?', tr: 'Ne arıyorsun?' },
  'search.promptText':  { en: 'Type at least 2 characters. If you enter several words, only stories containing all of them are listed.',
                          tr: 'En az 2 harf yaz. Birden fazla kelime yazarsan hepsini birden içeren haberler listelenir.' },
  'search.results':     { en: '{n} results for “{q}”', tr: '“{q}” için {n} sonuç' },
  'search.noneSub':     { en: 'No results for “{q}”',  tr: '“{q}” için sonuç yok' },
  'search.noneTitle':   { en: 'No results found',      tr: 'Sonuç bulunamadı' },
  'search.noneText':    { en: 'Try a different word. Scanned PDFs without a text layer can’t be searched.',
                          tr: 'Farklı bir kelime dene. Metin katmanı olmayan taranmış PDF’lerde içerik araması çalışmaz.' },

  /* istatistik */
  'stats.title':        { en: 'Stats', tr: 'İstatistik' },
  'stats.sub':          { en: 'The daily pulse of your archive.', tr: 'Arşivinin günlük nabzı.' },
  'stats.emptyTitle':   { en: 'Nothing to show yet', tr: 'Gösterilecek veri yok' },
  'stats.emptyText':    { en: 'Once a few daily agendas arrive, the daily spread, source shares and your reading status are summarised here.',
                          tr: 'Birkaç gündem özeti geldiğinde günlük dağılım, kaynak payları ve okuma durumun burada özetlenir.' },
  'stats.total':        { en: 'Total headlines', tr: 'Toplam başlık' },
  'stats.linked':       { en: '{n} link to a source', tr: '{n} tanesi kaynağa bağlı' },
  'stats.thisWeek':     { en: 'This week', tr: 'Bu hafta' },
  'stats.last7':        { en: 'last 7 days', tr: 'son 7 gün' },
  'stats.unread':       { en: 'Unread', tr: 'Okunmamış' },
  'stats.starredN':     { en: '{n} starred', tr: '{n} yıldızlı' },
  'stats.dailyAvg':     { en: 'Daily average', tr: 'Günlük ortalama' },
  'stats.last30':       { en: 'last 30 days', tr: 'son 30 gün' },
  'stats.streak':       { en: 'Current streak', tr: 'Kesintisiz seri' },
  'stats.streakOn':     { en: 'days in a row', tr: 'gün üst üste gündem' },
  'stats.streakOff':    { en: 'nothing today', tr: 'bugün gündem yok' },
  'stats.flowTitle':    { en: 'Daily flow', tr: 'Günlük akış' },
  'stats.flowSub':      { en: 'Headlines published in the last 30 days',
                          tr: 'Son 30 günde gündeme giren başlık sayısı' },
  'stats.busiest':      { en: ' · busiest day {day} ({n})', tr: ' · en yoğun gün {day} ({n})' },
  'stats.sources':      { en: 'Sources', tr: 'Kaynaklar' },
  'stats.sourcesSub':   { en: 'Which outlets the headlines come from',
                          tr: 'Başlıklar hangi haber kaynaklarından geliyor' },
  'stats.tags':         { en: 'Tags', tr: 'Etiketler' },
  'stats.tagsSub':      { en: 'Most frequently used topic tags',
                          tr: 'En sık kullanılan konu etiketleri' },
  'stats.noTags':       { en: 'No tags yet. You can add a <code>tags</code> field to the published JSON.',
                          tr: 'Henüz etiket yok. Yayınlanan JSON dosyasına <code>tags</code> alanı ekleyebilirsin.' },
  'stats.heatTitle':    { en: 'Last 90 days', tr: 'Son 90 gün' },
  'stats.heatSub':      { en: 'Each square is a day — filled squares had news',
                          tr: 'Her kare bir gün — koyu kareler gündem gelen günler' },
  'stats.readTitle':    { en: 'Reading status', tr: 'Okuma durumu' },
  'stats.readSub':      { en: 'How much of the agenda you have read',
                          tr: 'Gündemin ne kadarını okudun' },
  'stats.read':         { en: 'Read', tr: 'Okundu' },
  'stats.notRead':      { en: 'Unread', tr: 'Okunmadı' },
  'stats.starred':      { en: 'Starred', tr: 'Yıldızlı' },
  'stats.noData':       { en: 'No data', tr: 'Veri yok' },
  'stats.today':        { en: 'today', tr: 'bugün' },
  'stats.headlineN':    { en: '{n} headlines', tr: '{n} başlık' },

  /* satirlar / okuyucu / bildirimler */
  'row.pages':          { en: '{n} pages', tr: '{n} sayfa' },
  'row.unread':         { en: 'unread', tr: 'okunmadı' },
  'reader.source':      { en: 'Source: {source} ↗', tr: 'Kaynak: {source} ↗' },
  'reader.link':        { en: 'link', tr: 'bağlantı' },
  'reader.opening':     { en: 'Opening the PDF…', tr: 'PDF açılıyor…' },
  'reader.failTitle':   { en: 'The file could not be opened', tr: 'Dosya açılamadı' },
  'reader.pdfFail':     { en: 'The PDF could not be read', tr: 'PDF okunamadı' },
  'toast.starred':      { en: 'Starred', tr: 'Yıldızlandı' },
  'toast.unstarred':    { en: 'Star removed', tr: 'Yıldız kaldırıldı' },
  'toast.offline':      { en: 'Can’t reach the agenda — check your connection',
                          tr: 'Gündem okunamıyor — internet bağlantını kontrol et' },
  'toast.syncFail':     { en: 'Refresh failed: {err}', tr: 'Tarama başarısız: {err}' },
  'toast.readFail':     { en: '{n} files could not be read', tr: '{n} dosya okunamadı' },
  'toast.imported':     { en: '{n} new stories added', tr: '{n} yeni haber eklendi' },
  'toast.removed':      { en: '{n} files are no longer in the inbox',
                          tr: '{n} dosya artık inbox’ta yok' },
  'toast.noNew':        { en: 'No new stories', tr: 'Yeni haber yok' },
  'db.blocked':         { en: 'The database is open in another tab. Close the other Daily Now tabs and reload.',
                          tr: 'Veritabanı başka bir sekmede açık. Daily Now’ın diğer sekmelerini kapatıp yenile.' },
  'article.untitled':   { en: '(untitled)', tr: '(başlıksız)' },
};

/** Arayuz metni. {ad} yer tutuculari vars ile doldurulur. */
export function t(key, vars) {
  const entry = STRINGS[key];
  let s = entry ? (entry[current] ?? entry[DEFAULT_LANG] ?? key) : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}
