import test from 'node:test';
import assert from 'node:assert/strict';
import {CatMotion,REST_POSE,createBatMotion,sampleBatMotion,gesturePose} from '../app/components/catMotion.js';
import {catTouchLandmarks,classifyCatContact,petResponse} from '../app/components/catInteraction.js';
import {buildCatSkeleton,project} from '../app/components/catSkeleton.js';

function stroke(cat,zone,start=0,duration=2500){
  let pose=cat.lastPose,sawCancellation=false;
  const frames=Math.ceil(duration/(1000/24));
  for(let i=0;i<=frames;i++){
    const now=start+i*1000/24;
    if(i%3===0){
      const target=catTouchLandmarks(cat.lastPose)[zone];
      const amplitude=zone==='back'?5:.75;
      const point={r:target.r,c:target.c+Math.sin(i/3*Math.PI/2)*amplitude};
      cat.move(point,now,8);
    }
    pose=cat.sample(now,1000/24);
    sawCancellation ||= !!cat.action?.cancelled;
  }
  return {pose,sawCancellation};
}

test('touch regions follow head turning and ear joints instead of fixed screen rectangles',()=>{
  for(const pose of [REST_POSE,{...REST_POSE,headYaw:.46,headAngle:4,bodyRoll:.16,leftEar:-5}]){
    for(const [zone,point] of Object.entries(catTouchLandmarks(pose)))
      assert.equal(classifyCatContact(point,pose),zone,zone);
  }
  assert.equal(classifyCatContact({r:2,c:50},REST_POSE),'');
});

test('tail contact follows its current curve, while the rump welcomes back strokes',()=>{
  const resting={...REST_POSE,tailPhase:0},swishing={...REST_POSE,tailPhase:4.6};
  const center={x:80/1.73,y:-14.8,z:-3.5};
  const oldPoint=project(buildCatSkeleton(resting).tail(center));
  const movingPoint=project(buildCatSkeleton(swishing).tail(center));
  assert.equal(classifyCatContact(oldPoint,resting),'tail');
  assert.equal(classifyCatContact(movingPoint,swishing),'tail');
  assert.notEqual(classifyCatContact(oldPoint,swishing),'tail');
  const rump=project(buildCatSkeleton(resting).body({x:59/1.73,y:-15,z:3}));
  assert.equal(classifyCatContact(rump,resting),'back');
});

test('a stationary hand on the head stays welcome without inventing strokes or batting at itself',()=>{
  const cat=new CatMotion(),point=catTouchLandmarks(REST_POSE).head;
  cat.move(point,0);
  let pose;
  for(let now=0;now<=3000;now+=1000/24)pose=cat.sample(now,1000/24);
  assert.equal(pose.petAmount,0);assert.equal(cat.taps,0);
  const quick=new CatMotion(),nose=catTouchLandmarks(REST_POSE).nose;
  quick.move(nose,0);quick.move({...nose,c:nose.c+1.8},5,30);
  assert.equal(quick.sample(50,40).petAmount,0,'a fast cursor pass is not a gentle rub');
});

test('nose and forehead strokes lift the head into the hand without adding facial features',()=>{
  for(const zone of ['nose','head']){
    const cat=new CatMotion(),{pose}=stroke(cat,zone);
    assert.equal(pose.petZone,zone);assert.ok(pose.petAmount>.65);
    assert.ok(pose.headY<-.35);assert.ok(pose.headPitch<-.06);
    assert.equal(cat.taps,0);
    assert.equal(cat.mode,'pet');
  }
});

test('cheek and ear rubs lean toward the side being touched',()=>{
  for(const part of ['cheek','ear'])for(const [side,sign] of [['left',-1],['right',1]]){
    const cat=new CatMotion(),zone=`${part}-${side}`,{pose}=stroke(cat,zone);
    assert.equal(pose.petZone,zone);assert.ok(pose.petAmount>.65);
    assert.ok(pose.headX*sign>.3);assert.ok(pose.headYaw*sign>.12);
    assert.ok(pose.headAngle*sign>2);assert.equal(cat.taps,0);
  }
});

test('longitudinal back strokes arch the spine and raise the hindquarters',()=>{
  const cat=new CatMotion(),{pose}=stroke(cat,'back');
  assert.equal(pose.petZone,'back');assert.ok(pose.petAmount>.65);
  assert.ok(pose.backArch>.5);assert.ok(pose.rumpLift>.2);assert.equal(cat.taps,0);
  const bones=buildCatSkeleton(pose),neutral=buildCatSkeleton({...pose,backArch:0,rumpLift:0});
  const mid={x:43/1.73,y:-14,z:3};
  assert.ok(bones.body(mid).y-neutral.body(mid).y>.5);
  const downward=petResponse('back',1,{r:14,c:60},REST_POSE);
  const upward=petResponse('back',1,{r:14,c:31},REST_POSE);
  assert.ok(downward.rumpLift>upward.rumpLift);
});

test('petting fades back to rest rather than sticking after the cursor leaves',()=>{
  const cat=new CatMotion(),{pose}=stroke(cat,'nose');
  assert.ok(pose.petAmount>.65);
  cat.leave(2600);cat.nextGesture=Infinity;
  let end;
  for(let now=2650;now<=6000;now+=1000/24)end=cat.sample(now,1000/24);
  assert.ok(end.petAmount<.01);assert.equal(end.petZone,'');assert.equal(cat.mode,'idle');
});

test('tail disturbance uses faster, sharper bats and retains every authored follow-up count',()=>{
  for(let ordinal=0;ordinal<12;ordinal++){
    const calm=createBatMotion('right',ordinal,30),sharp=createBatMotion('right',ordinal,30,'tail');
    assert.equal(sharp.contacts,calm.contacts);assert.ok(sharp.duration<calm.duration*.6);
  }
  const triple=createBatMotion('right',10,30,'tail');assert.equal(triple.contacts,4);
  let calmSpeed=0,sharpSpeed=0;
  for(const mood of ['play','tail']){
    const seq=createBatMotion('right',10,30,mood);let previous=0;
    for(let t=8;t<seq.duration;t+=8){
      const amount=sampleBatMotion(seq,t).amount;
      if(mood==='tail')sharpSpeed=Math.max(sharpSpeed,Math.abs(amount-previous));
      else calmSpeed=Math.max(calmSpeed,Math.abs(amount-previous));
      previous=amount;
    }
  }
  assert.ok(sharpSpeed>calmSpeed*2);
  const cat=new CatMotion(),tail=project(buildCatSkeleton(REST_POSE).tail({x:80/1.73,y:-14.8,z:-3.5}));
  cat.move(tail,0);cat.sample(180,40);
  assert.equal(cat.action.sequence.mood,'tail');assert.equal(cat.lastPose.petAmount,0);
  const petted=new CatMotion();stroke(petted,'back');
  const touched=project(buildCatSkeleton(petted.lastPose).tail({x:80/1.73,y:-14.8,z:-3.5}));
  petted.move(touched,2600,100);petted.sample(2640,40);
  assert.equal(petted.action.sequence.mood,'tail','tail disturbance overrides contented petting');
});

test('an incoming bat retracts continuously when the cursor starts petting',()=>{
  const cat=new CatMotion();cat.taps=10;cat.enter({r:4,c:80},0);cat.sample(600,40);
  const peak=cat.action.sequence.nodes.find(n=>n.amount===1).time;
  cat.sample(600+peak,40);
  const {pose,sawCancellation}=stroke(cat,'nose',620+peak,1500);
  assert.ok(sawCancellation);assert.ok(pose.petAmount>.4);assert.equal(cat.taps,11);
  assert.equal(cat.action,null);assert.equal(pose.rightLift,0);
});

test('ear grooming turns the face toward the paw doing the rubbing',()=>{
  const pose={...gesturePose('ear-rub',1700),gesture:'ear-rub'},bones=buildCatSkeleton(pose);
  assert.ok(pose.headYaw<-.4);
  const center=project(bones.head({x:21.4/1.73,y:-19.25,z:5}));
  const face=project(bones.head({x:21.4/1.73,y:-19.25,z:8.1}));
  const paw=project(bones.paws.left);
  assert.ok((face.c-center.c)*(paw.c-center.c)>0);
});

test('a tail disturbance interrupts grooming through a short retraction before the sharper bat',()=>{
  const cat=new CatMotion();cat.nextGesture=0;cat.gestureIndex=1;
  cat.sample(0,0);cat.sample(1400,40);assert.equal(cat.gesture,'ear-rub');
  const tail=project(buildCatSkeleton(cat.lastPose).tail({x:80/1.73,y:-14.8,z:-3.5}));
  cat.move(tail,1450,20);const start=cat.sample(1450,40);
  assert.equal(cat.action.cancelled.reason,'tail');assert.ok(start.leftLift>.8);
  const halfway=cat.sample(1560,40);assert.ok(halfway.leftLift<start.leftLift);
  cat.sample(1670,40);cat.sample(1710,40);
  assert.equal(cat.action.kind,'bat');assert.equal(cat.action.sequence.mood,'tail');
});
