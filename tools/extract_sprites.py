from PIL import Image
import numpy as np, os
from scipy import ndimage
SRC='/root/.claude/uploads/38170389-770f-5f17-aed4-79a1eacc13f6/d133bbcf-image.png'
im=Image.open(SRC).convert('RGB'); A=np.asarray(im).astype(int)

def bgmask(s,mode):
    r,g,b=s[...,0],s[...,1],s[...,2]
    if mode=='navy':   return (b<78)&(r<62)&((b-r)>=12)&((b-r)<=36)&((g-r)>=4)&((g-r)<=22)
    if mode=='sky':    return ((b-r)>42)&(b>135)&((b-g)>15)
    if mode=='skygreen':
        return (((b-r)>42)&(b>135)&((b-g)>15)) | (((g-r)>16)&((g-b)>14)&(g>55))
    return np.zeros(r.shape,bool)

def cut(box,mode,main=False,despeckle=14):
    s=A[box[1]:box[3],box[0]:box[2]]
    m=bgmask(s,mode)
    lab,n=ndimage.label(m)
    keep=np.zeros(n+1,bool)
    for i in set(lab[0,:]).union(lab[-1,:],lab[:,0],lab[:,-1]):
        if i>0: keep[i]=True
    alpha=np.where(keep[lab],0,255)
    fl,fn=ndimage.label(alpha>0)
    if fn:
        sizes=ndimage.sum(alpha>0,fl,range(1,fn+1))
        if main:
            big=int(np.argmax(sizes))+1
            ys,xs=np.where(fl==big); x0,x1=xs.min(),xs.max()
            th=sizes.max()*0.015
            ok=np.zeros_like(alpha,bool)
            for i,sz in enumerate(sizes,1):
                if sz<th: continue
                _,xs2=np.where(fl==i)
                if xs2.min()<=x1 and xs2.max()>=x0: ok|=(fl==i)
            alpha=np.where(ok,255,0)
        else:
            ok=np.zeros_like(alpha,bool)
            for i,sz in enumerate(sizes,1):
                if sz>=despeckle: ok|=(fl==i)
            alpha=np.where(ok,255,0)
    img=Image.fromarray(np.dstack([s,alpha]).astype(np.uint8),'RGBA')
    bb=img.getbbox()
    return img.crop(bb) if bb else img

os.makedirs('final',exist_ok=True)
def save(n,box,mode='sky',**kw):
    i=cut(box,mode,**kw); i.save(f'final/{n}.png'); print(f'{n:8s}{i.size}')

save('tier1',(30,405,220,737),'navy',main=True)
save('tier2',(250,405,470,737),'navy',main=True)
save('tier3',(515,405,730,737),'navy',main=True)
save('run1', (620,10,790,225),'sky',main=True)
save('goomba',(348,204,402,276),'skygreen',main=True)
save('coin', (884,111,920,164),'sky')
save('qblock',(832,172,881,220),'sky')
save('brick',(881,172,928,220),'sky')
save('pipe', (192,142,284,282),'sky')
save('flag', (1186,12,1240,282),'sky')
save('castle',(1288,138,1460,278),'sky')
save('bush', (6,214,96,278),'sky')
save('cloud',(1000,42,1134,112),'sky',despeckle=30)
save('mtn',  (430,138,566,278),'sky')
save('head', (18,22,96,92),'sky',main=True)
save('egg',  (28,898,106,988),'navy',main=True)
save('milk', (608,892,668,982),'navy',main=True)
