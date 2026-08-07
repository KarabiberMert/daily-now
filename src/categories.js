/* Kategoriler — Akış sekmelerinin ortak tanimi.
 *
 * Kayitlar siniflandirilir: once sidecar'daki "category" alanina, o yoksa
 * baslik / ozet / etiket / kaynak metnindeki anahtar kelimelere bakilir.
 */

import { fold } from './util.js';

export const OTHER = 'other';

export const CATEGORIES = [
  { id: 'world',   label: 'Dünya' },
  { id: 'turkey',  label: 'Türkiye' },
  { id: 'tech',    label: 'Teknoloji' },
  { id: 'markets', label: 'ABD Borsa' },
  { id: OTHER,     label: 'Diğer' },
];

export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));

/** Sidecar "category" alaninda yazilabilecek serbest karsiliklar. */
/* Not: "ekonomi", "finans", "politika" gibi tek basina hangi sekmeye ait oldugu
   belirsiz sozcukler bilerek disarida — onlari anahtar kelime puanlamasi cozuyor. */
const ALIASES = {
  world:   ['dunya', 'world', 'uluslararasi', 'global', 'dis haberler', 'diplomasi'],
  turkey:  ['turkiye', 'turkey', 'gundem', 'yurt', 'ulusal', 'ic haberler'],
  tech:    ['teknoloji', 'tech', 'technology', 'yazilim', 'dijital'],
  markets: ['borsa', 'markets', 'piyasalar', 'piyasa', 'abd borsa', 'wall street'],
};

/* Agirlikli anahtar kelimeler. Hepsi fold() edilmis bicimde yazili:
   kucuk harf, Turkce aksanlar sadelestirilmis (ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c).
   3 = kategoriyi tek basina isaret eden guclu belirtec, 1 = destekleyici ipucu. */
const KEYWORDS = {
  turkey: {
    3: ['turkiye', 'ankara', 'istanbul', 'izmir', 'tbmm', 'meclis', 'cumhurbaskani',
        'borsa istanbul', 'bist', 'tcmb', 'anadolu ajansi', 'afad', 'valilik', 'belediye',
        'para politikasi kurulu'],
    1: ['turk', 'bakanlik', 'bakan', 'lira', 'gundem', 'emniyet', 'bursa', 'antalya',
        'diyarbakir', 'trabzon', 'yerel', 'milli'],
  },
  world: {
    3: ['birlesmis milletler', 'nato', 'avrupa birligi', 'ukrayna', 'rusya', 'gazze',
        'israil', 'iran', 'cin', 'hindistan', 'ortadogu', 'brüksel', 'bruksel'],
    1: ['dunya', 'world', 'avrupa', 'asya', 'afrika', 'zirve', 'diplomasi', 'savas',
        'multeci', 'goc', 'iklim', 'kuresel', 'uluslararasi'],
  },
  tech: {
    3: ['yapay zeka', 'teknoloji', 'yazilim', 'siber', 'veri merkezi', 'openai', 'nvidia',
        'chatgpt', 'algoritma', 'uygulama magazasi', 'yari iletken', 'kuantum'],
    1: ['tech', 'cip', 'chip', 'robot', 'uzay', 'spacex', 'girisim', 'startup', 'bulut',
        'donanim', 'iphone', 'android', 'google', 'apple', 'microsoft', 'meta', 'model'],
  },
  markets: {
    // Yalnizca ABD piyasalarina ozgu belirtecler guclu sayilir: "faiz", "enflasyon",
    // "piyasa" gibi sozcukler Turkiye ekonomi haberlerinde de aynen geciyor.
    3: ['wall street', 'nasdaq', 'dow jones', 's&p', 'nyse', 'fed', 'sec',
        'new york borsasi', 'halka arz', 'ipo', 'temettu'],
    1: ['borsa', 'hisse', 'endeks', 'tahvil', 'piyasa', 'faiz', 'resesyon', 'ceyrek',
        'yatirimci', 'dolar', 'enflasyon', 'emtia', 'petrol', 'bilanco'],
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

/** Serbest metni (kicker, sidecar category, kaynak adi) kategori kimligine cevirir. */
export function categoryFromText(value) {
  const v = fold(value || '').trim();
  if (!v) return null;
  if (CATEGORY_LABEL[v]) return v;
  for (const [id, words] of Object.entries(ALIASES)) {
    if (words.some(w => v === w || v.includes(w))) return id;
  }
  return null;
}

/**
 * Bir makalenin kategorisi. Once acik beyan, sonra anahtar kelime puanlamasi.
 * Hicbiri tutmazsa OTHER doner — "Diğer" sekmesi yalnizca boyle haberler varsa gorunur.
 */
export function categoryOf(article) {
  const declared = categoryFromText(article.category);
  if (declared) return declared;

  for (const tag of article.tags || []) {
    const fromTag = categoryFromText(tag);
    if (fromTag) return fromTag;
  }

  const haystack = fold([
    article.title, article.summary, article.source,
    (article.tags || []).join(' '), (article.text || '').slice(0, 1200),
  ].join(' '));

  // Once guclu belirtec sayisi, esitse toplam puan. Boylece tek bir spesifik
  // isaret ("Para Politikası Kurulu"), bir yigin genel sozcugu yenebiliyor.
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
  const counts = Object.fromEntries(CATEGORIES.map(c => [c.id, 0]));
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
  world:   'var(--cyan)',
  turkey:  'var(--accent)',
  tech:    'var(--green)',
  markets: 'var(--amber)',
  [OTHER]: 'var(--mute)',
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
      return `
      <button class="cat-card" data-cat-open="${c.id}" style="--tone:${toneOf(c.id)}">
        <span class="cc-name">${c.label}</span>
        <span class="cc-meta">${n} başlık${u ? `<i>${u} okunmadı</i>` : ''}</span>
        <span class="cc-go">gündemi aç
          <svg viewBox="0 0 24 24"><path d="M5 12h13M12 5l7 7-7 7"/></svg>
        </span>
      </button>`;
    }).join('');
}
