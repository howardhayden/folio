"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { ASCII_CAT_DRAWING_DESCRIPTION, DRAWING_COLUMNS, DRAWING_ROWS } from "./catDrawing.js";
import { CatMotion, REST_POSE, pointerInDrawing } from "./catMotion.js";
import { renderCatFrame } from "./catRenderer.js";

const drawingStyle: CSSProperties = {
  color: "var(--body-color, #343b36)",
  fontFamily: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
  fontSize: "min(3px, .51cqw)", fontWeight: 400, letterSpacing: 0,
  lineHeight: 1.05, margin: 0, overflow: "visible", textAlign: "left",
  transition: "none", userSelect: "none", whiteSpace: "pre", width: "max-content",
  gridArea: "1 / 1", display: "grid",
  // WebKit floors tiny line boxes to whole pixels. Position rows with grid
  // tracks instead, using the same cell proportions as the skeleton projection.
  aspectRatio: `${DRAWING_COLUMNS} / ${DRAWING_ROWS * 1.73}`,
  gridTemplateRows: `repeat(${DRAWING_ROWS}, minmax(0, 1fr))`,
};
const resting = renderCatFrame({ ...REST_POSE, tailPhase: 0 });
const FRAME_MS = 1000 / 24;
function drawingRows(text: string) {
  return text.split("\n").map((line, index) => <span key={index} style={{minHeight: 0}}>
    {line}{index < DRAWING_ROWS - 1 ? "\n" : ""}
  </span>);
}
function updateRows(rows: Element[], text: string) {
  text.split("\n").forEach((line, index) => {
    const value = line + (index < DRAWING_ROWS - 1 ? "\n" : "");
    if (rows[index].textContent !== value) rows[index].textContent = value;
  });
}
export function AsciiDrawing() {
  const stageRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLPreElement>(null);
  const hairRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const stage=stageRef.current,body=bodyRef.current,hair=hairRef.current;
    if(!stage||!body||!hair)return;
    const bodyRows=Array.from(body.children),hairRows=Array.from(hair.children);
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine=window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
    let motion=new CatMotion(),raf=0,lastTime=0,activeTime=0,lastFrame=-FRAME_MS,lastSample=0,count=0;
    let lastPoint:{x:number;y:number}|null=null;
    const draw=(pose:Parameters<typeof renderCatFrame>[0])=>{
      const frame=renderCatFrame(pose);
      updateRows(bodyRows,frame.body);updateRows(hairRows,frame.hair);
      stage.dataset.asciiBatPhase=pose.batPhase||"";
      stage.dataset.asciiBatReach=(pose.batAmount||0).toFixed(2);
      stage.dataset.asciiBatFollowups=String(pose.batFollowups||0);
      stage.dataset.asciiContact=pose.contact||"";
      stage.dataset.asciiPetZone=pose.petZone||"";
      stage.dataset.asciiPetAmount=(pose.petAmount||0).toFixed(2);
      stage.dataset.asciiMood=pose.mood||"calm";
    };
    const status=()=>{
      stage.dataset.asciiMode=reduced.matches?"idle":motion.mode;
      stage.dataset.asciiGesture=motion.gesture;
      stage.dataset.asciiPlayCount=String(motion.taps);
    };
    const tick=(timestamp:number)=>{
      raf=0;if(document.hidden||reduced.matches)return;
      if(!stage.getClientRects().length){lastTime=0;raf=requestAnimationFrame(tick);return;}
      const dt=lastTime?Math.min(80,timestamp-lastTime):0;
      lastTime=timestamp;activeTime+=dt;
      // Regenerate on a deliberate character clock. Joints still evolve with
      // elapsed time, but no cached text image is translated or stretched.
      if(activeTime-lastFrame>=FRAME_MS){
        draw(motion.sample(activeTime,activeTime-lastSample));lastSample=activeTime;
        lastFrame+=Math.floor((activeTime-lastFrame)/FRAME_MS)*FRAME_MS;
        status();stage.dataset.asciiFrameCount=String(++count);
      }
      raf=requestAnimationFrame(tick);
    };
    const start=()=>{
      cancelAnimationFrame(raf);lastTime=0;raf=0;
      if(!document.hidden&&!reduced.matches)raf=requestAnimationFrame(tick);
    };
    const preferences=()=>{
      motion=new CatMotion();activeTime=0;lastFrame=-FRAME_MS;lastSample=0;
      draw({...REST_POSE,tailPhase:0});status();
      stage.dataset.asciiMotion=reduced.matches?"reduced":"generated";
      start();
    };
    const move=(event:PointerEvent)=>{
      if(reduced.matches||!fine.matches||event.pointerType==="touch")return;
      const rect=stage.getBoundingClientRect();
      if(rect.width<=0||rect.height<=0)return;
      const distance=lastPoint?Math.hypot(event.clientX-lastPoint.x,event.clientY-lastPoint.y):0;
      lastPoint={x:event.clientX,y:event.clientY};
      motion.move(pointerInDrawing(event.clientX,event.clientY,rect),activeTime,distance);
    };
    const leave=()=>{if(motion.inside)motion.leave(activeTime);lastPoint=null;};
    window.addEventListener("pointermove",move,{passive:true});
    window.addEventListener("blur",leave);
    document.addEventListener("pointerleave",leave);
    document.addEventListener("visibilitychange",start);
    reduced.addEventListener("change",preferences);fine.addEventListener("change",preferences);
    preferences();
    return()=>{
      cancelAnimationFrame(raf);window.removeEventListener("pointermove",move);window.removeEventListener("blur",leave);
      document.removeEventListener("pointerleave",leave);document.removeEventListener("visibilitychange",start);
      reduced.removeEventListener("change",preferences);fine.removeEventListener("change",preferences);
    };
  },[]);
  return <div ref={stageRef} aria-label={ASCII_CAT_DRAWING_DESCRIPTION} role="img"
    data-ascii-character="stately-cat-study" data-ascii-mode="idle" data-ascii-interaction="long-arm-batting"
    data-ascii-renderer="skeletal-characters" style={{display:"grid",justifySelf:"center",width:"max-content"}}>
    <pre ref={bodyRef} aria-hidden="true" className="ascii-cat-drawing" style={drawingStyle}>{drawingRows(resting.body)}</pre>
    <pre ref={hairRef} aria-hidden="true" className="ascii-cat-whiskers" style={{...drawingStyle,opacity:.32,pointerEvents:"none"}}>{drawingRows(resting.hair)}</pre>
  </div>;
}
