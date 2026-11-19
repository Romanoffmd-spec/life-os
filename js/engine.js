// Движок Life OS: чистые функции без доступа к DOM и хранилищу.
// Всё, что здесь считается, опирается на реальные данные пользователя (items + Apple Health).
import {
  dkey, addDays, parseKey, rangeKeys, weekday, weekStart, isWeekend, parseHM, hm,
  mean, sum, sd, median, pearson, clamp, DAY, daysBetween, dur, num
} from './util.js';
import { TRACKS } from './content/curriculum.js';

export const DEFAULT_SETTINGS = {
  name: '',
  sex: 'm', age: 27, heightCm: null, goalWeightKg: null, goalDate: null, goalRatePct: 0.6, activityFactor: 1.45,
  wake: '05:45', workStart: '07:00', workEnd: '18:00', commuteMin: 30, bedtime: '22:15',
  sleepTargetH: 7.5, dinnerMin: 35, choresMin: 20, decompressMin: 15, windDownMin: 30,
  focusSpanMin: 35, leisureMinDaily: 75,
  weekendsOff: true, restWeekend: true,
  workoutsPerWeek: 3, workoutMin: 40, stepsTarget: 8000, waterTargetMl: 2200,
  studyWeeklyMin: 180, usmleStep: 1,
  tracks: TRACKS,
  newCardsPerDay: 15,
  theme: 'dark',
  aiModel: 'claude-sonnet-5-5'
};

// ---------------------------------------------------------------------------
// Apple Health: дневные агрегаты и сон
// ---------------------------------------------------------------------------
const CUMULATIVE = new Set(['steps', 'distance', 'active_energy', 'basal_energy', 'exercise_min', 'stand_min', 'flights']);
const AVERAGED = new Set(['resting_hr', 'hrv', 'resp_rate', 'spo2', 'wrist_temp', 'heart_rate', 'bp_sys', 'bp_dia', 'walking_hr']);

/** samples: [{type,start_at,end_at,value,value_text}] -> { [date]: {steps, hrv, ...} } */
export function dailyHealth(samples) {
  const acc = {};
  for (const s of samples) {
    if (s.type === 'sleep' || s.type === 'workout' || s.value == null) continue;
    const k = dkey(new Date(s.start_at));
    const d = acc[k] || (acc[k] = { _n: {} });
    if (CUMULATIVE.has(s.type)) d[s.type] = (d[s.type] || 0) + s.value;
    else if (AVERAGED.has(s.type)) {
      d._n[s.type] = (d._n[s.type] || 0) + 1;
      d[s.type] = (d[s.type] || 0) + s.value;
      if (s.type === 'heart_rate') d.hr_max = Math.max(d.hr_max || 0, s.value);
    } else if (s.type === 'weight' || s.type === 'body_fat') {
      // берём первое (утреннее) измерение дня
      const t = +new Date(s.start_at);
      if (!d['_t_' + s.type] || t < d['_t_' + s.type]) { d['_t_' + s.type] = t; d[s.type] = s.value; }
    } else d[s.type] = s.value;
  }
  for (const d of Object.values(acc)) {
    for (const [t, n] of Object.entries(d._n)) d[t] = d[t] / n;
    if (d.spo2 != null && d.spo2 <= 1) d.spo2 *= 100; // Shortcuts может отдать долю
    if (d.body_fat != null && d.body_fat <= 1) d.body_fat *= 100;
    delete d._n; delete d._t_weight; delete d._t_body_fat;
  }
  return acc;
}

export function sleepStage(text) {
  const t = String(text || '').toLowerCase();
  if (/awake|бодрств|пробужд/.test(t)) return 'awake';
  if (/deep|глубок/.test(t)) return 'deep';
  if (/rem|быстр/.test(t)) return 'rem';
  if (/core|основн|легк|light/.test(t)) return 'core';
  if (/in ?bed|в кровати|в постели|inbed/.test(t)) return 'inbed';
  if (/asleep|сон|sleep|unspecified/.test(t)) return 'asleep';
  return null;
}

function unionMinutes(intervals) {
  if (!intervals.length) return 0;
  const a = intervals.slice().sort((x, y) => x[0] - y[0]);
  let total = 0, [cs, ce] = a[0];
  for (let i = 1; i < a.length; i++) {
    const [s, e] = a[i];
    if (s <= ce) ce = Math.max(ce, e); else { total += ce - cs; cs = s; ce = e; }
  }
  total += ce - cs;
  return total / 60000;
}

/** Ночь относится к дате пробуждения: ключ = дата(end + 6 ч). */
export function sleepNights(samples) {
  const groups = {};
  for (const s of samples) {
    if (s.type !== 'sleep') continue;
    const st = sleepStage(s.value_text);
    if (!st) continue;
    const a = +new Date(s.start_at), b = +new Date(s.end_at);
    if (!(b > a) || b - a > 16 * 3600000) continue;
    const k = dkey(new Date(b + 6 * 3600000));
    (groups[k] || (groups[k] = [])).push({ st, a, b });
  }
  const out = {};
  for (const [k, list] of Object.entries(groups)) {
    const by = st => list.filter(x => x.st === st).map(x => [x.a, x.b]);
    const staged = list.filter(x => ['core', 'deep', 'rem', 'asleep'].includes(x.st));
    const asleepIv = staged.map(x => [x.a, x.b]);
    const inbedIv = by('inbed');
    const asleepMin = unionMinutes(asleepIv) || unionMinutes(inbedIv);
    const all = asleepIv.length ? asleepIv : inbedIv;
    if (!all.length) continue;
    const start = Math.min(...all.map(x => x[0])), end = Math.max(...all.map(x => x[1]));
    out[k] = {
      date: k, asleepMin, source: 'health',
      inBedMin: unionMinutes(inbedIv) || (end - start) / 60000,
      awakeMin: unionMinutes(by('awake')),
      deepMin: unionMinutes(by('deep')), remMin: unionMinutes(by('rem')), coreMin: unionMinutes(by('core')),
      hasStages: list.some(x => ['core', 'deep', 'rem'].includes(x.st)),
      bedAt: start, wakeAt: end
    };
  }
  return out;
}

/** Ручные записи сна (если Health нет) */
export function manualSleep(logs) {
  const out = {};
  for (const l of logs) {
    if (!l.date || !l.bed || !l.wake) continue;
    let b = parseHM(l.bed), w = parseHM(l.wake);
    let minutes = w - b; if (minutes <= 0) minutes += 1440;
    const wakeDate = parseKey(l.date); wakeDate.setHours(0, w, 0, 0);
    out[l.date] = {
      date: l.date, asleepMin: Math.max(0, minutes - (l.awakeMin || 0)), inBedMin: minutes, awakeMin: l.awakeMin || 0,
      source: 'manual', quality: l.quality, bedAt: +wakeDate - minutes * 60000, wakeAt: +wakeDate
    };
  }
  return out;
}

export function mergeSleep(health, manual) { return { ...manual, ...health }; }

/** Сдвиг относительно полуночи (мин), чтобы 23:30 = -30, 00:30 = +30 */
export function bedtimeOffset(ms) {
  const d = new Date(ms); let m = d.getHours() * 60 + d.getMinutes();
  if (m > 720) m -= 1440; return m;
}

export function sleepStats(nights, today, n = 14) {
  const keys = rangeKeys(today, n);
  const list = keys.map(k => nights[k]).filter(Boolean);
  return {
    avgMin: mean(list.map(x => x.asleepMin)),
    nights: list.length,
    bedSdMin: list.length >= 5 ? sd(list.map(x => bedtimeOffset(x.bedAt))) : null,
    avgBed: list.length ? mean(list.map(x => bedtimeOffset(x.bedAt))) : null,
    avgWake: list.length ? mean(list.map(x => { const d = new Date(x.wakeAt); return d.getHours() * 60 + d.getMinutes(); })) : null
  };
}

// ---------------------------------------------------------------------------
// Индекс готовности (расчётный, не медицинский)
// ---------------------------------------------------------------------------
function baseline(daily, today, field, days = 28) {
  const vals = rangeKeys(addDays(today, -1), days).map(k => daily[k]?.[field]).filter(v => v != null);
  return vals.length >= 7 ? { median: median(vals), n: vals.length } : null;
}

export function readiness({ date, settings, nights, daily, checkin, dayInfo }) {
  const parts = [], reasons = [];
  const target = settings.sleepTargetH * 60;
  const night = nights[date];
  if (night) {
    const r = night.asleepMin / target;
    const s = clamp((r - 0.55) / 0.45, 0, 1) * 100;
    parts.push({ w: 0.4, s });
    const diff = night.asleepMin - target;
    reasons.push({
      key: 'sleep', good: diff >= -20,
      text: `Сон ${dur(night.asleepMin)}${diff < -20 ? ` (на ${dur(-diff)} меньше цели)` : ''}`
    });
  }
  const t = daily[date] || {};
  const hb = baseline(daily, date, 'hrv');
  if (t.hrv != null && hb) {
    const r = t.hrv / hb.median;
    parts.push({ w: 0.2, s: clamp((r - 0.75) / 0.3, 0, 1) * 100 });
    const pct = Math.round((r - 1) * 100);
    reasons.push({ key: 'hrv', good: pct > -10, text: `HRV ${Math.round(t.hrv)} мс, ${pct >= 0 ? '+' : ''}${pct}% к базе 4 нед.` });
  }
  const rb = baseline(daily, date, 'resting_hr');
  if (t.resting_hr != null && rb) {
    const d = t.resting_hr - rb.median;
    parts.push({ w: 0.15, s: clamp(1 - d / 8, 0, 1) * 100 });
    reasons.push({ key: 'rhr', good: d < 4, text: `Пульс покоя ${Math.round(t.resting_hr)}, ${d >= 0 ? '+' : ''}${Math.round(d)} к базе` });
  }
  if (checkin?.energy) {
    parts.push({ w: 0.25, s: (checkin.energy - 1) / 4 * 100 });
    reasons.push({ key: 'energy', good: checkin.energy >= 3, text: `Самочувствие ${checkin.energy}/5` });
  }
  let score = null;
  if (parts.length) {
    const W = sum(parts.map(p => p.w));
    score = Math.round(sum(parts.map(p => p.w * p.s)) / W);
  }
  let mode = score == null ? 'normal' : score >= 75 ? 'optimal' : score >= 50 ? 'normal' : 'mvd';
  if (dayInfo?.type === 'postduty') { mode = 'mvd'; reasons.unshift({ key: 'duty', good: false, text: 'День после дежурства: приоритет восстановления' }); }
  if (dayInfo?.workload === 'heavy' && mode === 'optimal') { mode = 'normal'; reasons.push({ key: 'load', good: false, text: 'Тяжёлый рабочий день: вечер облегчён' }); }
  else if (dayInfo?.workload === 'heavy' && mode === 'normal') { mode = 'mvd'; reasons.push({ key: 'load', good: false, text: 'Тяжёлый рабочий день: вечер облегчён' }); }
  return { score, mode, reasons, confidence: parts.length >= 3 ? 'high' : parts.length ? 'low' : 'none' };
}

export const MODE_LABEL = { optimal: 'Полная сила', normal: 'Ровный шаг', mvd: 'Привал' };
export const MODE_RU = { optimal: 'Полная сила', normal: 'Ровный шаг', mvd: 'Привал' };

// ---------------------------------------------------------------------------
// Вес, расход энергии, цели питания
// ---------------------------------------------------------------------------
/** points: [{date, kg}] (один на день) -> [{date, kg, trend}] с EWMA и корректной обработкой пропусков */
export function weightTrend(points, alpha = 0.1) {
  const p = points.filter(x => x.kg > 0).sort((a, b) => a.date < b.date ? -1 : 1);
  const out = []; let t = null, last = null;
  for (const x of p) {
    if (t == null) t = x.kg;
    else {
      const gap = Math.max(1, daysBetween(last, x.date));
      const a = 1 - Math.pow(1 - alpha, gap);
      t = t + a * (x.kg - t);
    }
    last = x.date;
    out.push({ date: x.date, kg: x.kg, trend: t });
  }
  return out;
}

/** Наклон (кг/нед) по тренду за последние n дней, линейная регрессия */
export function weeklyRate(trend, today, days = 21) {
  const from = addDays(today, -days);
  const pts = trend.filter(x => x.date >= from);
  if (pts.length < 5 || daysBetween(pts[0].date, pts[pts.length - 1].date) < 10) return null;
  const xs = pts.map(x => daysBetween(from, x.date)), ys = pts.map(x => x.trend);
  const mx = mean(xs), my = mean(ys);
  let a = 0, b = 0; xs.forEach((x, i) => { a += (x - mx) * (ys[i] - my); b += (x - mx) ** 2; });
  return b ? a / b * 7 : null;
}

export function bmr(s, kg) {
  return 10 * kg + 6.25 * (s.heightCm || 175) - 5 * (s.age || 30) + (s.sex === 'f' ? -161 : 5);
}

/**
 * Цели питания. Источники оценки расхода:
 * 1) формула Миффлина-Сан Жеора × коэффициент активности;
 * 2) фактический расход по Apple Watch (basal + active) за 14 дней, если есть;
 * 3) адаптивно: средняя калорийность - изменение тренда веса (7700 ккал/кг), если питание записывается.
 */
export function energyTargets({ settings, trend, today, foodByDay, daily }) {
  const cur = trend.length ? trend[trend.length - 1].trend : null;
  if (!cur) return null;
  const s = settings;
  const formula = bmr(s, cur) * s.activityFactor;
  const dk = rangeKeys(addDays(today, -1), 14);
  const watchDays = dk.map(k => daily[k]).filter(d => d && d.basal_energy > 800 && d.active_energy != null);
  const watch = watchDays.length >= 7 ? mean(watchDays.map(d => d.basal_energy + d.active_energy)) * 0.95 : null;
  let prior = watch ? (formula + watch) / 2 : formula;
  let source = watch ? 'Формула + Apple Watch' : 'Формула';

  // адаптивная оценка
  const win = rangeKeys(addDays(today, -1), 21);
  const logged = win.filter(k => (foodByDay[k]?.kcal || 0) > 800);
  let adaptive = null;
  if (logged.length >= 12) {
    const tA = trend.filter(x => x.date <= win[0]).pop() || trend.find(x => x.date >= win[0]);
    const tB = trend[trend.length - 1];
    const span = tA && tB ? daysBetween(tA.date, tB.date) : 0;
    if (span >= 14) {
      const intake = mean(logged.map(k => foodByDay[k].kcal));
      adaptive = intake - (tB.trend - tA.trend) * 7700 / span;
    }
  }
  let tdee = prior;
  if (adaptive && adaptive > 1200 && adaptive < 5000) {
    const w = Math.min(1, logged.length / 21) * 0.7;
    tdee = prior * (1 - w) + adaptive * w;
    source += ' + адаптивная по факту';
  }
  const goal = s.goalWeightKg;
  const losing = goal == null || goal < cur - 0.3;
  const floor = s.sex === 'f' ? 1200 : 1500;
  // Режим «цель к дате»: темп считается из остатка до цели и недель до срока.
  // Потолок: 1,25% веса в неделю и дефицит не больше 35% расхода (дальше растёт потеря мышц).
  let byDate = null, ratePct = clamp(s.goalRatePct ?? 0.6, 0, 1), capShare = 0.25;
  if (losing && goal && s.goalDate) {
    const weeks = Math.max(1, daysBetween(today, s.goalDate) / 7);
    const needKgWeek = (cur - goal) / weeks;
    const needPct = needKgWeek / cur * 100;
    ratePct = clamp(needPct, 0.25, 1.25); capShare = 0.35;
    byDate = { weeks: Math.round(weeks), needKgWeek, needPct, date: s.goalDate };
  }
  let deficit = losing ? cur * ratePct / 100 * 7700 / 7 : 0;
  deficit = Math.min(deficit, tdee * capShare);
  const kcal = Math.round(Math.max(floor, tdee - deficit) / 10) * 10;
  if (byDate) {
    const kgWeek = (tdee - kcal) * 7 / 7700;
    byDate.planKgWeek = kgWeek;
    // Прогноз по неделям: расход падает вместе с весом, план каждую неделю пересчитывается по тем же правилам.
    let w = cur; const b0 = bmr(s, cur);
    for (let i = 0; i < byDate.weeks && w > goal; i++) {
      const td = tdee * bmr(s, w) / b0, left = Math.max(1, byDate.weeks - i);
      const pct = clamp((w - goal) / left / w * 100, 0.25, 1.25);
      const def = Math.min(w * pct / 100 * 7700 / 7, td * 0.35, td - floor);
      w -= Math.max(0, def) * 7 / 7700;
    }
    byDate.projected = Math.max(goal, w);
    byDate.feasible = byDate.projected <= goal + 1;
  }
  const refKg = goal && goal < cur ? Math.max(goal, cur * 0.85) : cur;
  const protein = Math.round(Math.min(refKg * 1.8, cur * 2.2));
  const fat = Math.round(Math.max(cur * 0.8, kcal * 0.27 / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return {
    tdee: Math.round(tdee), formula: Math.round(formula), watch: watch && Math.round(watch),
    adaptive: adaptive && Math.round(adaptive), source, kcal, protein, fat, carbs,
    preliminary: !s.heightCm, deficit: Math.round(tdee - kcal), expectedKgWeek: (tdee - kcal) * 7 / 7700, loggedDays: logged.length, current: cur, byDate
  };
}

export function weightAdvice(trend, today, settings) {
  const rate = weeklyRate(trend, today, 21);
  if (rate == null || !trend.length) return null;
  const cur = trend[trend.length - 1].trend;
  const pct = rate / cur * 100;
  if (pct < (settings.goalDate ? -1.4 : -1.0)) return { level: 'warn', text: `Снижение ${num(-rate, 2)} кг/нед (${num(-pct, 1)}%): быстрее безопасного. Добавь 150-200 ккал в день, сохрани белок.` };
  if (settings.goalWeightKg && cur > settings.goalWeightKg && pct > -0.15) {
    return { level: 'info', text: `Тренд почти не меняется 3 недели (${num(rate, 2)} кг/нед). Проверь точность записи питания или добавь 1500-2000 шагов в день до снижения калорий.` };
  }
  if (pct <= -0.25) return { level: 'good', text: `Тренд ${num(rate, 2)} кг/нед (${num(pct, 1)}%): устойчивый и безопасный темп.` };
  return null;
}

// ---------------------------------------------------------------------------
// Интервальное повторение (SM-2, 4 оценки)
// ---------------------------------------------------------------------------
export function srsReview(card, grade, today) {
  const c = { ef: 2.5, interval: 0, reps: 0, lapses: 0, ...card };
  if (grade === 0) { c.reps = 0; c.lapses++; c.ef = Math.max(1.3, c.ef - 0.2); c.interval = 0; }
  else if (grade === 1) { c.interval = Math.max(1, Math.round(Math.max(1, c.interval) * 1.2)); c.ef = Math.max(1.3, c.ef - 0.15); c.reps++; }
  else {
    if (c.reps === 0) c.interval = 1; else if (c.reps === 1) c.interval = 3; else c.interval = Math.round(c.interval * c.ef);
    if (grade === 3) { c.interval = Math.round(c.interval * 1.3) + 1; c.ef += 0.15; }
    c.reps++;
  }
  c.interval = Math.min(c.interval, 365);
  c.due = addDays(today, c.interval);
  c.lastReview = today;
  c.history = [...(card.history || []), { d: today, g: grade }].slice(-30);
  return c;
}
export function srsDue(cards, today) { return cards.filter(c => !c.suspended && (!c.due || c.due <= today)); }
export function retention(cards, today, days = 30) {
  const from = addDays(today, -days); let ok = 0, n = 0;
  for (const c of cards) for (const h of c.history || []) if (h.d >= from && (c.reps > 0 || h.g === 0)) { n++; if (h.g > 0) ok++; }
  return n >= 10 ? ok / n : null;
}

// ---------------------------------------------------------------------------
// Привычки
// ---------------------------------------------------------------------------
let EXCUSED = new Set();
/** Дни дежурств и после них: привычки в эти дни необязательны */
export function setExcusedDays(keys) { EXCUSED = new Set(keys); }
export function habitDueOn(h, k) {
  if (h.paused) return false;
  if (EXCUSED.has(k)) return false;
  if (h.createdAt && k < dkey(new Date(h.createdAt))) return false;
  const f = h.freq || { type: 'daily' };
  if (f.type === 'days') return (f.days || []).includes(weekday(k));
  return true; // daily и weekly (N раз в неделю) доступны каждый день
}
export function habitStats(h, logs, today) {
  const L = {}; for (const l of logs) if (l.habitId === h.id && !l.deleted) L[l.date] = l;
  const f = h.freq || { type: 'daily' };
  const done = k => L[k] && (L[k].status === 'done' || L[k].status === 'min');
  const created = h.createdAt ? dkey(new Date(h.createdAt)) : addDays(today, -60);
  const win = n => rangeKeys(today, n).filter(k => k >= created);
  const rate = n => {
    const ks = win(n); if (!ks.length) return null;
    if (f.type === 'weekly') {
      const weeks = Math.max(1, ks.length / 7);
      return clamp(ks.filter(done).length / (f.n * weeks), 0, 1);
    }
    const due = ks.filter(k => habitDueOn(h, k) && k !== today || (k === today && done(k)));
    return due.length ? due.filter(done).length / due.length : null;
  };
  // мягкая серия: подряд выполненные запланированные дни (сегодня не обрывает серию)
  let streak = 0;
  if (f.type === 'weekly') {
    let ws = weekStart(today);
    if (rangeKeys(addDays(ws, 6), 7).filter(k => k <= today).filter(done).length >= f.n) streak++;
    ws = addDays(ws, -7);
    while (ws >= addDays(created, -6)) {
      if (rangeKeys(addDays(ws, 6), 7).filter(done).length >= f.n) { streak++; ws = addDays(ws, -7); } else break;
    }
  } else {
    let k = done(today) ? today : addDays(today, -1);
    while (k >= created) {
      if (!habitDueOn(h, k)) { k = addDays(k, -1); continue; }
      if (done(k)) { streak++; k = addDays(k, -1); } else break;
    }
  }
  const weekDone = rangeKeys(today, weekday(today) + 1).filter(done).length;
  const y = addDays(today, -1);
  const missedYesterday = f.type !== 'weekly' && y >= created && habitDueOn(h, y) && !done(y);
  const dueToday = f.type === 'weekly' ? weekDone < f.n && !done(today) : habitDueOn(h, today) && !done(today);
  const ageDays = daysBetween(created, today);
  const r28 = rate(28), r14 = rate(14);
  let suggestion = null;
  const dismissed = h.dismissedAt && daysBetween(h.dismissedAt, today) < 14;
  if (dismissed) { /* пользователь отложил предложение */ }
  else if (ageDays >= 21 && r28 != null && r28 >= 0.85) suggestion = { type: 'up', text: 'Стабильно 85%+ за 4 недели: можно немного усложнить.' };
  else if (ageDays >= 14 && r14 != null && r14 < 0.4) suggestion = { type: 'down', text: 'Меньше 40% за 2 недели: упрости до минимальной версии или снизь частоту. Это не провал, а настройка.' };
  return { streak, r28, r14, weekDone, dueToday, doneToday: !!done(today), todayLog: L[today], missedYesterday, neverMissTwice: missedYesterday && dueToday, suggestion };
}

export const SKIP_REASONS = [
  { id: 'tired', label: 'Усталость' }, { id: 'time', label: 'Не было времени' }, { id: 'forgot', label: 'Забыл' },
  { id: 'duty', label: 'Дежурство / аврал' }, { id: 'sick', label: 'Болезнь' }, { id: 'motivation', label: 'Не хотелось' },
  { id: 'plan', label: 'Изменились планы' }, { id: 'other', label: 'Другое' }
];
export const REASON_ADVICE = {
  tired: 'Перенеси на утро или в первую половину вечера и держи минимальную версию на тяжёлые дни.',
  time: 'Цель не помещается в реальный вечер: уменьши объём или частоту, а не дави на себя.',
  forgot: 'Нужен якорь: привяжи к существующему действию («после ужина») и включи напоминание.',
  duty: 'Дежурства предсказуемы: отметь их в плане, привычка на эти дни автоматически становится необязательной.',
  sick: 'Болезнь: восстановление важнее. Возвращайся с минимальной версии.',
  motivation: 'Сделай вход легче: минимальная версия на 2 минуты, подготовь всё заранее.',
  plan: 'Внешние изменения: выбери запасной слот на эту привычку.',
  other: 'Посмотри на заметки к пропускам: там видно, что мешает.'
};

// ---------------------------------------------------------------------------
// Планировщик дня
// ---------------------------------------------------------------------------
export const CATS = {
  sleep: { label: 'Сон', color: 'var(--cat-sleep)' },
  work: { label: 'Работа', color: 'var(--cat-work)' },
  commute: { label: 'Дорога', color: 'var(--cat-commute)' },
  meal: { label: 'Еда', color: 'var(--cat-meal)' },
  chores: { label: 'Быт', color: 'var(--cat-chores)' },
  workout: { label: 'Движение', color: 'var(--cat-workout)' },
  study: { label: 'Обучение', color: 'var(--cat-study)' },
  project: { label: 'Проекты и задачи', color: 'var(--cat-project)' },
  leisure: { label: 'Отдых', color: 'var(--cat-leisure)' },
  social: { label: 'Люди', color: 'var(--cat-social)' },
  recovery: { label: 'Восстановление', color: 'var(--cat-recovery)' },
  routine: { label: 'Рутина', color: 'var(--cat-routine)' }
};

export function dayType(date, dayItem, settings) {
  if (dayItem?.type) return dayItem.type;
  return settings.weekendsOff && isWeekend(date) ? 'off' : 'work';
}

/** Сколько тренировок нужно и делать ли сегодня */
export function workoutDecision({ date, settings, workoutsByDay, mode, type }) {
  const ws = weekStart(date);
  const weekKeys = rangeKeys(addDays(ws, 6), 7);
  const doneBefore = weekKeys.filter(k => k < date && workoutsByDay[k]).length;
  const doneToday = !!workoutsByDay[date];
  const need = Math.max(0, settings.workoutsPerWeek - doneBefore - (doneToday ? 1 : 0));
  const daysLeft = weekKeys.filter(k => k >= date).length;
  const yesterday = !!workoutsByDay[addDays(date, -1)];
  let today = false, note = '';
  if (doneToday) { note = 'Тренировка сегодня уже есть.'; }
  else if (need === 0) { note = 'Цель недели по тренировкам выполнена: сегодня по желанию.'; }
  else if (type === 'duty' || type === 'postduty' || mode === 'mvd') { note = 'Сегодня вместо тренировки лёгкая прогулка. План недели пересчитан.'; }
  else if (need >= daysLeft) { today = true; note = 'Сегодня подходящий день для тренировки.'; }
  else if (!yesterday) { today = true; note = `Осталось ${need} из ${settings.workoutsPerWeek} на неделю.`; }
  else note = `Вчера была тренировка, сегодня восстановление. Осталось ${need} на неделю, дней ${daysLeft}.`;
  const unreachable = !doneToday && need > daysLeft;
  if (unreachable) note += ' Полную цель недели уже не догнать без перегруза: засчитаем то, что получится, двойных тренировок не будет.';
  return { today, need, daysLeft, note, doneThisWeek: doneBefore + (doneToday ? 1 : 0) };
}

/** Распределение учебной нагрузки на сегодня */
export function studyAllocation({ date, settings, studyByDay, studyByTrack, mode, type }) {
  const ws = weekStart(date);
  const weekKeys = rangeKeys(addDays(ws, 6), 7);
  const doneWeek = sum(weekKeys.filter(k => k < date).map(k => studyByDay[k] || 0));
  const doneToday = studyByDay[date] || 0;
  const remaining = Math.max(0, settings.studyWeeklyMin - doneWeek - doneToday);
  const studyDays = weekKeys.filter(k => k >= date && !(settings.restWeekend && isWeekend(k) && settings.weekendsOff)).length || 1;
  let quota = remaining / studyDays;
  const span = settings.focusSpanMin;
  const cap = { optimal: span * 2 + 10, normal: span, mvd: 0 }[mode] ?? span;
  if (type === 'duty' || type === 'postduty') quota = 0;
  quota = Math.round(clamp(quota, 0, cap));
  if (quota > 0 && quota < 15) quota = 15;
  // направление с наибольшим отставанием от своей доли
  const total = sum(settings.tracks.map(t => t.share)) || 1;
  let best = settings.tracks[0], bestGap = -Infinity;
  for (const t of settings.tracks) {
    const target = settings.studyWeeklyMin * t.share / total;
    const gap = target - (studyByTrack[t.id] || 0);
    if (gap > bestGap) { bestGap = gap; best = t; }
  }
  return { quota, remaining, doneWeek: doneWeek + doneToday, track: best, sessions: quota > span ? 2 : quota ? 1 : 0 };
}

const PRI = { must: 0, should: 1, could: 2 };
export function sortTasks(tasks, date) {
  return tasks.filter(t => !t.done && !t.deleted && (!t.start || t.start <= date))
    .sort((a, b) => ((PRI[a.priority] ?? 1) - (PRI[b.priority] ?? 1)) || (a.due || '9999').localeCompare(b.due || '9999') || (a.createdAt || 0) - (b.createdAt || 0));
}

/**
 * Строит реалистичный план дня.
 * ctx: { date, settings, mode, type, dayItem, tasks, workoutsByDay, studyByDay, studyByTrack, habitsDue, srsDueCount, leisurePlans }
 */
export function planDay(ctx) {
  const { date, settings: s, mode, type } = ctx;
  const blocks = [];
  const add = (start, len, title, cat, extra = {}) => {
    if (len <= 0) return start;
    blocks.push({ id: `${cat}_${start}`, start, end: start + len, title, cat, ...extra });
    return start + len;
  };
  const day = ctx.dayItem || {};
  const workEnd = parseHM(day.workEnd || s.workEnd);
  const workStart = parseHM(s.workStart);
  let bedtime = parseHM(s.bedtime); if (bedtime < 12 * 60) bedtime += 1440;
  if (mode === 'mvd') bedtime -= 30;
  const wake = parseHM(s.wake);
  const sortedTasks = sortTasks(ctx.tasks || [], date);
  const due = t => t.due && t.due <= date;
  const must = sortedTasks.filter(t => t.priority === 'must' || due(t));
  const should = sortedTasks.filter(t => !must.includes(t) && t.priority === 'should');
  const could = sortedTasks.filter(t => !must.includes(t) && !should.includes(t));
  const wo = workoutDecision({ ...ctx, settings: s });
  const st = studyAllocation({ ...ctx, settings: s });
  const notes = [];

  if (type === 'duty') {
    add(wake, workStart - s.commuteMin - wake, 'Подъём, завтрак, сборы', 'routine');
    add(workStart - s.commuteMin, s.commuteMin, 'Дорога', 'commute');
    add(workStart, 1440 - workStart + workStart, 'Дежурство', 'work', { fixed: true });
    notes.push('Дежурство: план свободного времени отключён. Вода, еда по возможности, привычки необязательны.');
    return finalize();
  }
  if (type === 'postduty') {
    let t = parseHM('08:00');
    t = add(t, 30, 'Дорога домой, лёгкий завтрак', 'routine');
    t = add(t, 210, 'Восстановительный сон', 'sleep', { track: true });
    t = add(t + 30, 30, 'Обед', 'meal');
    t = add(t, 25, 'Лёгкая прогулка на свету', 'workout', { track: true, optional: true });
    const mustTop = must.slice(0, 1);
    if (mustTop.length) t = add(t + 15, 20, 'Только самое важное', 'project', { tasks: mustTop.map(x => x.id), track: true });
    const eve = parseHM('18:30');
    t = add(Math.max(t, eve - 60), 60, 'Отдых без обязательств', 'leisure');
    t = add(t, s.dinnerMin, 'Ужин', 'meal');
    t = add(t, Math.max(0, bedtime - s.windDownMin - t), 'Спокойный вечер', 'leisure');
    add(bedtime - s.windDownMin, s.windDownMin, 'Подготовка ко сну', 'recovery');
    notes.push('После дежурства задача дня одна: восстановиться. Учёба и тренировка переносятся без долга.');
    return finalize();
  }

  if (type === 'off') {
    const offWake = wake + 75;
    let t = add(offWake, 45, 'Неспешное утро, завтрак', 'routine');
    const restDay = s.restWeekend;
    if (wo.today && mode !== 'mvd') t = add(t + 15, s.workoutMin + 15, ctx.workoutSession?.title || 'Тренировка', 'workout', { track: true, session: ctx.workoutSession?.letter });
    else t = add(t + 15, 45, 'Долгая прогулка', 'workout', { track: true, optional: true });
    if (!restDay && st.quota > 0) t = add(t + 15, Math.min(st.quota, s.focusSpanMin), ctx.nextTopic ? `Учёба: ${ctx.nextTopic.title}` : `Учёба: ${st.track.name}`, 'study', { track: true, studyTrack: ctx.nextTopic?.track || st.track.id, topicId: ctx.nextTopic?.id, optional: true });
    if (must.length) t = add(t + 15, 30, 'Обязательные дела', 'project', { tasks: must.slice(0, 2).map(x => x.id), track: true });
    t = add(Math.max(t, 13 * 60), 45, 'Обед', 'meal');
    t = add(t, 60, 'Быт, покупки', 'chores', { optional: true });
    const leisure = (ctx.leisurePlans || [])[0];
    t = add(t + 15, 180, leisure ? leisure.title : 'Свободное время: люди, хобби, развлечения', leisure?.cat === 'social' ? 'social' : 'leisure');
    t = add(Math.max(t, 19 * 60), 45, 'Ужин', 'meal');
    t = add(t, Math.max(0, bedtime - s.windDownMin - t), 'Вечер для себя', 'leisure');
    add(bedtime - s.windDownMin, s.windDownMin, 'Подготовка ко сну', 'recovery');
    if (restDay) notes.push('Выходной без обязательной продуктивности. Учёба по желанию, долгов нет.');
    if (wo.note) notes.push(wo.note);
    return finalize();
  }

  // ---- обычный рабочий день ----
  const leave = workStart - s.commuteMin;
  let t = wake;
  const morning = leave - wake;
  t = add(t, Math.min(morning, 35), 'Подъём, вода, завтрак', 'routine');
  if (mode === 'optimal' && ctx.srsDueCount > 0 && leave - t >= 10) t = add(t, Math.min(10, leave - t), `Карточки (${ctx.srsDueCount})`, 'study', { track: true, optional: true, srs: true });
  if (leave - t > 0) add(t, leave - t, 'Сборы', 'routine');
  add(leave, s.commuteMin, 'Дорога', 'commute');
  add(workStart, workEnd - workStart, 'Работа', 'work', { fixed: true });
  t = add(workEnd, s.commuteMin, 'Дорога домой', 'commute');

  let windStart = bedtime - s.windDownMin;
  if (windStart < t + 25) { windStart = t + 25; if (bedtime - windStart < 10) bedtime = windStart + 10; }
  const fixed = [
    { len: s.decompressMin, title: 'Переключение: душ, тишина, без экрана', cat: 'recovery' },
    { len: s.dinnerMin, title: 'Ужин', cat: 'meal' },
    { len: s.choresMin, title: 'Быт: кухня, вещи на завтра', cat: 'chores' }
  ];
  const leisureMin = mode === 'mvd' ? s.leisureMinDaily + 30 : s.leisureMinDaily;
  // очень поздний вечер: сжимаем быт и переключение, ужин не короче 25 минут
  let spare = windStart - t - sum(fixed.map(f => f.len)) - 30;
  for (const [i, minLen] of [[2, 0], [0, 0], [1, 25]]) { if (spare >= 0) break; const cut = Math.min(fixed[i].len - minLen, -spare); fixed[i].len -= cut; spare += cut; }
  const veryLate = spare < 0;
  if (veryLate) notes.push('Поздний вечер: только ужин и сон. Всё остальное переносится без долга.');
  const avail = windStart - t - sum(fixed.map(f => f.len));
  let budget = avail - leisureMin;
  const deep = must.concat(should).filter(x => x.energy === 'deep');
  const light = must.concat(should).filter(x => x.energy !== 'deep');
  const span = s.focusSpanMin;
  // кандидаты в порядке приоритета для режима дня; вечером помещается одно главное дело
  const cand = [];
  const workoutLen = mode === 'optimal' ? s.workoutMin + 10 : Math.min(s.workoutMin, 30) + 10;
  const studyFirst = Math.min(st.quota, span);
  if (mode === 'mvd') {
    if (must.length) cand.push({ len: 15, title: 'Минимум: одно главное дело', cat: 'project', track: true, tasks: must.slice(0, 1).map(x => x.id), key: 'tasks', force: !veryLate });
    cand.push({ len: 15, title: 'Короткая прогулка', cat: 'workout', track: true, optional: true, key: 'walk' });
  } else {
    if (must.length) cand.push({ len: 20, title: 'Обязательные дела', cat: 'project', track: true, tasks: must.slice(0, 3).map(x => x.id), key: 'tasks', force: !veryLate });
    const ses = ctx.workoutSession;
    if (wo.today) cand.push({ len: workoutLen, title: ses ? (mode === 'optimal' ? ses.title : ses.title + ' (короткая)') : (mode === 'optimal' ? 'Тренировка' : 'Короткая тренировка'), cat: 'workout', track: true, key: 'workout', main: true, session: ses?.letter });
    const tp = ctx.nextTopic;
    if (studyFirst > 0) cand.push({ len: studyFirst, title: tp ? `${tp.track === 'usmle' ? 'USMLE' : 'Учёба'}: ${tp.title}` : `Учёба: ${st.track.name}`, cat: 'study', track: true, studyTrack: tp?.track || st.track.id, topicId: tp?.id, key: 'study1', main: !wo.today });
    const lightRest = light.filter(x => !must.includes(x));
    if (lightRest.length) cand.push({ len: 15, title: 'Быстрые дела', cat: 'project', track: true, tasks: lightRest.slice(0, 3).map(x => x.id), key: 'light', optional: true });
    if (mode === 'optimal' && st.quota - studyFirst >= 15) cand.push({ len: Math.min(st.quota - studyFirst, span), title: 'Учёба: повторение и Active Recall', cat: 'study', track: true, studyTrack: st.track.id, key: 'study2', optional: true });
    if (mode === 'optimal' && deep.length) cand.push({ len: span, title: 'Проект / задача с концентрацией', cat: 'project', track: true, tasks: deep.slice(0, 1).map(x => x.id), key: 'deep', optional: true });
    if (!wo.today) cand.push({ len: 20, title: 'Прогулка', cat: 'workout', track: true, optional: true, key: 'walk' });
  }
  const chosen = [], dropped = [];
  for (const c of cand) {
    if (c.len <= budget || c.force) { chosen.push(c); budget -= c.len; }
    else if (c.key === 'workout' && budget >= 25) { chosen.push({ ...c, len: 25, title: 'Короткая тренировка' }); budget -= 25; }
    else if (c.key === 'study1' && budget >= 15) { chosen.push({ ...c, len: Math.min(budget, c.len) }); budget -= Math.min(budget, c.len); }
    else if (!c.optional) dropped.push(c);
  }
  // порядок вечера: переключение, движение до ужина, ужин, умственная работа, быт, отдых
  const seq = [fixed[0], ...chosen.filter(c => c.cat === 'workout'), fixed[1], ...chosen.filter(c => c.cat === 'study' || c.key === 'study2'), ...chosen.filter(c => c.cat === 'project'), fixed[2]];
  for (const p of seq) { const { len, title, cat, main, force, ...rest } = p; t = add(t, Math.min(len, Math.max(0, windStart - t)), title, cat, rest); }
  if (windStart - t > 0) add(t, windStart - t, 'Свободное время', 'leisure', { leisure: true });
  add(windStart, bedtime - windStart, 'Подготовка ко сну: свет ниже, экран в сторону', 'recovery');
  const dk = veryLate ? [] : dropped.map(d => d.key);
  if (dk.includes('study1') && dk.includes('workout')) notes.push('Вечер короткий: остаются еда, быт и отдых. Учёба и тренировка переносятся без долга.');
  else if (dk.includes('study1') && wo.today) notes.push('Сегодня вечер под тренировку, учёба переносится на день без неё. Это не долг: неделя пересчитывается.');
  else if (dk.includes('study1')) notes.push('Вечер короткий: учёба не помещается без потери отдыха и переносится.');
  else if (dk.includes('workout')) notes.push('Вечер короткий: вместо тренировки прогулка, неделя пересчитается.');
  const mustMin = sum(must.map(x => x.estimate || 20));
  if (must.length > 1 && mustMin > 40) notes.push(`Обязательных задач на ≈${dur(mustMin)}, а в вечер помещается 20 минут. Выбери главную, остальные перенеси или делегируй.`);
  if (wo.note && !dropped.some(d => d.key === 'workout') && !(wo.today && !chosen.some(c => c.key === 'workout'))) notes.push(wo.note);
  if (st.quota > 0 && mode !== 'mvd' && chosen.some(c => c.cat === 'study')) notes.push(`Учёба: ${dur(sum(chosen.filter(c => c.cat === 'study').map(c => c.len)))} сегодня, неделя ${dur(st.doneWeek)} из ${dur(s.studyWeeklyMin)}.`);
  if (mode === 'mvd') notes.unshift('Минимальный день: работа, еда, движение по силам, сон. Остальное переносится без чувства вины.');
  return finalize();

  function finalize() {
    if (type !== 'duty') blocks.push({ id: 'sleep_end', start: bedtime, end: bedtime + s.sleepTargetH * 60, title: 'Сон', cat: 'sleep', fixed: true });
    blocks.sort((a, b) => a.start - b.start);
    const assigned = new Set(blocks.flatMap(b => b.tasks || []));
    return {
      date, mode, type, blocks, notes,
      tasks: { must, should, could, unassigned: sortedTasks.filter(x => !assigned.has(x.id)) },
      workout: wo, study: st, bedtime, leave: type === 'work' || type === 'duty' ? parseHM(s.workStart) - s.commuteMin : null
    };
  }
}

export function planCompletion(plan, state) {
  const tracked = plan.blocks.filter(b => b.track && !b.optional);
  if (!tracked.length) return null;
  const done = tracked.filter(b => state?.done?.[b.id]).length;
  return done / tracked.length;
}

// ---------------------------------------------------------------------------
// Время: куда оно уходит
// ---------------------------------------------------------------------------
export function timeAllocation({ date, settings, nights, type, studyMin, workoutMin, leisureByCat, socialMin }) {
  const s = settings;
  const out = {};
  out.sleep = nights[date]?.asleepMin ?? null;
  if (type === 'work') {
    out.work = parseHM(s.workEnd) - parseHM(s.workStart);
    out.commute = s.commuteMin * 2;
  } else if (type === 'duty') out.work = 1440 - parseHM(s.workStart);
  else { out.work = 0; out.commute = 0; }
  out.study = studyMin || 0;
  out.workout = workoutMin || 0;
  out.leisure = sum(Object.entries(leisureByCat || {}).filter(([k]) => k !== 'social').map(([, v]) => v));
  out.social = socialMin || 0;
  const tracked = sum(Object.values(out).map(v => v || 0));
  out.untracked = Math.max(0, 1440 - tracked);
  return out;
}

/** Реальная ёмкость недели для учёбы и тренировок (минуты), по той же модели, что и планировщик */
export function weekCapacity(s) {
  let bed = parseHM(s.bedtime); if (bed < 720) bed += 1440;
  const home = parseHM(s.workEnd) + s.commuteMin;
  const perEvening = Math.max(0, bed - s.windDownMin - home - s.decompressMin - s.dinnerMin - s.choresMin - s.leisureMinDaily);
  const workdays = s.weekendsOff ? 5 : 7;
  const weekday = perEvening * workdays;
  const weekend = s.weekendsOff ? (s.restWeekend ? 2 * (s.workoutMin + 10) : 2 * 180) : 0;
  return { perEvening, weekday, weekend, total: weekday + weekend };
}

// ---------------------------------------------------------------------------
// Аналитические выводы для ассистента
// ---------------------------------------------------------------------------
export function insights(D) {
  const { today, settings: s, nights, daily, trend, habits, habitLogs, completionByDay, studyByDay, leisureLogs, tasks, cards, skipReasons, readinessByDay } = D;
  const out = [];
  const keys60 = rangeKeys(addDays(today, -1), 60);

  // Сон и продуктивность
  const sleepH = keys60.map(k => nights[k] ? nights[k].asleepMin / 60 : null);
  const comp = keys60.map(k => completionByDay[k] ?? null);
  const c1 = pearson(sleepH, comp);
  if (c1 && Math.abs(c1.r) >= 0.3) {
    const good = keys60.filter((k, i) => sleepH[i] >= s.sleepTargetH - 0.5 && comp[i] != null);
    const bad = keys60.filter((k, i) => sleepH[i] != null && sleepH[i] < s.sleepTargetH - 1 && comp[i] != null);
    const gm = mean(good.map(k => completionByDay[k])), bm = mean(bad.map(k => completionByDay[k]));
    out.push({ id: 'sleep-prod', level: 'info', area: 'Сон', title: 'Сон заметно влияет на выполнение плана',
      text: `Связь r = ${num(c1.r, 2)} по ${c1.n} дням.${gm != null && bm != null ? ` После сна ближе к цели выполняется ${Math.round(gm * 100)}% плана, после короткого сна ${Math.round(bm * 100)}%.` : ''} Это наблюдение по твоим данным, а не доказательство причины.` });
  }
  const study = keys60.map(k => studyByDay[k] ?? 0);
  const c2 = pearson(sleepH, study);
  if (c2 && c2.r >= 0.3) out.push({ id: 'sleep-study', level: 'info', area: 'Сон', title: 'В выспавшиеся дни ты учишься больше', text: `r = ${num(c2.r, 2)} по ${c2.n} дням. Защищать время сна выгоднее, чем выкраивать учёбу за его счёт.` });

  const ss = sleepStats(nights, addDays(today, 0), 7);
  if (ss.nights >= 4 && ss.avgMin < (s.sleepTargetH - 0.75) * 60) {
    out.push({ id: 'sleep-short', level: 'warn', area: 'Сон', title: `Средний сон за неделю ${dur(ss.avgMin)}`,
      text: `Это меньше цели ${s.sleepTargetH} ч. Предложение: отбой на 30 минут раньше (${hm(parseHM(s.bedtime) - 30)}) в будние дни на 2 недели, затем посмотреть на индекс готовности.`, action: { type: 'bedtime', value: hm(parseHM(s.bedtime) - 30) } });
  }
  const ss14 = sleepStats(nights, today, 14);
  if (ss14.bedSdMin != null && ss14.bedSdMin > 60) {
    out.push({ id: 'sleep-reg', level: 'info', area: 'Сон', title: 'Нерегулярное время отхода ко сну', text: `Разброс около ${Math.round(ss14.bedSdMin)} мин за 2 недели. Регулярность часто важнее длительности: держи отбой в окне ±30 мин, включая выходные.` });
  }

  // Восстановление: устойчивые изменения, а не одно измерение
  const last7 = rangeKeys(today, 7), base = rangeKeys(addDays(today, -7), 28);
  const hrv7 = last7.map(k => daily[k]?.hrv).filter(v => v != null), hrvB = base.map(k => daily[k]?.hrv).filter(v => v != null);
  const rhr7 = last7.map(k => daily[k]?.resting_hr).filter(v => v != null), rhrB = base.map(k => daily[k]?.resting_hr).filter(v => v != null);
  if (hrv7.length >= 5 && hrvB.length >= 14 && rhr7.length >= 5 && rhrB.length >= 14) {
    const dh = mean(hrv7) / median(hrvB) - 1, dr = mean(rhr7) - median(rhrB);
    if (dh < -0.15 && dr >= 3) out.push({ id: 'recovery', level: 'warn', area: 'Восстановление', title: 'Неделя с признаками накопленной нагрузки',
      text: `HRV в среднем на ${Math.round(-dh * 100)}% ниже твоей базы, пульс покоя выше на ${Math.round(dr)} уд/мин, 5+ дней подряд. Это расчётный сигнал носимого устройства, не диагноз. Разумно: 2-3 дня без интенсивных тренировок, больше сна. Если есть симптомы или изменения держатся, это повод обратиться к врачу.` });
    else if (dh > 0.08 && dr <= 0) out.push({ id: 'recovery-good', level: 'good', area: 'Восстановление', title: 'Восстановление выше обычного', text: `HRV выше базы на ${Math.round(dh * 100)}%, пульс покоя не растёт. Хорошее окно, чтобы чуть поднять нагрузку тренировок.` });
  }
  const lowDays = rangeKeys(today, 4).filter(k => readinessByDay[k] != null && readinessByDay[k] < 50).length;
  if (lowDays >= 3) out.push({ id: 'overload', level: 'warn', area: 'Нагрузка', title: '3 из 4 последних дней с низкой готовностью', text: 'Предлагаю восстановительный день: Minimum Viable Day, прогулка вместо тренировки, отбой на 45 минут раньше.', action: { type: 'mode', value: 'mvd' } });

  // Вес
  const wa = weightAdvice(trend, today, s);
  if (wa) out.push({ id: 'weight', level: wa.level, area: 'Вес', title: 'Темп снижения веса', text: wa.text });

  // Привычки
  for (const h of habits) {
    const st = habitStats(h, habitLogs, today);
    if (st.suggestion?.type === 'down') out.push({ id: 'h-down-' + h.id, level: 'info', area: 'Привычки', title: `«${h.name}» сейчас не держится`, text: st.suggestion.text + (h.minimal ? ` Минимальная версия: «${h.minimal}».` : ''), action: { type: 'habit-min', id: h.id } });
    if (st.suggestion?.type === 'up') out.push({ id: 'h-up-' + h.id, level: 'good', area: 'Привычки', title: `«${h.name}» стала устойчивой`, text: st.suggestion.text, action: { type: 'habit-up', id: h.id } });
  }
  if (skipReasons.length >= 4) {
    const cnt = {}; for (const r of skipReasons) cnt[r] = (cnt[r] || 0) + 1;
    const [top, n] = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (n / skipReasons.length >= 0.4) out.push({ id: 'skip-reason', level: 'info', area: 'Пропуски', title: `Главная причина пропусков: ${(SKIP_REASONS.find(x => x.id === top) || {}).label?.toLowerCase()}`, text: `${n} из ${skipReasons.length} за 4 недели. ${REASON_ADVICE[top]}` });
  }

  // Конфликт целей с реальной ёмкостью недели
  const cap = weekCapacity(s);
  const demand = s.studyWeeklyMin + s.workoutsPerWeek * (s.workoutMin + 10);
  if (demand > cap.total + 15) {
    out.push({ id: 'conflict', level: 'warn', area: 'Цели', title: 'Цели не помещаются в реальную неделю',
      text: `Учёба ${dur(s.studyWeeklyMin)} и ${s.workoutsPerWeek} тренировки по ${s.workoutMin} мин требуют ≈${dur(demand)} в неделю. При работе ${s.workStart}-${s.workEnd}, отбое ${s.bedtime} и минимуме отдыха ${dur(s.leisureMinDaily)} в будни свободно ≈${dur(cap.weekday)} в будние вечера${cap.weekend ? ` и ≈${dur(cap.weekend)} в выходные` : ''}. Варианты: учебная цель ${dur(Math.max(60, s.studyWeeklyMin - (demand - cap.total)))}, или ${Math.max(1, s.workoutsPerWeek - 1)} тренировки, или разрешить учёбу в выходные.` });
  }
  const weekEnd = addDays(today, 6 - weekday(today));
  const mustWeek = tasks.filter(t => !t.done && !t.deleted && t.priority === 'must' && t.due && t.due <= weekEnd);
  const mustMin = sum(mustWeek.map(t => t.estimate || 30));
  if (mustMin > 300) out.push({ id: 'tasks-over', level: 'warn', area: 'Задачи', title: 'Слишком много обязательных задач на неделю', text: `${mustWeek.length} задач на ≈${dur(mustMin)}. Реально в будние вечера помещается около 2-3 часов задач. Пересмотри приоритеты: что можно делегировать, перенести или сделать «достаточно хорошо»?` });

  // Анти-прокрастинация: задачи, которые откладываются
  const stuck = tasks.filter(t => !t.done && !t.deleted && ((t.due && t.due <= addDays(today, -3)) || (t.moved || 0) >= 3));
  if (stuck.length) out.push({ id: 'stuck', level: 'info', area: 'Задачи', title: `Откладывается: ${stuck.slice(0, 2).map(t => '«' + t.title + '»').join(', ')}${stuck.length > 2 ? ' и ещё ' + (stuck.length - 2) : ''}`,
    text: 'Так бывает, когда неясен первый шаг или задача слишком большая. Проверь: она ещё актуальна? Если да, задай первый шаг на 2-5 минут (в карточке задачи) и поставь на конкретный вечер. Если нет, удали без сожаления.' });

  // Учёба
  const wk = rangeKeys(today, weekday(today) + 1);
  const studied = sum(wk.map(k => studyByDay[k] || 0));
  const expected = s.studyWeeklyMin * (weekday(today) + 1) / 7;
  if (weekday(today) >= 3 && studied < expected * 0.5) out.push({ id: 'study-behind', level: 'info', area: 'Обучение', title: `Учёба: ${dur(studied)} из ${dur(s.studyWeeklyMin)} за неделю`, text: 'Отставание не нужно догонять за один вечер: планировщик равномерно распределит остаток по оставшимся дням с учётом готовности.' });
  const dueCards = srsDue(cards, today).length;
  if (dueCards > 150) out.push({ id: 'srs-backlog', level: 'info', area: 'Обучение', title: `${dueCards} карточек к повторению`, text: 'Поставь паузу на новые карточки на 3-4 дня, пока очередь не уменьшится до 50-80. Повторения дают больше, чем новые.' });

  // Отдых
  const lw = leisureLogs.filter(l => l.date >= addDays(today, -6));
  const totalL = sum(lw.map(l => l.minutes || 0)), passive = sum(lw.filter(l => l.cat === 'scroll').map(l => l.minutes || 0));
  if (totalL >= 120 && passive / totalL > 0.4) out.push({ id: 'passive', level: 'info', area: 'Отдых', title: 'Большая часть отдыха ушла в скроллинг', text: `${dur(passive)} из ${dur(totalL)} за неделю. Отдых не нужно урезать, только сделать полноценнее: выбери на вечер одно конкретное занятие из списка (фильм, игра, книга, встреча).` });
  const fun = lw.filter(l => l.cat !== 'scroll');
  if (lw.length === 0 && Object.keys(completionByDay).filter(k => k >= addDays(today, -6)).length >= 5) out.push({ id: 'no-rest', level: 'info', area: 'Отдых', title: 'Нет записей об отдыхе за неделю', text: 'Если отдых был, отметь его: он входит в систему наравне с учёбой. Если не было, запланируй на выходные одно приятное дело и одну встречу.' });
  else if (fun.length >= 3) out.push({ id: 'rest-good', level: 'good', area: 'Отдых', title: 'Отдых был осознанным', text: `${fun.length} записей полноценного отдыха за неделю.` });

  const order = { warn: 0, info: 1, good: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

export function weekSummary(D, ws) {
  const keys = rangeKeys(addDays(ws, 6), 7).filter(k => k <= D.today);
  const sleep = mean(keys.map(k => D.nights[k]?.asleepMin));
  const steps = mean(keys.map(k => D.daily[k]?.steps));
  const studyMin = sum(keys.map(k => D.studyByDay[k] || 0));
  const studyTracks = {};
  for (const x of D.studySessions.filter(x => x.date >= ws && x.date <= addDays(ws, 6))) studyTracks[x.track] = (studyTracks[x.track] || 0) + x.minutes;
  const workouts = keys.filter(k => D.workoutsByDay[k]).length;
  const tasksDone = D.tasks.filter(t => t.done && t.doneAt && dkey(new Date(t.doneAt)) >= ws && dkey(new Date(t.doneAt)) <= addDays(ws, 6)).length;
  const comp = mean(keys.map(k => D.completionByDay[k]));
  const leisure = sum(D.leisureLogs.filter(l => l.date >= ws && l.date <= addDays(ws, 6)).map(l => l.minutes || 0));
  const tA = D.trend.filter(x => x.date < ws).pop(), tB = D.trend.filter(x => x.date <= addDays(ws, 6)).pop();
  const hr = D.habits.map(h => habitStats(h, D.habitLogs, addDays(ws, 6) <= D.today ? addDays(ws, 6) : D.today).r14).filter(v => v != null);
  return { ws, days: keys.length, sleep, steps, studyMin, studyTracks, workouts, tasksDone, comp, leisure,
    weightDelta: tA && tB && tA !== tB ? tB.trend - tA.trend : null, weight: tB?.trend, habitRate: mean(hr) };
}

// ---------------------------------------------------------------------------
// Сценарий дня (7 типов) и протокол возвращения после пропусков
// ---------------------------------------------------------------------------
export function scenarioName(plan, dayItem) {
  if (plan.type === 'off') return 'Выходной';
  if (plan.type === 'duty') return 'Дежурство';
  if (plan.type === 'postduty' || dayItem?.mode === 'mvd' && dayItem?.recovery) return 'День восстановления';
  if (plan.mode === 'mvd') return 'День низкой энергии';
  if (dayItem?.workload === 'heavy') return 'Интенсивный рабочий день';
  if (plan.blocks.some(b => b.cat === 'workout' && !b.optional)) return 'Тренировочный день';
  if (plan.blocks.filter(b => b.cat === 'study').length >= 2) return 'Учебный день';
  return 'Стандартный рабочий день';
}

/** activeDays: множество дат с любой активностью. Пропуск 1 дня: план обычный; 3-6 дней: облегчённая переоценка
 *  на 3 дня; 7+ дней: неделя мягкого возвращения. Долги не накапливаются. */
export function recoveryState(activeDays, today) {
  const first = [...activeDays].sort()[0];
  if (!first) return { kind: 'none', gap: 0, factor: 1 };
  const keys = rangeKeys(addDays(today, -1), 28).reverse().filter(k => k >= first); // от вчера назад, не раньше первого дня
  let gap = 0, i = 0;
  // ищем последний период неактивности, после которого была активность (или который длится до сегодня)
  while (i < keys.length && activeDays.has(keys[i])) i++;
  const daysSinceReturn = i; // сколько дней подряд активен до вчера
  let j = i; while (j < keys.length && !activeDays.has(keys[j])) j++;
  gap = j - i;
  if (gap >= 7 && daysSinceReturn < 7) return { kind: 'return', gap, factor: 0.5, dayOf: daysSinceReturn + 1, text: `Сценарий возвращения: день ${daysSinceReturn + 1} из 7. Нагрузка вдвое меньше обычной, долгов нет. Главное: ритм сна, шаги и одно дело в день.` };
  if (gap >= 3 && daysSinceReturn < 3) return { kind: 'reassess', gap, factor: 0.7, text: `Перерыв ${gap} дн. Ближайшие 3 дня нагрузка снижена на 30%, всё пропущенное просто отпускаем.` };
  return { kind: 'none', gap, factor: 1 };
}
