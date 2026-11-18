// Питание: справочник продуктов (на 100 г, ориентировочные значения по стандартным таблицам состава),
// меню на 7 дней из продуктов, доступных в Казахстане, с масштабированием под личную цель по калориям.

export const FOODS = {
  oats: { kw: 'овсян глютен', n: 'Овсяные хлопья', k: 352, p: 12.3, f: 6.1, c: 59.5, g: 'Крупы', alt: 'buckwheat' },
  buckwheat: { kw: 'гречк', n: 'Гречка (сухая)', k: 313, p: 12.6, f: 3.3, c: 62, g: 'Крупы', alt: 'rice' },
  rice: { kw: 'рис', n: 'Рис (сухой)', k: 344, p: 6.7, f: 0.7, c: 78.9, g: 'Крупы', alt: 'buckwheat' },
  bulgur: { kw: 'булгур глютен пшениц', n: 'Булгур (сухой)', k: 342, p: 12.3, f: 1.3, c: 63, g: 'Крупы', alt: 'buckwheat' },
  pasta: { kw: 'макарон глютен пшениц', n: 'Макароны твёрдых сортов (сухие)', k: 350, p: 12, f: 1.5, c: 71, g: 'Крупы', alt: 'rice' },
  lentil: { kw: 'чечевиц бобов', n: 'Чечевица красная (сухая)', k: 295, p: 24, f: 1.5, c: 46, g: 'Крупы', alt: 'buckwheat' },
  bread: { kw: 'хлеб глютен пшениц', n: 'Хлеб цельнозерновой', k: 245, p: 8.5, f: 2.5, c: 45, g: 'Хлеб', alt: 'lavash' },
  lavash: { kw: 'лаваш хлеб глютен пшениц', n: 'Лаваш тонкий', k: 277, p: 9, f: 1.2, c: 56, g: 'Хлеб', alt: 'bread' },
  potato: { kw: 'картоф', n: 'Картофель', k: 77, p: 2, f: 0.4, c: 16.3, g: 'Овощи', alt: 'rice' },
  egg: { kw: 'яйц яиц', n: 'Яйцо куриное', k: 157, p: 12.7, f: 11.5, c: 0.7, g: 'Белок', unit: 55, unitName: 'шт', alt: 'cottage' },
  cottage: { kw: 'творог молочн лактоз', n: 'Творог 5%', k: 121, p: 17.2, f: 5, c: 1.8, g: 'Молочные', alt: 'chicken' },
  kefir: { kw: 'кефир молочн лактоз', n: 'Кефир 1%', k: 40, p: 3, f: 1, c: 4, g: 'Молочные', alt: 'apple' },
  milk: { kw: 'молок молочн лактоз', n: 'Молоко 1,5%', k: 44, p: 2.8, f: 1.5, c: 4.7, g: 'Молочные', alt: 'water' },
  cheese: { kw: 'сыр молочн лактоз', n: 'Сыр адыгейский', k: 240, p: 18.5, f: 14, c: 1.5, g: 'Молочные', alt: 'egg' },
  chicken: { kw: 'куриц мясо птиц', n: 'Куриная грудка (сырая)', k: 113, p: 23.6, f: 1.9, c: 0.4, g: 'Белок', alt: 'turkey' },
  turkey: { kw: 'индейк мясо птиц', n: 'Филе индейки (сырое)', k: 114, p: 23, f: 1.5, c: 0, g: 'Белок', alt: 'chicken' },
  beef: { kw: 'говядин мясо', n: 'Говядина постная (сырая)', k: 158, p: 22, f: 7, c: 0, g: 'Белок', alt: 'chicken' },
  fish: { kw: 'рыба рыбу рыбы минтай хек морепрод', n: 'Минтай или хек (сырой)', k: 72, p: 15.9, f: 0.9, c: 0, g: 'Белок', alt: 'chicken' },
  chickpea: { kw: 'нут бобов', n: 'Нут консервированный', k: 164, p: 8.9, f: 2.6, c: 27.4, g: 'Белок', alt: 'lentil' },
  cucumber: { kw: 'огур', n: 'Огурцы', k: 15, p: 0.8, f: 0.1, c: 2.8, g: 'Овощи' },
  tomato: { kw: 'помидор томат', n: 'Помидоры', k: 20, p: 0.6, f: 0.2, c: 4.2, g: 'Овощи' },
  cabbage: { kw: 'капуст', n: 'Капуста белокочанная', k: 27, p: 1.8, f: 0.1, c: 4.7, g: 'Овощи' },
  carrot: { kw: 'морков', n: 'Морковь', k: 35, p: 1.3, f: 0.1, c: 6.9, g: 'Овощи' },
  pepper: { kw: 'перец', n: 'Перец болгарский', k: 26, p: 1.3, f: 0.1, c: 5.3, g: 'Овощи' },
  vegmix: { kw: 'овощн смесь', n: 'Замороженная овощная смесь', k: 40, p: 2, f: 0.2, c: 7, g: 'Овощи' },
  onion: { kw: 'лук', n: 'Лук репчатый', k: 41, p: 1.4, f: 0.2, c: 8.2, g: 'Овощи' },
  banana: { kw: 'банан', n: 'Банан', k: 89, p: 1.1, f: 0.3, c: 22.8, g: 'Фрукты', alt: 'apple' },
  apple: { kw: 'яблок', n: 'Яблоко', k: 47, p: 0.4, f: 0.4, c: 9.8, g: 'Фрукты', alt: 'banana' },
  walnut: { kw: 'орех', n: 'Грецкие орехи', k: 654, p: 15.2, f: 65.2, c: 13.7, g: 'Прочее', alt: 'oil' },
  honey: { kw: 'мёд мед сахар', n: 'Мёд', k: 329, p: 0.8, f: 0, c: 81.5, g: 'Прочее' },
  oil: { n: 'Масло подсолнечное или оливковое', k: 899, p: 0, f: 99.9, c: 0, g: 'Прочее' },
  water: { n: 'Вода', k: 0, p: 0, f: 0, c: 0, g: 'Прочее' }
};

const M = (name, items, quick = false, note = '') => ({ name, items, quick, note });
const BREAKFASTS = [
  M('Овсянка на молоке с бананом и 2 яйца', [['oats', 50], ['milk', 200], ['banana', 80], ['egg', 110]]),
  M('Омлет из 3 яиц с овощами и хлебом', [['egg', 165], ['pepper', 80], ['tomato', 100], ['bread', 50], ['oil', 5]]),
  M('Творог с бананом и мёдом', [['cottage', 200], ['banana', 100], ['honey', 10], ['bread', 30]], true),
  M('Гречка с яйцами и огурцом', [['buckwheat', 50], ['egg', 110], ['cucumber', 150]])
];
const LUNCHES = [
  M('Курица с гречкой и салатом из капусты', [['chicken', 150], ['buckwheat', 70], ['cabbage', 120], ['carrot', 50], ['oil', 7]], false, 'контейнер'),
  M('Индейка с рисом и овощами', [['turkey', 150], ['rice', 65], ['vegmix', 150], ['oil', 5]], false, 'контейнер'),
  M('Говядина с булгуром и свежими овощами', [['beef', 130], ['bulgur', 65], ['cucumber', 100], ['tomato', 100]], false, 'контейнер'),
  M('Курица с макаронами и овощами', [['chicken', 150], ['pasta', 65], ['vegmix', 150], ['oil', 5]], false, 'контейнер')
];
const SNACKS = [
  M('Кефир и яблоко', [['kefir', 300], ['apple', 150]], true),
  M('Творог с яблоком', [['cottage', 150], ['apple', 150]], true),
  M('Сыр, хлеб и огурец', [['cheese', 40], ['bread', 40], ['cucumber', 100]], true)
];
const DINNERS = [
  M('Запечённая рыба с картофелем и салатом', [['fish', 220], ['potato', 200], ['tomato', 100], ['cucumber', 100], ['oil', 7]]),
  M('Курица с тушёными овощами', [['chicken', 160], ['vegmix', 250], ['onion', 40], ['oil', 7]], true),
  M('Чечевичный суп с хлебом', [['lentil', 60], ['potato', 100], ['carrot', 60], ['onion', 40], ['bread', 40], ['oil', 5]]),
  M('Говядина с тушёной капустой', [['beef', 140], ['cabbage', 250], ['carrot', 50], ['onion', 30], ['oil', 5]]),
  M('Омлет с сыром и овощами', [['egg', 165], ['cheese', 30], ['pepper', 100], ['tomato', 100]], true),
  M('Нут с курицей в лаваше', [['chicken', 120], ['chickpea', 100], ['lavash', 60], ['tomato', 80], ['cucumber', 80]], true)
];

// План недели: какие блюда в какой день. Готовка: воскресенье и среда (белок и крупа на 3 дня).
const WEEK = [
  { b: 0, l: 0, s: 0, d: 1 }, { b: 1, l: 0, s: 1, d: 2 }, { b: 2, l: 0, s: 0, d: 0 },
  { b: 3, l: 1, s: 2, d: 3 }, { b: 0, l: 1, s: 0, d: 4 }, { b: 1, l: 2, s: 1, d: 5 }, { b: 2, l: 3, s: 0, d: 0 }
];
export const PREP = [
  { day: 6, text: 'Воскресенье, 60 минут: запечь 1 кг куриной грудки, сварить 300 г гречки, нарезать капусту и морковь. Разложить обеды на пн-ср в контейнеры.' },
  { day: 2, text: 'Среда, 50 минут: отварить индейку и говядину, сварить рис и булгур. Обеды на чт-сб.' }
];

function exclusionsList(text) { return String(text || '').toLowerCase().split(/[,;\n]+/).map(s => s.trim()).filter(Boolean); }
function hit(k, excl) {
  const hay = (FOODS[k].n + ' ' + (FOODS[k].kw || '')).toLowerCase();
  return excl.some(x => { const stem = x.length > 5 ? x.slice(0, x.length - 2) : x.slice(0, Math.max(3, x.length - 1)); return hay.includes(stem); });
}
function resolveFood(key, excl) {
  let k = key, guard = 0;
  while (k && hit(k, excl) && guard++ < 5) k = FOODS[k].alt;
  return k && !hit(k, excl) ? k : 'water';
}
export function mealMacros(items) {
  let k = 0, p = 0, f = 0, c = 0;
  for (const [id, g] of items) { const x = FOODS[id]; k += x.k * g / 100; p += x.p * g / 100; f += x.f * g / 100; c += x.c * g / 100; }
  return { kcal: Math.round(k), p: Math.round(p), f: Math.round(f), c: Math.round(c) };
}
const VEG = ['cucumber', 'tomato', 'cabbage', 'pepper', 'vegmix', 'onion', 'carrot'];
const isProtein = id => FOODS[id].g === 'Белок' || id === 'cottage' || id === 'kefir';
/** Масштабирование дня: при снижении калорий белковые продукты сохраняются, урезаются крупы, хлеб и жиры */
function dayFactors(meals, kcal) {
  let P = 0, O = 0, V = 0;
  for (const m of meals) for (const [id, g] of m.items) { const k = FOODS[id].k * g / 100; if (VEG.includes(id)) V += k; else if (isProtein(id)) P += k; else O += k; }
  if (P + O + V <= kcal) { const f = Math.min(1.9, (kcal - V) / (P + O)); return { fp: f, fo: f }; }
  const fo = Math.max(0.45, (kcal - V - P) / O);
  const fp = fo > 0.45 ? 1 : Math.max(0.75, (kcal - V - O * fo) / P);
  return { fp, fo };
}
function scaleItems(items, { fp, fo }) {
  return items.map(([id, g]) => {
    const x = FOODS[id];
    if (VEG.includes(id)) return [id, g]; // овощи не урезаем
    const factor = isProtein(id) ? fp : fo;
    if (x.unit) return [id, Math.max(1, Math.round(g * factor / x.unit)) * x.unit];
    return [id, Math.max(5, Math.round(g * factor / 5) * 5)];
  });
}
function fmtItem([id, g]) { const x = FOODS[id]; return x.unit ? `${x.n}: ${Math.round(g / x.unit)} ${x.unitName}` : `${x.n}: ${g} г`; }

/** Меню на 7 дней под цель по калориям. times: { b, l, s, d } в формате 'HH:MM' */
export function buildMenu({ kcal = 2000, exclude = '', times }) {
  const excl = exclusionsList(exclude);
  const pick = (m) => ({ ...m, items: m.items.map(([id, g]) => [resolveFood(id, excl), g]) });
  const days = WEEK.map((w, i) => {
    const meals = [['b', 'Завтрак', BREAKFASTS[w.b]], ['l', 'Обед', LUNCHES[w.l]], ['s', 'Перекус', SNACKS[w.s]], ['d', 'Ужин', DINNERS[w.d]]].map(([key, label, m]) => ({ key, label, time: times?.[key], ...pick(m) }));
    const factor = dayFactors(meals, kcal);
    const scaled = meals.map(m => { const items = scaleItems(m.items, factor); return { ...m, items, lines: items.map(fmtItem), ...mealMacros(items) }; });
    const tot = scaled.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, f: a.f + m.f, c: a.c + m.c }), { kcal: 0, p: 0, f: 0, c: 0 });
    return { dow: i, meals: scaled, total: tot };
  });
  return { days, prep: PREP };
}

/** Список покупок на неделю, сгруппированный по отделам */
export function shoppingList(menu) {
  const acc = {};
  for (const d of menu.days) for (const m of d.meals) for (const [id, g] of m.items) acc[id] = (acc[id] || 0) + g;
  const groups = {};
  for (const [id, g] of Object.entries(acc)) {
    if (id === 'water') continue;
    const x = FOODS[id];
    (groups[x.g] ||= []).push(x.unit ? `${x.n}: ${Math.ceil(g / x.unit)} ${x.unitName}` : `${x.n}: ${g >= 1000 ? (Math.ceil(g / 100) / 10).toString().replace('.', ',') + ' кг' : Math.ceil(g / 10) * 10 + ' г'}`);
  }
  return groups;
}

export const QUICK_OPTIONS = [
  'Столовая: порция белка (курица, говядина, рыба) + гарнир половина тарелки овощей + четверть крупы. Без мучного и сладких напитков.',
  'Магазин у работы: кефир 500 мл + 2 яйца варёных + банан (около 550 ккал, белок 30 г).',
  'Если ужин поздно и сил нет: творог 200 г + огурец + хлеб 1 ломтик (около 350 ккал).',
  'Доставка: шашлык из курицы или говядины + салат без майонеза, лепёшку пополам.'
];
