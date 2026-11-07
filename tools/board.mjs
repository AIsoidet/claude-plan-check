// /board: планшет A3 альбомный в стиле канала. Исходный план крупно слева, шесть листов справа. Рендер headless Chrome.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const SHEETS = [['01-axo', '/axo'], ['04-zones', '/zones'], ['02-fit', '/fit'], ['03-flow', '/flow'], ['05-sun', '/sun'], ['06-bubble', '/bubble']];
const out = f => resolve('out', f);
for (const [f, cmd] of SHEETS) if (!existsSync(out(`${f}.png`))) execSync(`node tools/${cmd.slice(1)}.mjs`, { stdio: 'inherit' });
writeFileSync(out('00-source.png'), new Resvg(readFileSync('src/plan.svg', 'utf8'), { fitTo: { mode: 'width', value: 1600 }, background: '#ffffff' }).render().asPng());

const cell = (src, label, cls = '') => `<div class="cell ${cls}"><div class="lab">${label}</div><div class="img box"><img src="${src}"></div></div>`;
const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@500;600;700;800;900&display=swap" rel="stylesheet"><style>
*{box-sizing:border-box;margin:0;padding:0}html,body{width:1680px;height:1188px;overflow:hidden}
body{font-family:Onest,sans-serif;background:#c4f1d0;color:#000;position:relative}
.box{border:5px solid #000;box-shadow:10px 10px 0 #000;border-radius:10px;background:#fff}
.head{position:absolute;left:56px;top:40px;right:60px;display:flex;align-items:flex-end;gap:28px}
h1{font-weight:900;font-size:60px;letter-spacing:-.02em;padding:12px 28px;white-space:nowrap;flex:none}
.sub{font-weight:600;font-size:21px;line-height:1.3;max-width:700px;padding-bottom:6px}
.tag{margin-left:auto;align-self:flex-start;flex:none;background:#05e17a;font-weight:800;font-size:24px;padding:8px 18px}
.grid{position:absolute;left:56px;top:190px;right:66px;bottom:70px;display:grid;grid-template-columns:600px 1fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:26px 30px}
.cell{display:flex;flex-direction:column;gap:8px;min-height:0}.big{grid-row:1 / span 2}
.lab{font-weight:800;font-size:22px}.img{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:6px;overflow:hidden}
.img img{max-width:100%;max-height:100%;object-fit:contain;display:block}
.foot{position:absolute;left:56px;bottom:24px;font-weight:800;font-size:22px}.note{position:absolute;right:66px;bottom:24px;font-weight:600;font-size:18px;opacity:.75}
</style></head><body>
<div class="head"><h1 class="box">1 план, 6 чертежей</h1><div class="sub">Claude Code по семи командам: сверка площадей по чертежу, нормы СП 54 и практика с пометкой, что есть что. Чертежи нарисованы кодом, без генератора картинок.</div><div class="tag box">ai_soidet</div></div>
<div class="grid">${cell('00-source.png', 'Исходный план ЖК · 48,1 м² · без размеров, только площади', 'big')}${SHEETS.map(([f, c]) => cell(`${f}.png`, c)).join('')}</div>
<div class="foot">ИИ так сойдёт</div><div class="note">разбор чертежа, не строительная экспертиза · это пример, команды правятся под свой план</div>
</body></html>`;
writeFileSync(out('07-board.html'), html);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=3', '--window-size=1680,1188', '--virtual-time-budget=6000', `--screenshot=${out('07-board.png')}`, pathToFileURL(out('07-board.html')).href], { stdio: 'ignore' });
console.log(out('07-board.png'));
