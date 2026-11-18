// Обучение: направления, учебные сессии, материалы, интервальное повторение и Active Recall.
import * as store from '../store.js';
import * as E from '../engine.js';
import { esc, dur, num, int, fmtDate, addDays, rangeKeys, weekStart, sum } from '../util.js';
import { icon, on, onForm, modal, close, toast, seg, opts, confirmBox } from '../ui.js';
import { bars, meter } from '../charts.js';
import { completeTopic, uncompleteTopic } from './comp.js';
import { USMLE_NOTE } from '../content/curriculum.js';

export const title = 'Знания';
let tab = 'overview', review = null, cardFilter = '', matFilter = 'active';

const MAT_TYPES = [['book', 'Книга'], ['article', 'Статья'], ['guideline', 'Гайдлайн'], ['course', 'Курс'], ['video', 'Видео/лекция'], ['other', 'Другое']];

export function render(D) {
  const due = E.srsDue(D.cards, D.today).length;
  return `<div class="top"><h1>Знания</h1><span class="sp"></span><button class="btn" data-a="timer-start" data-cat="study" data-min="${D.settings.focusSpanMin}" data-track="${D.plan.study.track.id}">${icon('timer')}Сессия</button><button class="btn pri" data-a="srs-start" ${due ? '' : 'disabled'}>Повторить ${due || ''}</button></div>
  <div class="tabs">${[['overview', 'Обзор'], ['program', 'Программа'], ['review', 'Повторение'], ['materials', 'Материалы'], ['cards', 'Карточки'], ['history', 'История']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-a="l-tab" data-v="${k}">${l}</button>`).join('')}</div>
  ${({ overview, program, review: reviewView, materials, cards, history })[tab](D)}`;
}

function trackName(D, id) { return D.settings.tracks.find(t => t.id === id)?.name || id; }
function trackColor(D, id) { return D.settings.tracks.find(t => t.id === id)?.color || 'var(--accent)'; }

export function topicCard(D, t, { compact = false } = {}) {
  if (!t) return `<div class="card c12"><div class="empty">Программа 13 недель пройдена. Наставник предложит следующую.</div></div>`;
  return `<div class="card now c12" style="animation:none">${''}
    <div class="lbl">${t.track === 'usmle' ? 'USMLE' : esc(trackName(D, t.track))} · неделя ${t.week}, тема ${t.order} из ${D.topics.length}</div>
    <div class="ttl" style="font-size:30px">${esc(t.title)}</div>
    <div class="small" style="color:var(--text-2);margin:4px 0 10px"><b>Цель:</b> ${esc(t.goal)}</div>
    ${compact ? '' : `<div class="small"><b>Active Recall: ответь без подсказок</b></div><ol class="small" style="margin:6px 0 10px;padding-left:20px">${t.q.map(q => `<li style="margin-bottom:4px">${esc(q)}</li>`).join('')}</ol>
    <div class="small muted"><b>Источник:</b> ${esc(t.src)}</div><div class="small muted" style="margin-top:4px"><b>Применить:</b> ${esc(t.practice)}</div>`}
    <div class="row wrap" style="margin-top:12px"><button class="btn pri" data-a="timer-start" data-cat="study" data-min="${D.settings.focusSpanMin}" data-track="${t.track}" data-topic="${t.id}">${icon('play')}Начать (${D.settings.focusSpanMin} мин)</button><button class="btn" data-a="topic-done" data-id="${t.id}">${icon('check')}Пройдено</button>${compact ? '<button class="btn ghost" data-a="l-tab" data-v="program">Вся программа</button>' : ''}</div>
    <div class="tiny muted" style="margin-top:8px">После отметки вопросы темы попадут в интервальное повторение (через 1, 3, 7... дней).</div></div>`;
}

function program(D) {
  const weeks = {}; for (const t of D.topics) (weeks[t.week] ||= []).push(t);
  const done = D.topics.filter(t => t.done).length;
  return `<div class="grid">${topicCard(D, D.nextTopic)}
    <div class="card c12"><div class="card-h"><h2>13 недель: ${done} из ${D.topics.length}</h2><span class="sp"></span><span class="tiny muted">чередование: хирургия, USMLE, хирургия, ротация, USMLE</span></div>${meter(done / Math.max(1, D.topics.length))}
      <div class="note" style="margin:12px 0">${esc(USMLE_NOTE)}</div>
      ${Object.entries(weeks).map(([w, ts]) => `<div class="small muted" style="margin:14px 0 4px;font-family:var(--caps);letter-spacing:.08em">Неделя ${w}</div><div class="list">${ts.map(t => `<div class="li ${t.done ? 'done' : ''}"><span class="check round ${t.done ? 'on' : ''}" data-a="topic-toggle" data-id="${t.id}"></span><div class="t" data-a="topic-open" data-id="${t.id}" style="cursor:pointer"><div>${esc(t.title)}</div><div class="m">${t.track === 'usmle' ? 'USMLE' : esc(trackName(D, t.track))}${t.doneDate ? ' · ' + fmtDate(t.doneDate) : ''}</div></div></div>`).join('')}</div>`).join('')}
    </div></div>`;
}

function overview(D) {
  const s = D.settings, total = sum(s.tracks.map(t => t.share)) || 1;
  const ws = weekStart(D.today);
  const st = D.plan.study;
  const due = E.srsDue(D.cards, D.today);
  const ret = E.retention(D.cards, D.today);
  const goals = store.all('lgoal').filter(g => g.week === ws);
  const recent = D.studySessions.slice().sort((a, b) => (b.date + (b.createdAt || 0)) > (a.date + (a.createdAt || 0)) ? 1 : -1).slice(0, 8);
  const active = D.materials.filter(m => m.status === 'active');
  return `<div class="grid">${topicCard(D, D.nextTopic, { compact: true })}
    <div class="card c7"><div class="card-h"><h2>Неделя: ${dur(st.doneWeek)} из ${dur(s.studyWeeklyMin)}</h2><span class="sp"></span><span class="link" data-a="go" data-v="settings">изменить цель</span></div>
      ${meter(st.doneWeek / s.studyWeeklyMin)}
      <div class="col" style="margin-top:14px;gap:10px">${s.tracks.map(t => { const target = s.studyWeeklyMin * t.share / total; const done = D.studyByTrack[t.id] || 0; return `<div><div class="row small"><span>${esc(t.name)}</span><span class="sp"></span><span class="num muted">${dur(done)} / ${dur(target)}</span></div>${meter(done / target, t.color)}</div>`; }).join('')}</div>
      <div class="note acc" style="margin-top:14px">Сегодня: ${st.quota ? `${dur(st.quota)}, направление «${esc(st.track.name)}» (больше всего отстаёт от своей доли). Блоки по ${s.focusSpanMin} мин: это твоя настройка длительности концентрации.` : 'учебный блок не запланирован (режим дня или выходной). Это нормально.'}</div></div>
    <div class="c5 col" style="gap:14px">
      <div class="card"><div class="card-h"><h2>Повторение</h2></div><div class="kpis"><div class="kpi"><div class="l">К повторению</div><div class="v">${due.length}</div></div><div class="kpi"><div class="l">Всего карточек</div><div class="v">${D.cards.length}</div></div><div class="kpi"><div class="l">Удержание 30 дн</div><div class="v">${ret == null ? '-' : Math.round(ret * 100) + '%'}</div><div class="s">цель 85-90%</div></div></div>
        <div class="row" style="margin-top:10px"><button class="btn pri" data-a="srs-start" ${due.length ? '' : 'disabled'}>Начать</button><button class="btn" data-a="card-add">${icon('plus')}Карточка</button></div></div>
      <div class="card"><div class="card-h"><h2>Цели недели</h2><span class="sp"></span><button class="btn ghost sm" data-a="lgoal-add">${icon('plus')}</button></div>
        <div class="list">${goals.map(g => `<div class="li ${g.done ? 'done' : ''}"><span class="check ${g.done ? 'on' : ''}" data-a="lgoal-toggle" data-id="${g.id}"></span><div class="t"><div>${esc(g.text)}</div><div class="m">${esc(trackName(D, g.track))}</div></div><button class="btn ghost sm" data-a="lgoal-del" data-id="${g.id}">${icon('x')}</button></div>`).join('') || '<div class="small muted">Например: «прочитать главу Sabiston про анастомозы», «10 карточек по TNM»</div>'}</div></div>
    </div>
    <div class="card c6"><div class="card-h"><h2>В работе</h2><span class="sp"></span><span class="link" data-a="l-tab" data-v="materials">все материалы</span></div>
      <div class="list">${active.map(m => matRow(D, m)).join('') || '<div class="empty">Добавь книгу, статью или курс во вкладке «Материалы»</div>'}</div></div>
    <div class="card c6"><div class="card-h"><h2>Последние сессии</h2><span class="sp"></span><button class="btn ghost sm" data-a="study-add">${icon('plus')}</button></div>
      <div class="list">${recent.map(x => `<div class="li"><div class="t"><div>${esc(trackName(D, x.track))}${x.note ? ': ' + esc(x.note) : ''}</div><div class="m">${fmtDate(x.date, true)}${x.focus ? ' · концентрация ' + x.focus + '/5' : ''}</div></div><b>${dur(x.minutes)}</b><button class="btn ghost sm" data-a="study-del" data-id="${x.id}">${icon('x')}</button></div>`).join('') || '<div class="empty">Сессии появятся после таймера или отметки блока в плане</div>'}</div></div>
  </div>`;
}

function matRow(D, m) {
  const p = m.total ? m.progress / m.total : null;
  return `<div class="li"><div class="t" data-a="mat-edit" data-id="${m.id}" style="cursor:pointer"><div>${esc(m.title)}</div><div class="m">${(MAT_TYPES.find(x => x[0] === m.type) || [, ''])[1]} · ${esc(trackName(D, m.track))}${m.total ? ` · ${m.progress || 0}/${m.total}` : ''}</div>${p != null ? meter(p, trackColor(D, m.track)) : ''}</div>
    ${m.url ? `<a class="btn ghost sm" href="${esc(m.url)}" target="_blank" rel="noopener">↗</a>` : ''}${m.total && m.status !== 'done' ? `<button class="btn sm" data-a="mat-step" data-id="${m.id}">+1</button>` : ''}</div>`;
}

// ------------- повторение -------------
function buildQueue(D) {
  const due = E.srsDue(D.cards, D.today);
  const reviewed = due.filter(c => c.reps > 0 || c.lapses > 0);
  const newToday = D.cards.filter(c => c.lastReview === D.today && (c.history || []).length === 1).length;
  const fresh = due.filter(c => !c.reps && !c.lapses && !(c.history || []).length).slice(0, Math.max(0, D.settings.newCardsPerDay - newToday));
  return [...reviewed.sort((a, b) => (a.due || '') < (b.due || '') ? -1 : 1), ...fresh].map(c => c.id);
}
function reviewView(D) {
  if (!review) review = { queue: buildQueue(D), shown: false, done: 0, again: [] };
  const id = review.queue[0];
  const c = id && store.get(id);
  if (!c) {
    const left = E.srsDue(D.cards, D.today).length;
    return `<div class="card" style="max-width:640px;margin:0 auto"><div class="empty"><h2>Готово</h2><div style="margin-top:6px">Повторено: ${review.done}.${left ? ` Осталось новых карточек сверх дневного лимита: ${left}.` : ''}</div><div class="row" style="justify-content:center;margin-top:14px"><button class="btn" data-a="srs-restart">Обновить очередь</button><button class="btn" data-a="l-tab" data-v="overview">К обзору</button></div></div></div>`;
  }
  const iv = g => { const n = E.srsReview(c, g, D.today); return n.interval === 0 ? 'сегодня' : n.interval === 1 ? '1 д' : n.interval < 30 ? n.interval + ' д' : Math.round(n.interval / 30) + ' мес'; };
  return `<div style="max-width:680px;margin:0 auto" class="col">
    <div class="row small muted"><span>${esc(trackName(D, c.track))}</span><span class="sp"></span><span>осталось ${review.queue.length} · сделано ${review.done}</span></div>
    <div class="card flash">${esc(c.front)}${review.shown ? `<div class="back">${esc(c.back)}</div>` : ''}</div>
    ${review.shown ? `<div class="grades">
      <button class="btn" data-a="srs-grade" data-v="0">Снова<small>${iv(0)}</small></button><button class="btn" data-a="srs-grade" data-v="1">Трудно<small>${iv(1)}</small></button>
      <button class="btn pri" data-a="srs-grade" data-v="2">Помню<small style="color:inherit;opacity:.8">${iv(2)}</small></button><button class="btn" data-a="srs-grade" data-v="3">Легко<small>${iv(3)}</small></button></div>`
      : `<div class="note">Active Recall: сначала сформулируй ответ вслух или про себя, потом открывай.</div><button class="btn pri" style="height:44px" data-a="srs-show">Показать ответ <span class="tiny" style="opacity:.7">(пробел)</span></button>`}
    <div class="row"><button class="btn ghost sm" data-a="card-edit" data-id="${c.id}">${icon('edit')}Править</button><button class="btn ghost sm" data-a="card-suspend" data-id="${c.id}">Отложить карточку</button></div>
  </div>`;
}

// ------------- материалы -------------
function materials(D) {
  const list = D.materials.filter(m => matFilter === 'all' || (m.status || 'queue') === matFilter);
  return `<div class="row wrap" style="margin-bottom:12px">${seg('mat-filter', [['active', 'В работе'], ['queue', 'В очереди'], ['done', 'Изучено'], ['all', 'Все']], matFilter)}<span class="sp"></span><button class="btn pri" data-a="mat-add">${icon('plus')}Материал</button></div>
  <div class="grid">${D.settings.tracks.map(t => { const ms = list.filter(m => m.track === t.id); return ms.length ? `<div class="card c6"><div class="card-h"><h2>${esc(t.name)}</h2><span class="muted small">${ms.length}</span></div><div class="list">${ms.map(m => matRow(D, m)).join('')}</div></div>` : ''; }).join('') || '<div class="card c12 empty">Пусто</div>'}</div>`;
}
function matForm(D, m = {}) {
  return `<form data-f="mat" class="col"><input type="hidden" name="id" value="${esc(m.id || '')}">
    <input type="text" name="title" placeholder="Название" value="${esc(m.title || '')}" required>
    <div class="fg"><label class="f">Тип<select name="type">${opts(MAT_TYPES, m.type || 'book')}</select></label><label class="f">Направление<select name="track">${opts(D.settings.tracks.map(t => [t.id, t.name]), m.track || D.settings.tracks[0].id)}</select></label>
      <label class="f">Статус<select name="status">${opts([['queue', 'В очереди'], ['active', 'В работе'], ['done', 'Изучено']], m.status || 'active')}</select></label>
      <label class="f">Прогресс<input type="number" name="progress" min="0" value="${m.progress ?? 0}"></label><label class="f">Всего (глав/стр.)<input type="number" name="total" min="0" value="${m.total ?? ''}"></label></div>
    <input type="url" name="url" placeholder="Ссылка (PubMed, DOI, файл)" value="${esc(m.url || '')}">
    <textarea name="notes" placeholder="Конспект, ключевые идеи">${esc(m.notes || '')}</textarea>
    <div class="dlg-f">${m.id ? `<button type="button" class="btn danger" data-a="mat-del" data-id="${m.id}">Удалить</button><button type="button" class="btn" data-a="card-add" data-mat="${m.id}" data-track="${m.track}">Карточки по материалу</button><span class="sp"></span>` : ''}<button class="btn pri">Сохранить</button></div></form>`;
}

// ------------- карточки -------------
function cards(D) {
  const q = cardFilter.toLowerCase();
  const list = D.cards.filter(c => !q || (c.front + ' ' + c.back).toLowerCase().includes(q)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 200);
  return `<div class="row wrap" style="margin-bottom:12px"><input type="text" id="card-q" placeholder="Поиск по карточкам" value="${esc(cardFilter)}" style="max-width:320px"><span class="sp"></span><button class="btn" data-a="card-bulk">Импорт списком</button><button class="btn pri" data-a="card-add">${icon('plus')}Карточка</button></div>
  <div class="card"><table class="t"><tr><th>Вопрос</th><th class="hide-m">Ответ</th><th>Направление</th><th class="tr">След.</th></tr>
  ${list.map(c => `<tr data-a="card-edit" data-id="${c.id}" style="cursor:pointer;${c.suspended ? 'opacity:.5' : ''}"><td>${esc(c.front.slice(0, 90))}</td><td class="hide-m muted">${esc((c.back || '').slice(0, 70))}</td><td class="small">${esc(trackName(D, c.track))}</td><td class="tr small">${c.suspended ? 'пауза' : c.due ? fmtDate(c.due) : 'новая'}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Карточек нет. Хорошая карточка: один факт, вопрос заставляет вспоминать, а не узнавать.</td></tr>'}</table></div>`;
}
function cardForm(D, c = {}) {
  return `<form data-f="card" class="col"><input type="hidden" name="id" value="${esc(c.id || '')}"><input type="hidden" name="materialId" value="${esc(c.materialId || '')}">
    <label class="f">Вопрос<textarea name="front" required>${esc(c.front || '')}</textarea></label>
    <label class="f">Ответ<textarea name="back" required>${esc(c.back || '')}</textarea></label>
    <label class="f">Направление<select name="track">${opts(D.settings.tracks.map(t => [t.id, t.name]), c.track || D.settings.tracks[0].id)}</select></label>
    <div class="dlg-f">${c.id ? `<button type="button" class="btn danger" data-a="card-del" data-id="${c.id}">Удалить</button><span class="sp"></span>` : ''}<button class="btn pri">Сохранить</button></div></form>`;
}

// ------------- история -------------
function history(D) {
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(weekStart(D.today), -7 * (11 - i)));
  const data = weeks.map(ws => ({ label: fmtDate(ws).split(' ').slice(0, 2).join(' '), parts: D.settings.tracks.map(t => ({ v: sum(D.studySessions.filter(x => x.track === t.id && x.date >= ws && x.date <= addDays(ws, 6)).map(x => x.minutes)) / 60, color: t.color, name: t.name })) }));
  const all = D.studySessions.slice().sort((a, b) => a.date < b.date ? 1 : -1);
  const totalH = sum(all.map(x => x.minutes)) / 60;
  return `<div class="grid"><div class="card c12"><div class="card-h"><h2>Часы по неделям</h2><span class="sp"></span><span class="muted small">всего ${num(totalH, 1)} ч</span></div>${bars({ data, target: D.settings.studyWeeklyMin / 60, yFmt: v => num(v, 0) + 'ч' })}
    <div class="legend">${D.settings.tracks.map(t => `<span><i style="background:${t.color}"></i>${esc(t.name)}</span>`).join('')}</div></div>
    <div class="card c12"><table class="t"><tr><th>Дата</th><th>Направление</th><th>Тема</th><th class="tr">Время</th></tr>${all.slice(0, 60).map(x => `<tr><td>${fmtDate(x.date, true)}</td><td>${esc(trackName(D, x.track))}</td><td class="muted">${esc(x.note || '')}</td><td class="tr">${dur(x.minutes)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Пока пусто</td></tr>'}</table></div></div>`;
}

export function studyForm(D, o = {}) {
  return `<form data-f="study" class="col"><div class="fg"><label class="f">Дата<input type="date" name="date" value="${o.date || D.today}"></label><label class="f">Минуты<input type="number" name="minutes" min="5" value="${o.minutes || D.settings.focusSpanMin}" required></label>
    <label class="f">Направление<select name="track">${opts(D.settings.tracks.map(t => [t.id, t.name]), o.track || D.plan.study.track.id)}</select></label><label class="f">Концентрация 1-5<input type="number" name="focus" min="1" max="5" value="${o.focus || ''}"></label></div>
    <input type="text" name="note" placeholder="Что изучал" value="${esc(o.note || '')}"><label class="f">Материал<select name="materialId"><option value="">-</option>${opts(D.materials.filter(m => m.status !== 'done').map(m => [m.id, m.title]), o.materialId)}</select></label>
    <div class="dlg-f"><button class="btn pri">Сохранить</button></div></form>`;
}

on({
  'topic-done': (ds) => { completeTopic(ds.id, window.__D.settings.focusSpanMin, window.__D.today); toast('Тема пройдена: вопросы добавлены в повторение'); },
  'topic-toggle': (ds) => { const t = store.get(ds.id); if (t.done) uncompleteTopic(ds.id); else completeTopic(ds.id, window.__D.settings.focusSpanMin, window.__D.today); },
  'topic-open': (ds) => { const t = store.get(ds.id); modal(t.title, `<div class="small"><b>Цель:</b> ${esc(t.goal)}</div><ol class="small" style="padding-left:20px">${t.q.map(q => `<li>${esc(q)}</li>`).join('')}</ol><div class="small muted"><b>Источник:</b> ${esc(t.src)}</div><div class="small muted"><b>Применить:</b> ${esc(t.practice)}</div>`); },
  'l-tab': (ds) => { tab = ds.v; if (ds.v === 'review') review = null; close(); window.__rerender(); },
  'srs-start': () => { tab = 'review'; review = null; window.__rerender(); },
  'srs-restart': () => { review = null; window.__rerender(); },
  'srs-show': () => { if (review) { review.shown = true; window.__rerender(); } },
  'srs-grade': (ds) => {
    const D = window.__D; const id = review.queue.shift(); const c = store.get(id); const g = Number(ds.v);
    const n = E.srsReview(c, g, D.today);
    const { id: _i, kind, updatedAt, dirty, ...rest } = n;
    store.put('card', { ...rest, id });
    if (g === 0) review.queue.splice(Math.min(review.queue.length, 4), 0, id);
    review.done++; review.shown = false; window.__rerender();
  },
  'card-add': (ds) => { close(); modal('Карточка', cardForm(window.__D, { materialId: ds.mat, track: ds.track })); },
  'card-edit': (ds) => modal('Карточка', cardForm(window.__D, store.get(ds.id))),
  'card-del': (ds) => { store.remove(ds.id); if (review) review.queue = review.queue.filter(x => x !== ds.id); close(); },
  'card-suspend': (ds) => { store.patch(ds.id, { suspended: true }); review.queue = review.queue.filter(x => x !== ds.id); review.shown = false; toast('Карточка отложена'); window.__rerender(); },
  'card-bulk': () => modal('Импорт карточек', `<form data-f="card-bulk" class="col"><div class="small muted">Одна карточка на строку: <code>вопрос :: ответ</code>. Подходит для экспорта из заметок или Anki (поле1 Tab поле2 тоже работает).</div><textarea name="text" style="min-height:200px" placeholder="Критерии Clavien-Dindo IIIb :: Вмешательство под общей анестезией"></textarea><label class="f">Направление<select name="track">${opts(window.__D.settings.tracks.map(t => [t.id, t.name]), window.__D.settings.tracks[0].id)}</select></label><div class="dlg-f"><button class="btn pri">Импортировать</button></div></form>`),
  'mat-filter': (ds) => { matFilter = ds.v; window.__rerender(); },
  'mat-add': () => modal('Материал', matForm(window.__D)),
  'mat-edit': (ds) => modal('Материал', matForm(window.__D, store.get(ds.id))),
  'mat-del': (ds) => { store.remove(ds.id); close(); },
  'mat-step': (ds) => { const m = store.get(ds.id); const p = (m.progress || 0) + 1; store.patch(m.id, { progress: p, status: m.total && p >= m.total ? 'done' : m.status }); if (m.total && p >= m.total) toast('Материал изучен'); },
  'lgoal-add': () => modal('Цель на неделю', `<form data-f="lgoal" class="col"><input type="text" name="text" placeholder="Конкретный результат к воскресенью" required><label class="f">Направление<select name="track">${opts(window.__D.settings.tracks.map(t => [t.id, t.name]), '')}</select></label><div class="dlg-f"><button class="btn pri">Добавить</button></div></form>`),
  'lgoal-toggle': (ds) => { const g = store.get(ds.id); store.patch(ds.id, { done: !g.done }); },
  'lgoal-del': (ds) => store.remove(ds.id),
  'study-add': () => modal('Учебная сессия', studyForm(window.__D)),
  'study-del': (ds) => store.remove(ds.id)
});
onForm({
  'card': (o) => { const prev = o.id ? store.get(o.id) : {}; store.put('card', { ...prev, id: o.id || undefined, front: o.front, back: o.back, track: o.track, materialId: o.materialId || null }); close(); toast('Карточка сохранена'); },
  'card-bulk': (o) => {
    let n = 0;
    for (const line of o.text.split('\n')) { const parts = line.includes('::') ? line.split('::') : line.split('\t'); if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) { store.put('card', { front: parts[0].trim(), back: parts.slice(1).join(' ').trim(), track: o.track }); n++; } }
    close(); toast(`Импортировано карточек: ${n}`);
  },
  'mat': (o) => { const prev = o.id ? store.get(o.id) : {}; store.put('material', { ...prev, ...o, id: o.id || undefined }); close(); },
  'lgoal': (o) => { store.put('lgoal', { text: o.text, track: o.track, week: weekStart(window.__D.today), done: false }); close(); },
  'study': (o) => { store.put('study', { ...o, materialId: o.materialId || null }); close(); toast(`Записано ${dur(o.minutes)} учёбы`); }
});

document.addEventListener('keydown', e => {
  if (tab !== 'review' || !review || location.hash !== '#learn') return;
  if (e.target.matches('input, textarea')) return;
  if (e.code === 'Space') { e.preventDefault(); if (!review.shown) document.querySelector('[data-a="srs-show"]')?.click(); }
  if (review.shown && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) e.preventDefault(), document.querySelector(`[data-a="srs-grade"][data-v="${Number(e.code.slice(-1)) - 1}"]`)?.click();
});
document.addEventListener('input', e => { if (e.target.id === 'card-q') { cardFilter = e.target.value; clearTimeout(window.__cq); window.__cq = setTimeout(() => { window.__rerender(); const i = document.getElementById('card-q'); i?.focus(); i?.setSelectionRange(i.value.length, i.value.length); }, 250); } });
