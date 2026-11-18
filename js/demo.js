// Демо-данные за 6 недель: чтобы увидеть систему в работе до подключения Apple Health.
import * as store from './store.js';
import { build } from './data.js';
import { dkey, addDays, rangeKeys, parseKey, weekday } from './util.js';

function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

export async function seedDemo(today = dkey()) {
  const r = rnd(42);
  const days = rangeKeys(addDays(today, -1), 42);
  const samples = [];
  const iso = d => d.toISOString();
  let w = 96.4;
  const habitIds = {};
  for (const [name, minimal, freq, area] of [['Шаги: цель дня', 'Прогулка 10 минут', { type: 'daily' }, 'move'], ['Карточки (повторение)', '5 карточек', { type: 'daily' }, 'learn'], ['USMLE: 20 вопросов', '5 вопросов', { type: 'weekly', n: 3 }, 'learn'], ['Отбой по плану', 'Экран убран за 15 минут', { type: 'daily' }, 'sleep']]) {
    const h = store.put('habit', { name, minimal, freq, area, level: 1, createdAt: +parseKey(days[0]), demo: true });
    habitIds[name] = h.id;
  }
  const shortNights = {};
  const tracks = ['med', 'surg', 'surg', 'sci', 'eng', 'gen'];
  days.forEach((k, i) => {
    const d = parseKey(k); const wd = weekday(k); const weekend = wd >= 5;
    // сон
    const short = r() < 0.25;
    const bed = new Date(d); bed.setDate(bed.getDate() - 1); bed.setHours(weekend ? 23 : 22, Math.round(r() * 50) + (short ? 40 : 0));
    const total = (weekend ? 8 : short ? 5.6 : 6.9) * 60 + r() * 50;
    let t = +bed;
    const end = t + total * 60000;
    while (t < end) {
      const len = (20 + r() * 50) * 60000; const st = r(); const stage = st < 0.17 ? 'Deep' : st < 0.4 ? 'REM' : st < 0.95 ? 'Core' : 'Awake';
      samples.push({ uid: `demo_sl_${t}`, type: 'sleep', start_at: iso(new Date(t)), end_at: iso(new Date(Math.min(end, t + len))), value: null, value_text: stage });
      t += len;
    }
    const dayStart = new Date(d); const dayEnd = new Date(d); dayEnd.setHours(23, 59);
    const steps = weekend ? 9000 + r() * 5000 : 6500 + r() * 4500;
    const add = (type, value) => samples.push({ uid: `demo_${type}_${k}`, type, start_at: iso(dayStart), end_at: iso(dayEnd), value, value_text: null });
    add('steps', Math.round(steps)); add('active_energy', Math.round(steps * 0.045 + r() * 120)); add('basal_energy', 1980 + r() * 40);
    const trained = (wd === 0 || wd === 2 || wd === 5) && r() > 0.2;
    add('exercise_min', Math.round(trained ? 38 + r() * 20 : 8 + r() * 15));
    add('resting_hr', Math.round(short ? 64 + r() * 4 : 59 + r() * 4));
    add('hrv', Math.round(short ? 34 + r() * 8 : 44 + r() * 12));
    add('resp_rate', 14 + r() * 1.5);
    w -= 0.065 + (r() - 0.5) * 0.05;
    if (r() > 0.3) add('weight', Math.round((w + (r() - 0.5) * 1.1) * 10) / 10);
    if (trained) store.put('workout', { date: k, minutes: 40 + Math.round(r() * 15), type: wd === 5 ? 'Кардио' : 'Силовая', intensity: 3, demo: true });
    // питание
    if (r() > 0.2) {
      const kcal = 1900 + r() * 500;
      [['breakfast', 'Овсянка, яйца', 0.25], ['lunch', 'Обед в столовой', 0.35], ['dinner', 'Курица, гречка, салат', 0.33], ['snack', 'Йогурт', 0.07]].forEach(([meal, name, f]) =>
        store.put('food', { date: k, meal, name, kcal: Math.round(kcal * f), p: Math.round(kcal * f * 0.075), f: Math.round(kcal * f * 0.033), c: Math.round(kcal * f * 0.1), demo: true }));
    }
    // учёба
    if (!weekend && !short && r() > 0.25) store.put('study', { date: k, minutes: 30 + Math.round(r() * 3) * 10, track: tracks[Math.floor(r() * tracks.length)], note: 'демо', demo: true });
    // привычки
    for (const [name, id] of Object.entries(habitIds)) {
      const p = name.startsWith('Отбой') ? (short ? 0.1 : 0.85) : name.startsWith('USMLE') ? 0.6 : 0.8;
      const x = r();
      if (x < p) store.put('habitlog', { id: `hl_${id}_${k}`, habitId: id, date: k, status: x < p * 0.85 ? 'done' : 'min' });
      else if (x < p + 0.1) store.put('habitlog', { id: `hl_${id}_${k}`, habitId: id, date: k, status: 'skip', reason: short ? 'tired' : 'time' });
    }
    // отдых
    if (r() > 0.35) store.put('leisure', { date: k, cat: ['film', 'game', 'read', 'social', 'scroll', 'walk'][Math.floor(r() * 6)], minutes: 40 + Math.round(r() * 6) * 15, quality: 2 + Math.round(r() * 3), demo: true });
    // самочувствие и выполнение плана
    store.put('checkin', { id: 'ci_' + k, date: k, energy: short ? 2 : 3 + Math.round(r()), demo: true });
    shortNights[k] = short;
  });
  await store.applyHealth(samples);
  // отметки выполнения плана: по реально построенному плану каждого дня
  const D = build(today);
  for (const k of days) {
    const p = D.planFor(k).plan;
    const tracked = p.blocks.filter(b => b.track && !b.optional);
    if (!tracked.length) continue;
    const prob = shortNights[k] ? 0.4 : 0.85;
    const done = {}; for (const b of tracked) if (r() < prob) done[b.id] = Date.now();
    store.put('planstate', { id: 'ps_' + k, date: k, done, demo: true });
  }
  // задачи, материалы, карточки, список отдыха
  [['Подготовить презентацию случая на разбор', 'must', 0, 'deep', 60], ['Дочитать статью про TNT при раке прямой кишки', 'should', 2, 'deep', 40], ['Записаться к стоматологу', 'should', 3, 'light', 10], ['Оплатить интернет', 'must', 0, 'light', 5], ['Разобрать почту', 'could', null, 'light', 20]].forEach(([title, priority, due, energy, estimate]) =>
    store.put('task', { title, priority, due: due == null ? null : addDays(today, due), energy, estimate, done: false, demo: true }));
  store.put('material', { title: "Sabiston: Textbook of Surgery, гл. 51 (Colon and Rectum)", type: 'book', track: 'surg', status: 'active', progress: 3, total: 9, demo: true });
  store.put('material', { title: 'ESMO guideline: rectal cancer', type: 'guideline', track: 'med', status: 'active', progress: 0, total: 1, demo: true });
  [['Классификация Clavien-Dindo IIIb', 'Осложнение, требующее вмешательства под общей анестезией', 'surg'], ['Критерии SIRS', 'T >38 или <36; ЧСС >90; ЧДД >20 или PaCO2 <32; лейкоциты >12 или <4 тыс. или >10% палочкоядерных', 'med'], ['Синдром низкой передней резекции: шкала', 'LARS score (0-42), ≥30 major LARS', 'surg'], ['Present perfect vs past simple', 'Связь с настоящим / завершённое действие в прошлом с указанием времени', 'eng']].forEach(([front, back, track]) =>
    store.put('card', { front, back, track, demo: true }));
  [['Сёгун (сериал)', 'film'], ['Прогулка в парке с друзьями', 'social'], ['Baldur\'s Gate 3', 'game'], ['«Проект Аве Мария»', 'read']].forEach(([title, cat]) => store.put('fun', { title, cat, status: 'want', demo: true }));
  const s = store.get('settings') || {};
  store.put('settings', { ...s, id: 'settings', goalWeightKg: s.goalWeightKg || 85 });
}
