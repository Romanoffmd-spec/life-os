// Сборка производных данных из хранилища для всех экранов (пересчитывается при изменениях).
import * as store from './store.js';
import * as E from './engine.js';
import { dkey, addDays, rangeKeys, sum, weekStart, daysBetween, parseHM, hm } from './util.js';
import { session as trainingSession } from './content/training.js';
import { buildMenu } from './content/nutrition.js';

let cached = null, cachedVer = -1, forced = false;
export function invalidate() { forced = true; }

export function settings() {
  const s = store.get('settings');
  const merged = { ...E.DEFAULT_SETTINGS, ...(s || {}) };
  if (!Array.isArray(merged.tracks) || !merged.tracks.length) merged.tracks = E.DEFAULT_SETTINGS.tracks;
  return merged;
}
export function saveSettings(fields) {
  const cur = store.get('settings') || {};
  const { id, kind, updatedAt, dirty: _d, deleted, createdAt, ...rest } = { ...cur, ...fields };
  store.put('settings', { ...rest, id: 'settings' });
}

export function build(today = dkey()) {
  if (!forced && cached && cached.today === today && cachedVer === store.ver()) return cached;
  forced = false; cachedVer = store.ver();
  const s = settings();
  const samples = store.healthSamples();
  const daily = E.dailyHealth(samples);
  const nights = E.mergeSleep(E.sleepNights(samples), E.manualSleep(store.all('sleeplog')));

  // вес: Health + ручные (ручная запись приоритетнее в тот же день)
  const wmap = {};
  for (const [k, d] of Object.entries(daily)) if (d.weight) wmap[k] = { date: k, kg: d.weight, src: 'health' };
  for (const w of store.all('weight')) if (w.kg) wmap[w.date] = { date: w.date, kg: +w.kg, src: 'manual', id: w.id };
  const weights = Object.values(wmap);
  const trend = E.weightTrend(weights);

  const foodByDay = {};
  for (const f of store.all('food')) {
    const d = foodByDay[f.date] || (foodByDay[f.date] = { kcal: 0, p: 0, f: 0, c: 0, items: [] });
    d.kcal += +f.kcal || 0; d.p += +f.p || 0; d.f += +f.f || 0; d.c += +f.c || 0; d.items.push(f);
  }
  const waterByDay = {};
  for (const w of store.all('water')) waterByDay[w.date] = (waterByDay[w.date] || 0) + (+w.ml || 0);

  const workouts = store.all('workout');
  const workoutsByDay = {}, workoutMinByDay = {};
  for (const w of workouts) { workoutsByDay[w.date] = true; workoutMinByDay[w.date] = (workoutMinByDay[w.date] || 0) + (+w.minutes || 0); }
  for (const smp of samples.filter(x => x.type === 'workout')) {
    const k = dkey(new Date(smp.start_at)); workoutsByDay[k] = true;
    if (!workouts.some(w => w.date === k)) workoutMinByDay[k] = (workoutMinByDay[k] || 0) + (smp.value || (new Date(smp.end_at) - new Date(smp.start_at)) / 60000);
  }
  for (const [k, d] of Object.entries(daily)) if ((d.exercise_min || 0) >= 30 && !workoutsByDay[k]) { workoutsByDay[k] = 'health'; workoutMinByDay[k] = d.exercise_min; }

  const studySessions = store.all('study');
  const studyByDay = {};
  for (const x of studySessions) studyByDay[x.date] = (studyByDay[x.date] || 0) + (+x.minutes || 0);
  const ws = weekStart(today);
  const studyByTrack = {};
  for (const x of studySessions.filter(x => x.date >= ws && x.date <= today)) studyByTrack[x.track] = (studyByTrack[x.track] || 0) + (+x.minutes || 0);

  const tasks = store.all('task');
  const habits = store.all('habit').sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt));
  const habitLogs = store.all('habitlog');
  const cards = store.all('card');
  const leisureLogs = store.all('leisure');
  const checkins = Object.fromEntries(store.all('checkin').map(c => [c.date, c]));
  const days = Object.fromEntries(store.all('day').map(d => [d.date, d]));
  E.setExcusedDays(Object.values(days).filter(d => d.type === 'duty' || d.type === 'postduty').map(d => d.date));

  // программа обучения и тренировок
  const topics = store.all('topic').sort((a, b) => a.order - b.order);
  const nextTopic = topics.find(t => !t.done) || null;
  const programStart = s.programStart || today;
  const programWeek = Math.min(12, Math.floor(Math.max(0, daysBetween(programStart, today)) / 7) + 1);
  const doneSessions = workouts.filter(w => w.date >= programStart && w.session).length;
  const nextLetter = 'ABC'[doneSessions % 3];
  const workoutSession = trainingSession(nextLetter, programWeek, s.trainPlace || 'gym');

  // протокол возвращения: активность по дням
  const activeDays = new Set();
  for (const [k] of Object.entries(Object.fromEntries(store.all('planstate').filter(x => Object.keys(x.done || {}).length).map(x => [x.date, 1])))) activeDays.add(k);
  for (const l of habitLogs) if (l.status !== 'skip') activeDays.add(l.date);
  for (const x of [...studySessions, ...workouts, ...store.all('food'), ...store.all('checkin')]) if (x.date) activeDays.add(x.date);
  for (const t of tasks) if (t.doneAt) activeDays.add(dkey(new Date(t.doneAt)));
  const recovery = E.recoveryState(activeDays, today);
  const sPlan = recovery.factor < 1 ? { ...s, studyWeeklyMin: Math.round(s.studyWeeklyMin * recovery.factor), workoutsPerWeek: Math.max(1, Math.round(s.workoutsPerWeek * recovery.factor)) } : s;

  // план и выполнение по дням (последние 60 дней + сегодня)
  const completionByDay = {}, readinessByDay = {};
  const planFor = k => {
    const dayItem = days[k];
    const type = E.dayType(k, dayItem, s);
    const rd = E.readiness({ date: k, settings: s, nights, daily, checkin: checkins[k], dayInfo: { ...dayItem, type } });
    let mode = dayItem?.mode || rd.mode;
    if (k === today && recovery.kind === 'return' && !dayItem?.mode && mode === 'optimal') mode = 'normal';
    const plan = E.planDay({
      date: k, settings: k >= addDays(today, -1) ? sPlan : s, mode, type, dayItem, tasks, workoutsByDay, studyByDay,
      nextTopic: k >= today ? nextTopic : null, workoutSession: k >= today ? workoutSession : null,
      studyByTrack: k === today ? studyByTrack : {}, srsDueCount: k === today ? E.srsDue(cards, today).length : 0,
      leisurePlans: store.all('fun').filter(f => f.status === 'planned' && f.date === k)
    });
    return { rd, plan, type, mode };
  };
  for (const k of rangeKeys(today, 61)) {
    const st = store.get('ps_' + k);
    const has = st || checkins[k] || nights[k];
    if (!has) continue;
    const { rd, plan } = planFor(k);
    if (rd.score != null) readinessByDay[k] = rd.score;
    if (st) { const c = E.planCompletion(plan, st); if (c != null) completionByDay[k] = c; }
  }
  const T = planFor(today);
  readinessByDay[today] = T.rd.score;

  const skipReasons = habitLogs.filter(l => l.status === 'skip' && l.reason && l.date >= addDays(today, -28)).map(l => l.reason);

  const D = {
    today, settings: s, samples, daily, nights, weights, trend, foodByDay, waterByDay, workouts, workoutsByDay, workoutMinByDay,
    studySessions, studyByDay, studyByTrack, tasks, habits, habitLogs, cards, leisureLogs, checkins, days,
    completionByDay, readinessByDay, skipReasons,
    projects: store.all('project'), materials: store.all('material'), fun: store.all('fun'), notes: store.all('note'),
    measures: store.all('measure').sort((a, b) => a.date < b.date ? -1 : 1),
    readiness: T.rd, plan: T.plan, dayType: T.type, mode: T.mode, scenario: E.scenarioName(T.plan, days[today]),
    topics, nextTopic, programWeek, workoutSession, nextLetter, recovery,
    goals: store.all('goal'), expenses: store.all('expense'), fixedCosts: store.all('fixed'),
    planState: store.get('ps_' + today) || { done: {}, skipped: {} },
    planFor
  };
  D.targets = E.energyTargets({ settings: s, trend, today, foodByDay, daily });
  const home = parseHM(s.workEnd) + s.commuteMin;
  D.menu = buildMenu({ kcal: D.targets?.kcal || (s.sex === 'f' ? 1700 : 2000), exclude: s.foodExclude, times: { b: hm(parseHM(s.wake) + 15), l: '12:30', s: '16:00', d: hm(home + s.decompressMin) } });
  D.insights = E.insights(D);
  cached = D;
  return D;
}

/** Компактная сводка для ИИ-ассистента (только агрегаты, без лишних персональных деталей) */
export function aiContext(D) {
  const k28 = rangeKeys(D.today, 28);
  const r = x => x == null ? null : Math.round(x * 10) / 10;
  return {
    today: D.today, dayType: D.dayType, mode: D.mode, readiness: D.readiness.score,
    readinessReasons: D.readiness.reasons.map(x => x.text),
    settings: { work: `${D.settings.workStart}-${D.settings.workEnd}`, bedtime: D.settings.bedtime, sleepTargetH: D.settings.sleepTargetH, studyWeeklyMin: D.settings.studyWeeklyMin, workoutsPerWeek: D.settings.workoutsPerWeek, goalWeightKg: D.settings.goalWeightKg },
    days: k28.map(k => ({
      d: k, sleepH: D.nights[k] ? r(D.nights[k].asleepMin / 60) : null, steps: D.daily[k]?.steps ? Math.round(D.daily[k].steps) : null,
      hrv: r(D.daily[k]?.hrv), rhr: r(D.daily[k]?.resting_hr), kcal: D.foodByDay[k] ? Math.round(D.foodByDay[k].kcal) : null,
      studyMin: D.studyByDay[k] || 0, workout: !!D.workoutsByDay[k], plan: D.completionByDay[k] != null ? Math.round(D.completionByDay[k] * 100) : null,
      energy: D.checkins[k]?.energy ?? null
    })),
    weightTrend: D.trend.slice(-28).map(x => ({ d: x.date, kg: r(x.kg), trend: r(x.trend) })),
    targets: D.targets,
    habits: D.habits.map(h => ({ name: h.name, ...(({ r28, streak, weekDone }) => ({ r28: r28 == null ? null : Math.round(r28 * 100), streak, weekDone }))(E.habitStats(h, D.habitLogs, D.today)) })),
    openTasks: D.tasks.filter(t => !t.done).slice(0, 40).map(t => ({ title: t.title, priority: t.priority, due: t.due || null, estimate: t.estimate || null })),
    skipReasons: D.skipReasons,
    leisure7d: sum(D.leisureLogs.filter(l => l.date >= addDays(D.today, -6)).map(l => l.minutes || 0)),
    todayPlan: D.plan.blocks.map(b => `${Math.floor(b.start / 60) % 24}:${String(b.start % 60).padStart(2, '0')} ${b.title}`),
    insights: D.insights.map(i => i.title + ': ' + i.text)
  };
}
