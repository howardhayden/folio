import { buildCatSkeleton, project } from './catSkeleton.js';
import { CAT_TAIL_SPINE } from './catDrawing.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const contactDistance=(a,b)=>Math.hypot(a.r-b.r,(a.c-b.c)/1.73);
const material=(r,c,z)=>({x:c/1.73,y:-r,z});
export const PET_ZONES=new Set(['nose','head','cheek-left','cheek-right','ear-left','ear-right','back']);
// These are touch landmarks on the fur, not features drawn on the face.
export function catTouchLandmarks(pose){
  const bones=buildCatSkeleton(pose),head=(r,c,z)=>project(bones.head(material(r,c,z)));
  return {
    nose:head(20.15,21.4,8.15),head:head(17.1,21.4,7.6),
    'cheek-left':head(20.25,15.8,7.3),'cheek-right':head(20.25,27,7.3),
    'ear-left':project(bones.leftEar(material(14.2,15.3,6))),
    'ear-right':project(bones.rightEar(material(13.4,27.3,4.6))),
    back:project(bones.body(material(16.2,43,3))),
  };
}
function distanceToSegment(p,a,b){
  const dy=b.r-a.r,dx=(b.c-a.c)/1.73,y=p.r-a.r,x=(p.c-a.c)/1.73;
  const t=clamp((y*dy+x*dx)/(dy*dy+dx*dx||1));
  return {distance:Math.hypot(y-dy*t,x-dx*t),t};
}
const tailSamples=[];
for(let i=0;i<CAT_TAIL_SPINE.length-1;i++){
  const a=CAT_TAIL_SPINE[Math.max(0,i-1)],b=CAT_TAIL_SPINE[i],c=CAT_TAIL_SPINE[i+1],d=CAT_TAIL_SPINE[Math.min(CAT_TAIL_SPINE.length-1,i+2)];
  for(let j=0;j<8;j++){
    const t=j/8;
    tailSamples.push([0,1].map(k=>.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-d[k])*t*t+(-a[k]+3*b[k]-3*c[k]+d[k])*t*t*t)));
  }
}
tailSamples.push(CAT_TAIL_SPINE.at(-1));
export function classifyCatContact(point,pose){
  if(!point||!Number.isFinite(point.r)||!Number.isFinite(point.c))return '';
  const marks=catTouchLandmarks(pose);
  const zones=[['nose',2.1,.88],['head',4.8,1.45],['cheek-left',2.9,1.65],['cheek-right',2.9,1.65],
    ['ear-left',2.7,1.8],['ear-right',2.7,1.8]];
  for(const [id,rx,ry] of zones){
    const p=marks[id];
    if(((point.c-p.c)/rx)**2+((point.r-p.r)/ry)**2<=1)return id;
  }
  const bones=buildCatSkeleton(pose);
  const back=[[17,29],[15.8,37],[15.4,45],[15.6,53],[17.1,61]]
    .map(([r,c])=>project(bones.coat(material(r,c,3))));
  for(let i=1;i<back.length;i++)if(distanceToSegment(point,back[i-1],back[i]).distance<2.8)return 'back';
  // The rump covers the proximal tail. Only the exposed plume reacts as tail.
  const path=tailSamples.map(([r,c])=>project(bones.tail(material(r,c,-3.5))));
  for(let i=1;i<path.length;i++){
    const along=i/(path.length-1);
    if(along<.27)continue;
    const radius=1.15+1.7*Math.sin(Math.PI*along)**.9-.57*along**6;
    if(distanceToSegment(point,path[i-1],path[i]).distance<radius)return 'tail';
  }
  // Remaining head fur still welcomes strokes, rather than inviting a bat.
  const center=project(bones.head(material(19.25,21.4,7.8)));
  if(((point.c-center.c)/7.7)**2+((point.r-center.r)/3.25)**2<1)return 'head';
  return '';
}
export function petResponse(zone,amount,point,pose){
  const p={headX:0,headY:0,headYaw:0,headPitch:0,headAngle:0,
    bodyYaw:0,bodyRoll:0,bodyBend:0,backArch:0,rumpLift:0,leftEar:0,rightEar:0};
  const w=clamp(amount);
  if(zone==='nose'){
    p.headY=-.65*w;p.headPitch=-.23*w;p.bodyBend=-.012*w;
  }else if(zone==='head'){
    p.headY=-.72*w;p.headPitch=-.12*w;p.bodyBend=-.018*w;
    p.leftEar=-3*w;p.rightEar=3*w;
  }else if(zone.startsWith('cheek-')||zone.startsWith('ear-')){
    const side=zone.endsWith('left')?-1:1,ear=zone.startsWith('ear-');
    p.headX=side*(ear?.55:.85)*w;p.headY=-.18*w;
    p.headYaw=side*(ear?.27:.23)*w;p.headAngle=side*(ear?6:5)*w;
    p.bodyYaw=side*.035*w;p.bodyRoll=side*.055*w;
    p.leftEar=-3*w;p.rightEar=3*w;
  }else if(zone==='back'){
    // Arch under the travelling hand; petting the rump raises the hindquarters.
    const marks=catTouchLandmarks(pose),towardRump=clamp((point.c-marks.back.c+8)/24);
    p.backArch=.8*w;p.rumpLift=(.25+.65*towardRump)*w;
    p.headY=-.24*w;p.headPitch=-.065*w;p.bodyBend=-.012*w;
  }
  return p;
}
