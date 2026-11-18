// «Знания»: тема сегодня, повторение, прогресс недели. Без вкладок.
import * as E from '../engine.js';
import { esc, dur } from '../util.js';
import { icon, on, hero, linkRow } from '../ui.js';
import { meter } from '../charts.js';
import { topicCard } from './learn.js';

export const title = 'Знания';

export function render(D) {
  const s = D.settings, due = E.srsDue(D.cards, D.today).length, st = D.plan.study;
  const done = D.topics.filter(t => t.done).length;
  return `${hero('mind', 'Знания', `тема ${Math.min(done + 1, D.topics.length)} из ${D.topics.length} · неделя ${dur(st.doneWeek)} из ${dur(s.studyWeeklyMin)}`)}
  <div class="grid">
    ${topicCard(D, D.nextTopic)}
    <section class="card c6"><div class="card-h"><h2>Повторение</h2></div>
      <div class="big">${due}<small>карточек</small></div>
      <div class="small muted" style="margin-bottom:12px">${due ? 'Около ' + Math.max(2, Math.round(due * 0.4)) + ' минут. Удобно в дороге или за завтраком.' : 'На сегодня всё повторено.'}</div>
      <button class="btn pri" data-a="mind-review" ${due ? '' : 'disabled'}>${icon('play')}Повторить</button></section>
    <section class="card c6"><div class="card-h"><h2>Неделя</h2></div>
      <div class="small" style="margin-bottom:6px">${dur(st.doneWeek)} из ${dur(s.studyWeeklyMin)}</div>${meter(st.doneWeek / s.studyWeeklyMin)}
      <div class="small muted" style="margin:12px 0 6px">Программа: ${done} из ${D.topics.length} тем</div>${meter(done / Math.max(1, D.topics.length), 'var(--c3)')}
      <div class="tiny muted" style="margin-top:10px">Отставание не нужно догонять: темы просто идут по очереди.</div></section>
  </div>
  ${linkRow([['open-learn', 'program', 'Вся программа 13 недель', 'learn'], ['open-learn', 'materials', 'Книги и статьи', 'plan'], ['open-learn', 'cards', 'Мои карточки', 'habits'], ['open-learn', 'history', 'История учёбы', 'analytics']])}`;
}
on({ 'mind-review': () => { window.__go('learn'); setTimeout(() => document.querySelector('[data-a="srs-start"]')?.click(), 30); },
  'open-learn': async (ds) => { window.__go('learn'); setTimeout(() => document.querySelector(`[data-a="l-tab"][data-v="${ds.v}"]`)?.click(), 30); } });
