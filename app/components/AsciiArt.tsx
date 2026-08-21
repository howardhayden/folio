"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef } from "react";
import {
  ASCII_CHARACTER_DESCRIPTION,
  ASCII_COLUMNS,
  ASCII_INTERACTION_TIMING,
  ASCII_ROWS,
  ASCII_SEQUENCES,
  createAsciiBatSequence,
  createAsciiFrames,
  createAsciiMotionClock,
  createAsciiTargetedBatFrames,
  directionForAsciiPoint,
  normalizeAsciiArt,
} from "./asciiCharacter.js";

type CatMode = "idle" | "track" | "bat" | "settle" | "follow";
type BatDirection = "left" | "right" | "upper-left" | "upper-right";
type TailPosition = "left" | "left-mid" | "center" | "right-mid" | "right";
type TimedPose = Readonly<{ pose: string; durationMs: number }>;

type CatSequences = Readonly<{
  idle: readonly TimedPose[];
  track: Readonly<Record<BatDirection, readonly TimedPose[]>>;
  bat: Readonly<Record<BatDirection, readonly TimedPose[]>>;
  settle: Readonly<Record<BatDirection, readonly TimedPose[]>>;
}>;

const BAT_MOVEMENT_THRESHOLD = ASCII_INTERACTION_TIMING.movementThreshold;
const BAT_DWELL_MS = ASCII_INTERACTION_TIMING.dwellMs;
const MAX_MOVEMENT_BUDGET = 96;
const TAIL_PHASES = [
  "center",
  "left-mid",
  "left",
  "left-mid",
  "center",
  "right-mid",
  "right",
  "right-mid",
] as const;

const hostStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr)",
  justifyItems: "center",
  minWidth: 0,
  width: "100%",
};

const preStyle: CSSProperties = {
  cursor: "default",
  lineHeight: 1.05,
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
      const desktopLayout = window.matchMedia("(min-width: 992px)").matches;
      const availableWidth = Math.max(0, host.clientWidth * 0.98);
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

      if (referenceWidth <= 0) return;

      if (desktopLayout) {
        const containerBox = container.getBoundingClientRect();
        const containerStyle = window.getComputedStyle(container);
        const paddingLeft = Number.parseFloat(containerStyle.paddingLeft) || 0;
        const paddingRight = Number.parseFloat(containerStyle.paddingRight) || 0;
        const contentCenter =
          (containerBox.left + paddingLeft + containerBox.right - paddingRight) / 2;
        const pageBoundaryWidth =
          2 * Math.max(0, Math.min(contentCenter, window.innerWidth - contentCenter)) * 0.98;
        const pageSafeWidth = Math.min(availableWidth, pageBoundaryWidth);
        const intendedFontSize = (container.clientWidth / ASCII_COLUMNS) * 1.82;
        const intendedWidth = (referenceWidth / 100) * intendedFontSize;

        if (pageSafeWidth > 0 && intendedWidth > 0) {
          pre.style.fontSize = `${intendedFontSize * Math.min(1, pageSafeWidth / intendedWidth)}px`;
        }
      } else if (availableWidth > 0) {
        pre.style.fontSize = `${Math.min(14, (availableWidth / referenceWidth) * 100)}px`;
      }
    };

    const scheduleResize = () => {
      if (disposed) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(resize);
    };

    scheduleResize();
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(host);
    observer.observe(container);
    window.addEventListener("resize", scheduleResize, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleResize, { passive: true });
    void document.fonts?.ready.then(scheduleResize);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", scheduleResize);
      window.visualViewport?.removeEventListener("resize", scheduleResize);
    };
  }, [baseFrame]);

  useEffect(() => {
    const host = hostRef.current;
    const pre = preRef.current;
    if (!host || !pre) return;

    const sequences = ASCII_SEQUENCES as unknown as CatSequences;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointerQuery = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");

    let disposed = false;
    let animationFrame = 0;
    let reducedFollowTimer = 0;
    let reducedMotion = reducedMotionQuery.matches;
    let finePointer = finePointerQuery.matches;
    const now = performance.now();
    const motionClock = createAsciiMotionClock(now);

    const runtime = {
      mode: "idle" as CatMode,
      sequence: sequences.idle,
      sequenceIndex: 0,
      nextPoseAt: Number.POSITIVE_INFINITY,
      currentPose: "loaf-center",
      direction: "right" as BatDirection,
      actionDirection: "right" as BatDirection,
      pointerInside: false,
      hasEngagedPointer: false,
      pointerEnteredAt: Number.POSITIVE_INFINITY,
      hasPointerSample: false,
      lastClientX: 0,
      lastClientY: 0,
      pendingClientX: 0,
      pendingClientY: 0,
      pendingDistance: 0,
      pendingSample: false,
      pendingOutsideSample: false,
      pendingLeave: false,
      movementBudget: 0,
      batOrdinal: 0,
      targetRow: 20,
      targetColumn: 35,
      batFrames: null as Readonly<Record<string, string>> | null,
      lastTickAt: now,
    };

    const currentTail = () => TAIL_PHASES[motionClock.tailPhaseIndex] as TailPosition;

    const setPose = (poseName: string) => {
      if (runtime.currentPose === poseName) return;
      const nextFrame =
        (runtime.mode === "bat" || runtime.mode === "settle"
          ? runtime.batFrames?.[poseName]
          : undefined) ??
        frames[poseName];
      if (!nextFrame) return;
      pre.textContent = nextFrame;
      pre.dataset.asciiFrame = poseName;
      runtime.currentPose = poseName;
    };

    const enterAmbient = (mode: "idle" | "track" | "follow") => {
      runtime.mode = mode;
      runtime.batFrames = null;
      host.dataset.asciiMode = mode;
      const tail = currentTail();
      setPose(
        mode === "idle"
          ? tail === "center" ? "loaf-center" : `loaf-tail-${tail}`
          : `track-${runtime.direction}-${tail}-tail`,
      );
    };

    const advanceTail = (sampleTime: number) => {
      const advances = motionClock.advanceTail(sampleTime);
      if (advances > 0 &&
          (runtime.mode === "idle" || runtime.mode === "track" || runtime.mode === "follow")) {
        enterAmbient(runtime.mode);
      }
    };

    const beginAction = (
      mode: "bat" | "settle",
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

    const beginBat = (time: number) => {
      runtime.actionDirection = runtime.direction;
      runtime.movementBudget = 0;
      motionClock.freezeTail(time);
      const sequence = createAsciiBatSequence(
        runtime.actionDirection,
        runtime.batOrdinal,
      ) as readonly TimedPose[];
      runtime.batFrames = createAsciiTargetedBatFrames(
        baseFrame,
        runtime.actionDirection,
        runtime.targetRow,
        runtime.targetColumn,
        currentTail(),
      ) as Readonly<Record<string, string>>;
      runtime.batOrdinal += 1;
      beginAction("bat", sequence, time);
    };

    const beginSettle = (
      time: number,
      direction = runtime.direction,
      tailAlreadyFrozen = false,
    ) => {
      if (!tailAlreadyFrozen) motionClock.freezeTail(time);
      if (!runtime.batFrames?.[`settle-${direction}`]) {
        runtime.batFrames = createAsciiTargetedBatFrames(
          baseFrame,
          direction,
          runtime.targetRow,
          runtime.targetColumn,
          currentTail(),
        ) as Readonly<Record<string, string>>;
      }
      beginAction("settle", sequences.settle[direction], time);
    };

    const canBat = (time: number) =>
      finePointer &&
      !reducedMotion &&
      runtime.pointerInside &&
      !motionClock.batCoolingDown(time) &&
      (runtime.movementBudget >= BAT_MOVEMENT_THRESHOLD ||
        time - runtime.pointerEnteredAt >= BAT_DWELL_MS);

    const finishAction = (time: number) => {
      if (runtime.mode === "bat") {
        motionClock.markBatEnded(time);
        beginSettle(time, runtime.actionDirection, true);
      } else {
        motionClock.resumeTail(time);
        if (runtime.pointerInside && finePointer) enterAmbient("track");
        else if (!motionClock.followExpired(time) && finePointer) enterAmbient("follow");
        else enterAmbient("idle");
      }
    };

    const advanceSequence = (sampleTime: number) => {
      let advances = 0;
      while (sampleTime >= runtime.nextPoseAt && advances < 16) {
        advances += 1;
        const nextIndex = runtime.sequenceIndex + 1;
        if (nextIndex >= runtime.sequence.length) {
          finishAction(sampleTime);
          return;
        }
        runtime.sequenceIndex = nextIndex;
        const nextPose = runtime.sequence[nextIndex];
        setPose(nextPose.pose);
        runtime.nextPoseAt += nextPose.durationMs;
      }
    };

    const showReducedMotionGaze = () => {
      runtime.mode = runtime.pointerInside ? "track" : "follow";
      runtime.batFrames = null;
      host.dataset.asciiMode = runtime.mode;
      setPose(`track-${runtime.direction}-center-tail`);
    };

    const scheduleReducedFollowExpiry = () => {
      window.clearTimeout(reducedFollowTimer);
      if (!reducedMotion || runtime.pointerInside || !Number.isFinite(motionClock.followUntil)) return;
      reducedFollowTimer = window.setTimeout(() => {
        if (disposed || runtime.pointerInside || !motionClock.followExpired(performance.now())) return;
        runtime.mode = "idle";
        runtime.batFrames = null;
        host.dataset.asciiMode = "idle";
        setPose("loaf-center");
      }, Math.max(0, motionClock.followUntil - performance.now()) + 16);
    };

    const updateDirection = (clientX: number, clientY: number, allowOutside = false) => {
      const rect = pre.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const relativeX = (clientX - rect.left) / rect.width;
      const relativeY = (clientY - rect.top) / rect.height;
      if (!allowOutside && (relativeX < 0 || relativeX >= 1 || relativeY < 0 || relativeY >= 1)) {
        return false;
      }
      const column = Math.floor(relativeX * ASCII_COLUMNS);
      const row = Math.floor(relativeY * ASCII_ROWS);
      runtime.targetRow = row;
      runtime.targetColumn = column;
      const nextDirection = directionForAsciiPoint(row, column) as BatDirection;
      if (nextDirection === runtime.direction) return false;
      runtime.direction = nextDirection;
      if (reducedMotion) {
        showReducedMotionGaze();
      } else if (runtime.mode === "track" || runtime.mode === "follow") {
        enterAmbient(runtime.mode);
      }
      return true;
    };

    const processPointer = (sampleTime: number) => {
      if (runtime.pendingLeave) {
        runtime.pendingLeave = false;
        runtime.pendingSample = false;
        runtime.pointerInside = false;
        runtime.hasPointerSample = false;
        runtime.pendingDistance = 0;
        runtime.movementBudget = 0;
        motionClock.refreshFollow(sampleTime);
        updateDirection(runtime.pendingClientX, runtime.pendingClientY, true);
        runtime.pendingOutsideSample = false;
        if (reducedMotion) {
          showReducedMotionGaze();
          scheduleReducedFollowExpiry();
        } else if (runtime.mode !== "bat" && runtime.mode !== "settle") {
          enterAmbient("follow");
        }
        return;
      }

      if (!runtime.pendingSample || !finePointer) return;
      runtime.pendingSample = false;
      const outsideSample = runtime.pendingOutsideSample;
      runtime.pendingOutsideSample = false;
      updateDirection(runtime.pendingClientX, runtime.pendingClientY, outsideSample);
      if (outsideSample) {
        motionClock.refreshFollow(sampleTime);
        runtime.pendingDistance = 0;
        runtime.movementBudget = 0;
        if (reducedMotion) {
          showReducedMotionGaze();
          scheduleReducedFollowExpiry();
        } else if (runtime.mode !== "bat" && runtime.mode !== "settle" && runtime.mode !== "follow") {
          enterAmbient("follow");
        }
        return;
      }
      runtime.movementBudget = Math.min(
        MAX_MOVEMENT_BUDGET,
        runtime.movementBudget + runtime.pendingDistance,
      );
      runtime.pendingDistance = 0;

      if (reducedMotion) {
        showReducedMotionGaze();
      } else if (runtime.mode === "idle" || runtime.mode === "follow") {
        enterAmbient("track");
      }
    };

    const acceptsPointer = (event: PointerEvent) =>
      finePointer &&
      (event.pointerType === "mouse" || event.pointerType === "pen" || event.pointerType === "");

    const onPointerEnter = (event: PointerEvent) => {
      if (!acceptsPointer(event)) return;
      runtime.pointerInside = true;
      runtime.hasEngagedPointer = true;
      runtime.pointerEnteredAt = performance.now();
      motionClock.clearFollow();
      window.clearTimeout(reducedFollowTimer);
      runtime.pendingLeave = false;
      runtime.pendingOutsideSample = false;
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
      runtime.pendingOutsideSample = false;
      requestTick();
    };

    const onPointerLeave = (event: PointerEvent) => {
      if (!acceptsPointer(event)) return;
      runtime.pointerInside = false;
      runtime.pointerEnteredAt = Number.POSITIVE_INFINITY;
      motionClock.refreshFollow(performance.now());
      runtime.pendingLeave = true;
      runtime.hasPointerSample = false;
      runtime.pendingClientX = event.clientX;
      runtime.pendingClientY = event.clientY;
      runtime.pendingOutsideSample = true;
      requestTick();
    };

    const onWindowPointerMove = (event: PointerEvent) => {
      if (
        !acceptsPointer(event) ||
        runtime.pointerInside ||
        !runtime.hasEngagedPointer ||
        motionClock.followExpired(performance.now())
      ) {
        return;
      }
      runtime.pendingClientX = event.clientX;
      runtime.pendingClientY = event.clientY;
      runtime.pendingSample = true;
      runtime.pendingOutsideSample = true;
      requestTick();
    };

    const syncPreferences = () => {
      const syncTime = performance.now();
      reducedMotion = reducedMotionQuery.matches;
      finePointer = finePointerQuery.matches;
      window.clearTimeout(reducedFollowTimer);
      host.dataset.asciiMotion = reducedMotion ? "reduced" : "animated";
      host.dataset.asciiPointer = finePointer ? "fine" : "non-hover";
      runtime.pendingDistance = 0;
      runtime.pendingSample = false;
      runtime.pendingOutsideSample = false;
      runtime.pendingLeave = false;
      runtime.movementBudget = 0;
      if (runtime.mode === "bat") motionClock.markBatEnded(syncTime);
      runtime.batFrames = null;
      motionClock.resetTail(syncTime);
      if (!finePointer) {
        runtime.pointerInside = false;
        runtime.hasEngagedPointer = false;
        runtime.hasPointerSample = false;
        motionClock.clearFollow();
      }
      if (reducedMotion) {
        if (runtime.pointerInside && finePointer) {
          showReducedMotionGaze();
        } else if (!motionClock.followExpired(syncTime) && finePointer) {
          showReducedMotionGaze();
          scheduleReducedFollowExpiry();
        } else {
          runtime.mode = "idle";
          host.dataset.asciiMode = "idle";
          setPose("loaf-center");
        }
      } else {
        if (runtime.pointerInside && finePointer) enterAmbient("track");
        else if (!motionClock.followExpired(syncTime) && finePointer) enterAmbient("follow");
        else enterAmbient("idle");
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
        if (runtime.mode === "bat") motionClock.markBatEnded(sampleTime);
        runtime.batFrames = null;
        motionClock.resetTail(sampleTime, motionClock.tailPhaseIndex);
        if (runtime.pointerInside && finePointer) enterAmbient("track");
        else if (!motionClock.followExpired(sampleTime) && finePointer) enterAmbient("follow");
        else enterAmbient("idle");
        runtime.pointerEnteredAt = runtime.pointerInside
          ? sampleTime
          : Number.POSITIVE_INFINITY;
      }
      processPointer(sampleTime);
      if (!reducedMotion) {
        if (runtime.mode === "idle" || runtime.mode === "track" || runtime.mode === "follow") {
          advanceTail(sampleTime);
        }
        if (runtime.mode === "follow" && motionClock.followExpired(sampleTime)) {
          beginSettle(sampleTime);
        } else if (runtime.mode === "track" && canBat(sampleTime)) {
          beginBat(sampleTime);
        }
        if (runtime.mode === "bat" || runtime.mode === "settle") {
          advanceSequence(sampleTime);
        }
        requestTick();
      } else if (runtime.pendingSample || runtime.pendingLeave) {
        requestTick();
      }
    }

    pre.addEventListener("pointerenter", onPointerEnter, { passive: true });
    pre.addEventListener("pointermove", onPointerMove, { passive: true });
    pre.addEventListener("pointerleave", onPointerLeave, { passive: true });
    pre.addEventListener("pointercancel", onPointerLeave, { passive: true });
    window.addEventListener("pointermove", onWindowPointerMove, { passive: true });
    reducedMotionQuery.addEventListener("change", syncPreferences);
    finePointerQuery.addEventListener("change", syncPreferences);
    syncPreferences();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(reducedFollowTimer);
      pre.removeEventListener("pointerenter", onPointerEnter);
      pre.removeEventListener("pointermove", onPointerMove);
      pre.removeEventListener("pointerleave", onPointerLeave);
      pre.removeEventListener("pointercancel", onPointerLeave);
      window.removeEventListener("pointermove", onWindowPointerMove);
      reducedMotionQuery.removeEventListener("change", syncPreferences);
      finePointerQuery.removeEventListener("change", syncPreferences);
    };
  }, [baseFrame, baseLines, frames]);

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
        className="signal-fuzz signal-fuzz--ascii"
        data-ascii-frame="loaf-center"
        style={preStyle}
      >
        {baseFrame}
      </pre>
    </div>
  );
}
