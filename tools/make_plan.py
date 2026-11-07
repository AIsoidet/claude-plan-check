"""Собрать plan.json (мм) из векторного плана src/plan.svg. Координаты помещений сняты с геометрии слоёв (единицы SVG),
масштаб считается по площадям двух помещений с подписью. Запуск: python tools/make_plan.py"""
import json, xml.etree.ElementTree as ET, re
NS = '{http://www.w3.org/2000/svg}'
OX, OY = 56.94, 0.07                                   # наружный левый верхний угол квартиры

def area(poly):
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]))) / 2
def R(x0, y0, x1, y1): return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]

# помещения (единицы SVG), подпись площади с плана
rooms = {
  'Спальня':        dict(label=10.4, zone='night', poly=[(247.5, 27.04), (778.12, 27.04), (778.12, 349.52), (443.91, 349.52), (443.91, 211.73), (247.5, 211.73)]),
  # в правом верхнем углу комнаты пилон 1,35 × 0,25 м (слои «Элементы_узлов» и «Несущие_колонны»)
  'Комната':        dict(label=8.2,  zone='night', poly=[(443.91, 364.18), (619.85, 364.18), (619.85, 378.83), (778.12, 378.83), (778.12, 704.24), (443.91, 704.24)]),
  'Кухня-гостиная': dict(label=16.8, zone='day',   poly=[(86.26, 718.9), (306.13, 718.9), (306.13, 704.24), (429.26, 704.24), (429.26, 718.9), (778.12, 718.9), (778.12, 1053.1), (86.26, 1053.1)]),
  'Санузел':        dict(label=4.3,  zone='wet',   poly=R(86.26, 378.83, 291.47, 668.48)),
  # граница прихожей и коридора на плане не нарисована: провёл по низу пилона у санузла (y 349.52) и по стене шкафа (x 232.84)
  'Прихожая':       dict(label=3.3,  zone='circ',  poly=[(112.06, 27.04), (232.84, 27.04), (232.84, 349.52), (86.26, 349.52), (86.26, 114.99), (112.06, 114.99)]),
  'Коридор':        dict(label=5.2,  zone='circ',  poly=[(232.84, 349.52), (232.84, 226.39), (429.26, 226.39), (429.26, 704.24), (306.13, 704.24), (306.13, 364.17), (236.36, 364.17), (236.36, 349.52)]),
}
TOTAL_LABEL = 48.1
# масштаб по двум помещениям, замкнутым стенами и без пилонов: спальня и санузел
SCALE_ROOMS = ('Спальня', 'Санузел')
s2 = [r['label'] * 1e6 / area(r['poly']) for n, r in rooms.items() if n in SCALE_ROOMS]
print('расхождение масштаба по двум помещениям', f'{abs(s2[0] - s2[1]) / min(s2) * 100:.2f}%')
S = (sum(s2) / len(s2)) ** .5
mm = lambda p: [round((p[0] - OX) * S), round((p[1] - OY) * S)]

walls = [  # наружные стены, пилоны и перегородки (прямоугольники, единицы SVG)
  ('ext', R(56.94, 0.07, 112.06, 114.99)), ('ext', R(56.94, 238.12, 86.26, 378.83)), ('ext', R(56.94, 378.83, 86.26, 1053.1)),
  ('ext', R(56.94, 1053.1, 807.43, 1080.07)), ('ext', R(112.06, 0.07, 778.12, 27.04)),
  ('ext', R(778.12, 0.07, 807.43, 75.12)), ('ext', R(778.12, 301.44, 807.43, 426.91)), ('ext', R(778.12, 653.23, 807.43, 778.7)), ('ext', R(778.12, 1005.02, 807.43, 1080.07)),
  ('col', R(86.26, 349.52, 236.36, 378.83)), ('col', R(83.67, 668.48, 306.13, 718.9)),
  ('part', R(232.84, 27.04, 247.5, 226.39)), ('part', R(247.5, 211.73, 317.86, 226.39)), ('part', R(423.4, 211.73, 443.91, 226.39)),
  ('part', R(429.26, 226.39, 443.91, 443.33)), ('part', R(429.26, 548.87, 443.91, 704.24)), ('part', R(429.26, 704.24, 778.12, 718.9)),
  ('part', R(443.91, 349.52, 619.85, 364.18)), ('col', R(619.85, 349.53, 779.48, 378.83)), ('part', R(236.36, 364.17, 306.13, 378.83)),
  ('part', R(291.47, 378.83, 306.13, 469.13)), ('part', R(291.47, 562.94, 306.13, 668.48)),
]
windows = [dict(room=r, wall='east', y0=a, y1=b) for r, a, b in (('Спальня', 75.12, 301.44), ('Комната', 426.91, 653.23), ('Кухня-гостиная', 778.7, 1005.02))]
doors = [
  dict(name='входная', between=['Прихожая', 'ПОДЪЕЗД'], rect=R(56.94, 114.99, 86.26, 238.12), leaf=True),
  dict(name='в спальню', between=['Коридор', 'Спальня'], rect=R(317.86, 211.73, 423.4, 226.39), leaf=False),
  dict(name='в комнату', between=['Коридор', 'Комната'], rect=R(429.26, 443.33, 443.91, 548.87), leaf=False),
  dict(name='в санузел', between=['Коридор', 'Санузел'], rect=R(291.47, 469.13, 306.13, 562.94), leaf=True),
]
open_links = [['Прихожая', 'Коридор'], ['Коридор', 'Кухня-гостиная']]

# мебель и сантехника: рамки верхнеуровневых групп слоёв
root = ET.parse('src/plan.svg').getroot()
def bbox(el):
    xs, ys = [], []
    for e in el.iter():
        t = e.tag.replace(NS, '')
        if t == 'rect':
            x, y, w, h = (float(e.get(k)) for k in ('x', 'y', 'width', 'height')); xs += [x, x + w]; ys += [y, y + h]
        elif t in ('polygon', 'polyline'):
            v = [float(q) for q in re.findall(r'-?\d+\.?\d*', e.get('points'))]; xs += v[0::2]; ys += v[1::2]
        elif t == 'line':
            xs += [float(e.get('x1')), float(e.get('x2'))]; ys += [float(e.get('y1')), float(e.get('y2'))]
        elif t == 'path':
            v = [float(q) for q in re.findall(r'-?\d+\.?\d*', e.get('d'))]
            if e.get('d', '').lstrip()[0] == 'M' and len(v) >= 2: xs.append(v[0]); ys.append(v[1])
    return (min(xs), min(ys), max(xs), max(ys)) if xs else None
furniture = []
for lay in root.findall(NS + 'g'):
    if lay.get('id') not in ('Мебель', 'Сантехнические_приборы', 'Оборудование'): continue
    for ch in lay:
        b = bbox(ch)
        if b and (b[2] - b[0]) * S > 250 and (b[3] - b[1]) * S > 250:
            furniture.append(dict(layer=lay.get('id'), rect=[mm((b[0], b[1])), mm((b[2], b[3]))]))

out = dict(
  source='src/plan.svg (векторный план ЖК, без размерных цепочек); масштаб по площадям Спальни и Санузла',
  scale_mm_per_unit=round(S, 4), units='mm',
  north_deg=45, north_source='роза ветров на скриншоте с сайта ЖК (src/plan-site.png): север вверх-вправо',
  city='Екатеринбург', latitude=56.84, latitude_source='Алекс',
  ceiling_m=2.7, slab_mm=200, heights_source='Алекс (типовой монолит)',
  sill_mm=None, head_mm=None, window_note='высоты подоконника и перемычки на плане нет',
  total_label_m2=TOTAL_LABEL,
  rooms=[dict(name=n, zone=r['zone'], label_m2=r['label'], area_m2=round(area(r['poly']) * S * S / 1e6, 2), poly=[mm(p) for p in r['poly']]) for n, r in rooms.items()],
  walls=[dict(kind=k, poly=[mm(p) for p in pl]) for k, pl in walls],
  windows=[dict(room=w['room'], wall='east', y0=mm((0, w['y0']))[1], y1=mm((0, w['y1']))[1]) for w in windows],
  doors=[dict(name=d['name'], between=d['between'], leaf=d['leaf'], poly=[mm(p) for p in d['rect']]) for d in doors],
  open_links=open_links, furniture=furniture,
  outline_mm=[mm((56.94, 0.07)), mm((807.43, 1080.07))], facade_outer_x_mm=mm((822.68, 0))[0],
)
json.dump(out, open('plan.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'масштаб {S:.4f} мм/ед')
tot = 0
for r in out['rooms']:
    tot += r['area_m2']; d = r['area_m2'] - r['label_m2']
    print(f"{r['name']:15s} по контуру {r['area_m2']:6.2f}  подпись {r['label_m2']:5.1f}  разница {d:+.2f}")
print(f'сумма по контурам {tot:.2f}, сумма подписей {sum(r["label_m2"] for r in out["rooms"]):.1f}, общая на плане {TOTAL_LABEL}')
door_area = sum(area([((x / S) + OX, (y / S) + OY) for x, y in d['poly']]) for d in out['doors'][1:]) * S * S / 1e6
print(f'площадь трёх внутренних дверных проёмов {door_area:.2f} м²; мебели {len(furniture)} шт')
