import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { asciiCatDrawing, asciiCatWhiskers, catPieces, CAT_TAIL_SPINE, DRAWING_COLUMNS as W, DRAWING_ROWS as H } from '../app/components/catDrawing.js';
import { ASCII_MINI_BAT_PATTERN } from '../app/components/asciiCharacter.js';
import { REST_POSE, CAT_GESTURES, gesturePose, pointerInDrawing, canBat, createBatMotion, sampleBatMotion, CatMotion } from '../app/components/catMotion.js';
import { buildCatSkeleton, curvedArm, project } from '../app/components/catSkeleton.js';
import { renderCatFrame } from '../app/components/catRenderer.js';
import {catTorsoSurface} from '../app/components/catAnatomy.js';
const hash = text => createHash('sha256').update(text).digest('hex');
function composite(pieces) {
  const text = Array.from({length:H}, () => Array(W).fill(' '));
  const hair = Array.from({length:H}, () => Array(W).fill(' '));
  for (const piece of pieces) {
    const rows = piece.text.split('\n'), hairs = piece.hair.split('\n');
    assert.equal(rows.length,H); assert.ok(rows.every(row=>row.length===W));
    for (const [r,c,n] of piece.runs) for (let x=c;x<c+n;x++) {
      text[r][x]=rows[r][x]; hair[r][x]=' ';
    }
    for (let r=0;r<H;r++) for (let c=0;c<W;c++) if(hairs[r][c]!==' ') hair[r][c]=hairs[r][c];
  }
  return {text:text.map(r=>r.join('')).join('\n'),hair:hair.map(r=>r.join('')).join('\n')};
}

test('the approved head and whiskers stay intact while the anatomical torso layers compose exactly',()=>{
  assert.equal(hash(asciiCatWhiskers),'647a98a2d57ca8c946b1510228e2e921c6beacb3f6daeb5e3868bb4002156990');
  assert.equal(hash(composite(catPieces.filter(p=>['left-ear','right-ear','head-fur'].includes(p.id))).text),'4b8f471250f8dc816d35eea95df085b640605320084e36bcd9b6f35f4430328b');
  assert.deepEqual(composite(catPieces),{text:asciiCatDrawing,hair:asciiCatWhiskers});
});

test('the torso has a tucked chest, curved back, and a narrowing rounded rump',()=>{
  const rows=catPieces.find(p=>p.id==='body').text.split('\n');
  const section=c=>rows.flatMap((row,r)=>row[Math.round((c-9)*4)]!==' '?[r/4]:[]);
  const chest=section(30),ribs=section(40),hip=section(52),rump=section(60);
  assert.ok(chest[0]>=ribs[0]&&chest[0]-ribs[0]<=.75,'the ruff should meet the back without a deep dip');
  const back=Array.from({length:31},(_,i)=>section(30+i)[0]);
  const crown=Math.min(...catPieces.find(p=>p.id==='head-fur').runs.map(([r])=>r))/4;
  assert.ok(Math.min(...back)>=crown-.75,'the resting torso rises too far above the head');
  for(let i=1;i<back.length-1;i++){
    const saddle=back[i]-Math.max(Math.min(...back.slice(0,i)),Math.min(...back.slice(i+1)));
    assert.ok(saddle<=.125,'the back has a gourd-like dip between separate humps');
  }
  assert.ok(rump.at(-1)-rump[0]<(hip.at(-1)-hip[0])*.65,'the rump should round off, not end as a slab');
  const left=Math.min(...rows.map(row=>row.search(/\S/)).filter(c=>c>=0))/4+9;
  assert.ok(left>=24,'excess torso protrudes in front of the chest');
  const [tailR,tailC]=CAT_TAIL_SPINE[0];
  assert.ok(tailR>section(tailC)[0]+1.5,'the tail root forms a bump above the rump');
});

test('turning the head right or rolling cannot reveal a slab of torso in front of the chest',()=>{
  const coat=catPieces.find(p=>p.id==='body');
  for(const headYaw of [-.58,0,.58])for(const bodyRoll of [-.35,0,.35]){
    const bones=buildCatSkeleton({...REST_POSE,headYaw,bodyRoll,bodyYaw:headYaw*.17});
    let left=Infinity;
    for(const [r,c,n] of coat.runs)for(let x=c;x<c+n;x++){
      const row=r/4,col=x/4+9,depth=catTorsoSurface(row,col).depth;
      for(const z of [-depth,depth])left=Math.min(left,project(bones.coat({x:col/1.73,y:-row,z})).c);
    }
    const headEdge=project(bones.head({x:12.9/1.73,y:-19.25,z:5})).c;
    assert.ok(left>headEdge+1,`torso projects past the head at yaw ${headYaw}, roll ${bodyRoll}`);
  }
});

test('every quiet gesture eases from and to rest with bounded frame changes',()=>{
  for(const [name,frames] of Object.entries(CAT_GESTURES)) {
    const duration=frames.at(-1)[0];
    assert.deepEqual(gesturePose(name,0),REST_POSE);
    assert.deepEqual(gesturePose(name,duration),REST_POSE);
    let previous=gesturePose(name,0);
    for(let t=16;t<duration+16;t+=16){
      const pose=gesturePose(name,t);
      for(const key of Object.keys(REST_POSE)){
        assert.ok(Number.isFinite(pose[key]));
        assert.ok(Math.abs(pose[key]-previous[key])<.9,`${name} ${key} at ${t}`);
      }
      previous=pose;
    }
  }
});

test('long-distance batting carries forward all four directions and the live mini-bat pattern',()=>{
  for(const direction of ['upper-left','upper-right','left','right'])
    for(let ordinal=0;ordinal<ASCII_MINI_BAT_PATTERN.length;ordinal++){
      const seq=createBatMotion(direction,ordinal,40);
      assert.equal(seq.contacts,1+ASCII_MINI_BAT_PATTERN[ordinal]);
      assert.equal(sampleBatMotion(seq,0).amount,0);
      assert.equal(sampleBatMotion(seq,seq.duration).amount,0);
      assert.ok(seq.nodes.some(n=>n.phase==='ready'&&n.amount===.22));
      assert.ok(seq.nodes.some(n=>n.phase==='reach'&&n.amount===.68));
      assert.ok(seq.nodes.some(n=>n.phase==='recoil'&&n.amount===.68));
      let previous=0;
      for(let time=1000/120;time<seq.duration;time+=1000/120){
        const {amount}=sampleBatMotion(seq,time);
        assert.ok(amount>=0&&amount<=1);
        assert.ok(Math.abs(amount-previous)<.09);
        previous=amount;
      }
    }
});

test('play reaches distant canvas corners and the surrounding halo, with original movement/dwell eligibility',()=>{
  const ready={point:{r:3,c:83},entered:0,now:600,travel:20,cooldown:0};
  assert.equal(canBat(ready),true);
  assert.equal(canBat({...ready,point:{r:-3,c:94}}),true);
  assert.equal(canBat({...ready,travel:0}),true,'dwell can provoke batting');
  for(const change of [{now:100},{now:400,travel:0},{cooldown:2000},{point:{r:-20,c:12}},{point:{r:12,c:180}}])
    assert.equal(canBat({...ready,...change}),false);
  assert.deepEqual(pointerInDrawing(500,200,{left:100,top:30,width:800,height:340}),{c:49,r:17});
  const cat=new CatMotion();cat.move({r:NaN,c:Infinity},100,20);
  assert.equal(cat.inside,false);assert.ok(Number.isFinite(cat.sample(200,40).headYaw));
});

test('full reaches meet the cursor while the skeleton turns and loads the forequarters',()=>{
  for(const point of [{r:3,c:13},{r:4,c:83},{r:30,c:13},{r:30,c:83}]){
    const cat=new CatMotion();cat.enter(point,0);cat.sample(600,16);
    const start=cat.action.start,peak=cat.action.sequence.nodes.find(n=>n.amount===1).time,side=cat.action.side;
    for(let t=16;t<peak;t+=16)cat.sample(start+t,16);
    const pose=cat.sample(start+peak,16),bones=buildCatSkeleton(pose),contact=project(bones.paws[side]);
    assert.ok(Math.hypot(contact.c-point.c,contact.r-point.r)<1e-8);
    assert.ok(Math.abs(pose.bodyYaw)>.01);assert.ok(Math.abs(pose.headYaw)>.1);
    assert.ok(Math.hypot(project(bones.paws[side]).c-project(bones.shoulders[side]).c,project(bones.paws[side]).r-project(bones.shoulders[side]).r)>15);
  }
});

test('batting can recur after cooldown; far departure follows briefly and then rests',()=>{
  const cat=new CatMotion();cat.enter({r:4,c:80},0);cat.sample(600,16);
  const finish=600+cat.action.sequence.duration;
  assert.equal(cat.taps,1);
  cat.sample(finish,16);assert.equal(cat.mode,'track');
  cat.sample(finish+1099,16);assert.equal(cat.taps,1);
  cat.sample(finish+1100,16);assert.equal(cat.taps,2);
  cat.sample(finish+1100+cat.action.sequence.duration,16);
  const departure=finish+5000;
  cat.move({r:20,c:180},departure,200);
  cat.sample(departure+1900,16);assert.equal(cat.mode,'follow');
  cat.nextGesture=Infinity;
  cat.move({r:20,c:190},departure+2100,20);cat.sample(departure+2100,16);
  assert.equal(cat.mode,'idle');assert.equal(cat.point.c,180);
});

test('quiet alternatives still cycle when the cursor is away',()=>{
  const cat=new CatMotion();let now=6500;
  for(const name of ['yawn','ear-rub','drowsy','side-roll','paw-wash','big-yawn']){
    cat.sample(now,16);assert.equal(cat.gesture,name);
    cat.sample(now+CAT_GESTURES[name].at(-1)[0],16);
    assert.equal(cat.taps,0);now=cat.nextGesture;
  }
});

test('tail sweeps broadly and independent ears remain continuous at 60 and 120 Hz',()=>{
  for(const step of [1000/60,1000/120]){
    const cat=new CatMotion();let previous=cat.sample(0,0),low=Infinity,high=-Infinity,earDifference=0,previousTip=null;
    for(let t=step;t<60000;t+=step){
      const pose=cat.sample(t,step);
      const tip=project(buildCatSkeleton(pose).tail({x:84.2/1.73,y:-18.9,z:-3.5}));
      if(previousTip)assert.ok(Math.abs(tip.r-previousTip.r)<.2);
      previousTip=tip;
      assert.ok(Math.abs(pose.leftEar-previous.leftEar)<2);
      assert.ok(Math.abs(pose.rightEar-previous.rightEar)<2);
      assert.ok(Math.abs(pose.headY-previous.headY)<.03);
      low=Math.min(low,tip.r);high=Math.max(high,tip.r);
      earDifference=Math.max(earDifference,Math.abs(pose.leftEar-pose.rightEar));
      previous=pose;
    }
    assert.ok(high-low>7);assert.ok(earDifference>7);
  }
});

test('curved furry forelegs stay connected through long reaches without angular segment seams',()=>{
  for(const target of [{r:3,c:13},{r:4,c:83},{r:30,c:13},{r:30,c:83}]){
    const side=target.c<30?'left':'right';
    const pose={...REST_POSE,batSide:side,batTargetC:target.c,batTargetR:target.r,[`${side}Lift`]:1,tailPhase:0};
    const frame=renderCatFrame(pose),rows=frame.body.split('\n'),path=curvedArm(frame.skeleton.arms[side]);
    assert.deepEqual(path[0],frame.skeleton.shoulders[side]);
    for(let i=1;i<path.length;i++){
      const q=project(path[i]),r=Math.round(q.r*4),c=Math.round((q.c-9)*4);
      let found=false;
      for(let y=r-2;y<=r+2;y++)for(let x=c-2;x<=c+2;x++)if(rows[y]?.[x]&&rows[y][x]!==' ')found=true;
      assert.ok(found,`${side} arm detaches at sample ${i}`);
      if(i>1){
        const a=path[i-2],b=path[i-1],d=path[i];
        const u=[b.x-a.x,b.y-a.y,b.z-a.z],v=[d.x-b.x,d.y-b.y,d.z-b.z];
        const cosine=u.reduce((n,x,k)=>n+x*v[k],0)/(Math.hypot(...u)*Math.hypot(...v));
        assert.ok(cosine>.97,'foreleg has a sharp kink');
      }
    }
  }
});

test('head yaw changes projected volume and depth; body rolls deform instead of translating',()=>{
  const rest=buildCatSkeleton(REST_POSE),turn=buildCatSkeleton({...REST_POSE,headYaw:.58});
  const front={x:21.4/1.73,y:-19.25,z:8.1},back={...front,z:1.9};
  const a=turn.head(front),b=turn.head(back);
  assert.ok(Math.abs(project(a).c-project(b).c)>5);
  assert.ok(Math.abs(a.z-b.z)<6.2);
  const rolled=buildCatSkeleton({...REST_POSE,bodyRoll:.35});
  const upper={x:28/1.73,y:-13,z:2},lower={x:28/1.73,y:-21,z:2};
  const du=rolled.body(upper).y-rest.body(upper).y,dl=rolled.body(lower).y-rest.body(lower).y;
  assert.ok(Math.abs(du-dl)>.3,'a roll must change the body shape');
  const normalFrame=renderCatFrame({...REST_POSE,tailPhase:0});
  const turnedFrame=renderCatFrame({...REST_POSE,headYaw:.58,tailPhase:0});
  assert.notEqual(normalFrame.body,turnedFrame.body);assert.notEqual(normalFrame.hair,turnedFrame.hair);
});

test('whisker roots follow the head through yaw and body roll in character coordinates',()=>{
  for(const yaw of [-.58,0,.58]){
    const frame=renderCatFrame({...REST_POSE,headYaw:yaw,bodyRoll:.16,tailPhase:0}),rows=frame.hair.split('\n');
    for(const side of [-1,1]){
      const root=project(frame.skeleton.head({x:(21.4+side*1.7)/1.73,y:-20.41,z:8.15}));
      const r=Math.round(root.r*4),c=Math.round((root.c-9)*4);let found=false;
      for(let y=r-3;y<=r+3;y++)for(let x=c-3;x<=c+3;x++)if(rows[y]?.[x]&&rows[y][x]!==' ')found=true;
      assert.ok(found,`whisker detached at yaw ${yaw}`);
    }
  }
});

test('the rendered coat is deterministic, changes on movement, and keeps a fixed character canvas',()=>{
  const pose={...REST_POSE,tailPhase:1.4,headYaw:.3,bodyRoll:.12};
  const a=renderCatFrame(pose),b=renderCatFrame(pose),c=renderCatFrame({...pose,headYaw:.4});
  assert.equal(a.body,b.body);assert.equal(a.hair,b.hair);assert.notEqual(a.body,c.body);
  for(const text of [a.body,a.hair,c.body,c.hair]){
    assert.equal(text.split('\n').length,H);assert.ok(text.split('\n').every(row=>row.length===W));
  }
});
