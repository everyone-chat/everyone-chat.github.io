import numpy as np
from PIL import Image
from scipy import ndimage as nd

SHEETS = {k: f'{k}-image.png' for k in ['076002f8','af8668c2','917f1c38','435491fe','9ba48c65','aa5c600b','bb4a765a','13b54fd4','042e57ec','30706f31']}
_cache = {}
def sheet(k):
    if k not in _cache: _cache[k] = np.asarray(Image.open(SHEETS[k]).convert('RGB')).astype(np.float32)
    return _cache[k]

def cut(k, box, pad=6, light=205, satmax=60):
    """시트에서 box 영역을 잘라 배경(테두리와 이어진 밝은 영역)을 투명하게"""
    x0,y0,x1,y1 = box
    a = sheet(k)[max(0,y0-pad):y1+pad, max(0,x0-pad):x1+pad]
    lum = a.mean(2); sat = a.max(2)-a.min(2)
    light_px = (lum > light) & (sat < satmax)
    lab, n = nd.label(light_px)
    border = set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]]))) - {0}
    bg = np.isin(lab, list(border))
    alpha = np.where(bg, 0.0, 1.0)
    # 가장자리 부드럽게: 배경과 닿은 픽셀은 밝기에 따라 반투명
    edge = (~bg) & nd.binary_dilation(bg, iterations=1)
    soft = np.clip((250 - lum) / 150, 0.25, 1.0)
    alpha = np.where(edge, soft, alpha)
    # 작은 부스러기(시트 테두리 조각 등) 제거
    lab2, n2 = nd.label(alpha > 0)
    if n2 > 1:
        sizes = nd.sum(np.ones_like(alpha), lab2, range(1, n2+1))
        big = max(sizes)
        small = [i+1 for i,s in enumerate(sizes) if s < max(60, big*0.004)]
        alpha = np.where(np.isin(lab2, small), 0, alpha)
    rgba = np.dstack([a, alpha*255]).astype(np.uint8)
    im = Image.fromarray(rgba, 'RGBA')
    bb = im.getbbox()
    return im.crop(bb), (max(0,x0-pad)+bb[0], max(0,y0-pad)+bb[1])

def dark_blobs(im, maxlum=90, minarea=20):
    a = np.asarray(im).astype(np.float32)
    m = (a[...,:3].mean(2) < maxlum) & (a[...,3] > 200)
    lab, n = nd.label(m)
    res=[]
    for i, sl in enumerate(nd.find_objects(lab),1):
        ys,xs=sl; area=(lab[sl]==i).sum()
        if area<minarea: continue
        cy,cx = nd.center_of_mass(lab==i)
        res.append(dict(cx=cx,cy=cy,w=xs.stop-xs.start,h=ys.stop-ys.start,area=area,box=(xs.start,ys.start,xs.stop,ys.stop)))
    return res
