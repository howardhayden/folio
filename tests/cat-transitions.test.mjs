import test from 'node:test';
import assert from 'node:assert/strict';
import {REST_POSE,CatMotion,gesturePose} from '../app/components/catMotion.js';
import {petResponse,catTouchLandmarks} from '../app/components/catInteraction.js';
import {CatPoseTransition} from '../app/components/catPoseTransition.js';
import {buildCatSkeleton,project} from '../app/components/catSkeleton.js';
import {renderCatFrame} from '../app/components/catRenderer.js';
import {catTorsoSurface} from '../app/components/catAnatomy.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const material=(r,c,z)=>({x:c/1.73,y:-r,z});
const base={...REST_POSE,tailPhase:.6,breath:1};
const pet=(zone)=>({...base,...petResponse(zone,1,{r:14,c:48},base),petZone:zone,petAmount:1});
const poses=[['idle',base],['track-left',{...base,headYaw:-.58,headPitch:-.12,bodyYaw:-.08}],
  ['track-right',{...base,headYaw:.58,bodyYaw:.1}],
  ...['head','nose','cheek-left','cheek-right','ear-left','ear-right','back'].map(zone=>[`pet-${zone}`,pet(zone)]),
  ...['ear-rub','paw-wash','yawn','big-yawn','side-roll','drowsy'].map(name=>[`gesture-${name}`,{...base,...gesturePose(name,1400),gesture:name}]),
  ['bat-left',{...base,batSide:'left',batTargetC:13,batTargetR:4,leftLift:1}],
  ['bat-right',{...base,batSide:'right',batTargetC:83,batTargetR:4,rightLift:1}],
  ['tail-bat',{...base,batSide:'right',batTargetC:82,batTargetR:16,rightLift:1,tailAgitation:1}],
  ['settle',{...base,batSide:'right',batTargetC:83,batTargetR:4,rightLift:.42}]];
function landmarks(pose){
  const b=buildCatSkeleton(pose);
  return [b.head(material(19.25,21.4,8.1)),b.leftEar(material(14,15,6)),b.rightEar(material(13,27,4.6)),
    b.coat(material(18.2,29,3)),b.body(material(14,43,3)),b.neckRoot,b.skullBase,b.paws.left,b.paws.right];
}

test('every response pair starts at the visible pose and finishes at the destination anatomy',()=>{
  for(const [fromName,from] of poses)for(const [toName,to] of poses){
    const transition=new CatPoseTransition();transition.apply(from,'from',0);transition.apply(from,'from',40);
    const start=transition.apply(to,'to',80,320),finish=transition.apply(to,'to',400,320);
    const a=landmarks(from),b=landmarks(to);
    landmarks(start).forEach((p,i)=>assert.ok(distance(p,a[i])<1e-9,`${fromName} to ${toName}: joint ${i} snaps`));
    landmarks(finish).forEach((p,i)=>assert.ok(distance(p,b[i])<1e-9,`${fromName} to ${toName}: joint ${i} misses destination`));
  }
});

test('handoffs retain outgoing velocity and join the moving destination without a velocity step',()=>{
  const transition=new CatPoseTransition();
  transition.apply({...base,headX:0},'from',0);transition.apply({...base,headX:.1},'from',40);
  const destination=now=>({...base,headX:.8+(now-80)*.001});
  const start=transition.apply(destination(80),'to',80,320),epsilon=.001;
  const after=transition.apply(destination(80+epsilon),'to',80+epsilon,320);
  assert.ok(Math.abs((after.headX-start.headX)/epsilon-.0025)<1e-6);
  const before=transition.apply(destination(400-epsilon),'to',400-epsilon,320);
  const end=transition.apply(destination(400),'to',400,320);
  assert.ok(Math.abs((end.headX-before.headX)/epsilon-.001)<1e-6);
});

test('rapidly interrupted responses use the current blended pose instead of resetting',()=>{
  const transition=new CatPoseTransition();let now=0;
  transition.apply(poses[0][1],'idle',now);
  for(const [name,target] of poses.slice(1)){
    now+=70;
    const current=transition.apply(target,transition.key,now,320);
    const switched=transition.apply(target,name,now,320);
    landmarks(current).forEach((p,i)=>assert.ok(distance(p,landmarks(switched)[i])<1e-9));
  }
});

test('a live back-to-head-to-cheek transition keeps the neck and spine continuous at 24 fps',()=>{
  const cat=new CatMotion(),dt=1000/24;
  let last=null,maxHeadStep=0,maxBackStep=0;
  for(let frame=0;frame<240;frame++){
    const now=frame*dt,zone=frame<60?'back':frame<120?'head':frame<180?'cheek-left':'cheek-right';
    if(frame%3===0){
      const target=catTouchLandmarks(cat.lastPose)[zone],amplitude=zone==='back'?5:.75;
      cat.move({r:target.r,c:target.c+Math.sin(frame/3*Math.PI/2)*amplitude},now,8);
    }
    const pose=cat.sample(now,dt),bones=buildCatSkeleton(pose);
    const current={head:bones.head(material(19.25,21.4,8.1)),back:bones.body(material(14,43,3))};
    if(last){maxHeadStep=Math.max(maxHeadStep,distance(last.head,current.head));maxBackStep=Math.max(maxBackStep,distance(last.back,current.back));}
    last=current;
    if(frame===59)assert.equal(pose.petZone,'back');
    if(frame===119)assert.equal(pose.petZone,'head');
    if(frame===179)assert.equal(pose.petZone,'cheek-left');
    if(frame===239)assert.equal(pose.petZone,'cheek-right');
  }
  assert.ok(maxHeadStep<.3,`head jumps ${maxHeadStep} physical units per frame`);
  assert.ok(maxBackStep<.15,`back jumps ${maxBackStep} physical units per frame`);
  assert.equal(cat.taps,0);
});

test('the skull base remains supported and the collar deforms continuously into the shoulders',()=>{
  for(const pose of [base,...poses.map(([,p])=>p),{...base,headYaw:.65,headPitch:-.3,headY:-1.1,headX:.85,bodyRoll:.35}]){
    const bones=buildCatSkeleton(pose),basePoint=material(18.6,26.4,3.8);
    assert.ok(distance(bones.coat(basePoint),bones.skullBase)<.12,'collar detaches from skull base');
    const shoulder=material(18.2,36,3);
    assert.ok(distance(bones.coat(shoulder),bones.body(shoulder))<1e-9,'collar pulls the whole torso');
    const neckLength=distance(bones.neckRoot,bones.skullBase);
    assert.ok(neckLength>3&&neckLength<5.5,'neck stretches into a stalk');
    let previous=null;
    for(let c=25;c<=36;c+=.25){
      const q=bones.coat(material(18.2,c,3));
      if(previous)assert.ok(distance(q,previous)<.3,'neck coat has a discontinuity');
      previous=q;
    }
  }
});

test('the cervical spine meets the shoulder and skull tangents through turns and rolls',()=>{
  const delta={x:(26.4-33)/1.73,y:-.5,z:1.6},epsilon=.00001;
  const offset=(p,k)=>({x:p.x+delta.x*k,y:p.y+delta.y*k,z:p.z+delta.z*k});
  const vector=(a,b)=>[a.x-b.x,a.y-b.y,a.z-b.z];
  const cosine=(u,v)=>u.reduce((n,x,i)=>n+x*v[i],0)/(Math.hypot(...u)*Math.hypot(...v));
  for(const pose of [base,...poses.map(([,p])=>p),{...base,headYaw:-.65,headPitch:.2,headY:-.7,bodyRoll:.3}]){
    const b=buildCatSkeleton(pose),start=b.neckSpine(0),end=b.neckSpine(1);
    assert.ok(distance(start,b.neckRoot)<1e-9);assert.ok(distance(end,b.skullBase)<1e-9);
    const from=vector(b.neckSpine(epsilon),start),to=vector(end,b.neckSpine(1-epsilon));
    const shoulder=vector(b.body(offset(material(18.1,33,2.2),epsilon)),start);
    const skull=vector(b.head(offset(material(18.6,26.4,3.8),epsilon)),end);
    assert.ok(cosine(from,shoulder)>.999999,'neck kinks at the shoulders');
    assert.ok(cosine(to,skull)>.999999,'neck kinks at the skull');
    let previous=start,previousDirection=null,length=0;
    for(let i=1;i<=32;i++){
      const next=b.neckSpine(i/32),direction=vector(next,previous);
      if(previousDirection)assert.ok(cosine(direction,previousDirection)>.99,'neck doubles back between joints');
      length+=distance(previous,next);previous=next;previousDirection=direction;
    }
    assert.ok(length<distance(start,end)*1.1,'neck makes an excessive arch');
  }
});

test('rendered neck fur stays connected through head turns, lifts, and rolls',()=>{
  for(const pose of [base,pet('nose'),pet('head'),poses[1][1],poses[2][1],poses.find(([name])=>name==='gesture-side-roll')[1]]){
    const {body,skeleton}=renderCatFrame(pose),rows=body.split('\n');
    for(let c=25;c<=35;c+=.5){
      const r=18.2,z=catTorsoSurface(r,c).depth;
      const p=project(skeleton.coat(material(r,c,z))),row=Math.round(p.r*4),column=Math.round((p.c-9)*4);
      let found=false;
      for(let y=row-2;y<=row+2;y++)for(let x=column-2;x<=column+2;x++)if(rows[y]?.[x]&&rows[y][x]!==' ')found=true;
      assert.ok(found,`rendered collar has a gap at column ${c}`);
    }
    if(pose.headYaw<-.4){
      for(let c=29;c<=34;c+=.5){
        const column=Math.round((c-9)*4),top=rows.findIndex(row=>row[column]!==' ')/4;
        assert.ok(top<=16.75,`leftward nape dips away from the back at column ${c}`);
      }
    }
  }
});
