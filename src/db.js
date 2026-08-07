/* IndexedDB katmani — makaleler, PDF dosyalari ve ayarlar. */

const DB_NAME = 'dailynews';
const DB_VERSION = 2;

let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const store = db.objectStoreNames.contains('articles')
        ? req.transaction.objectStore('articles')
        : db.createObjectStore('articles', { keyPath: 'id' });
      const ensure = (name, path) => {
        if (!store.indexNames.contains(name)) store.createIndex(name, path);
      };
      ensure('date', 'date');
      ensure('addedAt', 'addedAt');
      ensure('fingerprint', 'fingerprint');
      ensure('path', 'path');
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => {
      _db = req.result;
      // Baska bir sekme surum yukseltirse ya da veritabanini silerse bagimizi
      // kapatiyoruz; aksi halde o sekme sonsuza dek bloke kalir.
      _db.onversionchange = () => { try { _db.close(); } catch {} _db = null; };
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
    // Baska bir sekme eski surumu acik tutuyorsa acilis hic tamamlanmaz.
    // Sessizce asili kalmak yerine anlasilir bir hata verelim.
    req.onblocked = () => reject(new Error(
      'Veritabanı başka bir sekmede açık. Daily Now’ın diğer sekmelerini kapatıp yenile.'));
  });
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const result = fn(t.objectStore(store));
    t.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

const wrap = req => ({ __req: req });

/* ── articles ── */
export const Articles = {
  all: () => tx('articles', 'readonly', s => wrap(s.getAll())),
  byPath: path => tx('articles', 'readonly', s => wrap(s.index('path').get(path))),
  get: id => tx('articles', 'readonly', s => wrap(s.get(id))),
  put: a => tx('articles', 'readwrite', s => { s.put(a); return a; }),
  putMany: list => tx('articles', 'readwrite', s => { list.forEach(a => s.put(a)); return list.length; }),
  del: id => tx('articles', 'readwrite', s => { s.delete(id); return id; }),
  clear: () => tx('articles', 'readwrite', s => { s.clear(); return true; }),
};

/* ── files (PDF blob'lari) ── */
export const Files = {
  get: key => tx('files', 'readonly', s => wrap(s.get(key))),
  put: (key, blob) => tx('files', 'readwrite', s => { s.put(blob, key); return key; }),
  del: key => tx('files', 'readwrite', s => { s.delete(key); return key; }),
  clear: () => tx('files', 'readwrite', s => { s.clear(); return true; }),
};

/* ── kv (ayarlar, klasor handle'i) ── */
export const KV = {
  get: (key, fallback = null) =>
    tx('kv', 'readonly', s => wrap(s.get(key))).then(v => (v === undefined ? fallback : v)),
  set: (key, val) => tx('kv', 'readwrite', s => { s.put(val, key); return val; }),
  del: key => tx('kv', 'readwrite', s => { s.delete(key); return key; }),
};

export async function estimateUsage() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  try { return await navigator.storage.estimate(); } catch { return null; }
}
