// Локальное хранилище (IndexedDB) с кэшем в памяти. Работает полностью офлайн.
// Каждая запись: { id, kind, updatedAt, deleted, dirty, ...поля }
import { uid } from './util.js';

const DB_NAME = 'lifeos';
const VERSION = 1;
let db = null;
const cache = new Map();          // id -> item
const health = new Map();         // uid -> sample
const meta = new Map();           // key -> value
const listeners = new Set();
let memoryOnly = false;
let version = 0;
export function ver() { return version; }

function req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

export async function open() {
  if (!globalThis.indexedDB) { memoryOnly = true; return; }
  try {
    db = await new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('items')) d.createObjectStore('items', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('health')) d.createObjectStore('health', { keyPath: 'uid' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
      };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    const [items, hs, ms] = await Promise.all(['items', 'health', 'meta'].map(n => req(db.transaction(n).objectStore(n).getAll())));
    items.forEach(i => cache.set(i.id, i));
    hs.forEach(h => health.set(h.uid, h));
    ms.forEach(m => meta.set(m.key, m.value));
  } catch (e) {
    console.warn('IndexedDB недоступна, работаю в памяти', e);
    memoryOnly = true;
  }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}

function writeIDB(store, values) {
  if (memoryOnly || !db || !values.length) return Promise.resolve();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const v of values) os.put(v);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

let notifyTimer = null;
function notify(info) {
  version++;
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => listeners.forEach(f => f(info)), 0);
}
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// ---------- items ----------
export function all(kind, { includeDeleted = false } = {}) {
  const out = [];
  for (const i of cache.values()) if (i.kind === kind && (includeDeleted || !i.deleted)) out.push(i);
  return out;
}
export function get(id) { const i = cache.get(id); return i && !i.deleted ? i : null; }

/** Создать или обновить запись. Возвращает итоговую запись. */
export function put(kind, obj) {
  const now = Date.now();
  const prev = obj.id ? cache.get(obj.id) : null;
  const item = { ...(prev || {}), ...obj, id: obj.id || uid(kind.slice(0, 2) + '_'), kind, updatedAt: Math.max(now, (prev?.updatedAt || 0) + 1), dirty: true };
  if (!prev && !item.createdAt) item.createdAt = now;
  if (item.deleted === undefined) item.deleted = false;
  cache.set(item.id, item);
  writeIDB('items', [item]);
  notify({ kind, local: true });
  return item;
}
export function patch(id, fields) {
  const prev = cache.get(id); if (!prev) return null;
  return put(prev.kind, { ...prev, ...fields, id });
}
export function remove(id) {
  const prev = cache.get(id); if (!prev) return;
  put(prev.kind, { id, deleted: true });
}

/** Применить записи с сервера (LWW по updatedAt). */
export async function applyRemote(rows) {
  const changed = [];
  for (const r of rows) {
    const local = cache.get(r.id);
    if (local && local.dirty && local.updatedAt >= r.updated_at) continue;
    if (local && !local.dirty && local.updatedAt > r.updated_at) continue;
    const item = { ...(r.data || {}), id: r.id, kind: r.kind, updatedAt: Number(r.updated_at), deleted: !!r.deleted, dirty: false };
    cache.set(item.id, item); changed.push(item);
  }
  await writeIDB('items', changed);
  if (changed.length) notify({ remote: true });
  return changed.length;
}
export function dirtyItems() { return [...cache.values()].filter(i => i.dirty); }
export async function markClean(items) {
  const cleaned = [];
  for (const i of items) {
    const cur = cache.get(i.id);
    if (cur && cur.updatedAt === i.updatedAt) { cur.dirty = false; cleaned.push(cur); }
  }
  await writeIDB('items', cleaned);
}

// ---------- Apple Health ----------
export function healthSamples(type) {
  const out = []; for (const h of health.values()) if (!type || h.type === type) out.push(h); return out;
}
export async function applyHealth(rows) {
  for (const r of rows) health.set(r.uid, r);
  await writeIDB('health', rows);
  if (rows.length) notify({ health: true });
}

// ---------- meta ----------
export function getMeta(k, d = null) { return meta.has(k) ? meta.get(k) : d; }
export async function setMeta(k, v) { meta.set(k, v); await writeIDB('meta', [{ key: k, value: v }]); }

// ---------- экспорт / импорт ----------
export function exportAll() {
  return {
    app: 'Life OS', version: 1, exportedAt: new Date().toISOString(),
    items: [...cache.values()].map(({ dirty, ...rest }) => rest),
    health: [...health.values()]
  };
}
export async function importAll(data, { replace = false } = {}) {
  if (!data || !Array.isArray(data.items)) throw new Error('Неверный формат файла');
  if (replace) {
    // помечаем удалёнными всё, чего нет в импорте (удаления тоже синхронизируются)
    const ids = new Set(data.items.map(i => i.id));
    for (const i of cache.values()) if (!ids.has(i.id) && !i.deleted) put(i.kind, { id: i.id, deleted: true });
  }
  const now = Date.now(); const items = [];
  for (const raw of data.items) {
    if (!raw.id || !raw.kind) continue;
    const local = cache.get(raw.id);
    if (local && local.updatedAt > (raw.updatedAt || 0) && !replace) continue;
    const it = { ...raw, updatedAt: Math.max(now, (local?.updatedAt || 0) + 1), dirty: true };
    cache.set(it.id, it); items.push(it);
  }
  await writeIDB('items', items);
  if (Array.isArray(data.health)) await applyHealth(data.health.filter(h => h.uid));
  notify({ import: true });
  return items.length;
}
export async function wipeLocal() {
  cache.clear(); health.clear(); meta.clear();
  if (db) for (const n of ['items', 'health', 'meta']) await req(db.transaction(n, 'readwrite').objectStore(n).clear());
  notify({ wipe: true });
}
export function stats() { return { items: cache.size, health: health.size, dirty: dirtyItems().length, memoryOnly }; }
