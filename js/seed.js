// Стартовое наполнение: программа обучения, стратегия, привычки, проекты, список отдыха.
// Идентификаторы детерминированные, поэтому при запуске на нескольких устройствах дублей не будет.
import * as store from './store.js';
import { buildProgram, TRACKS } from './content/curriculum.js';
import { buildGoals, buildProjects, START_HABITS } from './content/strategy.js';
import { dkey } from './util.js';

export function profileParams(s) {
  const w = store.all('weight').sort((a, b) => a.date < b.date ? 1 : -1)[0];
  return { weightKg: s.startWeightKg || w?.kg || null, goalWeightKg: s.goalWeightKg || null, goalDate: s.goalDate || null, studyWeeklyMin: s.studyWeeklyMin, workoutsPerWeek: s.workoutsPerWeek,
    usmleStep: s.usmleStep || 1, usmleDate: s.usmleDate || null, fixed: s.finFixed || null };
}

/** Стратегия пересобирается из анкеты; отметки выполнения сохраняются */
export function seedGoals(s) {
  const goals = buildGoals(profileParams(s));
  goals.forEach((g, i) => {
    const id = 'gl_seed_' + (i + 1); const prev = store.get(id);
    store.put('goal', { ...g, id, done: prev?.done || false, seed: true });
  });
}

export function seedStart() {
  const s = store.get('settings') || {};
  // направления обучения: английский заменён на USMLE
  if (!s.tracksV2) {
    const { id, kind, updatedAt, dirty, deleted, createdAt, ...rest } = s;
    store.put('settings', { ...rest, id: 'settings', tracks: TRACKS, tracksV2: true, programStart: rest.programStart || dkey() });
  }
  if (!store.get('tp_1')) buildProgram().forEach(t => store.put('topic', { ...t, id: 'tp_' + t.order, done: false }));
  if (!store.get('gl_seed_1')) seedGoals(store.get('settings'));
  if (!store.all('habit').length) START_HABITS.forEach((h, i) => store.put('habit', { ...h, id: 'hb_seed_' + (i + 1), level: 1 }));
  if (!store.all('project').length) buildProjects().forEach((p, i) => store.put('project', { ...p, id: 'pj_seed_' + (i + 1) }));
  if (!store.all('fun').length) [['Ведьмак 3 на Switch: один квест', 'game'], ['Фильм в выходной', 'film'], ['Встреча с друзьями', 'social'], ['Прогулка в парке без телефона', 'walk']]
    .forEach(([title, cat], i) => store.put('fun', { id: 'fn_seed_' + (i + 1), title, cat, status: 'want' }));
}
