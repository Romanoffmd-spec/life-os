// Главный экран: план дня, готовность, приоритеты, привычки и ключевые показатели.
import * as store from '../store.js';
import * as E from '../engine.js';
import { esc, hm, dur, durShort, num, int, fmtDate, wdLong, minutesOfDay, dkey, sum, rangeKeys, addDays, parseHM } from '../util.js';
import { icon, sigil, on, modal, close, toast, seg, hero } from '../ui.js';
import { ring, meter, spark } from '../charts.js';
import { taskRow, habitRow, checkinWidget, completeTopic, uncompleteTopic, completeWorkout } from './comp.js';
import { avatar } from './profile.js';

export const title = 'Сегодня';

export function blockList(D, plan, state, { interactive = true, isToday = true } = {}) {
  const now = minutesOfDay();
  return `<div class="timeline">${plan.blocks.map(b => {
    const cat = E.CATS[b.cat] || {};
    const isNow = isToday && now >= b.start && now < b.end;
    const past = isToday && now >= b.end;
    const done = state?.done?.[b.id];
    const tasks = (b.tasks || []).map(id => D.tasks.find(t => t.id === id)).filter(Boolean);
    return `<div class="blk ${b.fixed ? 'fixed' : ''} ${isNow ? 'now' : ''} ${past ? 'past' : ''} ${done ? 'isdone' : ''}">
      <div class="tm">${hm(b.start)}</div><div class="bar" style="background:${cat.color}"></div>
      <div class="bd"><div class="ti">${esc(b.title)}${b.optional ? ' <span class="chip">по желанию</span>' : ''}</div>
        <div class="su">${dur(b.end - b.start)} · ${cat.label || ''}</div>
        ${tasks.length ? `<div class="tasks">${tasks.map(t => `<div class="row"><span class="check round ${t.done ? 'on' : ''}" data-a="task-toggle" data-id="${t.id}"></span><span style="${t.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(t.title)}</span></div>`).join('')}</div>` : ''}
      </div>
      <div class="act">${interactive && b.track ? `${b.cat === 'study' || b.cat === 'workout' ? `<button class="btn ghost sm" data-a="timer-start" data-cat="${b.cat}" data-min="${b.end - b.start}" data-track="${b.studyTrack || ''}" data-block="${b.id}" title="Таймер">${icon('play')}</button>` : ''}<span class="check ${done ? 'on' : ''}" data-a="block-done" data-id="${b.id}" data-cat="${b.cat}" data-min="${b.end - b.start}" data-track="${b.studyTrack || ''}" data-title="${esc(b.title)}"></span>` : ''}</div>
    </div>`;
  }).join('')}</div>`;
}

function greeting() { const h = new Date().getHours(); return h >= 5 && h < 11 ? 'Доброе утро' : h < 17 && h >= 11 ? 'Добрый день' : h >= 17 && h < 23 ? 'Добрый вечер' : 'Доброй ночи'; }

/** Текущий и следующие блоки плана */
export function nowAndNext(plan) {
  let now = minutesOfDay();
  const bl = plan.blocks.slice().sort((a, b) => a.start - b.start);
  let cur = bl.find(b => now >= b.start && now < b.end) || bl.find(b => now + 1440 >= b.start && now + 1440 < b.end);
  if (cur && now < cur.start) now += 1440;
  const next = bl.filter(b => b.start >= (cur ? cur.end : now) && b.id !== cur?.id && b.end - b.start >= 10).slice(0, 3);
  return { cur, next, now };
}

export function render(D) {
  const s = D.settings, rd = D.readiness, plan = D.plan;
  const night = D.nights[D.today];
  const dly = D.daily[D.today] || {};
  const food = D.foodByDay[D.today];
  const water = D.waterByDay[D.today] || 0;
  const { cur, next, now } = nowAndNext(plan);
  const done = cur && D.planState?.done?.[cur.id];
  const left = cur ? cur.end - now : 0;
  const frac = cur ? Math.min(1, Math.max(0, (now - cur.start) / (cur.end - cur.start))) : 0;
  const must = plan.tasks.must.slice(0, 3);
  const habits = D.habits.filter(h => !h.paused).map(h => ({ h, st: E.habitStats(h, D.habitLogs, D.today) })).filter(x => x.st.dueToday || x.st.todayLog);
  const ins = D.insights.find(i => i.level === 'warn') || D.insights[0];
  const ci = D.checkins[D.today];
  const stat = (l, v, unit, a, extra = '') => `<div class="stat" ${a}><div class="l">${l}</div><div class="v">${v}${unit ? `<small>${unit}</small>` : ''}</div>${extra}</div>`;
  const curHint = !cur ? '' : cur.cat === 'leisure' ? 'Время для себя. Если не знаешь, чем заняться, загляни в «Привал»: там твой список фильмов, игр и встреч.'
    : cur.cat === 'work' ? (next.length ? `Вечером: ${next.filter(b => !b.fixed && !['commute', 'routine'].includes(b.cat)).slice(0, 2).map(b => b.title.toLowerCase()).join(', ') || 'отдых'}.` : '')
    : cur.cat === 'sleep' ? 'Сон тоже часть плана. Телефон можно отложить.'
    : cur.cat === 'recovery' ? 'Без экрана и без дел. Это не потеря времени, а заправка.' : '';

  return `
  ${hero('today', `${greeting()}${s.name ? ', ' + s.name : ''}`, `${wdLong(D.today)}, ${fmtDate(D.today)}`, `<div class="hero-chips"><span class="mode-pill mode-${D.mode}">${esc(D.scenario)}</span>${rd.score != null ? `<span class="chip" title="Расчётный индекс по сну, HRV, пульсу и самочувствию. Не медицинский показатель.">запас сил ${rd.score}</span>` : ''}<button class="pill-btn" data-a="day-sheet">${icon('edit')}Изменить день</button></div>`)}

  ${!s.anketaDone ? `<div class="note acc" style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="flex:1;min-width:200px"><b>Анкета не заполнена.</b> План, меню и тренировки сейчас на предварительных значениях. 5 минут один раз, и всё подстроится под тебя.</span><button class="btn pri sm" data-a="go" data-v="profile">Заполнить анкету</button></div>` : ''}
  ${D.recovery.kind !== 'none' ? `<div class="note warn" style="margin-bottom:14px">${esc(D.recovery.text)}</div>` : ''}
  <div class="grid">
    <div class="c7 col" style="gap:14px">
      <div class="card now">${sigil('sigil-bg', false)}
        <div class="lbl">Сейчас</div>
        ${cur ? `<div class="ttl">${esc(cur.title)}</div>
          <div class="meta">${hm(cur.start)} - ${hm(cur.end)} · осталось ${dur(left)}</div>
          <div class="bar2"><i style="width:${(frac * 100).toFixed(1)}%"></i></div>
          ${curHint ? `<div class="small" style="color:var(--text-2);margin-bottom:12px">${esc(curHint)}</div>` : ''}
          ${cur.track ? `<div class="row wrap">${cur.cat === 'study' || cur.cat === 'workout' ? `<button class="btn pri" data-a="timer-start" data-cat="${cur.cat}" data-min="${cur.end - cur.start}" data-track="${cur.studyTrack || ''}" data-block="${cur.id}">${icon('play')}Начать</button>` : ''}
            <button class="btn ${done ? 'pri' : ''}" data-a="block-done" data-id="${cur.id}" data-cat="${cur.cat}" data-min="${cur.end - cur.start}" data-track="${cur.studyTrack || ''}" data-title="${esc(cur.title)}">${icon('check')}${done ? 'Сделано' : 'Готово'}</button></div>` : ''}`
        : `<div class="ttl">Свободно</div>`}
        ${next.length ? `<div class="orn">◆</div><div class="lbl" style="color:var(--muted)">Дальше</div><div class="next">${next.map(b => `<div class="it"><span class="tm">${hm(b.start)}</span><span>${esc(b.title)}</span></div>`).join('')}</div>` : ''}
        ${plan.notes[0] ? `<div class="tiny muted" style="margin-top:10px">${esc(plan.notes[0])}</div>` : ''}
        <details class="fold"><summary>Весь день по часам</summary>
          ${plan.notes.slice(1).map(n => `<div class="note" style="margin:6px 0">${esc(n)}</div>`).join('')}
          ${blockList(D, plan, D.planState)}</details>
      </div>

      ${summaryCard(D)}
      <div class="card"><div class="card-h"><h2>Главное сегодня</h2><span class="sp"></span><button class="btn ghost sm" data-a="task-new" data-due="${D.today}" data-priority="must" aria-label="Добавить">${icon('plus')}</button></div>
        ${must.length ? must.map(t => `<div class="mission"><span class="check round ${t.done ? 'on' : ''}" data-a="task-toggle" data-id="${t.id}"></span><div class="t" data-a="task-edit" data-id="${t.id}" style="cursor:pointer">${esc(t.title)}${t.estimate ? `<div class="tiny muted">${dur(t.estimate)}</div>` : ''}</div></div>`).join('')
          : `<div class="muted small">Ничего обязательного. Добавь задачу через «+» внизу или просто проживи день.</div>`}
        ${plan.tasks.must.length > 3 ? `<div class="tiny muted" style="margin-top:6px">и ещё ${plan.tasks.must.length - 3} в «Заданиях»</div>` : ''}
      </div>
    </div>

    <div class="c5 col" style="gap:14px">
      <div class="stats">
        ${stat('Сон', night ? durShort(night.asleepMin) : '-', '', night ? 'data-a="go" data-v="health"' : 'data-a="sleep-log"', night ? '' : '<div class="tiny muted">записать</div>')}
        ${stat('Вода', num(water / 1000, 1), 'л', 'data-a="water" data-v="250"', '<div class="tiny muted">нажми: +250 мл</div>')}
        ${stat('Еда', food ? int(food.kcal) : '0', 'ккал', 'data-a="food-quick"', `<div class="tiny muted">${D.targets ? 'цель ' + int(D.targets.kcal) + ' · ' : ''}добавить</div>`)}
        ${stat('Шаги', dly.steps ? int(dly.steps) : '-', '', 'data-a="go" data-v="health"', `<div class="tiny muted">цель ${int(s.stepsTarget)}</div>`)}
      </div>

      <div class="card"><div class="card-h"><h2>Ритуалы</h2><span class="sp"></span><span class="link" data-a="go" data-v="habits">все</span></div>
        ${habits.length ? `<div class="rituals">${habits.map(({ h, st }) => { const l = st.todayLog; const c = l?.status === 'done' ? 'on' : l?.status === 'min' ? 'min' : l?.status === 'skip' ? 'skip' : st.neverMissTwice ? 'warn' : ''; return `<span class="ritual ${c}" data-a="habit-tap" data-id="${h.id}" title="${st.neverMissTwice ? 'Вчера пропуск: сегодня хватит минимальной версии' : ''}"><span class="d"></span>${esc(h.name)}</span>`; }).join('')}</div>
          <div class="tiny muted" style="margin-top:10px">Касание: отметить. Минимальная версия или пропуск: в разделе «Ритуалы».</div>`
        : `<div class="small muted">${D.habits.length ? 'На сегодня всё отмечено.' : 'Пока пусто.'} <a data-a="go" data-v="habits" style="cursor:pointer">${D.habits.length ? 'Открыть' : 'Добавить первый ритуал'}</a></div>`}
      </div>

      ${!ci?.energy ? `<div class="card"><div class="card-h"><h2>Как ты сейчас?</h2></div>${checkinWidget(D)}<div class="tiny muted" style="margin-top:8px">1 означает «еле живой», 5 «полон сил». План подстроится.</div></div>` : ''}

    </div>
  </div>`;
}

function summaryCard(D) {
  const p = D.plan, s = D.settings;
  const dow = (new Date().getDay() + 6) % 7, menu = D.menu.days[dow];
  const wo = p.blocks.find(b => b.cat === 'workout');
  const st = p.blocks.find(b => b.cat === 'study');
  const free = p.blocks.filter(b => b.cat === 'leisure' || b.cat === 'social');
  const freeMin = free.reduce((a, b) => a + b.end - b.start, 0);
  const row = (ic, l, v, a = '') => `<div class="sumrow" ${a}><span class="aic">${icon(ic)}</span><span class="l">${l}</span><span class="v">${v}</span></div>`;
  return `<div class="card"><div class="card-h"><h2>План на день</h2><span class="sp"></span><span class="tiny muted">неделя программы ${D.programWeek} из 12</span></div><div class="sumlist">
    ${p.leave != null ? row('today', 'Выйти из дома', hm(p.leave)) : ''}
    ${row('health', 'Питание', `${menu.total.kcal} ккал по меню: ${esc(menu.meals[3].name.toLowerCase())} на ужин`, 'data-a="open-menu" style="cursor:pointer"')}
    ${row('plan', 'Активность', wo ? `${esc(wo.title)}, ${hm(wo.start)}` : 'прогулка', wo && !wo.optional ? 'data-a="open-training" style="cursor:pointer"' : '')}
    ${row('learn', 'Тема', st ? esc(st.title.replace(/^(Учёба|USMLE): /, '')) : D.nextTopic ? esc(D.nextTopic.title) + ' (в следующий учебный день)' : 'программа пройдена', 'data-a="go" data-v="learn" style="cursor:pointer"')}
    ${row('rest', 'Свободное время', free.length ? `${dur(freeMin)}, с ${hm(free[free.length - 1].start)}` : 'вечер под восстановление')}
    ${row('assistant', 'Отбой', hm(p.bedtime))}
  </div></div>`;
}

function daySheet(D) {
  const dayItem = D.days[D.today];
  modal('Изменить день', `<div class="col" style="gap:16px">
    <div><div class="small muted" style="margin-bottom:6px">Какой сегодня день</div>${seg('day-type', [['work', 'Рабочий'], ['duty', 'Дежурство'], ['postduty', 'После дежурства'], ['off', 'Выходной']], D.dayType)}</div>
    <div><div class="small muted" style="margin-bottom:6px">Сколько сил</div>${seg('day-mode', [['auto', 'Решит приложение'], ['optimal', 'Полная сила'], ['normal', 'Ровный шаг'], ['mvd', 'Привал']], dayItem?.mode || 'auto')}
      <div class="tiny muted" style="margin-top:6px">«Привал»: только самое важное, остальное переносится без долгов.</div></div>
    ${D.dayType === 'work' ? `<div class="col"><button class="btn ${dayItem?.workload === 'heavy' ? 'pri' : ''}" data-a="workload" data-v="heavy">Тяжёлый день на работе: облегчить вечер</button><button class="btn" data-a="work-late">Работа закончилась позже</button></div>` : ''}
  </div>`);
}

function setDay(D, fields) {
  const id = 'day_' + D.today; const cur = store.get(id) || {};
  store.put('day', { ...cur, id, date: D.today, ...fields });
}

const refreshSheet = () => setTimeout(() => { if (document.querySelector('dialog [data-a="day-type"]')) { import('../data.js').then(m => { const D = m.build(dkey()); window.__D = D; daySheet(D); }); } }, 30);
on({
  'open-menu': () => { import('./health.js').then(m => { m.openTab('menu'); window.__go('health'); }); },
  'open-training': () => { import('./health.js').then(m => { m.openTab('training'); window.__go('health'); }); },
  'day-sheet': () => daySheet(window.__D),
  'food-quick': () => { import('./comp.js').then(m => m.openQuickAdd()); setTimeout(() => { const i = document.getElementById('qa-in'); if (i) { i.placeholder = 'Например: гречка с курицей 520 ккал'; } }, 60); },
  'day-type': (ds) => { setDay(window.__D, { type: ds.v }); refreshSheet(); },
  'day-mode': (ds) => { setDay(window.__D, { mode: ds.v === 'auto' ? null : ds.v }); refreshSheet(); },
  'workload': (ds) => { const D = window.__D; const cur = D.days[D.today]?.workload; setDay(D, { workload: cur === ds.v ? null : ds.v }); toast(cur === ds.v ? 'Нагрузка: обычная' : 'Вечер облегчён'); refreshSheet(); },
  'work-late': () => {
    const D = window.__D;
    const d = modal('Когда закончилась работа?', `<form data-f="work-end" class="col"><input type="time" name="t" value="${hm(Math.max(parseHM(D.settings.workEnd), minutesOfDay()))}" required><div class="dlg-f"><button class="btn pri">Пересобрать вечер</button></div></form>`);
  },
  'water': (ds) => { store.put('water', { date: window.__D.today, ml: Number(ds.v) }); toast(`Вода +${ds.v} мл`); },
  'block-done': (ds) => {
    const D = window.__D; const id = 'ps_' + D.today; const st = store.get(id) || { done: {}, skipped: {} };
    const done = { ...(st.done || {}) }; const was = !!done[ds.id];
    if (was) delete done[ds.id]; else done[ds.id] = Date.now();
    store.put('planstate', { ...st, id, date: D.today, done });
    const blk = D.plan.blocks.find(b => b.id === ds.id) || {};
    if (ds.cat === 'study') {
      if (!was) { if (blk.topicId) completeTopic(blk.topicId, ds.min, D.today); else store.put('study', { id: `st_${D.today}_${ds.id}`, date: D.today, minutes: Number(ds.min), track: ds.track, note: 'по плану' }); toast(blk.topicId ? 'Тема пройдена: 3 карточки добавлены в повторение' : `Записано ${ds.min} мин учёбы`); }
      else { if (blk.topicId) uncompleteTopic(blk.topicId); store.put('study', { id: `st_${D.today}_${ds.id}`, deleted: true }); }
    }
    if (ds.cat === 'workout' && !blk.optional) {
      if (!was) completeWorkout(blk.session, Number(ds.min) - 10, D.today, ds.id);
      else store.put('workout', { id: `wo_${D.today}_${ds.id}`, deleted: true });
    }
  },
  'sleep-log': () => {
    modal('Сон прошлой ночью', `<form data-f="sleeplog" class="col"><div class="fg two"><label class="f">Лёг<input type="time" name="bed" value="23:00" required></label><label class="f">Проснулся<input type="time" name="wake" value="06:00" required></label></div>
      <label class="f">Качество (1-5)<input type="number" name="quality" min="1" max="5" value="3"></label>
      <div class="tiny muted">Если подключены Apple Health и часы, сон подтянется автоматически, а ручная запись будет заменена.</div>
      <div class="dlg-f"><button class="btn pri">Сохранить</button></div></form>`);
  }
});
import { onForm } from '../ui.js';
onForm({
  'work-end': (o) => { setDay(window.__D, { workEnd: o.t }); close(); toast('Вечер пересобран'); },
  'sleeplog': (o) => { const D = window.__D; store.put('sleeplog', { id: 'sl_' + D.today, date: D.today, bed: o.bed, wake: o.wake, quality: o.quality }); close(); }
});
