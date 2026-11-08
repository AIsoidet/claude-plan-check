from PIL import Image
import numpy as np
for f in ['01-axo','04-zones','02-fit','03-flow']:
    im=Image.open(f'out/{f}.png').convert('RGB'); a=np.array(im)
    nonwhite=(a<245).any(axis=2).any(axis=1)
    keep=[];run=0;rows=[]
    i=0;H=len(nonwhite)
    out=[];
    while i<H:
        if nonwhite[i]: out.append(a[i]); i+=1; continue
        j=i
        while j<H and not nonwhite[j]: j+=1
        gap=j-i
        n=gap if gap<=120 else 80
        out.extend([a[i]]*n); i=j
    b=np.array(out); cols=np.where((b<245).any(axis=2).any(axis=0))[0]
    x0=max(0,cols.min()-60); x1=min(b.shape[1],cols.max()+60)
    Image.fromarray(b[:,x0:x1]).save(f'out/t-{f}.png')
