// /fit: мебель и проходы. Кровать, кухня и шкафы, нарисованные застройщиком, проходы рядом с ними и самое узкое место.
import { P, C, sheet, render, fit, planLayer, north, scaleBar, text, f1, line, levelRow, CHECKS } from './lib.mjs';

const K = CHECKS, F = fit([20, 20, 170, 182]);
const m = x => f1(x / 1000, 2);
let body = planLayer(F, { fill: 'grey', grey: true, labels: 'names', faint: true, labelSize: 2.8 });
const rect = (r, fill) => { const [a, b] = F.Tp(r); return `<rect x="${a[0]}" y="${a[1]}" width="${b[0] - a[0]}" height="${b[1] - a[1]}" fill="${fill}" stroke="${C.ink}" stroke-width="0.3"/>`; };
const dim = (p, q, t, o = {}) => { const A = F.T(p), B = F.T(q); return line(A, B, `stroke="${o.col || C.ink}" stroke-width="0.35"`) + `<circle cx="${A[0]}" cy="${A[1]}" r="0.5" fill="${o.col || C.ink}"/><circle cx="${B[0]}" cy="${B[1]}" r="0.5" fill="${o.col || C.ink}"/>` + text((A[0] + B[0]) / 2 + (o.dx || 0), (A[1] + B[1]) / 2 + (o.dy || 0), t, { size: 2.4, weight: 700, anchor: 'middle', fill: o.col || C.ink }); };

// кровать и проходы
const bd = K.fit.bed, B = P.furniture.find(f => f.rect[1][0] - f.rect[0][0] > 1500 && f.rect[1][1] - f.rect[0][1] > 1900).rect;
body += rect(B, '#90e0ff');
const yb = (B[0][1] + B[1][1]) / 2 - 300;
body += dim([B[0][0] - bd.left, yb], [B[0][0], yb], m(bd.left), { dy: -1.4 }) + dim([B[1][0], yb], [B[1][0] + bd.right, yb], m(bd.right), { dy: -1.4 }) + dim([(B[0][0] + B[1][0]) / 2, B[0][1] - bd.foot], [(B[0][0] + B[1][0]) / 2, B[0][1]], m(bd.foot), { dx: 4 });
// кухня
body += rect([[249, 6107], [847, 8946]], '#ff90e8') + rect([[847, 6107], [2042, 6705]], '#ff90e8');
{ const [x, y] = F.T([548, 7600]); body += text(x, y, m(K.fit.kitchen.long), { size: 2.4, weight: 700, anchor: 'middle', rot: -90 }); }
{ const [x, y] = F.T([1445, 6480]); body += text(x, y, m(K.fit.kitchen.short), { size: 2.4, weight: 700, anchor: 'middle' }); }
// шкафы и проход перед каждым
for (const w of K.storage.items) body += rect(w.rect, '#facc00');
const W = (await import('./measure.mjs')).wardrobes();
for (const w of W) { const s = w.front; body += dim([s.x, s.y], [s.x + s.dx * w.passage, s.y + s.dy * w.passage], m(w.passage), { dx: s.dx ? 0 : 3.2, dy: s.dx ? -1.2 : 0, col: '#8a6d00' }); }
// самое узкое место на маршрутах
const np = K.passages.reduce((a, b) => (b.w < a.w ? b : a));
body += dim([np.x - np.nx * np.r, np.y - np.ny * np.r], [np.x + np.nx * np.l, np.y + np.ny * np.l], m(np.w), { dx: 4, col: '#d10b5b' });
body += north(186, 28) + scaleBar(20, 205, F.k);

const minW = Math.min(...W.map(w => w.passage));
let legend = '';
legend += `<rect x="15" y="-2.6" width="5" height="3.2" fill="#90e0ff" stroke="${C.ink}" stroke-width="0.2"/>` + text(22, 0, 'Кровать', { size: 2.8 }) + `<rect x="55" y="-2.6" width="5" height="3.2" fill="#ff90e8" stroke="${C.ink}" stroke-width="0.2"/>` + text(62, 0, 'Кухня', { size: 2.8 }) +
  `<rect x="90" y="-2.6" width="5" height="3.2" fill="#facc00" stroke="${C.ink}" stroke-width="0.2"/>` + text(97, 0, 'Шкафы', { size: 2.8 }) + line([125, -1], [131, -1], 'stroke="#d10b5b" stroke-width="0.6"') + text(133, 0, 'Самое узкое место', { size: 2.8 });
legend += levelRow(7, 'ПРАКТИКА', `Кровать ≈ ${Math.round(bd.size[0] / 50) * 5} × ${Math.round(bd.size[1] / 50) * 5} см: проходы ${m(bd.left)} и ${m(bd.right)} м по бокам, ${m(bd.foot)} м в ногах; обычно от 0,55 м`);
legend += levelRow(11.6, 'ПРАКТИКА', `Угловая кухня ${m(K.fit.kitchen.long)} × ${m(K.fit.kitchen.short)} м по столешнице; обычно от 2,7 × 2,0 м`);
legend += levelRow(16.2, 'ПРАКТИКА', `Шкафы: ${K.storage.items.length} секции, ${m(K.storage.total)} м по фронту; проход перед ними от ${m(minW)} м, обычно от 0,8`);
legend += levelRow(20.8, 'ПО ЧЕРТЕЖУ', `Самое узкое место на маршрутах ${m(np.w)} м: между столешницей и стульями`);
legend += levelRow(25.4, 'НЕ ПРОВЕРЕНО', 'Мебель нарисована застройщиком: свой диван или кухня могут быть другого размера');
const notes = [
  'Проход: от предмета до ближайшей стены или мебели по чертежу. Практика из сборников дизайнеров, не норма:',
  'у кровати от 0,55 м, перед шкафом от 0,8 м, угловая кухня от 2,7 × 2,0 м. Столешница 600 мм, холодильника на плане нет.',
];
render('02-fit', sheet({ num: '02', cmd: '/fit', title: 'Мебель и проходы', subtitle: 'Встанет ли то, что нарисовал застройщик, и сколько остаётся пройти.', body, legend, notes }));
