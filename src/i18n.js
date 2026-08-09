/* Dil katmani — arayuz metinleri ve cok dilli haber alanlari.
 *
 * Uygulama varsayilan olarak Ingilizce acilir; sag ustteki secici Ispanyolca,
 * Turkce, Almanca ve Fransizca'ya gecirir. Secim localStorage'da tutulur (IndexedDB ayarlarindan
 * once, ilk boyama sirasinda gerektigi icin).
 *
 * Haber icerigi de cok dilli: bir alan ya duz metin (her dilde ayni) ya da
 * { "en": …, "es": …, "tr": …, "de": …, "fr": … } bicimindedir. pick() dogru
 * karsiligi secer, eksikse Ingilizce'ye duser.
 */

export const LANGS = [
  { id: 'en', label: 'English',  short: 'EN' },
  { id: 'es', label: 'Español',  short: 'ES' },
  { id: 'tr', label: 'Türkçe',   short: 'TR' },
  { id: 'de', label: 'Deutsch',  short: 'DE' },
  { id: 'fr', label: 'Français', short: 'FR' },
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

/** { en: …, es: …, tr: …, de: …, fr: … } bicimli bir deger mi? */
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
 * Bir nesnedeki alani okur. Hem `title: {en, es, tr, de, fr}` hem de `title_en` /
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
  de: ['Januar','Februar','März','April','Mai','Juni',
       'Juli','August','September','Oktober','November','Dezember'],
  fr: ['janvier','février','mars','avril','mai','juin',
       'juillet','août','septembre','octobre','novembre','décembre'],
};

const DAYS = {
  en: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  es: ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'],
  tr: ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'],
  de: ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'],
  fr: ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'],
};

const LOCALES = { en: 'en-US', es: 'es-ES', tr: 'tr-TR', de: 'de-DE', fr: 'fr-FR' };

export const months = (l = current) => MONTHS[l] || MONTHS.en;
export const days   = (l = current) => DAYS[l]   || DAYS.en;
export const locale = (l = current) => LOCALES[l] || LOCALES.en;

/* ────────────────────────── arayuz metinleri ────────────────────────── */

const STRINGS = {
  /* kabuk */
  'app.tagline':        { en: 'The day’s important news, every morning in one place.',
                          es: 'Las noticias importantes del día, cada mañana en un solo lugar.',
                          tr: 'Günün önemli haberleri, her sabah tek yerden.',
                          de: 'Die wichtigen Nachrichten des Tages, jeden Morgen an einem Ort.',
                          fr: 'L’essentiel de l’actualité, chaque matin au même endroit.' },
  'nav.feed':           { en: 'Feed',      es: 'Noticias',  tr: 'Akış',
                          de: 'Nachrichten',
                          fr: 'Actualités' },
  'nav.search':         { en: 'Search',    es: 'Buscar',    tr: 'Arama',
                          de: 'Suche',
                          fr: 'Recherche' },
  'side.tags':          { en: 'Tags',      es: 'Etiquetas', tr: 'Etiketler',
                          de: 'Schlagwörter',
                          fr: 'Étiquettes' },
  'search.placeholder': { en: 'Search the news — headline, source, tag, full text…',
                          es: 'Busca en las noticias — titular, fuente, etiqueta, texto completo…',
                          tr: 'Haberlerde ara — başlık, kaynak, etiket, tam metin…',
                          de: 'Nachrichten durchsuchen — Schlagzeile, Quelle, Schlagwort, Volltext…',
                          fr: 'Rechercher dans les actualités — titre, source, étiquette, texte intégral…' },
  'a11y.menu':          { en: 'Menu',      es: 'Menú',      tr: 'Menü',
                          de: 'Menü',
                          fr: 'Menu' },
  'a11y.theme':         { en: 'Theme',     es: 'Tema',      tr: 'Tema',
                          de: 'Design',
                          fr: 'Thème' },
  'a11y.language':      { en: 'Language',  es: 'Idioma',    tr: 'Dil',
                          de: 'Sprache',
                          fr: 'Langue' },
  'a11y.close':         { en: 'Close',     es: 'Cerrar',    tr: 'Kapat',
                          de: 'Schließen',
                          fr: 'Fermer' },
  'a11y.star':          { en: 'Star',      es: 'Destacar',  tr: 'Yıldızla',
                          de: 'Markieren',
                          fr: 'Mettre en favori' },
  'a11y.prevPage':      { en: 'Previous page', es: 'Página anterior',  tr: 'Önceki sayfa',
                          de: 'Vorherige Seite',
                          fr: 'Page précédente' },
  'a11y.nextPage':      { en: 'Next page', es: 'Página siguiente',     tr: 'Sonraki sayfa',
                          de: 'Nächste Seite',
                          fr: 'Page suivante' },
  'a11y.zoomOut':       { en: 'Zoom out',  es: 'Alejar',    tr: 'Uzaklaş',
                          de: 'Verkleinern',
                          fr: 'Dézoomer' },
  'a11y.zoomIn':        { en: 'Zoom in',   es: 'Acercar',   tr: 'Yakınlaş',
                          de: 'Vergrößern',
                          fr: 'Zoomer' },
  'a11y.download':      { en: 'Download',  es: 'Descargar', tr: 'İndir',
                          de: 'Herunterladen',
                          fr: 'Télécharger' },

  /* acilis hatasi */
  'boot.failed':        { en: 'The app could not start',
                          es: 'No se pudo iniciar la aplicación',
                          tr: 'Uygulama açılamadı',
                          de: 'Die App konnte nicht gestartet werden',
                          fr: 'L’application n’a pas pu démarrer' },
  'boot.unknown':       { en: 'Unknown error', es: 'Error desconocido', tr: 'Bilinmeyen hata',
                          de: 'Unbekannter Fehler',
                          fr: 'Erreur inconnue' },
  'boot.retry':         { en: 'Try again',     es: 'Reintentar',        tr: 'Yeniden dene',
                          de: 'Erneut versuchen',
                          fr: 'Réessayer' },

  /* akis */
  'feed.today':         { en: 'Today’s agenda', es: 'La actualidad de hoy', tr: 'Bugünün gündemi',
                          de: 'Die Nachrichten von heute',
                          fr: 'L’actualité du jour' },
  'feed.all':           { en: 'All news',       es: 'Todas las noticias',   tr: 'Tüm gündem',
                          de: 'Alle Nachrichten',
                          fr: 'Toute l’actualité' },
  'feed.lastDays':      { en: 'Last {n} days',  es: 'Últimos {n} días',     tr: 'Son {n} gün',
                          de: 'Letzte {n} Tage',
                          fr: '{n} derniers jours' },
  'range.today':        { en: 'Today',   es: 'Hoy',      tr: 'Bugün',
                          de: 'Heute',
                          fr: 'Aujourd’hui' },
  'range.7':            { en: '7 days',  es: '7 días',   tr: '7 gün',
                          de: '7 Tage',
                          fr: '7 jours' },
  'range.30':           { en: '30 days', es: '30 días',  tr: '30 gün',
                          de: '30 Tage',
                          fr: '30 jours' },
  'range.all':          { en: 'All',     es: 'Todo',     tr: 'Tümü',
                          de: 'Alle',
                          fr: 'Tout' },
  'filter.unread':      { en: 'Unread',  es: 'Sin leer', tr: 'Okunmamış',
                          de: 'Ungelesen',
                          fr: 'Non lus' },
  'filter.starred':     { en: 'Starred', es: 'Destacadas', tr: 'Yıldızlı',
                          de: 'Markiert',
                          fr: 'Favoris' },
  'feed.count':         { en: '{n} headlines', es: '{n} titulares', tr: '{n} başlık',
                          de: '{n} Schlagzeilen',
                          fr: '{n} titres' },
  'feed.countOne':      { en: '1 headline',    es: '1 titular',     tr: '1 başlık',
                          de: '1 Schlagzeile',
                          fr: '1 titre' },
  /* Tekil hal: Fransizca'da "1 non lus" yanlis olurdu. */
  'unread.one':         { en: '1 unread',      es: '1 sin leer',    tr: '1 okunmadı',
                          de: '1 ungelesen',
                          fr: '1 non lu' },
  'feed.unreadN':       { en: '{n} unread',    es: '{n} sin leer',  tr: '{n} okunmadı',
                          de: '{n} ungelesen',
                          fr: '{n} non lus' },
  'feed.allRead':       { en: 'all read',      es: 'todo leído',    tr: 'hepsi okundu',
                          de: 'alles gelesen',
                          fr: 'tout est lu' },
  'feed.none':          { en: 'No headlines yet', es: 'Aún no hay titulares', tr: 'Henüz başlık yok',
                          de: 'Noch keine Schlagzeilen',
                          fr: 'Pas encore de titres' },
  'feed.lastUpdate':    { en: 'updated {t}',   es: 'actualizado {t}', tr: 'son güncelleme {t}',
                          de: 'aktualisiert {t}',
                          fr: 'mis à jour à {t}' },

  'empty.filtered.title': { en: 'No headlines match this filter',
                            es: 'Ningún titular coincide con este filtro',
                            tr: 'Bu filtreyle başlık yok',
                          de: 'Keine Schlagzeile passt zu diesem Filter',
                          fr: 'Aucun titre ne correspond à ce filtre' },
  'empty.filtered.text':  { en: 'Clear the filters to see the whole agenda.',
                            es: 'Borra los filtros para ver toda la actualidad.',
                            tr: 'Filtreleri temizleyip tüm gündeme bakabilirsin.',
                          de: 'Lösche die Filter, um alle Nachrichten zu sehen.',
                          fr: 'Efface les filtres pour voir toute l’actualité.' },
  'empty.filtered.btn':   { en: 'Clear filters', es: 'Borrar filtros', tr: 'Filtreleri temizle',
                          de: 'Filter löschen',
                          fr: 'Effacer les filtres' },
  'empty.waiting.title':  { en: 'Today’s agenda hasn’t arrived yet',
                            es: 'La actualidad de hoy aún no ha llegado',
                            tr: 'Bugünün gündemi henüz gelmedi',
                          de: 'Die Nachrichten von heute sind noch nicht da',
                          fr: 'L’actualité du jour n’est pas encore arrivée' },
  'empty.waiting.text':   { en: 'The agenda refreshes automatically at regular intervals.',
                            es: 'La actualidad se actualiza automáticamente a intervalos regulares.',
                            tr: 'Gündem düzenli aralıklarla otomatik güncelleniyor.',
                          de: 'Die Nachrichten werden in regelmäßigen Abständen automatisch aktualisiert.',
                          fr: 'L’actualité se met à jour automatiquement à intervalles réguliers.' },
  'empty.waiting.btn':    { en: 'Refresh', es: 'Actualizar', tr: 'Yenile',
                          de: 'Aktualisieren',
                          fr: 'Actualiser' },
  'empty.offline.title':  { en: 'The agenda can’t be loaded right now',
                            es: 'No se puede cargar la actualidad ahora mismo',
                            tr: 'Gündem şu an okunamıyor',
                          de: 'Die Nachrichten können gerade nicht geladen werden',
                          fr: 'Impossible de charger l’actualité pour le moment' },
  'empty.offline.text':   { en: 'Check your connection and try again.',
                            es: 'Comprueba tu conexión e inténtalo de nuevo.',
                            tr: 'Bağlantını kontrol edip tekrar dene.',
                          de: 'Prüfe deine Verbindung und versuche es erneut.',
                          fr: 'Vérifie ta connexion et réessaie.' },
  'empty.offline.btn':    { en: 'Try again', es: 'Reintentar', tr: 'Tekrar dene',
                          de: 'Erneut versuchen',
                          fr: 'Réessayer' },

  /* kategori sayfasi */
  'cat.pageTitle':      { en: '{label}', es: '{label}', tr: '{label} Gündemi',
                          de: '{label}',
                          fr: '{label}' },
  'cat.open':           { en: 'open',    es: 'abrir',   tr: 'gündemi aç',
                          de: 'öffnen',
                          fr: 'ouvrir' },
  'cat.headlines':      { en: '{n} headlines', es: '{n} titulares', tr: '{n} başlık',
                          de: '{n} Schlagzeilen',
                          fr: '{n} titres' },
  'cat.headlinesOne':   { en: '1 headline',    es: '1 titular',     tr: '1 başlık',
                          de: '1 Schlagzeile',
                          fr: '1 titre' },
  'cat.unreadTag':      { en: '{n} unread',    es: '{n} sin leer',  tr: '{n} okunmadı',
                          de: '{n} ungelesen',
                          fr: '{n} non lus' },
  'cat.days':           { en: '{n} days',      es: '{n} días',      tr: '{n} gün',
                          de: '{n} Tage',
                          fr: '{n} jours' },
  'cat.emptyTitle':     { en: 'No headlines in this range',
                          es: 'No hay titulares en este periodo',
                          tr: 'Bu aralıkta başlık yok',
                          de: 'Keine Schlagzeilen in diesem Zeitraum',
                          fr: 'Aucun titre sur cette période' },
  'cat.emptyText':      { en: 'Widen the date range above, or wait for the next update.',
                          es: 'Amplía el intervalo de fechas de arriba o espera a la próxima actualización.',
                          tr: 'Üstteki gün aralığını genişlet ya da bir sonraki güncellemeyi bekle.',
                          de: 'Erweitere den Zeitraum oben oder warte auf die nächste Aktualisierung.',
                          fr: 'Élargis la période ci-dessus ou attends la prochaine mise à jour.' },
  'cat.sourceLink':     { en: 'Read at {source} ↗', es: 'Leer en {source} ↗',
                          tr: '{source} sayfasına git ↗',
                          de: 'Bei {source} lesen ↗',
                          fr: 'Lire sur {source} ↗' },
  'cat.sourceFallback': { en: 'the source', es: 'la fuente', tr: 'Kaynak',
                          de: 'der Quelle',
                          fr: 'la source' },
  'cat.openFull':       { en: 'Open the full story ↗', es: 'Abrir la noticia completa ↗',
                          tr: 'Haberin tamamını aç ↗',
                          de: 'Ganzen Beitrag öffnen ↗',
                          fr: 'Ouvrir l’article complet ↗' },
  'cat.openSummary':    { en: 'Open the full summary ↗', es: 'Abrir el resumen completo ↗',
                          tr: 'Özetin tamamını aç ↗',
                          de: 'Ganze Zusammenfassung öffnen ↗',
                          fr: 'Ouvrir le résumé complet ↗' },
  'cat.related':        { en: 'Earlier headlines', es: 'Titulares anteriores',
                          tr: 'İlgili diğer başlıklar',
                          de: 'Frühere Schlagzeilen',
                          fr: 'Titres précédents' },
  'cat.relatedNote':    { en: 'Older agendas from {label}',
                          es: 'Noticias anteriores de {label}',
                          tr: '{label} kategorisinden daha önceki gündemler',
                          de: 'Ältere Nachrichten aus {label}',
                          fr: 'Actualités plus anciennes de {label}' },
  'cat.updatedAt':      { en: 'updated at {t}', es: 'actualizado a las {t}',
                          tr: '{t}’de güncellendi',
                          de: 'aktualisiert um {t}',
                          fr: 'mis à jour à {t}' },
  'cat.updatedTip':     { en: 'This story was processed and published at {t}',
                          es: 'Esta noticia se procesó y publicó a las {t}',
                          tr: 'Bu haber {t}’de işlenip yayınlandı',
                          de: 'Dieser Beitrag wurde um {t} verarbeitet und veröffentlicht',
                          fr: 'Cet article a été traité et publié à {t}' },

  /* arama */
  'search.title':       { en: 'Search', es: 'Buscar', tr: 'Arama',
                          de: 'Suche',
                          fr: 'Recherche' },
  'search.sub':         { en: 'Searches headlines, sources, tags, summaries and full text.',
                          es: 'Busca en titulares, fuentes, etiquetas, resúmenes y texto completo.',
                          tr: 'Başlık, kaynak, etiket, özet ve tam metinde arar.',
                          de: 'Durchsucht Schlagzeilen, Quellen, Schlagwörter, Zusammenfassungen und Volltext.',
                          fr: 'Recherche dans les titres, sources, étiquettes, résumés et texte intégral.' },
  'search.promptTitle': { en: 'What are you looking for?', es: '¿Qué estás buscando?',
                          tr: 'Ne arıyorsun?',
                          de: 'Wonach suchst du?',
                          fr: 'Que cherches-tu ?' },
  'search.promptText':  { en: 'Type at least 2 characters. If you enter several words, only stories containing all of them are listed.',
                          es: 'Escribe al menos 2 caracteres. Si introduces varias palabras, solo se listan las noticias que las contienen todas.',
                          tr: 'En az 2 harf yaz. Birden fazla kelime yazarsan hepsini birden içeren haberler listelenir.',
                          de: 'Gib mindestens 2 Zeichen ein. Bei mehreren Wörtern werden nur Beiträge gelistet, die alle enthalten.',
                          fr: 'Saisis au moins 2 caractères. Avec plusieurs mots, seuls les articles qui les contiennent tous sont listés.' },
  'search.results':     { en: '{n} results for “{q}”', es: '{n} resultados para “{q}”',
                          tr: '“{q}” için {n} sonuç',
                          de: '{n} Ergebnisse für „{q}“',
                          fr: '{n} résultats pour « {q} »' },
  'search.noneSub':     { en: 'No results for “{q}”', es: 'Sin resultados para “{q}”',
                          tr: '“{q}” için sonuç yok',
                          de: 'Keine Ergebnisse für „{q}“',
                          fr: 'Aucun résultat pour « {q} »' },
  'search.noneTitle':   { en: 'No results found', es: 'No se encontraron resultados',
                          tr: 'Sonuç bulunamadı',
                          de: 'Keine Ergebnisse gefunden',
                          fr: 'Aucun résultat trouvé' },
  'search.noneText':    { en: 'Try a different word. Scanned PDFs without a text layer can’t be searched.',
                          es: 'Prueba con otra palabra. Los PDF escaneados sin capa de texto no se pueden buscar.',
                          tr: 'Farklı bir kelime dene. Metin katmanı olmayan taranmış PDF’lerde içerik araması çalışmaz.',
                          de: 'Versuche ein anderes Wort. Gescannte PDFs ohne Textebene lassen sich nicht durchsuchen.',
                          fr: 'Essaie un autre mot. Les PDF scannés sans couche de texte ne sont pas indexés.' },

  /* satirlar / okuyucu / bildirimler */
  'row.pages':          { en: '{n} pages', es: '{n} páginas', tr: '{n} sayfa',
                          de: '{n} Seiten',
                          fr: '{n} pages' },
  'row.unread':         { en: 'unread',    es: 'sin leer',    tr: 'okunmadı',
                          de: 'ungelesen',
                          fr: 'non lu' },
  'reader.source':      { en: 'Source: {source} ↗', es: 'Fuente: {source} ↗',
                          tr: 'Kaynak: {source} ↗',
                          de: 'Quelle: {source} ↗',
                          fr: 'Source : {source} ↗' },
  'reader.link':        { en: 'link', es: 'enlace', tr: 'bağlantı',
                          de: 'Link',
                          fr: 'lien' },
  'reader.opening':     { en: 'Opening the PDF…', es: 'Abriendo el PDF…', tr: 'PDF açılıyor…',
                          de: 'PDF wird geöffnet…',
                          fr: 'Ouverture du PDF…' },
  'reader.failTitle':   { en: 'The file could not be opened',
                          es: 'No se pudo abrir el archivo', tr: 'Dosya açılamadı',
                          de: 'Die Datei konnte nicht geöffnet werden',
                          fr: 'Le fichier n’a pas pu être ouvert' },
  'reader.pdfFail':     { en: 'The PDF could not be read',
                          es: 'No se pudo leer el PDF', tr: 'PDF okunamadı',
                          de: 'Das PDF konnte nicht gelesen werden',
                          fr: 'Le PDF n’a pas pu être lu' },
  'toast.starred':      { en: 'Starred', es: 'Destacada', tr: 'Yıldızlandı',
                          de: 'Markiert',
                          fr: 'Ajouté aux favoris' },
  'toast.unstarred':    { en: 'Star removed', es: 'Marca eliminada', tr: 'Yıldız kaldırıldı',
                          de: 'Markierung entfernt',
                          fr: 'Retiré des favoris' },
  'toast.offline':      { en: 'Can’t reach the agenda — check your connection',
                          es: 'No se puede acceder a la actualidad — comprueba tu conexión',
                          tr: 'Gündem okunamıyor — internet bağlantını kontrol et',
                          de: 'Nachrichten nicht erreichbar — prüfe deine Verbindung',
                          fr: 'Actualité inaccessible — vérifie ta connexion' },
  'toast.syncFail':     { en: 'Refresh failed: {err}', es: 'Error al actualizar: {err}',
                          tr: 'Tarama başarısız: {err}',
                          de: 'Aktualisierung fehlgeschlagen: {err}',
                          fr: 'Échec de l’actualisation : {err}' },
  'toast.readFail':     { en: '{n} files could not be read',
                          es: 'No se pudieron leer {n} archivos',
                          tr: '{n} dosya okunamadı',
                          de: '{n} Dateien konnten nicht gelesen werden',
                          fr: '{n} fichiers n’ont pas pu être lus' },
  'toast.imported':     { en: '{n} new stories added', es: '{n} noticias nuevas añadidas',
                          tr: '{n} yeni haber eklendi',
                          de: '{n} neue Beiträge hinzugefügt',
                          fr: '{n} nouveaux articles ajoutés' },
  'toast.removed':      { en: '{n} files are no longer in the inbox',
                          es: '{n} archivos ya no están en la bandeja',
                          tr: '{n} dosya artık inbox’ta yok',
                          de: '{n} Dateien sind nicht mehr im Posteingang',
                          fr: '{n} fichiers ne sont plus dans la boîte de réception' },
  'toast.noNew':        { en: 'No new stories', es: 'No hay noticias nuevas',
                          tr: 'Yeni haber yok',
                          de: 'Keine neuen Beiträge',
                          fr: 'Aucun nouvel article' },
  'db.blocked':         { en: 'The database is open in another tab. Close the other Daily Now tabs and reload.',
                          es: 'La base de datos está abierta en otra pestaña. Cierra las demás pestañas de Daily Now y recarga.',
                          tr: 'Veritabanı başka bir sekmede açık. Daily Now’ın diğer sekmelerini kapatıp yenile.',
                          de: 'Die Datenbank ist in einem anderen Tab geöffnet. Schließe die anderen Daily-Now-Tabs und lade neu.',
                          fr: 'La base de données est ouverte dans un autre onglet. Ferme les autres onglets Daily Now et recharge.' },
  'article.untitled':   { en: '(untitled)', es: '(sin título)', tr: '(başlıksız)',
                          de: '(ohne Titel)',
                          fr: '(sans titre)' },
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
