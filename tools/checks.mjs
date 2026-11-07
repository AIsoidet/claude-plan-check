// Проверки для покупателя: нормы площадей и непроходных комнат (СП 54), практика по мебели и проходам, солнце в
// нормативные даты. Уровни: НОРМА (с пунктом), ПРАКТИКА (эвристика, не норма), ПО ЧЕРТЕЖУ (факт геометрии),
// НЕ ПРОВЕРЕНО (по плану нельзя). Пишет out/checks.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { P, room } from './lib.mjs';

const r2 = x => Math.round(x * 100) / 100;
const out = { areas: [], rooms: {}, fit: {}, passages: [], sun: [], questions: [] };

// --- площади против СП 54.13330.2022 п. 5.11 (ru-norms.md §1) ---
const bed = room('Спальня'), rm = room('Комната'), kg = room('Кухня-гостиная');
out.areas = [
  { name: 'Спальня', area: bed.area_m2, level: 'НОРМА', rule: 'СП 54 п. 5.11', text: 'на двоих не меньше 10 м², СП 54 п. 5.11', min: 10 },
  { name: 'Комната', area: rm.area_m2, level: 'НОРМА', rule: 'СП 54 п. 5.11', text: 'спальня не меньше 8 м², СП 54 п. 5.11', min: 8, note: 'с пилоном, подпись ЖК 8,2' },
  { name: 'Кухня-гостиная', area: kg.area_m2, level: 'НОРМА', rule: 'СП 54 п. 5.11', text: 'не меньше 16 м², если считать её общей комнатой, СП 54 п. 5.11', min: 16, conditional: true },
  { name: 'Кухонная зона', area: null, level: 'НЕ ПРОВЕРЕНО', rule: 'СП 54 п. 5.11', text: 'не меньше 6 м², граница зоны на плане не обозначена' },
];
const circ = P.rooms.filter(r => r.zone === 'circ');
out.areaCheck = {
  rooms: P.rooms.map(r => ({ name: r.name, area: r.area_m2, label: r.label_m2, diff: r2(r.area_m2 - r.label_m2) })),
  circ: { area: r2(circ.reduce((s, r) => s + r.area_m2, 0)), label: r2(circ.reduce((s, r) => s + r.label_m2, 0)) },
  roundingNote: 'Сумма подписей 48,2 против общей 48,1: каждая подпись округлена до 0,1, это не ошибка.',
};

// --- непроходные комнаты, СП 54 п. 5.6: у каждой жилой комнаты одна дверь, и она ведёт в коридор ---
const living = ['Спальня', 'Комната'];
out.rooms.nonThrough = living.map(n => ({ name: n, doors: P.doors.filter(d => d.between.includes(n)).map(d => d.between.find(x => x !== n)) }));
out.rooms.nonThroughOk = out.rooms.nonThrough.every(r => r.doors.length === 1);

import { ray, narrowest, wardrobes } from './measure.mjs';

// --- кровать: проходы по бокам и в ногах (практика old-plans.md §2: ≥ 0,55 м) ---
const B = P.furniture.find(f => f.rect[1][0] - f.rect[0][0] > 1500 && f.rect[1][1] - f.rect[0][1] > 1900).rect;   // 1594 × 1992
const [bx0, by0] = B[0], [bx1, by1] = B[1], ymid = (by0 + by1) / 2 - 300;
out.fit.bed = {
  size: [bx1 - bx0, by1 - by0], level: 'ПРАКТИКА', rule: 'проход у кровати от 0,55 м',
  ...(() => { let l = 1e9, r = 1e9; for (let y = by0 + 50; y < by1 - 460; y += 25) { l = Math.min(l, ray(bx0 - 1, y, -1, 0)); r = Math.min(r, ray(bx1 + 1, y, 1, 0)); } return { left: l, right: r }; })(),
  foot: ray((bx0 + bx1) / 2, by0 - 1, 0, -1), min: 550,
  note: 'кровать нарисована застройщиком; изголовье у перегородки, тумбы по бокам изголовья',
};
// --- угловая кухня (практика: 2,7 × 2,0 м) ---
out.fit.kitchen = { long: 8946 - 6107, short: 2042 - 249, level: 'ПРАКТИКА', rule: 'угловая кухня от 2,7 × 2,0 м', min: [2700, 2000], note: 'длины столешницы по чертежу, глубина 600 мм' };

// --- самый узкий проход на маршрутах, не считая дверных проёмов ---
const routes = JSON.parse(readFileSync(new URL('../out/routes.json', import.meta.url), 'utf8'));
for (const r of routes) out.passages.push({ route: r.name, m: r2(r.m), ...narrowest(r.path, r.stops.map(s => s[1])), level: 'ПО ЧЕРТЕЖУ' });
// --- хранение: шкафы, нарисованные застройщиком, и проход перед ними (практика: от 0,8 м, тесно от 0,6) ---
out.storage = { items: wardrobes().map(w => ({ room: w.room, length: w.length, depth: w.depth, passage: w.passage, rect: w.rect })), level: 'ПРАКТИКА', rule: 'проход перед шкафом от 0,8 м' };
out.storage.total = out.storage.items.reduce((s, w) => s + w.length, 0);

// --- солнце перед фасадом в нормативные даты (СанПиН 1.2.3685-21 табл. 5.58: период 22.04–22.08, 2 ч для 48–58°) ---
const Rd = Math.PI / 180, LAT = P.latitude * Rd, FAZ = P.facade_azimuth_deg;
const noon = eot => 12 + (15 * P.utc_offset - P.longitude) / 15 - eot / 60;
for (const [date, dec, eot] of [['22 апреля', 12.0, 1.4], ['22 июня', 23.44, -1.8], ['22 августа', 11.6, -3.0], ['21 декабря', -23.44, 1.9]]) {
  const d = dec * Rd; let from = null, to = null;
  for (let c = 0; c < 24; c += 1 / 60) {
    const H = (c - noon(eot)) * 15 * Rd, alt = Math.asin(Math.sin(LAT) * Math.sin(d) + Math.cos(LAT) * Math.cos(d) * Math.cos(H)) / Rd;
    const az = (Math.atan2(-Math.sin(H) * Math.cos(d), Math.cos(LAT) * Math.sin(d) - Math.sin(LAT) * Math.cos(d) * Math.cos(H)) / Rd + 360) % 360;
    const da = ((az - FAZ + 540) % 360) - 180;
    if (alt > 0 && Math.abs(da) < 85 && c < 14) { if (from == null) from = c; to = c; }
  }
  out.sun.push({ date, from, to, hours: from == null ? 0 : r2(to - from) });
}
out.sunNote = 'Часы, когда солнце стоит перед фасадом с окнами, без соседних домов, балконов и правил расчёта. Это не расчёт инсоляции.';

out.questions = [
  `Как считали площади: прихожая с коридором по чертежу ${String(r2(circ.reduce((s, r) => s + r.area_m2, 0))).replace('.', ',')} м² против 8,5, комната с пилоном ${String(rm.area_m2).replace('.', ',')} против 8,2.`,
  'Где заключение по инсоляции для этой секции с учётом соседних домов.',
  'Какая высота подоконника и окна: на плане их нет.',
  'Что над и под квартирой: санузел над жилой комнатой запрещён (СП 54 п. 7.20), по одному плану не проверить.',
  'Где вентиляционные каналы кухни и санузла и можно ли ставить вытяжку над плитой.',
];
writeFileSync(new URL('../out/checks.json', import.meta.url), JSON.stringify(out, null, 1));
const f = x => (x / 1000).toFixed(2);
console.log('кровать', out.fit.bed.size, 'бока', f(out.fit.bed.left), f(out.fit.bed.right), 'ноги', f(out.fit.bed.foot));
console.log('кухня', f(out.fit.kitchen.long), '×', f(out.fit.kitchen.short));
for (const p of out.passages) console.log('узко', p.route, f(p.w), 'в', Math.round(p.x), Math.round(p.y));
for (const s of out.sun) console.log(s.date, s.hours, s.from?.toFixed(2), s.to?.toFixed(2));
for (const w of out.storage.items) console.log('шкаф', w.room, w.length, 'проход', w.passage);
console.log('непроходные', out.rooms.nonThroughOk, JSON.stringify(out.rooms.nonThrough));
