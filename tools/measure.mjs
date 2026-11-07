// Замеры по plan.json без раздувания: лучи до ближайшего препятствия, самый узкий проход на маршруте, шкафы.
import { P } from './lib.mjs';

const XI = P.rooms.find(r => r.name === 'Спальня').poly[1][0];          // внутренняя грань фасада
const YB = Math.max(...P.rooms.flatMap(r => r.poly.map(p => p[1])));      // внутренняя грань нижней стены
// мелкая сантехника и кухня из слоёв, которые не попали в мебель (раковина и стиральная машина сняты с картинки плана)
export const EXTRA = [[249, 3780, 860, 4690, 'раковина'], [249, 4690, 860, 5420, 'стиральная машина'], [847, 6107, 2042, 6705, 'мойка и посудомойка'], [249, 6107, 847, YB, 'кухонная колонна и плита']];
export const RECTS = [
  ...P.walls.map(w => { const xs = w.poly.map(p => p[0]), ys = w.poly.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), 'стена']; }),
  ...P.furniture.map(f => [f.rect[0][0], f.rect[0][1], f.rect[1][0], f.rect[1][1], 'мебель']),
  ...EXTRA,
];
export const hitAt = (x, y) => x < 0 || y < 0 || x > XI || y > YB || RECTS.some(([a, b, c, d]) => x > a && x < c && y > b && y < d);
export function ray(x, y, dx, dy, max = 3000) { for (let s = 0; s <= max; s += 10) if (hitAt(x + dx * s, y + dy * s)) return s; return max; }

// Самый узкий проход вдоль маршрута: сумма лучей влево и вправо от пути, дверные проёмы и точки остановок не считаются.
const inDoor = (x, y) => P.doors.some(d => { const xs = d.poly.map(p => p[0]), ys = d.poly.map(p => p[1]); return x > Math.min(...xs) - 250 && x < Math.max(...xs) + 250 && y > Math.min(...ys) - 250 && y < Math.max(...ys) + 250; });
export function narrowest(path, stops) {
  let best = null;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i], L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
    for (let s = 0; s < L; s += 50) {
      const x = ax + ux * s, y = ay + uy * s;
      if (inDoor(x, y) || stops.some(([sx, sy]) => Math.hypot(x - sx, y - sy) < 500)) continue;
      const l = ray(x, y, -uy, ux), r = ray(x, y, uy, -ux);
      if (!best || l + r < best.w) best = { w: l + r, x, y, nx: -uy, ny: ux, l, r };
    }
  }
  return best;
}

// Шкафы: прямоугольники мебели глубиной 550–650 мм; фронт смотрит от ближайшей стены, проход до первого препятствия.
export function wardrobes() {
  return P.furniture.filter(f => { const w = f.rect[1][0] - f.rect[0][0], h = f.rect[1][1] - f.rect[0][1]; return Math.min(w, h) >= 550 && Math.min(w, h) <= 650 && Math.max(w, h) >= 900 && f.layer === 'Мебель'; })
    .map(f => {
      const [[x0, y0], [x1, y1]] = f.rect, horiz = x1 - x0 > y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      // по всей длине фронта; места, где шкаф упирается в соседний шкаф углом (< 100 мм), не считаем
      const along = (side) => { const ds = []; for (let t = 0.05; t <= 0.95; t += 0.05) { const x = horiz ? x0 + (x1 - x0) * t : side.x, y = horiz ? side.y : y0 + (y1 - y0) * t; const d = ray(x, y, side.dx, side.dy); if (d >= 100) ds.push({ d, x, y }); } return ds.length ? ds.reduce((a, b) => (b.d < a.d ? b : a)) : { d: 0, x: side.x, y: side.y }; };
      const sides = (horiz ? [{ y: y0 - 1, dx: 0, dy: -1 }, { y: y1 + 1, dx: 0, dy: 1 }] : [{ x: x0 - 1, dx: -1, dy: 0 }, { x: x1 + 1, dx: 1, dy: 0 }]).map(sd => ({ ...sd, ...along(sd) }));
      const [back, front] = sides.sort((a, b) => a.d - b.d);
      const room = P.rooms.find(r => { const xs = r.poly.map(p => p[0]), ys = r.poly.map(p => p[1]); return cx > Math.min(...xs) && cx < Math.max(...xs) && cy > Math.min(...ys) && cy < Math.max(...ys); });
      return { rect: f.rect, length: Math.max(x1 - x0, y1 - y0), depth: Math.min(x1 - x0, y1 - y0), passage: front.d, front, room: room?.name };
    });
}
