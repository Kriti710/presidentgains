from PIL import Image
import numpy as np, os
W,H=190,318
HIP={'tier1':168,'tier2':174,'tier3':193}

def canvas(img):
    """bottom-aligned, centre-x on the sprite's own bbox centre"""
    c=Image.new('RGBA',(W,H),(0,0,0,0))
    x=(W-img.width)//2; y=H-img.height
    c.paste(img,(x,y),img)
    return c, y

def shift(arr,dx,dy):
    out=np.zeros_like(arr)
    h,w=arr.shape[:2]
    ys=slice(max(0,dy),min(h,h+dy)); yd=slice(max(0,-dy),min(h,h-dy))
    xs=slice(max(0,dx),min(w,w+dx)); xd=slice(max(0,-dx),min(w,w-dx))
    out[ys,xs]=arr[yd,xd]
    return out

def scissor(base, hipY, s, bob):
    a=np.array(base)
    up=a[:hipY].copy(); legs=a[hipY:].copy()
    op=legs[...,3]>0
    xs=np.where(op.any(0))[0]
    if len(xs)==0: return Image.fromarray(a)
    cx=(xs.min()+xs.max())//2
    X=np.arange(legs.shape[1])[None,:]
    lm=op&(X<cx); rm=op&(X>=cx)
    L=legs*lm[...,None]; R=legs*rm[...,None]
    # forward leg lifts a touch
    Ls=shift(L, s, -1 if s>0 else 0)
    Rs=shift(R, -s, -1 if s<0 else 0)
    merged=np.where(Ls[...,3:4]>0, Ls, Rs)
    out=np.zeros_like(a)
    out[:hipY]=shift(up,0,bob)
    out[hipY:]=merged
    return Image.fromarray(out.astype(np.uint8))

def squash(base, sx, sy, lift=0):
    w,h=base.size
    nw,nh=max(1,int(w*sx)),max(1,int(h*sy))
    r=base.resize((nw,nh),Image.NEAREST)
    c=Image.new('RGBA',(w,h),(0,0,0,0))
    c.paste(r,((w-nw)//2, h-nh-lift),r)
    return c

os.makedirs('sprites',exist_ok=True)
for t,hip in HIP.items():
    src=Image.open(f'final/{t}.png')
    base,top=canvas(src)
    hipY=top+hip+26
    frames=[
        base,                              # 0 idle
        scissor(base,hipY, 6, 1),          # 1 walk a
        base,                              # 2 walk pass
        scissor(base,hipY,-6, 1),          # 3 walk b
        squash(base,0.94,1.06),            # 4 jump
        squash(base,1.06,0.92),            # 5 land / crouch
    ]
    strip=Image.new('RGBA',(W*len(frames),H),(0,0,0,0))
    for i,f in enumerate(frames): strip.paste(f,(i*W,0),f)
    strip.save(f'sprites/{t}.png')
    print(t,'strip',strip.size)
