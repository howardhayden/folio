"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef } from "react";
import {
  ASCII_CHARACTER_DESCRIPTION,
  ASCII_COLUMNS,
  ASCII_ROWS,
  ASCII_SEQUENCES,
  createAsciiFrames,
  directionForAsciiPoint,
  normalizeAsciiArt,
} from "./asciiCharacter.js";

type CatMode = "idle" | "track" | "bat" | "settle";
type BatDirection = "left" | "right" | "upper-left" | "upper-right";
type TimedPose = Readonly<{ pose: string; durationMs: number }>;

type CatSequences = Readonly<{
  idle: readonly TimedPose[];
  track: Readonly<Record<BatDirection, readonly TimedPose[]>>;
  bat: Readonly<Record<BatDirection, readonly TimedPose[]>>;
  settle: Readonly<Record<BatDirection, readonly TimedPose[]>>;
}>;

const BAT_MOVEMENT_THRESHOLD = 16;
const BAT_DWELL_MS = 520;
const BAT_COOLDOWN_MS = 980;
const MAX_MOVEMENT_BUDGET = 96;

const hostStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  justifyItems: "center",
  minWidth: 0,
  width: "100%",
};

const preStyle: CSSProperties = {
  cursor: "default",
  margin: 0,
  maxWidth: "none",
  pointerEvents: "auto",
  touchAction: "auto",
  transition: "none",
  userSelect: "none",
  WebkitUserSelect: "none",
  whiteSpace: "pre",
  width: "max-content",
};

export function AsciiArt({
  art,
  description = ASCII_CHARACTER_DESCRIPTION,
}: {
  art: string;
  description?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const baseLines = useMemo(() => normalizeAsciiArt(art), [art]);
  const frames = useMemo(() => createAsciiFrames(art) as Record<string, string>, [art]);
  const baseFrame = frames["loaf-center"];

  useEffect(() => {
    const host = hostRef.current;
    const pre = preRef.current;
    const container = host?.parentElement;
    if (!host || !pre || !container) return;

    let disposed = false;
    let frame = 0;

    const resize = () => {
      const containerBox = container.getBoundingClientRect();
      const containerStyle = window.getComputedStyle(container);
      const paddingLeft = Number.parseFloat(containerStyle.paddingLeft) || 0;
      const paddingRight = Number.parseFloat(containerStyle.paddingRight) || 0;
      const contentCenter =
        (containerBox.left + paddingLeft + containerBox.right - paddingRight) / 2;
      const pageSafeWidth =
        2 * Math.max(0, Math.min(contentCenter, window.innerWidth - contentCenter)) * 0.98;
      const intendedFontSize = (container.clientWidth / ASCII_COLUMNS) * 1.82;
      const probe = pre.cloneNode(false) as HTMLPreElement;

      probe.textContent = baseFrame;
      probe.removeAttribute("data-ascii-frame");
      probe.setAttribute("aria-hidden", "true");
      Object.assign(probe.style, {
        fontSize: "100px",
        inset: "0 auto auto 0",
        margin: "0",
        maxWidth: "none",
        pointerEvents: "none",
        position: "absolute",
        transition: "none",
        visibility: "hidden",
        whiteSpace: "pre",
        width: "max-content",
      });
      container.appendChild(probe);
      const referenceWidth = probe.getBoundingClientRect().width;
      probe.remove();

      if (referenceWidth > 0 && pageSafeWidth > 0) {
        const intendedWidth = (referenceWidth / 100) * intendedFontSize;
        pre.style.fontSize = `${intendedFontSize * Math.min(1, pageSafeWidth / intendedWidth)}px`;
      }
    };

    const scheduleResize = () => {
      if (disposed) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(resize);
    };

    scheduleResize();
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(container);
    void document.fonts?.ready.then(scheduleResize);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [baseFrame]);

  useEffect(() => {
    const host = hostRef.current;
    const pre = preRef.current;
    if (!host || !pre) return;

    const sequences = ASCII_SEQUENCES as CatSequences;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointerQuery = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");

    let disposed = false;
    let animationFrame = 0;
    let reducedMotion = reducedMotionQuery.matches;
    let finePointer = finePointerQuery.matches;
    const now = performance.now();

    const runtime = {
      mode: "idle" as CatMode,
      sequence: sequences.idle,
      sequenceIndex: 0,
      nextPoseAt: now + sequences.idle[0].durationMs,
      currentPose: "loaf-center",
      direction: "right" as BatDirection,
      actionDirection: "right" as BatDirection,
      pointerInside: false,
      pointerEnteredAt: Number.POSITIVE_INFINITY,
      hasPointerSample: false,
      lastClientX: 0,
      lastClientY: 0,
      pendingClientX: 0,
      pendingClientY: 0,
      pendingDistance: 0,
      pendingSample: false,
      pendingLeave: false,
      movementBudget: 0,
      lastBatAt: Number.NEGATIVE_INFINITY,
      lastTickAt: now,
    };

    const setPose = (poseName: string) => {
      if (runtime.currentPose === poseName) return;
      const nextFrame = frames[poseName];
      if (!nextFrame) return;
      pre.textContent = nextFrame;
      pre.dataset.asciiFrame = poseName;
      runtime.currentPose = poseName;
    };

    const beginSequence = (
      mode: CatMode,
      sequence: readonly TimedPose[],
      sequenceStart: number,
    ) => {
      runtime.mode = mode;
      runtime.sequence = sequence;
      runtime.sequenceIndex = 0;
      runtime.nextPoseAt = sequenceStart + sequence[0].durationMs;
      host.dataset.asciiMode = mode;
      setPose(sequence[0].pose);
    };

    const beginIdle = (time: number) => beginSequence("idle", sequences.idle, time);

    const beginTrack = (time: number) => {
      runtime.actionDirection = runtime.direction;
      beginSequence("track", sequences.track[runtime.direction], time);
    };

    const beginBat = (time: number) => {
      runtime.actionDirection = runtime.direction;
      runtime.lastBatAt = time;
      runtime.movementBudget = 0;
      beginSequence("bat", sequences.bat[runtime.actionDirection], time);
    };

    const beginSettle = (time: number) =>
      beginSequence("settle", sequences.settle[runtime.actionDirection], time);

    const canBat = (time: number) =>
      finePointer &&
      !reducedMotion &&
      runtime.pointerInside &&
      time - runtime.lastBatAt >= BAT_COOLDOWN_MS &&
      (runtime.movementBudget >= BAT_MOVEMENT_THRESHOLD ||
        time - runtime.pointerEnteredAt >= BAT_DWELL_MS);

    const finishSequence = (time: number) => {
      if (runtime.mode === "idle") {
        if (runtime.pointerInside && finePointer) beginTrack(time);
        else beginIdle(time);
      } else if (runtime.mode === "track") {
        if (canBat(time)) beginBat(time);
        else if (runtime.pointerInside) beginTrack(time);
        else beginSettle(time);
      } else if (runtime.mode === "bat") {
        beginSettle(time);
      } else if (runtime.pointerInside && finePointer) {
        beginTrack(time);
      } else {
        beginIdle(time);
      }
    };

    const advanceSequence = (sampleTime: number) => {
      let advances = 0;
      while (sampleTime >= runtime.nextPoseAt && advances < 8) {
        advances += 1;
        const nextIndex = runtime.sequenceIndex + 1;
        if (nextIndex >= runtime.sequence.length) {
          finishSequence(runtime.nextPoseAt);
          return;
        }
        runtime.sequenceIndex = nextIndex;
        const nextPose = runtime.sequence[nextIndex];
        setPose(nextPose.pose);
        runtime.nextPoseAt += nextPose.durationMs;
      }
    };

    const showReducedMotionGaze = () => {
      const pose = sequences.track[runtime.direction][0]?.pose;
      if (pose) setPose(pose);
      runtime.mode = "track";
      host.dataset.asciiMode = "track";
    };

    const updateDirection = (clientX: number, clientY: number) => {
      const rect = pre.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const relativeX = (clientX - rect.left) / rect.width;
      const relativeY = (clientY - rect.top) / rect.height;
      if (relativeX < 0 || relativeX >= 1 || relativeY < 0 || relativeY >= 1) return;
      const column = Math.min(ASCII_COLUMNS - 1, Math.floor(relativeX * ASCII_COLUMNS));
      const row = Math.min(ASCII_ROWS - 1, Math.floor(relativeY * ASCII_ROWS));
      const nextDirection = directionForAsciiPoint(row, column) as BatDirection;
      if (nextDirection === runtime.direction) return;
      runtime.direction = nextDirection;
      if (reducedMotion) {
        showReducedMotionGaze();
      } else if (runtime.mode === "track") {
        beginTrack(performance.now());
      }
    };

    const processPointer = (sampleTime: number) => {
      if (runtime.pendingLeave) {
        runtime.pendingLeave = false;
        runtime.pointerInside = false;
        runtime.hasPointerSample = false;
        runtime.pendingDistance = 0;
        runtime.movementBudget = 0;
        if (reducedMotion) {
          runtime.mode = "idle";
          host.dataset.asciiMode = "idle";
          setPose("loaf-center");
        } else if (runtime.mode !== "bat" && runtime.mode !== "settle") {
          beginSettle(sampleTime);
        }
        return;
      }

      if (!runtime.pendingSample || !finePointer) return;
      runtime.pendingSample = false;
      updateDirection(runtime.pendingClientX, runtime.pendingClientY);
      runtime.movementBudget = Math.min(
        MAX_MOVEMENT_BUDGET,
        runtime.movementBudget + runtime.pendingDistance,
      );
      runtime.pendingDistance = 0;

      if (reducedMotion) {
        showReducedMotionGaze();
      } else if (runtime.mode === "idle" || runtime.mode === "settle") {
        beginTrack(sampleTime);
      } else if (runtime.mode === "track" && canBat(sampleTime)) {
        beginBat(sampleTime);
      }
    };

    const acceptsPointer = (event: PointerEvent) =>
      finePointer &&
      (event.pointerType === "mouse" || event.pointerType === "pen" || event.pointerType === "");

    const onPointerEnter = (event: PointerEvent) => {
      if (!acceptsPointer(event)) return;
      runtime.pointerInside = true;
      runtime.pointerEnteredAt = performance.now();
      runtime.pendingLeave = false;
      runtime.hasPointerSample = true;
      runtime.lastClientX = event.clientX;
      runtime.lastClientY = event.clientY;
      runtime.pendingClientX = event.clientX;
      runtime.pendingClientY = event.clientY;
      runtime.pendingSample = true;
      requestTick();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!acceptsPointer(event)) return;
      if (!runtime.hasPointerSample) {
        onPointerEnter(event);
        return;
      }
      runtime.pendingDistance = Math.min(
        MAX_MOVEMENT_BUDGET,
        runtime.pendingDistance +
          Math.hypot(event.clientX - runtime.lastClientX, event.clientY - runtime.lastClientY),
      );
      runtime.lastClientX = event.clientX;
      runtime.lastClientY = event.clientY;
      runtime.pendingClientX = event.clientX;
      runtime.pendingClientY = event.clientY;
      runtime.pendingSample = true;
      runtime.pointerInside = true;
      requestTick();
    };

    const onPointerLeave = (event: PointerEvent) => {
      if (!acceptsPointer(event)) return;
      runtime.pendingLeave = true;
      runtime.hasPointerSample = false;
      requestTick();
    };

    const syncPreferences = () => {
      reducedMotion = reducedMotionQuery.matches;
      finePointer = finePointerQuery.matches;
      host.dataset.asciiMotion = reducedMotion ? "reduced" : "animated";
      host.dataset.asciiPointer = finePointer ? "fine" : "non-hover";
      runtime.pendingDistance = 0;
      runtime.pendingSample = false;
      runtime.pendingLeave = false;
      runtime.movementBudget = 0;
      if (!finePointer) {
        runtime.pointerInside = false;
        runtime.hasPointerSample = false;
      }
      if (reducedMotion) {
        runtime.mode = "idle";
        host.dataset.asciiMode = "idle";
        setPose("loaf-center");
      } else {
        beginIdle(performance.now());
      }
      requestTick();
    };

    function requestTick() {
      if (disposed || animationFrame !== 0) return;
      animationFrame = window.requestAnimationFrame(tick);
    }

    function tick(sampleTime: number) {
      animationFrame = 0;
      if (disposed) return;
      const elapsed = sampleTime - runtime.lastTickAt;
      runtime.lastTickAt = sampleTime;
      if (elapsed > 1000 && !reducedMotion) {
        if (runtime.pointerInside && finePointer) beginTrack(sampleTime);
        else beginIdle(sampleTime);
      }
      processPointer(sampleTime);
      if (!reducedMotion) {
        if (runtime.mode === "track" && canBat(sampleTime)) beginBat(sampleTime);
        advanceSequence(sampleTime);
        requestTick();
      } else if (runtime.pendingSample || runtime.pendingLeave) {
        requestTick();
      }
    }

    pre.addEventListener("pointerenter", onPointerEnter, { passive: true });
    pre.addEventListener("pointermove", onPointerMove, { passive: true });
    pre.addEventListener("pointerleave", onPointerLeave, { passive: true });
    pre.addEventListener("pointercancel", onPointerLeave, { passive: true });
    reducedMotionQuery.addEventListener("change", syncPreferences);
    finePointerQuery.addEventListener("change", syncPreferences);
    syncPreferences();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      pre.removeEventListener("pointerenter", onPointerEnter);
      pre.removeEventListener("pointermove", onPointerMove);
      pre.removeEventListener("pointerleave", onPointerLeave);
      pre.removeEventListener("pointercancel", onPointerLeave);
      reducedMotionQuery.removeEventListener("change", syncPreferences);
      finePointerQuery.removeEventListener("change", syncPreferences);
    };
  }, [baseLines, frames]);

  return (
    <div
      ref={hostRef}
      aria-label={description}
      data-ascii-character="glass-table-cat"
      data-ascii-interaction="pointer-bat"
      data-ascii-mode="idle"
      role="img"
      style={hostStyle}
    >
      <pre
        ref={preRef}
        aria-hidden="true"
        data-ascii-frame="loaf-center"
        style={preStyle}
      >
        {baseFrame}
      </pre>
    </div>
  );
}
