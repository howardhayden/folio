// Carry the live cat's authored batting cadence forward, but interpolate every
// transition as joint poses sampled by the generated-character clock.
import { createAsciiBatSequence, ASCII_INTERACTION_TIMING } from './asciiCharacter.js';
import { classifyCatContact, contactDistance, PET_ZONES, petResponse } from './catInteraction.js';
import { CatPoseTransition } from './catPoseTransition.js';
export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const ease = t => { const x = clamp(t); return x * x * x * (x * (x * 6 - 15) + 10); };
export const damp = (from, to, dt, duration = 240) => from + (to - from) * (1 - Math.exp(-dt / duration));
export const REST_POSE = Object.freeze({ headX: 0, headY: 0, headAngle: 0, headStretch: 1,
  bodyX: 0, bodyY: 0, bodyRoll: 0, bodyYaw: 0, bodyBend: 0, backArch: 0, rumpLift: 0,
  headYaw: 0, headPitch: 0, leftEar: 0, rightEar: 0,
  leftX: 0, leftY: 0, leftAngle: 0, leftLift: 0,
  rightX: 0, rightY: 0, rightAngle: 0, rightLift: 0 });
const keys = Object.keys(REST_POSE);
const frame = (time, values = {}) => [time, { ...REST_POSE, ...values }];
export const CAT_GESTURES = {
  yawn: [frame(0), frame(650, { headY: -.35, headAngle: -2.3, headStretch: 1.025 }),
    frame(1300, { headY: -.75, headAngle: -4.8, headStretch: 1.055, leftX: -.5, leftY: -.2 }),
    frame(1750, { headY: -.75, headAngle: -4.8, headStretch: 1.055, leftX: -.5, leftY: -.2 }), frame(2700)],
  'big-yawn': [frame(0), frame(1000, { headY: -.9, headAngle: -6, headStretch: 1.07,
    leftX: -1, leftY: -.3, leftLift: .35, rightX: -.8, rightY: -.2, rightLift: .25 }),
    frame(2000, { headY: -1.05, headAngle: -6.2, headStretch: 1.075,
      leftX: -1.2, leftY: -.4, leftLift: .4, rightX: -1, rightY: -.3, rightLift: .3 }), frame(3600)],
  drowsy: [frame(0), frame(900, { headY: .3, headAngle: 1.4 }),
    frame(1600, { headY: .3, headAngle: 1.4 }), frame(2600)],
  'side-roll': [frame(0), frame(1100, { bodyRoll: .32, bodyYaw: -.06, headYaw: -.18, headAngle: -3,
    leftLift: .2, rightLift: .3, leftX: -.6, leftY: -.25, rightX: .8, rightY: -.4 }),
    frame(2400, { bodyRoll: .38, bodyYaw: -.08, headYaw: -.22, headAngle: -4,
      leftLift: .25, rightLift: .35, leftX: -1, leftY: -.4, rightX: 1, rightY: -.5 }), frame(4200)],
  'ear-rub': [frame(0),
    frame(1000, { headAngle: -3, headYaw: -.44, headPitch: -.08, leftX: -13.2, leftY: -9.4, leftAngle: -25, leftLift: 1 }),
    ...[1350, 1700, 2050, 2400, 2750].map((time, i) => frame(time, {
      headAngle: i % 2 ? -3 : -4, headY: i % 2 ? 0 : .12,
      headYaw: i % 2 ? -.44 : -.49, headPitch: -.08,
      leftX: i % 2 ? -13.2 : -13.0, leftY: i % 2 ? -9.4 : -8.7,
      leftAngle: i % 2 ? -25 : -21, leftLift: 1 })),
    frame(3150, { headAngle: -2, headYaw: -.32, headPitch: -.06, leftX: -11.5, leftY: -8, leftAngle: -18, leftLift: .9 }), frame(4200)],
  'paw-wash': [frame(0), frame(850, { leftX: -5.6, leftY: -2.4, leftAngle: 12, leftLift: 1 }),
    ...[1200, 1550, 1900, 2250].map((time, i) => frame(time, {
      leftX: -5.6, leftY: -2.4, leftAngle: 12, leftLift: 1,
      headY: i % 2 ? 0 : .3, headAngle: i % 2 ? 0 : 2 })), frame(3400)],
};
export function gesturePose(name, elapsed) {
  const frames = CAT_GESTURES[name];
  if (!frames || elapsed <= 0 || elapsed >= frames.at(-1)[0]) return { ...REST_POSE };
  const index = frames.findIndex(([time]) => time > elapsed);
  const [start, a] = frames[index - 1], [end, b] = frames[index];
  const t = ease((elapsed - start) / (end - start));
  return Object.fromEntries(keys.map(key => [key, a[key] + (b[key] - a[key]) * t]));
}
export function pointerInDrawing(x, y, rect) {
  return { c: 9 + (x - rect.left) / rect.width * 80, r: (y - rect.top) / rect.height * 34 };
}
export function nearestPaw(point) {
  return ['left', 'right'].map((side, i) => ({ side,
    distance: Math.hypot(point.r - 23, (point.c - (i ? 40 : 28)) / 1.73) }))
    .sort((a, b) => a.distance - b.distance)[0];
}
export function inPlayArea(point) {
  return point.c >= -1 && point.c <= 99 && point.r >= -5 && point.r <= 39;
}
export function canBat({ point, entered, travel, cooldown, now }) {
  return inPlayArea(point) && now >= cooldown && now - entered >= 180 &&
    (travel >= ASCII_INTERACTION_TIMING.movementThreshold || now - entered >= ASCII_INTERACTION_TIMING.dwellMs);
}
export function createBatMotion(direction, ordinal = 0, distance = 20, mood = 'play') {
  const authored = createAsciiBatSequence(direction, ordinal);
  const speed = mood === 'tail' ? .56 + clamp(distance / 45) * .1 : 1.3 + clamp(distance / 45) * .45;
  const amounts = { ready: .22, reach: .68, contact: 1, 'mini-in': mood === 'tail' ? .66 : .84, 'mini-contact': mood === 'tail' ? 1 : .97, recoil: mood === 'tail' ? .42 : .68 };
  const nodes = [{ time: 0, amount: 0, phase: 'ready' }];
  let time = 0;
  for (const { pose, durationMs } of authored) {
    const phase = pose.replace(`bat-${direction}-`, '');
    const duration = durationMs * speed;
    // The paw arrives during the contact phase and lingers at the cursor.
    if (phase === 'contact' || phase === 'mini-contact')
      nodes.push({ time: time + duration * .62, amount: amounts[phase], phase });
    time += duration;
    nodes.push({ time, amount: amounts[phase], phase });
  }
  const settleAt = time;
  time += ASCII_INTERACTION_TIMING.settleMs * (mood === 'tail' ? .75 : 1.65);
  nodes.push({ time, amount: 0, phase: 'settle' });
  return { nodes, duration: time, settleAt, mood,
    contacts: authored.filter(({ pose }) => pose.endsWith('contact')).length };
}
export function sampleBatMotion(sequence, elapsed) {
  const nodes = sequence.nodes;
  if (elapsed <= 0 || elapsed >= sequence.duration) return { amount: 0, phase: elapsed <= 0 ? 'ready' : 'settle' };
  const index = nodes.findIndex(node => node.time > elapsed);
  const a = nodes[index - 1], b = nodes[index];
  const t=clamp((elapsed-a.time)/(b.time-a.time));
  const transition=sequence.mood==='tail'?(b.amount>a.amount?1-(1-t)**4:t*t):ease(t);
  return { amount: a.amount + (b.amount - a.amount) * transition, phase: b.phase };
}
const sequence = ['yawn', 'ear-rub', 'drowsy', 'side-roll', 'paw-wash', 'big-yawn'];
export class CatMotion {
  constructor() {
    this.mode='idle';this.gesture='';this.inside=false;this.point={c:28,r:19};
    this.entered=0;this.lastMove=0;this.travel=0;this.cooldown=0;
    this.followUntil=0;this.action=null;this.nextGesture=6500;this.gestureIndex=0;
    this.gazeX=0;this.gazeY=0;this.tailPhase=0;this.tailSpeed=1;this.taps=0;
    this.lastPose={...REST_POSE,tailPhase:0,breath:1};this.contact='';
    this.previousInput=null;this.previousInputAt=0;this.previousContact='';this.strokeTravel=0;
    this.petZone='';this.petUntil=0;this.petEnergy=0;this.petWeight=0;
    this.tailAlarmUntil=0;this.tailAlarm=0;
    this.petPose=petResponse('',0,this.point,this.lastPose);this.poseTransition=new CatPoseTransition();
  }
  enter(point,now){
    this.inside=true;this.point=point;this.entered=now;this.lastMove=now;this.travel=0;
  }
  move(point,now,distance=0){
    if(!Number.isFinite(point.r)||!Number.isFinite(point.c))return;
    const near=inPlayArea(point);
    if(near&&!this.inside)this.enter(point,now);
    if(!near&&this.inside)this.leave(now);
    if(!near&&now>=this.followUntil)return;
    const contact=classifyCatContact(point,this.lastPose);
    const elapsed=now-this.previousInputAt;
    const step=this.previousInput?contactDistance(point,this.previousInput):0;
    if(contact!==this.previousContact||elapsed>750)this.strokeTravel=0;
    const gentle=PET_ZONES.has(contact)&&contact===this.previousContact&&step>.015&&
      elapsed<=750&&step/Math.max(8,elapsed)<.075;
    const alongBack=contact!=='back'||this.previousInput&&Math.abs(point.c-this.previousInput.c)/1.73>Math.abs(point.r-this.previousInput.r)*.5;
    if(gentle&&alongBack){
      this.strokeTravel=Math.min(5,this.strokeTravel+step);
      if(this.strokeTravel>(contact==='back'?1.1:.4)){
        this.petZone=contact;this.petUntil=now+1150;
        this.petEnergy=clamp(this.petEnergy*.86+step*.36+.12,.2,1);
        this.nextGesture=now+6500;this.tailAlarmUntil=now;
      }
    }else if(step>0)this.strokeTravel*=.5;
    if(contact==='tail')this.tailAlarmUntil=now+1500;
    this.previousInput={...point};this.previousInputAt=now;this.previousContact=contact;
    this.point=point;this.lastMove=now;this.contact=contact;
    if(this.inside)this.travel+=distance;
  }
  leave(now){this.inside=false;this.followUntil=now+2000;this.previousInput=null;this.previousContact='';this.strokeTravel=0;}
  sample(now,dt){
    if(!this.poseTransition.last)this.poseTransition.apply(this.lastPose,'idle',now);
    this.contact=this.inside?classifyCatContact(this.point,this.lastPose):'';
    if(this.contact==='tail'){
      this.tailAlarmUntil=now+1500;this.petUntil=Math.min(this.petUntil,now);this.petEnergy=0;
      if(this.action?.kind==='gesture'&&!this.action.cancelled)
        this.action.cancelled={at:now,pose:gesturePose(this.action.name,now-this.action.start),duration:220,reason:'tail'};
    }
    this.tailAlarm=damp(this.tailAlarm,now<this.tailAlarmUntil?1:0,dt,now<this.tailAlarmUntil?100:500);
    const affection=now<this.petUntil?this.petEnergy*clamp((this.petUntil-now)/400):0;
    this.petWeight=damp(this.petWeight,affection,dt,affection>this.petWeight?140:this.contact==='tail'?90:360);
    if(now>this.petUntil)this.petEnergy=damp(this.petEnergy,0,dt,500);
    // A hand stroking the cat gets a lean, not an incoming play strike. Finish
    // any existing reach by retracting from its current position.
    if(this.action?.kind==='bat'&&!this.action.cancelled&&this.petWeight>.08&&PET_ZONES.has(this.contact))
      this.action.cancelled={at:now,from:this.action.lastAmount||0};
    const tailMood=now<this.tailAlarmUntil&&!PET_ZONES.has(this.contact);
    const eligible=tailMood?
      now-this.entered>=120&&now>=this.cooldown:
      canBat({point:this.point,entered:this.entered,travel:this.travel,cooldown:this.cooldown,now});
    if(!this.action&&this.inside&&!PET_ZONES.has(this.contact)&&(this.petWeight<.12||tailMood)&&eligible){
      const side=nearestPaw(this.point).side,direction=`${this.point.r<19?'upper-':''}${side}`;
      this.action={kind:'bat',start:now,side,point:{...this.point},lastAmount:0,
        sequence:createBatMotion(direction,this.taps,nearestPaw(this.point).distance,tailMood?'tail':'play')};
      this.travel=0;this.taps++;
    }
    if(!this.action&&this.petWeight<.05&&now>=this.nextGesture&&(!this.inside||now-this.lastMove>6000)){
      const name=sequence[this.gestureIndex++%sequence.length];this.action={kind:'gesture',start:now,name};
    }
    let pose={...REST_POSE},bat=null;this.gesture='';
    if(this.action){
      const action=this.action,elapsed=now-action.start;
      const duration=action.cancelled?action.cancelled.at-action.start+(action.cancelled.duration||340):
        action.kind==='bat'?action.sequence.duration:CAT_GESTURES[action.name].at(-1)[0];
      if(elapsed>=duration){
        this.action=null;this.cooldown=now+(action.cancelled?.reason==='tail'?0:action.kind==='bat'&&action.sequence.mood==='tail'?360:ASCII_INTERACTION_TIMING.cooldownMs);
        this.nextGesture=now+6500+(this.gestureIndex%3)*1400;this.travel=0;
      }else if(action.kind==='gesture'){
        this.mode='gesture';this.gesture=action.name;
        if(action.cancelled){
          const t=ease((now-action.cancelled.at)/action.cancelled.duration);
          pose=Object.fromEntries(keys.map(key=>[key,action.cancelled.pose[key]+(REST_POSE[key]-action.cancelled.pose[key])*t]));
        }else pose=gesturePose(action.name,elapsed);
      }else{
        this.mode=action.cancelled||elapsed>=action.sequence.settleAt?'settle':'bat';
        const sample=action.cancelled?{amount:action.cancelled.from*(1-ease((now-action.cancelled.at)/340)),phase:'settle'}:
          sampleBatMotion(action.sequence,elapsed);
        if(this.inside&&!action.cancelled){
          action.point.c=damp(action.point.c,this.point.c,dt,action.sequence.mood==='tail'?55:160);
          action.point.r=damp(action.point.r,this.point.r,dt,action.sequence.mood==='tail'?55:160);
        }
        action.lastAmount=sample.amount;
        bat={...sample,side:action.side,mood:action.sequence.mood,
          point:{c:clamp(action.point.c,12,85.5),r:clamp(action.point.r,2.4,31.3)}};
      }
    }
    if(!this.action)this.mode=this.petWeight>.05?'pet':this.inside?'track':now<this.followUntil?'follow':'idle';
    const attentive=!this.gesture&&(this.inside||now<this.followUntil),relax=1-this.petWeight*.85;
    const tx=attentive?clamp((this.point.c-24)/30,-1,1)*relax:0;
    const ty=attentive?clamp((this.point.r-19)/17,-1,1)*relax:0;
    this.gazeX=damp(this.gazeX,tx,dt,180);this.gazeY=damp(this.gazeY,ty,dt,210);
    pose.headX+=this.gazeX*.25;pose.headY+=this.gazeY*.22;pose.headAngle+=this.gazeX*1.1;
    pose.headYaw+=this.gazeX*.58;pose.headPitch+=this.gazeY*.21+pose.headY*.08;
    const reach=bat?bat.amount:0;
    pose.bodyX+=this.gazeX*.22;pose.bodyY+=this.gazeY*.08;
    pose.bodyRoll+=this.gazeY*.07+Math.sin(Math.PI*reach)*(bat?.side==='left'?-.16:.16)*(bat?.mood==='tail'?1.6:1);
    pose.bodyYaw+=this.gazeX*.10;pose.bodyBend+=-this.gazeY*.035+pose.headY*-.015-reach*.025;
    if(bat){
      pose.batSide=bat.side;pose.batTargetC=bat.point.c;pose.batTargetR=bat.point.r;
      pose[`${bat.side}Angle`]=(bat.side==='left'?-7:7)*reach;pose[`${bat.side}Lift`]=reach;
    }
    const flick=offset=>{
      const t=((now+offset)%6900)/520;return t<1?Math.sin(Math.PI*t)**2*Math.sin(Math.PI*t*2)*9:0;
    };
    pose.leftEar=this.gazeX*4+Math.sin(now*.0018)*1.3+flick(2200)-pose.leftLift*(this.gesture==='ear-rub'?7:0)-this.tailAlarm*7;
    pose.rightEar=this.gazeX*3-Math.sin(now*.0016)*1.1+flick(0)+this.tailAlarm*7;
    const response=petResponse(this.petZone,this.petWeight*(this.gesture==='ear-rub'?.25:1),this.point,this.lastPose);
    for(const [key,value] of Object.entries(response)){
      this.petPose[key]=damp(this.petPose[key],value,dt,this.contact==='tail'?65:130);
      pose[key]+=this.petPose[key];
    }
    this.tailSpeed=damp(this.tailSpeed,this.tailAlarm>.3?2.25:this.petWeight>.1?.8:bat?1.45:this.gesture?.85:1,dt,350);
    this.tailPhase+=dt*.0014*this.tailSpeed;
    const target={...pose,gesture:this.gesture,batPhase:bat?.phase||'',batAmount:bat?.amount||0,
      batFollowups:this.action?.kind==='bat'?this.action.sequence.contacts-1:0,
      petZone:this.petWeight>.025?this.petZone:'',petAmount:this.petWeight,contact:this.contact,
      mood:this.tailAlarm>.25?'tail':this.petWeight>.08?'content':bat?'play':'calm',
      tailAgitation:this.tailAlarm,tailPhase:this.tailPhase,breath:1+Math.sin(now*.0017)*.0045};
    const petKey=this.petWeight>.025?`:pet-${this.petZone}`:'';
    const actionPetKey=this.action?.kind==='bat'&&!this.action.cancelled?'':petKey;
    const responseKey=this.action?`${this.action.kind}:${this.action.start}:${this.action.name||this.action.sequence.mood}${this.action.cancelled?':settle':''}${actionPetKey}`:
      petKey||this.mode;
    // Internal bat phases keep their authored timing and sharp tail rhythm.
    // Changes between responses share one anatomical handoff instead of
    // independently snapping the head, torso, or paw targets.
    const handoffMs=this.tailAlarm>.25?90:this.action?.kind==='bat'&&!this.action.cancelled?120:petKey?360:300;
    const destination={...target};
    for(const [key,value] of Object.entries(response))destination[key]+=value-this.petPose[key];
    const striking=this.tailAlarm>.25||this.action?.kind==='bat'&&!this.action.cancelled;
    this.lastPose=this.poseTransition.apply(target,responseKey,now,handoffMs,
      {speed:striking?Infinity:petKey?6.5:14,bodySpeed:petKey?2.6:14,destination});
    return this.lastPose;
  }
}
