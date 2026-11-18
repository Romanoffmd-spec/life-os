// Казна: доходы, обязательные расходы, учёт трат, бюджет по категориям, резерв.
// Используются только данные, которые ввёл пользователь. Ничего не выдумывается.
import * as store from '../store.js';
import { esc, int, fmtDate, addDays, sum, dkey } from '../util.js';
import { icon, on, onForm, modal, close, toast, opts } from '../ui.js';
import { bars } from '../charts.js';
import { EXP_CATS } from './comp.js';
import { saveSettings } from '../data.js';

export const title = 'Казна';
let month = null;
const money = v => v == null ? '-' : int(v) + ' ₸';
const MN = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

export function render(D) {
  const s = D.settings; const m = month || D.today.slice(0, 7);
  const exp = D.expenses.filter(e => e.date.startsWith(m));
  const spent = sum(exp.map(e => +e.amount || 0));
  const fixed = sum(D.fixedCosts.map(f => +f.amount || 0));
  const byCat = {}; for (const e of exp) byCat[e.cat] = (byCat[e.cat] || 0) + (+e.amount || 0);
  const budget = s.finBudget || {};
  const income = s.finIncome || null;
  const free = income != null ? income - fixed - spent : null;
  const reserveGoal = (s.finFixed || fixed || 0) * 3;
  const days = new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 0).getDate();
  const daily = Array.from({ length: days }, (_, i) => { const k = `${m}-${String(i + 1).padStart(2, '0')}`; return { label: String(i + 1), parts: [{ v: sum(exp.filter(e => e.date === k).map(e => +e.amount || 0)), color: 'var(--accent)', name: '₸' }] }; });
  const prevM = (() => { const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5)) - 2, 1); return dkey(d).slice(0, 7); })();
  const nextM = (() => { const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5)), 1); return dkey(d).slice(0, 7); })();
  return `<div class="top"><h1>Казна</h1><span class="sp"></span><button class="btn" data-a="fixed-add">${icon('plus')}Обязательный платёж</button><button class="btn pri" data-a="exp-add">${icon('plus')}Расход</button></div>
  ${income == null ? `<div class="note acc" style="margin-bottom:14px">Доход и резерв не указаны: раздел показывает только траты. Укажи их в анкете профиля, если хочешь видеть остаток и прогресс резерва. Это необязательно.</div>` : ''}
  <div class="row wrap" style="margin-bottom:12px"><button class="btn sm" data-a="m-nav" data-v="${prevM}">←</button><b class="display" style="font-size:20px">${MN[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}</b><button class="btn sm" data-a="m-nav" data-v="${nextM}" ${nextM > D.today.slice(0, 7) ? 'disabled' : ''}>→</button></div>
  <div class="kpis" style="margin-bottom:14px">
    <div class="kpi"><div class="l">Потрачено</div><div class="v">${money(spent)}</div><div class="s">${exp.length} записей</div></div>
    <div class="kpi"><div class="l">Обязательные</div><div class="v">${money(fixed)}</div><div class="s">${D.fixedCosts.length} платежей в месяц</div></div>
    <div class="kpi"><div class="l">Доход</div><div class="v">${money(income)}</div><div class="s">${income == null ? 'не указан' : 'из анкеты'}</div></div>
    <div class="kpi"><div class="l">Остаток</div><div class="v ${free != null && free < 0 ? 'bad' : ''}">${money(free)}</div><div class="s">доход минус обязательные и траты</div></div>
    <div class="kpi"><div class="l">Резерв</div><div class="v">${money(s.finReserve ?? null)}</div><div class="s">${reserveGoal ? 'цель ' + money(reserveGoal) + ' (3 месяца)' : 'цель появится после обязательных расходов'}</div></div>
  </div>
  <div class="grid">
    <div class="card c7"><div class="card-h"><h2>По категориям</h2><span class="sp"></span><button class="btn ghost sm" data-a="budget-edit">Бюджет</button></div>
      <div class="col" style="gap:10px">${EXP_CATS.map(([k, l]) => { const v = byCat[k] || 0, b = budget[k]; if (!v && !b) return ''; return `<div><div class="row small"><span>${l}</span><span class="sp"></span><b>${money(v)}${b ? ' / ' + money(b) : ''}</b></div>${b ? `<div class="abar sm"><i style="width:${Math.min(100, v / b * 100)}%;${v > b ? 'background:var(--bad)' : ''}"></i></div>` : ''}</div>`; }).join('') || '<div class="small muted">Трат пока нет. Быстрее всего: «+» и «расход 2500 продукты».</div>'}</div></div>
    <div class="card c5"><div class="card-h"><h2>Обязательные платежи</h2></div><div class="list">${D.fixedCosts.map(f => `<div class="li"><div class="t"><div>${esc(f.name)}</div><div class="m">${f.day ? f.day + '-го числа' : ''}</div></div><b>${money(f.amount)}</b><button class="btn ghost sm" data-a="fixed-del" data-id="${f.id}">${icon('x')}</button></div>`).join('') || '<div class="small muted">Аренда, связь, подписки, кредиты: то, что уходит каждый месяц.</div>'}</div></div>
    <div class="card c12"><div class="card-h"><h2>По дням</h2></div>${bars({ data: daily, yFmt: v => int(v), height: 150 })}</div>
    <div class="card c12"><div class="card-h"><h2>Записи</h2></div><div class="list">${exp.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 40).map(e => `<div class="li"><div class="t"><div>${esc(e.note || (EXP_CATS.find(c => c[0] === e.cat) || [, ''])[1])}</div><div class="m">${fmtDate(e.date, true)} · ${(EXP_CATS.find(c => c[0] === e.cat) || [, ''])[1]}</div></div><b>${money(e.amount)}</b><button class="btn ghost sm" data-a="exp-del" data-id="${e.id}">${icon('x')}</button></div>`).join('') || '<div class="empty">Пусто</div>'}</div></div>
  </div>`;
}

on({
  'm-nav': (ds) => { month = ds.v; window.__rerender(); },
  'exp-add': () => modal('Расход', `<form data-f="exp" class="col"><div class="fg"><label class="f">Сумма, ₸<input type="number" name="amount" min="1" required autofocus></label><label class="f">Категория<select name="cat">${opts(EXP_CATS, 'food')}</select></label><label class="f">Дата<input type="date" name="date" value="${window.__D.today}"></label></div><input type="text" name="note" placeholder="На что"><div class="dlg-f"><button class="btn pri">Сохранить</button></div></form>`),
  'exp-del': (ds) => store.remove(ds.id),
  'fixed-add': () => modal('Обязательный платёж', `<form data-f="fixed" class="col"><input type="text" name="name" placeholder="Аренда, связь, подписка" required><div class="fg two"><label class="f">Сумма в месяц, ₸<input type="number" name="amount" min="1" required></label><label class="f">Число месяца<input type="number" name="day" min="1" max="31"></label></div><div class="dlg-f"><button class="btn pri">Сохранить</button></div></form>`),
  'fixed-del': (ds) => store.remove(ds.id),
  'budget-edit': () => { const b = window.__D.settings.finBudget || {}; modal('Бюджет на месяц', `<form data-f="budget" class="col"><div class="small muted">Лимиты необязательны. Пусто означает «без лимита».</div><div class="fg">${EXP_CATS.map(([k, l]) => `<label class="f">${l}<input type="number" name="${k}" value="${b[k] ?? ''}" min="0"></label>`).join('')}</div><div class="dlg-f"><button class="btn pri">Сохранить</button></div></form>`); }
});
onForm({
  'exp': (o) => { store.put('expense', o); close(); toast(`Расход ${int(o.amount)} ₸`); },
  'fixed': (o) => { store.put('fixed', o); close(); },
  'budget': (o) => { const b = {}; for (const [k, v] of Object.entries(o)) if (v) b[k] = v; saveSettings({ finBudget: b }); close(); }
});
