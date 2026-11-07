// /flow: три бытовых маршрута, найденные A* по сетке 50 мм через двери, длины в метрах по итоговому пути.
import { P, C, sheet, render, fit, planLayer, north, scaleBar, text, f1, line, levelRow } from './lib.mjs';
import { EXTRA, narrowest } from './measure.mjs';

const G = 50, BODY = 360, R = BODY / 2;
const XMAX = 6170, YMAX = 9180, NX = Math.ceil(XMAX / G), NY = Math.ceil(YMAX / G);
const blocked = new Uint8Array(NX * NY);
const rects = [];
for (const w of P.walls) { const xs = w.poly.map(p => p[0]), ys = w.poly.map(p => p[1]); rects.push([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]); }
for (const f of P.furniture) rects.push([f.rect[0][0], f.rect[0][1], f.rect[1][0], f.rect[1][1]]);
// раковина, стиральная машина, мойка с посудомойкой, кухонная колонна: в векторных слоях мелкие или в слое электрооборудования
rects.push(...EXTRA.map(e => e.slice(0, 4)));
// снаружи квартиры: всё левее наружной стены у входа и правее внутренней грани фасада закрыто сеткой
for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
  const x = i * G + G / 2, y = j * G + G / 2;
  if (rects.some(([a, b, c, d]) => x > a - R && x < c + R && y > b - R && y < d + R)) blocked[j * NX + i] = 1;
}
const cell = ([x, y]) => [Math.floor(x / G), Math.floor(y / G)];
const free = (i, j) => i >= 0 && j >= 0 && i < NX && j < NY && !blocked[j * NX + i];
function snap(p) {   // ближайшая свободная клетка к точке остановки
  const [ci, cj] = cell(p);
  for (let r = 0; r < 40; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (Math.max(Math.abs(di), Math.abs(dj)) === r && free(ci + di, cj + dj)) return [ci + di, cj + dj];
  throw new Error('нет свободной клетки рядом с ' + p);
}
function astar(a, b) {
  const [si, sj] = snap(a), [ti, tj] = snap(b), N = NX * NY;
  const g = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), open = new Set(), fsc = new Float64Array(N).fill(Infinity);
  const id = (i, j) => j * NX + i, h = (i, j) => Math.hypot(i - ti, j - tj);
  g[id(si, sj)] = 0; fsc[id(si, sj)] = h(si, sj); open.add(id(si, sj));
  while (open.size) {
    let cur = -1, best = Infinity; for (const k of open) if (fsc[k] < best) { best = fsc[k]; cur = k; }
    const ci = cur % NX, cj = (cur / NX) | 0;
    if (ci === ti && cj === tj) break;
    open.delete(cur);
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ni = ci + di, nj = cj + dj; if (!free(ni, nj)) continue;
      if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue;
      const k = id(ni, nj), ng = g[cur] + Math.hypot(di, dj);
      if (ng < g[k]) { g[k] = ng; from[k] = cur; fsc[k] = ng + h(ni, nj); open.add(k); }
    }
  }
  const path = []; let k = id(ti, tj); if (from[k] < 0 && k !== id(si, sj)) throw new Error('путь не найден');
  while (k >= 0) { path.push([(k % NX) * G + G / 2, ((k / NX) | 0) * G + G / 2]); k = from[k]; }
  return path.reverse();
}
function sight(a, b) {   // прямая видимость по сетке
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (G / 3));
  for (let t = 0; t <= n; t++) { const [i, j] = cell([a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n]); if (!free(i, j)) return false; }
  return true;
}
function straighten(p) { const out = [p[0]]; let i = 0; while (i < p.length - 1) { let j = p.length - 1; while (j > i + 1 && !sight(p[i], p[j])) j--; out.push(p[j]); i = j; } return out; }
const len = p => p.reduce((s, q, i) => i ? s + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0);

const S = {
  bed: [3300, 1700], basin: [1080, 4380], sink: [1150, 6850], entry: [420, 1500], wc: [1530, 4720], sofa: [3250, 8400], col: [1000, 6900],
};
const routes = [
  { name: 'Утро', col: C.winter, stops: [['кровать', S.bed], ['раковина', S.basin], ['кухонная мойка', S.sink]], note: 'кровать → раковина → кухонная мойка' },
  { name: 'Гость', col: '#3d6fb6', stops: [['входная дверь', S.entry], ['унитаз', S.wc], ['диван', S.sofa]], note: 'вход → санузел → диван' },
  { name: 'Покупки', col: '#5a8f4a', stops: [['входная дверь', S.entry], ['кухонная колонна', S.col]], note: 'вход → угловая колонна кухни (холодильника на плане нет)' },
];
for (const r of routes) {
  let pts = [];
  for (let i = 1; i < r.stops.length; i++) { const seg = straighten(astar(r.stops[i - 1][1], r.stops[i][1])); pts = pts.concat(i > 1 ? seg.slice(1) : seg); }
  r.path = pts; r.m = len(pts) / 1000;
}

const F = fit([20, 20, 170, 165]);
let body = planLayer(F, { fill: 'grey', grey: true, labels: 'names', faint: true, labelSize: 2.6 });
// путь со скруглёнными углами: квадратичные кривые через середины отрезков
const smooth = pts => { const q = F.Tp(pts); let d = `M${q[0][0]},${q[0][1]}`; for (let i = 1; i < q.length - 1; i++) { const m = [(q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2]; d += ` L${(q[i - 1][0] + q[i][0]) / 2 * 0 + (q[i][0] * .7 + q[i - 1][0] * .3)},${q[i][1] * .7 + q[i - 1][1] * .3} Q${q[i][0]},${q[i][1]} ${q[i][0] * .7 + q[i + 1][0] * .3},${q[i][1] * .7 + q[i + 1][1] * .3}`; } const l = q[q.length - 1]; return d + ` L${l[0]},${l[1]}`; };
routes.forEach((r, ri) => {
  const off = (ri - 1) * 1.2;   // маршруты чуть разведены, чтобы не слипались на общих участках
  body += `<g transform="translate(${off} ${off})"><path d="${smooth(r.path)}" fill="none" stroke="${r.col}" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>`;
  r.stops.forEach(([nm, p], i) => { const [x, y] = F.T(p); body += `<circle cx="${x}" cy="${y}" r="2.1" fill="#fff" stroke="${r.col}" stroke-width="0.6"/>` + text(x, y + 1, String(i + 1), { size: 2.6, weight: 700, anchor: 'middle', fill: r.col }); });
  body += '</g>';
});
// самый узкий проход на каждом маршруте (без дверных проёмов): отрезок поперёк пути
for (const r of routes) {
  r.nw = narrowest(r.path, r.stops.map(s => s[1]));
  const w = r.nw, A = F.T([w.x - w.nx * w.r, w.y - w.ny * w.r]), B = F.T([w.x + w.nx * w.l, w.y + w.ny * w.l]);
  body += line(A, B, `stroke="#d10b5b" stroke-width="0.7"`) + `<circle cx="${A[0]}" cy="${A[1]}" r="0.6" fill="#d10b5b"/><circle cx="${B[0]}" cy="${B[1]}" r="0.6" fill="#d10b5b"/>`;
}
{ const seen = new Set(); for (const r of routes) { const k = `${Math.round(r.nw.x)},${Math.round(r.nw.y)}`; if (seen.has(k)) continue; seen.add(k); const [x, y] = F.T([r.nw.x, r.nw.y]); body += text(x + 3, y - 1.5, `${f1(r.nw.w / 1000, 2)} м`, { size: 2.6, weight: 700, fill: '#d10b5b' }); } }
body += north(186, 28);
routes.forEach((r, i) => {
  const x = 20 + i * 60;
  body += line([x, 191], [x + 52, 191], `stroke="${r.col}" stroke-width="0.8"`) + text(x, 201, `${f1(r.m, 2)} м`, { size: 8, weight: 700, fill: r.col }) + text(x, 206, r.name, { size: 3, weight: 700 }) + text(x, 210, r.note.split(' (')[0], { size: 2.3, fill: '#4b5563' });
});
let legend = '';
routes.forEach((r, i) => { legend += line([15, i * 5.5], [22, i * 5.5], `stroke="${r.col}" stroke-width="0.9"`) + text(25, i * 5.5 + 1, `${r.name}: ${r.note.split(' (')[0]} · самый узкий проход ${f1(r.nw.w / 1000, 2)} м`, { size: 2.7 }) + text(195, i * 5.5 + 1, `${f1(r.m, 2)} м`, { size: 2.8, weight: 700, anchor: 'end' }); });
legend += `<rect x="15" y="16.5" width="7" height="3" fill="#7d838c"/>` + text(25, 19, 'Стены, мебель и сантехника непроходимы; двери открыты', { size: 2.8 });
legend += levelRow(25, 'ПО ЧЕРТЕЖУ', 'Красным: самое узкое место на маршруте, не считая дверных проёмов') + levelRow(29.6, 'НЕ ПРОВЕРЕНО', 'Холодильника на плане нет: маршрут «Покупки» до угловой кухонной колонны');
const notes = [
  `Поиск пути A* по сетке ${G} мм, ширина человека ${BODY} мм (препятствия раздуты на ${R} мм). Путь выпрямлен по прямой видимости, длина измерена по итоговой ломаной.`,
  'Раковина и стиральная машина в санузле сняты с картинки плана: в векторных слоях они мельче порога 250 мм. Холодильник на плане не показан.',
];
render('03-flow', sheet({ num: '03', cmd: '/flow', title: 'Схема движения', subtitle: 'Три бытовых маршрута через двери, длина посчитана, а не на глаз.', body, legend, notes }));
console.log(routes.map(r => `${r.name} ${r.m.toFixed(2)} м`).join(' · '));
import { writeFileSync as _w } from 'node:fs';
_w(new URL('../out/routes.json', import.meta.url), JSON.stringify(routes.map(r => ({ name: r.name, m: r.m, path: r.path, stops: r.stops, col: r.col })), null, 1));
