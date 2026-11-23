// ===============================================================
//  Almacenamiento local (IndexedDB): proyectos, sonidos y ajustes.
//  Todo queda en el dispositivo; nada se sube a internet.
// ===============================================================
const DB_NAME = 'dg-studio';
const VERSION = 1;
let dbp = null;
const mem = { projects: new Map(), samples: new Map(), kv: new Map() }; // respaldo si IndexedDB no está disponible

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('samples')) db.createObjectStore('samples', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    if (!db) { resolve(fn(null)); return; }
    const t = db.transaction(store, mode); const s = t.objectStore(store);
    const r = fn(s);
    t.oncomplete = () => resolve(r && 'result' in r ? r.result : r);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Sin espacio de almacenamiento'));
  }));
}

export const db = {
  async get(store, id) {
    const r = await tx(store, 'readonly', (s) => (s ? s.get(id) : { result: mem[store].get(id) }));
    return r ?? null;
  },
  async put(store, obj) {
    await tx(store, 'readwrite', (s) => (s ? s.put(obj) : mem[store].set(obj.id, obj)));
    return obj;
  },
  async del(store, id) { await tx(store, 'readwrite', (s) => (s ? s.delete(id) : mem[store].delete(id))); },
  async all(store) {
    const r = await tx(store, 'readonly', (s) => (s ? s.getAll() : { result: [...mem[store].values()] }));
    return r || [];
  },
  async kvGet(key, def = null) {
    const r = await tx('kv', 'readonly', (s) => (s ? s.get(key) : { result: mem.kv.get(key) }));
    return r === undefined || r === null ? def : r;
  },
  async kvSet(key, val) { await tx('kv', 'readwrite', (s) => (s ? s.put(val, key) : mem.kv.set(key, val))); },
};

// Pedir al navegador que no borre los datos (iOS puede borrarlos si no se usa la app)
export async function persist() {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch { /* no soportado */ }
}
