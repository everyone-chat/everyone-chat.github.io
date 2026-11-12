import json, os, numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as nd
from lib import cut, dark_blobs, sheet
from heads import F, M, E, X

OUT = 'out'; os.makedirs(OUT, exist_ok=True)
S = 1.6                     # 기준(남자 베이스 시트 픽셀) 대비 확대 배율
CW, CH = 420, 640           # 캐릭터 캔버스
BX, BY = 77, 90             # 남자 베이스가 캔버스에 놓이는 위치
EYE_MID = (BX + 84.6*S, BY + 100.8*S)
D = 47.8*S                  # 눈 사이 거리 (캔버스 기준)
manifest = {}

def arr(im): return np.asarray(im).astype(np.float32)
def img(a): return Image.fromarray(np.clip(a,0,255).astype(np.uint8), 'RGBA')

def save(name, im, x, y):
    """캔버스 좌표 (x,y)에 놓일 레이어를 잘라 저장"""
    bb = im.getbbox()
    if not bb: return
    im = im.crop(bb); x += bb[0]; y += bb[1]
    im.save(f'{OUT}/{name}.png', optimize=True)
    manifest[name] = [round(x,1), round(y,1), im.width, im.height]

def eye_pair(im):
    bl = [b for b in dark_blobs(im) if 6<b['w']<45 and 10<b['h']<45 and b['h']>=b['w']*0.9]
    best=None
    for i in range(len(bl)):
        for j in range(i+1,len(bl)):
            a,b=bl[i],bl[j]
            if abs(a['cy']-b['cy'])<4 and 40<abs(a['cx']-b['cx'])<130:
                if best is None or abs(a['cx']-b['cx'])>abs(best[0]['cx']-best[1]['cx']): best=(a,b)
    a,b = sorted(best, key=lambda q:q['cx'])
    return (a['cx'],a['cy']),(b['cx'],b['cy'])

def place(im, mid, d):
    """원본에서 눈 중간점 mid, 눈 거리 d인 그림을 캔버스 기준으로 확대·이동"""
    k = D/d
    im2 = im.resize((round(im.width*k), round(im.height*k)), Image.LANCZOS)
    x = EYE_MID[0] - mid[0]*k; y = EYE_MID[1] - mid[1]*k
    return im2, x, y

def median_color(a, mask):
    return np.median(a[mask][:, :3], axis=0)

def split_layers(im, skin_ref, hair_ref=None, keep_mask=None, skin_t=38):
    """skin / hair 채움을 '비율 이미지'로 분리 (기본색=흰색), 나머지는 그대로 lines 레이어"""
    a = arr(im); rgb=a[...,:3]; al=a[...,3]
    lum = rgb.mean(2)
    solid = al > 200
    def near(ref, t): return np.sqrt(((rgb-ref)**2).sum(2)) < t
    skin = solid & near(skin_ref, skin_t) & (lum > 170)
    layers = {}
    hair = np.zeros_like(skin)
    if hair_ref is not None:
        hl = hair_ref.mean()
        hair = solid & ~skin & near(hair_ref, 60) & (lum > hl*0.55) & (lum < hl*1.6+30)
        if keep_mask is not None: hair &= keep_mask
        # 머리 가장자리 2px는 외곽선으로 남김 (어두운 선 유지)
        hair = nd.binary_erosion(hair, iterations=1) & hair
        hair = nd.binary_opening(hair, iterations=1)
    skin = nd.binary_opening(skin, iterations=1)
    def ratio(mask, ref):
        r = np.clip(rgb / np.maximum(ref,1) * 255, 0, 255)
        return img(np.dstack([r, np.where(mask, 255, 0)]))
    layers['skin'] = ratio(skin, skin_ref)
    if hair_ref is not None: layers['hair'] = ratio(hair, hair_ref)
    lines = a.copy(); lines[...,3] = np.where(skin|hair, 0, al)
    layers['lines'] = img(lines)
    return layers

# ---------------- 몸 (남자 베이스, 턱 아래) ----------------
body, off = cut('076002f8', (73,669,245,1006))
b = arr(body); 
bx0 = off[0]-76; by0 = off[1]-672      # mf 기준 보정 (mf 원점 76,672)
CHIN = 138                             # mf 기준 턱 아래
yy = np.arange(b.shape[0])[:,None] + by0
b[...,3] = np.where(yy < CHIN, 0, b[...,3])
body = img(b)
bodyB = body.resize((round(body.width*S), round(body.height*S)), Image.LANCZOS)
skin_body = median_color(arr(bodyB), (arr(bodyB)[...,3]>200) & (arr(bodyB)[...,:3].mean(2)>200))
L = split_layers(bodyB, skin_body)
for k,v in L.items(): save(f'body_{k}', v, BX + bx0*S, BY + by0*S)
print('body skin ref', skin_body)

# ---------------- 머리 (헤어별) ----------------
def head(name, sheetk, box):
    im, off = cut(sheetk, box)
    (l, r) = eye_pair(im)
    d = r[0]-l[0]; mid = ((l[0]+r[0])/2, (l[1]+r[1])/2)
    a = arr(im)
    rgb=a[...,:3]
    # 피부 기준색: 두 눈 사이 아래쪽
    sx, sy = int(mid[0]), int(mid[1] + 0.12*d)
    skin_ref = np.median(rgb[sy-3:sy+3, sx-int(.12*d):sx+int(.12*d)].reshape(-1,3), axis=0)
    # 원래 눈 · 코 · 입 지우기 (피부색으로 덮음)
    p = Image.fromarray(a.astype(np.uint8),'RGBA'); dr = ImageDraw.Draw(p)
    fill = tuple(int(c) for c in skin_ref) + (255,)
    for ex,ey in (l, r):
        dr.ellipse([ex-.17*d, ey-.27*d, ex+.17*d, ey+.27*d], fill=fill)
    dr.ellipse([mid[0]-.2*d, mid[1]+.17*d, mid[0]+.2*d, mid[1]+.58*d], fill=fill)
    a = arr(p)
    # 턱 아래 목·옷 지우기 (몸 레이어의 목이 보이게)
    col = a[:, int(mid[0])]
    y = int(mid[1] + .3*d)
    while y < a.shape[0]-1 and col[y,:3].mean() > 110: y += 1   # 턱선까지 내려감
    chin = y + 3
    xs = np.arange(a.shape[1])[None,:]; ys = np.arange(a.shape[0])[:,None]
    clear = (ys > chin) & (np.abs(xs - mid[0]) < .62*d)
    a[...,3] = np.where(clear, 0, a[...,3])
    im = img(a)
    # 머리카락 기준색: 정수리 근처
    reg = rgb[:int(mid[1]-.45*d)]
    ra = a[:int(mid[1]-.45*d),:,3]
    lm = reg.mean(2)
    cand = (ra>200) & (lm>45) & (lm<215) & (np.sqrt(((reg-skin_ref)**2).sum(2))>60)
    pix = reg[cand]
    # 가장 많은 색 묶음 (8단계 양자화)
    q = (pix//16).astype(int); keys = q[:,0]*256+q[:,1]*16+q[:,2]
    top_key = np.bincount(keys).argmax()
    hair_ref = np.median(pix[keys==top_key], axis=0)
    keep = None
    L = split_layers(im, skin_ref, hair_ref)
    out = {}
    for k,v in L.items():
        v2, x, y2 = place(v, mid, d)
        save(f'{name}_{k}', v2, x, y2)
    print(name, 'd', round(d,1), 'skin', skin_ref.round(), 'hair', hair_ref.round(), 'chin', chin)

for n,bx in F.items(): head('hair_'+n, '435491fe', bx)
for n,bx in M.items(): head('hair_'+n, '9ba48c65', bx)

json.dump(manifest, open(f'{OUT}/manifest.json','w'), indent=0)

# ---------------- 얼굴: 눈 5종 / 표정 5종 ----------------
def features(im, boxes, skin_ref, mid, d, name, thresh=22):
    """피부색과 다른 픽셀만 남겨서(눈·입·선) 캔버스 위치로"""
    a = arr(im); rgb=a[...,:3]
    dist = np.sqrt(((rgb-skin_ref)**2).sum(2))
    alpha = np.clip((dist-thresh)/35, 0, 1) * (a[...,3]/255)
    m = np.zeros(alpha.shape, bool)
    for (x0,y0,x1,y1) in boxes: m[int(y0):int(y1), int(x0):int(x1)] = True
    out = np.dstack([rgb, alpha*255*m])
    v, x, y = place(img(out), mid, d)
    save(name, v, x, y)

def skin_of(im, mid, d):
    rgb = arr(im)[...,:3]
    sx, sy = int(mid[0]), int(mid[1]+.1*d)
    return np.median(rgb[sy-3:sy+3, sx-int(.1*d):sx+int(.1*d)].reshape(-1,3), axis=0)

e_mid, e_d = (128,151), 100
for i,(n,bx) in enumerate(E.items()):
    im,_ = cut('af8668c2', bx)
    sk = skin_of(im, e_mid, e_d)
    boxes = [(cx-.36*e_d, e_mid[1]-.34*e_d, cx+.36*e_d, e_mid[1]+.3*e_d) for cx in (78,178)]
    features(im, boxes, sk, e_mid, e_d, f'eyes_{i}')

for i,(n,bx) in enumerate(X.items()):
    im,_ = cut('917f1c38', bx)
    try:
        l, r = eye_pair(im); mid=((l[0]+r[0])/2,(l[1]+r[1])/2); d=r[0]-l[0]
    except Exception:
        mid = (130.5, im.height-122); d = 83
    sk = skin_of(im, mid, d)
    mouth = [(mid[0]-.32*d, mid[1]+.16*d, mid[0]+.32*d, mid[1]+.72*d)]
    features(im, mouth, sk, mid, d, f'expr_{i}')
    a = arr(im); rgb=a[...,:3]
    sat = rgb.max(2)-rgb.min(2)
    ys = np.arange(a.shape[0])[:,None]
    marks = None
    if i in (1,2):   # 활짝 웃음(노란 선) / 놀람(분홍 선): 머리 위
        marks = (sat>70) & (ys < mid[1]-.95*d) & (a[...,3]>40)
    if i == 3:       # 당황: 물방울
        blue = (rgb[...,2] > rgb[...,0]+15) & (sat>25) & (a[...,3]>40)
        blue = nd.binary_fill_holes(nd.binary_closing(blue, iterations=2))
        marks = nd.binary_dilation(blue, iterations=3)
    if marks is not None:
        mk = a.copy(); mk[...,3] = np.where(marks, a[...,3], 0)
        v,x,y = place(img(mk), mid, d); save(f'mark_{i}', v, x, y)
    if i == 4:       # 삐짐: 눈(눈꺼풀)도 표정 쪽 것을 사용
        boxes = [(cx-.36*d, mid[1]-.36*d, cx+.36*d, mid[1]+.3*d) for cx in (mid[0]-d/2, mid[0]+d/2)]
        features(im, boxes, sk, mid, d, 'expr4_eyes')
    print('expr', i, 'mid', [round(v) for v in mid], 'd', round(d,1))

json.dump(manifest, open(f'{OUT}/manifest.json','w'), indent=0)

# ---------------- 의상 · 신발 · 액세서리 (원본 색 그대로) ----------------
EX, EY = EYE_MID
def put(name, sheetk, box, w=None, h=None, cx=None, top=None, bottom=None, cy=None):
    im,_ = cut(sheetk, box)
    if w: k = w/im.width
    else: k = h/im.height
    im = im.resize((round(im.width*k), round(im.height*k)), Image.LANCZOS)
    x = cx - im.width/2
    if top is not None: y = top
    elif bottom is not None: y = bottom - im.height
    else: y = cy - im.height/2
    save(name, im, x, y)

C = 'aa5c600b'
NECK, WAIST = 318, 436
TOPS = [(91,207,298,353),(369,208,566,356),(632,195,832,355),(894,205,1102,354),(1169,200,1374,355)]
for i,b in enumerate(TOPS): put(f'top_{i}', C, b, w=[212,210,206,214,212][i], cx=EX, top=NECK-[2,2,14,4,8][i])
BOTS = [(108,552,288,658),(386,546,555,659),(654,548,825,659),(934,521,1077,675),(1198,522,1348,674)]
for i,b in enumerate(BOTS):
    if i < 3: put(f'bottom_{i}', C, b, w=[150,140,134][i], cx=EX, top=WAIST-4)
    else:     put(f'bottom_{i}', C, b, h=158, cx=EX, top=WAIST-6)
ONES = [(113,836,285,1006),(385,834,563,1007),(643,833,830,1007),(922,830,1089,1010),(1186,832,1366,1008)]
for i,b in enumerate(ONES): put(f'one_{i}', C, b, w=[196,206,214,206,212][i], cx=EX, top=NECK-[2,14,8,4,6][i])

A = 'bb4a765a'
FEET = 624
SHOES = [(223,195,377,305),(469,203,629,301),(713,206,883,300),(966,197,1140,299),(1212,201,1396,297)]
for i,b in enumerate(SHOES): put(f'shoes_{i}', A, b, w=[150,152,156,156,162][i], cx=EX+1, bottom=FEET+[4,4,4,4,6][i])
HATS = [(302,449,475,561),(528,439,708,565),(756,440,948,579),(983,444,1174,564),(1230,432,1403,577)]
for i,b in enumerate(HATS):
    w = [2.35,2.45,2.75,2.7,2.55][i]*D
    bot = EY + [0.08,0.12,-0.28,-0.38,-0.22][i]*D
    put(f'hat_{i}', A, b, w=w, cx=EX+[0,0,0.12*D,-0.1*D,0][i], bottom=bot)
GLASS = [(302,716,470,788),(525,723,698,785),(753,723,933,788),(993,684,1162,800),(1251,721,1380,794)]
for i,b in enumerate(GLASS):
    if i < 3: put(f'acc_{i}', A, b, w=1.78*D, cx=EX, cy=EY+0.03*D)
    elif i == 3: put('acc_3', A, b, w=2.85*D, cx=EX, bottom=EY+0.62*D)
    else: put('acc_4', A, b, w=0.95*D, cx=EX+0.82*D, cy=EY-1.02*D)
FX = [(318,912,452,1000),(536,912,600,1016),(756,912,814,1016),(896,912,1006,1016),(1088,912,1196,1012),(1266,912,1408,1016)]
for i,b in enumerate(FX):
    im,_ = cut(A, b); im.thumbnail((96,96), Image.LANCZOS); im.save(f'{OUT}/fx_{i}.png', optimize=True)

# ---------------- 행동 포즈 (머리·피부색 바꾸기 가능) ----------------
POSES = {
  'f': ('13b54fd4', [(32,240,383,518),(578,219,812,540),(1036,220,1272,539),(72,689,346,1033),(578,660,795,1044),(1040,655,1285,1053)], 468/384),
  'm': ('042e57ec', [(28,275,335,485),(562,222,761,538),(1036,221,1230,538),(40,705,335,1030),(562,670,762,1042),(1026,664,1248,1050)], 468/372),
}
for g,(k,boxes,sc) in POSES.items():
    for i,b in enumerate(boxes):
        im,off = cut(k, b)
        if g == 'f' and i == 0:   # 자는 포즈 옆 베개·담요 아이콘 제거
            aa = arr(im); ys=np.arange(aa.shape[0])[:,None]+off[1]; xs=np.arange(aa.shape[1])[None,:]+off[0]
            aa[...,3] = np.where((xs > 348) & (ys < 447), 0, aa[...,3]); im = img(aa); im = im.crop(im.getbbox())
        a = arr(im); rgb=a[...,:3]; lum=rgb.mean(2); solid=a[...,3]>200
        sk = np.median(rgb[solid & (lum>215) & (rgb[...,0]>245)].reshape(-1,3), axis=0)
        cand = solid & (lum>45) & (lum<190) & (np.sqrt(((rgb-sk)**2).sum(2))>60) & (rgb[...,0]>rgb[...,2]+12)
        pix = rgb[cand]; q=(pix//16).astype(int); keys=q[:,0]*256+q[:,1]*16+q[:,2]
        hr = np.median(pix[keys==np.bincount(keys).argmax()], axis=0)
        im = im.resize((round(im.width*sc), round(im.height*sc)), Image.LANCZOS)
        # 씻는 포즈는 수건이 피부색과 비슷해서 피부색 변경 제외
        L = split_layers(im, np.array([0,0,255.]) if i == 5 else sk, hr, skin_t=48)
        for kk,v in L.items(): save(f'pose_{g}{i}_{kk}', v, EX - im.width/2, FEET - im.height)

# ---------------- 손 (상의 위에 다시 그림) ----------------
bl = Image.open(f'{OUT}/body_lines.png'); bs = Image.open(f'{OUT}/body_skin.png')
for nm, src in (('hands_lines', 'body_lines'), ('hands_skin', 'body_skin')):
    x,y,w,h = manifest[src]
    a = arr(Image.open(f'{OUT}/{src}.png'))
    ys = np.arange(h)[:,None] + y; xs = np.arange(w)[None,:] + x
    keep = (ys > 446) & (ys < 492) & ((xs < EX-58) | (xs > EX+58))
    a[...,3] = np.where(keep, a[...,3], 0)
    save(nm, img(a), x, y)

json.dump(manifest, open(f'{OUT}/manifest.json','w'), indent=0)
print('total layers', len(manifest))

# ---------------- 방 가구 (시트 그대로) ----------------
R = '30706f31'
FURN = {'bed':(34,800,276,1011),'sofa':(289,800,533,1010),'desk':(545,790,793,1004),'chair':(822,842,926,1002),'cabinet':(977,780,1161,1014),'rug':(1195,861,1416,985)}
fm = {}
for k,b in FURN.items():
    im,_ = cut(R, b); im.save(f'{OUT}/furn_{k}.png', optimize=True); fm[k] = [im.width, im.height]
json.dump(fm, open(f'{OUT}/furniture.json','w'))
print('furniture', fm)
