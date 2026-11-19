// Профиль: лист персонажа. Портрет, характеристики по реальным данным, итоги пути и печати.
// Без наказаний: печати не теряются, характеристики показывают состояние, а не оценку.
import * as store from '../store.js';
import * as E from '../engine.js';
import { esc, dur, num, int, fmtDate, addDays, rangeKeys, weekStart, sum, mean, dkey, daysBetween, clamp } from '../util.js';
import { icon, sigil, on, onForm, modal, close, toast } from '../ui.js';
import { saveSettings } from '../data.js';
import { opts } from '../ui.js';
import { seedGoals } from '../seed.js';
import { BEHAVIOR } from '../content/strategy.js';
import * as sync from '../sync.js';

// ---------- Анкета: всё, что нужно от пользователя, в одном месте ----------
const REQUIRED = ['sex', 'age', 'heightCm', 'startWeightKg', 'healthLimits', 'trainPlace', 'wake', 'workStart', 'workEnd', 'commuteMin', 'bedtime'];
export function anketaProgress(s0) {
  const s = s0 === undefined ? (store.get('settings') || {}) : s0; const ok = REQUIRED.filter(k => s[k] !== undefined && s[k] !== null && s[k] !== ''); return { done: ok.length, total: REQUIRED.length, missing: REQUIRED.filter(k => !ok.includes(k)) }; }

function anketa(D) {
  const s = D.settings, pr = anketaProgress(store.get('settings') || {});
  const req = '<span class="req" title="обязательно">*</span>';
  const f = (name, label, type = 'text', extra = '', isReq = false) => `<label class="f"><span>${label}${isReq ? req : ''}</span><input type="${type}" name="${name}" value="${esc(s[name] ?? '')}" ${type === 'number' ? 'step="any"' : ''} ${extra}></label>`;
  const sel = (name, label, options, isReq = false) => `<label class="f"><span>${label}${isReq ? req : ''}</span><select name="${name}"><option value="">выбрать</option>${opts(options, s[name])}</select></label>`;
  return `<div class="card c12 anketa ${s.anketaDone ? '' : 'now'}" style="animation:none" id="anketa">
    <div class="card-h"><h2>Анкета</h2><span class="sp"></span><span class="small ${pr.done === pr.total ? 'good' : 'warn'}">обязательных: ${pr.done} из ${pr.total}</span></div>
    <div class="small muted" style="margin-bottom:12px">Заполни один раз и сохрани. Отсюда считаются калории, меню, тренировки, расписание, цели и стратегия. Звёздочкой отмечено обязательное, остальное по желанию. Шаги, сон, пульс и вес потом приходят из Apple Health сами.</div>
    <form data-f="anketa" class="col" style="gap:18px">
      <fieldset><legend>Тело</legend><div class="fg">${sel('sex', 'Пол', [['m', 'Мужской'], ['f', 'Женский']], true)}${f('age', 'Возраст', 'number', 'min="16" max="90"', true)}${f('heightCm', 'Рост, см', 'number', 'min="120" max="230"', true)}${f('startWeightKg', 'Вес сейчас, кг', 'number', 'min="35" max="300"', true)}${f('goalWeightKg', 'Целевой вес, кг', 'number', 'min="35" max="300"')}${f('goalDate', 'К какой дате', 'date')}</div></fieldset>
      <fieldset><legend>Здоровье и тренировки</legend><div class="fg">
        <label class="f" style="grid-column:1/-1"><span>Ограничения для нагрузок${req}</span><input type="text" name="healthLimits" value="${esc(s.healthLimits ?? '')}" placeholder="Например: «нет» или «болит колено при беге»"></label>
        ${sel('fitnessLevel', 'Уровень подготовки', [['beginner', 'Начинаю или давно не занимался'], ['mid', 'Занимаюсь нерегулярно'], ['adv', 'Регулярно тренируюсь']])}
        ${sel('trainPlace', 'Где тренироваться', [['gym', 'Зал'], ['home', 'Дома']], true)}
        ${sel('workoutsPerWeek', 'Тренировок в неделю', [[2, '2'], [3, '3 (советую)'], [4, '4']])}</div></fieldset>
      <fieldset><legend>Питание</legend><div class="fg">
        <label class="f" style="grid-column:1/-1">Не ем / аллергии (через запятую)<input type="text" name="foodExclude" value="${esc(s.foodExclude ?? '')}" placeholder="Например: рыба, творог"></label>
        ${sel('cooking', 'Готовка', [['batch', '2 раза в неделю впрок'], ['daily', 'Каждый день понемногу'], ['none', 'Почти не готовлю']])}
        ${sel('lunchMode', 'Обед на работе', [['container', 'Беру с собой'], ['canteen', 'Столовая или кафе']])}</div></fieldset>
      <fieldset><legend>Режим</legend><div class="fg">${f('wake', 'Подъём', 'time', '', true)}${f('workStart', 'Работа с', 'time', '', true)}${f('workEnd', 'Работа до', 'time', '', true)}${f('commuteMin', 'Дорога в одну сторону, мин', 'number', 'min="0" max="180"', true)}${f('bedtime', 'Отбой', 'time', '', true)}${f('dutiesPerMonth', 'Дежурств в месяц', 'number', 'min="0" max="15"')}</div></fieldset>
      <fieldset><legend>Учёба и USMLE</legend><div class="fg">${sel('studyWeeklyMin', 'Учёба в неделю', [[120, '2 часа'], [180, '3 часа (советую)'], [240, '4 часа'], [300, '5 часов']])}${sel('usmleStep', 'Какой экзамен', [[1, 'Step 1'], [2, 'Step 2 CK']])}${f('usmleDate', 'Дата экзамена (если есть)', 'date')}${sel('qbank', 'Банк вопросов', [['uworld', 'UWorld'], ['amboss', 'Amboss'], ['none', 'Пока нет']])}</div></fieldset>
      <fieldset><legend>Деньги (необязательно)</legend><div class="fg">${f('finIncome', 'Доход в месяц, ₸', 'number', 'min="0"')}${f('finFixed', 'Обязательные расходы в месяц, ₸', 'number', 'min="0"')}${f('finReserve', 'Резерв сейчас, ₸', 'number', 'min="0"')}</div></fieldset>
      <fieldset><legend>Синхронизация устройств (необязательно)</legend><div class="small muted" style="margin-bottom:8px">Если уже создал проект Supabase (инструкция в README), впиши данные: остальные устройства подключатся этим же email и паролем.${sync.isSignedIn() ? ' <b class="good">Уже подключено: ' + esc(sync.session()?.user?.email || '') + '</b>' : ''}</div>
        <div class="fg"><label class="f">Адрес проекта<input type="url" name="sbUrl" value="${esc(sync.config()?.url || '')}" placeholder="https://xxxx.supabase.co"></label><label class="f">Anon key<input type="text" name="sbKey" value="${esc(sync.config()?.anonKey || '')}"></label><label class="f">Email<input type="email" name="sbEmail" autocomplete="username"></label><label class="f">Пароль<input type="password" name="sbPassword" autocomplete="current-password"></label></div></fieldset>
      <div class="row"><span class="sp"></span><button class="btn pri" style="height:44px;padding:0 22px">Сохранить анкету</button></div>
    </form></div>`;
}


export const title = 'Профиль';

export function avatar(D, size = 96) {
  const s = D.settings;
  const initials = (s.name || 'Путник').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return `<div class="ava" style="--sz:${size}px">${s.avatar ? `<img src="${esc(s.avatar)}" alt="">` : `<span>${esc(initials)}</span>`}</div>`;
}

function firstDay(D) {
  let min = D.today;
  for (const k of ['habitlog', 'task', 'study', 'food', 'weight', 'checkin', 'planstate', 'workout', 'leisure']) for (const i of store.all(k)) {
    if (i.date && i.date < min) min = i.date;
    if (i.createdAt) { const c = dkey(new Date(i.createdAt)); if (c < min) min = c; }
  }
  const h = D.samples.reduce((m, x) => x.start_at < m ? x.start_at : m, '9999');
  if (h !== '9999' && dkey(new Date(h)) < min) min = dkey(new Date(h));
  return min;
}

/** Характеристики 0-100: состояние за последние недели */
function attributes(D) {
  const s = D.settings, k28 = rangeKeys(D.today, 28), k14 = rangeKeys(D.today, 14);
  const wo = k28.filter(k => D.workoutsByDay[k]).length / Math.max(1, s.workoutsPerWeek * 4);
  const steps = mean(k14.map(k => D.daily[k]?.steps)); const stepsF = steps ? steps / s.stepsTarget : null;
  const body = stepsF == null ? wo : (wo * .6 + Math.min(1, stepsF) * .4);
  const sl = E.sleepStats(D.nights, D.today, 14); const sleep = sl.avgMin ? clamp((sl.avgMin / 60 - (s.sleepTargetH - 2)) / 2, 0, 1) : null;
  const studied = sum(k28.map(k => D.studyByDay[k] || 0)); const mind = studied / Math.max(1, s.studyWeeklyMin * 4);
  const hr = D.habits.filter(h => !h.paused).map(h => E.habitStats(h, D.habitLogs, D.today).r28).filter(v => v != null); const spirit = hr.length ? mean(hr) : null;
  const leis = sum(D.leisureLogs.filter(l => l.date >= k28[0] && l.cat !== 'scroll').map(l => l.minutes || 0)); const rest = leis / Math.max(1, s.leisureMinDaily * 28 * 0.5);
  const f = v => v == null ? null : Math.round(clamp(v, 0, 1) * 100);
  return [
    { key: 'Сила тела', v: f(body), ic: 'health', hint: `тренировки ${k28.filter(k => D.workoutsByDay[k]).length} за 4 нед.${steps ? `, шаги ${int(steps)}/день` : ''}` },
    { key: 'Сон', v: f(sleep), ic: 'today', hint: sl.avgMin ? `в среднем ${dur(sl.avgMin)} за 2 недели` : 'нет данных сна' },
    { key: 'Разум', v: f(mind), ic: 'learn', hint: `${dur(studied)} учёбы за 4 недели` },
    { key: 'Дух', v: f(spirit), ic: 'habits', hint: spirit != null ? `ритуалы держатся на ${Math.round(spirit * 100)}%` : 'нет ритуалов' },
    { key: 'Отдых', v: f(rest), ic: 'rest', hint: `${dur(leis)} осознанного отдыха за 4 недели` }
  ];
}

/** Итоги пути за всё время */
function totals(D) {
  const studyMin = sum(D.studySessions.map(x => +x.minutes || 0));
  const rituals = D.habitLogs.filter(l => l.status === 'done' || l.status === 'min').length;
  const tasks = D.tasks.filter(t => t.done).length;
  const steps = sum(Object.values(D.daily).map(d => d.steps || 0));
  const workouts = Object.keys(D.workoutsByDay).length;
  const reviews = sum(D.cards.map(c => (c.history || []).length));
  const lost = D.trend.length >= 2 ? D.trend[0].trend - D.trend.at(-1).trend : null;
  const nights = Object.keys(D.nights).length;
  return { studyMin, rituals, tasks, steps, workouts, reviews, lost, nights, duties: Object.values(D.days).filter(d => d.type === 'duty').length, leisure: D.leisureLogs.filter(l => l.cat !== 'scroll').length };
}

/** Печати: отмечают вехи, никогда не отнимаются */
function seals(D, T) {
  const s = D.settings;
  const goodNights = rangeKeys(D.today, 14).filter(k => D.nights[k] && D.nights[k].asleepMin >= (s.sleepTargetH - 0.25) * 60).length;
  const comeback = D.habitLogs.some(l => (l.status === 'done' || l.status === 'min') && D.habitLogs.some(m => m.habitId === l.habitId && m.date === addDays(l.date, -1) && m.status === 'skip'));
  const ritualDays = new Set(D.habitLogs.filter(l => l.status === 'done' || l.status === 'min').map(l => l.date)).size;
  const L = (n, g) => ({ have: Math.min(n, g), goal: g });
  return [
    { t: 'Первый шаг', d: 'Отметить первый ритуал или задачу', ic: 'today', ...L(T.rituals + T.tasks, 1) },
    { t: 'Семь огней', d: '7 дней с хотя бы одним ритуалом', ic: 'habits', ...L(ritualDays, 7) },
    { t: 'Возвращение', d: 'Вернуться к ритуалу на следующий день после пропуска', ic: 'refresh', ...L(comeback ? 1 : 0, 1) },
    { t: 'Час знаний', d: 'Первый час учёбы', ic: 'learn', ...L(T.studyMin, 60) },
    { t: 'Десять часов', d: '10 часов учёбы за всё время', ic: 'learn', ...L(T.studyMin, 600) },
    { t: 'Хранитель памяти', d: '100 повторений карточек', ic: 'learn', ...L(T.reviews, 100) },
    { t: 'Первый килограмм', d: 'Тренд веса ниже стартового на 1 кг', ic: 'health', ...L(Math.max(0, T.lost || 0), 1) },
    { t: 'Пять килограммов', d: 'Тренд ниже стартового на 5 кг', ic: 'health', ...L(Math.max(0, T.lost || 0), 5) },
    { t: 'Путник', d: '1 000 000 шагов', ic: 'rest', ...L(T.steps, 1e6) },
    { t: 'Закалка', d: '12 тренировок', ic: 'health', ...L(T.workouts, 12) },
    { t: 'Крепкий сон', d: '10 ночей из 14 близко к цели сна', ic: 'moon', ...L(goodNights, 10) },
    { t: 'Ночной дозор', d: 'Пережить дежурство по плану восстановления', ic: 'assistant', ...L(T.duties, 1) },
    { t: 'Право на привал', d: '10 записей полноценного отдыха', ic: 'rest', ...L(T.leisure, 10) },
    { t: 'Сто дел', d: '100 выполненных задач', ic: 'plan', ...L(T.tasks, 100) }
  ];
}

export function render(D) {
  const s = D.settings;
  const since = firstDay(D); const days = daysBetween(since, D.today) + 1;
  const A = attributes(D), T = totals(D), S = seals(D, T);
  const got = S.filter(x => x.have >= x.goal).length;
  const tr = D.trend.at(-1);
  return `<div class="profile-hero card">
    ${sigil('sigil-bg', false)}
    <div class="row" style="gap:22px;align-items:center;flex-wrap:wrap">
      <div class="ava-wrap" data-a="profile-edit" title="Изменить">${avatar(D, 108)}</div>
      <div style="flex:1;min-width:220px">
        <h1 style="margin:0">${esc(s.name || 'Путник')}</h1>
        <div class="ptitle">${esc(s.title || 'Хирург-ординатор')}</div>
        ${s.motto ? `<div class="motto">«${esc(s.motto)}»</div>` : ''}
        <div class="row wrap" style="gap:8px;margin-top:10px"><span class="chip acc">в пути ${days} ${days % 10 === 1 && days % 100 !== 11 ? 'день' : [2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100) ? 'дня' : 'дней'}</span><span class="chip">печатей ${got} из ${S.length}</span>${tr ? `<span class="chip">${num(tr.trend, 1)} кг${s.goalWeightKg ? ` → ${num(s.goalWeightKg, 1)}` : ''}</span>` : ''}</div>
      </div>
      <button class="btn" data-a="profile-edit">${icon('edit')}Изменить</button>
    </div>
  </div>

  <div class="grid" style="margin-top:14px">
    ${s.anketaDone ? '' : anketa(D)}
    <div class="card c6"><div class="card-h"><h2>Характеристики</h2><span class="sp"></span><span class="tiny muted">последние 2-4 недели</span></div>
      <div class="col" style="gap:14px">${A.map(a => `<div class="attr"><div class="row"><span class="aic">${icon(a.ic)}</span><b class="display" style="font-size:19px">${a.key}</b><span class="sp"></span><span class="display" style="font-size:22px">${a.v == null ? '-' : a.v}</span></div>
        <div class="abar"><i style="width:${a.v || 0}%"></i></div><div class="tiny muted">${esc(a.hint)}</div></div>`).join('')}</div>
      <div class="tiny muted" style="margin-top:12px">Это состояние, а не оценка: показатели растут и падают вместе с жизнью, и это нормально.</div></div>

    <div class="card c6"><div class="card-h"><h2>Итоги пути</h2></div>
      <div class="totals">
        ${[['Часы знаний', num(T.studyMin / 60, 1)], ['Ритуалов', int(T.rituals)], ['Дел завершено', int(T.tasks)], ['Тренировок', int(T.workouts)], ['Шагов', T.steps ? int(T.steps) : '-'], ['Повторений', int(T.reviews)], ['Ночей в летописи', int(T.nights)], ['Сброшено, кг', T.lost != null ? num(Math.max(0, T.lost), 1) : '-']].map(([l, v]) => `<div class="tot"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}
      </div></div>

    <div class="card c12"><div class="card-h"><h2>Печати</h2><span class="sp"></span><span class="tiny muted">не теряются никогда</span></div>
      <div class="seals">${S.map(x => { const ok = x.have >= x.goal; return `<div class="seal ${ok ? 'ok' : ''}" title="${esc(x.d)}"><div class="medal" style="${ok ? 'background-image:url(art/medal.webp)' : ''}">${icon(x.ic)}</div><div class="st">${esc(x.t)}</div><div class="sd">${esc(x.d)}</div>${ok ? '' : `<div class="abar sm"><i style="width:${Math.round(x.have / x.goal * 100)}%"></i></div>`}</div>`; }).join('')}</div></div>

    ${s.anketaDone ? `<details class="card c12 fold" style="padding:14px 18px"><summary style="font-family:var(--display);font-size:20px;color:var(--text)">Анкета заполнена: изменить данные</summary>${anketa(D).replace('class="card c12 anketa', 'class="anketa').replace(/<div class="card-h">.*?<\/div>/, '')}</details>` : ''}
    <div class="card c12"><div class="card-h"><h2>Как система подстроена под тебя</h2><span class="sp"></span><span class="tiny muted">это не диагнозы, а механизмы</span></div>
      <div class="behav">${BEHAVIOR.map(b => `<div class="bh"><span class="chip ${b.status === 'наблюдение' ? 'acc' : ''}">${b.status}</span><div class="display" style="font-size:19px;margin:6px 0 2px">${esc(b.title)}</div><div class="small muted">${esc(b.text)}</div><div class="small" style="margin-top:6px"><b>Что делает система:</b> ${esc(b.mechanism)}</div></div>`).join('')}</div></div>
    <div class="card c12"><div class="card-h"><h2>Аккаунт и данные</h2></div>
      <div class="row wrap"><button class="btn" data-a="go-settings" data-v="profile">${icon('health')}Тело и цели</button><button class="btn" data-a="go-settings" data-v="day">${icon('today')}Режим дня</button><button class="btn" data-a="go-settings" data-v="sync">${icon('refresh')}Синхронизация</button><button class="btn" data-a="go-settings" data-v="apple">${icon('health')}Apple Health и часы</button><button class="btn" data-a="go-settings" data-v="data">${icon('download')}Резервная копия</button><button class="btn" data-a="theme-toggle">${icon(s.theme === 'light' ? 'moon' : 'sun')}${s.theme === 'light' ? 'Ночная тема' : 'Тема «Пергамент»'}</button></div></div>
  </div>`;
}

function editForm(D) {
  const s = D.settings;
  return `<form data-f="profile" class="col">
    <div class="row" style="gap:16px">${avatar(D, 72)}<div class="col" style="gap:6px"><label class="btn sm">${icon('upload')}Загрузить портрет<input type="file" accept="image/*" id="ava-file" hidden></label>${s.avatar ? '<button type="button" class="btn ghost sm" data-a="ava-clear">Убрать портрет</button>' : ''}</div></div>
    <label class="f">Имя<input type="text" name="name" value="${esc(s.name || '')}" placeholder="Как тебя называть"></label>
    <label class="f">Звание<input type="text" name="title" value="${esc(s.title || '')}" placeholder="Хирург-ординатор"></label>
    <label class="f">Девиз<input type="text" name="motto" value="${esc(s.motto || '')}" placeholder="Например: тише едешь, дальше будешь"></label>
    <div class="dlg-f"><button class="btn pri">Сохранить</button></div></form>`;
}

async function resize(file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const k = Math.max(S / img.width, S / img.height), w = img.width * k, h = img.height * k;
  c.getContext('2d').drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
  return c.toDataURL('image/jpeg', 0.82);
}

on({
  'profile-edit': () => modal('Профиль', editForm(window.__D)),
  'ava-clear': () => { saveSettings({ avatar: null }); close(); toast('Портрет убран'); },
  'go-settings': async (ds) => { const m = await import('./settings.js'); m.openTab(ds.v); window.__go('settings'); },
  'theme-toggle': () => { const t = window.__D.settings.theme === 'light' ? 'dark' : 'light'; saveSettings({ theme: t }); }
});
onForm({ 'anketa': async (o) => {
  const num = ['age', 'heightCm', 'startWeightKg', 'goalWeightKg', 'commuteMin', 'dutiesPerMonth', 'studyWeeklyMin', 'usmleStep', 'workoutsPerWeek', 'finIncome', 'finFixed', 'finReserve'];
  const { sbUrl, sbKey, sbEmail, sbPassword, ...rest } = o;
  const out = {};
  for (const [k, v] of Object.entries(rest)) out[k] = num.includes(k) ? (v === '' || v == null ? null : Number(v)) : v;
  for (const k of ['studyWeeklyMin', 'workoutsPerWeek', 'usmleStep']) if (out[k] == null) delete out[k];
  if (out.healthLimits === '') delete out.healthLimits;
  if (out.goalDate === '') out.goalDate = null;
  const D = window.__D;
  const merged = { ...(store.get('settings') || {}), ...out };
  out.anketaDone = anketaProgress(merged).done === anketaProgress(merged).total;
  saveSettings(out);
  if (out.startWeightKg && !store.get('wt_' + D.today)) store.put('weight', { id: 'wt_' + D.today, date: D.today, kg: out.startWeightKg, ts: Date.now() });
  seedGoals({ ...merged, ...out });
  let syncMsg = '';
  if (sbUrl && sbKey) {
    try {
      await sync.setConfig(sbUrl, sbKey);
      if (sbEmail && sbPassword) {
        try { await sync.signIn(sbEmail, sbPassword); syncMsg = ' Синхронизация подключена.'; }
        catch { const r = await sync.signUp(sbEmail, sbPassword); syncMsg = r.signedIn ? ' Аккаунт создан, синхронизация подключена.' : ' Подтверди email из письма Supabase, затем сохрани анкету ещё раз.'; if (r.signedIn) sync.syncNow(); }
      }
    } catch (e) { syncMsg = ' Синхронизация: ' + e.message; }
  }
  toast(out.anketaDone ? 'Анкета сохранена. Калории, меню, тренировки и стратегия пересчитаны.' + syncMsg : `Сохранено. Осталось обязательных полей: ${anketaProgress(merged).missing.length}.` + syncMsg);
  window.scrollTo(0, 0);
}, 'profile': (o) => { saveSettings({ name: o.name, title: o.title, motto: o.motto }); close(); toast('Профиль сохранён'); } });
document.addEventListener('change', async e => {
  if (e.target.id !== 'ava-file' || !e.target.files[0]) return;
  try { const url = await resize(e.target.files[0]); saveSettings({ avatar: url }); close(); toast('Портрет обновлён'); }
  catch { toast('Не удалось прочитать изображение'); }
});
