// /zones: план зонирования с площадями (по подписям ЖК) и долями зон. Не зависит от out/checks.json.
import { P, C, ZONE, MAIN_ZONES, sheet, render, fit, planLayer, north, scaleBar, text, f1, zoneTotals, netArea, levelRow, centroid } from './lib.mjs';

const F = fit([20, 20, 170, 182]);
let body = planLayer(F, { fill: 'zone', labels: false, furniture: false });
// мебель рисуем здесь: planLayer в lib.mjs ещё читает f.rect, а в plan.json у мебели poly
const furn = P.furniture.map(f => `<polygon points="${F.Tp(f.poly).map(p => p.map(v => +v.toFixed(3)).join(',')).join(' ')}" fill="none" stroke="#8c929b" stroke-width="0.12" stroke-linejoin="round"/>`).join('');
body += furn;
// подписи: название и площадь по подписи ЖК; мелкие помещения мельче шрифтом
for (const r of P.rooms) {
  const [cx, cy] = F.T(r.label_at || centroid(r.poly)), sz = r.area_m2 < 3 ? 1.8 : r.area_m2 < 9 ? 2.5 : 3;
  body += text(cx, cy - .4, r.name, { size: sz, anchor: 'middle', weight: 600 }) + text(cx, cy + sz * 1.1, `${f1(r.area_m2, 1)} м²`, { size: sz * .9, anchor: 'middle' });
}
body += north(186, 28) + scaleBar(20, 205, F.k);

const tot = zoneTotals(), net = netArea(), room = n => P.rooms.find(r => r.name === n);
let legend = text(15, 0, `ДОЛЯ ЗОН ОТ ПОЛЕЗНОЙ ПЛОЩАДИ · ${f1(net, 1)} М² БЕЗ ЛОДЖИИ`, { size: 2.3, fill: '#6b7280', ls: .4 });
let x = 15;
for (const z of MAIN_ZONES) {
  const w = 180 * tot[z] / net;
  legend += `<rect x="${x}" y="2" width="${w}" height="6" fill="${ZONE[z][1]}"/>` + text(x + 1.2, 6.3, `${f1(100 * tot[z] / net, 0)}%`, { size: 2.6, weight: 700 });
  x += w;
}
Object.keys(ZONE).forEach((z, i) => {
  const cx = 15 + (i % 3) * 62, cy = 14 + Math.floor(i / 3) * 5.5;
  legend += `<rect x="${cx}" y="${cy - 2.6}" width="5" height="3.2" fill="${ZONE[z][1]}" stroke="${C.ink}" stroke-width="0.1"/>` + text(cx + 7, cy, ZONE[z][0], { size: 2.8 }) + text(cx + 55, cy, `${f1(tot[z], 1)} м²`, { size: 2.8, weight: 700, anchor: 'end' });
});
const circ = tot.circ, rows = [
  ['ПО ЧЕРТЕЖУ', `Коммуникации: прихожие 5,1 и 8,2, доля от полезной ${f1(100 * circ / net, 0)}%`, `${f1(circ, 1)} м²`],
  ['НОРМА', `Спальня от 8 м², на двоих от 10 (СП 54 п. 5.11)`, `${f1(room('Спальня').area_m2, 1)} м²`],
  ['НОРМА', `Общая комната от 16 м², если кухню-гостиную считать общей (СП 54 п. 5.11)`, `${f1(room('Кухня-гостиная').area_m2, 1)} м²`],
  ['НЕ ПРОВЕРЕНО', 'Кухонная зона от 6 м²: её граница на плане не обозначена', '—'],
  ['ВОПРОС', `Из чего сложились ${f1(P.total_label_m2)} м²: помещения без лоджии ${f1(net, 1)}, с лоджией ${f1(net + room('Лоджия').area_m2, 1)}`, '—'],
];
rows.forEach(([lv, t, v], i) => { legend += levelRow(24.5 + i * 4, lv, t, v); });
const notes = [
  'Площади — подписи ЖК. Контуры обведены с картинки, масштаб приближённый (≈19,6 мм/пк, разброс 10–20%), сверку с подписями не делаем.',
  'Вопрос застройщику: как посчитана общая площадь и какой коэффициент у лоджии. Стороны света на плане нет.',
];
render('04-zones', sheet({ num: '04', cmd: '/zones', title: 'Зонирование', subtitle: 'Помещения по назначению, внутри название и площадь по подписи ЖК.', body, legend, notes }));
