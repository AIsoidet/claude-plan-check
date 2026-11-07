// /bubble: пузырьковая схема. Площадь пузыря пропорциональна площади помещения, связи читаются с дверей плана.
import { P, C, ZONE, sheet, render, fit, text, f1, line, centroid, levelRow } from './lib.mjs';

const F = fit([25, 30, 160, 160]);
const K = 1.15;                                  // мм листа на √(м²): радиус = K·√(площадь/π)·10
const B = P.rooms.map(r => { const [x, y] = F.T(centroid(r.poly)); return { r, x, y, R: K * Math.sqrt(r.area_m2 / Math.PI) * 10 }; });
const by = n => B.find(b => b.r.name === n);
// раздвинуть пузыри, чтобы не перекрывались (стартуют с положения помещения на плане)
const LINKS = [...P.open_links, ...P.doors.filter(d => !d.between.includes('ПОДЪЕЗД')).map(d => d.between)];
for (let it = 0; it < 600; it++) {
  for (const [na, nb] of LINKS) {   // связанные помещения притягиваются до касания с зазором
    const a = by(na), b = by(nb), dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), want = a.R + b.R + 7;
    if (d > want) { const m = (d - want) * .05, ux = dx / d, uy = dy / d; a.x += ux * m; a.y += uy * m; b.x -= ux * m; b.y -= uy * m; }
  }
  for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {   // и никогда не перекрываются
    const a = B[i], b = B[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01, need = a.R + b.R + 5;
    if (d < need) { const m = (need - d) / 2, ux = dx / d, uy = dy / d; a.x -= ux * m; a.y -= uy * m; b.x += ux * m; b.y += uy * m; }
  }
}
{ const cx = B.reduce((s, b) => s + b.x, 0) / B.length, cy = B.reduce((s, b) => s + b.y, 0) / B.length; for (const b of B) { b.x += 105 - cx; b.y += 112 - cy; } }
const doorsIn = P.doors.filter(d => !d.between.includes('ПОДЪЕЗД')), doorsOut = P.doors.filter(d => d.between.includes('ПОДЪЕЗД'));
let body = '';
for (const [a, b] of P.open_links) body += line([by(a).x, by(a).y], [by(b).x, by(b).y], `stroke="${C.circ}" stroke-width="7" stroke-linecap="round"`);
for (const d of doorsIn) { const [a, b] = d.between.map(by); body += line([a.x, a.y], [b.x, b.y], `stroke="${C.ink}" stroke-width="0.35"`); }
const ent = by("Прихожая"), street = [ent.x - 24, ent.y - 16];
body += line([ent.x, ent.y], street, `stroke="${C.ink}" stroke-width="0.35" stroke-dasharray="1.4 1"`) +
  `<circle cx="${street[0]}" cy="${street[1]}" r="8" fill="#fff" stroke="${C.ink}" stroke-width="0.3" stroke-dasharray="1 .7"/>` + text(street[0], street[1] + 1, 'ПОДЪЕЗД', { size: 2.2, weight: 700, anchor: 'middle' });
// окна: куда смотрят комнаты (на северо-восток)
for (const b of B) {
  b.c = `<circle cx="${b.x}" cy="${b.y}" r="${b.R}" fill="${ZONE[b.r.zone][1]}" stroke="${C.ink}" stroke-width="0.3"/>` +
    text(b.x, b.y - .3, b.r.name, { size: Math.min(3.2, b.R / 3.2), weight: 700, anchor: 'middle' }) + text(b.x, b.y + 3.6, `${f1(b.r.area_m2, 2)} м²`, { size: Math.min(2.8, b.R / 3.6), anchor: 'middle' });
  body += b.c;
}
const win = P.windows.length;
let legend = '';
Object.entries(ZONE).forEach(([z, [n, c]], i) => { legend += `<circle cx="${17.5 + (i % 2) * 92}" cy="${Math.floor(i / 2) * 5.5 - .9}" r="2" fill="${c}" stroke="${C.ink}" stroke-width="0.2"/>` + text(22 + (i % 2) * 92, Math.floor(i / 2) * 5.5, n, { size: 2.8 }); });
legend += line([15, 14], [22, 14], `stroke="${C.ink}" stroke-width="0.35"`) + text(25, 15, `Дверь между помещениями`, { size: 2.8 }) + text(105, 15, String(doorsIn.length), { size: 2.8, weight: 700, anchor: 'end' });
legend += line([15, 19.5], [22, 19.5], `stroke="${C.circ}" stroke-width="3"`) + text(25, 20.5, `Открытая связь, без стены`, { size: 2.8 }) + text(105, 20.5, String(P.open_links.length), { size: 2.8, weight: 700, anchor: 'end' });
legend += line([15, 25], [22, 25], `stroke="${C.ink}" stroke-width="0.35" stroke-dasharray="1.4 1"`) + text(25, 26, `Входная дверь`, { size: 2.8 }) + text(105, 26, String(doorsOut.length), { size: 2.8, weight: 700, anchor: 'end' });
legend += levelRow(33, 'НОРМА', 'Жилые комнаты непроходные, СП 54 п. 5.6: у спальни и комнаты по одной двери, обе в коридор');
const notes = [
  'Площадь пузыря пропорциональна площади помещения по контуру. Каждый пузырь стартует с положения комнаты на плане и раздвигается до касания.',
  `Связи сняты с дверей plan.json: ${doorsIn.map(d => d.between.join('–')).join(', ')}. Все жилые комнаты выходят в коридор, проходных нет.`,
  `Окна у трёх помещений, все на одном фасаде (северо-восток): спальня, комната, кухня-гостиная.`,
];
render('06-bubble', sheet({ num: '06', cmd: '/bubble', title: 'Пузырьковая схема', subtitle: 'Размер пузыря по площади, линии по дверям, полосы там, где стены нет.', body, legend, notes }));
