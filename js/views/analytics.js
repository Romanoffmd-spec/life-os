// Аналитика: куда уходит время и как меняются ключевые показатели по неделям и месяцам.
import * as E from '../engine.js';
import { esc, dur, num, int, fmtDate, addDays, rangeKeys, weekStart, sum, mean, dkey } from '../util.js';
import { on, seg } from '../ui.js';
import { line, bars } from '../charts.js';

export const title = 'Летопись';
let weeksN = 12;

const ALLOC = [['sleep', 'Сон', 'var(--cat-sleep)'], ['work', 'Работа', 'var(--cat-work)'], ['commute', 'Дорога', 'var(--cat-commute)'], ['study', 'Обучение', 'var(--cat-study)'], ['workout', 'Движение', 'var(--cat-workout)'], ['leisure', 'Отдых', 'var(--cat-leisure)'], ['social', 'Люди', 'var(--cat-social)'], ['untracked', 'Не учтено (еда, быт, прочее)', 'var(--line-2)']];

function dayAlloc(D, k) {
  const type = E.dayType(k, D.days[k], D.settings);
  const lby = {}; for (const l of D.leisureLogs.filter(l => l.date === k)) lby[l.cat] = (lby[l.cat] || 0) + (l.minutes || 0);
  return E.timeAllocation({ date: k, settings: D.settings, nights: D.nights, type, studyMin: D.studyByDay[k], workoutMin: D.workoutMinByDay[k], leisureByCat: lby, socialMin: lby.social });
}

export function render(D) {
  const weeks = Array.from({ length: weeksN }, (_, i) => addDays(weekStart(D.today), -7 * (weeksN - 1 - i)));
  const wkeys = ws => rangeKeys(addDays(ws, 6), 7).filter(k => k <= D.today);
  const lab = weeks.map(ws => fmtDate(ws));
  // распределение времени
  const allocW = weeks.map(ws => { const ks = wkeys(ws); const acc = {}; for (const k of ks) { const a = dayAlloc(D, k); for (const [c] of ALLOC) acc[c] = (acc[c] || 0) + (a[c] || 0); } for (const c in acc) acc[c] /= Math.max(1, ks.length); return acc; });
  const allDays = rangeKeys(D.today, weeksN * 7);
  const total = {}; for (const k of allDays) { const a = dayAlloc(D, k); for (const [c] of ALLOC) total[c] = (total[c] || 0) + (a[c] || 0); }
  const sleepDays = allDays.filter(k => D.nights[k]).length;
  const perDay = c => (total[c] || 0) / allDays.length;

  const weekly = (fn) => weeks.map(ws => fn(wkeys(ws), ws));
  const sleepW = weekly(ks => mean(ks.map(k => D.nights[k]?.asleepMin)) / 60 || null);
  const studyW = weekly(ks => sum(ks.map(k => D.studyByDay[k] || 0)) / 60);
  const woW = weekly(ks => ks.filter(k => D.workoutsByDay[k]).length);
  const stepsW = weekly(ks => mean(ks.map(k => D.daily[k]?.steps)));
  const compW = weekly(ks => { const v = mean(ks.map(k => D.completionByDay[k])); return v == null ? null : v * 100; });
  const tasksW = weekly((ks, ws) => D.tasks.filter(t => t.done && t.doneAt && dkey(new Date(t.doneAt)) >= ws && dkey(new Date(t.doneAt)) <= addDays(ws, 6)).length);
  const habW = weekly((ks, ws) => { const end = addDays(ws, 6) > D.today ? D.today : addDays(ws, 6); const v = mean(D.habits.map(h => { const s = E.habitStats(h, D.habitLogs, end); return s.r14; })); return v == null ? null : v * 100; });
  const leisW = weekly((ks, ws) => sum(D.leisureLogs.filter(l => l.date >= ws && l.date <= addDays(ws, 6)).map(l => l.minutes || 0)) / 60);
  const trW = weekly(ks => { const t = D.trend.filter(x => x.date <= ks.at(-1)).at(-1); return t && t.date >= ks[0] ? t.trend : null; });

  // месяцы
  const months = []; { const d = new Date(); for (let i = 0; i < 6; i++) { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); months.push(dkey(m).slice(0, 7)); } }
  const mrow = m => { const ks = Object.keys({ ...D.nights, ...D.studyByDay, ...D.daily }).filter(k => k.startsWith(m)); const allK = rangeKeys(D.today, 200).filter(k => k.startsWith(m));
    const tw = D.trend.filter(x => x.date.startsWith(m)); return { m, sleep: mean(allK.map(k => D.nights[k]?.asleepMin)), study: sum(allK.map(k => D.studyByDay[k] || 0)), wo: allK.filter(k => D.workoutsByDay[k]).length, steps: mean(allK.map(k => D.daily[k]?.steps)), dw: tw.length >= 2 ? tw.at(-1).trend - tw[0].trend : null, comp: mean(allK.map(k => D.completionByDay[k])) }; };
  const MN = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

  return `<div class="top"><h1>Летопись</h1><span class="sp"></span>${seg('an-range', [[4, '4 нед'], [12, '12 нед'], [26, '6 мес'], [52, 'Год']], weeksN)}</div>
  <div class="grid">
    <div class="card c12"><div class="card-h"><h2>Куда уходит время</h2><span class="sp"></span><span class="muted small">среднее за день, по неделям</span></div>
      ${bars({ data: weeks.map((ws, i) => ({ label: lab[i], parts: ALLOC.map(([c, n, col]) => ({ v: (allocW[i][c] || 0) / 60, color: col, name: n })) })), yFmt: v => num(v, 0) + 'ч', height: 220 })}
      <div class="legend">${ALLOC.map(([c, n, col]) => `<span><i style="background:${col}"></i>${n}: ${dur(perDay(c))}/день</span>`).join('')}</div>
      <div class="tiny muted" style="margin-top:8px">Сон берётся из Apple Health (данные есть за ${sleepDays} из ${allDays.length} дней), работа и дорога из расписания и типа дня, учёба, тренировки и отдых из отметок. «Не учтено» показывает, сколько времени нигде не зафиксировано: если там много, стоит отмечать отдых и сессии.</div></div>
    <div class="card c6"><div class="card-h"><h2>Вес (тренд)</h2></div>${line({ labels: lab, series: [{ values: trW, color: 'var(--accent)', dots: true }], refLine: D.settings.goalWeightKg || null, yFmt: v => num(v, 1), height: 170 })}</div>
    <div class="card c6"><div class="card-h"><h2>Сон, среднее за ночь</h2></div>${line({ labels: lab, series: [{ values: sleepW, color: 'var(--cat-sleep)', dots: true }], refLine: D.settings.sleepTargetH, yFmt: v => num(v, 1) + 'ч', height: 170 })}</div>
    <div class="card c6"><div class="card-h"><h2>Учебные часы</h2></div>${bars({ data: weeks.map((ws, i) => ({ label: lab[i], parts: [{ v: studyW[i], color: 'var(--cat-study)', name: 'часы' }] })), target: D.settings.studyWeeklyMin / 60, yFmt: v => num(v, 0), height: 170 })}</div>
    <div class="card c6"><div class="card-h"><h2>Тренировки</h2></div>${bars({ data: weeks.map((ws, i) => ({ label: lab[i], parts: [{ v: woW[i], color: 'var(--cat-workout)', name: 'тренировки' }] })), target: D.settings.workoutsPerWeek, yFmt: v => num(v, 0), height: 170 })}</div>
    <div class="card c6"><div class="card-h"><h2>Выполнение плана и привычек, %</h2></div>${line({ labels: lab, series: [{ values: compW, color: 'var(--accent)', dots: true }, { values: habW, color: 'var(--good)', dots: true, dash: '4 3' }], yFmt: v => Math.round(v) + '%', height: 170 })}
      <div class="legend"><span><i style="background:var(--accent)"></i>план дня</span><span><i style="background:var(--good)"></i>привычки</span></div></div>
    <div class="card c6"><div class="card-h"><h2>Задачи и отдых</h2></div>${bars({ data: weeks.map((ws, i) => ({ label: lab[i], parts: [{ v: tasksW[i], color: 'var(--cat-project)', name: 'задач сделано' }] })), yFmt: v => num(v, 0), height: 120 })}
      ${bars({ data: weeks.map((ws, i) => ({ label: lab[i], parts: [{ v: leisW[i], color: 'var(--cat-leisure)', name: 'часы отдыха' }] })), yFmt: v => num(v, 0) + 'ч', height: 120 })}
      <div class="legend"><span><i style="background:var(--cat-project)"></i>задачи за неделю</span><span><i style="background:var(--cat-leisure)"></i>отмеченный отдых, ч</span></div></div>
    <div class="card c6"><div class="card-h"><h2>Шаги, среднее в день</h2></div>${line({ labels: lab, series: [{ values: stepsW, color: 'var(--cat-workout)', dots: true }], refLine: D.settings.stepsTarget, yFmt: v => int(v), height: 170 })}</div>
    <div class="card c6"><div class="card-h"><h2>Месяцы</h2></div><div style="overflow-x:auto"><table class="t"><tr><th>Месяц</th><th class="tr">Сон</th><th class="tr">Учёба</th><th class="tr">Трен.</th><th class="tr">Шаги</th><th class="tr">Вес Δ</th><th class="tr">План</th></tr>
      ${months.map(mrow).map(r => `<tr><td>${MN[Number(r.m.slice(5)) - 1]}</td><td class="tr">${r.sleep ? dur(r.sleep) : '-'}</td><td class="tr">${r.study ? num(r.study / 60, 1) + ' ч' : '-'}</td><td class="tr">${r.wo || '-'}</td><td class="tr">${r.steps ? int(r.steps) : '-'}</td><td class="tr ${r.dw < 0 ? 'good' : ''}">${r.dw != null ? (r.dw > 0 ? '+' : '') + num(r.dw, 1) : '-'}</td><td class="tr">${r.comp != null ? Math.round(r.comp * 100) + '%' : '-'}</td></tr>`).join('')}</table></div></div>
  </div>`;
}

on({ 'an-range': (ds) => { weeksN = Number(ds.v); window.__rerender(); } });
