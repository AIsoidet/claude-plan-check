// Общая геометрия разреза 1-1 для /section и /sun: всё в мм вдоль линии разреза (x) и по высоте (z, вверх).
import { P, C, text, line, poly, fmtLvl, f1, fit, planLayer, room } from './lib.mjs';

export const Y = P.section.y_mm;
const wallsAt = P.walls.map(w => { const xs = w.poly.map(p => p[0]), ys = w.poly.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), w.kind]; })
  .filter(([, y0, , y1]) => y0 <= Y && Y <= y1);
export const XI = room('Спальня').poly[1][0];                         // внутренняя грань фасадной стены
export const XO = P.outline_mm[1][0], XF = P.facade_outer_x_mm;       // наружная грань стены и фасадного слоя
export const CEIL = P.ceiling_m * 1000, SLAB = P.slab_mm, SILL = P.sill_mm, HEAD = P.head_mm;
export const win = P.windows.find(w => w.y0 <= Y && Y <= w.y1);
const cutF = P.furniture.filter(f => f.rect[0][1] <= Y && Y <= f.rect[1][1]);
const seenF = P.furniture.filter(f => f.rect[1][1] < Y && f.rect[1][1] > Y - 2000 && f.layer === 'Мебель');
// высоты мебели на плане не заданы: приняты типовые, в разрез не идут цифрами
const hOf = f => { const w = f.rect[1][0] - f.rect[0][0], d = f.rect[1][1] - f.rect[0][1]; if (f.rect[0][0] < 900 && w < 700) return 850; if (w > 2000) return 800; if (w < 340 && d < 340) return 450; if (w < 1000 && d < 600) return 400; return 750; };
export const obstacles = cutF.map(f => [f.rect[0][0], f.rect[1][0], hOf(f)]);   // для луча солнца

// Нарисовать разрез в рамке box; возвращает {svg, T} где T([x, z]) → лист.
export function sectionSvg(box, o = {}) {
  const [bx, by, bw, bh] = box, x0 = o.levelsLeft ? -3200 : -400, x1 = XF + (o.levelsLeft ? 1200 : 1500), z0 = -SLAB - 300, z1 = CEIL + SLAB + 300;
  const k = Math.min(bw / (x1 - x0), bh / (z1 - z0));
  const T = ([x, z]) => [bx + (x - x0) * k, by + bh - (z - z0) * k];
  const R = (xa, za, xb, zb, attrs) => { const a = T([xa, zb]), b = T([xb, za]); return `<rect x="${a[0]}" y="${a[1]}" width="${b[0] - a[0]}" height="${b[1] - a[1]}" ${attrs}/>`; };
  let s = '';
  // за линией разреза: стены дальнего плана и кухонные шкафы тонким серым
  s += R(0, 0, XO, CEIL, `fill="#f6f5f2" stroke="none"`);
  for (const f of seenF) s += R(f.rect[0][0], 0, f.rect[1][0], hOf(f), `fill="none" stroke="#b9bdc4" stroke-width="0.15"`);
  // разрезанное: плиты, стены, мебель
  s += R(-400, -SLAB, XF + 200, 0, `fill="${C.ink}"`) + R(-400, CEIL, XF + 200, CEIL + SLAB, `fill="${C.ink}"`);
  for (const [xa, , xb, , kind] of wallsAt) if (!(xa >= XI - 5 && win)) s += R(xa, 0, xb, CEIL, `fill="${C.ink}"`);
  if (win) {   // фасадная стена с окном: подоконная часть, перемычка, стекло в наружном слое
    s += R(XI, 0, XO, SILL, `fill="${C.ink}"`) + R(XI, HEAD, XO, CEIL, `fill="${C.ink}"`);
    s += R(XO, 0, XF, SILL, `fill="#5b6270"`) + R(XO, HEAD, XF, CEIL + SLAB, `fill="#5b6270"`);
    const gx = (XO + XF) / 2; s += line(T([gx, SILL]), T([gx, HEAD]), `stroke="#6aa9d6" stroke-width="0.5"`) + line(T([XO, SILL]), T([XO, HEAD]), `stroke="${C.ink}" stroke-width="0.12"`) + line(T([XF, SILL]), T([XF, HEAD]), `stroke="${C.ink}" stroke-width="0.12"`);
  }
  for (const [xa, xb, h] of obstacles) s += R(xa, 0, xb, h, `fill="#d9dbe0" stroke="${C.ink}" stroke-width="0.2"`);
  // люди для масштаба: 1750 мм
  for (const px of (o.people || [1250, 3600])) {
    const [hx, hy] = T([px, 1600]), r = 120 * k;
    s += `<circle cx="${hx}" cy="${hy}" r="${r}" fill="none" stroke="${C.ink}" stroke-width="0.25"/>` +
      `<path d="M${T([px, 1480])} L${T([px, 850])} M${T([px - 170, 0])} L${T([px, 850])} L${T([px + 170, 0])} M${T([px - 230, 1050])} L${T([px, 1380])} L${T([px + 230, 1050])}" fill="none" stroke="${C.ink}" stroke-width="0.25" stroke-linecap="round"/>`;
  }
  // отметки справа
  const left = o.levelsLeft, lx = left ? -700 : XF + 300;
  const marks = [[0, 'чистый пол'], [CEIL, 'низ перекрытия'], [CEIL + SLAB, 'верх перекрытия'], [-SLAB, 'низ плиты']];
  if (o.windowMarks !== false && win) marks.push([SILL, 'подоконник, принято'], [HEAD, 'перемычка, принято']);
  for (const [z, lab] of marks) { const [ax, ay] = T([lx, z]); s += `<path d="M${ax},${ay} l1.4,-1.4 h-2.8 z" fill="${C.ink}"/>` + line([ax - 3, ay], [ax + 3, ay], `stroke="${C.ink}" stroke-width="0.15"`) + text(ax + (left ? -2.4 : 2.4), ay + (z < 0 ? 2.6 : z === CEIL ? 2.6 : -0.6), `${fmtLvl(z / 1000)}  ${lab}`, { size: 2.2, weight: 600, anchor: left ? 'end' : 'start' }); }
  return { svg: s, T, k };
}

// Ключевой план с линией разреза.
export function keyPlan(box) {
  const F = fit(box);
  let s = planLayer(F, { fill: 'grey', grey: true, labels: false, furniture: false });
  const a = F.T([-300, Y]), b = F.T([XF + 300, Y]);
  s += line(a, b, `stroke="${C.winter}" stroke-width="0.6" stroke-dasharray="2 1"`);
  for (const p of [a, b]) s += `<path d="M${p[0]},${p[1]} v-3 m-1,1 l1,-1.2 l1,1.2" fill="none" stroke="${C.winter}" stroke-width="0.4"/>` + text(p[0] + (p === a ? -2.5 : 1), p[1] + 1, '1', { size: 2.6, weight: 700, fill: C.winter });
  return s;
}
