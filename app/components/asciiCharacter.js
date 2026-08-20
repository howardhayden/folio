export const ASCII_COLUMNS = 70;
export const ASCII_ROWS = 34;

export const ASCII_CHARACTER_DESCRIPTION =
  "A cat loafs on a glass table above the viewer, turns its lowered head toward the pointer, swishes its tail, and bats with a tucked paw.";

/** @typedef {{ row: number, column: number, text: string }} AsciiPatch */
/** @typedef {{ pose: string, durationMs: number }} TimedPose */
/** @typedef {'left' | 'right' | 'upper-left' | 'upper-right'} BatDirection */
/** @typedef {'blank' | 'image' | 'near-cat' | 'cat' | 'paw'} AsciiHit */

const DIRECTIONS = Object.freeze(["left", "right", "upper-left", "upper-right"]);

function emptyGrid() {
  return Array.from({ length: ASCII_ROWS }, () =>
    Array.from({ length: ASCII_COLUMNS }, () => " "),
  );
}

const SHADE = " .,:;clodxkO0KXNM";

const NECK_BLEND = Object.freeze({
  row: 18.5,
  column: 28.2,
  rowRadius: 3,
  columnRadius: 5.8,
});

const HEAD_POSES = Object.freeze({
  center: Object.freeze({
    center: Object.freeze({ row: 20.2, column: 21.4 }),
    rowRadius: 3.6,
    columnRadius: 8.5,
    angleDegrees: 0,
    leadingScale: 1,
    trailingScale: 1,
  }),
  left: Object.freeze({
    center: Object.freeze({ row: 20.4, column: 20.6 }),
    rowRadius: 3.55,
    columnRadius: 8.6,
    angleDegrees: 3,
    leadingScale: 1.04,
    trailingScale: 0.97,
  }),
  right: Object.freeze({
    center: Object.freeze({ row: 20.4, column: 22.2 }),
    rowRadius: 3.55,
    columnRadius: 8.6,
    angleDegrees: -3,
    leadingScale: 1.04,
    trailingScale: 0.97,
  }),
  "upper-left": Object.freeze({
    center: Object.freeze({ row: 19.7, column: 20.8 }),
    rowRadius: 3.55,
    columnRadius: 8.55,
    angleDegrees: 2,
    leadingScale: 1.03,
    trailingScale: 0.98,
  }),
  "upper-right": Object.freeze({
    center: Object.freeze({ row: 19.7, column: 22 }),
    rowRadius: 3.55,
    columnRadius: 8.55,
    angleDegrees: -2,
    leadingScale: 1.03,
    trailingScale: 0.98,
  }),
});

const LOCAL_EARS = Object.freeze([
  Object.freeze([
    Object.freeze({ row: -6.2, column: -4.8 }),
    Object.freeze({ row: -2.95, column: -6.3 }),
    Object.freeze({ row: -2.7, column: -2 }),
  ]),
  Object.freeze([
    Object.freeze({ row: -6.3, column: 4.4 }),
    Object.freeze({ row: -2.7, column: 1.8 }),
    Object.freeze({ row: -2.95, column: 5.9 }),
  ]),
]);

function put(grid, row, column, character) {
  if (row >= 0 && row < ASCII_ROWS && column >= 0 && column < ASCII_COLUMNS) {
    grid[row][column] = character;
  }
}

function pointBetween(origin, target, amount) {
  return {
    row: Math.round(origin.row + (target.row - origin.row) * amount),
    column: Math.round(origin.column + (target.column - origin.column) * amount),
  };
}

function stampFur(grid, row, column, width, index) {
  const rowRadius = Math.floor((Math.max(1, width) - 1) / 2);
  const columnRadius = Math.ceil((Math.max(1, width) - 1) * 0.72);
  for (let rowOffset = -rowRadius; rowOffset <= rowRadius; rowOffset += 1) {
    const taper = rowRadius === 0 ? 0 : Math.round(Math.abs(rowOffset) * columnRadius / (rowRadius + 1));
    const span = Math.max(0, columnRadius - taper);
    for (let columnOffset = -span; columnOffset <= span; columnOffset += 1) {
      const radial = rowRadius === 0 && columnRadius === 0
        ? 0
        : Math.hypot(
          rowRadius === 0 ? 0 : rowOffset / (rowRadius + 0.5),
          columnRadius === 0 ? 0 : columnOffset / (columnRadius + 0.5),
        );
      const texture = furNoise(row + rowOffset, column + columnOffset, index + 11);
      put(
        grid,
        row + rowOffset,
        column + columnOffset,
        shadeCharacter(12.2 - radial * 1.8 + texture * 1.15),
      );
    }
  }
}

function drawFurSegment(grid, start, end, startWidth, endWidth, seed = 0) {
  const steps = Math.max(Math.abs(end.row - start.row), Math.abs(end.column - start.column));
  for (let step = 0; step <= steps; step += 1) {
    const ratio = steps === 0 ? 1 : step / steps;
    const row = Math.round(start.row + (end.row - start.row) * ratio);
    const column = Math.round(start.column + (end.column - start.column) * ratio);
    const width = Math.round(startWidth + (endWidth - startWidth) * ratio);
    stampFur(grid, row, column, width, seed + step);
  }
}

function drawFurPath(grid, points, startWidth, endWidth, seed = 0) {
  for (let index = 0; index < points.length - 1; index += 1) {
    const segmentStart = index / (points.length - 1);
    const segmentEnd = (index + 1) / (points.length - 1);
    drawFurSegment(
      grid,
      points[index],
      points[index + 1],
      Math.round(startWidth + (endWidth - startWidth) * segmentStart),
      Math.round(startWidth + (endWidth - startWidth) * segmentEnd),
      seed + index * 7,
    );
  }
}

const TAIL_SHARED = Object.freeze([
  Object.freeze({ row: 15, column: 56 }),
  Object.freeze({ row: 15, column: 60 }),
  Object.freeze({ row: 16, column: 63 }),
]);

const TAIL_TIPS = Object.freeze({
  left: Object.freeze([
    Object.freeze({ row: 15, column: 65 }),
    Object.freeze({ row: 13, column: 67 }),
    Object.freeze({ row: 12, column: 69 }),
    Object.freeze({ row: 13, column: 68 }),
  ]),
  "left-mid": Object.freeze([
    Object.freeze({ row: 15, column: 65 }),
    Object.freeze({ row: 14, column: 66 }),
    Object.freeze({ row: 13, column: 68 }),
    Object.freeze({ row: 14, column: 69 }),
    Object.freeze({ row: 15, column: 68 }),
  ]),
  center: Object.freeze([
    Object.freeze({ row: 16, column: 65 }),
    Object.freeze({ row: 15, column: 67 }),
    Object.freeze({ row: 16, column: 69 }),
    Object.freeze({ row: 17, column: 68 }),
  ]),
  "right-mid": Object.freeze([
    Object.freeze({ row: 17, column: 65 }),
    Object.freeze({ row: 19, column: 67 }),
    Object.freeze({ row: 20, column: 69 }),
    Object.freeze({ row: 19, column: 68 }),
  ]),
  right: Object.freeze([
    Object.freeze({ row: 18, column: 65 }),
    Object.freeze({ row: 20, column: 67 }),
    Object.freeze({ row: 22, column: 69 }),
    Object.freeze({ row: 21, column: 68 }),
  ]),
});

const TAIL_POSITIONS = Object.freeze(Object.keys(TAIL_TIPS));

const TAIL_PATHS = Object.freeze(Object.fromEntries(
  Object.entries(TAIL_TIPS).map(([tail, tips]) => [
    tail,
    Object.freeze([...TAIL_SHARED, ...tips]),
  ]),
));

function drawTail(grid, tail) {
  const tips = TAIL_TIPS[tail];
  const bend = tips[0];
  drawFurPath(grid, [...TAIL_SHARED, bend], 3, 2, 2);
  drawFurPath(grid, tips, 1, 1, 23);
}

function drawTailRoot(grid) {
  stampFur(grid, TAIL_SHARED[0].row, TAIL_SHARED[0].column, 3, 15);
}

function furNoise(row, column, seed = 0) {
  const value = Math.sin((row + 1) * 12.9898 + (column + 1) * 78.233 + seed * 37.719) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function shadeCharacter(density) {
  const index = Math.max(1, Math.min(SHADE.length - 1, Math.round(density)));
  return SHADE[index];
}

function localToWorld(pose, point) {
  const angle = pose.angleDegrees * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    row: pose.center.row + point.row * cosine + point.column * sine,
    column: pose.center.column + point.column * cosine - point.row * sine,
  };
}

function triangleContains(point, vertices) {
  const [first, second, third] = vertices;
  const sign = (a, b, c) =>
    (a.column - c.column) * (b.row - c.row) -
    (b.column - c.column) * (a.row - c.row);
  const d1 = sign(point, first, second);
  const d2 = sign(point, second, third);
  const d3 = sign(point, third, first);
  return !(d1 < 0 || d2 < 0 || d3 < 0) || !(d1 > 0 || d2 > 0 || d3 > 0);
}

function drawNeckBlend(grid) {
  for (let row = 14; row <= 23; row += 1) {
    for (let column = 20; column <= 35; column += 1) {
      const noise = furNoise(row, column, 9);
      const distance = Math.hypot(
        (row - NECK_BLEND.row) / NECK_BLEND.rowRadius,
        (column - NECK_BLEND.column) / NECK_BLEND.columnRadius,
      );
      if (distance > 1 + noise * 0.035) continue;
      put(grid, row, column, shadeCharacter(13.9 - distance * 4.3 + noise * 1.1));
    }
  }
}

function drawHeadEars(grid, gaze, pose) {
  const directionSign = gaze.endsWith("left") ? -1 : gaze.endsWith("right") ? 1 : 0;
  const farScale = gaze.startsWith("upper-") ? 0.9 : 0.86;
  for (let earIndex = 0; earIndex < LOCAL_EARS.length; earIndex += 1) {
    const earSide = earIndex === 0 ? -1 : 1;
    const isFarEar = directionSign !== 0 && earSide !== directionSign;
    const scale = isFarEar ? farScale : 1;
    const vertices = LOCAL_EARS[earIndex].map((point) =>
      localToWorld(pose, { row: point.row, column: point.column * scale }));
    const top = Math.floor(Math.min(...vertices.map(({ row }) => row)));
    const right = Math.ceil(Math.max(...vertices.map(({ column }) => column)));
    const bottom = Math.ceil(Math.max(...vertices.map(({ row }) => row)));
    const left = Math.floor(Math.min(...vertices.map(({ column }) => column)));
    for (let row = top; row <= bottom; row += 1) {
      for (let column = left; column <= right; column += 1) {
        if (!triangleContains({ row: row + 0.5, column: column + 0.5 }, vertices)) continue;
        const noise = furNoise(row, column, 4 + earIndex);
        put(grid, row, column, shadeCharacter(9.8 + noise * 0.8));
      }
    }
  }
}

function drawDirectionalHead(grid, gaze) {
  const pose = HEAD_POSES[gaze] ?? HEAD_POSES.center;
  const angle = pose.angleDegrees * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const directionSign = gaze.endsWith("left") ? -1 : gaze.endsWith("right") ? 1 : 0;
  drawHeadEars(grid, gaze, pose);
  for (let row = 13; row <= 25; row += 1) {
    for (let column = 10; column <= 33; column += 1) {
      const deltaRow = row - pose.center.row;
      const deltaColumn = column - pose.center.column;
      const localRow = deltaRow * cosine - deltaColumn * sine;
      const localColumn = deltaColumn * cosine + deltaRow * sine;
      const onLeadingSide = directionSign !== 0 && Math.sign(localColumn) === directionSign;
      const columnScale = onLeadingSide ? pose.leadingScale : pose.trailingScale;
      const lowerCompression = localRow > 0.4 ? 0.9 : 1;
      const horizontal = Math.abs(localColumn / (pose.columnRadius * columnScale));
      const vertical = Math.abs(localRow / (pose.rowRadius * lowerCompression));
      const field = horizontal ** 2.4 + vertical ** 2.8;
      const noise = furNoise(row, column, 7);
      if (field > 1 + noise * 0.03) continue;
      const distance = field ** (1 / 2.8);
      const lowerFade = Math.max(0, localRow) * 0.32;
      const turnShade = directionSign * localColumn * 0.045 -
        (gaze.startsWith("upper-") ? localRow * 0.045 : 0);
      const density = 14.2 - distance * 4.6 - lowerFade + turnShade + noise * 1.15;
      put(grid, row, column, shadeCharacter(density));
    }
  }
}

function drawBody(grid, gaze) {
  for (let row = 10; row <= 24; row += 1) {
    for (let column = 14; column <= 65; column += 1) {
      const noise = furNoise(row, column, 1);
      const haunch = Math.exp(-(((column - 50) / 9.5) ** 2));
      const shoulder = Math.exp(-(((column - 29) / 8.5) ** 2));
      const bodyRow = 17.4 - 0.3 * haunch + 0.12 * shoulder;
      const rowRadius = 4.65 + 0.75 * haunch + 0.25 * shoulder;
      const horizontal = Math.abs((column - 39.5) / 24.5);
      const lowerScale = row > bodyRow ? 0.9 : 1;
      const vertical = Math.abs((row - bodyRow) / (rowRadius * lowerScale));
      const field = horizontal ** 2.6 + vertical ** 3.2;
      if (field > 1 + noise * 0.022) continue;
      const distance = field ** (1 / 3.2);
      const paleBelly = Math.exp(-(
        ((column - 41) / 15) ** 2 +
        ((row - 19) / 2.8) ** 2
      )) * 5.5;
      const darkerFlank = Math.exp(-(
        ((column - 51) / 9.5) ** 2 +
        ((row - 15) / 4.2) ** 2
      )) * 1.4;
      const density = 14 - distance * 4.7 - paleBelly + darkerFlank + noise * 1.2;
      put(grid, row, column, shadeCharacter(density));
    }
  }

  drawNeckBlend(grid);
  drawDirectionalHead(grid, gaze);
}

const RESTING_PAW_CENTERS = Object.freeze({
  left: Object.freeze({ row: 23, column: 28 }),
  right: Object.freeze({ row: 23, column: 40 }),
});

function drawGlassContact(grid, center, side) {
  const spans = side === "left"
    ? [[-2, 1], [-3, 2], [-1, 1]]
    : [[-1, 2], [-2, 3], [-1, 2]];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    const [start, end] = spans[rowOffset + 1];
    for (let columnOffset = start; columnOffset <= end; columnOffset += 1) {
      const noise = furNoise(
        center.row + rowOffset,
        center.column + columnOffset,
        side === "left" ? 17 : 23,
      );
      const density = 10.9 - Math.abs(rowOffset) * 1.15 -
        Math.abs(columnOffset) * 0.28 + noise * 1.1;
      put(
        grid,
        center.row + rowOffset,
        center.column + columnOffset,
        shadeCharacter(density),
      );
    }
  }
  put(grid, center.row, center.column, "K");
}

function drawRestingPaw(grid, side) {
  drawGlassContact(grid, RESTING_PAW_CENTERS[side], side);
}

const BAT_TARGETS = Object.freeze({
  left: Object.freeze({
    shoulder: "left",
    paw: Object.freeze({ row: 20, column: 5 }),
    elbow: Object.freeze({ row: 19, column: 24 }),
    wrist: Object.freeze({ row: 20, column: 10 }),
  }),
  right: Object.freeze({
    shoulder: "right",
    paw: Object.freeze({ row: 20, column: 64 }),
    elbow: Object.freeze({ row: 19, column: 44 }),
    wrist: Object.freeze({ row: 20, column: 59 }),
  }),
  "upper-left": Object.freeze({
    shoulder: "left",
    paw: Object.freeze({ row: 5, column: 7 }),
    elbow: Object.freeze({ row: 17, column: 24 }),
    wrist: Object.freeze({ row: 8, column: 11 }),
  }),
  "upper-right": Object.freeze({
    shoulder: "right",
    paw: Object.freeze({ row: 5, column: 62 }),
    elbow: Object.freeze({ row: 17, column: 44 }),
    wrist: Object.freeze({ row: 8, column: 58 }),
  }),
});

const SHOULDERS = Object.freeze({
  left: Object.freeze({ row: 20, column: 29 }),
  right: Object.freeze({ row: 20, column: 39 }),
});

function targetedBatGeometry(direction, targetPoint) {
  const authored = BAT_TARGETS[direction];
  if (!targetPoint) return authored;
  const shoulder = SHOULDERS[authored.shoulder];
  const paw = {
    row: Math.max(0, Math.min(ASCII_ROWS - 1, Math.round(targetPoint.row))),
    column: Math.max(0, Math.min(ASCII_COLUMNS - 1, Math.round(targetPoint.column))),
  };
  const elbow = pointBetween(shoulder, paw, 0.24);
  const wrist = pointBetween(shoulder, paw, 0.8);
  const mostlyHorizontal =
    Math.abs(paw.column - shoulder.column) >= Math.abs(paw.row - shoulder.row);
  if (mostlyHorizontal) {
    elbow.row = Math.max(2, elbow.row - 1);
  } else {
    const outward = authored.shoulder === "left" ? -1 : 1;
    elbow.column += outward;
  }
  return { shoulder: authored.shoulder, paw, elbow, wrist };
}

function drawBatPaw(grid, direction, extension, targetPoint = null) {
  const target = targetedBatGeometry(direction, targetPoint);
  const shoulder = SHOULDERS[target.shoulder];
  const amounts = { ready: 0.22, reach: 0.68, "mini-in": 0.84, "mini-contact": 0.97, contact: 1 };
  const amount = amounts[extension] ?? 1;
  const elbow = pointBetween(shoulder, target.elbow, amount);
  const wrist = pointBetween(shoulder, target.wrist, amount);
  const paw = pointBetween(shoulder, target.paw, amount);
  if (extension === "mini-contact") {
    if (direction.startsWith("upper-")) paw.column += direction.endsWith("left") ? 1 : -1;
    else paw.row -= 1;
  }
  drawFurPath(grid, [shoulder, elbow, wrist, paw], 5, 3, direction.endsWith("left") ? 1 : 4);
  drawGlassContact(grid, paw, target.shoulder);
}

function catFrame({
  tail = "center",
  gaze = "center",
  bat = null,
  extension = "contact",
  batTarget = null,
} = {}) {
  const grid = emptyGrid();
  drawTail(grid, tail);
  drawBody(grid, gaze);
  drawTailRoot(grid);
  if (!bat) {
    drawRestingPaw(grid, "left");
    drawRestingPaw(grid, "right");
  } else {
    drawRestingPaw(grid, BAT_TARGETS[bat].shoulder === "left" ? "right" : "left");
    drawBatPaw(grid, bat, extension, batTarget);
  }
  return grid.map((row) => row.join("")).join("\n");
}

export const asciiPortrait = catFrame({ tail: "center", gaze: "center" });

function diffFrame(base, target) {
  const baseLines = base.split("\n");
  const targetLines = target.split("\n");
  const patches = [];
  for (let row = 0; row < ASCII_ROWS; row += 1) {
    let start = 0;
    while (start < ASCII_COLUMNS && baseLines[row][start] === targetLines[row][start]) start += 1;
    if (start === ASCII_COLUMNS) continue;
    let end = ASCII_COLUMNS - 1;
    while (end > start && baseLines[row][end] === targetLines[row][end]) end -= 1;
    patches.push(Object.freeze({ row, column: start, text: targetLines[row].slice(start, end + 1) }));
  }
  return Object.freeze(patches);
}

function pose(options) {
  return diffFrame(asciiPortrait, catFrame(options));
}

const poseEntries = {
  "loaf-center": Object.freeze([]),
};

for (const tail of TAIL_POSITIONS) {
  if (tail !== "center") poseEntries[`loaf-tail-${tail}`] = pose({ tail, gaze: "center" });
}

for (const direction of DIRECTIONS) {
  for (const tail of TAIL_POSITIONS) {
    poseEntries[`track-${direction}-${tail}-tail`] = pose({ tail, gaze: direction });
  }
  poseEntries[`bat-${direction}-ready`] = pose({ tail: "center", gaze: direction, bat: direction, extension: "ready" });
  poseEntries[`bat-${direction}-reach`] = pose({ tail: "center", gaze: direction, bat: direction, extension: "reach" });
  poseEntries[`bat-${direction}-contact`] = pose({ tail: "center", gaze: direction, bat: direction, extension: "contact" });
  poseEntries[`bat-${direction}-mini-in`] = pose({ tail: "center", gaze: direction, bat: direction, extension: "mini-in" });
  poseEntries[`bat-${direction}-mini-contact`] = pose({ tail: "center", gaze: direction, bat: direction, extension: "mini-contact" });
  poseEntries[`bat-${direction}-recoil`] = pose({ tail: "center", gaze: direction, bat: direction, extension: "reach" });
  poseEntries[`settle-${direction}`] = pose({ tail: "center", gaze: direction });
}

export const ASCII_POSES = Object.freeze(poseEntries);

function timed(poseName, durationMs) {
  return Object.freeze({ pose: poseName, durationMs });
}

export const ASCII_MINI_BAT_PATTERN = Object.freeze([0, 1, 0, 0, 2, 0, 1, 0, 0, 0, 3, 0]);

export const ASCII_INTERACTION_TIMING = Object.freeze({
  movementThreshold: 16,
  dwellMs: 520,
  cooldownMs: 1100,
  followMs: 2000,
  settleMs: 190,
});

const MINI_BAT_TIMINGS = Object.freeze([
  Object.freeze({ inward: 80, outward: 95 }),
  Object.freeze({ inward: 90, outward: 105 }),
  Object.freeze({ inward: 100, outward: 115 }),
]);

export const ASCII_SEQUENCES = Object.freeze({
  idle: Object.freeze([
    timed("loaf-center", 1100),
    timed("loaf-tail-left-mid", 500),
    timed("loaf-tail-left", 800),
    timed("loaf-tail-left-mid", 520),
    timed("loaf-center", 900),
    timed("loaf-tail-right-mid", 540),
    timed("loaf-tail-right", 860),
    timed("loaf-tail-right-mid", 560),
  ]),
  track: Object.freeze(Object.fromEntries(DIRECTIONS.map((direction) => [
    direction,
    Object.freeze([
      timed(`track-${direction}-center-tail`, 1100),
      timed(`track-${direction}-left-mid-tail`, 500),
      timed(`track-${direction}-left-tail`, 800),
      timed(`track-${direction}-left-mid-tail`, 520),
      timed(`track-${direction}-center-tail`, 900),
      timed(`track-${direction}-right-mid-tail`, 540),
      timed(`track-${direction}-right-tail`, 860),
      timed(`track-${direction}-right-mid-tail`, 560),
    ]),
  ]))),
  bat: Object.freeze(Object.fromEntries(DIRECTIONS.map((direction) => [
    direction,
    Object.freeze([
      timed(`bat-${direction}-ready`, 105),
      timed(`bat-${direction}-reach`, 115),
      timed(`bat-${direction}-contact`, 165),
    ]),
  ]))),
  retract: Object.freeze(Object.fromEntries(DIRECTIONS.map((direction) => [
    direction,
    Object.freeze([timed(`bat-${direction}-recoil`, 145)]),
  ]))),
  settle: Object.freeze(Object.fromEntries(DIRECTIONS.map((direction) => [
    direction,
    Object.freeze([timed(`settle-${direction}`, ASCII_INTERACTION_TIMING.settleMs)]),
  ]))),
});

export function createAsciiMotionClock(startTime = 0) {
  if (!Number.isFinite(startTime)) throw new Error("ASCII motion clock requires a finite start time.");
  let tailPhaseIndex = 0;
  let nextTailAt = startTime + ASCII_SEQUENCES.idle[0].durationMs;
  let tailRemainingMs = ASCII_SEQUENCES.idle[0].durationMs;
  let tailFrozen = false;
  let followUntil = Number.NEGATIVE_INFINITY;
  let lastBatEndedAt = Number.NEGATIVE_INFINITY;

  return Object.freeze({
    get tailPhaseIndex() {
      return tailPhaseIndex;
    },
    get nextTailAt() {
      return nextTailAt;
    },
    get followUntil() {
      return followUntil;
    },
    get lastBatEndedAt() {
      return lastBatEndedAt;
    },
    advanceTail(sampleTime) {
      if (!Number.isFinite(sampleTime)) throw new Error("ASCII tail clock requires a finite sample time.");
      if (tailFrozen) return 0;
      let advances = 0;
      while (sampleTime >= nextTailAt) {
        advances += 1;
        tailPhaseIndex = (tailPhaseIndex + 1) % ASCII_SEQUENCES.idle.length;
        nextTailAt += ASCII_SEQUENCES.idle[tailPhaseIndex].durationMs;
      }
      return advances;
    },
    freezeTail(time) {
      if (!Number.isFinite(time)) throw new Error("ASCII tail freeze requires a finite time.");
      tailRemainingMs = Math.max(1, nextTailAt - time);
      tailFrozen = true;
      return tailRemainingMs;
    },
    resumeTail(time) {
      if (!Number.isFinite(time)) throw new Error("ASCII tail resume requires a finite time.");
      nextTailAt = time + Math.max(tailRemainingMs, 180);
      tailFrozen = false;
      return nextTailAt;
    },
    resetTail(time, phaseIndex = 0) {
      if (!Number.isFinite(time) || !Number.isInteger(phaseIndex) ||
          phaseIndex < 0 || phaseIndex >= ASCII_SEQUENCES.idle.length) {
        throw new Error("ASCII tail reset requires a finite time and valid phase.");
      }
      tailPhaseIndex = phaseIndex;
      tailRemainingMs = ASCII_SEQUENCES.idle[phaseIndex].durationMs;
      nextTailAt = time + tailRemainingMs;
      tailFrozen = false;
      return nextTailAt;
    },
    refreshFollow(time) {
      if (!Number.isFinite(time)) throw new Error("ASCII follow clock requires a finite time.");
      followUntil = time + ASCII_INTERACTION_TIMING.followMs;
      return followUntil;
    },
    clearFollow() {
      followUntil = Number.NEGATIVE_INFINITY;
    },
    followExpired(time) {
      if (!Number.isFinite(time)) throw new Error("ASCII follow check requires a finite time.");
      return time >= followUntil;
    },
    markBatEnded(time) {
      if (!Number.isFinite(time)) throw new Error("ASCII bat clock requires a finite time.");
      lastBatEndedAt = time;
      return lastBatEndedAt;
    },
    batCoolingDown(time) {
      if (!Number.isFinite(time)) throw new Error("ASCII cooldown check requires a finite time.");
      return time - lastBatEndedAt < ASCII_INTERACTION_TIMING.cooldownMs;
    },
  });
}

export function createAsciiBatSequence(direction, ordinal = 0) {
  if (!DIRECTIONS.includes(direction)) throw new Error(`Unknown ASCII bat direction: ${direction}`);
  if (!Number.isInteger(ordinal) || ordinal < 0) throw new Error("ASCII bat ordinal must be a non-negative integer.");
  const extraBats = ASCII_MINI_BAT_PATTERN[ordinal % ASCII_MINI_BAT_PATTERN.length];
  const sequence = [...ASCII_SEQUENCES.bat[direction]];
  for (let index = 0; index < extraBats; index += 1) {
    const timing = MINI_BAT_TIMINGS[(ordinal + index) % MINI_BAT_TIMINGS.length];
    sequence.push(timed(`bat-${direction}-mini-in`, timing.inward));
    sequence.push(timed(`bat-${direction}-mini-contact`, timing.outward));
  }
  sequence.push(...ASCII_SEQUENCES.retract[direction]);
  return Object.freeze(sequence);
}

export const ASCII_GAZE_ANCHOR = Object.freeze({ row: 20, column: 21 });

export const ASCII_ANATOMY = Object.freeze({
  head: Object.freeze({ top: 14, right: 31, bottom: 24, left: 11 }),
  body: Object.freeze({ top: 11, right: 64, bottom: 23, left: 14 }),
  ears: Object.freeze({
    left: Object.freeze({
      tip: Object.freeze({ row: 14, column: 16 }),
      root: Object.freeze({ row: 16, column: 17 }),
      window: Object.freeze({ left: 14, right: 19 }),
      maximumTipWidth: 3,
    }),
    right: Object.freeze({
      tip: Object.freeze({ row: 14, column: 25 }),
      root: Object.freeze({ row: 16, column: 25 }),
      window: Object.freeze({ left: 23, right: 28 }),
      maximumTipWidth: 6,
    }),
  }),
  tail: Object.freeze({
    root: TAIL_SHARED[0],
    sharedSpine: TAIL_SHARED,
    paths: TAIL_TIPS,
    tips: Object.freeze(Object.fromEntries(Object.entries(TAIL_TIPS).map(([tail, points]) => [
      tail,
      points.at(-1),
    ]))),
  }),
  tailRoot: Object.freeze({ row: 15, column: 56 }),
  shoulders: Object.freeze({
    left: SHOULDERS.left,
    right: SHOULDERS.right,
  }),
  loafPaws: Object.freeze({
    left: RESTING_PAW_CENTERS.left,
    right: RESTING_PAW_CENTERS.right,
  }),
  contact: Object.freeze(Object.fromEntries(DIRECTIONS.map((direction) => {
    const target = BAT_TARGETS[direction];
    return [direction, Object.freeze({
      pose: `bat-${direction}-contact`,
      paw: target.paw,
      gazePose: `track-${direction}-left-tail`,
    })];
  }))),
});

export const ASCII_REGIONS = Object.freeze({
  paw: Object.freeze({ top: 21, right: 44, bottom: 25, left: 24 }),
  cat: Object.freeze({ top: 11, right: 69, bottom: 24, left: 11 }),
  nearCat: Object.freeze({ top: 8, right: 69, bottom: 27, left: 7 }),
});

export function normalizeAsciiArt(art) {
  if (typeof art !== "string") throw new TypeError("ASCII art must be a string.");
  const normalized = art.replace(/\r\n?/g, "\n");
  if (normalized.includes("\t")) throw new Error("ASCII art must not contain tabs.");
  const lines = normalized.split("\n");
  if (lines.length !== ASCII_ROWS) {
    throw new Error(`ASCII art must contain exactly ${ASCII_ROWS} rows; received ${lines.length}.`);
  }
  return lines.map((line, row) => {
    if (line.length > ASCII_COLUMNS) {
      throw new Error(`ASCII row ${row} exceeds ${ASCII_COLUMNS} columns (${line.length}).`);
    }
    return line.padEnd(ASCII_COLUMNS, " ");
  });
}

function applyAsciiPatches(art, patches, label) {
  const grid = normalizeAsciiArt(art).map((line) => Array.from(line));
  for (const { row, column, text } of patches) {
    if (text.includes("\n") || text.includes("\r") || text.includes("\t")) {
      throw new Error(`ASCII pose ${label} contains a multiline or tabbed patch.`);
    }
    if (row < 0 || row >= ASCII_ROWS || column < 0 || column + text.length > ASCII_COLUMNS) {
      throw new Error(`ASCII pose ${label} patch exceeds the fixed grid.`);
    }
    for (let offset = 0; offset < text.length; offset += 1) grid[row][column + offset] = text[offset];
  }
  return grid.map((line) => line.join("")).join("\n");
}

export function applyAsciiPose(art, poseName) {
  const patches = ASCII_POSES[poseName];
  if (!patches) throw new Error(`Unknown ASCII pose: ${poseName}`);
  return applyAsciiPatches(art, patches, poseName);
}

export function createAsciiFrames(art) {
  return Object.fromEntries(Object.keys(ASCII_POSES).map((poseName) => [poseName, applyAsciiPose(art, poseName)]));
}

export function createAsciiTargetedBatFrames(art, direction, row, column, tail = "center") {
  if (!DIRECTIONS.includes(direction)) throw new Error(`Unknown ASCII bat direction: ${direction}`);
  if (![row, column].every(Number.isFinite)) {
    throw new Error("ASCII bat target must use finite row and column coordinates.");
  }
  if (!TAIL_PATHS[tail]) throw new Error(`Unknown ASCII tail position: ${tail}`);
  const batTarget = { row, column };
  const variants = [
    ["ready", "ready"],
    ["reach", "reach"],
    ["contact", "contact"],
    ["mini-in", "mini-in"],
    ["mini-contact", "mini-contact"],
    ["recoil", "reach"],
  ];
  const frames = variants.map(([suffix, extension]) => {
    const poseName = `bat-${direction}-${suffix}`;
    const targetFrame = catFrame({ tail, gaze: direction, bat: direction, extension, batTarget });
    return [poseName, applyAsciiPatches(art, diffFrame(asciiPortrait, targetFrame), poseName)];
  });
  const settleName = `settle-${direction}`;
  const settleFrame = catFrame({ tail, gaze: direction });
  frames.push([
    settleName,
    applyAsciiPatches(art, diffFrame(asciiPortrait, settleFrame), settleName),
  ]);
  return Object.freeze(Object.fromEntries(frames));
}

function isWithin(region, row, column) {
  return row >= region.top && row <= region.bottom && column >= region.left && column <= region.right;
}

function hasInkNearby(lines, row, column, radius) {
  for (let y = Math.max(0, row - radius); y <= Math.min(ASCII_ROWS - 1, row + radius); y += 1) {
    for (let x = Math.max(0, column - radius); x <= Math.min(ASCII_COLUMNS - 1, column + radius); x += 1) {
      if (lines[y][x] !== " ") return true;
    }
  }
  return false;
}

export function classifyAsciiPoint(lines, row, column) {
  if (row < 0 || row >= ASCII_ROWS || column < 0 || column >= ASCII_COLUMNS) return "blank";
  if (isWithin(ASCII_REGIONS.paw, row, column) && hasInkNearby(lines, row, column, 1)) return "paw";
  if (isWithin(ASCII_REGIONS.cat, row, column) && hasInkNearby(lines, row, column, 1)) return "cat";
  if (lines[row][column] !== " ") return "image";
  if (isWithin(ASCII_REGIONS.nearCat, row, column) && hasInkNearby(lines, row, column, 2)) return "near-cat";
  return "blank";
}

export function directionForAsciiPoint(row, column) {
  const side = column < ASCII_GAZE_ANCHOR.column ? "left" : "right";
  return row <= ASCII_GAZE_ANCHOR.row - 3 ? `upper-${side}` : side;
}

export function validateAsciiCharacterDefinition(art = asciiPortrait) {
  const baseLines = normalizeAsciiArt(art);
  const frames = createAsciiFrames(art);
  for (const [poseName, patches] of Object.entries(ASCII_POSES)) {
    for (const patch of patches) {
      if (!Number.isInteger(patch.row) || !Number.isInteger(patch.column)) {
        throw new Error(`ASCII pose ${poseName} uses a non-integer patch origin.`);
      }
    }
    const lines = frames[poseName].split("\n");
    if (lines.length !== ASCII_ROWS || lines.some((line) => line.length !== ASCII_COLUMNS)) {
      throw new Error(`ASCII pose ${poseName} changes the fixed frame geometry.`);
    }
    const supersededMotifs = ["(@)=====>", "(OOO)", "(o)", ".------.", "---=="];
    if (supersededMotifs.some((motif) => frames[poseName].includes(motif))) {
      throw new Error(`ASCII pose ${poseName} contains a superseded line-art motif.`);
    }
  }

  const validateSequence = (sequence, label) => {
    if (!Array.isArray(sequence) || sequence.length === 0) throw new Error(`ASCII sequence ${label} must contain a pose.`);
    for (const frame of sequence) {
      if (!ASCII_POSES[frame.pose] || !Number.isFinite(frame.durationMs) || frame.durationMs <= 0) {
        throw new Error(`ASCII sequence ${label} is invalid.`);
      }
    }
  };
  validateSequence(ASCII_SEQUENCES.idle, "idle");
  for (const phase of ["track", "bat", "retract", "settle"]) {
    if (Object.keys(ASCII_SEQUENCES[phase]).sort().join("|") !== [...DIRECTIONS].sort().join("|")) {
      throw new Error(`ASCII ${phase} must cover all pointer directions.`);
    }
    for (const direction of DIRECTIONS) validateSequence(ASCII_SEQUENCES[phase][direction], `${phase}.${direction}`);
  }

  const tailFrames = TAIL_POSITIONS.map((tail) =>
    frames[tail === "center" ? "loaf-center" : `loaf-tail-${tail}`]);
  if (new Set(tailFrames).size !== TAIL_POSITIONS.length) {
    throw new Error("ASCII cat tail must swish through distinct poses.");
  }
  const tailLines = tailFrames.map((frame) => frame.split("\n"));
  for (let row = 10; row <= 23; row += 1) {
    for (let column = 51; column <= 63; column += 1) {
      if (new Set(tailLines.map((lines) => lines[row][column])).size !== 1) {
        throw new Error("ASCII cat tail must keep a stable rump and proximal root.");
      }
    }
  }
  for (let first = 0; first < tailLines.length; first += 1) {
    for (let second = first + 1; second < tailLines.length; second += 1) {
      let changes = 0;
      for (let row = 0; row < ASCII_ROWS; row += 1) {
        for (let column = 0; column < ASCII_COLUMNS; column += 1) {
          if (tailLines[first][row][column] === tailLines[second][row][column]) continue;
          changes += 1;
          if (row < 11 || row > 24 || column < 64) {
            throw new Error("ASCII cat tail motion must remain confined to the distal tip.");
          }
        }
      }
      if (changes < 4 || changes > 60) {
        throw new Error("ASCII cat tail-tip motion must remain compact and visible.");
      }
    }
  }
  for (const [tailIndex, tail] of TAIL_POSITIONS.entries()) {
    if (!tailLines[tailIndex].some((line) => line[ASCII_COLUMNS - 1] !== " ")) {
      throw new Error(`ASCII cat ${tail} tail must reach the outer edge before curling back.`);
    }
  }
  const occupied = [];
  for (let row = 0; row < ASCII_ROWS; row += 1) {
    for (let column = 0; column < ASCII_COLUMNS; column += 1) {
      if (baseLines[row][column] !== " ") occupied.push({ row, column });
    }
  }
  const silhouette = {
    top: Math.min(...occupied.map(({ row }) => row)),
    right: Math.max(...occupied.map(({ column }) => column)),
    bottom: Math.max(...occupied.map(({ row }) => row)),
    left: Math.min(...occupied.map(({ column }) => column)),
  };
  const silhouetteWidth = silhouette.right - silhouette.left + 1;
  const silhouetteHeight = silhouette.bottom - silhouette.top + 1;
  if (silhouetteWidth < 54 || silhouetteHeight > 15 ||
      silhouetteWidth / silhouetteHeight < 3.6 ||
      silhouette.top < 10 || silhouette.bottom > 25) {
    throw new Error("ASCII cat must remain a low, elongated compound loaf.");
  }
  const torsoOccupied = occupied.filter(({ column }) => column <= 64);
  const torsoWidth = Math.max(...torsoOccupied.map(({ column }) => column)) -
    Math.min(...torsoOccupied.map(({ column }) => column)) + 1;
  const torsoHeight = Math.max(...torsoOccupied.map(({ row }) => row)) -
    Math.min(...torsoOccupied.map(({ row }) => row)) + 1;
  if (torsoWidth / torsoHeight < 3.3) {
    throw new Error("ASCII cat torso must remain elongated independently of its tail.");
  }
  for (const [side, ear] of Object.entries(ASCII_ANATOMY.ears)) {
    if (baseLines[ear.tip.row][ear.tip.column] === " " ||
        baseLines[ear.root.row][ear.root.column] === " ") {
      throw new Error(`ASCII cat ${side} ear must join the lowered head contour.`);
    }
    const tipWidth = [...baseLines[ear.tip.row].slice(ear.window.left, ear.window.right + 1)]
      .filter((character) => character !== " ").length;
    const rootWidth = [...baseLines[ear.root.row].slice(ear.window.left, ear.window.right + 1)]
      .filter((character) => character !== " ").length;
    if (tipWidth < 1 || tipWidth > ear.maximumTipWidth || rootWidth < tipWidth) {
      throw new Error(`ASCII cat ${side} ear must stay small and tapered.`);
    }
  }
  if (![0, 1, 2, 3].every((count) => ASCII_MINI_BAT_PATTERN.includes(count))) {
    throw new Error("ASCII cat mini-bat cadence must include zero through three follow-up taps.");
  }
  for (const direction of DIRECTIONS) {
    const anatomy = ASCII_ANATOMY.contact[direction];
    const contact = frames[anatomy.pose].split("\n");
    const tracking = frames[anatomy.gazePose].split("\n");
    const neutralTail = frames["loaf-tail-left"].split("\n");
    if (contact[anatomy.paw.row][anatomy.paw.column] !== "K") {
      throw new Error(`ASCII ${direction} bat lost its compact glass contact.`);
    }
    let headChanges = 0;
    for (let row = ASCII_ANATOMY.head.top; row <= ASCII_ANATOMY.head.bottom; row += 1) {
      for (let column = ASCII_ANATOMY.head.left; column <= ASCII_ANATOMY.head.right; column += 1) {
        if (tracking[row][column] !== neutralTail[row][column]) headChanges += 1;
      }
    }
    if (headChanges < 40) {
      throw new Error(`ASCII cat does not turn its lowered head ${direction}.`);
    }
    const shoulder = ASCII_ANATOMY.shoulders[BAT_TARGETS[direction].shoulder];
    if (contact[shoulder.row][shoulder.column] === " " ||
        !SHADE.includes(contact[shoulder.row][shoulder.column])) {
      throw new Error(`ASCII ${direction} bat detached from its shoulder.`);
    }
    for (let ordinal = 0; ordinal < ASCII_MINI_BAT_PATTERN.length; ordinal += 1) {
      const sequence = createAsciiBatSequence(direction, ordinal);
      const expectedContacts = 1 + ASCII_MINI_BAT_PATTERN[ordinal];
      const contacts = sequence.filter(({ pose: poseName }) => poseName.includes("contact")).length;
      const totalDuration = sequence.reduce((sum, frame) => sum + frame.durationMs, 0);
      if (contacts !== expectedContacts || sequence[0].pose !== `bat-${direction}-ready` ||
          sequence.at(-1)?.pose !== `bat-${direction}-recoil` ||
          totalDuration < 530 || totalDuration > 1115) {
        throw new Error(`ASCII ${direction} bat cadence ${ordinal} is not a readable natural gesture.`);
      }
    }
  }
  for (const [name, region] of Object.entries(ASCII_REGIONS)) {
    if (region.top < 0 || region.left < 0 || region.bottom >= ASCII_ROWS || region.right >= ASCII_COLUMNS) {
      throw new Error(`ASCII region ${name} exceeds the portrait grid.`);
    }
  }
  if (baseLines.some((line) => line.length !== ASCII_COLUMNS)) throw new Error("ASCII base portrait is not fixed width.");
  return true;
}

validateAsciiCharacterDefinition();
