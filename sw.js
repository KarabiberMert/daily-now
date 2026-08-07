/* Daily Now service worker — cevrimdisi kabuk.
   Strateji: once ag, basarisiz olursa onbellek. Boylece gelistirirken
   eski surum takilip kalmaz, internet yokken de uygulama acilir. */

// Surum numarasini degistirmek eski onbellegi tamamen sildirir; kod
// degistiginde tarayicida bayat dosya kalmasin diye artiriliyor.
const CACHE = 'daily-now-v8';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './src/app.js',
  './src/store.js',
  './src/db.js',
  './src/pdf.js',
  './src/categories.js',
  './src/stories.js',
  './src/util.js',
  './src/cards.js',
  './src/library.js',
  './src/reader.js',
  './src/views/feed.js',
  './src/views/category.js',
  './src/views/search.js',
  './src/views/stats.js',
  './vendor/pdf.min.mjs',
  './vendor/pdf.worker.min.mjs',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // inbox/index.json her seferinde guncel olmali; PDF'ler zaten IndexedDB'ye
  // kopyalaniyor. Klasorun tamami onbellek disinda kalsin.
  if (url.pathname.startsWith('/inbox/')) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
