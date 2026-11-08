// /axo: аксонометрия «в разлёте». Ортогональная проекция, план повёрнут на TH, взгляд сверху под EL.
// Стены, окна и перекрытие строятся из многоугольников plan.json, видимость граней по нормали ребра.
import { P, C, ZONE, sheet, render, text, f1, line, poly, zoneTotals, netArea, winBox } from './lib.mjs';

const CEIL = P.ceiling_m * 1000, SLAB = P.slab_mm, SILL = P.sill_mm, HEAD = P.head_mm;
const TH = 38 * Math.PI / 180, EL = 36 * Math.PI / 180, ct = Math.cos(TH), st = Math.sin(TH);
const LIFT = 3600, ZW = LIFT, ZTOP = ZW + CEIL;                       // где стоят стены; перекрытие не рисуем, оно закрывает стены
const pr = ([x, y, z]) => [x * ct - y * st, (x * st + y * ct) * Math.sin(EL) - z * Math.cos(EL)];
const depth = (x, y) => x * st + y * ct;                              // больше = ближе к зрителю
const sgnArea = p => { let a = 0; for (let i = 0; i < p.length; i++) { const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]; a += x1 * y2 - x2 * y1; } return a; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

// ---- призмы: стены, подоконные и надоконные части; длинные режем на куски ≤500 мм вдоль длинной оси
const items = [];
function addPrism(pts, z0, z1, kind) {   // pts: четырёхугольник
  const [p0, p1, p2, p3] = pts, l01 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l12 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  const n = Math.max(1, Math.ceil(Math.max(l01, l12) / 500));
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const q = l01 >= l12 ? [lerp(p0, p1, t0), lerp(p0, p1, t1), lerp(p3, p2, t1), lerp(p3, p2, t0)] : [lerp(p0, p3, t0), lerp(p1, p2, t0), lerp(p1, p2, t1), lerp(p0, p3, t1)];
    const c = q.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4], [0, 0]);
    items.push({ pts: q, z0, z1, kind, d: depth(c[0], c[1]) });
  }
}
const addGlass = (a, b, z0, z1, op = 0.85) => { const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; items.push({ glass: [a, b], z0, z1, op, kind: 'glass', d: depth(m[0], m[1]) + 1 }); };

for (const w of P.walls) addPrism(w.poly, ZW, ZW + CEIL, w.kind);
for (const w of P.windows) {
  const [x0, y0, x1, y1] = winBox(w), box = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], horiz = (x1 - x0) >= (y1 - y0);
  addPrism(box, ZW, ZW + SILL, 'ext'); addPrism(box, ZW + HEAD, ZW + CEIL, 'ext');
  addGlass(horiz ? [x0, (y0 + y1) / 2] : [(x0 + x1) / 2, y0], horiz ? [x1, (y0 + y1) / 2] : [(x0 + x1) / 2, y1], ZW + SILL, ZW + HEAD);
}
if (P.loggia_glass) addGlass(P.loggia_glass.p0, P.loggia_glass.p1, ZW, ZW + CEIL, 0.4);   // панорамное остекление лоджии в полную высоту
items.sort((a, b) => a.d - b.d || a.z0 - b.z0);

// ---- вписать в лист
const OUT = P.outline, ox = OUT.map(p => p[0]), oy = OUT.map(p => p[1]);
const all = [];
for (const [x, y] of OUT) { all.push(pr([x, y, -SLAB]), pr([x, y, ZTOP])); }
const [mnx, mxx] = [Math.min(...all.map(p => p[0])), Math.max(...all.map(p => p[0]))], [mny, mxy] = [Math.min(...all.map(p => p[1])), Math.max(...all.map(p => p[1]))];
const BX = [52, 20, 144, 186], K = Math.min(BX[2] / (mxx - mnx), BX[3] / (mxy - mny));
const T = p => { const [u, v] = pr(p); return [BX[0] + (BX[2] - (mxx - mnx) * K) / 2 + (u - mnx) * K, BX[1] + (BX[3] - (mxy - mny) * K) / 2 + (v - mny) * K]; };
const face = (pts, fill, extra = '') => poly(pts.map(T), `fill="${fill}" ${extra.includes('stroke="') ? '' : `stroke="${C.ink}"`} stroke-width="0.08" stroke-linejoin="round" ${extra}`);

// видимые рёбра многоугольника: [a, b, нормаль]
function visibleEdges(pts) {
  const s = sgnArea(pts), res = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const n = s > 0 ? [dy / L, -dx / L] : [-dy / L, dx / L];
    if (n[0] * st + n[1] * ct > 1e-6) res.push([a, b, n]);
  }
  return res;
}
const sideQuad = (a, b, z0, z1) => [[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]];
const tone = (n, pair) => (n[1] * ct + n[0] * st) > 0.75 || Math.abs(n[1]) > Math.abs(n[0]) ? pair[0] : pair[1];

let body = '';
// 1. пол: плита по контуру, помещения цветом зон, мебель контуром
for (const [a, b, n] of visibleEdges(OUT).sort((e, f) => depth((e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2) - depth((f[0][0] + f[1][0]) / 2, (f[0][1] + f[1][1]) / 2)))
  body += face(sideQuad(a, b, -SLAB, 0), tone(n, ['#d5d8de', '#c3c8d0']));
body += face(OUT.map(p => [p[0], p[1], 0]), '#f4f3f0');
for (const r of P.rooms) body += poly(r.poly.map(p => T([p[0], p[1], 0])), `fill="${ZONE[r.zone][1]}" stroke="${C.ink}" stroke-width="0.06"`);
for (const f of P.furniture) body += poly(f.poly.map(p => T([p[0], p[1], 0])), `fill="none" stroke="#7d838c" stroke-width="0.07" stroke-linejoin="round"`);
for (const w of P.walls) body += poly(w.poly.map(p => T([p[0], p[1], 0])), `fill="#8c929b" stroke="none"`);
// направляющие по наружным углам от пола до низа стен
for (const [x, y] of OUT) body += line(T([x, y, 0]), T([x, y, ZW]), `stroke="#9aa0a8" stroke-width="0.12" stroke-dasharray="1 .8"`);
// 2. стены: видимые боковые грани и верх; стекло голубым
for (const it of items) {
  if (it.glass) { const [a, b] = it.glass; body += face(sideQuad(a, b, it.z0, it.z1), '#bfe0f5', `opacity="${it.op}"`); continue; }
  const side = it.kind === 'part' || it.kind === 'col' ? ['#e4e7ec', '#cfd4dc'] : ['#d2d6dd', '#b7bdc7'];
  for (const [a, b, n] of visibleEdges(it.pts)) body += face(sideQuad(a, b, it.z0, it.z1), tone(n, side), 'stroke-opacity="0.06"');
  body += face(it.pts.map(p => [p[0], p[1], it.z1]), C.ink, 'stroke="none"');
}
// подписи слоёв слева: у самой левой точки контура
const lp = OUT.reduce((m, p) => (p[0] * ct - p[1] * st < m[0] * ct - m[1] * st ? p : m), OUT[0]);
const tag = (z, ...ls) => { const [x, y] = T([lp[0], lp[1], z]); return line([x - 2, y], [17, y], 'stroke="#9aa0a8" stroke-width="0.12"') + text(15, y - 1.2, ls[0], { size: 2.8, weight: 700, ls: .3 }) + ls.slice(1).map((t, i) => text(15, y + 2.6 + i * 3, t, { size: 2.1, fill: '#4b5563' })).join(''); };
body += tag(ZW + CEIL / 2, 'СТЕНЫ', `высота ${f1(CEIL / 1000, 2)} м`, 'толщина по картинке') + tag(0, 'ПОЛ', `полезная ${f1(netArea(), 1)} м²`, 'без лоджии');

const tot = zoneTotals();
let legend = '';
Object.entries(ZONE).forEach(([z, [n, c]], i) => { const x = 15 + (i % 2) * 92, y = Math.floor(i / 2) * 5.5; legend += `<rect x="${x}" y="${y - 2.6}" width="5" height="3.2" fill="${c}" stroke="${C.ink}" stroke-width="0.1"/>` + text(x + 7, y, n, { size: 2.8 }) + text(x + 85, y, `${f1(tot[z], 1)} м²`, { size: 2.8, weight: 700, anchor: 'end' }); });
legend += `<rect x="15" y="13.4" width="5" height="3.2" fill="#bfe0f5" stroke="${C.ink}" stroke-width="0.1"/>` + text(22, 16, `Окна: ${P.windows.length} и панорамное остекление лоджии · подоконник +0,800 и перемычка +2,400 приняты`, { size: 2.8 });
const notes = [
  `Ортогональная проекция: план повёрнут на 38°, взгляд сверху под 36°. Стены подняты над полом на ${f1(LIFT / 1000, 1)} м, перекрытие не показано, чтобы видеть стены и пол целиком.`,
  'Геометрия обведена с растровой картинки ЖК, масштаб приближённый (≈19,6 мм/пк). Стороны света на плане нет. Высота лоджии и остекления принята.',
  'Перемычки над дверными проёмами не показаны: их высоты на плане нет.',
];
render('01-axo', sheet({ num: '01', cmd: '/axo', title: 'Аксонометрия в разлёте', subtitle: 'Пол с зонами и стены на полную высоту над ним.', body, legend, notes }));
