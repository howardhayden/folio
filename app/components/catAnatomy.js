// Reclining torso volumes in the same material coordinates as the coat.
// The chest fits underneath the neck; the ribs taper into rounded hips and a
// folded rear thigh. Broadly overlapping ribs and hips give the fur one gentle
// back curve. The shared surface also supplies the renderer's depth.
const volumes=[
  {r:18.0,c:30.6,ry:4.5,rx:6.6,rz:4.4},
  {r:17.4,c:41.0,ry:4.85,rx:13.3,rz:5.0},
  {r:17.6,c:50.6,ry:4.8,rx:10.9,rz:5.1},
  {r:20.1,c:52.3,ry:2.55,rx:7.6,rz:4.7},
];
const clamp=(v)=>Math.max(0,Math.min(1,v));
function distance(r,c,z){
  // A reclining cat carries its ribs close to the floor. Keep the underside
  // planted while lowering the resting back relative to the head and ears.
  r=22.5+(r-22.5)/.75;
  let field=Infinity;
  for(const v of volumes){
    const d=(Math.hypot((c-v.c)/v.rx,(r-v.r)/v.ry,z/v.rz)-1)*Math.min(v.rx/1.73,v.ry,v.rz);
    const blend=clamp(.5+.5*(d-field)/1.2);
    field=field===Infinity?d:d*(1-blend)+field*blend-1.2*blend*(1-blend);
  }
  return field;
}
const cache=new Map();
export function catTorsoSurface(r,c){
  const key=`${r},${c}`;
  if(cache.has(key))return cache.get(key);
  if(distance(r,c,0)>0){cache.set(key,null);return null;}
  let lo=0,hi=7;
  for(let i=0;i<16;i++){
    const mid=(lo+hi)/2;
    if(distance(r,c,mid)<=0)lo=mid;else hi=mid;
  }
  const surface={depth:(lo+hi)/2};
  cache.set(key,surface);return surface;
}
