// /axo: аксонометрия «в разлёте». Ортогональная проекция, план повёрнут на TH, взгляд сверху под EL.
import { P, C, ZONE, sheet, render, text, f1, line, poly, zoneTotals, netArea, W, H } from './lib.mjs';
import { XI, XO, CEIL, SLAB, SILL, HEAD } from './section_base.mjs';

const TH = 38 * Math.PI / 180, EL = 36 * Math.PI / 180, ct = Math.cos(TH), st = Math.sin(TH);
const LIFT = 3600, ZW = LIFT, ZTOP = ZW + CEIL;                       // где стоят стены; перекрытие не рисуем, оно закрывает стены
const pr = ([x, y, z]) => [x * ct - y * st, (x * st + y * ct) * Math.sin(EL) - z * Math.cos(EL)];
const depth = (x, y) => x * st + y * ct;                              // больше = ближе к зрителю

// боксы стен: наружные стены, пилоны, перегородки; в оконных проёмах подоконная часть и перемычка; стекло
const boxes = [];
const add = (x0, y0, x1, y1, z0, z1, kind) => {   // длинные режем на куски по 500 мм, чтобы порядок отрисовки был верным
  const n = Math.max(1, Math.ceil(Math.max(x1 - x0, y1 - y0) / 500)), along = (x1 - x0) >= (y1 - y0);
  for (let i = 0; i < n; i++) {
    const a = along ? [x0 + (x1 - x0) * i / n, y0, x0 + (x1 - x0) * (i + 1) / n, y1] : [x0, y0 + (y1 - y0) * i / n, x1, y0 + (y1 - y0) * (i + 1) / n];
    boxes.push({ b: a, z0, z1, kind });
  }
};
for (const w of P.walls) { const xs = w.poly.map(p => p[0]), ys = w.poly.map(p => p[1]); add(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), ZW, ZW + CEIL, w.kind); }
for (const w of P.windows) { add(XI, w.y0, XO, w.y1, ZW, ZW + SILL, 'ext'); add(XI, w.y0, XO, w.y1, ZW + HEAD, ZW + CEIL, 'ext'); add(XO - 70, w.y0, XO - 40, w.y1, ZW + SILL, ZW + HEAD, 'glass'); }
boxes.sort((a, b) => depth((a.b[0] + a.b[2]) / 2, (a.b[1] + a.b[3]) / 2) - depth((b.b[0] + b.b[2]) / 2, (b.b[1] + b.b[3]) / 2));

// вписать в лист
const all = [[0, 0, -SLAB], [W, 0, -SLAB], [0, H, -SLAB], [W, H, -SLAB], [0, 0, ZTOP], [W, 0, ZTOP], [0, H, ZTOP], [W, H, ZTOP]].map(pr);
const [mnx, mxx] = [Math.min(...all.map(p => p[0])), Math.max(...all.map(p => p[0]))], [mny, mxy] = [Math.min(...all.map(p => p[1])), Math.max(...all.map(p => p[1]))];
const BX = [42, 20, 150, 186], K = Math.min(BX[2] / (mxx - mnx), BX[3] / (mxy - mny));
const T = p => { const [u, v] = pr(p); return [BX[0] + (BX[2] - (mxx - mnx) * K) / 2 + (u - mnx) * K, BX[1] + (BX[3] - (mxy - mny) * K) / 2 + (v - mny) * K]; };   // по центру рамки и по горизонтали, и по вертикали
const face = (pts, fill, extra = '') => poly(pts.map(T), `fill="${fill}" ${extra.includes('stroke="') ? '' : `stroke="${C.ink}"`} stroke-width="0.08" stroke-linejoin="round" ${extra}`);
function slab(z0, z1, top, sideY, sideX) {   // плита по наружному контуру: верх и две видимые грани
  return face([[0, H, z0], [W, H, z0], [W, H, z1], [0, H, z1]], sideY) + face([[W, 0, z0], [W, H, z0], [W, H, z1], [W, 0, z1]], sideX) + face([[0, 0, z1], [W, 0, z1], [W, H, z1], [0, H, z1]], top);
}
let body = '';
// 1. пол: плита, помещения цветом зон, мебель контуром
body += slab(-SLAB, 0, '#f4f3f0', '#d5d8de', '#c3c8d0');
for (const r of P.rooms) body += poly(r.poly.map(p => T([p[0], p[1], 0])), `fill="${ZONE[r.zone][1]}" stroke="${C.ink}" stroke-width="0.06"`);
for (const f of P.furniture) { const [[a, b], [c, d]] = f.rect; body += poly([[a, b], [c, b], [c, d], [a, d]].map(p => T([p[0], p[1], 0])), `fill="none" stroke="#7d838c" stroke-width="0.07"`); }
for (const w of P.walls) body += poly(w.poly.map(p => T([p[0], p[1], 0])), `fill="#8c929b" stroke="none"`);
// направляющие по наружным углам от пола до низа стен
for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) body += line(T([x, y, 0]), T([x, y, ZW]), `stroke="#9aa0a8" stroke-width="0.12" stroke-dasharray="1 .8"`);
// 2. стены: видимые грани +y, +x и верх; стекло голубым
for (const { b: [x0, y0, x1, y1], z0, z1, kind } of boxes) {
  if (kind === 'glass') { body += face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], '#bfe0f5', 'opacity="0.85"') + face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], '#a9d4f0', 'opacity="0.75" stroke-opacity="0.4"'); continue; }
  const side = kind === 'part' ? ['#e4e7ec', '#cfd4dc'] : ['#d2d6dd', '#b7bdc7'];
  body += face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], side[0], 'stroke-opacity="0.06"') + face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], side[1], 'stroke-opacity="0.06"') + face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], C.ink, 'stroke="none"');
}
// подписи слоёв слева
const tag = (z, t1, t2) => { const [x, y] = T([0, H, z]); return line([x - 2, y], [17, y], 'stroke="#9aa0a8" stroke-width="0.12"') + text(15, y - 1.2, t1, { size: 2.8, weight: 700, ls: .3 }) + text(15, y + 2.6, t2, { size: 2.1, fill: '#4b5563' }); };
body += tag(ZW + CEIL / 2, 'СТЕНЫ', `высота ${f1(CEIL / 1000, 2)} м · наружные 250 мм`) + tag(0, 'ПОЛ', `полезная ${f1(netArea(), 2)} м²`);

const tot = zoneTotals();
let legend = '';
Object.entries(ZONE).forEach(([z, [n, c]], i) => { const x = 15 + (i % 2) * 92, y = Math.floor(i / 2) * 5.5; legend += `<rect x="${x}" y="${y - 2.6}" width="5" height="3.2" fill="${c}" stroke="${C.ink}" stroke-width="0.1"/>` + text(x + 7, y, n, { size: 2.8 }) + text(x + 85, y, `${f1(tot[z], 2)} м²`, { size: 2.8, weight: 700, anchor: 'end' }); });
legend += `<rect x="15" y="10.4" width="5" height="3.2" fill="#bfe0f5" stroke="${C.ink}" stroke-width="0.1"/>` + text(22, 13, `Окна: ${P.windows.length}, все на северо-восточном фасаде · подоконник +0,800 и перемычка +2,400 приняты`, { size: 2.8 });
const notes = [
  `Ортогональная проекция: план повёрнут на 38°, взгляд сверху под 36°. Стены подняты над полом на ${f1(LIFT / 1000, 1)} м, перекрытие не показано, чтобы видеть стены и пол целиком.`,
  'Стены нарезаны кусками по 500 мм и рисуются от дальних к ближним, поэтому дальняя стена не ложится поверх ближней.',
  'Перемычки над межкомнатными проёмами не показаны: их высоты на плане нет.',
];
render('01-axo', sheet({ num: '01', cmd: '/axo', title: 'Аксонометрия в разлёте', subtitle: 'Пол с зонами и стены на полную высоту над ним.', body, legend, notes }));
