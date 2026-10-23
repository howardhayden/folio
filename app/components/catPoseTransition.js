import {buildCatSkeleton} from './catSkeleton.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=t=>t*t*t*(t*(t*6-15)+10);
const channels=['headX','headY','headAngle','headStretch','headYaw','headPitch',
  'bodyX','bodyY','bodyRoll','bodyYaw','bodyBend','backArch','rumpLift','leftEar','rightEar',
  'leftX','leftY','leftAngle','leftLift','rightX','rightY','rightAngle','rightLift',
  'leftPawWorldX','leftPawWorldY','leftPawWorldZ','rightPawWorldX','rightPawWorldY','rightPawWorldZ'];
const material=(r,c,z)=>({x:c/1.73,y:-r,z});
function landmarks(bones){
  return [bones.head(material(19.25,21.4,8.1)),bones.leftEar(material(14,15,6)),
    bones.rightEar(material(13,27,4.6)),bones.body(material(14,43,3)),
    bones.skullBase,bones.paws.left,bones.paws.right];
}
function limits(key,value){
  if(key.endsWith('Lift'))return clamp(value,0,1);
  if(key.endsWith('PawWorldX'))return clamp(value,10.5/1.73,87/1.73);
  if(key.endsWith('PawWorldY'))return clamp(value,-32.5,-1.5);
  if(key.endsWith('PawWorldZ'))return clamp(value,-6,13);
  if(key==='headStretch')return clamp(value,.85,1.2);
  if(key==='backArch')return clamp(value,0,1.2);
  return value;
}
// Crossfade an outgoing trajectory into a moving target, rather than restarting
// at a neutral pose. The quintic weights preserve velocity at both ends. New
// interruptions capture the current blended pose and its current velocity.
export class CatPoseTransition {
  constructor(){this.last=null;this.time=0;this.key='';this.velocity={};this.blend=null;}
  apply(raw,key,now,duration=320,{speed=Infinity,bodySpeed=speed,destination=raw}={}){
    const target={...raw},bones=buildCatSkeleton(raw);
    // Paw positions crossfade in world space. Switching the semantic gesture
    // must not teleport a paw from a distant bat target back to a tucked pose.
    for(const side of ['left','right'])for(const axis of ['X','Y','Z'])
      target[`${side}PawWorld${axis}`]=bones.paws[side][axis.toLowerCase()];
    if(!this.last){this.last=target;this.time=now;this.key=key;return target;}
    if(key!==this.key){
      if(Number.isFinite(speed)){
        const from=landmarks(buildCatSkeleton(this.last)),to=landmarks(buildCatSkeleton(destination));
        const travelTime=Math.max(...from.map((p,i)=>Math.hypot(p.x-to[i].x,p.y-to[i].y,p.z-to[i].z)/(i===3?bodySpeed:speed)));
        // The quintic's peak speed is 1.875 times its average speed. Measure
        // the anticipated destination before a pet response's own damping.
        duration=Math.max(duration,1875*travelTime);
      }
      this.blend={start:now,duration,from:{...this.last},velocity:{...this.velocity}};this.key=key;
    }
    const result={...target};
    if(this.blend){
      const blend=this.blend,t=clamp((now-blend.start)/blend.duration,0,1),weight=ease(t);
      const tau=Math.min(100,blend.duration*.3),coast=tau*(1-Math.exp(-(now-blend.start)/tau));
      for(const channel of channels){
        const from=blend.from[channel]??target[channel]??0,to=target[channel]??from;
        const outgoing=from+(blend.velocity[channel]||0)*coast;
        result[channel]=limits(channel,outgoing*(1-weight)+to*weight);
      }
      if(t>=1)this.blend=null;
    }
    const dt=now-this.time;
    if(dt>0)for(const channel of channels)
      this.velocity[channel]=((result[channel]??0)-(this.last[channel]??0))/dt;
    this.last=result;this.time=now;return result;
  }
}
