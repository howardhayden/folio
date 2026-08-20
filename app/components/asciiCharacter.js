export const ASCII_COLUMNS = 70;
export const ASCII_ROWS = 34;

export const ASCII_CHARACTER_DESCRIPTION =
  "A cat loafs on a glass table above the viewer, follows the pointer with its eyes, swishes its tail, and reaches down to bat at it with a soft paw.";

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

function draw(grid, row, column, text) {
  if (row < 0 || row >= ASCII_ROWS || column < 0 || column + text.length > ASCII_COLUMNS) {
    throw new Error(`Cat layer exceeds the ${ASCII_COLUMNS}x${ASCII_ROWS} grid.`);
  }
  for (let offset = 0; offset < text.length; offset += 1) {
    grid[row][column + offset] = text[offset];
  }
}

function drawTail(grid, tail) {
  const layers = {
    left: [
      [4, 13, "       __..---..__"],
      [5, 10, "  _.-''            ''-._"],
      [6, 8, ".-'                      '-."],
      [7, 8, "\\                           \\__"],
      [8, 9, "'--.._______________________/  \\"],
      [9, 39, "\\__"],
    ],
    center: [
      [4, 40, "__..---..__"],
      [5, 38, "/            ''-._"],
      [6, 37, "/                  '-."],
      [7, 37, "\\                     \\"],
      [8, 38, "'--..___________..--'"],
      [9, 38, "\\__"],
    ],
    right: [
      [4, 43, "__..---..__"],
      [5, 43, "_.-''            ''-._"],
      [6, 42, ".-'                    '-."],
      [7, 39, "__/                         /"],
      [8, 38, "/  \\_________________..--'"],
      [9, 38, "\\__"],
    ],
  };
  for (const [row, column, text] of layers[tail]) draw(grid, row, column, text);
}

function pupilColumns(gaze) {
  const looksLeft = gaze.endsWith("left");
  const looksRight = gaze.endsWith("right");
  return {
    left: looksLeft ? 28 : looksRight ? 31 : 30,
    right: looksLeft ? 42 : looksRight ? 45 : 44,
    row: gaze.startsWith("upper-") ? 14 : 15,
  };
}

function drawBody(grid, gaze) {
  const shell = [
    [8, 21, "_.--''''''''''''''''''''''--._"],
    [9, 17, ".-'                                '-."],
    [10, 14, ".-'                                      '-."],
    [11, 12, "/                                            \\"],
    [12, 11, "/                                              \\"],
    [13, 10, "|                                                |"],
    [14, 10, "|                                                |"],
    [15, 10, "|                                                |"],
    [16, 10, "|                                                |"],
    [17, 10, "|                                                |"],
    [18, 10, "|                                                |"],
    [19, 10, "|                                                |"],
    [20, 10, "|                                                |"],
    [21, 10, "|                                                |"],
    [22, 10, "|                                                |"],
    [23, 10, "|                                                |"],
    [24, 10, "|                                                |"],
    [25, 10, "|                                                |"],
    [26, 10, "|                                                |"],
    [27, 11, "\\                                              /"],
    [28, 12, "\\                                            /"],
    [29, 14, "'-._                                    _.-'"],
    [30, 18, "'--..________________________..--'"],
  ];
  for (const [row, column, text] of shell) draw(grid, row, column, text);

  const head = [
    [10, 22, "/\\                              /\\"],
    [11, 21, "/  \\____________________________/  \\"],
    [12, 20, "/                                    \\"],
    [13, 20, "|      .------.        .------.      |"],
    [14, 20, "|     /        \\      /        \\     |"],
    [15, 20, "|     |        |      |        |     |"],
    [16, 20, "|     \\        /      \\        /     |"],
    [17, 20, "|       '----'    /\\    '----'       |"],
    [18, 20, "|   ---==       (  )       ==---   |"],
    [19, 20, "|          \\    \\__/    /          |"],
    [20, 21, "\\          '.__.'          /"],
    [21, 22, "'-._                  _.-'"],
  ];
  for (const [row, column, text] of head) draw(grid, row, column, text);

  const pupils = pupilColumns(gaze);
  draw(grid, pupils.row, pupils.left, "o");
  draw(grid, pupils.row, pupils.right, "o");
}

function drawLoafPaw(grid, side) {
  const column = side === "left" ? 17 : 39;
  const paw = [
    [22, column + 3, ".--------."],
    [23, column + 1, "/  o  o  o  \\"],
    [24, column, "|      (o)      |"],
    [25, column, "|   o       o   |"],
    [26, column + 1, "\\     ___     /"],
    [27, column + 3, "'-.___.-'"],
  ];
  for (const [row, pawColumn, text] of paw) draw(grid, row, pawColumn, text);
}

const BAT_TARGETS = Object.freeze({
  left: Object.freeze({ pawRow: 19, pawColumn: 1, shoulder: "left" }),
  right: Object.freeze({ pawRow: 19, pawColumn: 55, shoulder: "right" }),
  "upper-left": Object.freeze({ pawRow: 3, pawColumn: 2, shoulder: "left" }),
  "upper-right": Object.freeze({ pawRow: 3, pawColumn: 54, shoulder: "right" }),
});

function drawBatPaw(grid, direction, extension) {
  const target = BAT_TARGETS[direction];
  const shoulder = target.shoulder === "left" ? { row: 21, column: 24 } : { row: 21, column: 46 };
  const amount = extension === "ready" ? 0.42 : extension === "reach" ? 0.72 : 1;
  const pawRow = Math.round(shoulder.row + (target.pawRow - shoulder.row) * amount);
  const pawColumn = Math.round(shoulder.column + (target.pawColumn - shoulder.column) * amount);
  const pawCenter = { row: pawRow + 2, column: pawColumn + 6 };
  const steps = Math.max(
    Math.abs(pawCenter.row - shoulder.row),
    Math.ceil(Math.abs(pawCenter.column - shoulder.column) / 2),
  );
  for (let step = 0; step <= steps; step += 1) {
    const ratio = steps === 0 ? 1 : step / steps;
    const row = Math.round(shoulder.row + (pawCenter.row - shoulder.row) * ratio);
    const column = Math.round(shoulder.column + (pawCenter.column - shoulder.column) * ratio);
    draw(grid, row, Math.max(0, column - 1), direction.endsWith("left") ? "\\\\" : "//");
  }
  const paw = [
    [pawRow, pawColumn + 3, ".------."],
    [pawRow + 1, pawColumn + 1, "/ o  o  o \\"],
    [pawRow + 2, pawColumn, "|    (o)    |"],
    [pawRow + 3, pawColumn + 1, "\\ o     o /"],
    [pawRow + 4, pawColumn + 3, "'-.__.-'"],
  ];
  for (const [row, column, text] of paw) draw(grid, row, column, text);
}

function catFrame({ tail = "center", gaze = "center", bat = null, extension = "contact" } = {}) {
  const grid = emptyGrid();
  drawTail(grid, tail);
  drawBody(grid, gaze);
  if (!bat) {
    drawLoafPaw(grid, "left");
    drawLoafPaw(grid, "right");
  } else {
    drawLoafPaw(grid, BAT_TARGETS[bat].shoulder === "left" ? "right" : "left");
    drawBatPaw(grid, bat, extension);
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
  "loaf-tail-left": pose({ tail: "left", gaze: "center" }),
  "loaf-tail-right": pose({ tail: "right", gaze: "center" }),
};

for (const direction of DIRECTIONS) {
  poseEntries[`track-${direction}-left-tail`] = pose({ tail: "left", gaze: direction });
  poseEntries[`track-${direction}-right-tail`] = pose({ tail: "right", gaze: direction });
  poseEntries[`bat-${direction}-ready`] = pose({ tail: "left", gaze: direction, bat: direction, extension: "ready" });
  poseEntries[`bat-${direction}-reach`] = pose({ tail: "center", gaze: direction, bat: direction, extension: "reach" });
  poseEntries[`bat-${direction}-contact`] = pose({ tail: "right", gaze: direction, bat: direction, extension: "contact" });
  poseEntries[`bat-${direction}-recoil`] = pose({ tail: "center", gaze: direction, bat: direction, extension: "reach" });
  poseEntries[`settle-${direction}`] = pose({ tail: "left", gaze: direction });
}

export const ASCII_POSES = Object.freeze(poseEntries);

function timed(poseName, durationMs) {
  return Object.freeze({ pose: poseName, durationMs });
}

export const ASCII_SEQUENCES = Object.freeze({
  idle: Object.freeze([
    timed("loaf-center", 720),
    timed("loaf-tail-left", 320),
    timed("loaf-center", 300),
    timed("loaf-tail-right", 340),
    timed("loaf-center", 760),
  ]),
  track: Object.freeze(Object.fromEntries(DIRECTIONS.map((direction) => [
    direction,
    Object.freeze([
      timed(`track-${direction}-left-tail`, 280),
      timed(`track-${direction}-right-tail`, 300),
    ]),
  ]))),
  bat: Object.freeze(Object.fromEntries(DIRECTIONS.map((direction) => [
    direction,
    Object.freeze([
      timed(`bat-${direction}-ready`, 105),
      timed(`bat-${direction}-reach`, 115),
      timed(`bat-${direction}-contact`, 165),
      timed(`bat-${direction}-recoil`, 145),
    ]),
  ]))),
  settle: Object.freeze(Object.fromEntries(DIRECTIONS.map((direction) => [
    direction,
    Object.freeze([timed(`settle-${direction}`, 190), timed("loaf-center", 240)]),
  ]))),
});

export const ASCII_GAZE_ANCHOR = Object.freeze({ row: 16, column: 35 });

export const ASCII_ANATOMY = Object.freeze({
  head: Object.freeze({ top: 10, right: 56, bottom: 21, left: 20 }),
  body: Object.freeze({ top: 8, right: 59, bottom: 30, left: 10 }),
  tailRoot: Object.freeze({ row: 9, column: 39 }),
  shoulders: Object.freeze({
    left: Object.freeze({ row: 21, column: 24 }),
    right: Object.freeze({ row: 21, column: 46 }),
  }),
  loafPaws: Object.freeze({
    left: Object.freeze({ row: 24, column: 25 }),
    right: Object.freeze({ row: 24, column: 47 }),
  }),
  contact: Object.freeze(Object.fromEntries(DIRECTIONS.map((direction) => {
    const target = BAT_TARGETS[direction];
    return [direction, Object.freeze({
      pose: `bat-${direction}-contact`,
      paw: Object.freeze({ row: target.pawRow + 2, column: target.pawColumn + 6 }),
      gazePose: `track-${direction}-left-tail`,
    })];
  }))),
});

export const ASCII_REGIONS = Object.freeze({
  paw: Object.freeze({ top: 21, right: 56, bottom: 28, left: 16 }),
  cat: Object.freeze({ top: 8, right: 59, bottom: 30, left: 10 }),
  nearCat: Object.freeze({ top: 3, right: 66, bottom: 32, left: 2 }),
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

export function applyAsciiPose(art, poseName) {
  const patches = ASCII_POSES[poseName];
  if (!patches) throw new Error(`Unknown ASCII pose: ${poseName}`);
  const grid = normalizeAsciiArt(art).map((line) => Array.from(line));
  for (const { row, column, text } of patches) {
    if (text.includes("\n") || text.includes("\r") || text.includes("\t")) {
      throw new Error(`ASCII pose ${poseName} contains a multiline or tabbed patch.`);
    }
    if (row < 0 || row >= ASCII_ROWS || column < 0 || column + text.length > ASCII_COLUMNS) {
      throw new Error(`ASCII pose ${poseName} patch exceeds the fixed grid.`);
    }
    for (let offset = 0; offset < text.length; offset += 1) grid[row][column + offset] = text[offset];
  }
  return grid.map((line) => line.join("")).join("\n");
}

export function createAsciiFrames(art) {
  return Object.fromEntries(Object.keys(ASCII_POSES).map((poseName) => [poseName, applyAsciiPose(art, poseName)]));
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
    if (frames[poseName].includes("(@)=====>") || frames[poseName].includes("(OOO)")) {
      throw new Error(`ASCII pose ${poseName} contains a superseded human-arm motif.`);
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
  for (const phase of ["track", "bat", "settle"]) {
    if (Object.keys(ASCII_SEQUENCES[phase]).sort().join("|") !== [...DIRECTIONS].sort().join("|")) {
      throw new Error(`ASCII ${phase} must cover all pointer directions.`);
    }
    for (const direction of DIRECTIONS) validateSequence(ASCII_SEQUENCES[phase][direction], `${phase}.${direction}`);
  }

  const tailFrames = [frames["loaf-tail-left"], frames["loaf-center"], frames["loaf-tail-right"]];
  if (new Set(tailFrames).size !== 3) {
    throw new Error("ASCII cat tail must swish through distinct poses.");
  }
  for (const direction of DIRECTIONS) {
    const anatomy = ASCII_ANATOMY.contact[direction];
    const contact = frames[anatomy.pose].split("\n");
    const gaze = frames[anatomy.gazePose].split("\n");
    if (contact[anatomy.paw.row][anatomy.paw.column] !== "o") {
      throw new Error(`ASCII ${direction} bat lost its visible paw pad.`);
    }
    const pupils = pupilColumns(direction);
    if (gaze[pupils.row][pupils.left] !== "o" || gaze[pupils.row][pupils.right] !== "o") {
      throw new Error(`ASCII cat does not look ${direction}.`);
    }
    const shoulder = ASCII_ANATOMY.shoulders[BAT_TARGETS[direction].shoulder];
    if (!["/", "\\"].includes(contact[shoulder.row][shoulder.column])) {
      throw new Error(`ASCII ${direction} bat detached from its shoulder.`);
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
