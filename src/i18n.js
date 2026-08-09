/* Dil katmani — arayuz metinleri ve cok dilli haber alanlari.
 *
 * Uygulama varsayilan olarak Ingilizce acilir; sag ustteki secici Ispanyolca
 * ve Turkce'ye gecirir. Secim localStorage'da tutulur (IndexedDB ayarlarindan
 * once, ilk boyama sirasinda gerektigi icin).
 *
 * Haber icerigi de cok dilli: bir alan ya duz metin (her dilde ayni) ya da
 * { "en": "...", "es": "...", "tr": "..." } bicimindedir. pick() dogru
 * karsiligi secer, eksikse Ingilizce'ye duser.
 */

export const LANGS = [
  { id: 'en', label: 'English',  short: 'EN' },
  { id: 'es', label: 'Español',  short: 'ES' },
  { id: 'tr', label: 'Türkçe',   short: 'TR' },
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

/* ────────────────────── cok dilli icerik alanlari ────────────────────── */

/** { en: …, es: …, tr: … } bicimli bir deger mi? */
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
 * Bir nesnedeki alani okur. Hem `title: {en, es, tr}` hem de `title_en` /
 * `title_es` yazimini destekler — gunluk rutin hangisini yazarsa yazsin calissin diye.
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
  es: ['enero','febrero','marzo','abril','mayo','junio',
       'julio','agosto','septiembre','octubre','noviembre','diciembre'],
  tr: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran',
       'Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
};

const DAYS = {
  en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  es: ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'],
  tr: ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'],
};

const LOCALES = { en: 'en-US', es: 'es-ES', tr: 'tr-TR' };

export const months = (l = current) => MONTHS[l] || MONTHS.en;
export const days   = (l = current) => DAYS[l]   || DAYS.en;
export const locale = (l = current) => LOCALES[l] || LOCALES.en;

/* ────────────────────────── arayuz metinleri ────────────────────────── */

const STRINGS = {
  /* kabuk */
  'app.tagline':        { en: 'The day’s important news, every morning in one place.',
                          es: 'Las noticias importantes del día, cada mañana en un solo lugar.',
                          tr: 'Günün önemli haberleri, her sabah tek yerden.' },
  'nav.feed':           { en: 'Feed',      es: 'Noticias',  tr: 'Akış' },
  'nav.search':         { en: 'Search',    es: 'Buscar',    tr: 'Arama' },
  'side.tags':          { en: 'Tags',      es: 'Etiquetas', tr: 'Etiketler' },
  'search.placeholder': { en: 'Search the news — headline, source, tag, full text…',
                          es: 'Busca en las noticias — titular, fuente, etiqueta, texto completo…',
                          tr: 'Haberlerde ara — başlık, kaynak, etiket, tam metin…' },
  'a11y.menu':          { en: 'Menu',      es: 'Menú',      tr: 'Menü' },
  'a11y.theme':         { en: 'Theme',     es: 'Tema',      tr: 'Tema' },
  'a11y.language':      { en: 'Language',  es: 'Idioma',    tr: 'Dil' },
  'a11y.close':         { en: 'Close',     es: 'Cerrar',    tr: 'Kapat' },
  'a11y.star':          { en: 'Star',      es: 'Destacar',  tr: 'Yıldızla' },
  'a11y.prevPage':      { en: 'Previous page', es: 'Página anterior',  tr: 'Önceki sayfa' },
  'a11y.nextPage':      { en: 'Next page', es: 'Página siguiente',     tr: 'Sonraki sayfa' },
  'a11y.zoomOut':       { en: 'Zoom out',  es: 'Alejar',    tr: 'Uzaklaş' },
  'a11y.zoomIn':        { en: 'Zoom in',   es: 'Acercar',   tr: 'Yakınlaş' },
  'a11y.download':      { en: 'Download',  es: 'Descargar', tr: 'İndir' },

  /* acilis hatasi */
  'boot.failed':        { en: 'The app could not start',
                          es: 'No se pudo iniciar la aplicación',
                          tr: 'Uygulama açılamadı' },
  'boot.unknown':       { en: 'Unknown error', es: 'Error desconocido', tr: 'Bilinmeyen hata' },
  'boot.retry':         { en: 'Try again',     es: 'Reintentar',        tr: 'Yeniden dene' },

  /* akis */
  'feed.today':         { en: 'Today’s agenda', es: 'La actualidad de hoy', tr: 'Bugünün gündemi' },
  'feed.all':           { en: 'All news',       es: 'Todas las noticias',   tr: 'Tüm gündem' },
  'feed.lastDays':      { en: 'Last {n} days',  es: 'Últimos {n} días',     tr: 'Son {n} gün' },
  'range.today':        { en: 'Today',   es: 'Hoy',      tr: 'Bugün' },
  'range.7':            { en: '7 days',  es: '7 días',   tr: '7 gün' },
  'range.30':           { en: '30 days', es: '30 días',  tr: '30 gün' },
  'range.all':          { en: 'All',     es: 'Todo',     tr: 'Tümü' },
  'filter.unread':      { en: 'Unread',  es: 'Sin leer', tr: 'Okunmamış' },
  'filter.starred':     { en: 'Starred', es: 'Destacadas', tr: 'Yıldızlı' },
  'feed.count':         { en: '{n} headlines', es: '{n} titulares', tr: '{n} başlık' },
  'feed.countOne':      { en: '1 headline',    es: '1 titular',     tr: '1 başlık' },
  'feed.unreadN':       { en: '{n} unread',    es: '{n} sin leer',  tr: '{n} okunmadı' },
  'feed.allRead':       { en: 'all read',      es: 'todo leído',    tr: 'hepsi okundu' },
  'feed.none':          { en: 'No headlines yet', es: 'Aún no hay titulares', tr: 'Henüz başlık yok' },
  'feed.lastUpdate':    { en: 'updated {t}',   es: 'actualizado {t}', tr: 'son güncelleme {t}' },

  'empty.filtered.title': { en: 'No headlines match this filter',
                            es: 'Ningún titular coincide con este filtro',
                            tr: 'Bu filtreyle başlık yok' },
  'empty.filtered.text':  { en: 'Clear the filters to see the whole agenda.',
                            es: 'Borra los filtros para ver toda la actualidad.',
                            tr: 'Filtreleri temizleyip tüm gündeme bakabilirsin.' },
  'empty.filtered.btn':   { en: 'Clear filters', es: 'Borrar filtros', tr: 'Filtreleri temizle' },
  'empty.waiting.title':  { en: 'Today’s agenda hasn’t arrived yet',
                            es: 'La actualidad de hoy aún no ha llegado',
                            tr: 'Bugünün gündemi henüz gelmedi' },
  'empty.waiting.text':   { en: 'The agenda refreshes automatically at regular intervals.',
                            es: 'La actualidad se actualiza automáticamente a intervalos regulares.',
                            tr: 'Gündem düzenli aralıklarla otomatik güncelleniyor.' },
  'empty.waiting.btn':    { en: 'Refresh', es: 'Actualizar', tr: 'Yenile' },
  'empty.offline.title':  { en: 'The agenda can’t be loaded right now',
                            es: 'No se puede cargar la actualidad ahora mismo',
                            tr: 'Gündem şu an okunamıyor' },
  'empty.offline.text':   { en: 'Check your connection and try again.',
                            es: 'Comprueba tu conexión e inténtalo de nuevo.',
                            tr: 'Bağlantını kontrol edip tekrar dene.' },
  'empty.offline.btn':    { en: 'Try again', es: 'Reintentar', tr: 'Tekrar dene' },

  /* kategori sayfasi */
  'cat.pageTitle':      { en: '{label}', es: '{label}', tr: '{label} Gündemi' },
  'cat.open':           { en: 'open',    es: 'abrir',   tr: 'gündemi aç' },
  'cat.headlines':      { en: '{n} headlines', es: '{n} titulares', tr: '{n} başlık' },
  'cat.headlinesOne':   { en: '1 headline',    es: '1 titular',     tr: '1 başlık' },
  'cat.unreadTag':      { en: '{n} unread',    es: '{n} sin leer',  tr: '{n} okunmadı' },
  'cat.days':           { en: '{n} days',      es: '{n} días',      tr: '{n} gün' },
  'cat.emptyTitle':     { en: 'No headlines in this range',
                          es: 'No hay titulares en este periodo',
                          tr: 'Bu aralıkta başlık yok' },
  'cat.emptyText':      { en: 'Widen the date range above, or wait for the next update.',
                          es: 'Amplía el intervalo de fechas de arriba o espera a la próxima actualización.',
                          tr: 'Üstteki gün aralığını genişlet ya da bir sonraki güncellemeyi bekle.' },
  'cat.sourceLink':     { en: 'Read at {source} ↗', es: 'Leer en {source} ↗',
                          tr: '{source} sayfasına git ↗' },
  'cat.sourceFallback': { en: 'the source', es: 'la fuente', tr: 'Kaynak' },
  'cat.openFull':       { en: 'Open the full story ↗', es: 'Abrir la noticia completa ↗',
                          tr: 'Haberin tamamını aç ↗' },
  'cat.openSummary':    { en: 'Open the full summary ↗', es: 'Abrir el resumen completo ↗',
                          tr: 'Özetin tamamını aç ↗' },
  'cat.related':        { en: 'Earlier headlines', es: 'Titulares anteriores',
                          tr: 'İlgili diğer başlıklar' },
  'cat.relatedNote':    { en: 'Older agendas from {label}',
                          es: 'Noticias anteriores de {label}',
                          tr: '{label} kategorisinden daha önceki gündemler' },
  'cat.updatedAt':      { en: 'updated at {t}', es: 'actualizado a las {t}',
                          tr: '{t}’de güncellendi' },
  'cat.updatedTip':     { en: 'This story was processed and published at {t}',
                          es: 'Esta noticia se procesó y publicó a las {t}',
                          tr: 'Bu haber {t}’de işlenip yayınlandı' },

  /* arama */
  'search.title':       { en: 'Search', es: 'Buscar', tr: 'Arama' },
  'search.sub':         { en: 'Searches headlines, sources, tags, summaries and full text.',
                          es: 'Busca en titulares, fuentes, etiquetas, resúmenes y texto completo.',
                          tr: 'Başlık, kaynak, etiket, özet ve tam metinde arar.' },
  'search.promptTitle': { en: 'What are you looking for?', es: '¿Qué estás buscando?',
                          tr: 'Ne arıyorsun?' },
  'search.promptText':  { en: 'Type at least 2 characters. If you enter several words, only stories containing all of them are listed.',
                          es: 'Escribe al menos 2 caracteres. Si introduces varias palabras, solo se listan las noticias que las contienen todas.',
                          tr: 'En az 2 harf yaz. Birden fazla kelime yazarsan hepsini birden içeren haberler listelenir.' },
  'search.results':     { en: '{n} results for “{q}”', es: '{n} resultados para “{q}”',
                          tr: '“{q}” için {n} sonuç' },
  'search.noneSub':     { en: 'No results for “{q}”', es: 'Sin resultados para “{q}”',
                          tr: '“{q}” için sonuç yok' },
  'search.noneTitle':   { en: 'No results found', es: 'No se encontraron resultados',
                          tr: 'Sonuç bulunamadı' },
  'search.noneText':    { en: 'Try a different word. Scanned PDFs without a text layer can’t be searched.',
                          es: 'Prueba con otra palabra. Los PDF escaneados sin capa de texto no se pueden buscar.',
                          tr: 'Farklı bir kelime dene. Metin katmanı olmayan taranmış PDF’lerde içerik araması çalışmaz.' },

  /* satirlar / okuyucu / bildirimler */
  'row.pages':          { en: '{n} pages', es: '{n} páginas', tr: '{n} sayfa' },
  'row.unread':         { en: 'unread',    es: 'sin leer',    tr: 'okunmadı' },
  'reader.source':      { en: 'Source: {source} ↗', es: 'Fuente: {source} ↗',
                          tr: 'Kaynak: {source} ↗' },
  'reader.link':        { en: 'link', es: 'enlace', tr: 'bağlantı' },
  'reader.opening':     { en: 'Opening the PDF…', es: 'Abriendo el PDF…', tr: 'PDF açılıyor…' },
  'reader.failTitle':   { en: 'The file could not be opened',
                          es: 'No se pudo abrir el archivo', tr: 'Dosya açılamadı' },
  'reader.pdfFail':     { en: 'The PDF could not be read',
                          es: 'No se pudo leer el PDF', tr: 'PDF okunamadı' },
  'toast.starred':      { en: 'Starred', es: 'Destacada', tr: 'Yıldızlandı' },
  'toast.unstarred':    { en: 'Star removed', es: 'Marca eliminada', tr: 'Yıldız kaldırıldı' },
  'toast.offline':      { en: 'Can’t reach the agenda — check your connection',
                          es: 'No se puede acceder a la actualidad — comprueba tu conexión',
                          tr: 'Gündem okunamıyor — internet bağlantını kontrol et' },
  'toast.syncFail':     { en: 'Refresh failed: {err}', es: 'Error al actualizar: {err}',
                          tr: 'Tarama başarısız: {err}' },
  'toast.readFail':     { en: '{n} files could not be read',
                          es: 'No se pudieron leer {n} archivos',
                          tr: '{n} dosya okunamadı' },
  'toast.imported':     { en: '{n} new stories added', es: '{n} noticias nuevas añadidas',
                          tr: '{n} yeni haber eklendi' },
  'toast.removed':      { en: '{n} files are no longer in the inbox',
                          es: '{n} archivos ya no están en la bandeja',
                          tr: '{n} dosya artık inbox’ta yok' },
  'toast.noNew':        { en: 'No new stories', es: 'No hay noticias nuevas',
                          tr: 'Yeni haber yok' },
  'db.blocked':         { en: 'The database is open in another tab. Close the other Daily Now tabs and reload.',
                          es: 'La base de datos está abierta en otra pestaña. Cierra las demás pestañas de Daily Now y recarga.',
                          tr: 'Veritabanı başka bir sekmede açık. Daily Now’ın diğer sekmelerini kapatıp yenile.' },
  'article.untitled':   { en: '(untitled)', es: '(sin título)', tr: '(başlıksız)' },
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
