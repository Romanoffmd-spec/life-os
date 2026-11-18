// «Я»: профиль и меню всего остального. Одно место, где всё найдётся.
import * as E from '../engine.js';
import { esc, int, dur, sum } from '../util.js';
import { icon, on, hero } from '../ui.js';
import { avatar, anketaProgress } from './profile.js';

export const title = 'Я';

export function render(D) {
  const s = D.settings, pr = anketaProgress();
  const due = D.habits.filter(h => !h.paused && E.habitStats(h, D.habitLogs, D.today).dueToday).length;
  const month = D.today.slice(0, 7); const spent = sum(D.expenses.filter(e => e.date.startsWith(month)).map(e => +e.amount || 0));
  const row = (route, ic, t, sub) => `<button class="mrow" data-a="go" data-v="${route}"><span class="aic">${icon(ic)}</span><span class="tt"><b>${t}</b><small>${sub}</small></span><i>›</i></button>`;
  return `${hero('me', s.name || 'Путник', esc(s.title || 'Хирург-ординатор') + (s.motto ? ` · «${esc(s.motto)}»` : ''), `<div class="hero-ava" data-a="go" data-v="profile">${avatar(D, 84)}</div>`)}
  ${pr.done < pr.total ? `<div class="note acc" style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span style="flex:1"><b>Анкета: ${pr.done} из ${pr.total}.</b> Заполни один раз, и план, меню и тренировки подстроятся под тебя.</span><button class="btn pri sm" data-a="go" data-v="profile">Заполнить</button></div>` : ''}
  <div class="menu">
    ${row('profile', 'assistant', 'Профиль и анкета', 'характеристики, печати, данные о себе')}
    ${row('habits', 'habits', 'Ритуалы', due ? `сегодня осталось ${due}` : 'всё отмечено')}
    ${row('rest', 'rest', 'Привал', 'отдых, фильмы, игры, встречи')}
    ${row('money', 'money', 'Казна', spent ? `в этом месяце ${int(spent)} ₸` : 'расходы и резерв')}
    ${row('assistant', 'assistant', 'Наставник', D.insights.length ? `${D.insights.length} наблюдений по твоим данным` : 'итоги дня и недели')}
    ${row('analytics', 'analytics', 'Летопись', 'куда уходит время, графики по неделям')}
    ${row('settings', 'settings', 'Настройки', 'синхронизация, Apple Health, резервная копия')}
  </div>`;
}
