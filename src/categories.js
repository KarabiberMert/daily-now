/* Kategoriler — Akış sekmelerinin ortak tanimi.
 *
 * Kayitlar siniflandirilir: once sidecar'daki "category" alanina, o yoksa
 * baslik / ozet / etiket / kaynak metnindeki anahtar kelimelere bakilir.
 *
 * Icerik artik Ingilizce yazildigi icin anahtar kelimeler de Ingilizce
 * agirlikli; Turkce karsiliklar geriye donuk uyumluluk icin duruyor.
 */

import { fold, allText } from './util.js';
import { lang, t } from './i18n.js';

export const OTHER = 'other';

/* Sira = Akis ekranindaki kart sirasi. */
export const CATEGORIES = [
  { id: 'world',     label: { en: 'World',      es: 'Mundo',            tr: 'Dünya' } },
  { id: 'economy',   label: { en: 'Economy',    es: 'Economía',         tr: 'Ekonomi' } },
  { id: 'usmarkets', label: { en: 'US Markets', es: 'Bolsa de EE. UU.', tr: 'ABD Borsası' } },
  { id: 'tech',      label: { en: 'Technology', es: 'Tecnología',       tr: 'Teknoloji' } },
  { id: 'health',    label: { en: 'Health',     es: 'Salud',            tr: 'Sağlık' } },
  { id: 'sports',    label: { en: 'Sports',     es: 'Deportes',         tr: 'Spor' } },
  { id: OTHER,       label: { en: 'Other',      es: 'Otros',            tr: 'Diğer' } },
];

export const CATEGORY_IDS = CATEGORIES.map(c => c.id);

/** Secili dildeki kategori adi. */
export function categoryLabel(id) {
  const c = CATEGORIES.find(x => x.id === id) || CATEGORIES[CATEGORIES.length - 1];
  return c.label[lang()] || c.label.en;
}

/** Sidecar "category" alaninda yazilabilecek serbest karsiliklar. */
/* Not: "ekonomi"/"economy" gibi sozcukler burada bilerek var — ama tek basina
   hangi sekmeye ait oldugu belirsiz olanlari anahtar kelime puanlamasi cozuyor. */
const ALIASES = {
  world:     ['dunya', 'world', 'mundo', 'global', 'international', 'internacional',
              'foreign', 'diplomacy', 'diplomacia', 'uluslararasi', 'dis haberler',
              'diplomasi', 'gundem', 'turkey', 'turkiye'],
  economy:   ['ekonomi', 'economy', 'economia', 'economics', 'macro', 'finance',
              'finanzas', 'business', 'negocios', 'trade', 'is dunyasi'],
  // Eski surumlerdeki "markets" / "trmarkets" degerleri de ABD borsasina dussun.
  usmarkets: ['us markets', 'usmarkets', 'abd borsa', 'abd borsasi', 'wall street',
              'stocks', 'stock market', 'equities', 'markets', 'borsa', 'piyasalar',
              'piyasa', 'trmarkets', 'bolsa', 'bolsa de ee. uu.', 'mercados',
              'acciones'],
  tech:      ['teknoloji', 'tech', 'technology', 'tecnologia', 'software', 'yazilim',
              'dijital', 'digital'],
  health:    ['saglik', 'health', 'salud', 'medicine', 'medicina', 'medical', 'tip'],
  sports:    ['spor', 'sport', 'sports', 'deportes', 'deporte', 'football', 'soccer',
              'futbol'],
};

/* Agirlikli anahtar kelimeler. Hepsi fold() edilmis bicimde yazili:
   kucuk harf, Turkce aksanlar sadelestirilmis (ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c).
   3 = kategoriyi tek basina isaret eden guclu belirtec, 1 = destekleyici ipucu. */
const KEYWORDS = {
  world: {
    3: ['united nations', 'nato', 'european union', 'ukraine', 'russia', 'gaza',
        'israel', 'iran', 'china', 'india', 'middle east', 'brussels', 'kremlin',
        'birlesmis milletler', 'avrupa birligi', 'ukrayna', 'rusya', 'ortadogu'],
    1: ['world', 'europe', 'asia', 'africa', 'summit', 'diplomacy', 'war',
        'refugee', 'migration', 'climate', 'global', 'election', 'sanctions',
        'ceasefire', 'treaty', 'dunya', 'avrupa', 'zirve', 'savas', 'iklim'],
  },
  economy: {
    3: ['inflation', 'central bank', 'interest rate', 'gdp', 'recession',
        'unemployment', 'imf', 'world bank', 'tariff', 'trade deficit',
        'consumer prices', 'cost of living', 'enflasyon', 'merkez bankasi',
        'faiz orani', 'resesyon', 'issizlik'],
    1: ['economy', 'economic', 'growth', 'budget', 'debt', 'export', 'import',
        'oil price', 'energy prices', 'currency', 'jobs report', 'wages',
        'housing', 'ekonomi', 'buyume', 'butce', 'ihracat', 'ithalat'],
  },
  usmarkets: {
    3: ['wall street', 'nasdaq', 'dow jones', 's&p 500', 's&p', 'nyse',
        'federal reserve', 'the fed', 'sec filing', 'new york stock exchange',
        'russell 2000', 'earnings report', 'quarterly earnings', 'ipo',
        'abd borsasi', 'new york borsasi'],
    1: ['stocks', 'shares', 'index', 'ticker', 'treasury yield', 'bond yield',
        'investors', 'rally', 'selloff', 'premarket', 'buyback', 'dividend',
        'market cap', 'valuation', 'fed', 'hisse', 'endeks', 'temettu', 'borsa'],
  },
  tech: {
    3: ['artificial intelligence', 'machine learning', 'openai', 'nvidia',
        'chatgpt', 'semiconductor', 'quantum', 'cybersecurity', 'data center',
        'large language model', 'yapay zeka', 'yari iletken', 'siber'],
    1: ['tech', 'technology', 'software', 'chip', 'robot', 'space', 'spacex',
        'startup', 'cloud', 'hardware', 'iphone', 'android', 'google', 'apple',
        'microsoft', 'meta', 'app', 'algorithm', 'teknoloji', 'yazilim'],
  },
  health: {
    3: ['world health organization', 'who', 'vaccine', 'cancer', 'outbreak',
        'pandemic', 'fda approval', 'clinical trial', 'public health',
        'saglik bakanligi', 'asi', 'kanser', 'salgin', 'pandemi'],
    1: ['health', 'doctor', 'treatment', 'drug', 'virus', 'disease', 'hospital',
        'clinic', 'nutrition', 'surgery', 'medical', 'patients', 'mental health',
        'saglik', 'tedavi', 'hastalik', 'hastane'],
  },
  sports: {
    3: ['premier league', 'champions league', 'world cup', 'nba', 'nfl', 'mlb',
        'olympics', 'formula 1', 'grand slam', 'uefa', 'fifa',
        'sampiyonlar ligi', 'super lig', 'milli takim', 'olimpiyat'],
    1: ['sports', 'football', 'soccer', 'basketball', 'tennis', 'match', 'goal',
        'champion', 'league', 'coach', 'player', 'tournament', 'transfer',
        'season', 'playoff', 'spor', 'futbol', 'basketbol', 'mac'],
  },
};

/* Anahtar kelimeler kelime siniri ile aranir. Duz includes() kullanildiginda
   "için" -> "icin" metni 'cin' (Çin) anahtarina takiliyor ve saglik haberi
   Dünya sekmesine dusuyordu. */
const RX = new Map();
function rx(word) {
  let r = RX.get(word);
  if (!r) {
    const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const head = /^[a-z0-9]/.test(word) ? '\\b' : '';
    const tail = /[a-z0-9]$/.test(word) ? '\\b' : '';
    r = new RegExp(head + esc + tail);
    RX.set(word, r);
  }
  return r;
}

function score(haystack, tiers) {
  let total = 0, strong = 0;
  for (const [weight, words] of Object.entries(tiers)) {
    for (const w of words) {
      if (!rx(w).test(haystack)) continue;
      total += +weight;
      if (+weight >= 3) strong++;
    }
  }
  return { total, strong };
}

const KNOWN = new Set(CATEGORY_IDS);

/** Serbest metni (kicker, sidecar category, kaynak adi) kategori kimligine cevirir. */
export function categoryFromText(value) {
  const v = fold(value || '').trim();
  if (!v) return null;
  if (KNOWN.has(v)) return v;
  for (const [id, words] of Object.entries(ALIASES)) {
    if (words.some(w => v === w || v.includes(w))) return id;
  }
  return null;
}

/**
 * Bir makalenin kategorisi. Once acik beyan, sonra anahtar kelime puanlamasi.
 * Hicbiri tutmazsa OTHER doner — "Other" sekmesi yalnizca boyle haberler varsa gorunur.
 */
export function categoryOf(article) {
  const declared = categoryFromText(article.category);
  if (declared) return declared;

  for (const tag of article.tags || []) {
    const fromTag = categoryFromText(tag);
    if (fromTag) return fromTag;
  }

  const haystack = fold([
    allText(article.title), allText(article.summary), allText(article.source),
    (article.tags || []).join(' '), (article.text || '').slice(0, 1200),
  ].join(' '));

  // Once guclu belirtec sayisi, esitse toplam puan. Boylece tek bir spesifik
  // isaret ("Federal Reserve"), bir yigin genel sozcugu yenebiliyor.
  let best = OTHER, bestS = { total: 0, strong: 0 };
  for (const [id, tiers] of Object.entries(KEYWORDS)) {
    const s = score(haystack, tiers);
    if (s.strong > bestS.strong || (s.strong === bestS.strong && s.total > bestS.total)) {
      best = id; bestS = s;
    }
  }
  return bestS.total >= 2 ? best : OTHER;
}

/** Kategoriye gore sayimlar — sekme rozetleri icin. */
export function countByCategory(items, getId) {
  const counts = Object.fromEntries(CATEGORY_IDS.map(id => [id, 0]));
  for (const it of items) {
    const id = getId(it);
    if (id in counts) counts[id]++;
    else counts[OTHER]++;
  }
  return counts;
}

/* Her kategorinin kendi rengi var: kart seridi, sayac ve popup basligi bu tondan
   beslenir. Tek turuncu her yerde tekrarlaninca kartlar birbirinden ayirt
   edilemiyordu. */
const TONE = {
  world:     'var(--cyan)',
  economy:   'var(--amber)',
  usmarkets: 'var(--accent)',
  tech:      'var(--green)',
  health:    'var(--violet)',
  sports:    'var(--rose)',
  [OTHER]:   'var(--mute)',
};

export const toneOf = id => TONE[id] || 'var(--accent)';

/** Akis ana ekrani: kategori kartlari. Tiklayinca o kategorinin butun gundemi
 *  popup sayfada acilir — ana ekranda haber listesi yok. */
export function categoryCardsHtml(counts, unread = {}) {
  return CATEGORIES
    .filter(c => counts[c.id])
    .map(c => {
      const n = counts[c.id];
      const u = unread[c.id] || 0;
      const label = n === 1 ? t('cat.headlinesOne') : t('cat.headlines', { n });
      return `
      <button class="cat-card" data-cat-open="${c.id}" style="--tone:${toneOf(c.id)}">
        <span class="cc-name">${categoryLabel(c.id)}</span>
        <span class="cc-meta">${label}${u ? `<i>${t('cat.unreadTag', { n: u })}</i>` : ''}</span>
        <span class="cc-go">${t('cat.open')}
          <svg viewBox="0 0 24 24"><path d="M5 12h13M12 5l7 7-7 7"/></svg>
        </span>
      </button>`;
    }).join('');
}
