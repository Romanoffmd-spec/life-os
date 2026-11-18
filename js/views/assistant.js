// AI-ассистент: выводы по реальным данным, недельный отчёт, диалог с Claude (по своему API-ключу).
import * as store from '../store.js';
import * as E from '../engine.js';
import { esc, dur, num, int, fmtDate, addDays, weekStart, sum } from '../util.js';
import { icon, on, onForm, modal, close, toast } from '../ui.js';
import { saveSettings, aiContext } from '../data.js';

export const title = 'Наставник';
let busy = false, err = null;

function insightCard(i) {
  const btn = i.action ? {
    bedtime: `<button class="btn sm" data-a="ins-act" data-type="bedtime" data-v="${i.action.value}">Поставить отбой ${i.action.value}</button>`,
    mode: `<button class="btn sm" data-a="ins-act" data-type="mode" data-v="mvd">Сделать сегодня днём восстановления</button>`,
    'habit-min': `<button class="btn sm" data-a="habit-edit" data-id="${i.action.id}">Упростить привычку</button>`,
    'habit-up': `<button class="btn sm" data-a="habit-level" data-id="${i.action.id}">Усложнить</button>`
  }[i.action.type] : '';
  return `<div class="ins ${i.level}"><div class="ic">${i.level === 'warn' ? '!' : i.level === 'good' ? '✓' : 'i'}</div><div style="flex:1"><div class="row"><div class="ti">${esc(i.title)}</div><span class="sp"></span><span class="chip">${esc(i.area)}</span></div><div class="tx">${esc(i.text)}</div>${btn ? `<div style="margin-top:8px">${btn}</div>` : ''}</div></div>`;
}

function weekly(D) {
  const ws = weekStart(D.today), cur = E.weekSummary(D, ws), prev = E.weekSummary(D, addDays(ws, -7));
  const row = (l, a, b, fmt, better = 'up') => {
    let d = ''; if (a != null && b != null) { const diff = a - b; const good = better === 'up' ? diff > 0 : better === 'down' ? diff < 0 : null; d = `<span class="${good == null ? 'muted' : good ? 'good' : 'warn'} small">${diff > 0 ? '▲' : diff < 0 ? '▼' : ''}</span>`; }
    return `<tr><td>${l}</td><td class="tr">${a == null ? '-' : fmt(a)} ${d}</td><td class="tr muted">${b == null ? '-' : fmt(b)}</td></tr>`;
  };
  return `<table class="t"><tr><th></th><th class="tr">Эта неделя (${cur.days} дн)</th><th class="tr">Прошлая</th></tr>
    ${row('Сон, среднее', cur.sleep, prev.sleep, dur, 'up')}${row('Шаги, среднее', cur.steps, prev.steps, int, 'up')}
    ${row('Тренировки', cur.workouts, prev.workouts, v => v + '/' + D.settings.workoutsPerWeek, 'up')}${row('Учёба', cur.studyMin, prev.studyMin, dur, 'up')}
    ${row('Выполнение плана', cur.comp, prev.comp, v => Math.round(v * 100) + '%', 'up')}${row('Привычки (14 дн)', cur.habitRate, prev.habitRate, v => Math.round(v * 100) + '%', 'up')}
    ${row('Задач сделано', cur.tasksDone, prev.tasksDone, v => v, 'up')}${row('Отдых (отмечено)', cur.leisure, prev.leisure, dur, null)}
    ${row('Изменение тренда веса', cur.weightDelta, prev.weightDelta, v => (v > 0 ? '+' : '') + num(v, 2) + ' кг', 'down')}</table>`;
}

export function render(D) {
  const key = store.getMeta('aiKey');
  const chat = store.all('chat').sort((a, b) => a.ts - b.ts).slice(-40);
  const st = D.planState || {}; const tracked = D.plan.blocks.filter(b => b.track && !b.optional);
  const done = tracked.filter(b => st.done?.[b.id]), missed = tracked.filter(b => !st.done?.[b.id] && b.end <= (new Date().getHours() * 60 + new Date().getMinutes()));
  const rit = D.habits.filter(h => !h.paused).map(h => E.habitStats(h, D.habitLogs, D.today)); const ritDone = rit.filter(x => x.doneToday).length, ritDue = rit.filter(x => x.doneToday || x.dueToday).length;
  const food = D.foodByDay[D.today]; const steps = D.daily[D.today]?.steps;
  const top3 = D.insights.filter(i => i.level !== 'good').slice(0, 3);
  const evening = `<div class="card c6"><div class="card-h"><h2>Итоги дня</h2><span class="sp"></span><span class="tiny muted">${new Date().getHours() >= 18 ? 'вечерний разбор' : 'промежуточно'}</span></div>
    <div class="col small" style="gap:6px">
      <div><b>Сделано:</b> ${done.length ? done.map(b => esc(b.title)).join(', ') : 'пока ничего из плана'}</div>
      ${missed.length ? `<div><b>Не случилось:</b> ${missed.map(b => esc(b.title)).join(', ')}. Это не долг: завтра план собирается заново.</div>` : ''}
      <div><b>Ритуалы:</b> ${ritDone} из ${ritDue}</div>
      <div><b>Еда:</b> ${food ? int(food.kcal) + ' ккал' : 'не записана'}${D.targets ? ' при цели ' + int(D.targets.kcal) : ''} · <b>Шаги:</b> ${steps ? int(steps) : 'нет данных'}</div>
      <div class="muted" style="margin-top:4px">Завтра: ${D.nextTopic ? 'тема «' + esc(D.nextTopic.title) + '»' : 'учебная программа пройдена'}, тренировка ${D.nextLetter} по очереди. Ничего готовить вечером не нужно: план соберётся сам утром.</div>
    </div></div>
    <div class="card c6"><div class="card-h"><h2>Не больше трёх корректировок</h2></div>${top3.length ? top3.map((i, n) => `<div class="small" style="margin-bottom:8px"><b>${n + 1}. ${esc(i.title)}.</b> ${esc(i.text)}</div>`).join('') : '<div class="small muted">Сейчас менять ничего не нужно: продолжай как есть.</div>'}</div>`;
  return `<div class="top"><h1>Наставник</h1><span class="sp"></span><button class="btn" data-a="report-copy">${icon('download')}Отчёт недели (.md)</button></div>
  <div class="grid">${evening}
    <div class="card c7"><div class="card-h"><h2>Выводы по твоим данным</h2><span class="sp"></span><span class="muted small">${D.insights.length}</span></div>
      ${D.insights.length ? D.insights.map(insightCard).join('') : `<div class="empty">Пока недостаточно данных для выводов. Нужны 1-2 недели записей: сон, план, привычки, вес. Ассистент не придумывает советы без опоры на данные.</div>`}</div>
    <div class="card c5"><div class="card-h"><h2>Неделя</h2><span class="sp"></span><span class="muted small">с ${fmtDate(weekStart(D.today))}</span></div>${weekly(D)}</div>
    <div class="card c12"><div class="card-h"><h2>Диалог</h2><span class="sp"></span>${key ? `<span class="muted small">Claude · ${esc(D.settings.aiModel)}</span><button class="btn ghost sm" data-a="chat-clear">Очистить</button>` : ''}</div>
      ${key ? `<div class="chat" id="chat">${chat.map(m => `<div class="msg ${m.role}">${esc(m.text)}</div>`).join('') || '<div class="muted small">Спроси о чём угодно, связанном с твоими данными. Примеры ниже.</div>'}${busy ? '<div class="msg assistant muted">Думаю…</div>' : ''}</div>
        ${err ? `<div class="note warn" style="margin-top:8px">${esc(err)}</div>` : ''}
        <div class="row wrap" style="gap:6px;margin:10px 0">${['Почему я не выполняю вечерний план?', 'Составь план на завтра с учётом моего сна', 'Есть ли конфликт между моими целями?', 'Что изменить в питании на следующей неделе?', 'Сделай недельный разбор'].map(q => `<button class="chip" data-a="chat-ask" data-v="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <form data-f="chat" class="row"><input type="text" name="q" placeholder="Вопрос ассистенту" autocomplete="off"><button class="btn pri" ${busy ? 'disabled' : ''}>${icon('send')}</button></form>
        <div class="tiny muted" style="margin-top:6px">В запрос уходит агрегированная сводка за 28 дней (сон, шаги, калории, учёба, привычки, задачи), без заметок. Запрос идёт напрямую с устройства в API Anthropic по твоему ключу.</div>`
      : `<div class="col"><div class="small">Правила и выводы выше работают без интернета. Для свободного диалога можно подключить Claude по своему API-ключу (console.anthropic.com, оплата по факту использования).</div>
        <form data-f="ai-key" class="row"><input type="password" name="key" placeholder="sk-ant-..." autocomplete="off"><button class="btn pri">Подключить</button></form>
        <div class="tiny muted">Ключ хранится только на этом устройстве и не синхронизируется.</div></div>`}</div>
  </div>`;
}

const SYSTEM = `Ты ассистент персональной системы управления жизнью Life OS. Пользователь: хирург-ординатор, работа 07:00-18:00, иногда дежурства. Цели: снижение веса, сон, обучение (медицина, хирургия, наука, английский), привычки, полноценный отдых.
Правила:
- Опирайся только на переданные данные (JSON ниже). Если данных не хватает, прямо скажи, каких.
- Давай конкретные изменения: что, когда, на сколько. Никаких общих мотивационных фраз.
- Учитывай, что после 11-часового рабочего дня ресурсов мало: не предлагай больше 60-90 минут продуктивной работы вечером, отдых обязателен.
- Без чувства вины и давления: пропуски это данные для настройки, а не провал.
- Не делай медицинских выводов по единичным измерениям, не выдавай расчётные показатели носимых устройств за медицинские. При устойчивых тревожных изменениях советуй обратиться к врачу.
- Не предлагай экстремальные дефициты калорий, голодание, перетренированность. Безопасный темп снижения веса 0,5-1% в неделю.
- Пиши по-русски, коротко, списками где уместно. Не используй длинные тире.`;

async function ask(q) {
  const D = window.__D; const key = store.getMeta('aiKey'); if (!key || busy) return;
  store.put('chat', { role: 'user', text: q, ts: Date.now() });
  busy = true; err = null; window.__rerender();
  try {
    const hist = store.all('chat').sort((a, b) => a.ts - b.ts).slice(-12).map(m => ({ role: m.role, content: m.text }));
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: D.settings.aiModel, max_tokens: 1500, system: SYSTEM + '\n\nДанные пользователя:\n' + JSON.stringify(aiContext(D)), messages: hist })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
    const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    store.put('chat', { role: 'assistant', text, ts: Date.now() });
  } catch (e) { err = 'Ошибка запроса: ' + e.message + (navigator.onLine ? '' : ' (нет интернета)'); }
  busy = false; window.__rerender();
  setTimeout(() => { const c = document.getElementById('chat'); if (c) c.scrollTop = c.scrollHeight; }, 30);
}

function reportMd(D) {
  const ws = weekStart(D.today), c = E.weekSummary(D, ws);
  const lines = [`# Life OS: неделя с ${fmtDate(ws)}`, '', `- Сон: ${c.sleep ? dur(c.sleep) : 'нет данных'} в среднем`, `- Шаги: ${c.steps ? int(c.steps) : 'нет данных'} в день`, `- Тренировки: ${c.workouts}/${D.settings.workoutsPerWeek}`, `- Учёба: ${dur(c.studyMin)} из ${dur(D.settings.studyWeeklyMin)}`,
    ...Object.entries(c.studyTracks).map(([t, m]) => `  - ${D.settings.tracks.find(x => x.id === t)?.name || t}: ${dur(m)}`),
    `- План выполнен: ${c.comp != null ? Math.round(c.comp * 100) + '%' : 'нет данных'}`, `- Привычки: ${c.habitRate != null ? Math.round(c.habitRate * 100) + '%' : 'нет данных'}`, `- Задач сделано: ${c.tasksDone}`, `- Отдых: ${dur(c.leisure)}`,
    `- Вес (тренд): ${c.weight ? num(c.weight, 1) + ' кг' : 'нет данных'}${c.weightDelta != null ? ` (${c.weightDelta > 0 ? '+' : ''}${num(c.weightDelta, 2)} кг за неделю)` : ''}`, '', '## Выводы', ...D.insights.map(i => `- **${i.title}.** ${i.text}`)];
  return lines.join('\n');
}

on({
  'ins-act': (ds) => {
    if (ds.type === 'bedtime') { saveSettings({ bedtime: ds.v }); toast(`Отбой теперь ${ds.v}. План пересчитан.`); }
    if (ds.type === 'mode') { const D = window.__D; store.put('day', { ...(store.get('day_' + D.today) || {}), id: 'day_' + D.today, date: D.today, mode: 'mvd' }); toast('Сегодня день восстановления'); }
  },
  'chat-ask': (ds) => ask(ds.v),
  'chat-clear': () => { store.all('chat').forEach(m => store.remove(m.id)); },
  'report-copy': () => {
    const md = reportMd(window.__D);
    const blob = new Blob([md], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `lifeos-week-${weekStart(window.__D.today)}.md`; a.click();
    navigator.clipboard?.writeText(md).then(() => toast('Отчёт скачан и скопирован')).catch(() => toast('Отчёт скачан'));
  }
});
onForm({
  'chat': (o, form) => { if (o.q) { form.reset(); ask(o.q); } },
  'ai-key': async (o) => { if (!/^sk-ant-/.test(o.key)) return toast('Ключ должен начинаться с sk-ant-'); await store.setMeta('aiKey', o.key); window.__rerender(); }
});
