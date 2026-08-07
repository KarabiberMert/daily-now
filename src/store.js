/* Uygulama durumu ve ayarlar. Basit yayin/abone (pub-sub) modeli. */

import { Articles, KV } from './db.js';
import { categoryOf } from './categories.js';

const DEFAULT_SETTINGS = {
  theme: 'dark',
  autoSync: true,
  markReadOnOpen: true,
};

export const state = {
  articles: [],
  settings: { ...DEFAULT_SETTINGS },
  filters: { range: 'today', unread: false, starred: false, source: null, tag: null },
  query: '',
  view: 'feed',
  serverInbox: null, // inbox/index.json'un icerigi — tek haber kaynagi
  syncing: false,

  // Okundu/yildiz durumu belge kaydinda degil, story anahtarlarinda tutuluyor;
  // ayni gundem gun icinde tekrar yayinlanirsa durum korunsun diye.
  readStories: new Set(),
  starredStories: new Set(),
};

const STORY_MEMORY = 4000;   // sinirsiz buyumesin

const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function emit(what = 'all') { subs.forEach(fn => fn(what)); }

export async function loadAll() {
  const [articles, saved, readKeys, starKeys] = await Promise.all([
    Articles.all(),
    KV.get('settings', null),
    KV.get('readStories', []),
    KV.get('starredStories', []),
  ]);
  state.readStories = new Set(readKeys || []);
  state.starredStories = new Set(starKeys || []);
  catCache.clear();
  state.articles = (articles || []).sort(byRecency);
  state.settings = { ...DEFAULT_SETTINGS, ...(saved || {}) };
}

/* ── story okundu / yildiz ── */

export const isStoryRead = key => state.readStories.has(key);
export const isStoryStarred = key => state.starredStories.has(key);

export async function markStoryRead(key) {
  if (state.readStories.has(key)) return;
  state.readStories.add(key);
  await persistStorySet('readStories', state.readStories);
  emit('stories');
}

export async function toggleStoryStar(key) {
  const on = !state.starredStories.has(key);
  if (on) state.starredStories.add(key); else state.starredStories.delete(key);
  await persistStorySet('starredStories', state.starredStories);
  emit('stories');
  return on;
}

async function persistStorySet(name, set) {
  // En yeni kayitlar sona eklendigi icin bastan kirpiyoruz.
  let keys = Array.from(set);
  if (keys.length > STORY_MEMORY) {
    keys = keys.slice(keys.length - STORY_MEMORY);
    set.clear();
    keys.forEach(k => set.add(k));
  }
  await KV.set(name, keys);
}

/* Siniflandirma makalenin tam metnine bakar; her cizimde tekrar hesaplamamak
   icin id bazinda onbelleklenir. Yeni surum iceri alindiginda tazelenir. */
const catCache = new Map();

export function catOf(article) {
  let c = catCache.get(article.id);
  if (c === undefined) { c = categoryOf(article); catCache.set(article.id, c); }
  return c;
}

export function byRecency(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (b.publishedAt || b.addedAt || '') < (a.publishedAt || a.addedAt || '') ? -1 : 1;
}

export async function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  await KV.set('settings', state.settings);
  emit('settings');
}

export function upsert(list) {
  const map = new Map(state.articles.map(a => [a.id, a]));
  for (const a of list) { map.set(a.id, a); catCache.delete(a.id); }
  state.articles = Array.from(map.values()).sort(byRecency);
}

export function remove(id) {
  state.articles = state.articles.filter(a => a.id !== id);
  catCache.delete(id);
}

export function get(id) {
  return state.articles.find(a => a.id === id);
}

export async function patchArticle(id, patch) {
  const a = get(id);
  if (!a) return null;
  Object.assign(a, patch);
  await Articles.put(a);
  emit('articles');
  return a;
}

/* ── turetilmis veriler ── */

export function tags() {
  const m = new Map();
  for (const a of state.articles) for (const t of a.tags || []) m.set(t, (m.get(t) || 0) + 1);
  return Array.from(m, ([name, count]) => ({ name, count })).sort((x, y) => y.count - x.count);
}

