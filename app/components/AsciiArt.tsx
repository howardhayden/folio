"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef } from "react";
import {
  ASCII_CHARACTER_DESCRIPTION,
  ASCII_COLUMNS,
  ASCII_ROWS,
  ASCII_SEQUENCES,
  classifyAsciiPoint,
  createAsciiFrames,
  directionForAsciiPoint,
  normalizeAsciiArt,
  sideForSwatDirection,
} from "./asciiCharacter.js";

type AsciiHit = "blank" | "image" | "near-person" | "person" | "tablet";
type CharacterMode = "writing" | "notice" | "swat" | "recover";
type Side = "left" | "right";
type SwatDirection = "left" | "right" | "upper-left" | "upper-right";
type TimedPose = Readonly<{ pose: string; durationMs: number }>;

type CharacterSequences = Readonly<{
  writing: readonly TimedPose[];
  notice: Readonly<Record<Side, readonly TimedPose[]>>;
  swat: Readonly<Record<SwatDirection, readonly TimedPose[]>>;
  recover: Readonly<Record<Side, readonly TimedPose[]>>;
}>;

const NOTICE_DISTANCE = 5;
const MOTION_RECENCY_MS = 430;
const MOTION_EPISODE_RESET_MS = 720;
const SWAT_COOLDOWN_MS = 620;
const MAX_MOVEMENT_BUDGET = 180;

const HIT_MULTIPLIER: Record<AsciiHit, number> = {
  blank: 0,
  image: 0.78,
  "near-person": 1,
  person: 1.32,
  tablet: 1.58,
};

const SWAT_THRESHOLD: Record<AsciiHit, number> = {
  blank: Number.POSITIVE_INFINITY,
  image: 48,
  "near-person": 36,
  person: 28,
  tablet: 22,
};

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
  const frames = useMemo(
    () => createAsciiFrames(art) as Record<string, string>,
    [art],
  );
  const baseFrame = frames["write-rest"];

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
        (containerBox.left +
          paddingLeft +
          containerBox.right -
          paddingRight) /
        2;
      const pageSafeWidth =
        2 *
        Math.max(
          0,
          Math.min(contentCenter, window.innerWidth - contentCenter),
        ) *
        0.98;
      const intendedFontSize =
        (container.clientWidth / ASCII_COLUMNS) * 1.82;
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
        const safetyScale = Math.min(1, pageSafeWidth / intendedWidth);
        pre.style.fontSize = `${intendedFontSize * safetyScale}px`;
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

    const sequences = ASCII_SEQUENCES as CharacterSequences;
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const finePointerQuery = window.matchMedia(
      "(any-hover: hover) and (any-pointer: fine)",
    );

    let disposed = false;
    let animationFrame = 0;
    let reducedMotion = reducedMotionQuery.matches;
    let finePointer = finePointerQuery.matches;
    let reducedMotionReset = 0;

    const now = performance.now();
    const runtime = {
      mode: "writing" as CharacterMode,
      sequence: sequences.writing,
      sequenceIndex: 0,
      nextPoseAt: now + sequences.writing[0].durationMs,
      currentPose: "write-rest",
      direction: "right" as SwatDirection,
      hit: "blank" as AsciiHit,
      pointerInside: false,
      hasPointerSample: false,
      lastClientX: 0,
      lastClientY: 0,
      pendingClientX: 0,
      pendingClientY: 0,
      pendingDistance: 0,
      pendingLeave: false,
      movementBudget: 0,
      noticedEpisode: false,
      lastMoveAt: Number.NEGATIVE_INFINITY,
      lastSwatAt: Number.NEGATIVE_INFINITY,
      lastTickAt: now,
      lastPointerProcessAt: now,
    };

    const setPose = (poseName: string) => {
      if (runtime.currentPose === poseName) return;
      const frame = frames[poseName];
      if (!frame) return;
      pre.textContent = frame;
      pre.dataset.asciiFrame = poseName;
      runtime.currentPose = poseName;
    };

    const beginSequence = (
      mode: CharacterMode,
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

    const beginWriting = (sequenceStart: number) => {
      beginSequence("writing", sequences.writing, sequenceStart);
    };

    const beginNotice = (sequenceStart: number) => {
      const side = sideForSwatDirection(runtime.direction) as Side;
      runtime.noticedEpisode = true;
      beginSequence("notice", sequences.notice[side], sequenceStart);
    };

    const thresholdForCurrentHit = () => SWAT_THRESHOLD[runtime.hit];

    const canSwat = (sampleTime: number) =>
      finePointer &&
      !reducedMotion &&
      runtime.pointerInside &&
      runtime.hit !== "blank" &&
      sampleTime - runtime.lastMoveAt <= MOTION_RECENCY_MS &&
      sampleTime - runtime.lastSwatAt >= SWAT_COOLDOWN_MS &&
      runtime.movementBudget >= thresholdForCurrentHit();

    const beginSwat = (sequenceStart: number) => {
      const threshold = thresholdForCurrentHit();
      runtime.lastSwatAt = sequenceStart;
      runtime.noticedEpisode = true;
      runtime.movementBudget = Math.max(
        0,
        runtime.movementBudget - threshold * 0.65,
      );
      beginSequence(
        "swat",
        sequences.swat[runtime.direction],
        sequenceStart,
      );
    };

    const beginRecover = (sequenceStart: number) => {
      const side = sideForSwatDirection(runtime.direction) as Side;
      beginSequence("recover", sequences.recover[side], sequenceStart);
    };

    const finishSequence = (sequenceEnd: number) => {
      if (runtime.mode === "writing") {
        beginWriting(sequenceEnd);
        return;
      }

      if (runtime.mode === "notice") {
        if (canSwat(sequenceEnd)) {
          beginSwat(sequenceEnd);
        } else {
          beginWriting(sequenceEnd);
        }
        return;
      }

      if (runtime.mode === "swat") {
        beginRecover(sequenceEnd);
        return;
      }

      if (canSwat(sequenceEnd)) {
        beginSwat(sequenceEnd);
      } else {
        beginWriting(sequenceEnd);
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

    const showReducedMotionGlance = (direction: SwatDirection) => {
      window.clearTimeout(reducedMotionReset);
      const side = sideForSwatDirection(direction) as Side;
      setPose(side === "left" ? "notice-left" : "notice-right");
      reducedMotionReset = window.setTimeout(() => {
        if (!disposed && reducedMotion) {
          setPose("write-rest");
        }
      }, 180);
    };

    const processPointerMovement = (sampleTime: number) => {
      if (runtime.pendingLeave) {
        runtime.pendingLeave = false;
        runtime.pointerInside = false;
        runtime.hasPointerSample = false;
        runtime.pendingDistance = 0;
        runtime.movementBudget = 0;
        runtime.noticedEpisode = false;
        runtime.hit = "blank";
        if (!reducedMotion && runtime.mode !== "writing") {
          beginRecover(sampleTime);
        } else if (reducedMotion) {
          setPose("write-rest");
        }
        return;
      }

      if (!finePointer || runtime.pendingDistance <= 0) return;

      const pointerDistance = runtime.pendingDistance;
      const clientX = runtime.pendingClientX;
      const clientY = runtime.pendingClientY;
      runtime.pendingDistance = 0;

      const rect = pre.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const relativeX = (clientX - rect.left) / rect.width;
      const relativeY = (clientY - rect.top) / rect.height;
      if (
        relativeX < 0 ||
        relativeX >= 1 ||
        relativeY < 0 ||
        relativeY >= 1
      ) {
        return;
      }

      const column = Math.min(
        ASCII_COLUMNS - 1,
        Math.floor(relativeX * ASCII_COLUMNS),
      );
      const row = Math.min(ASCII_ROWS - 1, Math.floor(relativeY * ASCII_ROWS));
      const hit = classifyAsciiPoint(baseLines, row, column) as AsciiHit;
      runtime.hit = hit;

      if (hit === "blank") {
        return;
      }

      runtime.direction = directionForAsciiPoint(
        row,
        column,
      ) as SwatDirection;
      const elapsed = Math.max(1, sampleTime - runtime.lastPointerProcessAt);
      const velocity = pointerDistance / elapsed;
      const velocityMultiplier = velocity >= 0.7 ? 1.32 : 1;
      runtime.movementBudget = Math.min(
        MAX_MOVEMENT_BUDGET,
        runtime.movementBudget +
          pointerDistance * HIT_MULTIPLIER[hit] * velocityMultiplier,
      );
      runtime.lastMoveAt = sampleTime;
      runtime.lastPointerProcessAt = sampleTime;

      if (reducedMotion) {
        showReducedMotionGlance(runtime.direction);
        return;
      }

      if (
        runtime.mode === "writing" &&
        !runtime.noticedEpisode &&
        runtime.movementBudget >= NOTICE_DISTANCE
      ) {
        beginNotice(sampleTime);
        return;
      }

      if (
        runtime.mode === "writing" &&
        runtime.noticedEpisode &&
        canSwat(sampleTime)
      ) {
        beginSwat(sampleTime);
      }
    };

    const acceptsPointer = (event: PointerEvent) =>
      finePointer &&
      (event.pointerType === "mouse" ||
        event.pointerType === "pen" ||
        event.pointerType === "");

    const onPointerEnter = (event: PointerEvent) => {
      if (!acceptsPointer(event)) return;
      runtime.pointerInside = true;
      runtime.pendingLeave = false;
      runtime.hasPointerSample = true;
      runtime.lastClientX = event.clientX;
      runtime.lastClientY = event.clientY;
      runtime.pendingClientX = event.clientX;
      runtime.pendingClientY = event.clientY;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!acceptsPointer(event)) return;
      if (!runtime.hasPointerSample) {
        onPointerEnter(event);
        return;
      }

      const deltaX = event.clientX - runtime.lastClientX;
      const deltaY = event.clientY - runtime.lastClientY;
      const distance = Math.hypot(deltaX, deltaY);
      runtime.lastClientX = event.clientX;
      runtime.lastClientY = event.clientY;
      runtime.pendingClientX = event.clientX;
      runtime.pendingClientY = event.clientY;
      runtime.pendingDistance = Math.min(
        MAX_MOVEMENT_BUDGET,
        runtime.pendingDistance + distance,
      );
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
      window.clearTimeout(reducedMotionReset);

      const preferenceTime = performance.now();
      runtime.pendingDistance = 0;
      runtime.pendingLeave = false;
      runtime.movementBudget = 0;
      runtime.noticedEpisode = false;
      runtime.hit = "blank";
      if (!finePointer) {
        runtime.pointerInside = false;
        runtime.hasPointerSample = false;
      }

      if (reducedMotion) {
        runtime.mode = "writing";
        host.dataset.asciiMode = "writing";
        setPose("write-rest");
      } else {
        beginWriting(preferenceTime);
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
        beginWriting(sampleTime);
      }

      processPointerMovement(sampleTime);

      if (!reducedMotion) {
        const idleFor = sampleTime - runtime.lastMoveAt;
        if (idleFor > 180 && runtime.movementBudget > 0) {
          runtime.movementBudget = Math.max(
            0,
            runtime.movementBudget - Math.min(elapsed, 64) * 0.08,
          );
        }
        if (
          idleFor > MOTION_EPISODE_RESET_MS &&
          runtime.mode === "writing"
        ) {
          runtime.noticedEpisode = false;
        }
        advanceSequence(sampleTime);
        requestTick();
      } else if (runtime.pendingDistance > 0 || runtime.pendingLeave) {
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
      window.clearTimeout(reducedMotionReset);
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
      data-ascii-character="writer"
      data-ascii-interaction="pointer-swat"
      data-ascii-mode="writing"
      role="img"
      style={hostStyle}
    >
      <pre
        ref={preRef}
        aria-hidden="true"
        data-ascii-frame="write-rest"
        style={preStyle}
      >
        {baseFrame}
      </pre>
    </div>
  );
}
