// «Дела»: задачи, проекты в работе и главные цели. Всё на одном экране.
import * as store from '../store.js';
import { esc, int, num, addDays } from '../util.js';
import { icon, on, onForm, hero, linkRow, toast } from '../ui.js';
import { taskRow } from './comp.js';
import { metricValue } from './plan.js';
import * as E from '../engine.js';

export const title = 'Дела';

export function render(D) {
  const open = E.sortTasks(D.tasks, '9999-12-31');
  const active = D.projects.filter(p => (p.status || 'active') === 'active').sort((a, b) => (a.priority || 9) - (b.priority || 9));
  const goals = D.goals.filter(g => g.horizon === '90d' && g.metric && g.metric.target != null).slice(0, 4);
  const prog = g => { const v = metricValue(D, g.metric.key); if (v == null) return [null, 0]; if (g.metric.dir === 'down') { const st = D.trend[0]?.trend ?? v; const span = st - g.metric.target; return [v, span > 0 ? Math.max(0, Math.min(1, (st - v) / span)) : 0]; } return [v, Math.max(0, Math.min(1, v / g.metric.target))]; };
  return `${hero('deeds', 'Дела', `${open.length} открытых задач · ${active.length} проекта в работе`)}
  <div class="grid">
    <section class="card c7"><div class="card-h"><h2>Задачи</h2></div>
      <form data-f="task-inline" class="row" style="margin-bottom:8px"><input type="text" name="t" placeholder="Новая задача: Enter. «!» в конце = обязательная" autocomplete="off"><button class="btn pri">${icon('plus')}</button></form>
      <div class="list">${open.slice(0, 10).map(t => taskRow(t, D)).join('') || '<div class="empty">Задач нет. Наслаждайся.</div>'}</div>
      ${open.length > 10 ? `<button class="btn ghost sm" data-a="open-plan" data-v="tasks">Ещё ${open.length - 10}</button>` : ''}</section>
    <section class="card c5"><div class="card-h"><h2>В работе</h2><span class="sp"></span><span class="tiny muted">не больше 3</span></div>
      ${active.map(p => `<div class="proj"><div class="display" style="font-size:19px">${esc(p.name)}</div><div class="nextact" data-a="project-next" data-id="${p.id}"><div class="tiny" style="color:var(--accent)">Следующий шаг</div><div class="small">${esc(p.next || 'задать')}</div></div><button class="btn sm" data-a="project-step" data-id="${p.id}">${icon('check')}Шаг сделан</button></div>`).join('') || '<div class="small muted">Нет активных проектов.</div>'}</section>
    <section class="card c12"><div class="card-h"><h2>Цели на 90 дней</h2></div>
      <div class="goalgrid">${goals.map(g => { const [v, f] = prog(g); return `<div><div class="small"><b>${esc(g.title)}</b></div><div class="abar"><i style="width:${Math.round(f * 100)}%"></i></div><div class="tiny muted">${v == null ? 'нет данных' : 'сейчас ' + (g.metric.unit === 'кг' ? num(v, 1) : int(v)) + ' ' + g.metric.unit}</div></div>`; }).join('')}</div></section>
  </div>
  ${linkRow([['open-plan', 'strategy', 'Вся стратегия: от недели до 3 лет', 'plan'], ['open-plan', 'projects', 'Все проекты и ожидание', 'learn'], ['open-plan', 'week', 'Неделя и дежурства', 'today'], ['open-plan', 'tasks', 'Все задачи', 'habits']])}`;
}
on({ 'open-plan': (ds) => { window.__go('plan'); setTimeout(() => document.querySelector(`[data-a="plan-tab"][data-v="${ds.v}"]`)?.click(), 30); } });
onForm({ 'task-inline': (o, form) => { let t = (o.t || '').trim(); if (!t) return; const must = /!\s*$/.test(t); t = t.replace(/!\s*$/, '').trim(); store.put('task', { title: t, priority: must ? 'must' : 'should', energy: 'light', done: false, due: must ? window.__D.today : null }); form.reset(); toast('Задача добавлена'); } });
