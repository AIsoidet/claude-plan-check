// /zones: план зонирования с площадями и долями зон.
import { P, C, ZONE, sheet, render, fit, planLayer, north, scaleBar, text, f1, zoneTotals, netArea, poly, levelRow, CHECKS } from './lib.mjs';

const F = fit([20, 20, 170, 182]);
let body = planLayer(F, { fill: 'zone', labelSize: 3 });
// контур каждой зоны: обводим помещения своей зоны цветной линией
for (const r of P.rooms) body += poly(F.Tp(r.poly), `fill="none" stroke="${ZONE[r.zone][1].replace('#', '#')}" stroke-width="0.6" opacity="0.9"`);
body += north(186, 28) + scaleBar(20, 205, F.k);

const tot = zoneTotals(), net = netArea(), order = ['night', 'day', 'wet', 'circ'];
let legend = text(15, 0, `ДОЛЯ ЗОН ОТ ПОЛЕЗНОЙ ПЛОЩАДИ · ${f1(net, 2)} М²`, { size: 2.3, fill: '#6b7280', ls: .4 });
let x = 15;
for (const z of order) {
  const w = 180 * tot[z] / net;
  legend += `<rect x="${x}" y="2" width="${w}" height="6" fill="${ZONE[z][1]}"/>` + text(x + 1.2, 6.3, `${f1(100 * tot[z] / net)}%`, { size: 2.6, weight: 700 });
  x += w;
}
order.forEach((z, i) => {
  const cx = 15 + (i % 2) * 92, cy = 14 + Math.floor(i / 2) * 5.5;
  legend += `<rect x="${cx}" y="${cy - 2.6}" width="5" height="3.2" fill="${ZONE[z][1]}"/>` + text(cx + 7, cy, ZONE[z][0], { size: 2.8 }) + text(cx + 85, cy, `${f1(tot[z], 2)} м²`, { size: 2.8, weight: 700, anchor: 'end' });
});
for (const [i, a] of CHECKS.areas.entries()) legend += levelRow(25 + i * 4.4, a.level, `${a.name}: ${a.text}${a.note ? ` (${a.note})` : ''}`, a.area != null ? `${f1(a.area, 2)} м²` : '—');
const lab = P.rooms.reduce((s, r) => s + r.label_m2, 0);
const corr = P.rooms.filter(r => r.zone === 'circ'), corrC = corr.reduce((s, r) => s + r.area_m2, 0), corrL = corr.reduce((s, r) => s + r.label_m2, 0);
const notes = [
  `Сверка: по контуру ${f1(net, 2)} м², на плане ${f1(P.total_label_m2)} м². Сумма подписей ${f1(lab)} больше общей из-за округления, это не ошибка. Прихожая и коридор по контуру ${f1(corrC, 2)} против ${f1(corrL)},`,
  `комната с пилоном ${f1(P.rooms.find(r => r.name === 'Комната').area_m2, 2)} против 8,2. Граница прихожей и коридора на плане не обозначена. Масштаб по спальне и санузлу: 1 ед. SVG = ${f1(P.scale_mm_per_unit, 4)} мм.`,
];
render('04-zones', sheet({ num: '04', cmd: '/zones', title: 'Зонирование', subtitle: 'Помещения по назначению, внутри название и площадь по контуру. Север вверх-вправо.', body, legend, notes }));
