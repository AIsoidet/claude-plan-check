// lib.mjs: общий лист A4, план подложкой, рендер SVG → PNG 300 dpi. Все размеры листа в мм (viewBox 210×297).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

export const P = JSON.parse(readFileSync(new URL('../plan.json', import.meta.url), 'utf8'));
export const C = { ink: '#1d2430', night: '#c7dceb', day: '#f5c4b3', wet: '#cfe7e4', circ: '#ece5d8', summer: '#f2a33a', winter: '#ee6c4d', air: '#98c1d9', grey: '#9aa0a8', paper: '#ffffff' };
export const ZONE = { night: ['Ночь', C.night], day: ['День', C.day], wet: ['Мокрые', C.wet], circ: ['Коммуникации', C.circ], loggia: ['Лоджия', '#dcebc4'] };
export const MAIN_ZONES = ['night', 'day', 'wet', 'circ'];   // зоны полезной площади; лоджия считается отдельно
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
export const W = Math.max(...P.outline.map(p => p[0])), H = Math.max(...P.outline.map(p => p[1])), FX = W;   // габарит наружного контура, мм
export const TITLE = `КВАРТИРА ${P.title.toUpperCase()} · ${f1(P.total_label_m2)} М²`;
export const TOTAL = 4;                      // листов в серии
export const winBox = w => [Math.min(w.p0[0], w.p1[0]), Math.min(w.p0[1], w.p1[1]), Math.max(w.p0[0], w.p1[0]), Math.max(w.p0[1], w.p1[1])];

export function text(x, y, s, o = {}) {
  const a = { size: 3, weight: 400, fill: C.ink, anchor: 'start', ...o };
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${a.size}" font-weight="${a.weight}" fill="${a.fill}" text-anchor="${a.anchor}"${a.ls ? ` letter-spacing="${a.ls}"` : ''}${a.rot ? ` transform="rotate(${a.rot} ${x} ${y})"` : ''}${a.op ? ` opacity="${a.op}"` : ''}>${esc(s)}</text>`;
}
export const poly = (pts, attrs) => `<polygon points="${pts.map(p => p.map(v => +v.toFixed(3)).join(',')).join(' ')}" ${attrs}/>`;
export const line = (a, b, attrs) => `<line x1="${+a[0].toFixed(3)}" y1="${+a[1].toFixed(3)}" x2="${+b[0].toFixed(3)}" y2="${+b[1].toFixed(3)}" ${attrs}/>`;

// Вписать план (мм) в рамку листа. Возвращает функцию перевода точки и масштаб.
export function fit(box, ext = [0, 0, W, H]) {
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
  if (furniture) for (const f of P.furniture) s += poly(F.Tp(f.poly), `fill="none" stroke="${grey ? '#c9ccd1' : '#8c929b'}" stroke-width="0.12" stroke-linejoin="round"`);
  const wc = grey ? '#7d838c' : C.ink;
  for (const w of P.walls) s += poly(F.Tp(w.poly), `fill="${wc}" stroke="none"`);
  // окна: проём в наружной стене, три линии вдоль стены
  for (const w of P.windows) {
    const [x0, y0, x1, y1] = winBox(w), [a, b] = [F.T([x0, y0]), F.T([x1, y1])], horiz = (x1 - x0) >= (y1 - y0);
    s += `<rect x="${a[0]}" y="${a[1]}" width="${b[0] - a[0]}" height="${b[1] - a[1]}" fill="#fff" stroke="${wc}" stroke-width="0.15"/>`;
    for (const t of [.35, .5, .65]) { const col = t === .5 ? '#6aa9d6' : wc, sw = t === .5 ? .3 : .12;
      s += horiz ? line([a[0], a[1] + (b[1] - a[1]) * t], [b[0], a[1] + (b[1] - a[1]) * t], `stroke="${col}" stroke-width="${sw}"`) : line([a[0] + (b[0] - a[0]) * t, a[1]], [a[0] + (b[0] - a[0]) * t, b[1]], `stroke="${col}" stroke-width="${sw}"`); }
  }
  if (P.loggia_glass) { const g = P.loggia_glass; s += line(F.T(g.p0), F.T(g.p1), `stroke="#6aa9d6" stroke-width="0.6"`) + line(F.T([g.p0[0], g.p0[1] + 90]), F.T([g.p1[0], g.p1[1] + 90]), `stroke="${wc}" stroke-width="0.15"`); }
  // двери: полотно в открытом положении (90°) и дуга
  for (const d of P.doors) {
    if (!d.leaf) continue;
    const A = F.T(d.a), B = F.T(d.b), Hh = d.hinge === 'a' ? A : B, Fr = d.hinge === 'a' ? B : A, w = Math.hypot(A[0] - B[0], A[1] - B[1]);
    const O = [Hh[0] + d.n[0] * w, Hh[1] + d.n[1] * w], u = [Fr[0] - Hh[0], Fr[1] - Hh[1]], v = [O[0] - Hh[0], O[1] - Hh[1]], sw = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
    s += line(Hh, O, `stroke="${wc}" stroke-width="0.25"`) + `<path d="M${Fr[0].toFixed(3)},${Fr[1].toFixed(3)} A${w.toFixed(3)},${w.toFixed(3)} 0 0 ${sw} ${O[0].toFixed(3)},${O[1].toFixed(3)}" fill="none" stroke="${wc}" stroke-width="0.1"/>`;
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
  if (a == null) return '';
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
let LAST_BODY = null;   // сам чертёж листа без шапки и легенды: render() кладёт его рядом как <name>.body.svg
export function sheet({ num, cmd, title, subtitle, body, legend = '', notes = [] }) {
  LAST_BODY = body;
  const top = `${text(15, 12, TITLE, { size: 2.3, fill: '#6b7280', ls: .5 })}${text(195, 12, `${num} / 0${TOTAL}`, { size: 2.3, fill: '#6b7280', anchor: 'end' })}${line([15, 14], [195, 14], 'stroke="#d0d3d8" stroke-width="0.2"')}`;
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
  if (LAST_BODY) { writeFileSync(new URL(`../out/${name}.body.svg`, import.meta.url), LAST_BODY); LAST_BODY = null; }
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true, defaultFontFamily: FONT } }).render().asPng();
  writeFileSync(new URL(`../out/${name}.png`, import.meta.url), png);
  console.log(`out/${name}.png`);
}

export const zoneTotals = () => { const t = {}; for (const r of P.rooms) t[r.zone] = (t[r.zone] || 0) + r.area_m2; return t; };
export const netArea = () => P.rooms.filter(r => r.zone !== 'loggia').reduce((s, r) => s + r.area_m2, 0);   // без лоджии

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

// Рамка содержимого SVG-фрагмента (полигоны, линии, круги, прямоугольники, текст без поворота, пути без дуг).
export function bboxOf(svg) {
  const xs = [], ys = [], add = (x, y) => { if (Number.isFinite(x) && Number.isFinite(y)) { xs.push(x); ys.push(y); } };
  for (const m of svg.matchAll(/points="([^"]+)"/g)) { const v = m[1].trim().split(/[\s,]+/).map(Number); for (let i = 0; i + 1 < v.length; i += 2) add(v[i], v[i + 1]); }
  for (const m of svg.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g)) { add(+m[1], +m[2]); add(+m[3], +m[4]); }
  for (const m of svg.matchAll(/<circle cx="([-\d.]+)" cy="([-\d.]+)" r="([-\d.]+)"/g)) { add(+m[1] - +m[3], +m[2] - +m[3]); add(+m[1] + +m[3], +m[2] + +m[3]); }
  for (const m of svg.matchAll(/<rect x="([-\d.]+)" y="([-\d.]+)" width="([-\d.]+)" height="([-\d.]+)"/g)) { add(+m[1], +m[2]); add(+m[1] + +m[3], +m[2] + +m[4]); }
  for (const m of svg.matchAll(/<path d="([^"]+)"/g)) { if (/[Aa]/.test(m[1])) continue; const v = m[1].match(/-?\d+\.?\d*/g)?.map(Number) || []; for (let i = 0; i + 1 < v.length; i += 2) add(v[i], v[i + 1]); }
  for (const m of svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"([^>]*)>([^<]*)<\/text>/g)) {
    if (/rotate\(/.test(m[3])) continue;
    const size = +(m[3].match(/font-size="([\d.]+)"/)?.[1] || 3), w = m[4].length * size * 0.56, anchor = m[3].match(/text-anchor="(\w+)"/)?.[1] || 'start', x = +m[1], y = +m[2];
    const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x; add(x0, y - size); add(x0 + w, y + size * 0.3);
  }
  return xs.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null;
}
