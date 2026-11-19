// Точка входа: каркас, маршрутизация, делегирование событий, таймер, тема, PWA.
import * as store from './store.js';
import * as sync from './sync.js';
import * as data from './data.js';
import { dkey, esc, hm, pad } from './util.js';
import { icon, sigil, hero, actions, forms, on, modal, close, toast, formData, modalOpen, modalEl } from './ui.js';
import { openQuickAdd, completeTopic, completeWorkout } from './views/comp.js';
import * as today from './views/today.js';
import * as plan from './views/plan.js';
import * as health from './views/health.js';
import * as learn from './views/learn.js';
import * as habits from './views/habits.js';
import * as rest from './views/rest.js';
import * as assistant from './views/assistant.js';
import * as analytics from './views/analytics.js';
import * as settings from './views/settings.js';
import * as profile from './views/profile.js';
import * as money from './views/money.js';
import { seedStart } from './seed.js';
import * as body from './views/body.js';
import * as mind from './views/mind.js';
import * as deeds from './views/deeds.js';
import * as me from './views/me.js';
import { studyForm } from './views/learn.js';

const ROUTES = { today, body, mind, deeds, me, plan, health, learn, habits, rest, assistant, analytics, settings, profile, money };
// второстепенные экраны: родитель в навигации, подпись «назад» и иллюстрация
const PARENT = { health: ['body', 'Тело', 'body'], learn: ['mind', 'Знания', 'mind'], plan: ['deeds', 'Дела', 'deeds'], habits: ['me', 'Я', 'habits'], rest: ['me', 'Я', 'rest'], money: ['me', 'Я', 'money'], assistant: ['me', 'Я', 'assistant'], analytics: ['me', 'Я', 'analytics'], settings: ['me', 'Я', 'settings'], profile: ['me', 'Я', 'me'] };
const NAV = [['today', 'Сегодня', 'today'], ['body', 'Тело', 'health'], ['mind', 'Знания', 'learn'], ['deeds', 'Дела', 'plan'], ['me', 'Я', 'assistant']];
const TABBAR = NAV;

let route = 'today', pending = false;
const $ = s => document.querySelector(s);

function shell() {
  document.body.innerHTML = `<div class="app">
    <nav class="side"><div class="brand">${sigil('brand-mark')}<span>Life OS</span></div>
      <a class="side-user" data-a="go" data-v="profile" data-nav="profile" id="side-user"></a>
      ${NAV.map(([k, l, ic], i) => `<a class="nav-a" data-a="go" data-v="${k}" data-nav="${k}">${icon(ic)}<span>${l}</span><span class="k">${i + 1}</span></a>`).join('')}
      <div class="side-foot"><button class="btn sm" data-a="quick">${icon('plus')}Быстрый ввод <span class="muted tiny">Ctrl K</span></button><span class="sync" data-a="go" data-v="settings" id="sync-ind"></span></div>
    </nav>
    <main class="main" id="main"></main>
    <nav class="tabbar">${TABBAR.map(([k, l, ic]) => `<a data-a="go" data-v="${k}" data-nav="${k}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
    <button class="fab" data-a="quick" aria-label="Быстрый ввод">${icon('plus')}</button>
  </div><div id="timer-host"></div><canvas id="embers"></canvas>
  <div id="splash" style="background:#07080d url(art/splash.webp) center/cover">${'<div>' + sigil('', false) + '<div class="w">LIFE OS</div></div>'}</div>`;
  setTimeout(() => document.getElementById('splash')?.classList.add('hide'), 1150);
  setTimeout(() => document.getElementById('splash')?.remove(), 1800);
  embers();
}

// ---------- плавающие искры на фоне (лёгкий canvas, выключается при reduce motion и в фоне) ----------
function embers() {
  const cv = document.getElementById('embers'); if (!cv || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = cv.getContext('2d'); let W, H, dpr = Math.min(2, devicePixelRatio || 1);
  const size = () => { W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; };
  size(); addEventListener('resize', size);
  const N = innerWidth < 641 ? 14 : 26;
  const P = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), r: .6 + Math.random() * 1.6, v: .00012 + Math.random() * .00035, ph: Math.random() * 6.28, a: .25 + Math.random() * .5 }));
  let last = 0;
  const loop = t => {
    requestAnimationFrame(loop);
    if (document.hidden || t - last < 33) return; last = t;
    const dark = document.documentElement.dataset.theme === 'dark';
    ctx.clearRect(0, 0, W, H);
    for (const p of P) {
      p.y -= p.v * 33; p.ph += .02; if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
      const x = (p.x + Math.sin(p.ph) * .01) * W, y = p.y * H, fl = p.a * (.6 + .4 * Math.sin(p.ph * 2));
      const g = ctx.createRadialGradient(x, y, 0, x, y, p.r * 6 * dpr);
      g.addColorStop(0, dark ? `rgba(244,214,150,${fl})` : `rgba(150,105,30,${fl * .5})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, p.r * 6 * dpr, 0, 6.29); ctx.fill();
    }
  };
  requestAnimationFrame(loop);
}

/** Вспышка искр от элемента (отметка ритуала, задачи, блока) */
export function burst(el) {
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('i'); s.className = 'spark';
    const a = Math.random() * 6.283, d = 30 + Math.random() * 50;
    s.style.left = cx - 3 + 'px'; s.style.top = cy - 3 + 'px';
    s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d - 20 + 'px');
    s.style.animationDelay = Math.random() * .08 + 's';
    document.body.appendChild(s); setTimeout(() => s.remove(), 1100);
  }
}
window.__burst = burst;

export function render(force = false) {
  const a = document.activeElement;
  const typing = a && a.closest && a.closest('#main') && a.matches('input[type=text], input[type=number], textarea, input[type=email], input[type=password], input[type=url], select');
  if (!force && (typing || modalOpen())) { pending = true; return; }
  pending = false;
  const D = data.build(dkey());
  window.__D = D;
  applyTheme(D.settings.theme);
  const view = ROUTES[route] || today;
  const main = $('#main');
  const y = window.scrollY;
  const par = PARENT[route];
  main.classList.toggle('secondary', !!par);
  try { main.innerHTML = (par ? hero(par[2], view.title, '', '', { small: true, back: [par[0], par[1]] }) : '') + view.render(D); }
  catch (e) { console.error(e); main.innerHTML = `<div class="card"><h2>Ошибка экрана</h2><pre class="small" style="white-space:pre-wrap">${esc(e.stack || e.message)}</pre></div>`; }
  window.scrollTo(0, y);
  const navKey = par ? par[0] : route;
  document.querySelectorAll('[data-nav]').forEach(n => n.classList.toggle('on', n.dataset.nav === navKey));
  document.title = `${view.title || 'Life OS'} · Life OS`;
  const su = document.getElementById('side-user'); if (su) su.innerHTML = `${profile.avatar(D, 34)}<span><b>${esc(D.settings.name || 'Путник')}</b><small>${esc(D.settings.title || 'Профиль')}</small></span>`;
  renderTimer();
}
window.__rerender = () => render(true);
window.__go = (r) => go(r);

function go(r) {
  if (!ROUTES[r]) r = 'today';
  route = r;
  if (location.hash !== '#' + r) history.replaceState(null, '', '#' + r);
  close(); window.scrollTo(0, 0); render(true);
  const m = $('#main'); m.classList.remove('enter'); void m.offsetWidth; m.classList.add('enter'); clearTimeout(go.t); go.t = setTimeout(() => m.classList.remove('enter'), 900);
}

function applyTheme(t) {
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#0c0a08' : '#f1e9da';
}

// ---------------- таймер фокуса / тренировки ----------------
let tick = null;
function renderTimer() {
  const t = store.getMeta('timer'); const host = $('#timer-host'); if (!host) return;
  clearInterval(tick);
  const ind = document.getElementById('timer-ind');
  if (!t) { host.innerHTML = ''; return; }
  const draw = () => {
    const el = (Date.now() - t.startedAt) / 1000, left = t.minutes * 60 - el;
    const txt = left > 0 ? `${pad(Math.floor(left / 60))}:${pad(Math.floor(left % 60))}` : `+${pad(Math.floor(-left / 60))}:${pad(Math.floor(-left % 60))}`;
    host.innerHTML = `<div style="position:fixed;top:calc(10px + var(--safe-t));right:14px;z-index:30"><span class="timer-pill" data-a="timer-open">${icon('timer')}${t.cat === 'study' ? 'Учёба' : 'Тренировка'} ${txt}</span></div>`;
    const big = document.getElementById('bigtimer'); if (big) big.textContent = txt;
    if (left <= 0 && !t.notified) {
      t.notified = true; store.setMeta('timer', t);
      navigator.vibrate?.([200, 100, 200]);
      if (window.Notification?.permission === 'granted') try { new Notification('Life OS', { body: t.cat === 'study' ? 'Сессия завершена. Сделай перерыв 5-10 минут.' : 'Время тренировки вышло' }); } catch { }
      toast(t.cat === 'study' ? 'Сессия завершена: отметь результат' : 'Таймер тренировки завершён');
    }
  };
  draw(); tick = setInterval(draw, 1000);
}
on({
  'timer-start': async (ds) => {
    if (store.getMeta('timer')) return openTimer();
    if (window.Notification && Notification.permission === 'default') Notification.requestPermission().catch(() => { });
    const blk = window.__D.plan.blocks.find(b => b.id === ds.block) || {};
    await store.setMeta('timer', { cat: ds.cat, minutes: Number(ds.min) || 30, track: ds.track || null, block: ds.block || null, topicId: ds.topic || blk.topicId || null, session: blk.session || null, startedAt: Date.now() });
    renderTimer(); openTimer();
  },
  'timer-open': () => openTimer(),
  'timer-stop': async (ds) => {
    const t = store.getMeta('timer'); if (!t) return close();
    const mins = Math.max(1, Math.round((Date.now() - t.startedAt) / 60000));
    await store.setMeta('timer', null); renderTimer(); close();
    if (ds.v === 'discard') return;
    const D = window.__D;
    if (t.block) { const id = 'ps_' + D.today; const st = store.get(id) || { done: {} }; store.put('planstate', { ...st, id, date: D.today, done: { ...(st.done || {}), [t.block]: Date.now() } }); }
    if (t.cat === 'study' && t.topicId) { completeTopic(t.topicId, mins, D.today); toast(`Тема пройдена за ${mins} мин: карточки добавлены в повторение`); }
    else if (t.cat === 'study') modal('Сессия завершена', studyForm(D, { minutes: mins, track: t.track }));
    else { completeWorkout(t.session, mins, D.today, t.block || 'timer_' + Date.now()); toast(`Тренировка ${mins} мин записана`); }
  }
});
function openTimer() {
  const t = store.getMeta('timer'); if (!t) return;
  modal(t.cat === 'study' ? 'Учебная сессия' : 'Тренировка', `<div class="bigtimer" id="bigtimer">--:--</div>
    <div class="small muted" style="text-align:center">${t.minutes} мин · начало ${hm(new Date(t.startedAt).getHours() * 60 + new Date(t.startedAt).getMinutes())}${t.cat === 'study' ? '<br>Телефон экраном вниз, одна задача, без переключений.' : ''}</div>`,
    { foot: `<button class="btn ghost" data-a="timer-stop" data-v="discard">Отменить</button><button class="btn" data-a="close-modal">Свернуть</button><button class="btn pri" data-a="timer-stop">Завершить и записать</button>` });
  renderTimer();
}

// ---------------- меню «Ещё» (мобильная версия) ----------------
on({
  'go': (ds) => go(ds.v),
  'more': () => modal('Разделы', `<div class="col">${[['profile', 'Профиль и анкета'], ['plan', 'Задания, стратегия, проекты'], ['money', 'Казна: деньги'], ['rest', 'Привал: отдых'], ['assistant', 'Наставник'], ['analytics', 'Летопись: аналитика'], ['settings', 'Настройки']].map(([k, l]) => `<button class="btn" style="justify-content:flex-start;height:44px" data-a="go" data-v="${k}">${icon(k)}${l}</button>`).join('')}</div>`)
});

// ---------------- делегирование событий ----------------
function bind() {
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]'); if (!el) return;
    const fn = actions[el.dataset.a]; if (!fn) return;
    if (['habit-tap', 'task-toggle', 'block-done'].includes(el.dataset.a) && !el.classList.contains('on') && !el.classList.contains('pri')) burst(el);
    if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
    try { const r = fn(el.dataset, el, e); if (r?.catch) r.catch(err => toast('Ошибка: ' + err.message)); } catch (err) { console.error(err); toast('Ошибка: ' + err.message); }
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('form[data-f]'); if (!f) return;
    e.preventDefault();
    const fn = forms[f.dataset.f]; if (!fn) return;
    try { const r = fn(formData(f), f); if (r?.catch) r.catch(err => toast('Ошибка: ' + err.message)); } catch (err) { console.error(err); toast('Ошибка: ' + err.message); }
  });
  document.addEventListener('focusout', () => setTimeout(() => { if (pending) render(); }, 50));
  document.addEventListener('close', () => setTimeout(() => { if (pending) render(); }, 30), true);
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openQuickAdd(); return; }
    if (e.defaultPrevented || e.target.matches('input, textarea, select') || modalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[1-5]$/.test(e.key) && !(route === 'learn' && document.querySelector('.grades'))) go(NAV[Number(e.key) - 1][0]);
  });
  addEventListener('hashchange', () => { const r = location.hash.slice(1); if (r !== route) go(r); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => render(true));
  // смена даты (полночь) и обновление маркера «сейчас»
  let lastDay = dkey();
  setInterval(() => { const d = dkey(); if (d !== lastDay) { lastDay = d; data.invalidate(); } if (route === 'today' && !document.hidden) render(); }, 60000);
}

function syncIndicator(st) {
  const el = document.getElementById('sync-ind'); if (!el) return;
  if (!sync.isConfigured() || !sync.isSignedIn()) { el.innerHTML = '<span class="dot"></span>Только это устройство'; return; }
  const label = { ok: 'Синхронизировано', syncing: 'Синхронизация…', error: 'Ошибка синхронизации', offline: 'Офлайн, сохранено локально', idle: 'Ожидание' }[st.status];
  el.innerHTML = `<span class="dot ${st.status}"></span>${label}`;
  if (st.status === 'ok' && (st.pulled || st.health)) render();
}

async function boot() {
  shell();
  await store.open();
  if (!store.get('settings')) data.saveSettings({});
  seedStart();
  bind();
  let viaLink = null; try { viaLink = await sync.consumeAuthRedirect(); } catch { }
  route = ROUTES[location.hash.slice(1)] ? location.hash.slice(1) : 'today';
  if (viaLink) setTimeout(() => toast(viaLink.error ? 'Вход не удался: ' + viaLink.error : `Вход выполнен: ${viaLink.email}. Данные синхронизируются.`), 900);
  store.subscribe(() => render());
  sync.onStatus(syncIndicator);
  sync.startAuto();
  render(true); $('#main').classList.add('enter'); setTimeout(() => $('#main').classList.remove('enter'), 1600);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('./sw.js').catch(() => { });
  // первый запуск: короткая настройка в 3 шага
  if (!store.getMeta('welcomed')) { store.setMeta('welcomed', true); if (!data.settings().anketaDone && location.hash.slice(1) !== 'profile') setTimeout(() => toast('Всё уже заполнено стартовыми планами. Анкета в профиле подстроит их под тебя.'), 1600); }
}

const WZ = [
  { t: 'Твой день', body: (v, s) => `<div class="small muted">Под это время строится план. Всё можно поменять позже.</div>
    <label class="f">Как тебя называть<input type="text" name="name" value="${esc(v.name ?? s.name ?? '')}" placeholder="Имя"></label>
    <div class="fg two"><label class="f">Подъём<input type="time" name="wake" value="${v.wake || s.wake}"></label><label class="f">Отбой<input type="time" name="bedtime" value="${v.bedtime || s.bedtime}"></label>
    <label class="f">Работа с<input type="time" name="workStart" value="${v.workStart || s.workStart}"></label><label class="f">Работа до<input type="time" name="workEnd" value="${v.workEnd || s.workEnd}"></label></div>
    <label class="f">Дорога в одну сторону, мин<input type="number" name="commuteMin" value="${v.commuteMin ?? s.commuteMin}"></label>` },
  { t: 'Тело', body: (v, s) => `<div class="small muted">Нужно для безопасной цели по калориям. Темп снижения: не больше 1% веса в неделю.</div>
    <div class="fg two"><label class="f">Рост, см<input type="number" name="heightCm" value="${v.heightCm ?? s.heightCm}"></label><label class="f">Возраст<input type="number" name="age" value="${v.age ?? s.age}"></label>
    <label class="f">Вес сейчас, кг<input type="number" step="0.1" name="kg" value="${v.kg ?? ''}" placeholder="например 94,5"></label><label class="f">Цель, кг<input type="number" step="0.1" name="goalWeightKg" value="${v.goalWeightKg ?? s.goalWeightKg ?? ''}"></label></div>` },
  { t: 'Что важно', body: (v, s) => `<div class="small muted">Реалистично при работе 07-18: вечером помещается одно главное дело.</div>
    <div class="small">Учёба в неделю</div><div class="choice">${[[120, '2 часа'], [180, '3 часа (советую)'], [240, '4 часа'], [300, '5 часов']].map(([m, l]) => `<label><input type="radio" name="studyWeeklyMin" value="${m}" ${Number(v.studyWeeklyMin ?? s.studyWeeklyMin) === m ? 'checked' : ''}>${l}</label>`).join('')}</div>
    <div class="small">Тренировок в неделю</div><div class="choice">${[[2, '2'], [3, '3 (советую)'], [4, '4'], [0, 'пока без них']].map(([n, l]) => `<label><input type="radio" name="workoutsPerWeek" value="${n}" ${Number(v.workoutsPerWeek ?? s.workoutsPerWeek) === n ? 'checked' : ''}>${l}</label>`).join('')}</div>
    <label class="toggle"><input type="checkbox" name="starter" checked> Добавить 3 стартовых ритуала: шаги, отбой вовремя, карточки</label>` }
];
function wizard(step, vals) {
  const D = window.__D, s = D.settings;
  const w = WZ[step];
  modal(step === 0 ? 'Добро пожаловать' : w.t, `<form data-f="wizard" class="wiz"><input type="hidden" name="_step" value="${step}">
    <div class="steps">${WZ.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
    ${step === 0 ? `${sigil('wiz-sigil', false)}<div class="display" style="font-size:24px;line-height:1.25;text-align:center">Система, которая подстраивается под твой день, а не наоборот.</div>` : ''}
    ${w.body(vals, s)}
    <div class="dlg-f">${step > 0 ? '<button type="button" class="btn ghost" data-a="wz-back">Назад</button>' : '<button type="button" class="btn ghost" data-a="wz-skip">Пропустить</button>'}<span class="sp"></span><button class="btn pri">${step < WZ.length - 1 ? 'Дальше' : 'Начать'}</button></div></form>`);
  wizard.vals = vals; wizard.step = step;
}
on({
  'wz-back': () => wizard(Math.max(0, wizard.step - 1), wizard.vals),
  'wz-skip': () => { store.setMeta('welcomed', true); close(); }
});
import { onForm } from './ui.js';
onForm({
  'wizard': (o) => {
    const step = Number(o._step); delete o._step;
    const vals = { ...wizard.vals, ...o };
    if (step < WZ.length - 1) return wizard(step + 1, vals);
    const num = k => vals[k] === '' || vals[k] == null ? undefined : Number(vals[k]);
    const out = { name: vals.name || '', wake: vals.wake, bedtime: vals.bedtime, workStart: vals.workStart, workEnd: vals.workEnd, commuteMin: num('commuteMin'), heightCm: num('heightCm'), age: num('age'), goalWeightKg: num('goalWeightKg') ?? null, studyWeeklyMin: num('studyWeeklyMin'), workoutsPerWeek: num('workoutsPerWeek') };
    Object.keys(out).forEach(k => out[k] === undefined && delete out[k]);
    data.saveSettings(out);
    const today = dkey();
    if (vals.kg) store.put('weight', { id: 'wt_' + today, date: today, kg: Number(vals.kg), ts: Date.now() });
    if (vals.starter && !store.all('habit').length) {
      [['Шаги: цель дня', 'Прогулка 10 минут', 'move'], ['Отбой вовремя', 'Экран убран за 15 минут до сна', 'sleep'], ['Карточки', '5 карточек', 'learn']].forEach(([name, minimal, area]) => store.put('habit', { name, minimal, area, freq: { type: 'daily' }, level: 1 }));
    }
    store.setMeta('welcomed', true); close(); toast('Готово. План на сегодня собран.');
  }
});
boot();
