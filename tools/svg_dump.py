"""Вытащить геометрию слоёв из SVG-плана: многоугольники (вершины) по слоям, в единицах файла."""
import re, sys, json, xml.etree.ElementTree as ET
NS = '{http://www.w3.org/2000/svg}'
TOK = re.compile(r'[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?')

def path_pts(d):
    toks = TOK.findall(d); i = 0; cmd = None; x = y = 0; sx = sy = 0; out = []; cur = []
    nargs = dict(M=2, L=2, H=1, V=1, C=6, S=4, Q=4, T=2, A=7, Z=0)
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t; i += 1
            if cmd in 'Zz':
                x, y = sx, sy
                if cur: out.append(cur); cur = []
                continue
        n = nargs[cmd.upper()]; a = [float(v) for v in toks[i:i + n]]; i += n
        rel = cmd.islower(); C = cmd.upper()
        if C == 'H': x = a[0] + (x if rel else 0)
        elif C == 'V': y = a[0] + (y if rel else 0)
        else:
            nx, ny = a[-2], a[-1]
            x, y = (x + nx, y + ny) if rel else (nx, ny)
        if C == 'M':
            if cur: out.append(cur)
            cur = []; sx, sy = x, y
            cmd = 'l' if rel else 'L'
        cur.append((round(x, 2), round(y, 2)))
    if cur: out.append(cur)
    return out

def shapes(el):
    tag = el.tag.replace(NS, '')
    if tag in ('polygon', 'polyline'):
        v = [float(t) for t in re.findall(r'-?\d+\.?\d*', el.get('points'))]
        return [list(zip(v[0::2], v[1::2]))]
    if tag == 'rect':
        x, y, w, h = (float(el.get(k)) for k in ('x', 'y', 'width', 'height'))
        return [[(x, y), (x + w, y), (x + w, y + h), (x, y + h)]]
    if tag == 'line':
        return [[(float(el.get('x1')), float(el.get('y1'))), (float(el.get('x2')), float(el.get('y2')))]]
    if tag == 'path': return path_pts(el.get('d'))
    if tag == 'circle':
        cx, cy, r = (float(el.get(k)) for k in ('cx', 'cy', 'r')); return [[(cx - r, cy - r), (cx + r, cy + r)]]
    return []

root = ET.parse(sys.argv[1]).getroot()
res = {}
for lay in root.findall(NS + 'g'):
    res[lay.get('id')] = [s for el in lay.iter() for s in shapes(el)]
json.dump(res, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
for k, v in res.items(): print(k, len(v))
