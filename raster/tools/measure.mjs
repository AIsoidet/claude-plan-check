// Замеры по plan.json (многоугольники) без раздувания: лучи до ближайшего препятствия, самый узкий проход, шкафы.
// Препятствия растрируются в сетку 10 мм: бит 1 = снаружи, стена или мебель, бит 2 = тумбы (их можно игнорировать).
import { P } from './lib.mjs';

export const GR = 10;
const XW = Math.max(...P.outline.map(p => p[0])), YH = Math.max(...P.outline.map(p => p[1]));
const NXg = Math.ceil(XW / GR) + 2, NYg = Math.ceil(YH / GR) + 2;
const grid = new Uint8Array(NXg * NYg);

export function pip(x, y, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function fillPoly(poly, bit) {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const i0 = Math.max(0, Math.floor(Math.min(...xs) / GR)), i1 = Math.min(NXg - 1, Math.ceil(Math.max(...xs) / GR));
  const j0 = Math.max(0, Math.floor(Math.min(...ys) / GR)), j1 = Math.min(NYg - 1, Math.ceil(Math.max(...ys) / GR));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (pip(i * GR + GR / 2, j * GR + GR / 2, poly)) grid[j * NXg + i] |= bit;
}
for (let j = 0; j < NYg; j++) for (let i = 0; i < NXg; i++) if (!pip(i * GR + GR / 2, j * GR + GR / 2, P.outline)) grid[j * NXg + i] |= 1;
for (const w of P.walls) fillPoly(w.poly, 1);
for (const f of P.furniture) fillPoly(f.poly, f.name === 'тумба' ? 2 : 1);

export const hitAt = (x, y, tumba = true) => { const i = Math.floor(x / GR), j = Math.floor(y / GR); if (i < 0 || j < 0 || i >= NXg || j >= NYg) return true; return (grid[j * NXg + i] & (tumba ? 3 : 1)) !== 0; };
export function ray(x, y, dx, dy, max = 3000, tumba = true) { for (let s = 0; s <= max; s += GR) if (hitAt(x + dx * s, y + dy * s, tumba)) return s; return max; }
export const bbox = poly => { const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
export const byName = n => P.furniture.filter(f => f.name === n);

// Самый узкий проход вдоль маршрута: сумма лучей влево и вправо от пути, дверные проёмы и точки остановок не считаются.
const inDoor = (x, y) => P.doors.some(d => x > Math.min(d.a[0], d.b[0]) - 250 && x < Math.max(d.a[0], d.b[0]) + 250 && y > Math.min(d.a[1], d.b[1]) - 250 && y < Math.max(d.a[1], d.b[1]) + 250);
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

// Шкафы в прихожей 8,2: прямоугольники глубиной от 400 мм; фронт смотрит от ближайшей стены, проход до первого препятствия.
export function wardrobes() {
  return P.furniture.filter(f => f.name === 'шкаф в прихожей' && Math.min(bbox(f.poly)[2] - bbox(f.poly)[0], bbox(f.poly)[3] - bbox(f.poly)[1]) >= 400)
    .map(f => {
      const [x0, y0, x1, y1] = bbox(f.poly), horiz = x1 - x0 > y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const along = side => { const ds = []; for (let t = 0.05; t <= 0.95; t += 0.05) { const x = horiz ? x0 + (x1 - x0) * t : side.x, y = horiz ? side.y : y0 + (y1 - y0) * t; const d = ray(x, y, side.dx, side.dy); if (d >= 100) ds.push({ d, x, y }); } return ds.length ? ds.reduce((a, b) => (b.d < a.d ? b : a)) : { d: 0, x: side.x, y: side.y }; };
      const sides = (horiz ? [{ y: y0 - GR, dx: 0, dy: -1 }, { y: y1 + GR, dx: 0, dy: 1 }] : [{ x: x0 - GR, dx: -1, dy: 0 }, { x: x1 + GR, dx: 1, dy: 0 }]).map(sd => ({ ...sd, ...along(sd) }));
      const [, front] = sides.sort((a, b) => a.d - b.d);
      const room = P.rooms.find(r => pip(cx, cy, r.poly));
      return { rect: [[x0, y0], [x1, y1]], length: Math.max(x1 - x0, y1 - y0), depth: Math.min(x1 - x0, y1 - y0), passage: front.d, front, room: room?.name };
    });
}
