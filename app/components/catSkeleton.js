// A small orthographic skeleton. Coordinates are physical units: one row is
// 1.73 columns tall. Positive Z faces the viewer; the glass is below the paws.
export const project = p => ({ r: -p.y, c: p.x * 1.73 });
const point = (r, c, z = 0) => ({ x: c / 1.73, y: -r, z });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale=(p,k)=>({x:p.x*k,y:p.y*k,z:p.z*k});
export const mix3 = (a, b, t) => ({ x: a.x + (b.x-a.x)*t, y: a.y+(b.y-a.y)*t, z: a.z+(b.z-a.z)*t });
const clamp = (n, lo=0, hi=1) => Math.max(lo,Math.min(hi,n));
function rotation(rx=0, ry=0, rz=0) {
  const sx=Math.sin(rx),cx=Math.cos(rx),sy=Math.sin(ry),cy=Math.cos(ry),sz=Math.sin(rz),cz=Math.cos(rz);
  return p => {
    const y=p.y*cx-p.z*sx,z=p.y*sx+p.z*cx;
    const x=p.x*cy+z*sy,zz=-p.x*sy+z*cy;
    return {x:x*cz-y*sz,y:x*sz+y*cz,z:zz};
  };
}
function around(pivot, rotate) { return p => add(pivot,rotate(subtract(p,pivot))); }
export function buildCatSkeleton(pose) {
  const hip=point(17.4,52,0);
  const rear=around(hip,rotation(pose.bodyRoll*.45,pose.bodyYaw*.25,pose.bodyBend*.25));
  const front=around(hip,rotation(pose.bodyRoll,pose.bodyYaw,pose.bodyBend));
  const body = p => {
    const t=clamp((52-p.x*1.73)/28),w=t*t*(3-2*t);
    const q=mix3(rear(p),front(p),w);
    q.y+=(pose.backArch||0)*Math.exp(-(((p.x*1.73-41)/13)**2))+
      (pose.rumpLift||0)*Math.exp(-(((p.x*1.73-53)/10)**2));
    return {x:q.x+(pose.bodyX||0)/1.73,y:hip.y+(q.y-hip.y)*(pose.breath||1)-(pose.bodyY||0),z:q.z};
  };
  // Turn from the base of the skull, supported by the shoulder ruff. Rotating
  // around the head's center left the collar stationary and the head detached.
  const skullBase=point(18.6,26.4,3.8),neckRoot=point(18.1,33,2.2);
  const movedBase=body(skullBase);
  movedBase.x+=(pose.headX||0)/1.73;movedBase.y-=(pose.headY||0);
  const headRotation=rotation(pose.headPitch+pose.bodyRoll*.65,pose.headYaw+pose.bodyYaw,
    (pose.headAngle||0)*Math.PI/180+pose.bodyBend);
  const head=p=>{const local=subtract(p,skullBase);local.y*=pose.headStretch||1;return add(movedBase,headRotation(local));};
  // The cervical chain joins the thoracic spine and skull with matching end
  // tangents. Skin offsets travel around that curve, rather than folding a
  // broad strip between two independently rotated surfaces.
  const neckDelta=subtract(skullBase,neckRoot),third=scale(neckDelta,1/3),root=body(neckRoot);
  const rootTangent=scale(subtract(body(add(neckRoot,scale(neckDelta,.0001))),root),1/.0003);
  const headTangent=headRotation({...third,y:third.y*(pose.headStretch||1)});
  const neckControls=[root,add(root,rootTangent),subtract(movedBase,headTangent),movedBase];
  const neckSpine=t=>{
    const s=1-t,[a,b,c,d]=neckControls;
    return {x:s*s*s*a.x+3*s*s*t*b.x+3*s*t*t*c.x+t*t*t*d.x,
      y:s*s*s*a.y+3*s*s*t*b.y+3*s*t*t*c.y+t*t*t*d.y,
      z:s*s*s*a.z+3*s*s*t*b.z+3*s*t*t*c.z+t*t*t*d.z};
  };
  const neck=p=>{
    const t=clamp((33-p.x*1.73)/6.6),w=t*t*t*(t*(t*6-15)+10);
    if(t===0)return body(p);
    if(t===1)return head(p);
    const axis=add(neckRoot,scale(neckDelta,t)),offset=subtract(p,axis);
    const from=subtract(body(p),body(axis));offset.y*=pose.headStretch||1;
    return add(neckSpine(t),mix3(from,headRotation(offset),w));
  };
  const coat=p=>{
    if(p.x*1.73>=33)return body(p);
    const collar=Math.exp(-(((p.y+18.2)/4.2)**4));
    return mix3(body(p),neck(p),collar);
  };
  const leftBase=point(16.8,17.2,5.7),rightBase=point(16,25.8,4.3);
  const ear=(base,angle)=>{
    const rotate=around(base,rotation(angle*Math.PI/240,0,angle*Math.PI/180));
    return p=>head(rotate(p));
  };
  const leftEar=ear(leftBase,pose.leftEar||0),rightEar=ear(rightBase,pose.rightEar||0);
  const shoulders={left:body(point(20,29,3)),right:body(point(20,39,1.6))};
  const paws={};
  for(const side of ['left','right']){
    if(Number.isFinite(pose[`${side}PawWorldX`])){
      paws[side]={x:pose[`${side}PawWorldX`],y:pose[`${side}PawWorldY`],z:pose[`${side}PawWorldZ`]};
      continue;
    }
    const rest=body(point(23,side==='left'?28:40,side==='left'?6:4));
    const lift=pose[`${side}Lift`]||0;
    let target;
    if(pose.batSide===side){
      target=point(pose.batTargetR,pose.batTargetC,7.5);
      paws[side]=mix3(rest,target,lift);
      paws[side].y+=Math.sin(Math.PI*lift)*1.2;
    }else if(pose.gesture==='ear-rub'&&side==='left'){
      target=leftEar(point(13.7,15.3,7.7));
      // Small rubbing strokes travel along the fur instead of hinging the wrist.
      target.y-=(pose.leftY+9.4)*.65;
      paws[side]=mix3(rest,target,lift);
    }else if(pose.gesture==='paw-wash'&&side==='left'){
      target=head(point(20.6,22.4,8.4));paws[side]=mix3(rest,target,lift);
    }else{
      paws[side]=add(rest,{x:(pose[`${side}X`]||0)/1.73,y:-(pose[`${side}Y`]||0),z:lift*1.2});
    }
  }
  const arms={};
  for(const side of ['left','right']){
    const start=shoulders[side],end=paws[side],delta=subtract(end,start);
    const distance=Math.hypot(delta.x,delta.y,delta.z);
    // The elbow folds toward the chest in depth; its screen contour stays a
    // continuous furry curve rather than two rectangular sections.
    const elbow=add(mix3(start,end,.42),{x:0,y:Math.min(.6,distance*.025),z:Math.min(1.7,distance*.1)});
    const forearm=subtract(end,elbow),forearmLength=Math.hypot(forearm.x,forearm.y,forearm.z)||1;
    const stop=Math.min(1.1,forearmLength*.35);
    const wristBase=add(end,{x:-forearm.x/forearmLength*stop,y:-forearm.y/forearmLength*stop,z:-forearm.z/forearmLength*stop});
    const wrist=mix3(elbow,wristBase,.78);
    arms[side]=[start,elbow,wrist,wristBase];
  }
  const tail=p=>{
    const t=clamp((p.x*1.73-56)/30),phase=pose.tailPhase||0;
    const q=body(p);
    const mood=(1+(pose.tailAgitation||0)*.28)*(1-(pose.petAmount||0)*.3);
    q.y+=(Math.sin(phase)*4.2*t**1.4+(Math.sin(phase*1.3-t*3)-Math.sin(-t*3))*1.5*t*t)*mood;
    q.z+=Math.cos(phase*.8)*2.2*t*t;
    return q;
  };
  return {body,coat,head,neckSpine,leftEar,rightEar,paws,shoulders,arms,tail,point,
    neckRoot:body(neckRoot),skullBase:head(skullBase)};
}

export function curvedArm(points,steps=28){
  // A cubic Bezier follows the shoulder, elbow and wrist, with a rounded paw.
  const [a,b,c,d]=points,out=[];
  for(let i=0;i<=steps;i++){
    const t=i/steps,s=1-t;
    out.push({x:s*s*s*a.x+3*s*s*t*b.x+3*s*t*t*c.x+t*t*t*d.x,
      y:s*s*s*a.y+3*s*s*t*b.y+3*s*t*t*c.y+t*t*t*d.y,
      z:s*s*s*a.z+3*s*s*t*b.z+3*s*t*t*c.z+t*t*t*d.z});
  }
  return out;
}
