// /sun: солнце и воздух. Положение солнца по часам для широты из plan.json, когда оно перед фасадом с окнами, глубина луча.
import { P, C, sheet, render, text, f1, line, north, levelRow, CHECKS } from './lib.mjs';
import { sectionSvg, XI, XF, HEAD, SILL, CEIL, obstacles } from './section_base.mjs';

const Rd = Math.PI / 180, LAT = P.latitude * Rd, FAZ = P.facade_azimuth_deg;
// местный полдень по часам: часовой пояс UTC+5, долгота 60,61°, уравнение времени −1,8 мин (июнь) и +1,9 мин (декабрь)
// полдень по часам: UTC+5, долгота 60,61°, уравнение времени на дату (мин)
const NOON = { apr: 12 + (15 * P.utc_offset - P.longitude) / 15 - 1.4 / 60, june: 12 + (15 * P.utc_offset - P.longitude) / 15 + 1.8 / 60, dec: 12 + (15 * P.utc_offset - P.longitude) / 15 - 1.9 / 60 };
// 22 апреля: начало нормативного периода инсоляции для 48–58° с. ш. (СанПиН 1.2.3685-21, табл. 5.58)
const DAYS = [{ key: 'apr', name: '22 апреля', dec: 12.0, col: C.summer }, { key: 'june', name: '22 июня', dec: 23.44, col: '#c77700' }, { key: 'dec', name: '21 декабря', dec: -23.44, col: C.winter }];
function sunAt(day, clock) {   // clock в часах местного времени → высота, азимут (от севера по часовой)
  const H = (clock - NOON[day.key]) * 15 * Rd, d = day.dec * Rd;
  const alt = Math.asin(Math.sin(LAT) * Math.sin(d) + Math.cos(LAT) * Math.cos(d) * Math.cos(H)) / Rd;
  const az = (Math.atan2(-Math.sin(H) * Math.cos(d), Math.cos(LAT) * Math.sin(d) - Math.sin(LAT) * Math.cos(d) * Math.cos(H)) / Rd + 360) % 360;
  const da = ((az - FAZ + 540) % 360) - 180;
  return { alt, az, da, front: alt > 0 && Math.abs(da) < 90, prof: Math.atan(Math.tan(alt * Rd) / Math.cos(da * Rd)) / Rd };
}
const hhmm = c => `${Math.floor(c)}:${String(Math.round((c % 1) * 60)).padStart(2, '0')}`;
for (const d of DAYS) {
  const pts = []; for (let c = 0; c < 24; c += 1 / 60) pts.push([c, sunAt(d, c)]);
  const fr = pts.filter(([, s]) => s.front && Math.abs(s.da) < 85);   // ±5° вдоль фасада не считаем: луч скользит по стеклу
  d.path = pts.filter(([, s]) => s.alt > 0); d.from = fr[0]?.[0]; d.to = fr.filter(([c]) => c < 14).pop()?.[0];
  d.noonAlt = 90 - P.latitude + d.dec;
}
// луч через наружный нижний угол перемычки (фасадный слой, XF): глубже луч не пройдёт; где упадёт: пол, мебель на линии разреза или дальняя стена
function hit(prof) {
  const t = Math.tan(prof * Rd);
  const zAt = x => HEAD - (XF - x) * t;
  for (const [xa, xb, h] of [...obstacles].sort((a, b) => b[1] - a[1])) {   // ближние к окну первыми
    if (zAt(xb) <= 0) continue;                                              // луч уже упал на пол раньше
    if (zAt(xb) <= h) return { x: xb, z: zAt(xb), what: 'мебель' };          // входит в боковую грань
    if (zAt(xa) <= h) return { x: XF - (HEAD - h) / t, z: h, what: 'мебель' }; // ложится на верх
  }
  const xf = XF - HEAD / t; if (xf > 249) return { x: xf, z: 0, what: 'пол' };
  return { x: 249, z: HEAD - (XF - 249) * t, what: 'стена кухни' };
}
const June = DAYS[0], RAYS = [7, 8, 10].map(c => { const s = sunAt(June, c), h = hit(s.prof); return { c, s, h, depth: (XI - h.x) / 1000 }; });

// ---------- лист ----------
let body = '';
// плашки
DAYS.forEach((d, i) => {
  const x = 15 + i * 62;
  body += `<circle cx="${x + 2.5}" cy="21" r="2.4" fill="${d.col}"/>` + text(x + 7, 22.2, `${d.name}`, { size: 2.8, weight: 700 }) + text(x + 7, 30.6, `полдень ${hhmm(NOON[d.key])}, высота ${f1(d.noonAlt)}°`, { size: 2.3, fill: '#4b5563' });
  body += text(x + 7, 26.6, d.from != null ? `перед фасадом с ${hhmm(d.from)} до ${hhmm(d.to)}` : 'перед фасадом не бывает ни минуты', { size: 2.5, fill: '#4b5563' });
});
// полярная диаграмма: вид сверху, ориентирована как план (север под 45°)
const PX = 52, PY = 62, PR = 26, toXY = (alt, az) => { const r = PR * (90 - alt) / 90, a = (az + P.north_deg - 90) * Rd; return [PX + r * Math.cos(a), PY + r * Math.sin(a)]; };
{ const a0 = (FAZ - 90 + P.north_deg - 90) * Rd, a1 = (FAZ + 90 + P.north_deg - 90) * Rd;
  body += `<path d="M${PX},${PY} L${PX + PR * Math.cos(a0)},${PY + PR * Math.sin(a0)} A${PR},${PR} 0 0 1 ${PX + PR * Math.cos(a1)},${PY + PR * Math.sin(a1)} Z" fill="#eef3f8"/>`; }
for (const a of [30, 60]) body += `<circle cx="${PX}" cy="${PY}" r="${PR * (90 - a) / 90}" fill="none" stroke="#d0d3d8" stroke-width="0.15"/>` + text(PX + 0.8, PY - PR * (90 - a) / 90 + 2.4, `${a}°`, { size: 1.8, fill: '#9aa0a8' });
body += `<circle cx="${PX}" cy="${PY}" r="${PR}" fill="none" stroke="${C.ink}" stroke-width="0.25"/>`;
for (const [lab, az] of [['С', 0], ['В', 90], ['Ю', 180], ['З', 270]]) { const [x, y] = toXY(-9, az); body += text(x, y + 1, lab, { size: 2.6, weight: 700, anchor: 'middle' }); }
for (const d of DAYS) { const q = d.path.filter((_, i) => i % 6 === 0).map(([, s]) => toXY(s.alt, s.az)); body += `<polyline points="${q.map(p => p.join(',')).join(' ')}" fill="none" stroke="${d.col}" stroke-width="0.7"/>`; }
for (const r of RAYS) { const [x, y] = toXY(r.s.alt, r.s.az); body += `<circle cx="${x}" cy="${y}" r="1" fill="${June.col}"/>` + text(x + 1.5, y - 1, `${r.c}:00`, { size: 2, weight: 600 }); }
{ const a = (FAZ + P.north_deg - 90) * Rd; body += line([PX - PR * .55 * Math.sin(a), PY + PR * .55 * Math.cos(a)], [PX + PR * .55 * Math.sin(a), PY - PR * .55 * Math.cos(a)], `stroke="${C.ink}" stroke-width="1"`) + text(PX + Math.cos(a) * 6, PY + Math.sin(a) * 6 + 1, 'окна', { size: 2.2, weight: 600, anchor: 'middle' }); }
body += text(90, 46, 'Дуга солнца за день, вид сверху', { size: 2.8, weight: 700 }) + text(90, 50.5, 'Голубой сектор: солнце перед фасадом с окнами.', { size: 2.5, fill: '#4b5563' }) +
  text(90, 54.5, `Окна смотрят на северо-восток (азимут ${FAZ}°).`, { size: 2.5, fill: '#4b5563' }) + text(90, 58.5, 'Летом солнце заглядывает только утром,', { size: 2.5, fill: '#4b5563' }) + text(90, 62.5, 'зимой не заглядывает совсем: оно ходит низко над югом.', { size: 2.5, fill: '#4b5563' });
// разрез с лучами
const S = sectionSvg([15, 96, 180, 96], { people: [1600], windowMarks: false, levelsLeft: true });
body += S.svg;
const rayCols = ['#f6c27a', '#f2a33a', '#d9822b'];
RAYS.forEach((r, i) => {
  const t = Math.tan(r.s.prof * Rd), L = Math.min(1100, (CEIL + 500 - HEAD) / t);
  const A = S.T([XF + L, HEAD + L * t]), B = S.T([r.h.x, r.h.z]);
  body += `<polygon points="${S.T([XF, HEAD]).join(',')} ${B.join(',')} ${S.T([XI, SILL]).join(',')}" fill="${rayCols[i]}" opacity="0.16"/>`;
  body += line(A, B, `stroke="${rayCols[i]}" stroke-width="0.6"`) + `<circle cx="${B[0]}" cy="${B[1]}" r="0.9" fill="${rayCols[i]}"/>`;
  const near = r.depth < 1.2; body += text(B[0] + (near ? -1.6 : 1.2), B[1] - 1.4, `${r.c}:00 · ${f1(r.depth, 2)} м`, { size: 2.3, weight: 700, fill: '#8a4b10', anchor: near ? 'end' : 'start' });
});
body += line(S.T([XI + 200, CEIL * .55]), S.T([XI - 1400, CEIL * .55]), `stroke="${C.air}" stroke-width="0.5" stroke-dasharray="1.6 1"`) + text(S.T([XI - 1450, CEIL * .55])[0], S.T([0, CEIL * .55])[1] - 1.5, 'проветривание одностороннее', { size: 2.3, fill: '#4a7fa6', anchor: 'end' });
let legend = '';
RAYS.forEach((r, i) => { legend += `<rect x="15" y="${i * 5.5 - 2.6}" width="5" height="3.2" fill="${rayCols[i]}"/>` + text(22, i * 5.5, `22 апреля, ${r.c}:00 · высота ${f1(r.s.alt)}°, азимут ${Math.round(r.s.az)}° · луч в разрезе под ${f1(r.s.prof)}°`, { size: 2.7 }) + text(195, i * 5.5, r.h.what === 'стена кухни' ? `до стены кухни` : `${f1(r.depth, 2)} м`, { size: 2.7, weight: 700, anchor: 'end' }); });
legend += line([15, 16.5], [20, 16.5], `stroke="${C.air}" stroke-width="0.6" stroke-dasharray="1.4 .8"`) + text(22, 17.5, 'Окна только на одном фасаде: сквозного проветривания в квартире нет.', { size: 2.7 });
legend += levelRow(24, 'ПО ЧЕРТЕЖУ', `Солнце перед окнами: ${CHECKS.sun.map(d => `${d.date} ${d.hours ? f1(d.hours, 1) + ' ч' : 'нет'}`).join(' · ')}`) + levelRow(28.6, 'НЕ ПРОВЕРЕНО', 'Инсоляция по СанПиН (2 ч подряд с 22.04 по 22.08): соседние дома и балконы не учтены') + levelRow(33.2, 'ВОПРОС', 'Есть ли у застройщика заключение по инсоляции для этой секции');
const notes = [
  `Высота солнца: sin h = sin φ·sin δ + cos φ·cos δ·cos t; φ = ${f1(P.latitude, 2)}°, δ = ±23,44°. Время местное (UTC+5), полдень сдвинут на долготу ${f1(P.longitude, 2)}° и уравнение времени.`,
  'Глубина от внутренней грани стены: луч проходит под наружным углом перемычки (+2,400, принято) и падает на пол или мебель на линии разреза.',
  '21 декабря прямого солнца в окнах этой квартиры нет: в полдень оно стоит на юге на 9,7° над горизонтом, а фасад смотрит на северо-восток.',
];
render('05-sun', sheet({ num: '05', cmd: '/sun', title: 'Солнце и воздух', subtitle: 'Окна на северо-восток: солнце заглядывает только утром, в декабре его нет.', body, legend, notes }));
console.log(DAYS.map(d => `${d.name}: ${d.from != null ? hhmm(d.from) + '–' + hhmm(d.to) : 'нет'}`).join(' · '), RAYS.map(r => `${r.c}:00 ${r.depth.toFixed(2)} ${r.h.what}`).join(' · '));
