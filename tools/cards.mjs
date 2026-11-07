// Карточки 1080×1350 для поста в стиле канала «ИИ так сойдёт» (необрутализм, рубрика «проверил сам», без енота).
// Чертежи встроены SVG прямо в HTML, рендер headless Chrome. Запуск: node tools/cards.mjs <папка вывода>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { P, C, ZONE, fit, planLayer, poly, line, centroid, f1, room } from './lib.mjs';

const OUT = resolve(process.argv[2] || "out/cards"); mkdirSync(OUT, { recursive: true });
const K = JSON.parse(readFileSync(new URL('../out/checks.json', import.meta.url), 'utf8'));
const R = JSON.parse(readFileSync(new URL('../out/routes.json', import.meta.url), 'utf8'));
// палитра бренда для чертежей
Object.assign(C, { ink: '#000' });
ZONE.night[1] = '#90e0ff'; ZONE.day[1] = '#ff90e8'; ZONE.wet[1] = '#7fe6b0'; ZONE.circ[1] = '#efefef';
const onest = s => s.replace(/font-family="Segoe UI"/g, 'font-family="Onest"');
const m = x => f1(x / 1000, 2);
const LV = { 'НОРМА': ['#000', '#fff'], 'ПРАКТИКА': ['#90e0ff', '#000'], 'ПО ЧЕРТЕЖУ': ['#fff', '#000'], 'НЕ ПРОВЕРЕНО': ['#ff90e8', '#000'], 'ВОПРОС': ['#facc00', '#000'] };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const CSS = `
:root{--ink:#000;--bw:7px;--sh:14px;--r:12px;--bg:#c4f1d0;--main:#05e17a}
*{box-sizing:border-box;margin:0;padding:0}html,body{width:1080px;height:1350px;overflow:hidden}
body{font-family:Onest,sans-serif;background:var(--bg);color:#000;position:relative}
.box{border:var(--bw) solid #000;box-shadow:var(--sh) var(--sh) 0 #000;border-radius:var(--r);background:#fff}
.col{position:absolute;left:60px;right:74px;top:56px;bottom:110px;display:flex;flex-direction:column;gap:34px}
.top{display:flex;justify-content:space-between;align-items:center}
.tag{padding:10px 22px;font-weight:800;font-size:30px;background:var(--main)}
.pg{font-weight:800;font-size:28px}
h1{padding:28px 38px;font-weight:900;font-size:64px;line-height:1.04;letter-spacing:-.02em}
.draw{padding:10px;gap:14px;display:flex;justify-content:center;align-items:center;flex:1 1 auto;min-height:0}
.draw svg{flex:1 1 0;min-width:0;width:100%;height:100%}
.rows{display:flex;flex-direction:column;gap:18px}
.row{display:flex;align-items:center;gap:20px;padding:14px 22px;font-weight:700;font-size:33px;line-height:1.2;white-space:nowrap}
.lv{flex:0 0 auto;padding:6px 14px;border:4px solid #000;border-radius:8px;font-weight:900;font-size:22px;letter-spacing:.04em}
.sol{padding:28px 36px;font-weight:600;font-size:40px;line-height:1.38}
.step{display:flex;gap:20px;margin:8px 0}.step b{background:var(--main);padding:0 12px;border-radius:6px;height:fit-content;margin-top:6px;font-size:32px}
.pros{display:flex;flex-wrap:wrap;gap:22px}.pro{padding:14px 24px;font-weight:800;font-size:34px}
.pro:nth-child(3n+1){background:var(--main)}.pro:nth-child(3n+2){background:#90e0ff}.pro:nth-child(3n){background:#ff90e8}
.foot{position:absolute;left:60px;bottom:46px;font-weight:800;font-size:28px}
.note{position:absolute;right:74px;bottom:46px;font-weight:600;font-size:22px;opacity:.7}`;
const row = (lv, t, wrap) => `<div class="row box"${wrap ? ' style="white-space:normal;font-size:30px"' : ''}><span class="lv" style="background:${LV[lv][0]};color:${LV[lv][1]}">${lv}</span><span>${esc(t)}</span></div>`;
const svg = (vb, inner) => `<svg viewBox="${vb.join(' ')}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">${onest(inner)}</svg>`;
function card(n, total, { h1, draw, rows = [], extra = '', h1size }) {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Onest:wght@500;600;700;800;900&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>
<div class="col"><div class="top"><div class="tag box">Claude Code · план из ЖК</div><div class="pg">${n} / ${total}</div></div>
<h1 class="box"${h1size ? ` style="font-size:${h1size}px"` : ''}>${esc(h1)}</h1>${draw ? `<div class="draw box">${draw}</div>` : ''}${rows.length ? `<div class="rows">${rows.join('')}</div>` : ''}${extra}</div>
<div class="foot">ИИ так сойдёт</div><div class="note">разбор чертежа, не строительная экспертиза</div></body></html>`;
}
const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-family="Onest" font-size="${o.size || 5}" font-weight="${o.w || 700}" fill="${o.fill || '#000'}" text-anchor="${o.a || 'middle'}"${o.stroke ? ` stroke="#fff" stroke-width="${o.stroke}" paint-order="stroke"` : ''}>${esc(s)}</text>`;

// ---------- 1. обложка: аксонометрия из листа /axo ----------
let axo = readFileSync(new URL('../out/01-axo.svg', import.meta.url), 'utf8');
axo = axo.replace(/<svg[^>]*>/, '').replace('</svg>', '');
for (const [a, b] of [['#c7dceb', '#90e0ff'], ['#f5c4b3', '#ff90e8'], ['#cfe7e4', '#7fe6b0'], ['#ece5d8', '#efefef'], ['#1d2430', '#000']]) axo = axo.split(a).join(b);
const axoBody = axo.replace(/<g transform="translate\(0 230\)">[\s\S]*$/, '');   // без заголовка и легенды листа
const cards = [];
cards.push(card(1, 7, { h1: 'Скинул Claude Code план из ЖК. Он нарисовал 6 чертежей и проверил площади', h1size: 58,
  draw: svg([60, 26, 132, 182], axoBody.replace(/<text[^>]*>[^<]*(ПЕРЕКРЫТИЕ|СТЕНЫ|ПОЛ|плита|высота|полезная|КВАРТИРА|01 \/ 06)[^<]*<\/text>/g, '').replace(/<line [^>]*x2="17"[^>]*\/>/g, '')),
  extra: `<div class="pros"><span class="pro box">6 чертежей</span><span class="pro box">нормы СП 54</span><span class="pro box">≈ 20 минут</span></div>` }));

// ---------- 2. площади ----------
{
  const F = fit([0, 0, 100, 130]);
  room('Коридор').label_at = [2650, 5300]; room('Санузел').label_at = [1180, 4700]; room('Прихожая').label_at = [1150, 1500];
  let s = planLayer(F, { fill: 'zone', labelSize: 6, furniture: false });
  for (const n of ['Коридор', 'Санузел', 'Прихожая']) delete room(n).label_at;
  const ca = `${f1(room('Коридор').area_m2, 2)} м²`;
  s = s.replace(/<text[^>]*>Коридор<\/text>/, '').replace(new RegExp(`<text[^>]*>${ca}</text>`), '');
  { const [cx, cy] = F.T([2640, 4480]); s += `<text x="${cx}" y="${cy}" font-family="Onest" font-size="4.6" font-weight="600" text-anchor="middle" transform="rotate(-90 ${cx} ${cy})">Коридор ${ca}</text>`; }
  const circ = K.areaCheck.circ;
  cards.push(card(2, 7, { h1: `Площади: ${K.areaCheck.rooms.filter(r => Math.abs(r.diff) <= 0.05).length} из 6 сходятся с подписями`, draw: svg([6, -1, 90, 132], s), rows: [
    row('НОРМА', `Спальня ${f1(room('Спальня').area_m2, 2)} м², на двоих от 10`),
    row('НОРМА', `Комната ${f1(room('Комната').area_m2, 2)} с пилоном, норма от 8`),
    row('ВОПРОС', `Прихожая с коридором: ${f1(circ.area, 2)} против ${f1(circ.label, 1)}`),
  ] }));
}
// ---------- 3. непроходные комнаты: пузыри из листа /bubble ----------
{
  let b = readFileSync(new URL('../out/06-bubble.svg', import.meta.url), 'utf8').replace(/<svg[^>]*>/, '').replace('</svg>', '');
  for (const [a, c] of [['#c7dceb', '#90e0ff'], ['#f5c4b3', '#ff90e8'], ['#cfe7e4', '#7fe6b0'], ['#ece5d8', '#efefef'], ['#1d2430', '#000']]) b = b.split(a).join(c);
  b = b.replace(/<g transform="translate\(0 230\)">[\s\S]*$/, '').replace(/<text[^>]*>(КВАРТИРА|06 \/ 06)[^<]*<\/text>/g, '');
  // кадр по реальным кругам (пузыри и ПОДЪЕЗД) с запасом 4 мм
  const cs = [...b.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map(m => m.slice(1).map(Number));
  const bx0 = Math.min(...cs.map(([x, , r]) => x - r)) - 4, bx1 = Math.max(...cs.map(([x, , r]) => x + r)) + 4;
  const by0 = Math.min(...cs.map(([, y, r]) => y - r)) - 4, by1 = Math.max(...cs.map(([, y, r]) => y + r)) + 4;
  cards.push(card(3, 7, { h1: 'Обе комнаты выходят в коридор', draw: svg([bx0, by0, bx1 - bx0, by1 - by0], b), rows: [
    row('НОРМА', 'СП 54 п. 5.6: жилые комнаты непроходные'),
  ] }));
}
// ---------- 4. мебель и проходы ----------
{
  const F = fit([0, 0, 100, 130]);
  let s = planLayer(F, { fill: 'none', grey: true, labels: false });
  const bd = K.fit.bed, B = P.furniture.find(f => f.rect[1][0] - f.rect[0][0] > 1500 && f.rect[1][1] - f.rect[0][1] > 1900).rect;
  const [a, b] = F.Tp(B);
  s += `<rect x="${a[0]}" y="${a[1]}" width="${b[0] - a[0]}" height="${b[1] - a[1]}" fill="#90e0ff" stroke="#000" stroke-width="0.6"/>`;
  const dim = (p, q, t, o = {}) => { const A = F.T(p), Bq = F.T(q); return line(A, Bq, 'stroke="#000" stroke-width="0.7"') + `<circle cx="${A[0]}" cy="${A[1]}" r="0.9"/><circle cx="${Bq[0]}" cy="${Bq[1]}" r="0.9"/>` + T((A[0] + Bq[0]) / 2 + (o.dx || 0), (A[1] + Bq[1]) / 2 + (o.dy || 0), t, { size: 3.6, stroke: 1.2 }); };
  const yb = (B[0][1] + B[1][1]) / 2 - 300;
  s += dim([B[0][0] - bd.left, yb], [B[0][0], yb], m(bd.left), { dy: -2.5 }) + dim([B[1][0], yb], [B[1][0] + bd.right, yb], m(bd.right), { dy: -2.5 }) + dim([(B[0][0] + B[1][0]) / 2, B[0][1] - bd.foot], [(B[0][0] + B[1][0]) / 2, B[0][1]], m(bd.foot), { dx: 7 });
  // кухня: две столешницы
  const k1 = F.Tp([[249, 6107], [847, 8946]]), k2 = F.Tp([[847, 6107], [2042, 6705]]);
  for (const [p, q] of [k1, k2]) s += `<rect x="${p[0]}" y="${p[1]}" width="${q[0] - p[0]}" height="${q[1] - p[1]}" fill="#ff90e8" stroke="#000" stroke-width="0.6"/>`;
  s += T((k1[0][0] + k1[1][0]) / 2 + 1.2, (k1[0][1] + k1[1][1]) / 2, m(K.fit.kitchen.long), { size: 3.4, stroke: 1 }).replace('<text ', `<text transform="rotate(-90 ${(k1[0][0] + k1[1][0]) / 2} ${(k1[0][1] + k1[1][1]) / 2})" `);
  s += T((k2[0][0] + k2[1][0]) / 2, (k2[0][1] + k2[1][1]) / 2 + 1.2, m(K.fit.kitchen.short), { size: 3.4, stroke: 1 });
  // самый узкий проход
  const np = K.passages.reduce((x, y) => (y.w < x.w ? y : x));
  const A = [np.x - np.nx * np.r, np.y - np.ny * np.r], Bp = [np.x + np.nx * np.l, np.y + np.ny * np.l];
  s += line(F.T(A), F.T(Bp), 'stroke="#d10b5b" stroke-width="1.2"') + T(F.T(np.x > 0 ? [np.x, np.y] : A)[0] + 9, F.T([np.x, np.y])[1] + 1.6, m(np.w), { size: 3.6, fill: '#d10b5b', stroke: 1.2 });
  const vb = (a, b) => { const p = F.T(a), q = F.T(b); return [p[0], p[1], q[0] - p[0], q[1] - p[1]]; };
  cards.push(card(4, 7, { h1: 'Кровать и кухня: замеры по чертежу', draw: svg(vb([1500, 150], [6350, 3100]), s) + svg(vb([150, 5950], [3300, 9050]), s), rows: [
    row('ПРАКТИКА', `Кровать: проходы ${m(bd.left)} и ${m(bd.right)}, надо от 0,55`),
    row('ПРАКТИКА', `Кухня ${m(K.fit.kitchen.long)} × ${m(K.fit.kitchen.short)}, обычно от 2,7 × 2,0`),
    row('ПО ЧЕРТЕЖУ', `Самый узкий проход ${m(np.w)} м, у кухни`),
  ] }));
}
// ---------- 5. солнце ----------
{
  const W = 200, x0 = 46, x1 = 192, hx = h => x0 + (x1 - x0) * h / 24;
  let s = '';
  for (let h = 0; h <= 24; h += 3) s += line([hx(h), 8], [hx(h), 104], 'stroke="#d0d0d0" stroke-width="0.3"') + T(hx(h), 112, `${h}:00`, { size: 5, w: 600 });
  K.sun.forEach((d, i) => {
    const y = 14 + i * 24;
    s += T(x0 - 4, y + 8, d.date, { size: 6, a: 'end' }) + `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="12" fill="#f3f3f3" stroke="#000" stroke-width="0.5" rx="2"/>`;
    if (d.hours) s += `<rect x="${hx(d.from)}" y="${y}" width="${hx(d.to) - hx(d.from)}" height="12" fill="#facc00" stroke="#000" stroke-width="0.7" rx="2"/>` + T((hx(d.from) + hx(d.to)) / 2, y + 8.6, `${f1(d.hours, 1)} ч`, { size: 6 });
    else s += T((x0 + x1) / 2, y + 8.6, 'солнца в окнах нет', { size: 6, w: 600, fill: '#555' });
  });
  const a = K.sun[0];
  cards.push(card(5, 7, { h1: 'Окна на северо-восток: солнце только утром', draw: svg([4, 6, 192, 110], s), rows: [
    row('ПО ЧЕРТЕЖУ', 'Жёлтым: солнце перед окнами'),
    row('НЕ ПРОВЕРЕНО', 'Соседние дома не учтены'),
    row('ВОПРОС', 'Спросить заключение по инсоляции'),
  ] }));
}
// ---------- 6. что спросить ----------
cards.push(card(6, 7, { h1: '5 вопросов застройщику по этому плану', rows: K.questions.map(q => row('ВОПРОС', q.replace(/ \(СП 54 п\. 7\.20\)/, ''), true)), extra: '' }));
// ---------- 7. как повторить ----------
cards.push(card(7, 7, { h1: 'Это пример. Команды правятся под свой план',
  extra: `<div class="sol box"><div class="step"><b>1</b><span>Кладёшь план квартиры в папку</span></div><div class="step"><b>2</b><span>Пишешь /zones, /flow, /sun и ещё 4 команды</span></div><div class="step"><b>3</b><span>Claude сверяет площади и рисует чертёж кодом</span></div></div>
  <div class="sol box" style="font-size:34px">Размеров на плане ЖК нет, поэтому масштаб считается по площадям комнат. Нормы и практика подписаны, где что.</div>
  <div class="pros"><span class="pro box">7 команд</span><span class="pro box">без генератора картинок</span><span class="pro box">разбор в Telegram</span></div>` }));

// ---------- рендер ----------
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
cards.forEach((html, i) => {
  const f = resolve(OUT, `${i + 1}.html`), png = resolve(OUT, `${i + 1}.png`);
  writeFileSync(f, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1080,1350', '--virtual-time-budget=5000', `--screenshot=${png}`, pathToFileURL(f).href], { stdio: 'ignore' });
  console.log(png);
});
