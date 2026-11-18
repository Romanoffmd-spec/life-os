// Общие утилиты: даты (локальное время), форматирование, статистика.

export const DAY = 86400000;

export function pad(n) { return String(n).padStart(2, '0'); }

/** 'YYYY-MM-DD' в локальном часовом поясе */
export function dkey(d = new Date()) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
export function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); }
export function daysBetween(a, b) { return Math.round((parseKey(b) - parseKey(a)) / DAY); }
export function rangeKeys(endKey, n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(addDays(endKey, -i)); return out; }
export function weekday(k) { return (parseKey(k).getDay() + 6) % 7; } // 0 = Пн
export function weekStart(k) { return addDays(k, -weekday(k)); }
export function isWeekend(k) { return weekday(k) >= 5; }

export function hm(min) { min = Math.round(min); return `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`; }
export function parseHM(s) { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); }
export function minutesOfDay(d = new Date()) { return d.getHours() * 60 + d.getMinutes(); }
export function dur(min) {
  min = Math.round(min || 0);
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}
export function hours(min, digits = 1) { return (min / 60).toFixed(digits).replace('.', ','); }
export function num(x, digits = 1) {
  if (x == null || !isFinite(x)) return '-';
  return Number(x).toFixed(digits).replace('.', ',');
}
export function int(x) { return x == null || !isFinite(x) ? '-' : Math.round(x).toLocaleString('ru-RU'); }

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WD_LONG = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
export function fmtDate(k, withWd = false) {
  const d = parseKey(k);
  return `${withWd ? WD[weekday(k)] + ', ' : ''}${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export function wdShort(k) { return WD[weekday(k)]; }
export function wdLong(k) { return WD_LONG[weekday(k)]; }

export function mean(a) { a = a.filter(v => v != null && isFinite(v)); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null; }
export function sum(a) { return a.reduce((s, v) => s + (v || 0), 0); }
export function sd(a) {
  a = a.filter(v => v != null && isFinite(v)); if (a.length < 2) return null;
  const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
}
export function median(a) {
  a = a.filter(v => v != null && isFinite(v)).sort((x, y) => x - y); if (!a.length) return null;
  const i = Math.floor(a.length / 2); return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
}
/** Корреляция Пирсона по парам без пропусков */
export function pearson(xs, ys) {
  const p = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => x != null && y != null && isFinite(x) && isFinite(y));
  if (p.length < 8) return null;
  const mx = mean(p.map(v => v[0])), my = mean(p.map(v => v[1]));
  let a = 0, b = 0, c = 0;
  for (const [x, y] of p) { a += (x - mx) * (y - my); b += (x - mx) ** 2; c += (y - my) ** 2; }
  return b && c ? { r: a / Math.sqrt(b * c), n: p.length } : null;
}
export function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
export function uid(prefix = '') {
  const r = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + r;
}
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many;
}
export function durShort(min) {
  min = Math.round(min || 0);
  if (min < 60) return `${min}м`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}ч ${m}м` : `${h}ч`;
}
