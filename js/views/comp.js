// Общие компоненты экранов: задачи, привычки, формы быстрого ввода.
import * as store from '../store.js';
import * as E from '../engine.js';
import { esc, dkey, addDays, fmtDate, dur, uid, num } from '../util.js';
import { icon, on, onForm, modal, close, toast, opts, formData, confirmBox } from '../ui.js';

export const PRI_LABEL = { must: 'Обязательно', should: 'Желательно', could: 'Дополнительно' };
export const PRI_CHIP = { must: 'bad', should: 'acc', could: '' };

export function taskRow(t, D, { compact = false } = {}) {
  const overdue = t.due && t.due < D.today && !t.done;
  const proj = t.project && D.projects.find(p => p.id === t.project);
  return `<div class="li ${t.done ? 'done' : ''}">
    <span class="check round ${t.done ? 'on' : ''}" data-a="task-toggle" data-id="${t.id}" role="checkbox" aria-checked="${!!t.done}"></span>
    <div class="t" data-a="task-edit" data-id="${t.id}" style="cursor:pointer">
      <div>${esc(t.title)}</div>${t.firstStep ? `<div class="m" style="color:var(--accent)">▸ ${esc(t.firstStep)}</div>` : ''}
      ${compact ? '' : `<div class="m">${[t.due ? `<span class="${overdue ? 'bad' : ''}">${t.due === D.today ? 'сегодня' : fmtDate(t.due)}</span>` : '', t.estimate ? dur(t.estimate) : '', t.energy === 'deep' ? 'концентрация' : '', proj ? esc(proj.name) : ''].filter(Boolean).join(' · ')}</div>`}
    </div>
    ${t.priority && !compact ? `<span class="chip ${PRI_CHIP[t.priority]}">${PRI_LABEL[t.priority]}</span>` : ''}
  </div>`;
}

export function taskForm(t = {}, D) {
  return `<form data-f="task" class="col">
    <input type="hidden" name="id" value="${esc(t.id || '')}">
    <input type="text" name="title" placeholder="Что нужно сделать" value="${esc(t.title || '')}" required autofocus>
    <div class="fg">
      <label class="f">Приоритет<select name="priority">${opts([['must', 'Обязательно'], ['should', 'Желательно'], ['could', 'Дополнительно']], t.priority || 'should')}</select></label>
      <label class="f">Срок<input type="date" name="due" value="${esc(t.due || '')}"></label>
      <label class="f">Оценка, мин<input type="number" name="estimate" min="5" step="5" value="${t.estimate ?? ''}" placeholder="30"></label>
      <label class="f">Тип<select name="energy">${opts([['light', 'Лёгкая'], ['deep', 'Нужна концентрация']], t.energy || 'light')}</select></label>
      <label class="f">Проект<select name="project"><option value="">Без проекта</option>${opts(D.projects.filter(p => p.status !== 'done').map(p => [p.id, p.name]), t.project)}</select></label>
    </div>
    <label class="f">Первый шаг на 2-5 минут (с него легко начать)<input type="text" name="firstStep" value="${esc(t.firstStep || '')}" placeholder="Например: открыть файл и написать заголовок"></label>
    <textarea name="notes" placeholder="Заметки">${esc(t.notes || '')}</textarea>
    <div class="dlg-f">${t.id ? `<button type="button" class="btn danger" data-a="task-del" data-id="${t.id}">${icon('trash')}Удалить</button><span class="sp"></span>` : ''}<button type="button" class="btn" data-a="close-modal">Отмена</button><button class="btn pri">Сохранить</button></div>
  </form>`;
}

export function habitRow(h, D, { showStats = true } = {}) {
  const st = E.habitStats(h, D.habitLogs, D.today);
  const log = st.todayLog;
  const cls = log?.status === 'done' ? 'on' : log?.status === 'min' ? 'min' : log?.status === 'skip' ? 'skip' : '';
  const f = h.freq || { type: 'daily' };
  const freq = f.type === 'weekly' ? `${st.weekDone}/${f.n} за неделю` : f.type === 'days' ? 'по дням недели' : 'ежедневно';
  return `<div class="li">
    <span class="check ${cls}" data-a="habit-tap" data-id="${h.id}" title="Отметить"></span>
    <div class="t">
      <div>${esc(h.name)}${st.neverMissTwice ? ' <span class="chip warn">не пропускать дважды</span>' : ''}</div>
      ${showStats ? `<div class="m">${freq}${st.streak > 1 ? ` · подряд ${st.streak}` : ''}${st.r28 != null ? ` · ${Math.round(st.r28 * 100)}% за 4 нед.` : ''}${st.neverMissTwice && h.minimal ? ` · минимум: ${esc(h.minimal)}` : ''}</div>` : ''}
    </div>
    <button class="btn ghost sm" data-a="habit-menu" data-id="${h.id}" aria-label="Варианты">${icon('more')}</button>
  </div>`;
}

export function checkinWidget(D) {
  const c = D.checkins[D.today];
  return `<div class="row wrap" style="gap:6px"><span class="small muted">Самочувствие</span>
    ${[1, 2, 3, 4, 5].map(n => `<button class="btn sm ${c?.energy === n ? 'pri' : ''}" data-a="checkin" data-v="${n}">${n}</button>`).join('')}</div>`;
}

// ------------------- действия -------------------
on({
  'task-new': (ds) => {
    const D = window.__D;
    modal('Новая задача', taskForm({ due: ds.due || '', priority: ds.priority || 'should', project: ds.project || '' }, D));
  },
  'task-edit': (ds) => { const t = store.get(ds.id); if (t) modal('Задача', taskForm(t, window.__D)); },
  'task-toggle': (ds) => {
    const t = store.get(ds.id); if (!t) return;
    const done = !t.done;
    store.patch(t.id, { done, doneAt: done ? Date.now() : null });
    if (done) toast('Задача выполнена', () => store.patch(t.id, { done: false, doneAt: null }));
  },
  'task-del': async (ds) => { close(); const t = store.get(ds.id); store.remove(ds.id); toast('Задача удалена', () => store.put('task', { ...t, deleted: false })); },
  'habit-tap': (ds) => {
    const D = window.__D; const id = `hl_${ds.id}_${D.today}`; const cur = store.get(id);
    if (cur && cur.status === 'done') store.put('habitlog', { id, deleted: true });
    else store.put('habitlog', { id, habitId: ds.id, date: D.today, status: 'done', reason: null, deleted: false });
  },
  'habit-menu': (ds) => habitMenu(ds.id, window.__D.today),
  'habit-mark': (ds) => {
    const id = `hl_${ds.id}_${ds.date}`;
    if (ds.status === 'clear') store.put('habitlog', { id, deleted: true });
    else if (ds.status === 'skip') { skipDialog(ds.id, ds.date); return; }
    else store.put('habitlog', { id, habitId: ds.id, date: ds.date, status: ds.status, deleted: false });
    close();
  },
  'checkin': (ds) => {
    const D = window.__D; const id = 'ci_' + D.today; const cur = store.get(id) || {};
    store.put('checkin', { ...cur, id, date: D.today, energy: Number(ds.v) });
  }
});

export function habitMenu(hid, date) {
  const h = store.get(hid); if (!h) return;
  modal(h.name, `<div class="col">
    <div class="small muted">${fmtDate(date, true)}</div>
    <button class="btn" data-a="habit-mark" data-id="${hid}" data-date="${date}" data-status="done">${icon('check')}Выполнено полностью</button>
    <button class="btn" data-a="habit-mark" data-id="${hid}" data-date="${date}" data-status="min">Минимальная версия${h.minimal ? `: ${esc(h.minimal)}` : ''}</button>
    <button class="btn" data-a="habit-mark" data-id="${hid}" data-date="${date}" data-status="skip">Пропуск с причиной</button>
    <button class="btn ghost" data-a="habit-mark" data-id="${hid}" data-date="${date}" data-status="clear">Снять отметку</button>
    <hr style="margin:4px 0"><button class="btn ghost" data-a="habit-edit" data-id="${hid}">${icon('edit')}Изменить привычку</button>
  </div>`);
}

function skipDialog(hid, date) {
  modal('Почему не получилось?', `<form data-f="habit-skip" class="col">
    <input type="hidden" name="hid" value="${hid}"><input type="hidden" name="date" value="${date}">
    <div class="small muted">Без оценок: причина нужна, чтобы система подстроилась.</div>
    <div class="row wrap" style="gap:6px">${E.SKIP_REASONS.map((r, i) => `<label class="chip" style="cursor:pointer"><input type="radio" name="reason" value="${r.id}" ${i === 0 ? 'checked' : ''} style="margin:0 4px 0 0">${r.label}</label>`).join('')}</div>
    <input type="text" name="note" placeholder="Комментарий (необязательно)">
    <div class="dlg-f"><button type="button" class="btn" data-a="close-modal">Отмена</button><button class="btn pri">Сохранить</button></div></form>`);
}

onForm({
  'task': (o) => {
    if (!o.title) return;
    const prev = o.id ? store.get(o.id) : null;
    const moved = prev && prev.due && o.due && o.due > prev.due ? (prev.moved || 0) + 1 : (prev?.moved || 0);
    store.put('task', { ...(prev || {}), id: o.id || undefined, title: o.title, priority: o.priority, due: o.due || null, estimate: o.estimate || null, energy: o.energy, project: o.project || null, notes: o.notes, firstStep: o.firstStep, moved, done: prev?.done || false });
    close(); toast(prev ? 'Сохранено' : 'Задача добавлена');
  },
  'habit-skip': (o) => {
    store.put('habitlog', { id: `hl_${o.hid}_${o.date}`, habitId: o.hid, date: o.date, status: 'skip', reason: o.reason, note: o.note, deleted: false });
    close();
    const tip = E.REASON_ADVICE[o.reason];
    toast('Записано. ' + (tip ? tip.split('.')[0] + '.' : ''));
  }
});

// ------------------- быстрый ввод -------------------
const TRACK_WORDS = { 'мед': 'med', 'медиц': 'med', 'хир': 'surg', 'хирург': 'surg', 'наук': 'sci', 'науч': 'sci', 'англ': 'eng', 'english': 'eng', 'общ': 'gen' };
export function parseQuick(text, D) {
  const s = text.trim(); const low = s.toLowerCase();
  const n = x => Number(String(x).replace(',', '.'));
  let m;
  if ((m = low.match(/^(вода|w|water)\s+(\d+[.,]?\d*)\s*(л|мл|ml)?$/))) { let ml = n(m[2]); if (m[3] === 'л' || ml < 10) ml *= 1000; return { kind: 'water', ml, label: `Вода +${ml} мл` }; }
  if ((m = low.match(/^(вес|weight)\s+(\d+[.,]?\d*)/))) return { kind: 'weight', kg: n(m[2]), label: `Вес ${m[2]} кг` };
  if ((m = low.match(/^сон\s+(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/))) return { kind: 'sleeplog', bed: m[1].replace('.', ':'), wake: m[2].replace('.', ':'), label: `Сон ${m[1]} → ${m[2]}` };
  if ((m = low.match(/^(энерг[а-яё]*|самочув[а-яё]*)\s+([1-5])$/))) return { kind: 'checkin', energy: n(m[2]), label: `Самочувствие ${m[2]}/5` };
  if ((m = low.match(/^(уч[её]ба|study)\s+(\d+)\s*(мин|м)?\s*(.*)$/))) {
    const word = m[4] || ''; let track = D.settings.tracks[0].id;
    for (const [k, v] of Object.entries(TRACK_WORDS)) if (word.includes(k)) track = v;
    for (const t of D.settings.tracks) if (word && t.name.toLowerCase().startsWith(word.slice(0, 4))) track = t.id;
    const tn = D.settings.tracks.find(t => t.id === track)?.name;
    return { kind: 'study', minutes: n(m[2]), track, note: word, label: `Учёба ${m[2]} мин: ${tn}` };
  }
  if ((m = low.match(/^(трен[а-яё]*|workout)\s+(\d+)\s*(мин)?\s*(.*)$/))) return { kind: 'workout', minutes: n(m[2]), type: m[4] || 'тренировка', label: `Тренировка ${m[2]} мин${m[4] ? ': ' + m[4] : ''}` };
  if ((m = low.match(/^(отдых|досуг)\s+(\d+)\s*(мин)?\s*(.*)$/))) {
    const w = m[4] || ''; const cat = /фильм|сериал|кино/.test(w) ? 'film' : /игр/.test(w) ? 'game' : /книг|чтен/.test(w) ? 'read' : /друз|встреч|сем/.test(w) ? 'social' : /скрол|соцсет|ютуб|youtube|tiktok|reels/.test(w) ? 'scroll' : /прогул/.test(w) ? 'walk' : 'other';
    return { kind: 'leisure', minutes: n(m[2]), cat, title: w, label: `Отдых ${m[2]} мин${w ? ': ' + w : ''}` };
  }
  if ((m = s.match(/^(.+?)\s+(\d+)\s*(ккал|kcal)(?:\s+б(\d+[.,]?\d*))?(?:\s+ж(\d+[.,]?\d*))?(?:\s+у(\d+[.,]?\d*))?/i))) {
    return { kind: 'food', name: m[1].replace(/^(еда|food)\s+/i, ''), kcal: n(m[2]), p: m[4] ? n(m[4]) : 0, f: m[5] ? n(m[5]) : 0, c: m[6] ? n(m[6]) : 0, label: `Еда: ${m[1]} ${m[2]} ккал` };
  }
  if ((m = s.match(/^(заметка|note)[:\s]+(.+)$/i))) return { kind: 'note', text: m[2], label: 'Заметка' };
  if ((m = low.match(/^(расход|трата|потратил)\s+(\d+[.,]?\d*)\s*(тг|₸|тенге)?\s*(.*)$/))) return { kind: 'expense', amount: n(m[2]), cat: guessCat(m[4]), note: m[4], label: `Расход ${m[2]} ₸${m[4] ? ': ' + m[4] : ''}` };
  if (!s) return null;
  // задача
  let title = s, priority = 'should', due = null;
  if (/!\s*$|^!/.test(title)) { priority = 'must'; title = title.replace(/!/g, '').trim(); }
  else if (/\?\s*$/.test(title)) { priority = 'could'; title = title.replace(/\?\s*$/, '').trim(); }
  if (/(^|\s)сегодня(?=\s|$)/i.test(title)) { due = D.today; title = title.replace(/(^|\s)сегодня(?=\s|$)/i, ' '); }
  else if (/(^|\s)завтра(?=\s|$)/i.test(title)) { due = addDays(D.today, 1); title = title.replace(/(^|\s)завтра(?=\s|$)/i, ' '); }
  return { kind: 'task', title: title.trim(), priority, due, label: `Задача (${PRI_LABEL[priority].toLowerCase()}${due ? ', ' + (due === D.today ? 'сегодня' : 'завтра') : ''}): ${title.trim()}` };
}

export function applyQuick(q, D) {
  const today = D.today;
  switch (q.kind) {
    case 'water': return store.put('water', { date: today, ml: q.ml });
    case 'weight': return store.put('weight', { id: 'wt_' + today, date: today, kg: q.kg, ts: Date.now() });
    case 'sleeplog': return store.put('sleeplog', { id: 'sl_' + today, date: today, bed: q.bed, wake: q.wake });
    case 'checkin': { const c = store.get('ci_' + today) || {}; return store.put('checkin', { ...c, id: 'ci_' + today, date: today, energy: q.energy }); }
    case 'study': return store.put('study', { date: today, minutes: q.minutes, track: q.track, note: q.note });
    case 'workout': return store.put('workout', { date: today, minutes: q.minutes, type: q.type, intensity: 3 });
    case 'leisure': return store.put('leisure', { date: today, minutes: q.minutes, cat: q.cat, title: q.title });
    case 'food': return store.put('food', { date: today, name: q.name, kcal: q.kcal, p: q.p, f: q.f, c: q.c, meal: mealNow() });
    case 'note': return store.put('note', { date: today, text: q.text });
    case 'expense': return store.put('expense', { date: today, amount: q.amount, cat: q.cat, note: q.note });
    case 'task': return store.put('task', { title: q.title, priority: q.priority, due: q.due, energy: 'light', done: false });
  }
}
export const EXP_CATS = [['food', 'Продукты'], ['cafe', 'Кафе и доставка'], ['transport', 'Транспорт'], ['home', 'Жильё и коммуналка'], ['phone', 'Связь и подписки'], ['health', 'Здоровье'], ['edu', 'Обучение и книги'], ['fun', 'Развлечения'], ['clothes', 'Одежда'], ['other', 'Прочее']];
export function guessCat(t) { t = String(t || '').toLowerCase(); return /прод|магаз|еда|супер/.test(t) ? 'food' : /кафе|достав|ресто|кофе|glovo|wolt/.test(t) ? 'cafe' : /такси|авто|бенз|транс|yandex|яндекс/.test(t) ? 'transport' : /квар|аренд|комму/.test(t) ? 'home' : /связь|подпис|интернет|телефон/.test(t) ? 'phone' : /апте|врач|здор|лекар/.test(t) ? 'health' : /книг|курс|usmle|обуч|uworld/.test(t) ? 'edu' : /игр|кино|switch|развл/.test(t) ? 'fun' : /одеж|обув/.test(t) ? 'clothes' : 'other'; }
export function mealNow() { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack'; }

export function openQuickAdd() {
  const d = modal('Быстрый ввод', `<div class="qa"><form data-f="quick"><input type="text" name="q" id="qa-in" placeholder="Задача, «вода 300», «вес 92,4», «учёба 30 хирургия»" autocomplete="off" autofocus></form>
    <div class="qa-prev" id="qa-prev"></div></div>
    <div class="qa-hints">${['вода 250', 'вес 92,4', 'сон 23:30-06:10', 'учёба 30 хирургия', 'тренировка 40 силовая', 'отдых 60 фильм', 'гречка с курицей 520 ккал б40 ж12 у55', 'энергия 4', 'расход 2500 продукты', 'Позвонить в банк завтра !'].map(h => `<button class="chip" data-a="qa-fill" data-v="${esc(h)}">${esc(h)}</button>`).join('')}</div>
    <div class="tiny muted">«!» в конце задачи: обязательная, «?»: дополнительная. Ctrl+K открывает это окно с любого экрана.</div>`);
  const inp = d.querySelector('#qa-in'), prev = d.querySelector('#qa-prev');
  const upd = () => { const q = parseQuick(inp.value, window.__D); prev.textContent = q ? '→ ' + q.label : ''; };
  inp.addEventListener('input', upd);
  setTimeout(() => inp.focus(), 50);
}
on({ 'quick': openQuickAdd, 'qa-fill': (ds) => { const i = document.getElementById('qa-in'); if (i) { i.value = ds.v; i.dispatchEvent(new Event('input')); i.focus(); } } });
onForm({
  'quick': (o) => {
    const q = parseQuick(o.q, window.__D); if (!q) return;
    applyQuick(q, window.__D); close(); toast('Добавлено: ' + q.label);
  }
});

// ------------------- завершение темы программы и тренировки -------------------
/** Тема пройдена: отметка, учебная сессия и 3 карточки Active Recall для интервального повторения */
export function completeTopic(topicId, minutes, date) {
  const t = store.get(topicId); if (!t) return;
  store.patch(topicId, { done: true, doneAt: Date.now(), doneDate: date });
  store.put('study', { id: 'st_' + topicId, date, minutes: Number(minutes) || 30, track: t.track, note: t.title, topicId });
  (t.q || []).forEach((q, i) => {
    const id = `cd_${topicId}_${i}`;
    if (!store.get(id)) store.put('card', { id, front: `${t.title}\n\n${q}`, back: `Ответь вслух, затем сверь с источником: ${t.src}. Можно записать свой ответ сюда (Править).`, track: t.track, topicId, due: addDays(date, 1) });
  });
}
export function uncompleteTopic(topicId) {
  const t = store.get(topicId); if (!t) return;
  store.patch(topicId, { done: false, doneAt: null, doneDate: null });
  store.put('study', { id: 'st_' + topicId, deleted: true });
}
export function completeWorkout(letter, minutes, date, blockId) {
  store.put('workout', { id: `wo_${date}_${blockId || letter}`, date, minutes: Number(minutes) || 40, type: letter ? 'Тренировка ' + letter : 'Тренировка', session: letter || null, intensity: 3 });
}
