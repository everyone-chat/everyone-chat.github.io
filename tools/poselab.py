import sys, json, numpy as np
sys.path.insert(0,'..')
import lib
from lib import cut
from PIL import Image, ImageDraw
from scipy import ndimage as nd
lib.SHEETS.update({'poseF':'poseF.png','poseM':'poseM.png'})
PB = [(10,255,445,622),(450,238,725,582),(758,255,1032,582),(1058,262,1482,604),(1482,128,1772,582),(1803,132,2160,584)]
def masks(a):
    rgb=a[...,:3]; al=a[...,3]>40
    r,g,b = rgb[...,0], rgb[...,1], rgb[...,2]
    G0 = al & (g>170) & (b<120) & (g-r>35)
    G = G0 | (nd.binary_dilation(G0, iterations=2) & (g-b>45) & (g-r>8))
    lum = rgb.mean(2)
    D = al & ~G & (lum<95)
    W = al & ~G & ~D
    return G,D,W
def wcomps(sheet, i):
    im,_ = cut(sheet, PB[i]); a = np.asarray(im).astype(np.float32)
    G,D,W = masks(a)
    lab,n = nd.label(W)
    out=[]
    for j,sl in enumerate(nd.find_objects(lab),1):
        m = lab==j; s=m.sum()
        if s < 60: continue
        out.append((j, m, s, nd.center_of_mass(m)))
    return im, a, lab, out
if __name__=='__main__':
    tiles=[]
    for sheet in ('poseF','poseM'):
        for i in range(6):
            im,a,lab,cs = wcomps(sheet,i)
            bg = Image.new('RGBA', im.size, (255,255,255,255)); bg.alpha_composite(im)
            rng = np.random.RandomState(1)
            col = np.zeros(a.shape[:2]+(3,))
            arr = np.asarray(bg).copy()
            for j,m,s,(cy,cx) in cs:
                c = rng.randint(60,230,3); arr[m,:3] = c
            t = Image.fromarray(arr); d = ImageDraw.Draw(t)
            for j,m,s,(cy,cx) in cs: d.text((cx-6,cy-6), str(j), fill=(0,0,0,255))
            d.text((3,3), f'{sheet}{i}', fill=(255,0,0,255))
            tiles.append(t)
    W = sum(t.width for t in tiles[:6]); H = max(t.height for t in tiles)
    o = Image.new('RGB', (W, H*2), 'white'); 
    for k,t in enumerate(tiles):
        x = sum(tt.width for tt in tiles[(k//6)*6:k]); o.paste(t,(x,(k//6)*H))
    o.save('/tmp/claude-0/poselab.png'); print(o.size)
