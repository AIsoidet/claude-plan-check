// /section: разрез 1-1 через кухню-гостиную и окно.
import { P, C, sheet, render, text, f1, scaleBar, north } from './lib.mjs';
import { sectionSvg, keyPlan, XI, CEIL, SLAB, SILL, HEAD } from './section_base.mjs';

const S = sectionSvg([15, 74, 180, 96]);
let body = text(15, 22, 'КЛЮЧЕВОЙ ПЛАН · ЛИНИЯ РАЗРЕЗА 1-1', { size: 2.3, fill: '#6b7280', ls: .4 }) + keyPlan([15, 25, 70, 46]) + north(92, 32, 4);
body += S.svg;
const [lx, ly] = S.T([2500, 2100]);
body += text(lx, ly, 'КУХНЯ-ГОСТИНАЯ', { size: 3, weight: 700, anchor: 'middle', ls: .4 });
const [sx, sy] = S.T([0, -SLAB - 250]);
body += text(sx, sy + 4, '← юго-запад · стена кухни', { size: 2.4, fill: '#4b5563' }) + text(S.T([XI, 0])[0], sy + 4, 'фасад с окнами · северо-восток →', { size: 2.4, fill: '#4b5563', anchor: 'end' });
body += scaleBar(15, 186, S.k);
let legend = '';
legend += `<rect x="15" y="-2.6" width="5" height="3.2" fill="${C.ink}"/>` + text(22, 0, 'В разрезе: плиты перекрытия, стены, подоконная часть и перемычка', { size: 2.8 });
legend += `<rect x="15" y="2.9" width="5" height="3.2" fill="#d9dbe0" stroke="${C.ink}" stroke-width="0.2"/>` + text(22, 5.5, 'Мебель на линии разреза: стулья у обеденного стола, журнальный столик', { size: 2.8 });
legend += `<rect x="15" y="8.4" width="5" height="3.2" fill="none" stroke="#b9bdc4" stroke-width="0.25"/>` + text(22, 11, 'За линией разреза: кухонные шкафы, тумба под ТВ', { size: 2.8 });
legend += text(15, 19, `Высота помещения ${f1(CEIL / 1000, 2)} м · плита ${SLAB} мм · окно ${f1((HEAD - SILL) / 1000, 2)} м в свету по высоте`, { size: 2.8, weight: 600 });
const notes = [
  'Высота потолка 2,7 м и плита 200 мм со слов владельца (типовой монолит); подоконник 800 и перемычка 2400 мм приняты, на плане ЖК их нет.',
  'Высоты мебели приняты типовыми и на чертеже цифрами не показаны. Разрез смотрит на северо-запад, вверх по листу плана.',
];
render('02-section', sheet({ num: '02', cmd: '/section', title: 'Разрез 1-1', subtitle: 'Через кухню-гостиную и окно, отметки от чистого пола.', body, legend, notes }));
