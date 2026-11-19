// Здоровье и снижение веса: питание, вес и тело, активность, сон, показатели Apple Health.
import * as store from '../store.js';
import * as E from '../engine.js';
import { esc, hm, dur, num, int, fmtDate, addDays, rangeKeys, mean, sum, dkey, weekStart } from '../util.js';
import { icon, on, onForm, modal, close, toast, seg, opts } from '../ui.js';
import { line, bars, meter, spark } from '../charts.js';
import { mealNow, completeWorkout } from './comp.js';
import { shoppingList, QUICK_OPTIONS } from '../content/nutrition.js';
import { session as trainingSession, PROGRESSION, stepsTarget, phaseFor } from '../content/training.js';

export const title = 'Тело';
let tab = 'overview', range = 30, foodDay = null, menuDay = (new Date().getDay() + 6) % 7;
export function openTab(t) { tab = t; }

const MEALS = [['breakfast', 'Завтрак'], ['lunch', 'Обед'], ['dinner', 'Ужин'], ['snack', 'Перекусы']];

export function render(D) {
  return `<div class="top"><h1>Тело</h1><span class="sp"></span>${seg('h-range', [[30, '30 дн'], [90, '90 дн'], [365, 'Год']], range)}</div>
  <div class="tabs">${[['overview', 'Обзор'], ['menu', 'Меню'], ['food', 'Дневник еды'], ['training', 'Тренировки'], ['body', 'Вес и тело'], ['activity', 'Активность'], ['sleep', 'Сон'], ['vitals', 'Показатели']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-a="h-tab" data-v="${k}">${l}</button>`).join('')}</div>
  ${({ overview, menu, food, training, body, activity, sleep, vitals })[tab](D)}`;
}

const labels = keys => keys.map(k => fmtDate(k).replace(/ \S+$/, m => m));

function overview(D) {
  const t = D.targets, tr = D.trend.at(-1), rate = E.weeklyRate(D.trend, D.today);
  const keys = rangeKeys(D.today, 7);
  const kcal7 = mean(keys.slice(0, 6).map(k => D.foodByDay[k]?.kcal).filter(v => v > 800));
  const steps7 = mean(keys.map(k => D.daily[k]?.steps));
  const sl7 = E.sleepStats(D.nights, D.today, 7);
  const adv = E.weightAdvice(D.trend, D.today, D.settings);
  const hasHealth = D.samples.length > 0;
  return `${hasHealth ? '' : `<div class="note acc" style="margin-bottom:14px">Apple Health ещё не подключён: шаги, сон, пульс и HRV будут приходить автоматически после настройки быстрой команды. <a data-a="go" data-v="settings" style="cursor:pointer">Настроить</a></div>`}
  <div class="kpis" style="margin-bottom:14px">
    <div class="kpi"><div class="l">Вес, тренд</div><div class="v">${tr ? num(tr.trend, 1) : '-'}<small>кг</small></div><div class="s">${rate != null ? `${rate <= 0 ? '' : '+'}${num(rate, 2)} кг/нед` : 'нужно 2+ недели взвешиваний'}</div></div>
    <div class="kpi"><div class="l">Калории, среднее 7 дн</div><div class="v">${kcal7 ? int(kcal7) : '-'}</div><div class="s">${t ? `цель ${int(t.kcal)}` : ''}</div></div>
    <div class="kpi"><div class="l">Расход (оценка)</div><div class="v">${t ? int(t.tdee) : '-'}</div><div class="s">${t ? esc(t.source) : 'нужен вес'}</div></div>
    <div class="kpi"><div class="l">Шаги, среднее 7 дн</div><div class="v">${steps7 ? int(steps7) : '-'}</div><div class="s">цель ${int(D.settings.stepsTarget)}</div></div>
    <div class="kpi"><div class="l">Сон, среднее 7 ночей</div><div class="v">${sl7.avgMin ? dur(sl7.avgMin).replace(' мин', 'м') : '-'}</div><div class="s">${sl7.nights} ноч. с данными</div></div>
    <div class="kpi"><div class="l">Тренировки, неделя</div><div class="v">${rangeKeys(D.today, 7).filter(k => k >= weekStart(D.today) && D.workoutsByDay[k]).length}<small>/${D.settings.workoutsPerWeek}</small></div><div class="s">считаются и данные часов</div></div>
  </div>
  ${adv ? `<div class="note ${adv.level === 'warn' ? 'warn' : adv.level === 'good' ? 'good' : ''}" style="margin-bottom:14px">${esc(adv.text)}</div>` : ''}
  <div class="grid">
    <div class="card c6"><div class="card-h"><h2>Вес</h2><span class="sp"></span><button class="btn sm" data-a="weight-add">${icon('plus')}Вес</button></div>${weightChart(D)}</div>
    <div class="card c6"><div class="card-h"><h2>Калории и цель</h2></div>${kcalChart(D)}</div>
    <div class="card c6"><div class="card-h"><h2>Шаги</h2></div>${stepsChart(D)}</div>
    <div class="card c6"><div class="card-h"><h2>Сон</h2></div>${sleepChart(D)}</div>
  </div>`;
}

function weightChart(D) {
  const keys = rangeKeys(D.today, range);
  const raw = Object.fromEntries(D.trend.map(x => [x.date, x]));
  return line({ labels: labels(keys), series: [
    { values: keys.map(k => raw[k]?.kg ?? null), color: 'var(--muted)', dotsOnly: true, r: 2.4 },
    { values: keys.map(k => raw[k]?.trend ?? null), color: 'var(--accent)', width: 2.2 }
  ], refLine: D.settings.goalWeightKg || null, yFmt: v => num(v, 1) }) + `<div class="legend"><span><i style="background:var(--muted)"></i>взвешивания</span><span><i style="background:var(--accent)"></i>тренд (сглаживание колебаний воды)</span>${D.settings.goalWeightKg ? '<span>пунктир: цель</span>' : ''}</div>`;
}
function kcalChart(D) {
  const keys = rangeKeys(D.today, Math.min(range, 60));
  return bars({ data: keys.map(k => ({ label: fmtDate(k).split(' ')[0], parts: [{ v: D.foodByDay[k]?.kcal || 0, color: 'var(--cat-meal)', name: 'ккал' }] })), target: D.targets?.kcal, yFmt: v => int(v) });
}
function stepsChart(D) {
  const keys = rangeKeys(D.today, Math.min(range, 60));
  return bars({ data: keys.map(k => ({ label: fmtDate(k).split(' ')[0], parts: [{ v: D.daily[k]?.steps || 0, color: 'var(--cat-workout)', name: 'шаги' }] })), target: D.settings.stepsTarget, yFmt: v => int(v) });
}
function sleepChart(D) {
  const keys = rangeKeys(D.today, Math.min(range, 60));
  return bars({ data: keys.map(k => { const n = D.nights[k]; return { label: fmtDate(k).split(' ')[0], parts: n?.hasStages ? [{ v: n.deepMin / 60, color: '#3b4bb8', name: 'глубокий' }, { v: n.coreMin / 60, color: 'var(--cat-sleep)', name: 'основной' }, { v: n.remMin / 60, color: '#9aa6f0', name: 'REM' }] : [{ v: n ? n.asleepMin / 60 : 0, color: 'var(--cat-sleep)', name: 'сон' }] }; }), target: D.settings.sleepTargetH, yFmt: v => num(v, 0) + 'ч' });
}

// ---------------- меню на неделю ----------------
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
function menu(D) {
  const M = D.menu, d = M.days[menuDay], t = D.targets;
  const shop = shoppingList(M);
  const today = (new Date().getDay() + 6) % 7;
  const eaten = new Set(store.all('food').filter(f => f.date === D.today && f.planMeal).map(f => f.planMeal));
  return `<div class="note" style="margin-bottom:12px">Меню рассчитано на ${t ? int(t.kcal) + ' ккал (твоя цель)' : '2000 ккал (предварительно, до анкеты)'}. Порции масштабируются автоматически, овощи не урезаются. Значения ориентировочные, по справочным таблицам состава.${D.settings.foodExclude ? ` Исключено: ${esc(D.settings.foodExclude)}.` : ''}</div>
  <div class="row wrap" style="margin-bottom:12px">${seg('menu-day', DOW.map((x, i) => [i, x + (i === today ? ' •' : '')]), menuDay)}</div>
  <div class="grid">
    <div class="card c8"><div class="card-h"><h2>${DOW[menuDay]}: ${int(d.total.kcal)} ккал</h2><span class="sp"></span><span class="small muted">Б ${d.total.p} · Ж ${d.total.f} · У ${d.total.c}</span></div>
      ${d.meals.map(m => `<div class="mealrow"><div class="row"><span class="tm">${esc(m.time || '')}</span><b class="display" style="font-size:19px">${esc(m.label)}: ${esc(m.name)}</b><span class="sp"></span>${menuDay === today ? `<button class="btn sm ${eaten.has(m.key) ? 'pri' : ''}" data-a="ate-plan" data-k="${m.key}">${eaten.has(m.key) ? 'Записано' : 'Съел по плану'}</button>` : ''}</div>
        <div class="small muted" style="margin:4px 0 0 52px">${m.lines.map(esc).join(' · ')}</div>
        <div class="tiny muted" style="margin:2px 0 0 52px">${m.kcal} ккал · Б ${m.p} · Ж ${m.f} · У ${m.c}${m.note ? ' · ' + esc(m.note) : ''}</div></div>`).join('')}
    </div>
    <div class="c4 col" style="gap:14px">
      <div class="card"><div class="card-h"><h2>Готовка</h2></div>${M.prep.map(x => `<div class="small" style="margin-bottom:8px">${esc(x.text)}</div>`).join('')}</div>
      <div class="card"><div class="card-h"><h2>Если не по плану</h2></div>${QUICK_OPTIONS.map(x => `<div class="small" style="margin-bottom:8px">${esc(x)}</div>`).join('')}</div>
    </div>
    <div class="card c12"><div class="card-h"><h2>Список покупок на неделю</h2><span class="sp"></span><button class="btn sm" data-a="copy-shop">Копировать</button></div>
      <div class="shop">${Object.entries(shop).map(([g, items]) => `<div><div class="tiny muted" style="text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">${g}</div>${items.map(i => `<label class="toggle small" style="display:flex;margin:3px 0"><input type="checkbox"> ${esc(i)}</label>`).join('')}</div>`).join('')}</div></div>
  </div>`;
}

// ---------------- программа тренировок ----------------
function training(D) {
  const wk = D.programWeek, ph = phaseFor(wk), place = D.settings.trainPlace || 'gym';
  const base = (() => { const v = rangeKeys(D.today, 14).map(k => D.daily[k]?.steps).filter(Boolean); return v.length ? v.reduce((a, b) => a + b) / v.length : null; })();
  const st = stepsTarget(base, wk, D.settings.goalDate ? Math.max(10000, D.settings.stepsTarget || 0) : (D.settings.stepsTarget || 9000));
  const sess = l => trainingSession(l, wk, place);
  const hist = D.workouts.filter(w => w.session).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 6);
  return `<div class="note" style="margin-bottom:12px">Неделя ${wk} из 12, фаза «${ph.name}»: ${ph.sets} подхода по ${ph.reps}, усилие ${ph.rpe}, отдых ${ph.rest}. Место: ${place === 'home' ? 'дома' : 'зал'}. Следующая по очереди: <b>${D.nextLetter}</b>.${D.settings.healthLimits ? ` Учтены ограничения из анкеты: ${esc(D.settings.healthLimits)}. При сомнениях согласуй нагрузку с врачом.` : ''}</div>
  <div class="grid">${['A', 'B', 'C'].map(l => { const x = sess(l); return `<div class="card c4 ${l === D.nextLetter ? 'now' : ''}" style="${l === D.nextLetter ? '' : 'animation:none'}"><div class="card-h"><h2>${esc(x.title)}</h2></div>
      <div class="tiny muted" style="margin-bottom:8px">${x.minutes} мин · разминка: ${esc(x.warmup)}</div>
      ${x.items.map(e => `<div class="exrow"><div><b>${esc(e.name)}</b><div class="tiny muted">${esc(e.cue)}</div></div><span class="chip">${e.sets} × ${esc(e.reps)}</span></div>`).join('')}
      ${l === D.nextLetter ? `<div class="row" style="margin-top:10px"><button class="btn pri" data-a="timer-start" data-cat="workout" data-min="${x.minutes}">${icon('play')}Начать</button><button class="btn" data-a="workout-done" data-l="${l}" data-min="${x.minutes}">Сделал</button></div>` : ''}</div>`; }).join('')}
    <div class="card c6"><div class="card-h"><h2>Шаги</h2></div><div class="display" style="font-size:34px">${int(st)}</div><div class="small muted">цель на эту неделю${base ? `, сейчас в среднем ${int(base)}` : ''}. +1000 каждые 2 недели до ${int(D.settings.stepsTarget || 9000)}.</div></div>
    <div class="card c6"><div class="card-h"><h2>Правила прогрессии</h2></div>${PROGRESSION.map(x => `<div class="small" style="margin-bottom:6px">${esc(x)}</div>`).join('')}</div>
    <div class="card c12"><div class="card-h"><h2>Последние тренировки по программе</h2></div><div class="list">${hist.map(w => `<div class="li"><div class="t"><div>${esc(w.type)}</div><div class="m">${fmtDate(w.date, true)} · ${dur(w.minutes)}</div></div></div>`).join('') || '<div class="small muted">Пока нет. Первая: тренировка A.</div>'}</div></div>
  </div>`;
}

// ---------------- питание ----------------
function food(D) {
  const day = foodDay || D.today;
  const f = D.foodByDay[day] || { kcal: 0, p: 0, f: 0, c: 0, items: [] };
  const t = D.targets;
  const water = D.waterByDay[day] || 0;
  const lib = store.all('foodlib').sort((a, b) => (b.uses || 0) - (a.uses || 0));
  const m = (l, v, tg, unit, color) => `<div><div class="row small"><span>${l}</span><span class="sp"></span><b class="num">${Math.round(v)}${tg ? ` / ${tg}` : ''} ${unit}</b></div>${meter(tg ? v / tg : 0, color)}</div>`;
  return `<div class="row wrap" style="margin-bottom:12px"><button class="btn sm" data-a="food-day" data-v="-1">←</button><b>${day === D.today ? 'Сегодня' : fmtDate(day, true)}</b><button class="btn sm" data-a="food-day" data-v="1" ${day >= D.today ? 'disabled' : ''}>→</button><span class="sp"></span>
    <button class="btn sm" data-a="food-copy">Повторить вчера</button><button class="btn pri sm" data-a="food-add" data-date="${day}">${icon('plus')}Еда</button></div>
  <div class="grid">
    <div class="card c4"><div class="card-h"><h2>Итог дня</h2></div><div class="col" style="gap:12px">
      ${m('Калории', f.kcal, t?.kcal, 'ккал', f.kcal > (t?.kcal || 1e9) * 1.08 ? 'var(--warn)' : 'var(--accent)')}
      ${m('Белки', f.p, t?.protein, 'г', 'var(--c4)')}${m('Жиры', f.f, t?.fat, 'г', 'var(--c5)')}${m('Углеводы', f.c, t?.carbs, 'г', 'var(--c3)')}
      <div><div class="row small"><span>Вода</span><span class="sp"></span><b>${num(water / 1000, 1)} / ${num(D.settings.waterTargetMl / 1000, 1)} л</b></div>${meter(water / D.settings.waterTargetMl, 'var(--cat-recovery)')}
        <div class="row" style="margin-top:6px;gap:6px">${[200, 250, 330, 500].map(v => `<button class="btn sm" data-a="water-day" data-v="${v}" data-date="${day}">+${v}</button>`).join('')}</div></div>
      ${t ? `<div class="tiny muted">Цель: дефицит ≈${t.deficit} ккал/день, ожидаемый темп ${num(t.expectedKgWeek, 2)} кг/нед. Белок ${t.protein} г сохраняет мышцы. Расход: ${esc(t.source)}.</div>` : '<div class="tiny muted">Укажи рост, возраст и вес, чтобы получить цель.</div>'}
    </div></div>
    <div class="card c8">${MEALS.map(([mk, ml]) => { const items = f.items.filter(x => (x.meal || 'snack') === mk); return `<div class="card-h" style="margin:6px 0 2px"><h3>${ml}</h3><span class="muted small">${items.length ? int(sum(items.map(x => +x.kcal || 0))) + ' ккал' : ''}</span><span class="sp"></span><button class="btn ghost sm" data-a="food-add" data-date="${day}" data-meal="${mk}">${icon('plus')}</button></div>
      <div class="list">${items.map(x => `<div class="li"><div class="t"><div>${esc(x.name)}</div><div class="m">${x.grams ? x.grams + ' г · ' : ''}Б ${num(x.p, 0)} · Ж ${num(x.f, 0)} · У ${num(x.c, 0)}</div></div><b class="num">${int(x.kcal)}</b><button class="btn ghost sm" data-a="food-del" data-id="${x.id}">${icon('x')}</button></div>`).join('') || '<div class="small muted" style="padding:4px 4px 8px">-</div>'}</div>`; }).join('')}</div>
    <div class="card c12"><div class="card-h"><h2>Мои продукты и блюда</h2><span class="muted small">на 100 г, для быстрого ввода</span><span class="sp"></span><button class="btn sm" data-a="lib-add">${icon('plus')}Добавить</button></div>
      ${lib.length ? `<table class="t"><tr><th>Название</th><th class="tr">ккал</th><th class="tr">Б</th><th class="tr">Ж</th><th class="tr">У</th><th class="tr">порция</th><th></th></tr>${lib.map(x => `<tr><td>${esc(x.name)}</td><td class="tr">${int(x.kcal100)}</td><td class="tr">${num(x.p100, 1)}</td><td class="tr">${num(x.f100, 1)}</td><td class="tr">${num(x.c100, 1)}</td><td class="tr">${x.portion || 100} г</td><td class="tr"><button class="btn ghost sm" data-a="lib-edit" data-id="${x.id}">${icon('edit')}</button></td></tr>`).join('')}</table>` : '<div class="empty">Добавь продукты, которые ешь часто: дальше ввод займёт 2 касания.</div>'}</div>
  </div>`;
}

function foodForm(D, date, meal) {
  const lib = store.all('foodlib').sort((a, b) => (b.uses || 0) - (a.uses || 0));
  return `<form data-f="food" class="col"><input type="hidden" name="date" value="${date}">
    ${lib.length ? `<label class="f">Из моих продуктов<select name="lib" id="ff-lib"><option value="">Ввести вручную</option>${opts(lib.map(x => [x.id, `${x.name} · ${int(x.kcal100)} ккал/100 г`]), '')}</select></label>
    <label class="f">Граммы<input type="number" name="grams" id="ff-g" min="1" placeholder="100"></label><hr style="margin:2px 0">` : ''}
    <input type="text" name="name" placeholder="Название (если вручную)">
    <div class="fg"><label class="f">Ккал<input type="number" name="kcal" min="0"></label><label class="f">Белки, г<input type="number" name="p" min="0" step="0.1"></label><label class="f">Жиры, г<input type="number" name="f" min="0" step="0.1"></label><label class="f">Углеводы, г<input type="number" name="c" min="0" step="0.1"></label></div>
    <label class="f">Приём пищи<select name="meal">${opts(MEALS, meal || mealNow())}</select></label>
    <label class="toggle"><input type="checkbox" name="save"> Сохранить в мои продукты (значения пересчитаются на 100 г, если указаны граммы)</label>
    <div class="dlg-f"><button class="btn pri">Добавить</button></div></form>`;
}
function libForm(x = {}) {
  return `<form data-f="lib" class="col"><input type="hidden" name="id" value="${esc(x.id || '')}"><input type="text" name="name" placeholder="Название" value="${esc(x.name || '')}" required>
    <div class="fg"><label class="f">Ккал/100 г<input type="number" name="kcal100" value="${x.kcal100 ?? ''}" required></label><label class="f">Б/100 г<input type="number" step="0.1" name="p100" value="${x.p100 ?? ''}"></label><label class="f">Ж/100 г<input type="number" step="0.1" name="f100" value="${x.f100 ?? ''}"></label><label class="f">У/100 г<input type="number" step="0.1" name="c100" value="${x.c100 ?? ''}"></label><label class="f">Обычная порция, г<input type="number" name="portion" value="${x.portion ?? 100}"></label></div>
    <div class="dlg-f">${x.id ? `<button type="button" class="btn danger" data-a="lib-del" data-id="${x.id}">Удалить</button><span class="sp"></span>` : ''}<button class="btn pri">Сохранить</button></div></form>`;
}

// ---------------- вес и тело ----------------
function body(D) {
  const t = D.targets, rate = E.weeklyRate(D.trend, D.today);
  const recent = D.weights.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 12);
  const ms = D.measures.slice().reverse();
  const first = D.measures[0], last = D.measures.at(-1);
  const delta = (k) => first && last && first !== last && first[k] && last[k] ? last[k] - first[k] : null;
  return `<div class="grid">
    <div class="card c8"><div class="card-h"><h2>Вес и тренд</h2><span class="sp"></span><button class="btn sm pri" data-a="weight-add">${icon('plus')}Вес</button></div>${weightChart(D)}
      <div class="tiny muted" style="margin-top:8px">Дневные колебания 0,5-1,5 кг это вода и соль, не жир. Решения принимаются только по тренду за 2-3 недели.</div></div>
    <div class="card c4"><div class="card-h"><h2>Цели и темп</h2></div>${t ? `<div class="col small">
      <div class="row"><span>Тренд</span><span class="sp"></span><b>${num(t.current, 1)} кг</b></div>
      <div class="row"><span>Темп за 3 недели</span><span class="sp"></span><b>${rate == null ? '-' : num(rate, 2) + ' кг/нед'}</b></div>
      <div class="row"><span>Цель по весу</span><span class="sp"></span><b>${D.settings.goalWeightKg ? num(D.settings.goalWeightKg, 1) + ' кг' : '<a data-a="go" data-v="settings">задать</a>'}</b></div>
      ${t.byDate ? `<div class="row"><span>Срок цели</span><span class="sp"></span><b>${fmtDate(t.byDate.date)} (${t.byDate.weeks} нед)</b></div>
      <div class="row"><span>Нужно в неделю</span><span class="sp"></span><b>${num(t.byDate.needKgWeek, 2)} кг (${num(t.byDate.needPct, 1)}%)</b></div>
      <div class="row"><span>План даёт</span><span class="sp"></span><b>${num(t.byDate.planKgWeek, 2)} кг/нед</b></div>
      <div class="note ${t.byDate.feasible ? 'good' : 'warn'}" style="margin:4px 0">${t.byDate.feasible ? 'Цель к сроку достижима при этом плане.' : `К сроку реально около ${num(t.byDate.projected, 0)} кг. Быстрее небезопасно: ускоряют шаги и тренировки, а не урезание еды.`}</div>`
      : `<div class="row"><span>Целевой темп</span><span class="sp"></span><b>${num(D.settings.goalRatePct, 1)}% веса/нед</b></div>`}
      <hr style="margin:6px 0"><div class="row"><span>Расход по формуле</span><span class="sp"></span><b>${int(t.formula)}</b></div>
      ${t.watch ? `<div class="row"><span>Расход по Apple Watch</span><span class="sp"></span><b>${int(t.watch)}</b></div>` : ''}
      ${t.adaptive ? `<div class="row"><span>По факту (еда и вес)</span><span class="sp"></span><b>${int(t.adaptive)}</b></div>` : `<div class="tiny muted">Фактический расход появится после 12+ дней записи питания за 3 недели.</div>`}
      <div class="row"><span>Итоговая оценка</span><span class="sp"></span><b>${int(t.tdee)} ккал</b></div>
      <div class="row"><span>Цель питания</span><span class="sp"></span><b>${int(t.kcal)} ккал</b></div>
      <div class="tiny muted">Дефицит ограничен 25% расхода и нижней границей ${D.settings.sex === 'f' ? 1200 : 1500} ккал. Безопасный темп: 0,5-1% веса в неделю.</div></div>` : '<div class="muted small">Добавь первое взвешивание и заполни рост и возраст в настройках.</div>'}</div>
    <div class="card c6"><div class="card-h"><h2>Последние взвешивания</h2></div><div class="list">${recent.map(w => `<div class="li"><div class="t"><div>${fmtDate(w.date, true)}</div><div class="m">${w.src === 'health' ? 'Apple Health' : 'вручную'}</div></div><b class="num">${num(w.kg, 1)} кг</b>${w.id ? `<button class="btn ghost sm" data-a="weight-del" data-id="${w.id}">${icon('x')}</button>` : ''}</div>`).join('') || '<div class="empty">Нет данных</div>'}</div></div>
    <div class="card c6"><div class="card-h"><h2>Окружности</h2><span class="sp"></span><button class="btn sm" data-a="measure-add">${icon('plus')}Замер</button></div>
      ${ms.length ? `<table class="t"><tr><th>Дата</th><th class="tr">Талия</th><th class="tr">Бёдра</th><th class="tr">Грудь</th><th class="tr">Шея</th><th class="tr">Плечо</th><th class="tr">Бедро</th></tr>
      ${ms.slice(0, 8).map(m => `<tr><td>${fmtDate(m.date)}</td>${['waist', 'hips', 'chest', 'neck', 'arm', 'thigh'].map(k => `<td class="tr">${m[k] ? num(m[k], 1) : '-'}</td>`).join('')}</tr>`).join('')}
      ${delta('waist') != null ? `<tr><td class="muted">Изменение</td>${['waist', 'hips', 'chest', 'neck', 'arm', 'thigh'].map(k => { const d = delta(k); return `<td class="tr ${d < 0 ? 'good' : ''}">${d == null ? '' : (d > 0 ? '+' : '') + num(d, 1)}</td>`; }).join('')}</tr>` : ''}</table>
      <div class="tiny muted" style="margin-top:6px">Замеры раз в 2 недели утром. Талия часто уменьшается, даже когда вес стоит.</div>` : '<div class="empty">Окружности показывают прогресс, который не видно по весам.</div>'}</div>
  </div>`;
}

// ---------------- активность ----------------
function activity(D) {
  const keys = rangeKeys(D.today, Math.min(range, 60));
  const wo = D.workouts.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 15);
  const hw = D.samples.filter(s => s.type === 'workout').sort((a, b) => a.start_at < b.start_at ? 1 : -1).slice(0, 10);
  return `<div class="grid">
    <div class="card c6"><div class="card-h"><h2>Шаги</h2></div>${stepsChart(D)}</div>
    <div class="card c6"><div class="card-h"><h2>Активная энергия и минуты упражнений</h2></div>${bars({ data: keys.map(k => ({ label: fmtDate(k).split(' ')[0], parts: [{ v: D.daily[k]?.exercise_min || 0, color: 'var(--cat-workout)', name: 'мин упражнений' }] })), yFmt: v => int(v), target: 30 })}
      <div class="legend"><span><i style="background:var(--cat-workout)"></i>минуты упражнений (Apple Watch), пунктир: 30 мин</span></div></div>
    <div class="card c6"><div class="card-h"><h2>Тренировки</h2><span class="sp"></span><button class="btn sm pri" data-a="workout-add">${icon('plus')}Тренировка</button></div>
      <div class="list">${wo.map(w => `<div class="li"><div class="t"><div>${esc(w.type || 'Тренировка')}</div><div class="m">${fmtDate(w.date, true)} · ${dur(w.minutes)}${w.intensity ? ' · интенсивность ' + w.intensity + '/5' : ''}</div></div><button class="btn ghost sm" data-a="workout-del" data-id="${w.id}">${icon('x')}</button></div>`).join('')}
      ${hw.map(s => `<div class="li"><div class="t"><div>${esc(s.value_text || 'Тренировка')} <span class="chip">Apple Watch</span></div><div class="m">${fmtDate(dkey(new Date(s.start_at)), true)} · ${dur((new Date(s.end_at) - new Date(s.start_at)) / 60000)}</div></div></div>`).join('')}
      ${!wo.length && !hw.length ? '<div class="empty">Тренировки с часов придут из Apple Health, ручные можно добавить здесь.</div>' : ''}</div></div>
    <div class="card c6"><div class="card-h"><h2>Прогрессия нагрузки</h2></div>${progression(D)}</div>
  </div>`;
}
function progression(D) {
  const weeks = [0, 1, 2, 3].map(i => { const ws = addDays(weekStart(D.today), -7 * i); return { ws, n: rangeKeys(addDays(ws, 6), 7).filter(k => D.workoutsByDay[k]).length, steps: mean(rangeKeys(addDays(ws, 6), 7).filter(k => k <= D.today).map(k => D.daily[k]?.steps)) }; }).reverse();
  const consistent = weeks.slice(0, 3).every(w => w.n >= D.settings.workoutsPerWeek);
  return `<table class="t"><tr><th>Неделя</th><th class="tr">Тренировки</th><th class="tr">Шаги/день</th></tr>${weeks.map(w => `<tr><td>с ${fmtDate(w.ws)}</td><td class="tr">${w.n}/${D.settings.workoutsPerWeek}</td><td class="tr">${w.steps ? int(w.steps) : '-'}</td></tr>`).join('')}</table>
    <div class="note ${consistent ? 'good' : ''}" style="margin-top:10px">${consistent ? 'Три недели подряд цель выполнена: можно добавить 10 минут к тренировке или +1000 шагов к цели. Повышай один параметр за раз.' : 'Нагрузка повышается только после 3 стабильных недель. Пропуски не копятся в долг: план каждой недели считается заново.'}</div>`;
}

// ---------------- сон ----------------
function sleep(D) {
  const st = E.sleepStats(D.nights, D.today, 14);
  const last = D.nights[D.today] || D.nights[addDays(D.today, -1)];
  const recent = rangeKeys(D.today, 14).reverse().map(k => D.nights[k]).filter(Boolean);
  return `<div class="kpis" style="margin-bottom:14px">
    <div class="kpi"><div class="l">Средний сон, 14 ночей</div><div class="v">${st.avgMin ? dur(st.avgMin) : '-'}</div><div class="s">цель ${num(D.settings.sleepTargetH, 1)} ч</div></div>
    <div class="kpi"><div class="l">Отход ко сну, среднее</div><div class="v">${st.avgBed != null ? hm((st.avgBed + 1440) % 1440) : '-'}</div><div class="s">план ${D.settings.bedtime}</div></div>
    <div class="kpi"><div class="l">Пробуждение, среднее</div><div class="v">${st.avgWake != null ? hm(st.avgWake) : '-'}</div></div>
    <div class="kpi"><div class="l">Регулярность</div><div class="v">${st.bedSdMin != null ? '±' + Math.round(st.bedSdMin) : '-'}<small>мин</small></div><div class="s">разброс времени отбоя</div></div>
  </div>
  <div class="grid"><div class="card c8"><div class="card-h"><h2>Длительность и фазы</h2><span class="sp"></span><button class="btn sm" data-a="sleep-log">${icon('plus')}Вручную</button></div>${sleepChart(D)}
    <div class="legend"><span><i style="background:#3b4bb8"></i>глубокий</span><span><i style="background:var(--cat-sleep)"></i>основной</span><span><i style="background:#9aa6f0"></i>REM</span><span>пунктир: цель</span></div></div>
  <div class="card c4"><div class="card-h"><h2>Последняя ночь</h2></div>${last ? `<div class="col small">
    <div class="row"><span>Сон</span><span class="sp"></span><b>${dur(last.asleepMin)}</b></div>
    <div class="row"><span>Лёг / встал</span><span class="sp"></span><b>${hm(new Date(last.bedAt).getHours() * 60 + new Date(last.bedAt).getMinutes())} → ${hm(new Date(last.wakeAt).getHours() * 60 + new Date(last.wakeAt).getMinutes())}</b></div>
    ${last.hasStages ? `<div class="row"><span>Глубокий</span><span class="sp"></span><b>${dur(last.deepMin)}</b></div><div class="row"><span>REM</span><span class="sp"></span><b>${dur(last.remMin)}</b></div><div class="row"><span>Основной</span><span class="sp"></span><b>${dur(last.coreMin)}</b></div>` : ''}
    <div class="row"><span>Пробуждения</span><span class="sp"></span><b>${dur(last.awakeMin || 0)}</b></div>
    <div class="tiny muted">Фазы оцениваются Apple Watch и не равны полисомнографии.</div></div>` : '<div class="muted small">Нет данных сна.</div>'}</div>
  <div class="card c12"><table class="t"><tr><th>Ночь на</th><th class="tr">Сон</th><th class="tr">Отбой</th><th class="tr">Подъём</th><th class="tr">Источник</th></tr>${recent.map(n => `<tr><td>${fmtDate(n.date, true)}</td><td class="tr">${dur(n.asleepMin)}</td><td class="tr">${hm((new Date(n.bedAt).getHours() * 60 + new Date(n.bedAt).getMinutes()))}</td><td class="tr">${hm(new Date(n.wakeAt).getHours() * 60 + new Date(n.wakeAt).getMinutes())}</td><td class="tr muted">${n.source === 'health' ? 'Apple Health' : 'вручную'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Нет данных</td></tr>'}</table></div></div>`;
}

// ---------------- показатели ----------------
function vitals(D) {
  const keys = rangeKeys(D.today, range);
  const metric = (field, name, unit, digits = 0) => {
    const vals = keys.map(k => D.daily[k]?.[field] ?? null);
    const have = vals.filter(v => v != null);
    const base = have.length >= 7 ? have.slice(-28) : null;
    return `<div class="card c6"><div class="card-h"><h2>${name}</h2><span class="sp"></span><span class="muted small">${have.length ? `последнее ${num(have.at(-1), digits)} ${unit}${base ? ` · медиана ${num(base.slice().sort((a, b) => a - b)[Math.floor(base.length / 2)], digits)}` : ''}` : 'нет данных'}</span></div>
      ${have.length >= 2 ? line({ labels: labels(keys), series: [{ values: vals, color: 'var(--accent)', dots: true, r: 1.8 }], height: 150, yFmt: v => num(v, digits) }) : '<div class="empty small">Появится после передачи данных из Apple Health</div>'}</div>`;
  };
  return `<div class="note" style="margin-bottom:14px">Показатели носимых устройств полезны для отслеживания собственной динамики. Одно измерение ничего не значит; приложение реагирует только на устойчивые изменения относительно твоей базы и не ставит диагнозов.</div>
  <div class="grid">${metric('resting_hr', 'Пульс покоя', 'уд/мин')}${metric('hrv', 'HRV (SDNN)', 'мс')}${metric('resp_rate', 'Частота дыхания', '/мин', 1)}${metric('spo2', 'SpO2', '%', 1)}${metric('wrist_temp', 'Температура запястья (отклонение)', '°C', 2)}${metric('hr_max', 'Макс. пульс за день', 'уд/мин')}${metric('bp_sys', 'Давление систолическое', 'мм рт. ст.')}${metric('bp_dia', 'Давление диастолическое', 'мм рт. ст.')}</div>`;
}

// ---------------- действия ----------------
on({
  'menu-day': (ds) => { menuDay = Number(ds.v); window.__rerender(); },
  'ate-plan': (ds) => {
    const D = window.__D; const m = D.menu.days[menuDay].meals.find(x => x.key === ds.k); const id = `fd_plan_${D.today}_${ds.k}`;
    if (store.get(id)) { store.remove(id); return; }
    store.put('food', { id, date: D.today, name: m.name, kcal: m.kcal, p: m.p, f: m.f, c: m.c, meal: { b: 'breakfast', l: 'lunch', s: 'snack', d: 'dinner' }[ds.k], planMeal: ds.k });
    toast(`${m.label}: ${m.kcal} ккал записано`);
  },
  'copy-shop': () => { const sh = shoppingList(window.__D.menu); const txt = Object.entries(sh).map(([g, i]) => g + ':\n' + i.map(x => '- ' + x).join('\n')).join('\n\n'); navigator.clipboard?.writeText(txt).then(() => toast('Список скопирован: вставь в Заметки или Напоминания')).catch(() => toast('Не удалось скопировать')); },
  'workout-done': (ds) => { completeWorkout(ds.l, ds.min, window.__D.today, 'manual_' + ds.l); toast(`Тренировка ${ds.l} записана`); },
  'h-tab': (ds) => { tab = ds.v; window.__rerender(); },
  'h-range': (ds) => { range = Number(ds.v); window.__rerender(); },
  'food-day': (ds) => { const D = window.__D; foodDay = addDays(foodDay || D.today, Number(ds.v)); if (foodDay > D.today) foodDay = D.today; window.__rerender(); },
  'food-add': (ds) => {
    const D = window.__D; const d = modal('Добавить еду', foodForm(D, ds.date || D.today, ds.meal));
    const sel = d.querySelector('#ff-lib'), g = d.querySelector('#ff-g');
    sel?.addEventListener('change', () => { const x = store.get(sel.value); if (x && g) g.value = x.portion || 100; });
  },
  'food-del': (ds) => { const x = store.get(ds.id); store.remove(ds.id); toast('Удалено', () => store.put('food', { ...x, deleted: false })); },
  'food-copy': () => {
    const D = window.__D; const day = foodDay || D.today; const y = D.foodByDay[addDays(day, -1)];
    if (!y) return toast('Вчера записей нет');
    y.items.forEach(({ id, updatedAt, dirty, createdAt, ...x }) => store.put('food', { ...x, date: day }));
    toast(`Скопировано ${y.items.length} записей`);
  },
  'water-day': (ds) => store.put('water', { date: ds.date, ml: Number(ds.v) }),
  'lib-add': () => modal('Продукт', libForm()),
  'lib-edit': (ds) => modal('Продукт', libForm(store.get(ds.id))),
  'lib-del': (ds) => { store.remove(ds.id); close(); },
  'weight-add': () => modal('Взвешивание', `<form data-f="weight" class="col"><div class="fg two"><label class="f">Дата<input type="date" name="date" value="${window.__D.today}" required></label><label class="f">Вес, кг<input type="number" name="kg" step="0.1" min="30" max="300" required autofocus></label></div><div class="tiny muted">Лучше утром после туалета, до еды. Если весы пишут в Apple Health, вводить не нужно.</div><div class="dlg-f"><button class="btn pri">Сохранить</button></div></form>`),
  'weight-del': (ds) => store.remove(ds.id),
  'measure-add': () => modal('Замер окружностей, см', `<form data-f="measure" class="col"><label class="f">Дата<input type="date" name="date" value="${window.__D.today}"></label><div class="fg">${[['waist', 'Талия'], ['hips', 'Бёдра'], ['chest', 'Грудь'], ['neck', 'Шея'], ['arm', 'Плечо'], ['thigh', 'Бедро']].map(([k, l]) => `<label class="f">${l}<input type="number" step="0.1" name="${k}"></label>`).join('')}</div><div class="dlg-f"><button class="btn pri">Сохранить</button></div></form>`),
  'workout-add': () => modal('Тренировка', `<form data-f="workout" class="col"><div class="fg"><label class="f">Дата<input type="date" name="date" value="${window.__D.today}"></label><label class="f">Тип<select name="type">${opts([['Силовая', 'Силовая'], ['Кардио', 'Кардио'], ['Ходьба', 'Ходьба'], ['Бег', 'Бег'], ['Плавание', 'Плавание'], ['Велосипед', 'Велосипед'], ['Мобильность', 'Мобильность / растяжка'], ['Другое', 'Другое']], 'Силовая')}</select></label><label class="f">Минуты<input type="number" name="minutes" value="${window.__D.settings.workoutMin}" min="5"></label><label class="f">Интенсивность 1-5<input type="number" name="intensity" value="3" min="1" max="5"></label></div><input type="text" name="note" placeholder="Заметка: упражнения, веса"><div class="dlg-f"><button class="btn pri">Сохранить</button></div></form>`),
  'workout-del': (ds) => store.remove(ds.id)
});
onForm({
  'food': (o) => {
    let { name, kcal, p, f, c, grams } = o;
    if (o.lib) {
      const x = store.get(o.lib); const g = grams || x.portion || 100; const k = g / 100;
      name = x.name; kcal = x.kcal100 * k; p = (x.p100 || 0) * k; f = (x.f100 || 0) * k; c = (x.c100 || 0) * k; grams = g;
      store.patch(x.id, { uses: (x.uses || 0) + 1 });
    }
    if (!name || kcal == null) return toast('Нужны название и калории');
    store.put('food', { date: o.date, name, kcal: Math.round(kcal), p: Math.round((p || 0) * 10) / 10, f: Math.round((f || 0) * 10) / 10, c: Math.round((c || 0) * 10) / 10, grams: grams || null, meal: o.meal });
    if (o.save && !o.lib) { const k = grams ? 100 / grams : 1; store.put('foodlib', { name, kcal100: Math.round(kcal * k), p100: (p || 0) * k, f100: (f || 0) * k, c100: (c || 0) * k, portion: grams || 100, uses: 1 }); }
    close(); toast(`${name}: ${Math.round(kcal)} ккал`);
  },
  'lib': (o) => { store.put('foodlib', { ...(o.id ? store.get(o.id) : {}), id: o.id || undefined, name: o.name, kcal100: o.kcal100, p100: o.p100 || 0, f100: o.f100 || 0, c100: o.c100 || 0, portion: o.portion || 100 }); close(); },
  'weight': (o) => { store.put('weight', { id: 'wt_' + o.date, date: o.date, kg: o.kg, ts: Date.now() }); close(); toast(`Вес ${o.kg} кг`); },
  'measure': (o) => { const { date, ...rest } = o; store.put('measure', { id: 'ms_' + date, date, ...rest }); close(); },
  'workout': (o) => { store.put('workout', o); close(); toast('Тренировка записана'); }
});
