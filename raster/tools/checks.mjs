// Проверки для покупателя: нормы площадей и непроходных комнат (СП 54), практика по мебели и проходам.
// Уровни: НОРМА (с пунктом), ПРАКТИКА (эвристика, не норма), ПО ЧЕРТЕЖУ (факт геометрии),
// НЕ ПРОВЕРЕНО (по плану нельзя), ВОПРОС. Пишет out/checks.json. Геометрия обведена с картинки: приближённо.
import { readFileSync, writeFileSync } from 'node:fs';
import { P, room } from './lib.mjs';
import { ray, narrowest, wardrobes, bbox, byName, GR } from './measure.mjs';

const r2 = x => Math.round(x * 100) / 100, c2 = x => String(r2(x)).replace('.', ',');
const out = { areas: [], rooms: {}, fit: {}, passages: [], questions: [] };

// --- площади против СП 54.13330.2022 п. 5.11; площади здесь подписи ЖК ---
const bed = room('Спальня'), kg = room('Кухня-гостиная');
out.areas = [
  { name: 'Спальня', area: bed.area_m2, level: 'НОРМА', rule: 'СП 54 п. 5.11', text: 'одна не меньше 8 м², на двоих не меньше 10 м², СП 54 п. 5.11', min: 10 },
  { name: 'Кухня-гостиная', area: kg.area_m2, level: 'НОРМА', rule: 'СП 54 п. 5.11', text: 'не меньше 16 м², если считать её общей комнатой, СП 54 п. 5.11', min: 16, conditional: true },
  { name: 'Кухонная зона', area: null, level: 'НЕ ПРОВЕРЕНО', rule: 'СП 54 п. 5.11', text: 'не меньше 6 м², граница зоны на плане не обозначена' },
];
const net = P.rooms.filter(r => r.zone !== 'loggia').reduce((s, r) => s + r.label_m2, 0), loggia = room('Лоджия').label_m2;
const circ = P.rooms.filter(r => r.zone === 'circ'), circL = circ.reduce((s, r) => s + r.label_m2, 0);
out.areaCheck = {
  rooms: P.rooms.map(r => ({ name: r.name, label: r.label_m2, contour: r.contour_m2, diff: r2(r.contour_m2 - r.label_m2) })),
  net: r2(net), loggia, total: P.total_label_m2, circ: { label: r2(circL), share: r2(100 * circL / net) },
  note: 'Площади в проверках взяты из подписей ЖК. Контуры с картинки расходятся с подписями до 15–20%: это неточность обводки, не находка.',
};

// --- проходные комнаты: двери спальни и пути в обход (по plan.json, без вердикта) ---
out.rooms.bedroomDoors = P.doors.filter(d => d.between.includes('Спальня')).map(d => d.between.find(x => x !== 'Спальня'));
out.rooms.hallToLivingWithoutBedroom = P.doors.some(d => d.between.includes('Прихожая 5,1') && d.between.includes('Кухня-гостиная'));
out.rooms.loop = 'Прихожая 5,1 → спальня → прихожая 8,2 → кухня-гостиная → прихожая 5,1';

// --- кровать: проходы по бокам и в ногах (практика: от 0,55 м); изголовье там, где ближе стена ---
const [bx0, by0, bx1, by1] = bbox(byName('кровать')[0].poly);
const DIR = { W: [-1, 0], E: [1, 0], N: [0, -1], S: [0, 1] };
function spanRay(side) {   // минимум луча по всей стороне кровати, тумбы не считаются
  let best = { d: 1e9 };
  for (let t = 0.04; t <= 0.96; t += 0.04) {
    const [dx, dy] = DIR[side];
    const fx = side === 'W' ? bx0 : side === 'E' ? bx1 : bx0 + (bx1 - bx0) * t, fy = side === 'N' ? by0 : side === 'S' ? by1 : by0 + (by1 - by0) * t;
    const d = ray(fx + dx * GR, fy + dy * GR, dx, dy, 3000, false) + GR;
    if (d < best.d) best = { d, from: [fx, fy] };
  }
  const [dx, dy] = DIR[side];
  return { side, d: best.d, from: best.from, to: [best.from[0] + dx * best.d, best.from[1] + dy * best.d] };
}
const sd = ['W', 'E', 'N', 'S'].map(spanRay), head = sd.filter(s => s.side === 'W' || s.side === 'E').reduce((a, b) => (b.d < a.d ? b : a)).side;
const foot = sd.find(s => s.side === ({ W: 'E', E: 'W' })[head]), flanks = sd.filter(s => s.side === 'N' || s.side === 'S');
out.fit.bed = { size: [bx1 - bx0, by1 - by0], head, foot: foot.d, flanks: flanks.map(s => s.d), dims: [...flanks.map(s => ({ role: 'бок', ...s })), { role: 'ноги', ...foot }], level: 'ПРАКТИКА', rule: 'проход у кровати от 0,55 м', min: 550, note: 'кровать нарисована застройщиком; изголовье у стены, тумбы у изголовья' };

// --- кухня: линейный гарнитур по косой стене (практика: угловая от 2,7 × 2,0 м к нему не применима) ---
const kp = byName('кухонный гарнитур')[0].poly, long = Math.hypot(kp[1][0] - kp[0][0], kp[1][1] - kp[0][1]);
const sh = Math.abs(kp.reduce((s, p, i) => { const q = kp[(i + 1) % kp.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
out.fit.kitchen = { long, depth: sh / long, poly: kp, level: 'ПРАКТИКА', rule: 'угловая кухня от 2,7 × 2,0 м к линейному гарнитуру не применима', note: 'длина по гарнитуру вдоль косой стены; холодильника и отдельной мойки на плане нет' };

// --- самый узкий проход на маршрутах, не считая дверных проёмов ---
const routes = JSON.parse(readFileSync(new URL('../out/routes.json', import.meta.url), 'utf8'));
for (const r of routes) out.passages.push({ route: r.name, m: r2(r.m), ...narrowest(r.path, r.stops.map(s => s[1])), level: 'ПО ЧЕРТЕЖУ' });
// --- шкафы в прихожей 8,2: проход перед ними (практика: от 0,8 м) ---
out.storage = { items: wardrobes().map(w => ({ room: w.room, length: w.length, depth: w.depth, passage: w.passage, rect: w.rect, front: w.front })), level: 'ПРАКТИКА', rule: 'проход перед шкафом от 0,8 м' };
out.storage.total = out.storage.items.reduce((s, w) => s + w.length, 0);
out.approx = 'приближённо, обведено с картинки (19,6 мм на пиксель, принято)';

out.questions = [
  `Как посчитали ${c2(P.total_label_m2)} м²: подписи помещений дают ${c2(net)} без лоджии и ${c2(net + loggia)} с лоджией ${c2(loggia)}. Какой коэффициент у лоджии?`,
  `Прихожие 5,1 и 8,2 вместе ${c2(circL)} м², это ${c2(100 * circL / net)}% подписанной площади без лоджии.`,
  'Ванны или душа на плане нет: по картинке видны унитаз, раковина, поддон в одной ячейке и стиральная машина. Что именно стоит в санузле по проекту?',
  'Постирочная 2,2 м² и санузел 1,1 м² не совпадают с нарисованными ячейками (по обводке около 1,5 и 3,1 м²). Это может быть неточность обводки: уточнить площади и границы.',
  'Ячейка с унитазом на картинке закрыта со всех сторон, входа не видно: где дверь?',
  'У спальни две двери (в прихожую 5,1 и в прихожую 8,2): как это учтено по СП 54 п. 5.6 о непроходных комнатах. В кухню-гостиную из прихожей 5,1 можно пройти и минуя спальню.',
  'Какое остекление у лоджии и можно ли присоединять её к комнате.',
  'Какая высота подоконника и окна: на плане их нет. Север и этаж тоже не указаны, инсоляцию по этому плану не проверить.',
  'Где вентиляционные каналы кухни и санузла и можно ли ставить вытяжку над плитой.',
];
writeFileSync(new URL('../out/checks.json', import.meta.url), JSON.stringify(out, null, 1));
const f = x => (x / 1000).toFixed(2);
console.log('кровать', out.fit.bed.size.map(f), 'изголовье', head, 'бока', out.fit.bed.flanks.map(f), 'ноги', f(out.fit.bed.foot));
console.log('кухня', f(out.fit.kitchen.long), '×', f(out.fit.kitchen.depth));
for (const p of out.passages) console.log('узко', p.route, f(p.w), 'в', Math.round(p.x), Math.round(p.y));
for (const w of out.storage.items) console.log('шкаф', w.room, Math.round(w.length), 'проход', w.passage);
console.log('двери спальни', out.rooms.bedroomDoors.join(' · '));
