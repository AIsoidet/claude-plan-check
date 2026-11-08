"""Помощник обводки растрового плана (картинки с сайта ЖК).

  python tools/trace_raster.py mask src/plan.png            маска стен -> out/_walls_mask.png
  python tools/trace_raster.py scan out/_walls_mask.png row 567 130 800     куски стены вдоль строки (x0..x1): дверные и оконные проёмы это разрывы
  python tools/trace_raster.py scan out/_walls_mask.png col 473 240 660     то же вдоль столбца
  python tools/trace_raster.py overlay                      обводка из plan.json поверх картинки -> out/_overlay.png

Нужны Pillow, numpy, scipy. Многоугольники в plan.json обводит сам Claude по маске и разрывам;
координаты пикселей переводятся в мм по plan.json -> trace (scale_mm_per_px, origin_px).
"""
import sys, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

def mask(path, opening=6):
    a = np.array(Image.open(path).convert('RGB')).astype(int)
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = (mx - mn) > 60                                   # цветные пиксели (стены обычно цветные, чертёж серый/чёрный)
    from collections import Counter
    q = (a // 16 * 16)[sat]
    col = np.array(Counter(map(tuple, q.tolist())).most_common(1)[0][0])
    m = (np.abs(a - col - 8).sum(axis=2) < 90) & sat
    m = ndi.binary_opening(m, structure=np.ones((opening, opening)))   # тонкие линии мебели и дуги дверей пропадают, остаются стены
    print('цвет стен ~', col.tolist(), 'пикселей маски', int(m.sum()))
    return m

def scan(mask_path, axis, pos, a, b):
    m = np.array(Image.open(mask_path)) > 0
    line = m[pos, a:b] if axis == 'row' else m[a:b, pos]
    d = np.diff(np.r_[0, line.astype(int), 0]); s = np.where(d == 1)[0] + a; e = np.where(d == -1)[0] + a
    print(f'{axis} {pos}: куски стены (от, до):', list(zip(s.tolist(), e.tolist())))

def overlay(plan_path='plan.json', out='out/_overlay.png'):
    P = json.load(open(plan_path, encoding='utf-8')); t = P['trace']; S = t['scale_mm_per_px']; ox, oy = t['origin_px']
    im = Image.open(t['image']).convert('RGB'); d = ImageDraw.Draw(im, 'RGBA')
    back = lambda p: (p[0] / S + ox, p[1] / S + oy)
    for r in P['rooms']: d.polygon([back(p) for p in r['poly']], outline=(255, 0, 0, 255), fill=(255, 0, 0, 40))
    for w in P['walls']: d.polygon([back(p) for p in w['poly']], outline=(0, 0, 255, 255))
    for f in P['furniture']: d.polygon([back(p) for p in f['poly']], outline=(255, 120, 0, 255))
    for w in P['windows']: d.rectangle([back(w['p0']), back(w['p1'])], outline=(0, 200, 255, 255))
    for g in P['doors']: d.line([back(g['a']), back(g['b'])], fill=(255, 0, 255, 255), width=3)
    im.resize((im.width * 2, im.height * 2)).save(out); print(out)

if __name__ == '__main__':
    c = sys.argv[1:]
    if not c: print(__doc__)
    elif c[0] == 'mask':
        m = mask(c[1]); Image.fromarray((m * 255).astype('uint8')).save('out/_walls_mask.png'); print('out/_walls_mask.png')
    elif c[0] == 'scan': scan(c[1], c[2], int(c[3]), int(c[4]), int(c[5]))
    elif c[0] == 'overlay': overlay()
