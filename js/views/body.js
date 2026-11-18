// «Тело»: один экран без вкладок. Вес, еда сегодня, тренировка, сон и движение. Детали по кнопке.
import * as store from '../store.js';
import * as E from '../engine.js';
import { esc, num, int, dur, durShort, rangeKeys, addDays, minutesOfDay, parseHM } from '../util.js';
import { icon, on, hero, linkRow, modal, toast } from '../ui.js';
import { ring, spark, meter } from '../charts.js';
import { completeWorkout } from './comp.js';

export const title = 'Тело';

export function render(D) {
  const s = D.settings, tr = D.trend.at(-1), t = D.targets;
  const w7 = D.trend.filter(x => x.date <= addDays(D.today, -7)).at(-1);
  const delta = tr && w7 ? tr.trend - w7.trend : null;
  const start = D.trend[0]?.trend, goal = s.goalWeightKg;
  const food = D.foodByDay[D.today] || { kcal: 0, p: 0, f: 0, c: 0 };
  const dow = (new Date().getDay() + 6) % 7, menu = D.menu.days[dow];
  const eaten = new Set(store.all('food').filter(f => f.date === D.today && f.planMeal).map(f => f.planMeal));
  const nowM = minutesOfDay();
  const nextMeal = menu.meals.find(m => !eaten.has(m.key) && parseHM(m.time) + 120 > nowM) || menu.meals.find(m => !eaten.has(m.key));
  const ses = D.workoutSession, night = D.nights[D.today], d = D.daily[D.today] || {};
  const doneWorkoutToday = D.workouts.some(w => w.date === D.today && w.session);
  return `${hero('body', 'Тело', tr ? `${num(tr.trend, 1)} кг${goal ? ` · цель ${num(goal, 1)}` : ''}` : 'начни со взвешивания')}
  <div class="grid">
    <section class="card c6">
      <div class="card-h"><h2>Вес</h2><span class="sp"></span><button class="btn sm pri" data-a="weight-add">${icon('plus')}Записать</button></div>
      ${tr ? `<div class="big">${num(tr.trend, 1)}<small>кг</small></div>
        <div class="small muted">${delta != null ? `${delta <= 0 ? '' : '+'}${num(delta, 1)} кг за неделю (тренд, без колебаний воды)` : 'тренд появится через неделю взвешиваний'}</div>
        <div style="margin:10px 0">${spark(rangeKeys(D.today, 45).map(k => D.trend.find(x => x.date === k)?.trend ?? null), { width: 520, height: 46 })}</div>
        ${goal && start > goal ? `<div class="small muted" style="margin-bottom:4px">Путь к цели</div>${meter((start - tr.trend) / (start - goal))}` : ''}`
      : '<div class="muted">Пока нет ни одного взвешивания. Встань на весы утром до завтрака.</div>'}
    </section>

    <section class="card c6">
      <div class="card-h"><h2>Еда сегодня</h2><span class="sp"></span><span class="small muted">${t ? `цель ${int(t.kcal)} ккал` : ''}</span></div>
      <div class="row" style="gap:18px;align-items:center">
        ${ring(t ? food.kcal / t.kcal : 0, { size: 86, stroke: 7, label: int(food.kcal) })}
        <div class="col" style="flex:1;gap:6px">
          <div class="small">Белок ${Math.round(food.p)}${t ? ' / ' + t.protein : ''} г</div>${meter(t ? food.p / t.protein : 0, 'var(--good)')}
          <div class="small muted">Жиры ${Math.round(food.f)} г · Углеводы ${Math.round(food.c)} г</div>
        </div>
      </div>
      ${nextMeal ? `<div class="nextmeal"><div class="tiny muted">По меню ${esc(nextMeal.time)} · ${esc(nextMeal.label.toLowerCase())}</div><div class="display" style="font-size:20px">${esc(nextMeal.name)}</div><div class="small muted">${nextMeal.kcal} ккал · ${nextMeal.lines.slice(0, 3).map(esc).join(', ')}</div>
        <div class="row" style="margin-top:8px"><button class="btn pri sm" data-a="eat-plan" data-k="${nextMeal.key}">${icon('check')}Съел по плану</button><button class="btn sm" data-a="quick">Другое</button></div></div>` : '<div class="note good" style="margin-top:12px">Все приёмы пищи по меню отмечены.</div>'}
    </section>

    <section class="card c6">
      <div class="card-h"><h2>Тренировка</h2><span class="sp"></span><span class="small muted">неделя ${D.programWeek} из 12</span></div>
      ${doneWorkoutToday ? '<div class="note good">Сегодня тренировка уже есть. Следующая по очереди: ' + esc(ses.title) + '.</div>' : ''}
      <div class="display" style="font-size:24px;margin-bottom:6px">${esc(ses.title)}</div>
      <div class="small muted" style="margin-bottom:10px">${ses.minutes} мин · ${esc(ses.phase.name.toLowerCase())}: ${ses.phase.sets} × ${ses.phase.reps}</div>
      ${ses.items.slice(0, 4).map(e => `<div class="exrow"><span>${esc(e.name)}</span><span class="chip">${e.sets} × ${esc(e.reps)}</span></div>`).join('')}
      <div class="row" style="margin-top:12px"><button class="btn pri" data-a="timer-start" data-cat="workout" data-min="${ses.minutes}">${icon('play')}Начать</button><button class="btn" data-a="workout-quick" data-l="${ses.letter}" data-min="${ses.minutes}">Сделал</button></div>
    </section>

    <section class="card c6">
      <div class="card-h"><h2>Сон и движение</h2></div>
      <div class="stats">
        <div class="stat" data-a="${night ? 'go' : 'sleep-log'}" data-v="health"><div class="l">Сон</div><div class="v">${night ? durShort(night.asleepMin) : '-'}</div><div class="tiny muted">${night ? 'цель ' + num(s.sleepTargetH, 1) + ' ч' : 'записать'}</div></div>
        <div class="stat"><div class="l">Шаги</div><div class="v">${d.steps ? int(d.steps) : '-'}</div><div class="tiny muted">цель ${int(s.stepsTarget)}</div></div>
        <div class="stat"><div class="l">Пульс покоя</div><div class="v">${d.resting_hr ? Math.round(d.resting_hr) : '-'}</div><div class="tiny muted">уд/мин</div></div>
        <div class="stat"><div class="l">Вода</div><div class="v" data-a="water" data-v="250" style="cursor:pointer">${num((D.waterByDay[D.today] || 0) / 1000, 1)}<small>л</small></div><div class="tiny muted">нажми: +250 мл</div></div>
      </div>
      ${!D.samples.length ? '<div class="tiny muted" style="margin-top:10px">Шаги, сон и пульс появятся сами после подключения Apple Health.</div>' : ''}
    </section>
  </div>
  ${linkRow([['open-health', 'menu', 'Меню на неделю и покупки', 'health'], ['open-health', 'training', 'Программа тренировок', 'today'], ['open-health', 'body', 'Замеры и история веса', 'analytics'], ['open-health', 'overview', 'Все показатели здоровья', 'health']])}`;
}

on({
  'open-health': async (ds) => { const m = await import('./health.js'); m.openTab(ds.v); window.__go('health'); },
  'eat-plan': (ds) => {
    const D = window.__D; const dow = (new Date().getDay() + 6) % 7; const m = D.menu.days[dow].meals.find(x => x.key === ds.k);
    store.put('food', { id: `fd_plan_${D.today}_${ds.k}`, date: D.today, name: m.name, kcal: m.kcal, p: m.p, f: m.f, c: m.c, meal: { b: 'breakfast', l: 'lunch', s: 'snack', d: 'dinner' }[ds.k], planMeal: ds.k });
    toast(`${m.label}: ${m.kcal} ккал`);
  },
  'workout-quick': (ds) => { completeWorkout(ds.l, ds.min, window.__D.today, 'manual_' + ds.l); toast('Тренировка записана'); }
});
