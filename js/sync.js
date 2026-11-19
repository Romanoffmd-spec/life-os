// Синхронизация с Supabase (Postgres + Auth) через REST, без внешних библиотек.
// Модель: offline-first. Локальные изменения помечаются dirty и отправляются пакетами;
// с сервера забираются изменения по курсору server_ts. Конфликты: last-write-wins по времени изменения.
import * as store from './store.js';

const listeners = new Set();
let state = { status: 'idle', error: null, lastSync: null };
let timer = null, running = false, again = false;

function set(s) { state = { ...state, ...s }; listeners.forEach(f => f(state)); }
export function onStatus(f) { listeners.add(f); f(state); return () => listeners.delete(f); }
export function getState() { return state; }

// Проект Life OS по умолчанию (anon key публичный по замыслу Supabase: доступ ограничен RLS).
export const DEFAULT_SUPABASE = { url: 'https://jbgzamofcsiithuxyvar.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpiZ3phbW9mY3NpaXRodXh5dmFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ5ODQyMDEsImV4cCI6MjExMDU2MDIwMX0.2Ua5gw7dTepuPoVJETE0HO50G_UH7JZSmJtjokR-9OI' };
export function config() { return store.getMeta('supabase') || DEFAULT_SUPABASE; }
export async function setConfig(url, anonKey) {
  url = String(url || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && !/^https:\/\//.test(url)) throw new Error('Нужен адрес вида https://xxxx.supabase.co');
  if (!anonKey || anonKey.length < 20) throw new Error('Нужен anon / publishable key');
  await store.setMeta('supabase', { url, anonKey: anonKey.trim() });
}
export function session() { return store.getMeta('session'); }
export function isConfigured() { return !!config(); }
export function isSignedIn() { return !!session()?.access_token; }

async function http(path, { method = 'GET', body, auth = true, headers = {} } = {}) {
  const c = config(); if (!c) throw new Error('Синхронизация не настроена');
  const h = { apikey: c.anonKey, 'Content-Type': 'application/json', ...headers };
  if (auth) { const t = await accessToken(); h.Authorization = `Bearer ${t}`; }
  const r = await fetch(c.url + path, { method, headers: h, body: body == null ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const msg = data?.msg || data?.message || data?.error_description || data?.error || `HTTP ${r.status}`;
    const e = new Error(msg); e.status = r.status; throw e;
  }
  return data;
}

async function saveSession(d) {
  const s = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000, user: { id: d.user?.id, email: d.user?.email } };
  await store.setMeta('session', s); return s;
}
async function accessToken() {
  let s = session(); if (!s) throw new Error('Нужен вход в аккаунт');
  if (Date.now() > s.expires_at - 60000) {
    try {
      const d = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: s.refresh_token } });
      s = await saveSession(d);
    } catch (e) {
      if (e.status === 400 || e.status === 401) { await store.setMeta('session', null); throw new Error('Сессия истекла, войди заново'); }
      throw e;
    }
  }
  return s.access_token;
}

export async function signUp(email, password) {
  const d = await http('/auth/v1/signup', { method: 'POST', auth: false, body: { email, password } });
  if (d?.access_token) { await saveSession(d); return { signedIn: true }; }
  return { signedIn: false, confirm: true };
}
export async function signIn(email, password) {
  const d = await http('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } });
  await saveSession(d);
  await afterLogin(d.user?.id);
}
async function afterLogin(userId) {
  // новый аккаунт на этом устройстве: тянем всё с начала
  if (store.getMeta('syncUser') !== userId) {
    await store.setMeta('cursorItems', null); await store.setMeta('cursorHealth', null);
    await store.setMeta('syncUser', userId);
  }
  syncSoon(0);
}

/** Вход без пароля: письмо со ссылкой. Новый аккаунт создаётся автоматически. */
export async function sendMagicLink(email) {
  const back = location.origin + location.pathname;
  await http('/auth/v1/otp?redirect_to=' + encodeURIComponent(back), { method: 'POST', auth: false, body: { email: String(email).trim(), create_user: true } });
}

/** Возврат по ссылке из письма: токены приходят во фрагменте адреса. */
export async function consumeAuthRedirect() {
  const h = location.hash.slice(1);
  if (!/(^|&)(access_token|error_description)=/.test(h)) return null;
  const p = new URLSearchParams(h);
  history.replaceState(null, '', location.pathname + location.search);
  if (p.get('error_description')) return { error: p.get('error_description').replace(/\+/g, ' ') };
  const c = config();
  const r = await fetch(c.url + '/auth/v1/user', { headers: { apikey: c.anonKey, Authorization: 'Bearer ' + p.get('access_token') } });
  if (!r.ok) return { error: 'ссылка устарела, запроси новую' };
  const user = await r.json();
  await saveSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: Number(p.get('expires_in')) || 3600, user });
  await afterLogin(user.id);
  return { email: user.email };
}

export async function signOut() {
  try { await http('/auth/v1/logout', { method: 'POST' }); } catch { }
  await store.setMeta('session', null);
  set({ status: 'idle' });
}

export async function createIngestToken() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Almaty';
  return await http('/rest/v1/rpc/create_ingest_token', { method: 'POST', body: { p_tz: tz } });
}

async function push() {
  const dirty = store.dirtyItems();
  for (let i = 0; i < dirty.length; i += 300) {
    const batch = dirty.slice(i, i + 300);
    const payload = batch.map(({ id, kind, updatedAt, deleted, dirty: _d, ...data }) => ({ id, kind, updated_at: updatedAt, deleted: !!deleted, data }));
    await http('/rest/v1/rpc/sync_push', { method: 'POST', body: { p_items: payload } });
    await store.markClean(batch);
  }
  return dirty.length;
}
async function pullTable(table, cursorKey, select, apply) {
  let total = 0;
  for (let guard = 0; guard < 50; guard++) {
    const cur = store.getMeta(cursorKey);
    const q = `/rest/v1/${table}?select=${select}&order=server_ts.asc&limit=1000` + (cur ? `&server_ts=gt.${encodeURIComponent(cur)}` : '');
    const rows = await http(q);
    if (!rows.length) break;
    await apply(rows);
    await store.setMeta(cursorKey, rows[rows.length - 1].server_ts);
    total += rows.length;
    if (rows.length < 1000) break;
  }
  return total;
}

export async function syncNow() {
  if (!isConfigured() || !isSignedIn()) return;
  if (running) { again = true; return; }
  if (!navigator.onLine) { set({ status: 'offline' }); return; }
  running = true; set({ status: 'syncing', error: null });
  try {
    const pushed = await push();
    const pulled = await pullTable('items', 'cursorItems', 'id,kind,data,updated_at,deleted,server_ts', store.applyRemote);
    const health = await pullTable('health_samples', 'cursorHealth', 'uid,type,start_at,end_at,value,value_text,unit,server_ts', store.applyHealth);
    const now = Date.now();
    await store.setMeta('lastSync', now);
    set({ status: 'ok', lastSync: now, pushed, pulled, health });
  } catch (e) {
    console.warn('sync', e);
    set({ status: navigator.onLine ? 'error' : 'offline', error: e.message });
  } finally {
    running = false;
    if (again) { again = false; syncSoon(500); }
  }
}
export function syncSoon(ms = 2000) { clearTimeout(timer); timer = setTimeout(syncNow, ms); }

export function startAuto() {
  state.lastSync = store.getMeta('lastSync');
  store.subscribe(info => { if (info?.local) syncSoon(2500); });
  addEventListener('online', () => syncSoon(300));
  addEventListener('offline', () => set({ status: 'offline' }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncSoon(300); });
  setInterval(() => { if (!document.hidden) syncNow(); }, 60000);
  syncSoon(500);
}
