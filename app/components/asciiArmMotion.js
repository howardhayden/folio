import {
  ASCII_COLUMNS,
  ASCII_ROWS,
  ASCII_SEQUENCES,
  asciiPortrait,
  normalizeAsciiArt,
} from "./asciiCharacter.js";

const X_SCALE = 0.5;
const ARM_CHARS = Object.freeze({ core: "M", middle: "K", edge: "x" });
const SHOULDER_RADIUS = 0.9;

/** @typedef {{ row: number, column: number }} GridPoint */
/**
 * @typedef {{
 *   shoulder: GridPoint,
 *   elbow: GridPoint,
 *   hand: GridPoint,
 *   upperThickness: number,
 *   forearmThickness: number,
 *   elbowRadius: number,
 *   handRadius: number,
 *   penDashes: number,
 * }} ArmRig
 */

/**
 * @param {number} shoulderRow
 * @param {number} shoulderColumn
 * @param {number} elbowRow
 * @param {number} elbowColumn
 * @param {number} handRow
 * @param {number} handColumn
 * @param {number} upperThickness
 * @param {number} forearmThickness
 * @param {number} elbowRadius
 * @param {number} handRadius
 * @param {number} [penDashes]
 * @returns {Readonly<ArmRig>}
 */
function rig(
  shoulderRow,
  shoulderColumn,
  elbowRow,
  elbowColumn,
  handRow,
  handColumn,
  upperThickness,
  forearmThickness,
  elbowRadius,
  handRadius,
  penDashes = 3,
) {
  return Object.freeze({
    shoulder: Object.freeze({ row: shoulderRow, column: shoulderColumn }),
    elbow: Object.freeze({ row: elbowRow, column: elbowColumn }),
    hand: Object.freeze({ row: handRow, column: handColumn }),
    upperThickness,
    forearmThickness,
    elbowRadius,
    handRadius,
    penDashes,
  });
}

/**
 * Every swat rises from the same authored shoulder. The elbow travels outward
 * and above the shoulder while the hand folds back inward and higher, creating
 * a readable bent-arm silhouette instead of a thin horizontal trail. The pen
 * remains attached to the hand and points toward the rear-right.
 *
 * @type {Readonly<Record<string, Readonly<ArmRig>>>}
 */
export const NATURAL_SWAT_RIGS = Object.freeze({
  "right-windup": rig(27, 43, 25, 52, 23, 47, 0.76, 0.68, 0.80, 0.66),
  "right-extend": rig(27, 43, 23, 58, 19, 51, 0.84, 0.76, 0.90, 0.74),
  "right-contact": rig(27, 43, 22, 61, 16, 54, 0.90, 0.82, 1.00, 0.82),
  "right-recoil": rig(27, 43, 24, 55, 20, 49, 0.82, 0.74, 0.88, 0.72),

  "upper-right-windup": rig(27, 43, 25, 52, 23, 47, 0.76, 0.68, 0.80, 0.66),
  "upper-right-extend": rig(27, 43, 22, 59, 17, 52, 0.86, 0.78, 0.94, 0.76),
  "upper-right-contact": rig(27, 43, 20, 61, 13, 54, 0.90, 0.82, 1.00, 0.82),
  "upper-right-recoil": rig(27, 43, 23, 56, 18, 50, 0.82, 0.74, 0.88, 0.72),

  "left-windup": rig(27, 43, 25, 51, 23, 45, 0.76, 0.68, 0.80, 0.66),
  "left-extend": rig(27, 43, 23, 56, 19, 44, 0.84, 0.76, 0.90, 0.74),
  "left-contact": rig(27, 43, 22, 57, 16, 43, 0.90, 0.82, 1.00, 0.82),
  "left-recoil": rig(27, 43, 24, 53, 20, 45, 0.82, 0.74, 0.88, 0.72),

  "upper-left-windup": rig(27, 43, 25, 51, 23, 45, 0.76, 0.68, 0.80, 0.66),
  "upper-left-extend": rig(27, 43, 22, 57, 17, 44, 0.86, 0.78, 0.94, 0.76),
  "upper-left-contact": rig(27, 43, 20, 58, 13, 43, 0.90, 0.82, 1.00, 0.82),
  "upper-left-recoil": rig(27, 43, 23, 54, 18, 45, 0.82, 0.74, 0.88, 0.72),

  "recover-left": rig(27, 43, 25, 52, 22, 46, 0.78, 0.70, 0.82, 0.68),
  "recover-right": rig(27, 43, 24, 55, 21, 49, 0.80, 0.72, 0.86, 0.70),
});

/**
 * @param {number} pointX
 * @param {number} pointY
 * @param {number} startX
 * @param {number} startY
 * @param {number} endX
 * @param {number} endY
 * @returns {number}
 */
function distanceToSegment(pointX, pointY, startX, startY, endX, endY) {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const pointOffsetX = pointX - startX;
  const pointOffsetY = pointY - startY;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    return Math.hypot(pointOffsetX, pointOffsetY);
  }

  const progress = Math.max(
    0,
    Math.min(
      1,
      (pointOffsetX * segmentX + pointOffsetY * segmentY) /
        segmentLengthSquared,
    ),
  );
  const nearestX = startX + progress * segmentX;
  const nearestY = startY + progress * segmentY;
  return Math.hypot(pointX - nearestX, pointY - nearestY);
}

/**
 * @param {string[][]} grid
 * @param {Readonly<ArmRig>} arm
 */
function paintArm(grid, arm) {
  const shoulderX = arm.shoulder.column * X_SCALE;
  const shoulderY = arm.shoulder.row;
  const elbowX = arm.elbow.column * X_SCALE;
  const elbowY = arm.elbow.row;
  const handX = arm.hand.column * X_SCALE;
  const handY = arm.hand.row;

  for (let row = 0; row < ASCII_ROWS; row += 1) {
    for (let column = 0; column < ASCII_COLUMNS; column += 1) {
      const pointX = column * X_SCALE;
      const pointY = row;
      const normalizedDistance = Math.min(
        distanceToSegment(
          pointX,
          pointY,
          shoulderX,
          shoulderY,
          elbowX,
          elbowY,
        ) / arm.upperThickness,
        distanceToSegment(
          pointX,
          pointY,
          elbowX,
          elbowY,
          handX,
          handY,
        ) / arm.forearmThickness,
        Math.hypot(pointX - shoulderX, pointY - shoulderY) /
          SHOULDER_RADIUS,
        Math.hypot(pointX - elbowX, pointY - elbowY) / arm.elbowRadius,
        Math.hypot(pointX - handX, pointY - handY) / arm.handRadius,
      );

      if (normalizedDistance > 1) continue;
      grid[row][column] =
        normalizedDistance <= 0.38
          ? ARM_CHARS.core
          : normalizedDistance <= 0.72
            ? ARM_CHARS.middle
            : ARM_CHARS.edge;
    }
  }
}

/**
 * @param {string[][]} grid
 * @param {Readonly<ArmRig>} arm
 */
function paintPen(grid, arm) {
  const rootColumn =
    arm.hand.column + Math.max(1, Math.ceil(arm.handRadius / X_SCALE));
  const pen = `/${"-".repeat(arm.penDashes)}'`;

  for (let offset = 0; offset < pen.length; offset += 1) {
    grid[arm.hand.row][rootColumn + offset] = pen[offset];
  }
}

/**
 * @param {string} art
 * @param {string} poseName
 * @returns {string}
 */
export function drawNaturalSwatFrame(art, poseName) {
  const arm = NATURAL_SWAT_RIGS[poseName];
  if (!arm) {
    throw new Error(`Unknown natural ASCII arm pose: ${poseName}`);
  }

  const grid = normalizeAsciiArt(art).map((line) => Array.from(line));
  paintArm(grid, arm);
  paintPen(grid, arm);
  return grid.map((line) => line.join("")).join("\n");
}

/**
 * @param {string} art
 * @returns {Record<string, string>}
 */
export function createNaturalSwatFrames(art) {
  return Object.fromEntries(
    Object.keys(NATURAL_SWAT_RIGS).map((poseName) => [
      poseName,
      drawNaturalSwatFrame(art, poseName),
    ]),
  );
}

/**
 * @param {string} [art]
 * @returns {true}
 */
export function validateNaturalSwatFrames(art = asciiPortrait) {
  const baseLines = normalizeAsciiArt(art);
  const requiredPoseNames = new Set();

  for (const sequence of Object.values(ASCII_SEQUENCES.swat)) {
    for (const frame of sequence) requiredPoseNames.add(frame.pose);
  }
  for (const sequence of Object.values(ASCII_SEQUENCES.recover)) {
    for (const frame of sequence) {
      if (frame.pose.startsWith("recover-")) requiredPoseNames.add(frame.pose);
    }
  }

  for (const poseName of requiredPoseNames) {
    if (!NATURAL_SWAT_RIGS[poseName]) {
      throw new Error(`Natural ASCII arm rig is missing ${poseName}.`);
    }
  }

  for (const [poseName, arm] of Object.entries(NATURAL_SWAT_RIGS)) {
    const points = [arm.shoulder, arm.elbow, arm.hand];
    for (const point of points) {
      if (
        !Number.isInteger(point.row) ||
        !Number.isInteger(point.column) ||
        point.row < 0 ||
        point.row >= ASCII_ROWS ||
        point.column < 0 ||
        point.column >= ASCII_COLUMNS
      ) {
        throw new Error(`Natural ASCII arm pose ${poseName} leaves the grid.`);
      }
    }

    if (arm.elbow.row > arm.shoulder.row - 2) {
      throw new Error(`Natural ASCII arm pose ${poseName} does not raise its elbow.`);
    }
    if (arm.hand.row >= arm.elbow.row) {
      throw new Error(`Natural ASCII arm pose ${poseName} does not lift its hand.`);
    }
    if (
      arm.elbow.column <= arm.shoulder.column + 3 ||
      arm.elbow.column <= arm.hand.column + 3
    ) {
      throw new Error(`Natural ASCII arm pose ${poseName} lacks a bent elbow.`);
    }

    const penRoot =
      arm.hand.column + Math.max(1, Math.ceil(arm.handRadius / X_SCALE));
    const penEnd = penRoot + arm.penDashes + 1;
    if (penEnd >= ASCII_COLUMNS) {
      throw new Error(`Natural ASCII arm pose ${poseName} clips its pen.`);
    }

    const frameLines = drawNaturalSwatFrame(art, poseName).split("\n");
    if (
      frameLines.length !== ASCII_ROWS ||
      frameLines.some((line) => line.length !== ASCII_COLUMNS)
    ) {
      throw new Error(`Natural ASCII arm pose ${poseName} changes frame geometry.`);
    }

    let changedCells = 0;
    let widestChangedRow = 0;
    for (let row = 0; row < ASCII_ROWS; row += 1) {
      let changedInRow = 0;
      for (let column = 0; column < ASCII_COLUMNS; column += 1) {
        if (frameLines[row][column] !== baseLines[row][column]) {
          changedCells += 1;
          changedInRow += 1;
        }
      }
      widestChangedRow = Math.max(widestChangedRow, changedInRow);
    }

    if (changedCells < 24 || widestChangedRow < 4) {
      throw new Error(`Natural ASCII arm pose ${poseName} is not visibly thick.`);
    }

    const expectedPen = `/${"-".repeat(arm.penDashes)}'`;
    if (
      frameLines[arm.hand.row].slice(penRoot, penRoot + expectedPen.length) !==
      expectedPen
    ) {
      throw new Error(`Natural ASCII arm pose ${poseName} detached its pen.`);
    }
  }

  return true;
}

validateNaturalSwatFrames();
