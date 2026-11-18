// Планирование: задачи, проекты, неделя, расписание дежурств, экспорт плана в календарь.
import * as store from '../store.js';
import * as E from '../engine.js';
import { esc, hm, dur, fmtDate, wdShort, addDays, rangeKeys, weekStart, parseKey, pad, num, int } from '../util.js';
import { icon, on, onForm, modal, close, toast, seg, opts } from '../ui.js';
import { taskRow } from './comp.js';
import { HORIZONS, TIERS } from '../content/strategy.js';
import { sleepStats } from '../engine.js';
import { mean, sum as S } from '../util.js';
import { blockList } from './today.js';

export const title = 'Задания';
let tab = 'tasks', filter = 'open', previewDay = null, horizon = '90d';

export function render(D) {
  return `<div class="top"><h1>Задания</h1><span class="sp"></span><button class="btn pri" data-a="task-new">${icon('plus')}Задача</button></div>
  <div class="tabs">${[['tasks', 'Задачи'], ['strategy', 'Стратегия'], ['projects', 'Проекты'], ['week', 'Неделя']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-a="plan-tab" data-v="${k}">${l}</button>`).join('')}</div>
  ${tab === 'tasks' ? tasks(D) : tab === 'week' ? week(D) : tab === 'strategy' ? strategy(D) : projects(D)}`;
}

function tasks(D) {
  const open = D.tasks.filter(t => !t.done);
  const list = filter === 'done' ? D.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 50)
    : E.sortTasks(D.tasks, '9999-12-31').filter(t => filter === 'open' || t.priority === filter);
  const groups = filter === 'open' ? [['must', 'Обязательно'], ['should', 'Желательно'], ['could', 'Дополнительно']] : null;
  const overdue = open.filter(t => t.due && t.due < D.today);
  return `<div class="grid"><div class="card c8">
    <div class="card-h">${seg('task-filter', [['open', 'Все открытые'], ['must', 'Обязательные'], ['should', 'Желательные'], ['could', 'Доп.'], ['done', 'Сделано']], filter)}</div>
    ${overdue.length ? `<div class="note warn" style="margin-bottom:10px">Просрочено: ${overdue.length}. <a data-a="tasks-reschedule" style="cursor:pointer">Перенести на сегодня/неделю</a> или пересмотреть приоритет.</div>` : ''}
    ${groups ? groups.map(([p, l]) => { const g = list.filter(t => (t.priority || 'should') === p); return g.length ? `<div class="small muted" style="margin:8px 0 2px">${l} · ${g.length}</div><div class="list">${g.map(t => taskRow(t, D)).join('')}</div>` : ''; }).join('') || '<div class="empty">Открытых задач нет</div>'
      : `<div class="list">${list.map(t => taskRow(t, D)).join('') || '<div class="empty">Пусто</div>'}</div>`}
  </div>
  <div class="c4 col" style="gap:14px">
    <div class="card"><div class="card-h"><h2>Как это работает</h2></div><div class="small muted col" style="gap:6px">
      <div><b>Обязательно</b>: попадает в план дня первым, в минимальный день остаётся одна такая задача.</div>
      <div><b>Желательно</b>: в блок «Быстрые дела» или фокус-блок, если есть силы.</div>
      <div><b>Дополнительно</b>: только когда всё остальное сделано.</div>
      <div>Задачи «с концентрацией» ставятся только в фокус-блоки сильных дней, а не в усталый вечер.</div></div></div>
    <div class="card"><div class="card-h"><h2>Нагрузка</h2></div>${load(D)}</div>
  </div></div>`;
}

function load(D) {
  const open = D.tasks.filter(t => !t.done);
  const wEnd = addDays(weekStart(D.today), 6);
  const thisWeek = open.filter(t => t.due && t.due <= wEnd);
  const mins = thisWeek.reduce((s, t) => s + (t.estimate || 30), 0);
  return `<div class="col small"><div class="row"><span>Открыто</span><span class="sp"></span><b>${open.length}</b></div>
    <div class="row"><span>Со сроком до конца недели</span><span class="sp"></span><b>${thisWeek.length} · ${dur(mins)}</b></div>
    <div class="row"><span>Без оценки времени</span><span class="sp"></span><b>${open.filter(t => !t.estimate).length}</b></div>
    <div class="tiny muted">Реальная ёмкость будних вечеров для задач около 20-35 минут в день. Если нагрузка выше, ассистент покажет конфликт.</div></div>`;
}

function week(D) {
  const ws = weekStart(previewDay || D.today);
  const days = rangeKeys(addDays(ws, 6), 7);
  const sel = previewDay || D.today;
  const p = D.planFor(sel);
  return `<div class="row wrap" style="margin-bottom:12px"><button class="btn sm" data-a="week-shift" data-v="-7">←</button><b>${fmtDate(ws)} - ${fmtDate(addDays(ws, 6))}</b><button class="btn sm" data-a="week-shift" data-v="7">→</button><span class="sp"></span><button class="btn sm" data-a="duty-plan">${icon('plan')}Отметить дежурства</button></div>
  <div class="grid">
    <div class="card c5"><div class="list">${days.map(k => {
      const x = D.planFor(k);
      const wo = x.plan.blocks.find(b => b.cat === 'workout');
      const st = x.plan.blocks.filter(b => b.cat === 'study').reduce((s, b) => s + b.end - b.start, 0);
      return `<div class="li" data-a="week-day" data-v="${k}" style="cursor:pointer;${k === sel ? 'background:var(--accent-soft);border-radius:8px' : ''}">
        <div style="width:44px"><b>${wdShort(k)}</b><div class="tiny muted">${fmtDate(k)}</div></div>
        <div class="t"><div>${{ work: 'Рабочий', duty: 'Дежурство', postduty: 'После дежурства', off: 'Выходной' }[x.type]}${k === D.today ? ' · сегодня' : ''}</div>
        <div class="m">${[wo ? wo.title : '', st ? `учёба ${dur(st)}` : ''].filter(Boolean).join(' · ') || '-'}</div></div>
        <span class="mode-pill mode-${x.mode}">${E.MODE_LABEL[x.mode]}</span></div>`;
    }).join('')}</div>
    <div class="tiny muted" style="margin-top:8px">Режим будущих дней предварительный: он уточнится утром по сну и самочувствию.</div></div>
    <div class="card c7"><div class="card-h"><h2>${fmtDate(sel, true)}</h2><span class="sp"></span>
      ${seg('week-type', [['work', 'Рабочий'], ['duty', 'Дежурство'], ['postduty', 'После'], ['off', 'Выходной']], p.type, `data-date="${sel}"`)}
      <button class="btn sm" data-a="ics" data-v="${sel}" title="Экспорт в календарь">${icon('download')}.ics</button></div>
      ${p.plan.notes.map(n => `<div class="note" style="margin-bottom:6px">${esc(n)}</div>`).join('')}
      ${blockList(D, p.plan, store.get('ps_' + sel), { interactive: false, isToday: sel === D.today })}</div>
  </div>`;
}

export function metricValue(D, key) {
  const k7 = rangeKeys(D.today, 7);
  switch (key) {
    case 'weight_trend': return D.trend.at(-1)?.trend ?? null;
    case 'sleep_avg7': { const v = sleepStats(D.nights, D.today, 7).avgMin; return v ? v / 60 : null; }
    case 'workouts_week': return k7.filter(k => k >= weekStart(D.today) && D.workoutsByDay[k]).length;
    case 'steps_avg7': return mean(k7.map(k => D.daily[k]?.steps));
    case 'food_days7': return k7.filter(k => D.foodByDay[k]).length;
    case 'topics_done': return D.topics.filter(t => t.done).length;
    case 'usmle_topics': return D.topics.filter(t => t.done && t.track === 'usmle').length;
    case 'reviews': { const from = addDays(D.today, -30); return S(D.cards.map(c => (c.history || []).filter(h => h.d >= from).length)); }
    case 'expense_weeks': return new Set(D.expenses.filter(e => e.date >= addDays(D.today, -27)).map(e => weekStart(e.date))).size;
    case 'reserve': return D.settings.finReserve ?? null;
    case 'leisure_week': return D.leisureLogs.filter(l => l.date >= k7[0] && l.cat !== 'scroll').length;
  }
  return null;
}
function goalProgress(D, g) {
  if (!g.metric) return null;
  const v = metricValue(D, g.metric.key); if (v == null || g.metric.target == null) return { v, frac: null };
  if (g.metric.dir === 'down') {
    const start = D.trend[0]?.trend ?? v; const span = start - g.metric.target;
    return { v, frac: span > 0 ? Math.max(0, Math.min(1, (start - v) / span)) : (v <= g.metric.target ? 1 : 0) };
  }
  return { v, frac: Math.max(0, Math.min(1, v / g.metric.target)) };
}
function strategy(D) {
  const list = D.goals.filter(g => g.horizon === horizon).sort((a, b) => a.tier - b.tier);
  const fmtV = (g, v) => v == null ? 'нет данных' : (g.metric.unit === 'кг' || g.metric.unit === 'ч' ? num(v, 1) : int(v)) + ' ' + g.metric.unit;
  return `<div class="row wrap" style="margin-bottom:12px">${seg('horizon', HORIZONS, horizon)}</div>
  <div class="note" style="margin-bottom:12px">Стратегия собрана из твоей анкеты и данных. Уровни: <b>Основа</b> (здоровье, сон, работа, деньги) не уступает места <b>Росту</b> (обучение, USMLE, наука), а <b>Исследование</b> (новые проекты) получает время последним. Пометка «предварительно» значит, что цель уточнится после анкеты или данных.</div>
  <div class="grid">${list.map(g => { const pr = goalProgress(D, g); return `<div class="card c6 goal ${g.done ? 'isdone' : ''}">
    <div class="row"><span class="chip ${g.tier === 1 ? 'acc' : g.tier === 2 ? 'good' : ''}">${TIERS[g.tier]}</span><span class="chip">${esc(g.cat)}</span>${g.preliminary ? '<span class="chip warn">предварительно</span>' : ''}<span class="sp"></span><span class="check ${g.done ? 'on' : ''}" data-a="goal-done" data-id="${g.id}" title="Достигнуто"></span></div>
    <h3 class="display" style="font-size:21px;margin:10px 0 4px">${esc(g.title)}</h3>
    <div class="small muted">${esc(g.why)}</div>
    ${pr ? `<div class="abar"><i style="width:${Math.round((pr.frac || 0) * 100)}%"></i></div><div class="tiny muted">сейчас: ${fmtV(g, pr.v)}${g.metric.target != null ? ` · цель: ${fmtV(g, g.metric.target)}` : ''}</div>` : ''}
    <details class="fold"><summary>Действия, нагрузка, критерии</summary><div class="small" style="margin-top:6px"><b>Действия:</b> ${g.actions.map(esc).join('; ')}<br><b>В неделю:</b> ${esc(g.weekly)}<br><b>Критерий:</b> ${esc(g.criteria)}<br><b>Когда пересмотреть:</b> ${esc(g.revise)}</div></details>
  </div>`; }).join('') || '<div class="card c12 empty">На этом горизонте целей нет</div>'}</div>`;
}

const PCATS = [['Professional', 'Работа'], ['Academic', 'Академия'], ['Research', 'Наука'], ['Technical', 'Техника'], ['Personal', 'Личное']];
const WIP = 3;
function projects(D) {
  const active = D.projects.filter(p => (p.status || 'active') === 'active').sort((a, b) => (a.priority || 9) - (b.priority || 9));
  const waiting = D.projects.filter(p => p.status === 'waiting').sort((a, b) => (a.priority || 9) - (b.priority || 9));
  const done = D.projects.filter(p => p.status === 'done');
  const card = p => { const ts = D.tasks.filter(t => t.project === p.id && !t.done); return `<div class="card c4"><div class="card-h"><span class="chip">${(PCATS.find(c => c[0] === p.cat) || [, 'Проект'])[1]}</span>${p.preliminary ? '<span class="chip warn">проверь статус</span>' : ''}<span class="sp"></span><button class="btn ghost sm" data-a="project-edit" data-id="${p.id}">${icon('edit')}</button></div>
    <h3 class="display" style="font-size:21px;margin-bottom:4px">${esc(p.name)}</h3>${p.goal ? `<div class="small muted">${esc(p.goal)}</div>` : ''}
    <div class="nextact" data-a="project-next" data-id="${p.id}"><div class="tiny" style="color:var(--accent);font-family:var(--caps);letter-spacing:.1em">Следующее действие</div><div>${esc(p.next || 'не задано: нажми, чтобы задать')}</div></div>
    ${p.deadline ? `<div class="tiny muted">срок: ${fmtDate(p.deadline)}</div>` : ''}
    ${ts.length ? `<div class="list">${ts.slice(0, 4).map(t => taskRow(t, D, { compact: true })).join('')}</div>` : ''}
    <div class="row" style="margin-top:8px"><button class="btn sm" data-a="project-step" data-id="${p.id}">${icon('check')}Шаг сделан</button><button class="btn ghost sm" data-a="task-new" data-project="${p.id}">${icon('plus')}Задача</button></div></div>`; };
  return `<div class="row" style="margin-bottom:12px"><button class="btn" data-a="project-new">${icon('plus')}Проект</button><span class="sp"></span><span class="small muted">Активных ${active.length} из ${WIP}</span></div>
  <div class="note" style="margin-bottom:12px">Одновременно в работе не больше ${WIP} проектов. Новые идеи попадают в «Ожидание»: так они не теряются и не съедают основу. У каждого проекта всегда есть одно следующее действие на 5-20 минут.</div>
  <div class="grid">${active.map(card).join('') || '<div class="card c12 empty">Нет активных проектов</div>'}</div>
  ${waiting.length ? `<div class="orn">◆</div><h2 style="margin-bottom:10px">Ожидание</h2><div class="card"><div class="list">${waiting.map(p => `<div class="li"><div class="t"><div>${esc(p.name)}</div><div class="m">${(PCATS.find(c => c[0] === p.cat) || [, ''])[1]}${p.next ? ' · ' + esc(p.next) : ''}</div></div><button class="btn sm" data-a="project-activate" data-id="${p.id}">В работу</button></div>`).join('')}</div></div>` : ''}
  ${done.length ? `<div class="orn">◆</div><h2 style="margin-bottom:10px">Завершено</h2><div class="card"><div class="list">${done.map(p => `<div class="li done"><div class="t"><div>${esc(p.name)}</div></div></div>`).join('')}</div></div>` : ''}`;
}

function projectForm(p = {}) {
  return `<form data-f="project" class="col"><input type="hidden" name="id" value="${esc(p.id || '')}">
    <input type="text" name="name" placeholder="Название" value="${esc(p.name || '')}" required>
    <input type="text" name="goal" placeholder="Цель или критерий готовности" value="${esc(p.goal || '')}">
    <label class="f">Следующее действие (5-20 минут, конкретно)<input type="text" name="next" value="${esc(p.next || '')}" placeholder="Например: открыть черновик и написать 3 предложения Methods"></label>
    <div class="fg"><label class="f">Тип<select name="cat">${opts(PCATS, p.cat || 'Personal')}</select></label><label class="f">Статус<select name="status">${opts([['active', 'В работе'], ['waiting', 'Ожидание'], ['done', 'Завершён']], p.status || 'active')}</select></label><label class="f">Срок<input type="date" name="deadline" value="${esc(p.deadline || '')}"></label><label class="f">Приоритет 1-9<input type="number" name="priority" min="1" max="9" value="${p.priority || 5}"></label></div>
    <div class="dlg-f">${p.id ? `<button type="button" class="btn danger" data-a="project-del" data-id="${p.id}">Удалить</button><span class="sp"></span>` : ''}<button class="btn pri">Сохранить</button></div></form>`;
}

function icsFor(D, k) {
  const p = D.planFor(k).plan; const d = parseKey(k);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dt = m => { const x = new Date(d); x.setMinutes(m); return `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`; };
  const ev = p.blocks.filter(b => !['routine', 'commute', 'sleep'].includes(b.cat)).map(b => [
    'BEGIN:VEVENT', `UID:lifeos-${k}-${b.id}@lifeos`, `DTSTAMP:${stamp}`, `DTSTART:${dt(b.start)}`, `DTEND:${dt(b.end)}`, `SUMMARY:${b.title.replace(/[,;]/g, ' ')}`, 'END:VEVENT'].join('\r\n'));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Life OS//RU', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n');
}

on({
  'plan-tab': (ds) => { tab = ds.v; window.__rerender(); },
  'task-filter': (ds) => { filter = ds.v; window.__rerender(); },
  'week-shift': (ds) => { previewDay = addDays(previewDay || window.__D.today, Number(ds.v)); window.__rerender(); },
  'week-day': (ds) => { previewDay = ds.v; window.__rerender(); },
  'week-type': (ds, el) => {
    const date = el.closest('.seg').dataset.date; const id = 'day_' + date; const cur = store.get(id) || {};
    store.put('day', { ...cur, id, date, type: ds.v });
    if (ds.v === 'duty') { const n = addDays(date, 1); const nid = 'day_' + n; if (!store.get(nid)?.type) store.put('day', { ...(store.get(nid) || {}), id: nid, date: n, type: 'postduty' }); toast('Следующий день отмечен как «после дежурства»'); }
  },
  'duty-plan': () => {
    const D = window.__D;
    const days = rangeKeys(addDays(D.today, 41), 42);
    modal('Дежурства на 6 недель', `<form data-f="duties" class="col"><div class="small muted">Отметь дни дежурств: следующий день автоматически станет восстановительным.</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(w => `<div class="tiny muted" style="text-align:center">${w}</div>`).join('')}
      ${Array.from({ length: (parseKey(days[0]).getDay() + 6) % 7 }, () => '<div></div>').join('')}
      ${days.map(k => `<label class="chip" style="justify-content:center;cursor:pointer;height:30px"><input type="checkbox" name="d" data-multi="1" value="${k}" ${D.days[k]?.type === 'duty' ? 'checked' : ''} style="margin:0 3px 0 0">${parseKey(k).getDate()}</label>`).join('')}</div>
      <div class="dlg-f"><button class="btn pri">Сохранить</button></div></form>`);
  },
  'ics': (ds) => {
    const blob = new Blob([icsFor(window.__D, ds.v)], { type: 'text/calendar' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `lifeos-${ds.v}.ics`; a.click();
    toast('Файл .ics: открой его, чтобы добавить план в Apple Calendar или Outlook');
  },
  'tasks-reschedule': () => {
    const D = window.__D;
    D.tasks.filter(t => !t.done && t.due && t.due < D.today).forEach(t => store.patch(t.id, { due: t.priority === 'must' ? D.today : addDays(D.today, 3) }));
    toast('Обязательные перенесены на сегодня, остальные на 3 дня вперёд');
  },
  'project-new': () => modal('Проект', projectForm()),
  'project-edit': (ds) => modal('Проект', projectForm(store.get(ds.id))),
  'project-del': (ds) => { store.remove(ds.id); close(); },
  'horizon': (ds) => { horizon = ds.v; window.__rerender(); },
  'goal-done': (ds) => { const g = store.get(ds.id); store.patch(ds.id, { done: !g.done }); },
  'project-next': (ds) => { const p = store.get(ds.id); modal('Следующее действие', `<form data-f="project-next" class="col"><input type="hidden" name="id" value="${p.id}"><input type="text" name="next" value="${esc(p.next || '')}" placeholder="Конкретно, на 5-20 минут" autofocus><div class="dlg-f"><button class="btn pri">Сохранить</button></div></form>`); },
  'project-step': (ds) => { const p = store.get(ds.id); store.put('note', { date: window.__D.today, text: `${p.name}: сделано «${p.next || 'шаг'}»` }); modal('Шаг сделан. Что дальше?', `<form data-f="project-next" class="col"><input type="hidden" name="id" value="${p.id}"><div class="small muted">Сделано: ${esc(p.next || '')}</div><input type="text" name="next" placeholder="Следующее действие на 5-20 минут" autofocus><div class="dlg-f"><button class="btn pri">Сохранить</button></div></form>`); },
  'project-activate': (ds) => {
    const D = window.__D; const act = D.projects.filter(p => (p.status || 'active') === 'active');
    if (act.length >= WIP) return modal('Сначала освободи место', `<div class="small">В работе уже ${WIP} проекта. Какой поставить на паузу, чтобы взять новый?</div><div class="col" style="margin-top:10px">${act.map(p => `<button class="btn" data-a="project-swap" data-out="${p.id}" data-in="${ds.id}">Пауза: ${esc(p.name)}</button>`).join('')}</div>`);
    store.patch(ds.id, { status: 'active' });
  },
  'project-swap': (ds) => { store.patch(ds.out, { status: 'waiting' }); store.patch(ds.in, { status: 'active' }); close(); toast('Проекты поменялись местами'); }
});
onForm({
  'project': (o) => {
    const D = window.__D; const prev = o.id ? store.get(o.id) : null;
    let status = o.status;
    const activeN = D.projects.filter(p => (p.status || 'active') === 'active' && p.id !== o.id).length;
    if (status === 'active' && (!prev || prev.status !== 'active') && activeN >= WIP) { status = 'waiting'; toast(`В работе уже ${WIP} проекта: новый добавлен в «Ожидание»`); }
    store.put('project', { ...(prev || {}), id: o.id || undefined, name: o.name, goal: o.goal, next: o.next, cat: o.cat, status, deadline: o.deadline || null, priority: o.priority || 5, preliminary: false }); close();
  },
  'project-next': (o) => { store.patch(o.id, { next: o.next, preliminary: false }); close(); },
  'duties': (o) => {
    const D = window.__D; const sel = new Set(o.d || []);
    const days = rangeKeys(addDays(D.today, 41), 42);
    for (const k of days) {
      const id = 'day_' + k; const cur = store.get(id);
      if (sel.has(k) && cur?.type !== 'duty') store.put('day', { ...(cur || {}), id, date: k, type: 'duty' });
      if (!sel.has(k) && cur?.type === 'duty') store.put('day', { ...cur, type: null });
    }
    for (const k of sel) { const n = addDays(k, 1); const id = 'day_' + n; const cur = store.get(id); if (!sel.has(n) && !cur?.type) store.put('day', { ...(cur || {}), id, date: n, type: 'postduty' }); }
    for (const k of days) { const cur = store.get('day_' + k); if (cur?.type === 'postduty' && !sel.has(addDays(k, -1))) store.put('day', { ...cur, type: null }); }
    close(); toast('Дежурства сохранены');
  }
});
