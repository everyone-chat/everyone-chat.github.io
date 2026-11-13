import json, sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
sys.path.insert(0, '..')
import lib
from lib import cut

SHEETS = {k: f'{k}.png' for k in ['body','topF','topM','botF','botM','oneF','oneM','shoes','poseF','poseM']}
lib.SHEETS.update(SHEETS)
OUT = '../out'
M = json.load(open(f'{OUT}/manifest.json'))
for k in [k for k in M if k.split('_')[0] in ('body','top','bottom','one','shoes','pose','hands')]: del M[k]

EX, NECK_Y, FEET = 212.4, 300.0, 624.0
def arr(im): return np.asarray(im).astype(np.float32)
def img(a): return Image.fromarray(np.clip(a,0,255).astype(np.uint8),'RGBA')
def save(name, im, x, y):
    bb = im.getbbox()
    if not bb: return
    im = im.crop(bb); x += bb[0]; y += bb[1]
    im.save(f'{OUT}/{name}.png', optimize=True)
    M[name] = [round(x,1), round(y,1), im.width, im.height]

def masks(a):
    rgb=a[...,:3]; al=a[...,3]>40
    r,g,b = rgb[...,0], rgb[...,1], rgb[...,2]
    G0 = al & (g>170) & (b<120) & (g-r>35)
    lum = rgb.mean(2)
    # 초록 몸 가장자리의 섞인 색(연두빛)도 몸으로 처리 (민트색 옷은 파랑값이 높아서 제외)
    G = G0 | (nd.binary_dilation(G0, iterations=2) & (g-b>45) & (g-r>8))
    D = al & ~G & (lum<95)
    W = al & ~G & ~D & (rgb.min(2)>225)
    F = al & ~G & ~D
    return G, D, W, F

def anchors(a):
    G,_,_,_ = masks(a)
    ys,xs = np.nonzero(G)
    y0 = ys.min()
    nx = xs[ys < y0+15].mean()
    lab,n = nd.label(G)
    W = a.shape[1]
    hb = None
    for i,sl in enumerate(nd.find_objects(lab),1):
        cy,cx = nd.center_of_mass(lab==i)
        if abs(cx-nx) > 0.22*W and (lab[sl]==i).sum() > 80 and cy < a.shape[0]*0.8:
            hb = max(hb or 0, sl[0].stop)
    nw = (G[y0+8]).sum()
    return dict(neck=y0, nx=nx, hb=hb, nw=nw, bottom=np.nonzero(a[...,3]>40)[0].max())

def place(im, k, ox, oy, a_x, a_y):
    """그림 좌표 (a_x,a_y)가 캔버스 (ox,oy)로 오도록 k배"""
    im2 = im.resize((round(im.width*k), round(im.height*k)), Image.LANCZOS)
    return im2, ox - a_x*k, oy - a_y*k

def keep_lines(a, keep_fill):
    """keep_fill 근처(3px)의 어두운 선만 남김"""
    G,D,W,F = masks(a)
    near = nd.binary_dilation(keep_fill, iterations=3)
    alpha = np.where(keep_fill | (D & near), a[...,3], 0)
    out = a.copy(); out[...,3] = alpha
    return out

def comps(mask):
    lab,n = nd.label(mask)
    return [(lab==i, nd.center_of_mass(lab==i), (lab==i).sum()) for i in range(1,n+1)]

# ---------------- 몸 (여/남) ----------------
BODY = {}
for g,box in (('f',(316,152,759,848)),('m',(907,152,1356,848))):
    im,_ = cut('body', box); a = arr(im); an = anchors(a)
    k = (FEET-NECK_Y) / (an['bottom']-an['neck'])
    BODY[g] = dict(an=an, k=k)
    print('body', g, an, 'k', round(k,3))

def to_canvas(a, an, g):
    """그림을 몸 기준(목 위·목 중심, 목~손끝 길이)에 맞춰 캔버스로"""
    b = BODY[g]['an']; kb = BODY[g]['k']
    k = kb * (b['hb']-b['neck']) / (an['hb']-an['neck'])
    return place(img(a), k, EX, NECK_Y, an['nx'], an['neck'])

SHOE_TOP = {}
# ---------------- 신발 (몸에 신긴 그림에서 신발만) ----------------
SB = [(106,97,436,631),(514,97,844,631),(922,97,1250,632),(1329,97,1658,631),(1736,97,2066,633)]
for i,box in enumerate(SB):
    im,_ = cut('shoes', box); a = arr(im); an = anchors(a)
    G,D,W,F = masks(a)
    ys = np.arange(a.shape[0])[:,None]
    shorts = [m for m,(cy,cx),s in comps(W) if s>400 and cy < an['hb']+40]
    sb = max(np.nonzero(m)[0].max() for m in shorts) if shorts else an['hb']
    al = a[...,3]>40
    reg = al & ~G & (ys > sb + 6)
    for m,(cy,cx),sz in comps(W):
        if sz>300: reg &= ~m
    core = nd.binary_opening(reg, iterations=5)   # 다리 윤곽선(얇음)은 사라지고 신발 덩어리만
    big = np.zeros_like(core)
    for m,(cy,cx),sz in comps(core):
        if sz > 600: big |= m
    shoe = nd.binary_dilation(big, iterations=7) & al & ~G
    out = a.copy(); out[...,3] = np.where(shoe, a[...,3], 0)
    v,x,y = to_canvas(out, an, 'f')
    save(f'shoes_{i}', v, x, y)
    SHOE_TOP[i] = M[f'shoes_{i}'][1]
    continue
    out = keep_lines(a, fill)
    v,x,y = to_canvas(out, an, 'f')
    save(f'shoes_{i}', v, x, y)
    SHOE_TOP[i] = M[f'shoes_{i}'][1]
print('shoe tops', SHOE_TOP)
CUT = max(SHOE_TOP.values()) + 10

# 몸 레이어 (신발 부분은 잘라냄: 신발 레이어가 덮음)
for g in ('f','m'):
    box = {'f':(316,152,759,848),'m':(907,152,1356,848)}[g]
    im,_ = cut('body', box); a = arr(im); an = BODY[g]['an']; k = BODY[g]['k']
    G,D,W,F = masks(a)
    skin = a.copy(); skin[...,:3] = 255; skin[...,3] = np.where(G, 255, 0)
    lines = a.copy(); lines[...,3] = np.where(G, 0, a[...,3])
    for nm, L in (('skin', skin), ('lines', lines)):
        v,x,y = place(img(L), k, EX, NECK_Y, an['nx'], an['neck'])
        vv = arr(v); yy = np.arange(vv.shape[0])[:,None] + y
        vv[...,3] = np.where(yy > CUT, 0, vv[...,3])
        save(f'body_{g}_{nm}', img(vv), x, y)

# ---------------- 상의 / 하의 / 원피스 ----------------
TB = [(49,92,442,680),(474,92,862,680),(896,92,1281,680),(1314,92,1703,680),(1738,93,2132,680)]
BB = [(95,94,454,651),(503,94,860,652),(908,94,1265,652),(1314,94,1672,652),(1721,94,2078,653)]
OB = [(95,89,452,651),(502,89,857,651),(908,89,1264,651),(1315,89,1671,651),(1720,89,2077,651)]
for g,G_ in (('f','F'),('m','M')):
    for kind, sheet, boxes in (('top','top'+G_,TB),('bottom','bot'+G_,BB),('one','one'+G_,OB)):
        for i,box in enumerate(boxes):
            im,_ = cut(sheet, box); a = arr(im); an = anchors(a)
            G,D,W,F = masks(a)
            span = an['hb']-an['neck']
            al = a[...,3]>40
            reg = al & ~G
            for m,(cy,cx),sz in comps(W):
                if sz < 300: continue
                if kind == 'top' and cy > an['hb'] - 0.12*span: reg &= ~nd.binary_dilation(m, iterations=1)   # 흰 반바지
                if kind == 'bottom' and cy < an['hb'] - 0.1*span: reg &= ~nd.binary_dilation(m, iterations=1)  # 흰 민소매
            # 몸 윤곽선(얇은 선)은 지우고 옷 덩어리만 남긴 뒤 옷 자체 윤곽선까지 되살림
            core = nd.binary_opening(reg, iterations=4)
            big = np.zeros_like(core)
            for m,_,sz in comps(core):
                if sz > 300: big |= m
            keep = nd.binary_dilation(big, iterations=6) & reg
            out = a.copy(); out[...,3] = np.where(keep, a[...,3], 0)
            v,x,y = to_canvas(out, an, g)
            save(f'{kind}_{g}{i}', v, x, y)
            continue
            out = keep_lines(a, fill)
            v,x,y = to_canvas(out, an, g)
            save(f'{kind}_{g}{i}', v, x, y)
        print(kind, g, 'ok')

# ---------------- 행동 포즈 (머리 없음 → 내 머리를 목 위에) ----------------
import poselab
# 포즈별 흰 옷 조각 번호 (poselab.py로 번호 확인): top=민소매, bottom=반바지, shoes=신발
POSE_PARTS = {
 'f': [dict(top=[262,233], bottom=[247], shoes=[224,263,241]),
       dict(top=[45], bottom=[202], shoes=[228,229,234,235]),
       dict(top=[40,157], bottom=[228], shoes=[283,287,292,293]),
       dict(top=[53], bottom=[168], shoes=[261,281,291,297]),
       dict(top=[227], bottom=[267], shoes=[483,484,522,523]),
       dict(shoes=[343,344,397,398])],
 'm': [dict(top=[242,198], bottom=[212], shoes=[158,243,224]),
       dict(top=[43], bottom=[198], shoes=[226,227,230,233]),
       dict(top=[38,132], bottom=[210], shoes=[272,273,275,276]),
       dict(top=[60], bottom=[169], shoes=[257,271,272]),
       dict(top=[212,232,105], bottom=[254], shoes=[481,482,515,516]),
       dict(shoes=[360,361,415,416])],
}
PB = [(10,255,445,622),(450,238,725,582),(758,255,1032,582),(1058,262,1482,604),(1482,128,1772,582),(1803,132,2160,584)]
for g,sheet in (('f','poseF'),('m','poseM')):
    # 서 있는 포즈(바쁜 중·씻는 중)의 목~발 길이를 몸과 같게 → 그 배율을 모든 포즈에
    ks = []
    for i in (4,5):
        im,_ = cut(sheet, PB[i]); a = arr(im); an = anchors(a)
        G,_,_,_ = masks(a); gb = np.nonzero(G)[0].max()
        ks.append((FEET-NECK_Y-14) / (an['bottom']-an['neck']))
    k = float(np.mean(ks))
    for i,box in enumerate(PB):
        im,_ = cut(sheet, box); a = arr(im); an = anchors(a)
        G,D,W,F = masks(a)
        xs_ = np.nonzero(a[...,3]>40)[1]
        cx = (xs_.min()+xs_.max())/2 if i in (0,3) else an['nx']
        skin = a.copy(); skin[...,:3]=255; skin[...,3]=np.where(G,255,0)
        # 흰 민소매·반바지·신발을 따로 떼서 (흰색=기본) 내가 입은 옷 색으로 칠할 수 있게
        _,_,lab,cs = poselab.wcomps(sheet, i)
        parts = {}
        for part, ids in POSE_PARTS[g][i].items():
            mk = np.isin(lab, ids)
            near = nd.binary_dilation(mk, iterations=4)
            for j,m,sz,_ in cs:
                if sz <= 150 and j not in ids and (m & near).any() and not (m & np.isin(lab, [x for p2,v in POSE_PARTS[g][i].items() if p2!=part for x in v])).any():
                    mk |= m
            parts[part] = mk
        used = np.zeros_like(G)
        layers = [('skin', skin)]
        for part, mk in parts.items():
            L = a.copy(); L[...,3] = np.where(mk, a[...,3], 0); layers.append((part, L)); used |= mk
        lines = a.copy(); lines[...,3]=np.where(G | used, 0, a[...,3])
        layers.append(('lines', lines))
        for nm,L in layers:
            v,x,y = place(img(L), k, EX, FEET, cx, an['bottom'])
            save(f'pose_{g}{i}_{nm}', v, x, y)
        hx = EX + (an['nx']-cx)*k; hy = FEET + (an['neck']-an['bottom'])*k
        M[f'posehead_{g}{i}'] = [round(hx-EX,1), round(hy-NECK_Y,1), 0, 0]
        print('pose', g, i, 'k', round(k,3), 'head shift', M[f'posehead_{g}{i}'][:2])

# ---------------- 옷·신발 대표 색 (포즈 옷 칠하기용) ----------------
def dom(name, part=None):
    a = np.asarray(Image.open(f'{OUT}/{name}.png')).astype(int)
    if part == 'upper': a = a[: a.shape[0]*2//5]
    if part == 'lower': a = a[a.shape[0]*3//5:]
    px = a[a[...,3] > 220][:, :3]
    r,g_,b = px[:,0], px[:,1], px[:,2]
    lum = px.mean(1)
    outline = (lum < 60) & (r >= g_) & (g_ >= b) & (r - b > 12)
    px = px[~outline & (lum > 22)]
    q = (px // 24) * 24 + 12
    keys, cnt = np.unique(q, axis=0, return_counts=True)
    best = keys[cnt.argmax()]
    sel = px[(np.abs(q - best).sum(1) == 0)]
    c = sel.mean(0)
    return '#%02X%02X%02X' % tuple(int(v) for v in c)
COLORS = {}
for g in ('f','m'):
    for i in range(5):
        COLORS[f'top_{g}{i}'] = dom(f'top_{g}{i}')
        COLORS[f'bottom_{g}{i}'] = dom(f'bottom_{g}{i}')
        COLORS[f'one_{g}{i}'] = [dom(f'one_{g}{i}','upper'), dom(f'one_{g}{i}','lower')]
for i in range(5): COLORS[f'shoes_{i}'] = dom(f'shoes_{i}')
json.dump(COLORS, open(f'{OUT}/colors.json','w'), indent=1, ensure_ascii=False)
print(COLORS)

json.dump(M, open(f'{OUT}/manifest.json','w'), indent=0)
print('layers', len(M))
