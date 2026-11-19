// Настройки: профиль, режим дня, цели, синхронизация, Apple Health / Watch, данные, оформление.
import * as store from '../store.js';
import * as sync from '../sync.js';
import { DEFAULT_SETTINGS } from '../engine.js';
import { esc, dkey, fmtDate, addDays, rangeKeys, int, num, dur } from '../util.js';
import { icon, on, onForm, modal, close, toast, opts, confirmBox } from '../ui.js';
import { saveSettings } from '../data.js';

export const title = 'Настройки';
let tab = 'profile', lastToken = null;
export function openTab(t) { tab = t; }

export function render(D) {
  return `<div class="top"><h1>Настройки</h1></div>
  <div class="tabs">${[['profile', 'Профиль и цели'], ['day', 'Режим дня'], ['learn', 'Обучение'], ['sync', 'Синхронизация'], ['apple', 'Apple Health и Watch'], ['data', 'Данные'], ['look', 'Оформление']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-a="s-tab" data-v="${k}">${l}</button>`).join('')}</div>
  ${({ profile, day, learn, sync: syncTab, apple, data, look })[tab](D)}`;
}

const f = (name, label, value, type = 'number', extra = '') => `<label class="f">${label}<input type="${type}" name="${name}" value="${esc(value ?? '')}" ${type === 'number' ? 'step="any"' : ''} ${extra}></label>`;

function profile(D) {
  const s = D.settings;
  return `<form data-f="settings" class="grid">
    <div class="card c6"><div class="card-h"><h2>Тело</h2></div><div class="fg">
      ${f('name', 'Имя', s.name, 'text')}
      <label class="f">Пол<select name="sex">${opts([['m', 'Мужской'], ['f', 'Женский']], s.sex)}</select></label>
      ${f('age', 'Возраст', s.age)}${f('heightCm', 'Рост, см', s.heightCm)}${f('goalWeightKg', 'Целевой вес, кг', s.goalWeightKg)}<label class="f">Срок цели<input type="date" name="goalDate" value="${esc(s.goalDate || '')}"></label>
      <label class="f">Темп, % веса/нед<select name="goalRatePct">${opts([[0.25, '0,25 (очень мягко)'], [0.5, '0,5 (мягко)'], [0.6, '0,6 (рекомендуется)'], [0.75, '0,75'], [1, '1,0 (максимум)']], s.goalRatePct)}</select></label>
      <label class="f">Активность вне тренировок<select name="activityFactor">${opts([[1.3, 'Сидячая'], [1.45, 'На ногах часть дня (операционная, обходы)'], [1.6, 'Много на ногах']], s.activityFactor)}</select></label>
    </div><div class="tiny muted" style="margin-top:8px">Темп больше 1% в неделю приложение не предлагает: при нём теряется мышечная масса и падает работоспособность.</div></div>
    <div class="card c6"><div class="card-h"><h2>Цели активности</h2></div><div class="fg">
      ${f('workoutsPerWeek', 'Тренировок в неделю', s.workoutsPerWeek, 'number', 'min="0" max="7"')}${f('workoutMin', 'Длительность, мин', s.workoutMin)}
      ${f('stepsTarget', 'Шаги в день', s.stepsTarget)}${f('waterTargetMl', 'Вода, мл', s.waterTargetMl)}${f('sleepTargetH', 'Сон, часов', s.sleepTargetH)}${f('leisureMinDaily', 'Отдых в будни, мин (минимум)', s.leisureMinDaily)}
    </div></div>
    <div class="c12 row"><span class="sp"></span><button class="btn pri">Сохранить</button></div></form>`;
}

function day(D) {
  const s = D.settings;
  return `<form data-f="settings" class="grid"><div class="card c8"><div class="card-h"><h2>Будний день</h2></div><div class="fg">
    ${f('wake', 'Подъём', s.wake, 'time')}${f('workStart', 'Начало работы', s.workStart, 'time')}${f('workEnd', 'Конец работы', s.workEnd, 'time')}${f('commuteMin', 'Дорога в одну сторону, мин', s.commuteMin)}
    ${f('bedtime', 'Отбой', s.bedtime, 'time')}${f('decompressMin', 'Переключение после работы, мин', s.decompressMin)}${f('dinnerMin', 'Ужин, мин', s.dinnerMin)}${f('choresMin', 'Быт вечером, мин', s.choresMin)}${f('windDownMin', 'Подготовка ко сну, мин', s.windDownMin)}${f('focusSpanMin', 'Длительность концентрации, мин', s.focusSpanMin)}
  </div><div class="row wrap" style="margin-top:12px;gap:16px"><label class="toggle"><input type="checkbox" name="weekendsOff" ${s.weekendsOff ? 'checked' : ''}> Сб и Вс выходные по умолчанию</label><label class="toggle"><input type="checkbox" name="restWeekend" ${s.restWeekend ? 'checked' : ''}> Выходные без обязательной продуктивности</label></div></div>
  <div class="card c4"><div class="card-h"><h2>Как считается вечер</h2></div><div class="small col" style="gap:6px;color:var(--text-2)">
    <div>После ${s.workEnd} + дорога ${s.commuteMin} мин остаётся окно до отбоя ${s.bedtime}.</div><div>Из него вычитаются переключение, ужин, быт и подготовка ко сну.</div>
    <div>Остаток делится между движением, одним фокус-блоком и отдыхом. Если времени мало, сначала убирается учёба, а не отдых.</div>
    <div>Длительность концентрации задаёт размер учебных блоков. Начни с 25-35 минут и увеличивай, когда сессии стабильно получаются.</div></div></div>
  <div class="c12 row"><span class="sp"></span><button class="btn pri">Сохранить</button></div></form>`;
}

function learn(D) {
  const s = D.settings;
  return `<form data-f="settings-learn" class="grid"><div class="card c8"><div class="card-h"><h2>Направления и доли</h2></div>
    <div class="col">${s.tracks.map((t, i) => `<div class="row"><input type="hidden" name="tid${i}" value="${esc(t.id)}"><span class="dot" style="background:${t.color};width:10px;height:10px"></span><input type="text" name="tname${i}" value="${esc(t.name)}"><input type="number" name="tshare${i}" value="${t.share}" style="width:90px"><span class="small muted">%</span></div>`).join('')}</div>
    <div class="fg" style="margin-top:12px">${f('studyWeeklyMin', 'Учёба в неделю, мин', s.studyWeeklyMin)}${f('newCardsPerDay', 'Новых карточек в день', s.newCardsPerDay)}</div>
    <div class="tiny muted" style="margin-top:8px">Реалистично при работе 07-18: 4-6 часов в неделю. Лучше 5 часов каждую неделю, чем 12 часов в первую и ноль потом.</div></div>
    <div class="c12 row"><span class="sp"></span><button class="btn pri">Сохранить</button></div></form>`;
}

function syncTab(D) {
  const c = sync.config(), ses = sync.session(), st = sync.getState(), loc = store.stats();
  return `<div class="grid"><div class="card c7"><div class="card-h"><h2>Supabase</h2><span class="sp"></span>${ses ? '<span class="chip good">подключено</span>' : c ? '<span class="chip warn">нужен вход</span>' : '<span class="chip">не настроено</span>'}</div>
    ${!c || tab === 'sync-edit' ? `<form data-f="sb-config" class="col"><div class="small muted">Supabase Dashboard → Project Settings → API (или Data API): адрес проекта и anon / publishable key.</div>
      <input type="url" name="url" placeholder="https://xxxx.supabase.co" value="${esc(c?.url || '')}" required><input type="text" name="key" placeholder="anon public key" value="${esc(c?.anonKey || '')}" required>
      <div class="dlg-f"><button class="btn pri">Сохранить</button></div></form>`
    : !ses ? `<form data-f="sb-auth" class="col"><div class="small">Проект: <code>${esc(c.url)}</code> <a data-a="sb-reset" style="cursor:pointer">изменить</a></div>
      <input type="email" name="email" placeholder="Email" autocomplete="username" required><input type="password" name="password" placeholder="Пароль (от 8 символов)" autocomplete="current-password" required minlength="8">
      <div class="dlg-f"><button type="button" class="btn" data-a="sb-signup">Создать аккаунт</button><button class="btn pri">Войти</button></div></form>`
    : `<div class="col small"><div class="row"><span>Аккаунт</span><span class="sp"></span><b>${esc(ses.user?.email || '')}</b></div><div class="row"><span>Проект</span><span class="sp"></span><code class="tiny">${esc(c.url)}</code></div>
      <div class="row"><span>Статус</span><span class="sp"></span><b>${{ ok: 'синхронизировано', syncing: 'синхронизация…', error: 'ошибка', offline: 'нет сети', idle: 'ожидание' }[st.status]}</b></div>
      ${st.error ? `<div class="note warn">${esc(st.error)}</div>` : ''}
      <div class="row"><span>Последняя синхронизация</span><span class="sp"></span><b>${st.lastSync ? new Date(st.lastSync).toLocaleString('ru-RU') : '-'}</b></div>
      <div class="row"><span>Записей на устройстве</span><span class="sp"></span><b>${loc.items} · Health: ${loc.health} · не отправлено: ${loc.dirty}</b></div>
      <div class="row" style="margin-top:8px"><button class="btn pri" data-a="sync-now">${icon('refresh')}Синхронизировать</button><button class="btn" data-a="sync-full">Полная перезагрузка с сервера</button><span class="sp"></span><button class="btn ghost" data-a="sb-signout">Выйти</button></div></div>`}
  </div>
  <div class="card c5"><div class="card-h"><h2>Как это устроено</h2></div><div class="small col" style="gap:6px;color:var(--text-2)">
    <div>Все данные сначала сохраняются на устройстве (IndexedDB) и работают без интернета.</div>
    <div>При появлении сети изменения отправляются в твою базу Supabase, а изменения с других устройств забираются оттуда. Проверка каждые 60 секунд, при открытии приложения и после каждого изменения.</div>
    <div>Конфликты: побеждает более позднее изменение записи.</div>
    <div>Доступ к данным защищён Row Level Security: каждая строка доступна только владельцу аккаунта.</div>
    <div>Без Supabase приложение тоже работает, но только на одном устройстве.</div></div></div></div>`;
}

function apple(D) {
  const c = sync.config(), ses = sync.session();
  const types = {}; for (const smp of D.samples) { const t = types[smp.type] || (types[smp.type] = { n: 0, last: '' }); t.n++; if (smp.end_at > t.last) t.last = smp.end_at; }
  const url = c ? `${c.url}/rest/v1/rpc/ingest_health` : 'https://xxxx.supabase.co/rest/v1/rpc/ingest_health';
  const qurl = c ? `${c.url}/rest/v1/rpc/quick_log` : 'https://xxxx.supabase.co/rest/v1/rpc/quick_log';
  const TYPES = [['steps', 'Шаги', 'День'], ['distance', 'Расстояние ходьбы и бега', 'День'], ['active_energy', 'Активная энергия', 'День'], ['basal_energy', 'Энергия покоя', 'День'], ['exercise_min', 'Время упражнений', 'День'], ['stand_min', 'Время стоя', 'День'], ['resting_hr', 'Пульс в покое', 'нет'], ['hrv', 'Вариабельность пульса', 'нет'], ['heart_rate', 'Пульс', 'Час'], ['resp_rate', 'Частота дыхания', 'нет'], ['spo2', 'Насыщение кислородом', 'нет'], ['wrist_temp', 'Температура запястья во сне', 'нет'], ['weight', 'Вес', 'нет'], ['body_fat', 'Процент жира', 'нет'], ['bp_sys', 'Систолическое давление', 'нет'], ['bp_dia', 'Диастолическое давление', 'нет'], ['sleep', 'Анализ сна', 'нет']];
  return `<div class="grid">
    <div class="card c12"><div class="note acc">Веб-приложение не имеет доступа к HealthKit. Мостом служит официальное приложение Apple «Команды» (Shortcuts): оно читает Apple Health на iPhone по твоему разрешению и отправляет данные в базу. Без Mac и платной подписки разработчика это единственный штатный способ. Нативное приложение на Swift можно добавить позже, схема базы для него уже подходит.</div></div>
    <div class="card c6"><div class="card-h"><h2>1. Ключ для быстрых команд</h2></div>
      ${!ses ? '<div class="small muted">Сначала подключи синхронизацию (вкладка «Синхронизация»).</div>' : `<div class="small">Ключ связывает команды iPhone и часов с твоим аккаунтом. Он показывается один раз; новый ключ отключает старый.</div>
      ${lastToken ? `<div class="note good" style="margin-top:8px;word-break:break-all"><b>Ключ:</b> <code>${esc(lastToken)}</code> <button class="btn sm" data-a="copy" data-v="${esc(lastToken)}">Копировать</button></div>` : ''}
      <button class="btn pri" style="margin-top:10px" data-a="make-token">${lastToken ? 'Создать новый ключ' : 'Создать ключ'}</button>`}
      <hr><div class="small col" style="gap:4px"><div><b>Адрес для данных здоровья:</b></div><code class="tiny" style="word-break:break-all">${esc(url)}</code><button class="btn sm" style="align-self:flex-start" data-a="copy" data-v="${esc(url)}">Копировать</button>
      <div style="margin-top:6px"><b>Адрес быстрого ввода (часы):</b></div><code class="tiny" style="word-break:break-all">${esc(qurl)}</code><button class="btn sm" style="align-self:flex-start" data-a="copy" data-v="${esc(qurl)}">Копировать</button>
      <div style="margin-top:6px"><b>Заголовок apikey:</b> anon key из настроек Supabase ${c ? `<button class="btn sm" data-a="copy" data-v="${esc(c.anonKey)}">Копировать</button>` : ''}</div></div></div>
    <div class="card c6"><div class="card-h"><h2>Что уже пришло</h2></div>${Object.keys(types).length ? `<table class="t"><tr><th>Тип</th><th class="tr">Записей</th><th class="tr">Последнее</th></tr>${Object.entries(types).sort().map(([t, v]) => `<tr><td>${esc((TYPES.find(x => x[0] === t) || [, t])[1])}</td><td class="tr">${int(v.n)}</td><td class="tr small">${new Date(v.last).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td></tr>`).join('')}</table>` : '<div class="empty">Данных Apple Health пока нет</div>'}</div>
    <div class="card c12"><div class="card-h"><h2>2. Быстрая команда «Life OS Health» на iPhone</h2></div><div class="small col" style="gap:8px;color:var(--text-2)">
      <div>Создай в приложении «Команды» новую команду и для каждого нужного показателя добавь один блок из 4 действий (блок можно дублировать и менять только тип):</div>
      <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px">
        <li><b>Найти образцы здоровья</b>: Тип = показатель из таблицы ниже; фильтр «Дата начала» за последние <b>3 дня</b> (для первого запуска поставь 90 дней, потом верни 3); «Группировать по» как в таблице; без ограничения количества.</li>
        <li><b>Повторить с каждым</b> (для результата поиска). Внутри: действие <b>Текст</b> с содержимым <code>Значение|Дата начала|Дата окончания</code>, где каждое слово это переменная «Объект повтора» с выбранным свойством. Для обеих дат в настройках переменной выбери формат <b>ISO 8601</b> и включи время.</li>
        <li>После «Конец повтора»: <b>Объединить текст</b> (Результаты повтора), разделитель «Пользовательский»: <code>;</code></li>
        <li><b>Получить содержимое URL</b>: адрес для данных здоровья (выше), метод POST, заголовки <code>apikey</code> = anon key и <code>Content-Type</code> = <code>application/json</code>; тело запроса JSON: <code>p_token</code> = ключ, <code>p_type</code> = код из таблицы, <code>p_rows</code> = Объединённый текст.</li>
      </ol>
      <div style="overflow-x:auto"><table class="t"><tr><th>Тип в «Командах»</th><th>p_type</th><th>Группировать по</th></tr>${TYPES.map(([code, name, g]) => `<tr><td>${name}</td><td><code>${code}</code></td><td>${g}</td></tr>`).join('')}</table></div>
      <div>Для «Анализа сна» свойство «Значение» содержит стадию (основной, глубокий, REM, бодрствование): приложение распознаёт и русские, и английские названия. Если в списке типов твоей iOS есть «Тренировки», добавь блок с <code>p_type</code> = <code>workout</code> и свойством «Тип» или «Название» вместо «Значения».</div>
      <div><b>Автоматизация:</b> «Команды» → «Автоматизация» → «Новая» → «Время суток»: например 07:05, 13:00, 18:45 и 22:00 ежедневно, режим «Запускать сразу», уведомление можно выключить. Дополнительно удобно «При открытии приложения» для приложения, которое открываешь каждое утро. Повторная отправка безопасна: дубликаты отбрасываются на сервере.</div>
      <div class="note warn">Ограничение Apple: данные Health зашифрованы, пока iPhone заблокирован, поэтому команда, запущенная на заблокированном телефоне, может получить пустой результат. Выбирай время, когда телефон обычно в руках, и держи 3-дневное окно: пропущенный запуск догонит следующий.</div>
    </div></div>
    <div class="card c12"><div class="card-h"><h2>3. Быстрые команды для Apple Watch и Siri</h2></div><div class="small col" style="gap:8px;color:var(--text-2)">
      <div>Команды с включённым «Показывать на Apple Watch» запускаются прямо с часов (приложение «Команды» или усложнение циферблата) и через Siri голосом, без iPhone в руках (часам нужен Wi-Fi/LTE или iPhone рядом).</div>
      <table class="t"><tr><th>Команда</th><th>Действия</th><th>p_kind</th></tr>
        <tr><td>Life OS Вода</td><td>Выбрать из меню (250 / 330 / 500) → Получить содержимое URL</td><td><code>water</code>, p_value = мл</td></tr>
        <tr><td>Life OS Привычка</td><td>Список (названия привычек) → Выбрать из списка → URL</td><td><code>habit</code>, p_value = название</td></tr>
        <tr><td>Life OS Вес</td><td>Запросить ввод (число) → URL</td><td><code>weight</code></td></tr>
        <tr><td>Life OS Самочувствие</td><td>Выбрать из меню 1-5 → URL</td><td><code>energy</code></td></tr>
        <tr><td>Life OS Заметка</td><td>Диктовать текст → URL</td><td><code>note</code></td></tr></table>
      <div>Во всех командах: адрес быстрого ввода, POST, те же заголовки, тело JSON: <code>p_token</code>, <code>p_kind</code>, <code>p_value</code>. Таймеры учёбы и тренировок на часах: штатные «Таймер» и «Тренировка»; тренировка с часов сама попадёт в Apple Health и затем в приложение.</div>
      <div>Напоминания о движении и отбое: часы делают это штатно (Активность → «Напоминание встать»). Расписание отбоя можно добавить календарём ниже, его уведомления придут и на часы.</div>
      <button class="btn" style="align-self:flex-start" data-a="reminders-ics">${icon('download')}Календарь напоминаний (.ics)</button></div></div>
  </div>`;
}

function data(D) {
  const loc = store.stats();
  return `<div class="grid"><div class="card c6"><div class="card-h"><h2>Резервная копия</h2></div><div class="small muted">Полный экспорт всех записей и данных Health в JSON. Храни копию в iCloud Drive / OneDrive. Если синхронизация включена, копия также лежит в Supabase.</div>
    <div class="row wrap" style="margin-top:12px"><button class="btn pri" data-a="export-json">${icon('download')}Скачать JSON</button><button class="btn" data-a="export-csv">${icon('download')}Сводка по дням (CSV)</button></div>
    <hr><div class="small muted">Восстановление из файла: записи объединяются с текущими (более новые побеждают).</div>
    <div class="row wrap" style="margin-top:8px"><label class="btn">${icon('upload')}Импорт JSON<input type="file" accept="application/json,.json" id="imp-file" hidden></label><label class="toggle"><input type="checkbox" id="imp-replace"> заменить всё</label></div>
    ${store.getMeta('lastBackup') ? `<div class="tiny muted" style="margin-top:8px">Последний экспорт: ${new Date(store.getMeta('lastBackup')).toLocaleString('ru-RU')}</div>` : ''}</div>
  <div class="card c6"><div class="card-h"><h2>Устройство</h2></div><div class="small col"><div class="row"><span>Записей</span><span class="sp"></span><b>${loc.items}</b></div><div class="row"><span>Измерений Health</span><span class="sp"></span><b>${loc.health}</b></div><div class="row"><span>Хранилище</span><span class="sp"></span><b>${loc.memoryOnly ? 'только память (приватный режим?)' : 'IndexedDB'}</b></div></div>
    <hr><button class="btn danger" data-a="wipe">Стереть данные на этом устройстве</button><div class="tiny muted" style="margin-top:6px">Данные в Supabase не удаляются, их можно загрузить заново после входа.</div>
    <hr><button class="btn" data-a="demo">Заполнить демо-данными (для знакомства)</button></div></div>`;
}

function look(D) {
  const s = D.settings;
  return `<div class="grid"><div class="card c6"><div class="card-h"><h2>Тема</h2></div><div class="row wrap">${[['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([v, l]) => `<button class="btn ${s.theme === v ? 'pri' : ''}" data-a="theme" data-v="${v}">${l}</button>`).join('')}</div></div>
  <div class="card c6"><div class="card-h"><h2>Модель ассистента</h2></div><form data-f="settings" class="row"><input type="text" name="aiModel" value="${esc(s.aiModel)}"><button class="btn">Сохранить</button></form><div class="tiny muted" style="margin-top:6px">Ключ API вводится на экране «Ассистент» и хранится только на этом устройстве. ${store.getMeta('aiKey') ? '<a data-a="ai-forget" style="cursor:pointer">Удалить ключ</a>' : ''}</div></div>
  <div class="card c12"><div class="card-h"><h2>Горячие клавиши (Windows)</h2></div><div class="small muted">Ctrl+K: быстрый ввод · 1-8: разделы · пробел и 1-4: повторение карточек</div></div></div>`;
}

// ---------- действия ----------
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); }

on({
  's-tab': (ds) => { tab = ds.v; window.__rerender(); },
  'sb-reset': () => { tab = 'sync-edit'; window.__rerender(); tab = 'sync'; },
  'sb-signup': async (ds, el) => {
    const form = el.closest('form'); const email = form.email.value.trim(), pw = form.password.value;
    if (!email || pw.length < 8) return toast('Email и пароль от 8 символов');
    try { const r = await sync.signUp(email, pw); if (r.signedIn) { toast('Аккаунт создан'); await sync.syncNow(); } else toast('Проверь почту и подтверди адрес, затем войди'); window.__rerender(); }
    catch (e) { toast('Ошибка: ' + e.message); }
  },
  'sb-signout': async () => { await sync.signOut(); window.__rerender(); },
  'sync-now': () => sync.syncNow(),
  'sync-full': async () => { await store.setMeta('cursorItems', null); await store.setMeta('cursorHealth', null); await sync.syncNow(); toast('Данные загружены заново'); },
  'make-token': async () => {
    if (lastToken && !(await confirmBox('Новый ключ отключит старый: нужно будет обновить его во всех быстрых командах.', 'Создать'))) return;
    try { lastToken = await sync.createIngestToken(); window.__rerender(); } catch (e) { toast('Ошибка: ' + e.message); }
  },
  'copy': (ds) => navigator.clipboard.writeText(ds.v).then(() => toast('Скопировано')).catch(() => modal('Скопируй вручную', `<input type="text" value="${esc(ds.v)}" onfocus="this.select()">`)),
  'reminders-ics': () => {
    const D = window.__D, s = D.settings; const pad = n => String(n).padStart(2, '0');
    const t = (hhmm, delta = 0) => { let [h, m] = hhmm.split(':').map(Number); let x = h * 60 + m + delta; x = (x + 1440) % 1440; return `${pad(Math.floor(x / 60))}${pad(x % 60)}00`; };
    const d0 = D.today.replace(/-/g, '');
    const ev = (uid, title, time, rrule, mins = 10) => ['BEGIN:VEVENT', `UID:${uid}@lifeos`, `DTSTAMP:${d0}T000000Z`, `DTSTART:${d0}T${time}`, `DURATION:PT${mins}M`, `RRULE:${rrule}`, `SUMMARY:${title}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'].join('\r\n');
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Life OS//RU',
      ev('winddown', 'Подготовка ко сну: экран в сторону', t(s.bedtime, -s.windDownMin), 'FREQ=DAILY', s.windDownMin),
      ev('weigh', 'Взвешивание (до завтрака)', t(s.wake, 10), 'FREQ=WEEKLY;BYDAY=MO,WE,FR', 5),
      ev('review', 'Life OS: план на неделю (10 минут)', '190000', 'FREQ=WEEKLY;BYDAY=SU', 15),
      ev('measure', 'Замер окружностей', t(s.wake, 15), 'FREQ=WEEKLY;INTERVAL=2;BYDAY=SA', 5),
      'END:VCALENDAR'].join('\r\n');
    download('lifeos-reminders.ics', ics, 'text/calendar');
    toast('Открой файл на iPhone: события с напоминаниями добавятся в Календарь и придут на часы');
  },
  'export-json': () => { download(`lifeos-backup-${dkey()}.json`, JSON.stringify(store.exportAll()), 'application/json'); store.setMeta('lastBackup', Date.now()); },
  'export-csv': () => {
    const D = window.__D; const keys = rangeKeys(D.today, 365).filter(k => D.nights[k] || D.daily[k] || D.foodByDay[k] || D.studyByDay[k]);
    const rows = [['date', 'sleep_h', 'steps', 'active_kcal', 'resting_hr', 'hrv', 'weight', 'weight_trend', 'kcal', 'protein', 'study_min', 'workout', 'plan_pct']];
    const tr = Object.fromEntries(D.trend.map(x => [x.date, x]));
    for (const k of keys) rows.push([k, D.nights[k] ? (D.nights[k].asleepMin / 60).toFixed(2) : '', D.daily[k]?.steps ?? '', D.daily[k]?.active_energy?.toFixed(0) ?? '', D.daily[k]?.resting_hr?.toFixed(0) ?? '', D.daily[k]?.hrv?.toFixed(0) ?? '', tr[k]?.kg ?? '', tr[k]?.trend?.toFixed(2) ?? '', D.foodByDay[k]?.kcal ?? '', D.foodByDay[k]?.p?.toFixed(0) ?? '', D.studyByDay[k] || '', D.workoutsByDay[k] ? 1 : 0, D.completionByDay[k] != null ? Math.round(D.completionByDay[k] * 100) : '']);
    download(`lifeos-daily-${dkey()}.csv`, '﻿' + rows.map(r => r.join(';')).join('\n'), 'text/csv');
  },
  'wipe': async () => { if (await confirmBox('Стереть все данные на этом устройстве?')) { await store.wipeLocal(); location.reload(); } },
  'theme': (ds) => saveSettings({ theme: ds.v }),
  'ai-forget': async () => { await store.setMeta('aiKey', null); window.__rerender(); },
  'demo': async () => { if (await confirmBox('Добавить демо-данные за 6 недель? Их можно удалить, стерев данные устройства.', 'Добавить')) { const { seedDemo } = await import('../demo.js'); await seedDemo(); toast('Демо-данные добавлены'); window.__go('today'); } }
});
onForm({
  'settings': (o) => {
    const num = ['age', 'heightCm', 'goalWeightKg', 'goalRatePct', 'activityFactor', 'workoutsPerWeek', 'workoutMin', 'stepsTarget', 'waterTargetMl', 'sleepTargetH', 'leisureMinDaily', 'commuteMin', 'decompressMin', 'dinnerMin', 'choresMin', 'windDownMin', 'focusSpanMin'];
    const out = {};
    for (const [k, v] of Object.entries(o)) out[k] = num.includes(k) ? (v === '' || v == null ? (k === 'goalWeightKg' ? null : DEFAULT_SETTINGS[k]) : Number(v)) : (k === 'goalDate' && !v ? null : v);
    saveSettings(out); toast('Сохранено, план пересчитан');
  },
  'settings-learn': (o) => {
    const tracks = window.__D.settings.tracks.map((t, i) => ({ ...t, name: o['tname' + i] || t.name, share: Number(o['tshare' + i]) || 0 }));
    saveSettings({ tracks, studyWeeklyMin: Number(o.studyWeeklyMin) || 300, newCardsPerDay: Number(o.newCardsPerDay) || 15 }); toast('Сохранено');
  },
  'sb-config': async (o) => { try { await sync.setConfig(o.url, o.key); tab = 'sync'; window.__rerender(); } catch (e) { toast(e.message); } },
  'sb-auth': async (o) => { try { await sync.signIn(o.email, o.password); toast('Вход выполнен, синхронизация…'); window.__rerender(); } catch (e) { toast('Ошибка входа: ' + e.message); } }
});
document.addEventListener('change', async e => {
  if (e.target.id !== 'imp-file' || !e.target.files[0]) return;
  try { const data = JSON.parse(await e.target.files[0].text()); const n = await store.importAll(data, { replace: document.getElementById('imp-replace')?.checked }); toast(`Импортировано записей: ${n}`); }
  catch (err) { toast('Не удалось импортировать: ' + err.message); }
});
