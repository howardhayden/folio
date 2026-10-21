import { catPieces, DRAWING_COLUMNS as W, DRAWING_ROWS as H, DRAWING_SCALE as S, DRAWING_ORIGIN_COLUMN as ORIGIN } from './catDrawing.js';
import { buildCatSkeleton, curvedArm, project } from './catSkeleton.js';
import {catTorsoSurface} from './catAnatomy.js';
const SHADE=' .,:;clodxkO0KXNM';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const noise=(a,b)=>{const n=Math.sin(a*12.9898+b*78.233)*43758.5453;return (n-Math.floor(n))*2-1;};
const surfaces={};
for(const piece of catPieces){
  const rows=piece.text.split('\n'),samples=[],hair=[],fur=[];
  const occupied=(r,c)=>rows[r]?.[c]&&rows[r][c]!==' '?1:0;
  for(const [r,c,n] of piece.runs)for(let x=c;x<c+n;x++){
    const row=r/S,col=x/S+ORIGIN,value=SHADE.indexOf(rows[r][x]);
    let z=0,depth=.3;
    if(piece.id==='body'){
      depth=catTorsoSurface(row,col).depth;
    }else if(piece.id==='head-fur'){
      z=5;depth=3.1*Math.sqrt(Math.max(.025,1-Math.abs((col-21.4)/8.5)**2.4-Math.abs((row-19.25)/3.6)**2.8));
    }else if(piece.id.includes('ear')){z=piece.id==='left-ear'?5.7:4.3;depth=.38;}
    else if(piece.id==='tail'){z=-3.5;depth=.7;}
    else continue; // Paws are rounded volumes at the moving wrist, not cutouts.
    for(const sign of [-1,1])samples.push({x:col/1.73,y:-row,z:z+depth*sign,value:value+(sign<0?-.5:0)});
    // A dense, shallow pile softens the silhouette. Each tuft spreads along
    // the coat edge instead of extending as an isolated straight strand.
    if(!piece.id.includes('ear')&&noise(r+37,x)>-.6&&
      (!occupied(r-1,x)||!occupied(r+1,x)||!occupied(r,x-1)||!occupied(r,x+1))){
      let nx=0,ny=0;
      for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
        const inside=occupied(r+dy,x+dx);nx-=dx*inside;ny-=dy*inside;
      }
      nx*=1.73;
      const norm=Math.hypot(nx,ny)||1;nx/=norm;ny/=norm;
      const ruff=piece.id==='body'&&col<36;
      const reach=(ruff ? .20 : .14)+(noise(r+11,x)+1)*.05;
      const width=.23+noise(r+19,x)*.04;
      for(let i=0;i<=3;i++)for(let j=-2;j<=2;j++){
        const t=i/3,u=j/2,edge=Math.hypot(t,u);
        if(edge>1)continue;
        const outward=reach*t,along=width*u+noise(r,x)*.035*t*t;
        for(const sign of [-1,1])fur.push({x:col/1.73+nx*outward-ny*along,
          y:-row-ny*outward-nx*along,z:z+depth*sign,
          value:5.2-2.8*edge+noise(r,x)*.2});
      }
    }
  }
  const lines=piece.hair.split('\n');
  for(let r=0;r<H;r++)for(let c=0;c<W;c++)if(lines[r][c]!==' ')
    hair.push({x:(c/S+ORIGIN)/1.73,y:-r/S,z:piece.id==='head-fur'?8.15:piece.id==='left-ear'?6.2:4.8,ch:lines[r][c]});
  surfaces[piece.id]={samples,hair,fur};
}
function scene(){
  const depth=new Float32Array(W*H).fill(-1e5),ink=new Float32Array(W*H),weight=new Float32Array(W*H),hair=new Map();
  const cell=(r,c,z,value,w=1)=>{
    if(r<0||r>=H||c<0||c>=W||w<.025)return;
    const index=r*W+c;
    if(z>depth[index]+.28){depth[index]=z;ink[index]=value*w;weight[index]=w;}
    else if(z>=depth[index]-.28){ink[index]+=value*w;weight[index]+=w;depth[index]=Math.max(z,depth[index]);}
  };
  const splat=(p,value)=>{
    const col=(p.x*1.73-ORIGIN)*S,row=-p.y*S,r=Math.floor(row),c=Math.floor(col),fy=row-r,fx=col-c;
    cell(r,c,p.z,value,(1-fx)*(1-fy));cell(r,c+1,p.z,value,fx*(1-fy));
    cell(r+1,c,p.z,value,(1-fx)*fy);cell(r+1,c+1,p.z,value,fx*fy);
  };
  const tube=(a,b,radiusA,radiusB,seed)=>{
    const pa=project(a),pb=project(b),dr=pb.r-pa.r,dc=(pb.c-pa.c)/1.73,den=dr*dr+dc*dc;
    const radius=Math.max(radiusA,radiusB);
    const top=Math.max(0,Math.floor((Math.min(pa.r,pb.r)-radius)*S)),bottom=Math.min(H-1,Math.ceil((Math.max(pa.r,pb.r)+radius)*S));
    const left=Math.max(0,Math.floor((Math.min(pa.c,pb.c)-radius*1.73-ORIGIN)*S)),right=Math.min(W-1,Math.ceil((Math.max(pa.c,pb.c)+radius*1.73-ORIGIN)*S));
    for(let r=top;r<=bottom;r++)for(let c=left;c<=right;c++){
      const y=r/S-pa.r,x=(c/S+ORIGIN-pa.c)/1.73,t=clamp((y*dr+x*dc)/(den||1));
      const rad=radiusA+(radiusB-radiusA)*t,dist=Math.hypot(y-dr*t,x-dc*t);
      const n=noise(seed+t*5,(y*dc-x*dr)/Math.sqrt(den||1)*6);
      const fluff=.055*Math.sin(t*22+seed*2)+n*.065;
      if(dist>rad+fluff)continue;
      const rim=clamp((dist/rad-.78)/.24);
      const z=a.z+(b.z-a.z)*t+Math.sqrt(Math.max(0,rad*rad-dist*dist));
      cell(r,c,z,10.8-rim*2.2+n*.7);
    }
  };
  return {depth,weight,ink,hair,splat,tube};
}
function pawVolume(scene,center,angle,side){
  const theta=angle*Math.PI/180,cs=Math.cos(theta),sn=Math.sin(theta);
  for(let r=-5;r<=5;r++)for(let c=-12;c<=12;c++){
    const y=r/S,x=c/S/1.73;
    const field=Math.abs(x/1.62)**3.2+Math.abs(y/.90)**3.0;
    if(field>1)continue;
    const edge=field**.4,z=Math.sqrt(Math.max(0,1-field))*.72;
    const q={x:center.x+x*cs-y*sn,y:center.y-x*sn-y*cs,z:center.z+z};
    const toes=y>.28&&y<.73&&(Math.abs(x-.46)<.07||Math.abs(x+.46)<.07)?1.2:0;
    scene.splat(q,10.5-edge*.65+noise(r+side*7,c)*.6+toes);
  }
}
export function renderCatFrame(pose){
  const skeleton=buildCatSkeleton(pose),s=scene();
  const draw=(id,transform)=>{
    for(const p of surfaces[id].fur)s.splat(transform(p),p.value);
    for(const p of surfaces[id].samples){
      const q=transform(p);
      // The coat shades as its surface turns, while its sampled fur stays fixed
      // to the animal's structure rather than to screen coordinates.
      s.splat(q,p.value);
    }
    for(const p of surfaces[id].hair){
      const q=transform(p),r=Math.round(-q.y*S),c=Math.round((q.x*1.73-ORIGIN)*S);
      if(r>=0&&r<H&&c>=0&&c<W)s.hair.set(r*W+c,{z:q.z,ch:p.ch});
    }
  };
  draw('tail',skeleton.tail);draw('body',skeleton.coat);
  for(const side of ['left','right']){
    const lift=pose[`${side}Lift`]||0;
    if(lift>.015){
      const path=curvedArm(skeleton.arms[side]),grow=clamp(lift/.16);
      for(let i=1;i<path.length;i++){
        const t=i/(path.length-1),previous=(i-1)/(path.length-1);
        s.tube(path[i-1],path[i],(2.05-.5*previous)*grow,(2.05-.5*t)*grow,i+ (side==='left'?3:19));
      }
    }
  }
  draw('left-ear',skeleton.leftEar);draw('right-ear',skeleton.rightEar);draw('head-fur',skeleton.head);
  pawVolume(s,skeleton.paws.left,pose.leftAngle||0,1);pawVolume(s,skeleton.paws.right,pose.rightAngle||0,2);
  const body=[],hair=[];
  for(let r=0;r<H;r++){
    let line='',whisker='';
    for(let c=0;c<W;c++){
      const index=r*W+c,w=s.weight[index],h=s.hair.get(index);
      line+=w>.15?SHADE[Math.round(clamp(s.ink[index]/w,0,15)*Math.min(1,w/.55))]:' ';
      whisker+=h&&h.z>=s.depth[index]-.35?h.ch:' ';
    }
    body.push(line);hair.push(whisker);
  }
  return {body:body.join('\n'),hair:hair.join('\n'),skeleton};
}
