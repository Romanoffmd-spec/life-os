// Лёгкие SVG-графики без зависимостей. Цвета берутся из CSS-переменных темы.
import { esc, num } from './util.js';

function getW() { const w = globalThis.innerWidth || 1200; return w < 641 ? 360 : w < 1100 ? 520 : 640; }

function scale(d0, d1, r0, r1) { const k = d1 === d0 ? 0 : (r1 - r0) / (d1 - d0); return v => r0 + (v - d0) * k; }
function niceRange(min, max, pad = 0.08) {
  if (min === max) { min -= 1; max += 1; }
  const p = (max - min) * pad; return [min - p, max + p];
}
function ticks(min, max, n = 4) {
  const step = (max - min) / n; const out = [];
  for (let i = 0; i <= n; i++) out.push(min + step * i);
  return out;
}

/**
 * Линейный график. series: [{ values:[number|null], color, dots?, width?, dash?, label }]
 * labels: подписи по X (строки), showEvery: шаг подписей
 */
export function line({ labels, series, height = 200, yFmt = v => num(v, 1), band = null, refLine = null, showEvery }) {
  const W = getW(), H = height, L = 40, R = 10, T = 10, B = 24;
  const all = series.flatMap(s => s.values).filter(v => v != null && isFinite(v));
  if (refLine != null) all.push(refLine);
  if (!all.length) return empty(height);
  const [y0, y1] = niceRange(Math.min(...all), Math.max(...all));
  const x = scale(0, Math.max(1, labels.length - 1), L, W - R), y = scale(y0, y1, H - B, T);
  const every = showEvery || Math.max(1, Math.ceil(labels.length / 7));
  let g = '';
  for (const t of ticks(y0, y1)) g += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 6}" y="${y(t) + 4}" class="ax" text-anchor="end">${esc(yFmt(t))}</text>`;
  labels.forEach((l, i) => { if (i % every === 0 || i === labels.length - 1) g += `<text x="${x(i)}" y="${H - 6}" class="ax" text-anchor="middle">${esc(l)}</text>`; });
  if (refLine != null) g += `<line x1="${L}" x2="${W - R}" y1="${y(refLine)}" y2="${y(refLine)}" class="ref"/>`;
  for (const s of series) {
    let d = '', pen = false;
    s.values.forEach((v, i) => {
      if (v == null || !isFinite(v)) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true;
    });
    if (!s.dotsOnly) g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
    if (s.dots || s.dotsOnly) s.values.forEach((v, i) => { if (v != null) g += `<circle cx="${x(i)}" cy="${y(v)}" r="${s.r || 2.5}" fill="${s.color}" opacity="${s.opacity || 0.55}"><title>${esc(labels[i])}: ${esc(yFmt(v))}</title></circle>`; });
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}

/** Столбцы, в т.ч. составные. data: [{label, parts:[{v,color,name}]}] */
export function bars({ data, height = 180, yFmt = v => num(v, 0), target = null }) {
  const W = getW(), H = height, L = 40, R = 10, T = 10, B = 24;
  const totals = data.map(d => d.parts.reduce((s, p) => s + (p.v || 0), 0));
  const max = Math.max(target || 0, ...totals, 1);
  const y = scale(0, max * 1.08, H - B, T);
  const bw = (W - L - R) / data.length;
  let g = '';
  for (const t of ticks(0, max * 1.08, 4)) g += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${L - 6}" y="${y(t) + 4}" class="ax" text-anchor="end">${esc(yFmt(t))}</text>`;
  const every = Math.max(1, Math.ceil(data.length / 10));
  data.forEach((d, i) => {
    let acc = 0; const x0 = L + i * bw + bw * 0.18, w = bw * 0.64;
    for (const p of d.parts) {
      if (!p.v) continue;
      const y1 = y(acc), y2 = y(acc + p.v);
      g += `<rect x="${x0}" y="${y2}" width="${w}" height="${Math.max(0, y1 - y2)}" fill="${p.color}" rx="2"><title>${esc(d.label)} · ${esc(p.name || '')}: ${esc(yFmt(p.v))}</title></rect>`;
      acc += p.v;
    }
    if (i % every === 0 || i === data.length - 1) g += `<text x="${x0 + w / 2}" y="${H - 6}" class="ax" text-anchor="middle">${esc(d.label)}</text>`;
  });
  if (target) g += `<line x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}" class="ref"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}

export function spark(values, { color = 'var(--accent)', height = 28, width = 96 } = {}) {
  const v = values.filter(x => x != null);
  if (v.length < 2) return '';
  const min = Math.min(...v), max = Math.max(...v);
  const x = scale(0, values.length - 1, 1, width - 1), y = scale(min, max === min ? min + 1 : max, height - 2, 2);
  let d = '', pen = false;
  values.forEach((val, i) => { if (val == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(val).toFixed(1)}`; pen = true; });
  return `<svg class="spark" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/></svg>`;
}

export function ring(frac, { size = 44, stroke = 5, color = 'var(--accent)', label = '' } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac || 0));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - f)}" style="--c:${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    ${label ? `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" class="ring-t">${esc(label)}</text>` : ''}</svg>`;
}

export function meter(frac, color = 'var(--accent)') {
  const f = Math.max(0, Math.min(1, frac || 0));
  return `<div class="meter"><i style="width:${(f * 100).toFixed(1)}%;background:${color}"></i></div>`;
}

function empty(h) { return `<div class="chart-empty" style="height:${h * 0.6}px">Недостаточно данных</div>`; }
