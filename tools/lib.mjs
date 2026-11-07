// lib.mjs: общий лист A4, план подложкой, рендер SVG → PNG 300 dpi. Все размеры листа в мм (viewBox 210×297).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

export const P = JSON.parse(readFileSync(new URL('../plan.json', import.meta.url), 'utf8'));
export const C = { ink: '#1d2430', night: '#c7dceb', day: '#f5c4b3', wet: '#cfe7e4', circ: '#ece5d8', summer: '#f2a33a', winter: '#ee6c4d', air: '#98c1d9', grey: '#9aa0a8', paper: '#ffffff' };
export const ZONE = { night: ['Ночь', C.night], day: ['День', C.day], wet: ['Мокрые', C.wet], circ: ['Коммуникации', C.circ] };
export const FONT = 'Segoe UI';
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const f1 = (x, n = 1) => x.toFixed(n).replace('.', ',');           // 16,82
export const fmtLvl = m => (m === 0 ? '±' : m > 0 ? '+' : '−') + Math.abs(m).toFixed(3).replace('.', ',');

export function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; }
export function centroid(p) {   // центр масс многоугольника
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length], c = x1 * y2 - x2 * y1; a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c; }
  return [cx / (3 * a), cy / (3 * a)];
}
export const room = name => P.rooms.find(r => r.name === name);
export const W = P.outline_mm[1][0], H = P.outline_mm[1][1], FX = P.facade_outer_x_mm;   // наружный контур и наружная грань фасада

export function text(x, y, s, o = {}) {
  const a = { size: 3, weight: 400, fill: C.ink, anchor: 'start', ...o };
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${a.size}" font-weight="${a.weight}" fill="${a.fill}" text-anchor="${a.anchor}"${a.ls ? ` letter-spacing="${a.ls}"` : ''}${a.rot ? ` transform="rotate(${a.rot} ${x} ${y})"` : ''}${a.op ? ` opacity="${a.op}"` : ''}>${esc(s)}</text>`;
}
export const poly = (pts, attrs) => `<polygon points="${pts.map(p => p.map(v => +v.toFixed(3)).join(',')).join(' ')}" ${attrs}/>`;
export const line = (a, b, attrs) => `<line x1="${+a[0].toFixed(3)}" y1="${+a[1].toFixed(3)}" x2="${+b[0].toFixed(3)}" y2="${+b[1].toFixed(3)}" ${attrs}/>`;

// Вписать план (мм) в рамку листа. Возвращает функцию перевода точки и масштаб.
export function fit(box, ext = [0, 0, FX, H]) {
  const [bx, by, bw, bh] = box, [x0, y0, x1, y1] = ext;
  const k = Math.min(bw / (x1 - x0), bh / (y1 - y0));
  const ox = bx + (bw - (x1 - x0) * k) / 2 - x0 * k, oy = by + (bh - (y1 - y0) * k) / 2 - y0 * k;
  const T = ([x, y]) => [ox + x * k, oy + y * k];
  return { k, T, Tp: pts => pts.map(T), box: [ox + x0 * k, oy + y0 * k, (x1 - x0) * k, (y1 - y0) * k] };
}

// План: заливки помещений, мебель, стены, окна, двери, подписи.
export function planLayer(F, o = {}) {
  const { fill = 'zone', labels = true, furniture = true, grey = false, labelSize = 2.6, faint = false } = o;
  let s = '';
  for (const r of P.rooms) {
    const col = fill === 'zone' ? ZONE[r.zone][1] : fill === 'none' ? 'none' : '#f4f3f0';
    s += poly(F.Tp(r.poly), `fill="${col}" stroke="none"`);
  }
  if (furniture) for (const f of P.furniture) {
    const [a, b] = F.Tp(f.rect);
    s += `<rect x="${a[0]}" y="${a[1]}" width="${b[0] - a[0]}" height="${b[1] - a[1]}" fill="none" stroke="${grey ? '#c9ccd1' : '#8c929b'}" stroke-width="0.12" rx="0.4"/>`;
  }
  const wc = grey ? '#7d838c' : C.ink;
  for (const w of P.walls) s += poly(F.Tp(w.poly), `fill="${wc}" stroke="none"`);
  // окна: проём в наружной стене, три линии от внутренней грани до наружной
  const xi = room('Спальня').poly[1][0];
  for (const w of P.windows) {
    const [a, b] = [F.T([xi, w.y0]), F.T([FX, w.y1])];
    s += `<rect x="${a[0]}" y="${a[1]}" width="${b[0] - a[0]}" height="${b[1] - a[1]}" fill="#fff" stroke="${wc}" stroke-width="0.15"/>`;
    for (const t of [.35, .5, .65]) { const x = a[0] + (b[0] - a[0]) * t; s += line([x, a[1]], [x, b[1]], `stroke="${t === .5 ? '#6aa9d6' : wc}" stroke-width="${t === .5 ? .3 : .12}"`); }
  }
  // фасадный слой снаружи (утеплитель с облицовкой) тонкой рамкой
  s += line(F.T([FX, 0]), F.T([FX, H]), `stroke="${wc}" stroke-width="0.15"`);
  // двери: проём белым; у входной и санузла полотно с дугой
  for (const d of P.doors) {
    const p = F.Tp(d.poly), xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    s += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="#fff"/>`;
    if (d.leaf) {
      const vert = (y1 - y0) > (x1 - x0), L = vert ? y1 - y0 : x1 - x0;
      if (d.name === 'входная') { const hx = x0, hy = y0; s += line([hx, hy], [hx - L * .7, hy + L * .7], `stroke="${wc}" stroke-width="0.2"`) + `<path d="M${hx - L * .7},${hy + L * .7} A${L},${L} 0 0 0 ${hx},${y1}" fill="none" stroke="${wc}" stroke-width="0.1"/>`; }
      else { const hx = x0, hy = y1; s += line([hx, hy], [hx - L * .7, hy - L * .7], `stroke="${wc}" stroke-width="0.2"`) + `<path d="M${hx},${y0} A${L},${L} 0 0 0 ${hx - L * .7},${hy - L * .7}" fill="none" stroke="${wc}" stroke-width="0.1"/>`; }
    }
  }
  if (labels) for (const r of P.rooms) {
    const [cx, cy] = F.T(r.label_at || centroid(r.poly));
    s += text(cx, cy - .4, r.name, { size: labelSize, anchor: 'middle', weight: 600, op: faint ? .45 : 1 });
    if (labels !== 'names') s += text(cx, cy + labelSize * 1.05, `${f1(r.area_m2, 2)} м²`, { size: labelSize * .9, anchor: 'middle', op: faint ? .45 : 1 });
  }
  return s;
}

// Стрелка севера: north_deg — куда смотрит север по часовой от «вверх по листу».
export function north(x, y, r = 5) {
  const a = P.north_deg;
  return `<g transform="translate(${x} ${y}) rotate(${a})"><circle r="${r}" fill="none" stroke="${C.ink}" stroke-width="0.2"/>` +
    `<polygon points="0,${-r * .85} ${r * .32},${r * .45} 0,${r * .2} ${-r * .32},${r * .45}" fill="${C.ink}"/>` +
    `<text x="0" y="${-r - 1.2}" font-family="${FONT}" font-size="2.6" font-weight="700" text-anchor="middle" fill="${C.ink}">С</text></g>`;
}

export function scaleBar(x, y, k, meters = 3) {
  let s = '';
  for (let i = 0; i < meters; i++) s += `<rect x="${x + i * 1000 * k}" y="${y}" width="${1000 * k}" height="1" fill="${i % 2 ? '#fff' : C.ink}" stroke="${C.ink}" stroke-width="0.15"/>`;
  for (let i = 0; i <= meters; i++) s += text(x + i * 1000 * k, y + 3.6, String(i), { size: 2.2, anchor: 'middle' });
  return s + text(x + meters * 1000 * k + 2, y + 1.1, 'м', { size: 2.2 });
}

// Лист A4: чертёж сверху, заголовок, подзаголовок, легенда, подвал.
export function sheet({ num, cmd, title, subtitle, body, legend = '', notes = [] }) {
  const top = `${text(15, 12, 'КВАРТИРА 48,1 М² · ЕКАТЕРИНБУРГ', { size: 2.3, fill: '#6b7280', ls: .5 })}${text(195, 12, `${num} / 06`, { size: 2.3, fill: '#6b7280', anchor: 'end' })}${line([15, 14], [195, 14], 'stroke="#d0d3d8" stroke-width="0.2"')}`;
  const ty = 218;
  const head = `${line([15, ty - 6], [195, ty - 6], `stroke="${C.ink}" stroke-width="0.35"`)}${text(15, ty, title, { size: 6.4, weight: 700 })}${text(15, ty + 6, subtitle, { size: 3, fill: '#4b5563' })}`;
  const nt = notes.map((n, i) => text(15, 276 + i * 3.6, n, { size: 2.25, fill: '#4b5563' })).join('');
  const foot = `${line([15, 285], [195, 285], 'stroke="#d0d3d8" stroke-width="0.2"')}${text(15, 289, `${cmd} · нарисовано кодом из plan.json · разбор чертежа, не строительная экспертиза`, { size: 2.2, fill: '#6b7280' })}${text(195, 289, 'ai_soidet', { size: 2.2, fill: '#6b7280', anchor: 'end' })}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297"><rect width="210" height="297" fill="#fff"/>${top}${body}${head}<g transform="translate(0 ${ty + 12})">${legend}</g>${nt}${foot}</svg>`;
}

export function legendRow(x, y, col, label, value, o = {}) {
  return `<rect x="${x}" y="${y - 2.6}" width="5" height="3.2" fill="${col}" stroke="${o.stroke || 'none'}" stroke-width="0.15" ${o.dash ? 'stroke-dasharray="1 .6"' : ''}/>${text(x + 7, y, label, { size: 2.8 })}${value != null ? text(x + (o.w || 80), y, value, { size: 2.8, weight: 600, anchor: 'end' }) : ''}`;
}

export function render(name, svg, width = 2480) {
  mkdirSync(new URL('../out/', import.meta.url), { recursive: true });
  writeFileSync(new URL(`../out/${name}.svg`, import.meta.url), svg);
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true, defaultFontFamily: FONT } }).render().asPng();
  writeFileSync(new URL(`../out/${name}.png`, import.meta.url), png);
  console.log(`out/${name}.png`);
}

export const zoneTotals = () => { const t = {}; for (const r of P.rooms) t[r.zone] = (t[r.zone] || 0) + r.area_m2; return t; };
export const netArea = () => P.rooms.reduce((s, r) => s + r.area_m2, 0);

// Плашка уровня знания: НОРМА (с пунктом), ПРАКТИКА (эвристика), ПО ЧЕРТЕЖУ (геометрия), НЕ ПРОВЕРЕНО, ВОПРОС.
export const LEVEL = { 'НОРМА': ['#1d2430', '#fff'], 'ПРАКТИКА': ['#90e0ff', '#1d2430'], 'ПО ЧЕРТЕЖУ': ['#fff', '#1d2430'], 'НЕ ПРОВЕРЕНО': ['#ff90e8', '#1d2430'], 'ВОПРОС': ['#facc00', '#1d2430'] };
export function chip(x, y, lv) {
  const w = lv.length * 1.45 + 3, [bg, fg] = LEVEL[lv];
  return `<rect x="${x}" y="${y - 2.7}" width="${w}" height="3.6" rx="0.8" fill="${bg}" stroke="#1d2430" stroke-width="0.25"/>` + text(x + w / 2, y, lv, { size: 2, weight: 700, fill: fg, anchor: 'middle' });
}
export function levelRow(y, lv, t, value) {   // строка легенды: плашка, текст, значение справа
  return chip(15, y, lv) + text(39, y, t, { size: 2.6 }) + (value != null ? text(195, y, value, { size: 2.7, weight: 700, anchor: 'end' }) : '');
}
export const CHECKS = (() => { try { return JSON.parse(readFileSync(new URL('../out/checks.json', import.meta.url), 'utf8')); } catch { return null; } })();
