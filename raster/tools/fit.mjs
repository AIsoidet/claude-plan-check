// /fit: мебель и проходы. Кровать, кухонный гарнитур и шкафы, нарисованные застройщиком, проходы рядом и самое узкое место.
import { P, C, sheet, render, fit, planLayer, scaleBar, text, f1, line, poly, levelRow, CHECKS } from './lib.mjs';
import { wardrobes, byName } from './measure.mjs';

const K = CHECKS, F = fit([20, 36, 170, 105]);
const m = x => f1(x / 1000, 2);
let body = planLayer(F, { fill: 'grey', grey: true, labels: 'names', faint: true, labelSize: 2.8 });
const shape = (pts, fill) => poly(F.Tp(pts), `fill="${fill}" stroke="${C.ink}" stroke-width="0.3" stroke-linejoin="round"`);
const dim = (p, q, t, o = {}) => { const A = F.T(p), B = F.T(q); return line(A, B, `stroke="${o.col || C.ink}" stroke-width="0.35"`) + `<circle cx="${A[0]}" cy="${A[1]}" r="0.5" fill="${o.col || C.ink}"/><circle cx="${B[0]}" cy="${B[1]}" r="0.5" fill="${o.col || C.ink}"/>` + text((A[0] + B[0]) / 2 + (o.dx || 0), (A[1] + B[1]) / 2 + (o.dy || 0), t, { size: 2.4, weight: 700, anchor: 'middle', fill: o.col || C.ink }); };

// кровать и проходы по бокам и в ногах
const bd = K.fit.bed;
body += shape(byName('кровать')[0].poly, '#90e0ff');
for (const d of bd.dims) {
  const vert = d.from[0] === d.to[0];   // отрезок вертикальный: подпись правее, горизонтальный: подпись выше
  body += dim(d.from, d.to, m(d.d), vert ? { dx: 4.2 } : { dy: -1.4 });
}
// кухонный гарнитур
body += shape(K.fit.kitchen.poly, '#ff90e8');
{ const [x, y] = F.T([(K.fit.kitchen.poly[0][0] + K.fit.kitchen.poly[2][0]) / 2, (K.fit.kitchen.poly[0][1] + K.fit.kitchen.poly[2][1]) / 2]); body += text(x + 14, y, m(K.fit.kitchen.long), { size: 2.4, weight: 700, anchor: 'middle', rot: 55 }); }
// шкафы в прихожей и проход перед каждым
for (const w of K.storage.items) body += shape([w.rect[0], [w.rect[1][0], w.rect[0][1]], w.rect[1], [w.rect[0][0], w.rect[1][1]]], '#facc00');
const W = wardrobes();
for (const w of W) { const s = w.front; body += dim([s.x, s.y], [s.x + s.dx * w.passage, s.y + s.dy * w.passage], m(w.passage), { dx: s.dx ? 0 : 5, dy: s.dx ? -1.2 : 0, col: '#8a6d00' }); }
// самое узкое место на маршрутах
const np = K.passages.reduce((a, b) => (b.w < a.w ? b : a));
body += dim([np.x - np.nx * np.r, np.y - np.ny * np.r], [np.x + np.nx * np.l, np.y + np.ny * np.l], m(np.w), { dx: 0, dy: 4.2, col: '#d10b5b' });
body += scaleBar(20, 156, F.k);

const minW = Math.min(...W.map(w => w.passage));
let legend = '';
legend += `<rect x="15" y="-2.6" width="5" height="3.2" fill="#90e0ff" stroke="${C.ink}" stroke-width="0.2"/>` + text(22, 0, 'Кровать', { size: 2.8 }) + `<rect x="55" y="-2.6" width="5" height="3.2" fill="#ff90e8" stroke="${C.ink}" stroke-width="0.2"/>` + text(62, 0, 'Кухонный гарнитур', { size: 2.8 }) +
  `<rect x="100" y="-2.6" width="5" height="3.2" fill="#facc00" stroke="${C.ink}" stroke-width="0.2"/>` + text(107, 0, 'Шкафы', { size: 2.8 }) + line([130, -1], [136, -1], 'stroke="#d10b5b" stroke-width="0.6"') + text(138, 0, 'Самое узкое место', { size: 2.8 });
legend += levelRow(7, 'ПРАКТИКА', `Кровать ≈ ${Math.round(bd.size[0] / 50) * 5} × ${Math.round(bd.size[1] / 50) * 5} см: по бокам ${bd.flanks.map(m).join(' и ')} м, в ногах ${m(bd.foot)} м; обычно от 0,55 м`);
legend += levelRow(11.6, 'ПРАКТИКА', `Линейный гарнитур ${m(K.fit.kitchen.long)} м вдоль косой стены; угловой порог 2,7 × 2,0 м не применим`);
legend += levelRow(16.2, 'ПРАКТИКА', `Шкафы в прихожей: ${K.storage.items.length} секции, ${m(K.storage.total)} м по фронту; проход перед ними от ${m(minW)} м, обычно от 0,8`);
legend += levelRow(20.8, 'ПО ЧЕРТЕЖУ', `Самое узкое место на маршрутах ${m(np.w)} м (маршрут «${np.route}»)`);
legend += levelRow(25.4, 'НЕ ПРОВЕРЕНО', 'Мебель нарисована застройщиком: свой диван, кровать или кухня могут быть другого размера');
const notes = [
  'Проход: от предмета до ближайшей стены или мебели. Практика из сборников дизайнеров, не норма: у кровати от 0,55 м, перед шкафом от 0,8 м.',
  'Приближённо, обведено с картинки: масштаб 19,6 мм на пиксель принят, цифры точны ±10–20%. Холодильника и отдельной мойки на плане нет.',
];
render('02-fit', sheet({ num: '02', cmd: '/fit', title: 'Мебель и проходы', subtitle: 'Встанет ли то, что нарисовал застройщик, и сколько остаётся пройти.', body, legend, notes }));
