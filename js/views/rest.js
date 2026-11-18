// Отдых и развлечения: полноценная часть системы, а не остаток времени.
import * as store from '../store.js';
import * as E from '../engine.js';
import { esc, dur, num, fmtDate, addDays, rangeKeys, sum, mean, weekStart } from '../util.js';
import { icon, on, onForm, modal, close, toast, seg, opts } from '../ui.js';
import { bars } from '../charts.js';
import { saveSettings } from '../data.js';

export const title = 'Привал';
let funFilter = 'want';

export const LCATS = [['film', 'Фильм / сериал', '#e0779b'], ['game', 'Игры', '#8a5cd0'], ['read', 'Чтение для себя', '#4b5fd6'], ['social', 'Люди, встречи', '#e2a03f'], ['walk', 'Прогулка, природа', '#2f9e6e'], ['hobby', 'Хобби', '#5aa9b8'], ['rest', 'Ничегонеделание', '#a7a49a'], ['scroll', 'Скроллинг, соцсети', '#c2c0b7'], ['other', 'Другое', '#8c8c96']];
const lc = id => LCATS.find(x => x[0] === id) || LCATS.at(-1);

export function render(D) {
  const keys7 = rangeKeys(D.today, 7);
  const logs7 = D.leisureLogs.filter(l => l.date >= keys7[0]);
  const total = sum(logs7.map(l => l.minutes || 0));
  const passive = sum(logs7.filter(l => l.cat === 'scroll').map(l => l.minutes || 0));
  const social = sum(logs7.filter(l => l.cat === 'social').map(l => l.minutes || 0));
  const byCat = {}; for (const l of D.leisureLogs.filter(l => l.date >= addDays(D.today, -60))) { (byCat[l.cat] ||= []).push(l); }
  const restores = Object.entries(byCat).map(([c, ls]) => ({ c, q: mean(ls.map(l => l.quality).filter(Boolean)), n: ls.length })).filter(x => x.q != null && x.n >= 2).sort((a, b) => b.q - a.q);
  const planned = D.plan.blocks.filter(b => b.cat === 'leisure' || b.cat === 'social');
  const want = D.fun.filter(f => f.status === funFilter || (funFilter === 'want' && !f.status));
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(weekStart(D.today), -7 * (7 - i)));
  return `<div class="top"><h1>Привал</h1><span class="sp"></span><button class="btn" data-a="recovery-day">Сделать сегодня днём восстановления</button><button class="btn pri" data-a="leisure-add">${icon('plus')}Отметить отдых</button></div>
  <div class="kpis" style="margin-bottom:14px">
    <div class="kpi"><div class="l">Сегодня в плане</div><div class="v">${dur(sum(planned.map(b => b.end - b.start)))}</div><div class="s">гарантированный минимум ${dur(D.settings.leisureMinDaily)}</div></div>
    <div class="kpi"><div class="l">Отдых за 7 дней</div><div class="v">${dur(total)}</div><div class="s">по отметкам</div></div>
    <div class="kpi"><div class="l">Время с людьми</div><div class="v">${dur(social)}</div><div class="s">за 7 дней</div></div>
    <div class="kpi"><div class="l">Доля скроллинга</div><div class="v ${total && passive / total > 0.4 ? 'warn' : ''}">${total ? Math.round(passive / total * 100) : 0}<small>%</small></div><div class="s">ориентир: меньше 30%</div></div>
  </div>
  <div class="grid">
    <div class="card c7"><div class="card-h"><h2>Хочу посмотреть, поиграть, сделать</h2><span class="sp"></span>${seg('fun-filter', [['want', 'Хочу'], ['planned', 'Запланировано'], ['done', 'Было']], funFilter)}<button class="btn ghost sm" data-a="fun-add">${icon('plus')}</button></div>
      <div class="list">${want.map(f => `<div class="li"><div class="t"><div>${esc(f.title)}</div><div class="m">${lc(f.cat)[1]}${f.date ? ' · ' + fmtDate(f.date, true) : ''}${f.note ? ' · ' + esc(f.note) : ''}</div></div>
        ${f.status !== 'done' ? `<button class="btn sm" data-a="fun-plan" data-id="${f.id}">${f.status === 'planned' ? 'Перенести' : 'Запланировать'}</button><button class="btn sm" data-a="fun-done" data-id="${f.id}">Было</button>` : ''}<button class="btn ghost sm" data-a="fun-del" data-id="${f.id}">${icon('x')}</button></div>`).join('') || '<div class="empty">Список приятных дел помогает отдыхать осознанно: вместо «залипнуть в телефон» есть готовый выбор.</div>'}</div></div>
    <div class="c5 col" style="gap:14px">
      <div class="card"><div class="card-h"><h2>Что реально восстанавливает</h2></div>${restores.length ? `<div class="list">${restores.map(r => `<div class="li"><span class="dot" style="background:${lc(r.c)[2]}"></span><div class="t"><div>${lc(r.c)[1]}</div><div class="m">${r.n} раз</div></div><b>${num(r.q, 1)}/5</b></div>`).join('')}</div>` : '<div class="small muted">Оценивай отдых по шкале «насколько восстановило». Через 2-3 недели здесь будет видно, какой отдых работает лучше.</div>'}</div>
      <div class="card"><div class="card-h"><h2>Выходные</h2></div>
        <label class="toggle"><input type="checkbox" data-a="rest-weekend" ${D.settings.restWeekend ? 'checked' : ''}> Выходные без обязательной продуктивности</label>
        <div class="tiny muted" style="margin-top:8px">Когда включено, в выходные планировщик не ставит учёбу и задачи, только движение, быт и свободное время. Учебная цель распределяется на будни.</div></div>
    </div>
    <div class="card c12"><div class="card-h"><h2>Отдых по неделям</h2></div>${bars({ data: weeks.map(ws => ({ label: fmtDate(ws), parts: LCATS.map(([c, n, col]) => ({ v: sum(D.leisureLogs.filter(l => l.cat === c && l.date >= ws && l.date <= addDays(ws, 6)).map(l => l.minutes || 0)) / 60, color: col, name: n })) })), yFmt: v => num(v, 0) + 'ч' })}
      <div class="legend">${LCATS.map(([c, n, col]) => `<span><i style="background:${col}"></i>${n}</span>`).join('')}</div></div>
    <div class="card c12"><div class="card-h"><h2>Последние записи</h2></div><div class="list">${D.leisureLogs.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 15).map(l => `<div class="li"><span class="dot" style="background:${lc(l.cat)[2]}"></span><div class="t"><div>${esc(l.title || lc(l.cat)[1])}</div><div class="m">${fmtDate(l.date, true)} · ${dur(l.minutes)}${l.quality ? ' · восстановило ' + l.quality + '/5' : ''}</div></div><button class="btn ghost sm" data-a="leisure-del" data-id="${l.id}">${icon('x')}</button></div>`).join('') || '<div class="empty">Пока пусто</div>'}</div></div>
  </div>`;
}

function leisureForm(D, o = {}) {
  return `<form data-f="leisure" class="col"><input type="hidden" name="funId" value="${esc(o.funId || '')}">
    <div class="fg"><label class="f">Что<select name="cat">${opts(LCATS.map(x => [x[0], x[1]]), o.cat || 'film')}</select></label><label class="f">Минуты<input type="number" name="minutes" value="${o.minutes || 60}" min="5" required></label><label class="f">Дата<input type="date" name="date" value="${o.date || D.today}"></label></div>
    <input type="text" name="title" placeholder="Название (фильм, игра, с кем встреча)" value="${esc(o.title || '')}">
    <div class="small muted">Насколько восстановило?</div>
    <div class="row" style="gap:6px">${[1, 2, 3, 4, 5].map(n => `<label class="chip" style="cursor:pointer"><input type="radio" name="quality" value="${n}" ${n === 4 ? 'checked' : ''} style="margin:0 4px 0 0">${n}</label>`).join('')}</div>
    <div class="dlg-f"><button class="btn pri">Сохранить</button></div></form>`;
}

on({
  'fun-filter': (ds) => { funFilter = ds.v; window.__rerender(); },
  'fun-add': () => modal('Добавить в список', `<form data-f="fun" class="col"><input type="text" name="title" placeholder="Название" required><div class="fg"><label class="f">Тип<select name="cat">${opts(LCATS.filter(x => x[0] !== 'scroll').map(x => [x[0], x[1]]), 'film')}</select></label><label class="f">Когда (необязательно)<input type="date" name="date"></label></div><input type="text" name="note" placeholder="Заметка: где смотреть, с кем"><div class="dlg-f"><button class="btn pri">Добавить</button></div></form>`),
  'fun-plan': (ds) => { const f = store.get(ds.id); modal('Когда?', `<form data-f="fun-plan" class="col"><input type="hidden" name="id" value="${f.id}"><input type="date" name="date" value="${f.date || window.__D.today}" required><div class="tiny muted">В выходной день это станет блоком свободного времени в плане.</div><div class="dlg-f"><button class="btn pri">Запланировать</button></div></form>`); },
  'fun-done': (ds) => { const f = store.get(ds.id); modal('Как прошло?', leisureForm(window.__D, { funId: f.id, cat: f.cat, title: f.title })); },
  'fun-del': (ds) => store.remove(ds.id),
  'leisure-add': () => modal('Отдых', leisureForm(window.__D)),
  'leisure-del': (ds) => store.remove(ds.id),
  'rest-weekend': (ds, el) => saveSettings({ restWeekend: el.checked }),
  'recovery-day': () => { const D = window.__D; const id = 'day_' + D.today; store.put('day', { ...(store.get(id) || {}), id, date: D.today, mode: 'mvd' }); toast('Сегодня день восстановления: только самое важное, остальное без долгов'); window.__go('today'); }
});
onForm({
  'fun': (o) => { store.put('fun', { ...o, status: o.date ? 'planned' : 'want', date: o.date || null }); close(); },
  'fun-plan': (o) => { store.patch(o.id, { date: o.date, status: 'planned' }); close(); },
  'leisure': (o) => {
    store.put('leisure', { date: o.date, cat: o.cat, minutes: o.minutes, title: o.title, quality: Number(o.quality) });
    if (o.funId) store.patch(o.funId, { status: 'done', date: o.date });
    close(); toast('Отдых записан');
  }
});
