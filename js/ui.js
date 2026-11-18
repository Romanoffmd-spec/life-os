// Общие UI-примитивы: иконки, модальные окна, уведомления, реестр действий и форм.
import { esc } from './util.js';

const P = {
  // гравюрные значки разделов (оригинальные)
  today: '<circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><path d="M10.6 11.4h.01M13.4 11.4h.01M10.7 13.3c.8.6 1.8.6 2.6 0" stroke-width="1.2"/>',
  plan: '<path d="M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6"/><path d="M7 4a2 2 0 0 0-2 2v12a2 2 0 1 0 4 0v-1h8"/><path d="M9.5 9h4.5M9.5 12h4.5M9.5 15h2.5"/>',
  health: '<path d="M12 20.5s-7.5-4.4-7.5-10.3A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.6c0 5.9-7.5 10.3-7.5 10.3z"/><path d="M6.5 12.5h3l1.3-2.4 2.2 4.6 1.4-2.2h3.1" stroke-width="1.3"/><path d="M12 7.6V4M10.5 4h3"/>',
  learn: '<path d="M3 5.5c3-1.2 6-1.2 9 1 3-2.2 6-2.2 9-1V19c-3-1.2-6-1.2-9 1-3-2.2-6-2.2-9-1z"/><path d="M12 6.5V20"/><path d="M16 4.5v5l1.3-1 1.2 1v-5.4" stroke-width="1.3"/>',
  habits: '<path d="M9 21h6M10 21V11h4v10"/><path d="M12 8.5c-1.6-1.3-1.2-3.3 0-5.5 1.2 2.2 1.6 4.2 0 5.5z"/><path d="M8 11h8" />',
  rest: '<path d="M4 20l16-3.5M20 20L4 16.5"/><path d="M12 15c-2.6 0-4-1.8-3.2-4.2.5-1.4 1.7-2.2 1.9-4.3 2.8 1.4 4.2 3.4 4.4 5.4.2 2-1 3.1-3.1 3.1z"/><path d="M12 15c-.9-.6-1-1.7-.2-2.8.8 1.1.9 2.2.2 2.8z" stroke-width="1.2"/>',
  assistant: '<path d="M5 9.5C5 6 8 3.5 12 3.5S19 6 19 9.5V14c0 3.6-3.1 6.5-7 6.5S5 17.6 5 14z"/><path d="M5 6L3.5 3.5 7.5 5M19 6l1.5-2.5L16.5 5"/><circle cx="9.3" cy="11" r="2"/><circle cx="14.7" cy="11" r="2"/><path d="M11.3 14l.7 1.2.7-1.2z" stroke-width="1.2"/>',
  analytics: '<path d="M6.5 3h11M6.5 21h11"/><path d="M7.5 3c0 4.5 4.5 5.7 4.5 9s-4.5 4.5-4.5 9M16.5 3c0 4.5-4.5 5.7-4.5 9s4.5 4.5 4.5 9"/><path d="M9.5 18.5c1.5-1 3.5-1 5 0" stroke-width="1.2"/>',
  money: '<path d="M4 9h16l-1.5 10.5a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M8 9V7a4 4 0 0 1 8 0v2"/><circle cx="12" cy="14.5" r="2.2"/><path d="M12 12.3v-.8M12 17.5v-.8" stroke-width="1.2"/>',
  settings: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/><path d="M12 3.5l1.2 6.3L12 12l-1.2-2.2zM12 20.5l-1.2-6.3L12 12l1.2 2.2zM3.5 12l6.3-1.2L12 12l-2.2 1.2zM20.5 12l-6.3 1.2L12 12l2.2-1.2z" stroke-width="1.2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  play: '<path d="M7 4v16l13-8z"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  water: '<path d="M12 2.7S5 10 5 14.5a7 7 0 0 0 14 0C19 10 12 2.7 12 2.7z"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'
};
/** Печать Life OS: часовой круг, восьмиконечная звезда, солнце и месяц (оригинальный знак) */
export function sigil(cls = '', animated = true) {
  const ticks = Array.from({ length: 12 }, (_, i) => { const a = i * 30 * Math.PI / 180; const r1 = 44, r2 = i % 3 === 0 ? 38 : 41; return `<line x1="${50 + r1 * Math.sin(a)}" y1="${50 - r1 * Math.cos(a)}" x2="${50 + r2 * Math.sin(a)}" y2="${50 - r2 * Math.cos(a)}"/>`; }).join('');
  return `<svg class="${cls}" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
    <g class="${animated ? 'r1' : ''}"><circle cx="50" cy="50" r="47"/><circle cx="50" cy="50" r="44" stroke-width=".8"/>${ticks}</g>
    <g class="${animated ? 'r2' : ''}"><rect x="27" y="27" width="46" height="46" stroke-width="1.2"/><rect x="27" y="27" width="46" height="46" stroke-width="1.2" transform="rotate(45 50 50)"/></g>
    <circle cx="50" cy="50" r="15"/><path d="M50 37a13 13 0 0 1 0 26" fill="currentColor" fill-opacity=".9" stroke="none"/><circle cx="50" cy="50" r="2.2" fill="currentColor"/>
  </svg>`;
}
export function icon(name, cls = '') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}

// ---- реестр действий ----
export const actions = {};
export const forms = {};
export function on(map) { Object.assign(actions, map); }
export function onForm(map) { Object.assign(forms, map); }

// ---- модальное окно ----
let dlg = null;
export function modal(title, body, { foot = '', wide = false } = {}) {
  close();
  const me = dlg = document.createElement('dialog');
  if (wide) dlg.style.width = 'min(820px, calc(100vw - 24px))';
  dlg.innerHTML = `<div class="dlg"><div class="dlg-h"><h2>${esc(title)}</h2><button class="btn ghost sm" data-a="close-modal" aria-label="Закрыть">${icon('x')}</button></div>${body}${foot ? `<div class="dlg-f">${foot}</div>` : ''}</div>`;
  document.body.appendChild(dlg);
  me.addEventListener('close', () => { me.remove(); if (dlg === me) dlg = null; });
  me.addEventListener('click', e => { if (e.target === me) close(); });
  dlg.showModal();
  const first = dlg.querySelector('[autofocus], input:not([type=hidden]), textarea, select');
  if (first && matchMedia('(min-width: 641px)').matches) first.focus();
  return dlg;
}
export function close() { if (dlg) { const d = dlg; dlg = null; d.close(); d.remove(); } }
export function modalOpen() { return !!dlg; }
export function modalEl() { return dlg; }
on({ 'close-modal': () => close() });

// ---- тосты ----
let toastEl = null, toastT = null;
export function toast(text, undo) {
  toastEl?.remove(); clearTimeout(toastT);
  toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.innerHTML = `<span>${esc(text)}</span>${undo ? '<button>Отменить</button>' : ''}`;
  if (undo) toastEl.querySelector('button').onclick = () => { undo(); toastEl.remove(); };
  document.body.appendChild(toastEl);
  toastT = setTimeout(() => toastEl?.remove(), undo ? 5000 : 2600);
}

export function confirmBox(text, okLabel = 'Удалить') {
  return new Promise(res => {
    const d = modal('Подтверждение', `<div>${esc(text)}</div>`, { foot: `<button class="btn" data-a="close-modal">Отмена</button><button class="btn pri" id="cb-ok">${esc(okLabel)}</button>` });
    d.querySelector('#cb-ok').onclick = () => { close(); res(true); };
    d.addEventListener('close', () => res(false));
  });
}

export function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') { if (el.dataset.multi) { (o[el.name] ||= []); if (el.checked) o[el.name].push(el.value); } else o[el.name] = el.checked; }
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else if (el.type === 'number') o[el.name] = el.value === '' ? null : Number(el.value.replace(',', '.'));
    else o[el.name] = el.value.trim();
  }
  return o;
}

export function seg(name, options, value, attrs = '') {
  return `<div class="seg" ${attrs}>${options.map(([v, l]) => `<button type="button" class="${String(v) === String(value) ? 'on' : ''}" data-a="${name}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`;
}
export function opts(options, value) {
  return options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');
}

/** Шапка-иллюстрация экрана. art: имя файла в /art без расширения */
export function hero(art, title, sub = '', extra = '', { small = false, back = null } = {}) {
  const small$ = small ? ' small' : '';
  return `<header class="hero${small$}" style="--art:url(../art/${art}.webp);--art-s:url(../art/${art}-s.webp)">
    <div class="hero-bg"></div>
    <div class="hero-in">${back ? `<a class="back" data-a="go" data-v="${back[0]}">‹ ${esc(back[1])}</a>` : ''}
      <h1>${esc(title)}</h1>${sub ? `<div class="hero-sub">${sub}</div>` : ''}${extra}</div></header>`;
}
export function linkRow(items) {
  return `<div class="linkrow">${items.map(([a, v, label, ic]) => `<button class="lr" data-a="${a}" data-v="${v}">${ic ? icon(ic) : ''}<span>${esc(label)}</span><i>›</i></button>`).join('')}</div>`;
}
