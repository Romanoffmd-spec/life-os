// Привычки и дисциплина: гибкая частота, минимальные версии, причины пропусков, мягкие серии.
import * as store from '../store.js';
import * as E from '../engine.js';
import { esc, fmtDate, addDays, rangeKeys, wdShort, weekday } from '../util.js';
import { icon, on, onForm, modal, close, toast, opts } from '../ui.js';
import { habitRow, habitMenu } from './comp.js';

export const title = 'Ритуалы';

const AREAS = [['health', 'Здоровье'], ['sleep', 'Сон'], ['move', 'Движение'], ['learn', 'Обучение'], ['work', 'Работа'], ['mind', 'Голова и отдых'], ['money', 'Финансы'], ['social', 'Люди']];

export function render(D) {
  const keys = rangeKeys(D.today, 14);
  const active = D.habits.filter(h => !h.paused), paused = D.habits.filter(h => h.paused);
  const reasons = {}; D.skipReasons.forEach(r => reasons[r] = (reasons[r] || 0) + 1);
  const topR = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  return `<div class="top"><h1>Ритуалы</h1><span class="sp"></span><button class="btn pri" data-a="habit-new">${icon('plus')}Привычка</button></div>
  <div class="grid">
    <div class="card c8"><div class="card-h"><h2>Сегодня</h2><span class="sp"></span><span class="muted small">отметка: касание, долгий выбор: ⋯</span></div>
      <div class="list">${active.map(h => habitRow(h, D)).join('') || `<div class="empty">Начни с 1-2 привычек. Каждая с минимальной версией на плохой день.</div>`}</div></div>
    <div class="c4 col" style="gap:14px">
      <div class="card"><div class="card-h"><h2>Принципы</h2></div><div class="small col" style="gap:6px;color:var(--text-2)">
        <div><b>Не пропускать дважды.</b> Один пропуск ничего не ломает, система просто напомнит вернуться.</div>
        <div><b>Минимальная версия засчитывается.</b> 2 минуты в плохой день сохраняют идентичность.</div>
        <div><b>Процент за 4 недели важнее серии.</b> 80% это отличный результат.</div>
        <div><b>Сложность растёт сама:</b> после 3 стабильных недель приложение предложит шаг вверх.</div></div></div>
      <div class="card"><div class="card-h"><h2>Пропуски за 4 недели</h2></div>${topR.length ? `<div class="list">${topR.map(([r, n]) => `<div class="li"><div class="t"><div>${E.SKIP_REASONS.find(x => x.id === r)?.label || r}</div></div><b>${n}</b></div>`).join('')}</div><div class="note" style="margin-top:8px">${E.REASON_ADVICE[topR[0][0]]}</div>` : '<div class="small muted">Причины пропусков появятся здесь и помогут понять, что мешает.</div>'}</div>
    </div>
    <div class="card c12"><div class="card-h"><h2>Две недели</h2></div>
      <div style="overflow-x:auto"><table class="t" style="min-width:560px"><tr><th></th>${keys.map(k => `<th style="text-align:center;padding:4px 0">${wdShort(k)}<br><span class="tiny">${fmtDate(k).split(' ')[0]}</span></th>`).join('')}<th class="tr">4 нед.</th><th class="tr">серия</th></tr>
      ${active.map(h => { const st = E.habitStats(h, D.habitLogs, D.today); const L = Object.fromEntries(D.habitLogs.filter(l => l.habitId === h.id).map(l => [l.date, l])); return `<tr><td style="max-width:180px">${esc(h.name)}</td>${keys.map(k => { const l = L[k]; const c = l?.status === 'done' ? 'd' : l?.status === 'min' ? 'm' : l?.status === 'skip' ? 's' : E.habitDueOn(h, k) ? '' : 'n'; return `<td style="padding:3px"><div class="hcell ${c} ${k === D.today ? 'today' : ''}" data-a="habit-cell" data-id="${h.id}" data-date="${k}" style="cursor:pointer;min-width:16px" title="${fmtDate(k)}${l?.reason ? ': ' + (E.SKIP_REASONS.find(x => x.id === l.reason)?.label || '') : ''}"></div></td>`; }).join('')}<td class="tr">${st.r28 == null ? '-' : Math.round(st.r28 * 100) + '%'}</td><td class="tr">${st.streak}</td></tr>`; }).join('')}</table></div>
      <div class="legend"><span><i style="background:var(--good)"></i>выполнено</span><span><i style="background:color-mix(in srgb,var(--good) 45%,transparent)"></i>минимум</span><span><i style="background:var(--line-2)"></i>пропуск с причиной</span><span>касание клетки: исправить прошлый день</span></div></div>
    ${active.map(h => { const st = E.habitStats(h, D.habitLogs, D.today); return st.suggestion ? `<div class="card c6"><div class="card-h"><h3>${esc(h.name)}</h3></div><div class="small">${st.suggestion.text}</div><div class="row" style="margin-top:10px">${st.suggestion.type === 'up' ? `<button class="btn sm pri" data-a="habit-level" data-id="${h.id}" data-v="1">Усложнить</button>` : `<button class="btn sm pri" data-a="habit-edit" data-id="${h.id}">Упростить</button>`}<button class="btn sm ghost" data-a="habit-dismiss" data-id="${h.id}">Не сейчас</button></div></div>` : ''; }).join('')}
    ${paused.length ? `<div class="card c12"><div class="card-h"><h2>На паузе</h2></div><div class="list">${paused.map(h => `<div class="li"><div class="t"><div>${esc(h.name)}</div></div><button class="btn sm" data-a="habit-resume" data-id="${h.id}">Вернуть</button></div>`).join('')}</div></div>` : ''}
  </div>`;
}

function habitForm(h = {}) {
  const f = h.freq || { type: 'daily', n: 3, days: [0, 1, 2, 3, 4] };
  return `<form data-f="habit" class="col"><input type="hidden" name="id" value="${esc(h.id || '')}">
    <input type="text" name="name" placeholder="Например: 10 минут английского" value="${esc(h.name || '')}" required>
    <label class="f">Минимальная версия на плохой день<input type="text" name="minimal" placeholder="Одна карточка / 2 минуты / 1 страница" value="${esc(h.minimal || '')}"></label>
    <label class="f">Якорь: после чего / где<input type="text" name="cue" placeholder="После ужина, за столом" value="${esc(h.cue || '')}"></label>
    <div class="fg"><label class="f">Частота<select name="ftype" id="hf-type">${opts([['daily', 'Каждый день'], ['weekly', 'N раз в неделю'], ['days', 'По дням недели']], f.type)}</select></label>
      <label class="f">Раз в неделю<input type="number" name="n" min="1" max="7" value="${f.n || 3}"></label>
      <label class="f">Область<select name="area">${opts(AREAS, h.area || 'health')}</select></label></div>
    <div class="row wrap" style="gap:4px"><span class="small muted">Дни:</span>${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d, i) => `<label class="chip" style="cursor:pointer"><input type="checkbox" name="days" data-multi="1" value="${i}" ${(f.days || []).includes(i) ? 'checked' : ''} style="margin:0 3px 0 0">${d}</label>`).join('')}</div>
    <div class="tiny muted">Для дней дежурств привычки автоматически необязательны. «N раз в неделю» не требует конкретных дней и лучше подходит для тренировок.</div>
    <div class="dlg-f">${h.id ? `<button type="button" class="btn danger" data-a="habit-del" data-id="${h.id}">Удалить</button><button type="button" class="btn" data-a="habit-pause" data-id="${h.id}">Пауза</button><span class="sp"></span>` : ''}<button class="btn pri">Сохранить</button></div></form>`;
}

const PRESETS = [
  { name: 'Шаги: цель дня', minimal: 'Прогулка 10 минут', freq: { type: 'daily' }, area: 'move' },
  { name: 'Отбой по плану', minimal: 'Экран убран за 15 минут до сна', freq: { type: 'daily' }, area: 'sleep' },
  { name: 'Карточки (повторение)', minimal: '5 карточек', freq: { type: 'daily' }, area: 'learn' },
  { name: 'Английский 15 минут', minimal: '1 короткое видео без субтитров', freq: { type: 'weekly', n: 5 }, area: 'learn' },
  { name: 'Записать питание', minimal: 'Только ужин', freq: { type: 'daily' }, area: 'health' },
  { name: 'Силовая тренировка', minimal: '10 минут дома', freq: { type: 'weekly', n: 3 }, area: 'move' },
  { name: 'Учёт расходов', minimal: 'Сфоткать чеки', freq: { type: 'weekly', n: 2 }, area: 'money' },
  { name: 'Связаться с близким человеком', minimal: 'Одно сообщение', freq: { type: 'weekly', n: 2 }, area: 'social' }
];

on({
  'habit-new': () => modal('Новая привычка', `<div class="small muted">Быстрый старт:</div><div class="row wrap" style="gap:6px">${PRESETS.map((p, i) => `<button class="chip" data-a="habit-preset" data-v="${i}">${esc(p.name)}</button>`).join('')}</div><hr style="margin:4px 0">${habitForm()}`),
  'habit-preset': (ds) => { const p = PRESETS[ds.v]; store.put('habit', { ...p, level: 1 }); close(); toast(`Добавлено: ${p.name}`); },
  'habit-edit': (ds) => { close(); modal('Привычка', habitForm(store.get(ds.id))); },
  'habit-del': (ds) => { store.remove(ds.id); close(); },
  'habit-pause': (ds) => { store.patch(ds.id, { paused: true }); close(); toast('Привычка на паузе. Это нормальная часть настройки системы.'); },
  'habit-resume': (ds) => store.patch(ds.id, { paused: false }),
  'habit-cell': (ds) => habitMenu(ds.id, ds.date),
  'habit-level': (ds) => { const h = store.get(ds.id); store.patch(ds.id, { level: (h.level || 1) + 1, dismissedAt: window.__D.today }); modal('Шаг вверх', `<div class="col"><div class="small">Измени формулировку на чуть более сложную (не больше +20%). Например, 10 → 12 минут или 3 → 4 раза в неделю.</div>${habitForm(store.get(ds.id))}</div>`); },
  'habit-dismiss': (ds) => store.patch(ds.id, { dismissedAt: window.__D.today })
});
onForm({
  'habit': (o) => {
    const prev = o.id ? store.get(o.id) : {};
    const freq = o.ftype === 'weekly' ? { type: 'weekly', n: o.n || 3 } : o.ftype === 'days' ? { type: 'days', days: (o.days || []).map(Number) } : { type: 'daily' };
    if (freq.type === 'days' && !freq.days.length) return toast('Выбери дни');
    store.put('habit', { ...prev, id: o.id || undefined, name: o.name, minimal: o.minimal, cue: o.cue, area: o.area, freq, level: prev.level || 1 });
    close();
  }
});
