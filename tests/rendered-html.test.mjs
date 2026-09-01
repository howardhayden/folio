import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { inflateSync } from "node:zlib";
import {
  ASCII_ANATOMY,
  ASCII_CHARACTER_DESCRIPTION,
  ASCII_COLUMNS,
  ASCII_GAZE_ANCHOR,
  ASCII_INTERACTION_TIMING,
  ASCII_MINI_BAT_PATTERN,
  ASCII_POSES,
  ASCII_ROWS,
  ASCII_SEQUENCES,
  asciiPortrait,
  classifyAsciiPoint,
  createAsciiBatSequence,
  createAsciiFrames,
  createAsciiMotionClock,
  createAsciiTargetedBatFrames,
  directionForAsciiPoint,
  normalizeAsciiArt,
  validateAsciiCharacterDefinition,
} from "../app/components/asciiCharacter.js";
import {
  arrangeShelfPapers,
  filterShelfPapers,
  shuffleShelfPapers,
} from "../app/shelf/shelfLogic.js";

const BAT_DIRECTIONS = ["left", "right", "upper-left", "upper-right"];
const TAIL_POSITIONS = ["left", "left-mid", "center", "right-mid", "right"];
const TAIL_PHASES = [
  "center",
  "left-mid",
  "left",
  "left-mid",
  "center",
  "right-mid",
  "right",
  "right-mid",
];
const TAIL_DURATIONS = [1100, 500, 800, 520, 900, 540, 860, 560];

function paethPredictor(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function decodeRgbaPng(dataUrl) {
  const source = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  assert.equal(source.subarray(1, 4).toString("ascii"), "PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  const compressed = [];

  while (offset < source.length) {
    const length = source.readUInt32BE(offset);
    const type = source.subarray(offset + 4, offset + 8).toString("ascii");
    const data = source.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, "grain PNG uses eight-bit channels");
      assert.equal(data[9], 6, "grain PNG uses RGBA channels");
    } else if (type === "IDAT") {
      compressed.push(data);
    }
    offset += length + 12;
  }

  const encoded = inflateSync(Buffer.concat(compressed));
  const stride = width * 4;
  const pixels = Buffer.alloc(stride * height);
  let encodedOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = encoded[encodedOffset];
    encodedOffset += 1;
    for (let column = 0; column < stride; column += 1) {
      const raw = encoded[encodedOffset + column];
      const left = column >= 4 ? pixels[row * stride + column - 4] : 0;
      const above = row > 0 ? pixels[(row - 1) * stride + column] : 0;
      const upperLeft = row > 0 && column >= 4
        ? pixels[(row - 1) * stride + column - 4]
        : 0;
      const prediction = filter === 0
        ? 0
        : filter === 1
          ? left
          : filter === 2
            ? above
            : filter === 3
              ? Math.floor((left + above) / 2)
              : paethPredictor(left, above, upperLeft);
      pixels[row * stride + column] = (raw + prediction) & 0xff;
    }
    encodedOffset += stride;
  }
  return { width, height, pixels };
}

function occupiedBounds(frame, maximumColumn = ASCII_COLUMNS - 1) {
  const occupied = [];
  for (const [row, line] of frame.split("\n").entries()) {
    for (let column = 0; column <= maximumColumn; column += 1) {
      if (line[column] !== " ") occupied.push({ row, column });
    }
  }
  assert.ok(occupied.length > 0, "frame contains visible cat ink");
  const top = Math.min(...occupied.map(({ row }) => row));
  const right = Math.max(...occupied.map(({ column }) => column));
  const bottom = Math.max(...occupied.map(({ row }) => row));
  const left = Math.min(...occupied.map(({ column }) => column));
  return {
    top,
    right,
    bottom,
    left,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

function crop(frame, top, right, bottom, left) {
  return frame
    .split("\n")
    .slice(top, bottom + 1)
    .map((line) => line.slice(left, right + 1))
    .join("\n");
}

function hasInkPath(lines, start, end, bounds) {
  const pending = [start];
  const visited = new Set();
  while (pending.length > 0) {
    const point = pending.pop();
    const key = `${point.row}:${point.column}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (point.row === end.row && point.column === end.column) return true;
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        if (rowOffset === 0 && columnOffset === 0) continue;
        const row = point.row + rowOffset;
        const column = point.column + columnOffset;
        if (row < bounds.top || row > bounds.bottom || column < bounds.left || column > bounds.right) {
          continue;
        }
        if (lines[row][column] !== " ") pending.push({ row, column });
      }
    }
  }
  return false;
}

function coreHash(frame) {
  const core = frame.split("\n").map((line) => line.slice(0, 64)).join("\n");
  return createHash("sha256").update(core).digest("hex");
}

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: handler } = await import(workerUrl.href);

  return handler;
}

async function render(pathname) {
  const handler = await loadWorker();

  const response = await handler(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
  );

  return { response, html: await response.text() };
}

function semanticMainText(sourceHtml) {
  const documentHtml = sourceHtml.split('<script id="_R_">')[0];
  const main = documentHtml.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? "";
  return main
    .replace(/<pre\b[\s\S]*?<\/pre>/gi, "")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#xA0;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

test("validates every authored ASCII pose without changing frame geometry", () => {
  assert.equal(validateAsciiCharacterDefinition(asciiPortrait), true);

  const frames = createAsciiFrames(asciiPortrait);
  assert.equal(Object.keys(frames).length, Object.keys(ASCII_POSES).length);

  for (const [poseName, frame] of Object.entries(frames)) {
    const lines = frame.split("\n");
    assert.equal(lines.length, ASCII_ROWS, poseName);
    assert.ok(
      lines.every((line) => line.length === ASCII_COLUMNS),
      `${poseName} preserves ${ASCII_COLUMNS} columns`,
    );
  }
});

test("authors tracking, batting, and settling sequences for all four directions", () => {
  const expected = [...BAT_DIRECTIONS].sort();

  assert.ok(ASCII_SEQUENCES.idle.length >= 3, "idle rest includes a tail cycle");
  assert.deepEqual(
    ASCII_SEQUENCES.idle.map(({ pose }) =>
      pose === "loaf-center" ? "center" : pose.replace("loaf-tail-", "")),
    TAIL_PHASES,
  );
  assert.deepEqual(ASCII_SEQUENCES.idle.map(({ durationMs }) => durationMs), TAIL_DURATIONS);
  for (const phase of ["track", "bat", "retract", "settle"]) {
    assert.deepEqual(Object.keys(ASCII_SEQUENCES[phase]).sort(), expected, phase);
    for (const direction of BAT_DIRECTIONS) {
      assert.ok(ASCII_SEQUENCES[phase][direction].length > 0, `${phase}.${direction}`);
      if (phase === "track") {
        assert.deepEqual(
          ASCII_SEQUENCES.track[direction].map(({ pose }) =>
            pose.replace(`track-${direction}-`, "").replace("-tail", "")),
          TAIL_PHASES,
        );
        assert.deepEqual(
          ASCII_SEQUENCES.track[direction].map(({ durationMs }) => durationMs),
          TAIL_DURATIONS,
        );
      }
    }
  }
});

test("keeps follow, cooldown, and the independent tail phase on a deterministic clock", () => {
  const clock = createAsciiMotionClock(100);
  assert.equal(clock.tailPhaseIndex, 0);
  assert.equal(clock.nextTailAt, 1200);
  assert.equal(clock.advanceTail(1199), 0);
  assert.equal(clock.advanceTail(1200), 1);
  assert.equal(clock.tailPhaseIndex, 1);
  assert.equal(clock.nextTailAt, 1700);

  assert.equal(clock.freezeTail(1300), 400);
  assert.equal(clock.advanceTail(5000), 0, "batting freezes both tail pose and phase direction");
  assert.equal(clock.tailPhaseIndex, 1);
  assert.equal(clock.resumeTail(5000), 5400);
  assert.equal(clock.advanceTail(5399), 0);
  assert.equal(clock.advanceTail(5400), 1);
  assert.equal(clock.tailPhaseIndex, 2, "tail resumes at the adjacent left apex phase");

  clock.resetTail(0, 3);
  assert.equal(clock.advanceTail(519), 0);
  assert.equal(clock.advanceTail(520), 1);
  assert.equal(clock.tailPhaseIndex, 4, "returning left-mid continues toward center");
  const nearDueClock = createAsciiMotionClock(0);
  assert.equal(nearDueClock.freezeTail(1099), 1);
  assert.equal(nearDueClock.resumeTail(2000), 2180, "settling leaves 180ms before tail motion resumes");

  assert.equal(clock.refreshFollow(1000), 3000);
  assert.equal(clock.followExpired(2999), false);
  assert.equal(clock.refreshFollow(2500), 4500, "outside motion refreshes without touching the tail");
  assert.equal(clock.tailPhaseIndex, 4);
  assert.equal(clock.followExpired(4499), false);
  assert.equal(clock.followExpired(4500), true);

  assert.equal(clock.batCoolingDown(0), false);
  clock.markBatEnded(500);
  assert.equal(clock.batCoolingDown(1599), true);
  assert.equal(clock.batCoolingDown(1600), false, "cooldown is measured from recoil completion");
});

test("classifies the foreshortened cat, glass contacts, and pointer direction", () => {
  const lines = normalizeAsciiArt(asciiPortrait);
  const frames = createAsciiFrames(asciiPortrait);
  const rightTail = frames["loaf-tail-right"].split("\n");

  assert.equal(classifyAsciiPoint(lines, 23, 28), "paw");
  assert.equal(classifyAsciiPoint(lines, 23, 40), "paw");
  assert.equal(classifyAsciiPoint(lines, 17, 22), "cat");
  assert.equal(classifyAsciiPoint(rightTail, 22, 69), "cat");
  assert.equal(classifyAsciiPoint(lines, 0, 0), "blank");
  assert.equal(classifyAsciiPoint(lines, 33, 69), "blank");
  assert.deepEqual(ASCII_GAZE_ANCHOR, { row: 20, column: 21 });
  assert.equal(directionForAsciiPoint(17, 20), "upper-left");
  assert.equal(directionForAsciiPoint(17, 21), "upper-right");
  assert.equal(directionForAsciiPoint(18, 20), "left");
  assert.equal(directionForAsciiPoint(18, 21), "right");
});

test("maps pointer movement beyond the ASCII frame so the lowered head follows departure", () => {
  assert.equal(directionForAsciiPoint(-12, -20), "upper-left");
  assert.equal(directionForAsciiPoint(-12, ASCII_COLUMNS + 20), "upper-right");
  assert.equal(directionForAsciiPoint(ASCII_ROWS + 12, -20), "left");
  assert.equal(directionForAsciiPoint(ASCII_ROWS + 12, ASCII_COLUMNS + 20), "right");
});

test("keeps a low procedural loaf above the glass while the rump-rooted tail swishes", () => {
  const frames = createAsciiFrames(asciiPortrait);
  const resting = frames["loaf-center"].split("\n");
  const silhouette = occupiedBounds(frames["loaf-center"]);
  const torso = occupiedBounds(frames["loaf-center"], 64);
  assert.equal(resting[ASCII_ANATOMY.loafPaws.left.row][ASCII_ANATOMY.loafPaws.left.column], "K");
  assert.equal(resting[ASCII_ANATOMY.loafPaws.right.row][ASCII_ANATOMY.loafPaws.right.column], "K");
  assert.ok(silhouette.width >= 54, "the full silhouette is visibly elongated");
  assert.ok(silhouette.height <= 15, "the loaf stays vertically compressed");
  assert.ok(silhouette.width / silhouette.height >= 3.6, "the loaf cannot regress to a circle");
  assert.ok(silhouette.top >= 11 && silhouette.bottom <= 24, "the cat rests low in the frame");
  assert.ok(torso.width / torso.height >= 3.3, "the torso stays elongated without its tail");
  assert.ok(
    (frames["loaf-center"].match(/[MNXK0O]/g) ?? []).length > 150,
    "the cat is modeled with procedural tonal density",
  );
  const tailFrames = TAIL_POSITIONS.map((tail) =>
    frames[tail === "center" ? "loaf-center" : `loaf-tail-${tail}`]);
  assert.equal(new Set(tailFrames).size, TAIL_POSITIONS.length, "tail has five distinct positions");
  const rootCrops = tailFrames.map((frame) => crop(frame, 10, 63, 23, 51));
  assert.equal(new Set(rootCrops).size, 1, "tail swishes only beyond a stable rump and root");
  for (let first = 0; first < tailFrames.length; first += 1) {
    for (let second = first + 1; second < tailFrames.length; second += 1) {
      const a = tailFrames[first].split("\n");
      const b = tailFrames[second].split("\n");
      const differences = [];
      for (let row = 0; row < ASCII_ROWS; row += 1) {
        for (let column = 0; column < ASCII_COLUMNS; column += 1) {
          if (a[row][column] !== b[row][column]) differences.push({ row, column });
        }
      }
      assert.ok(differences.length >= 4 && differences.length <= 60, "tail-tip motion stays bounded");
      assert.ok(
        differences.every(({ row, column }) => row >= 11 && row <= 24 && column >= 64),
        "tail-tip motion stays distal and rump-hugging",
      );
    }
  }
  const ambientDuration = ASCII_SEQUENCES.idle.reduce(
    (total, { durationMs }) => total + durationMs,
    0,
  );
  assert.equal(ambientDuration, 5780, "tail completes a weighted out-and-back swish");
  assert.deepEqual(ASCII_ANATOMY.tail.sharedSpine, [
    { row: 15, column: 56 },
    { row: 15, column: 60 },
    { row: 16, column: 63 },
  ], "the tail wraps around the outside of the rump before its tip moves");
  assert.deepEqual(ASCII_ANATOMY.tail.paths, {
    left: [
      { row: 15, column: 65 }, { row: 13, column: 67 },
      { row: 12, column: 69 }, { row: 13, column: 68 },
    ],
    "left-mid": [
      { row: 15, column: 65 }, { row: 14, column: 66 },
      { row: 13, column: 68 }, { row: 14, column: 69 }, { row: 15, column: 68 },
    ],
    center: [
      { row: 16, column: 65 }, { row: 15, column: 67 },
      { row: 16, column: 69 }, { row: 17, column: 68 },
    ],
    "right-mid": [
      { row: 17, column: 65 }, { row: 19, column: 67 },
      { row: 20, column: 69 }, { row: 19, column: 68 },
    ],
    right: [
      { row: 18, column: 65 }, { row: 20, column: 67 },
      { row: 22, column: 69 }, { row: 21, column: 68 },
    ],
  });
  for (const [tail, tip] of Object.entries(ASCII_ANATOMY.tail.tips)) {
    const frameName = tail === "center" ? "loaf-center" : `loaf-tail-${tail}`;
    const lines = frames[frameName].split("\n");
    assert.notEqual(lines[tip.row][tip.column], " ", `${tail} tail retains a visible tip`);
    const terminalRun = [...lines[tip.row].slice(66, 70)].filter((character) => character !== " ");
    assert.ok(terminalRun.length <= 3, `${tail} tail tapers instead of ending in a block`);
    assert.ok(lines.some((line) => line[69] !== " "), `${tail} tail reaches the outer column`);
    const outerColumnRun = lines.slice(11, 24).filter((line) => line[69] !== " ").length;
    assert.ok(outerColumnRun <= 2, `${tail} tail touches the edge without forming a vertical bar`);
    assert.ok(
      hasInkPath(lines, ASCII_ANATOMY.tail.root, tip, { top: 11, right: 69, bottom: 23, left: 51 }),
      `${tail} tail remains connected from rump to curled tip`,
    );
    for (let row = 11; row <= 23; row += 1) {
      const distalRun = [...lines[row].slice(66, 70)].filter((character) => character !== " ");
      assert.ok(distalRun.length <= 3, `${tail} tail has no broad vertical terminal stack`);
    }
  }
  const phaseFrames = ASCII_SEQUENCES.idle.map(({ pose }) => frames[pose]);
  for (let phase = 0; phase < phaseFrames.length; phase += 1) {
    const current = phaseFrames[phase].split("\n");
    const next = phaseFrames[(phase + 1) % phaseFrames.length].split("\n");
    let changes = 0;
    for (let row = 0; row < ASCII_ROWS; row += 1) {
      for (let column = 0; column < ASCII_COLUMNS; column += 1) {
        if (current[row][column] !== next[row][column]) changes += 1;
      }
    }
    assert.ok(changes >= 4 && changes <= 40, `tail phase ${phase} moves through an adjacent shape`);
  }
  for (const frame of Object.values(frames)) {
    assert.doesNotMatch(frame, /\(@\)=====>|\(OOO\)/, "human rig is fully superseded");
    assert.doesNotMatch(
      frame,
      /[\\/@^"'()|_=<>-]|\.------\.|o {2}o {2}o/,
      "the cat uses tonal fur without line-art or facial-cartoon markers",
    );
  }
});

test("preserves the user-approved cat core while extending only the distal tail", () => {
  const frames = createAsciiFrames(asciiPortrait);
  const approvedCoreHashes = {
    "loaf-center": "dbf61cc625cbce6ff9ba78dac750e0ce08ddfe27412f9805c634019422cbcd44",
    "track-left-center-tail": "2a5784d41a159754d9e164ad16503992479f0e53dc8b38fb20995d171bd3fe62",
    "track-right-center-tail": "4f1bc32736e5b3977b041873efabf918fe21e5cd05f9755f56f5ebbffced91fd",
    "track-upper-left-center-tail": "c8bb869ea9d0edadfc29c9d190aa5b44bc86a58dea4eee730212b7b53af4e504",
    "track-upper-right-center-tail": "6fd8806245ff4f752784cba71ddbc0e6a2b1c42f5281879cccabd52c376cdf96",
  };
  for (const [poseName, approvedHash] of Object.entries(approvedCoreHashes)) {
    assert.equal(coreHash(frames[poseName]), approvedHash, `${poseName} retains columns 0–63 exactly`);
  }
});

test("integrates two small tapered ears into the lowered head contour", () => {
  const lines = createAsciiFrames(asciiPortrait)["loaf-center"].split("\n");
  for (const [side, ear] of Object.entries(ASCII_ANATOMY.ears)) {
    assert.notEqual(lines[ear.tip.row][ear.tip.column], " ", `${side} ear has a contour tip`);
    assert.notEqual(lines[ear.root.row][ear.root.column], " ", `${side} ear joins the head`);
    assert.ok(
      hasInkPath(lines, ear.tip, ear.root, {
        top: 12,
        right: ear.window.right,
        bottom: 17,
        left: ear.window.left,
      }),
      `${side} ear remains connected rather than floating`,
    );
    const tipWidth = [...lines[ear.tip.row].slice(ear.window.left, ear.window.right + 1)]
      .filter((character) => character !== " ").length;
    const rootWidth = [...lines[ear.root.row].slice(ear.window.left, ear.window.right + 1)]
      .filter((character) => character !== " ").length;
    assert.ok(
      tipWidth >= 1 && tipWidth <= ear.maximumTipWidth,
      `${side} ear tip stays within its foreshortened contour`,
    );
    assert.ok(rootWidth >= tipWidth, `${side} ear widens naturally into the head`);
  }
});

test("turns the whole featureless lowered head toward every pointer quadrant", () => {
  const frames = createAsciiFrames(asciiPortrait);
  const neutral = frames["loaf-tail-left"].split("\n");
  const headFrames = new Set();

  for (const direction of BAT_DIRECTIONS) {
    const anatomy = ASCII_ANATOMY.contact[direction];
    const tracking = frames[anatomy.gazePose].split("\n");
    let changedCells = 0;
    let boundaryChanges = 0;
    let neutralInk = 0;
    let trackingInk = 0;
    const changedRows = new Set();
    const changedColumns = new Set();
    const headRows = [];
    for (let row = ASCII_ANATOMY.head.top; row <= ASCII_ANATOMY.head.bottom; row += 1) {
      const slice = tracking[row].slice(ASCII_ANATOMY.head.left, ASCII_ANATOMY.head.right + 1);
      headRows.push(slice);
      for (let column = ASCII_ANATOMY.head.left; column <= ASCII_ANATOMY.head.right; column += 1) {
        if (neutral[row][column] !== " ") neutralInk += 1;
        if (tracking[row][column] !== " ") trackingInk += 1;
        if (tracking[row][column] !== neutral[row][column]) {
          changedCells += 1;
          changedRows.add(row);
          changedColumns.add(column);
          if ((tracking[row][column] === " ") !== (neutral[row][column] === " ")) {
            boundaryChanges += 1;
          }
        }
      }
    }
    assert.ok(changedCells >= 40, `${direction} visibly turns the whole lowered head mass`);
    assert.ok(changedRows.size >= 9, `${direction} turn spans the head vertically`);
    assert.ok(changedColumns.size >= 18, `${direction} turn spans the head laterally`);
    assert.ok(boundaryChanges >= 6, `${direction} changes the silhouette, not only fur texture`);
    assert.ok(
      Math.abs(trackingInk - neutralInk) / neutralInk <= 0.1,
      `${direction} preserves head volume while turning`,
    );
    const headFrame = headRows.join("\n");
    assert.match(headFrame, /^[ .,:;clodxkO0KXNM\n]+$/, `${direction} uses only tonal fur marks`);
    headFrames.add(headFrame);
  }

  assert.equal(headFrames.size, BAT_DIRECTIONS.length, "each direction has distinct head geometry");
});

test("bats from an attached foreleg with a compact glass contact", () => {
  const frames = createAsciiFrames(asciiPortrait);
  for (const direction of BAT_DIRECTIONS) {
    const anatomy = ASCII_ANATOMY.contact[direction];
    const contactLines = frames[anatomy.pose].split("\n");
    assert.equal(contactLines[anatomy.paw.row][anatomy.paw.column], "K", `${direction} contact pad`);
    assert.ok(
      ASCII_SEQUENCES.bat[direction].some(({ pose }) => pose === anatomy.pose),
      `${direction} contact is part of its bat`,
    );
    const shoulderSide = direction.endsWith("left") ? "left" : "right";
    const shoulder = ASCII_ANATOMY.shoulders[shoulderSide];
    assert.match(
      contactLines[shoulder.row][shoulder.column],
      /[.,:;clodxkO0KXNM]/,
      `${direction} limb remains attached through tonal fur`,
    );
  }
});

test("places each bat contact at the pointer instead of a fixed quadrant endpoint", () => {
  const targets = [
    { row: 0, column: 0 },
    { row: 0, column: ASCII_COLUMNS - 1 },
    { row: ASCII_ROWS - 1, column: 0 },
    { row: ASCII_ROWS - 1, column: ASCII_COLUMNS - 1 },
    { row: 0, column: 34 },
    { row: 17, column: 0 },
    { row: 17, column: ASCII_COLUMNS - 1 },
    { row: ASCII_ROWS - 1, column: 34 },
    { row: 8, column: 14 },
    { row: 12, column: 50 },
    { row: 21, column: 18 },
    { row: 25, column: 54 },
  ];

  for (const target of targets) {
    const direction = directionForAsciiPoint(target.row, target.column);
    const frames = createAsciiTargetedBatFrames(
      asciiPortrait,
      direction,
      target.row,
      target.column,
    );
    const contact = frames[`bat-${direction}-contact`].split("\n");
    assert.equal(contact[target.row][target.column], "K", `${direction} reaches the pointer`);
    for (const [poseName, frame] of Object.entries(frames)) {
      const lines = frame.split("\n");
      assert.equal(lines.length, ASCII_ROWS, `${poseName} preserves target-frame rows`);
      assert.ok(lines.every((line) => line.length === ASCII_COLUMNS), `${poseName} preserves columns`);
    }
    const miniContact = frames[`bat-${direction}-mini-contact`].split("\n");
    let nearbyMiniContact = false;
    for (let row = Math.max(0, target.row - 2); row <= Math.min(ASCII_ROWS - 1, target.row + 2); row += 1) {
      for (let column = Math.max(0, target.column - 2);
        column <= Math.min(ASCII_COLUMNS - 1, target.column + 2);
        column += 1) {
        if (miniContact[row][column] === "K") nearbyMiniContact = true;
      }
    }
    assert.ok(nearbyMiniContact, `${direction} mini contact stays within two cells of the pointer`);
  }
});

test("keeps the tail planted while every directional paw bats and settles", () => {
  for (const direction of BAT_DIRECTIONS) {
    for (const tail of TAIL_POSITIONS) {
      const frames = createAsciiTargetedBatFrames(asciiPortrait, direction, 30, 35, tail);
      const tailCrops = Object.values(frames).map((frame) => crop(frame, 10, 69, 20, 51));
      assert.equal(
        new Set(tailCrops).size,
        1,
        `${direction} bat freezes the ${tail} tail through recoil and settle`,
      );
    }
  }
});

test("builds readable deterministic bats with zero through three natural follow-up taps", () => {
  assert.deepEqual([...new Set(ASCII_MINI_BAT_PATTERN)].sort(), [0, 1, 2, 3]);
  assert.equal(ASCII_MINI_BAT_PATTERN[0], 0, "the first interaction is a clean single bat");
  assert.deepEqual(ASCII_INTERACTION_TIMING, {
    movementThreshold: 16,
    dwellMs: 520,
    cooldownMs: 1100,
    followMs: 2000,
    settleMs: 190,
  });

  for (const direction of BAT_DIRECTIONS) {
    for (let ordinal = 0; ordinal < ASCII_MINI_BAT_PATTERN.length; ordinal += 1) {
      const sequence = createAsciiBatSequence(direction, ordinal);
      assert.deepEqual(
        sequence,
        createAsciiBatSequence(direction, ordinal),
        `${direction}.${ordinal} is deterministic`,
      );
      assert.equal(sequence[0].pose, `bat-${direction}-ready`);
      assert.equal(sequence.at(-1).pose, `bat-${direction}-recoil`);
      assert.deepEqual(
        sequence.slice(0, 3).map(({ durationMs }) => durationMs),
        [105, 115, 165],
        `${direction}.${ordinal} keeps a readable ready/reach/contact cadence`,
      );
      assert.equal(sequence.at(-1).durationMs, 145, `${direction}.${ordinal} has a readable recoil`);
      assert.equal(
        sequence.filter(({ pose }) => pose.includes("contact")).length,
        1 + ASCII_MINI_BAT_PATTERN[ordinal],
        `${direction}.${ordinal} contact count`,
      );
      for (const { pose, durationMs } of sequence) {
        if (pose.endsWith("mini-in")) assert.ok(durationMs >= 80 && durationMs <= 100);
        if (pose.endsWith("mini-contact")) assert.ok(durationMs >= 95 && durationMs <= 115);
      }
      const totalDuration = sequence.reduce((total, { durationMs }) => total + durationMs, 0);
      assert.ok(totalDuration >= 530 && totalDuration <= 1115, `${direction}.${ordinal} stays readable`);
      for (let index = 1; index < sequence.length; index += 1) {
        assert.notEqual(sequence[index].pose, sequence[index - 1].pose, "adjacent paw poses differ");
      }
      const representativeTarget = ASCII_ANATOMY.contact[direction].paw;
      const representativeFrames = createAsciiTargetedBatFrames(
        asciiPortrait,
        direction,
        representativeTarget.row,
        representativeTarget.column,
      );
      for (let index = 1; index < sequence.length; index += 1) {
        assert.notEqual(
          representativeFrames[sequence[index].pose],
          representativeFrames[sequence[index - 1].pose],
          `${direction}.${ordinal} adjacent rendered paw frames differ`,
        );
      }
    }
  }
});

test("renders document metadata", async () => {
  const { response, html } = await render("/");

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(html, /<title>hah\.dev<\/title>/);
});

test("renders the ASCII character accessibly before client hydration", async () => {
  const { html } = await render("/");

  assert.match(html, /data-ascii-character="glass-table-cat"/);
  assert.match(html, /data-ascii-interaction="pointer-bat"/);
  assert.match(html, /data-ascii-frame="loaf-center"/);
  assert.match(html, /role="img"/);
  assert.ok(html.includes(`aria-label="${ASCII_CHARACTER_DESCRIPTION}"`));
  assert.match(html, /<pre[^>]*aria-hidden="true"/);
  assert.match(html, /<pre[^>]*style="[^"]*line-height:1\.05/);
});

test("renders every primary state from the one index-owned shell", async () => {
  const states = [
    ["/", "home", "Yes, my initials spell"],
    ["/?view=resume", "resume", "Resume"],
    ["/?view=tools", "tools", "Tools"],
    ["/?view=shelf", "shelf", "Shelf"],
  ];

  for (const [pathname, view, heading] of states) {
    const { response, html } = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(html, new RegExp(`<h1[^>]*>[^<]*${heading}`, "i"), pathname);
    assert.match(html, /data-portfolio-shell="true"/, `${pathname} index shell`);
    assert.match(html, new RegExp(`data-active-view="${view}"`), `${pathname} active state`);
    assert.match(html, new RegExp(`<main[^>]*data-page-view="${view}"`), `${pathname} view identity`);
  }

  for (const pathname of ["/resume", "/tools", "/shelf"]) {
    const { response } = await render(pathname);
    assert.equal(response.status, 404, `${pathname} is no longer a separate route document`);
  }
});

test("centers one shared state map without restoring the superseded redesign", async () => {
  const states = [
    ["/", "Home"],
    ["/?view=resume", "Resume"],
    ["/?view=tools", "Tools"],
    ["/?view=shelf", "Shelf"],
  ];
  const expectedLinks = [
    ["/#home", "Home"],
    ["/#resume", "Resume"],
    ["/#tools", "Tools"],
    ["/#shelf", "Shelf"],
  ];

  for (const [pathname, currentLabel] of states) {
    const { html } = await render(pathname);
    assert.match(html, /class="navbar navbar-expand navbar-light bg-light site-header"/);
    assert.match(html, /<a class="navbar-brand" href="\/#home">HAH<\/a>/);
    assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1, `${pathname} has one current view`);
    assert.match(
      html,
      new RegExp(`<a class="nav-link" href="[^"]*" aria-current="page"><span class="signal-fuzz signal-fuzz--nav">${currentLabel}</span>`),
      `${pathname} identifies ${currentLabel}`,
    );
    const renderedLinks = [...html.matchAll(
      /<a class="nav-link" href="(\/#(?:home|resume|tools|shelf))"(?: aria-current="page")?><span class="signal-fuzz signal-fuzz--nav">(Home|Resume|Tools|Shelf)<\/span>/g,
    )].map((match) => [match[1], match[2]]);
    assert.deepEqual(renderedLinks, expectedLinks, `${pathname} retains the four state links in order`);
    assert.equal(
      (html.match(/class="signal-fuzz signal-fuzz--nav"/g) ?? []).length,
      currentLabel === "Shelf" ? 5 : 4,
      `${pathname} textures every green or gray navigation label`,
    );
    assert.doesNotMatch(
      html,
      /site-chrome|site-nav-map|branch-lead|branch-return|index-directory|Continue from the index/,
      `${pathname} contains no redesign shell`,
    );
  }

  const { html: resume } = await render("/?view=resume");
  assert.doesNotMatch(resume, /Hayden Howard’s experience, education, projects/);
  assert.match(resume, /<h1[^>]*>Resume<\/h1>/);

  const shellSource = await readFile(new URL("../app/components/PortfolioShell.tsx", import.meta.url), "utf8");
  const chromeSource = await readFile(new URL("../app/components/SiteChrome.tsx", import.meta.url), "utf8");
  assert.match(shellSource, /useState<PortfolioView>\(initialView\)/);
  assert.match(shellSource, /window\.addEventListener\("hashchange", synchronizeView\)/);
  assert.match(shellSource, /window\.addEventListener\("popstate", synchronizeView\)/);
  assert.match(shellSource, /activeView === "resume" \? <ResumeView \/>/);
  assert.match(shellSource, /activeView === "tools" \? <ToolsView \/>/);
  assert.match(shellSource, /activeView === "home" \? <HomeView \/>/);
  assert.doesNotMatch(chromeSource, /next\/link|href: "\/(?:resume|tools|shelf)"/);
});

test("keeps every page's information intact while its view sprouts from the index", async () => {
  const approvedMainCopy = {
    "/": [1771, "379a2291b5b9c898b16542d53e3647f60a6b25425b745fa76f28e487327a0a70"],
    "/?view=resume": [5843, "ab7ffcf20d5a2478de5867e75f2f13f71ca110ae5d950258f5eb51ffa0f53b39"],
    "/?view=tools": [822, "f95964d9567ab733bbb9e14be3d80b68033f3b49c6100c2e807a885f598e02bc"],
    "/?view=shelf": [6785, "c1b29d690c2d6cf7eb3f62015f23e2fe8a998ddcc641e9b1fd16f7e1b205a973"],
  };

  for (const [pathname, [approvedLength, approvedHash]] of Object.entries(approvedMainCopy)) {
    const { html } = await render(pathname);
    const semanticText = semanticMainText(html);
    assert.equal(semanticText.length, approvedLength, `${pathname} visible copy length`);
    assert.equal(
      createHash("sha256").update(semanticText).digest("hex"),
      approvedHash,
      `${pathname} visible copy`,
    );
  }

  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.site-header\.bg-light \{[\s\S]*?background-color: transparent !important/);
  assert.match(
    css,
    /@media \(max-width: 991\.98px\) \{[\s\S]*?\.site-header \{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)/,
    "mobile uses the same left-brand and centered-route navigation structure as desktop",
  );
  assert.match(
    css,
    /@media \(max-width: 991\.98px\) \{[\s\S]*?\.site-header \.navbar-nav \{[\s\S]*?flex-direction: row;[\s\S]*?gap: clamp/,
    "mobile keeps the route map as one centered horizontal group",
  );
  assert.match(
    css,
    /@media \(max-width: 991\.98px\) \{[\s\S]*?\.nav-link\[aria-current="page"\]::after \{[\s\S]*?height: 1px/,
    "mobile retains the desktop current-route underline",
  );
  assert.match(
    css,
    /@media \(max-width: 991\.98px\) \{[\s\S]*?\.dropdown \.dropdown-menu \{[\s\S]*?max-width: calc\(100vw - \(2 \* var\(--site-header-gutter\)\)\);[\s\S]*?overflow-y: auto;[\s\S]*?width: min\(20rem,/,
    "mobile Shelf search keeps every field inside a complete scrollable panel",
  );
  assert.match(css, /@media \(min-width: 992px\)[\s\S]*?\.site-header \{[\s\S]*?background-color: transparent !important/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
  assert.match(css, /\.site-header \.navbar-nav > \.dropdown \{[\s\S]*?position: absolute;[\s\S]*?right: var\(--site-header-gutter\)/);
  assert.match(css, /\.site-header \.navbar-nav > \.dropdown \{[\s\S]*?z-index: 2/);
  assert.match(css, /#ascii pre \{[\s\S]*?overflow: visible/);
  assert.match(css, /#ascii \{[\s\S]*?container-type: inline-size/);
  assert.match(css, /@media \(max-width: 991\.98px\) \{[\s\S]*?#ascii pre \{[\s\S]*?font-size: min\(14px, 2cqw\)/);
  assert.match(css, /@media \(min-width: 992px\) \{[\s\S]*?#ascii \{[\s\S]*?padding-inline: 15px 0/);
  const asciiSource = await readFile(new URL("../app/components/AsciiArt.tsx", import.meta.url), "utf8");
  assert.match(asciiSource, /desktopLayout = window\.matchMedia\("\(min-width: 992px\)"\)\.matches/);
  assert.match(asciiSource, /availableWidth = Math\.max\(0, host\.clientWidth \* 0\.98\)/);
  assert.match(asciiSource, /Math\.min\(14, \(availableWidth \/ referenceWidth\) \* 100\)/);
  assert.match(asciiSource, /pageSafeWidth = Math\.min\(availableWidth, pageBoundaryWidth\)/);
  assert.match(asciiSource, /pageSafeWidth[\s\S]*?intendedFontSize = \(container\.clientWidth \/ ASCII_COLUMNS\) \* 1\.82/);
  assert.match(asciiSource, /intendedFontSize \* Math\.min\(1, pageSafeWidth \/ intendedWidth\)/);
  assert.match(asciiSource, /observer\.observe\(host\)/);
  assert.match(
    css,
    /@media \(min-width: 992px\) \{[\s\S]*?\.container-vertical-center \{[\s\S]*?min-height: 100vh/,
    "the home hero retains its original full-height desktop composition",
  );
  assert.match(
    css,
    /\.container-vertical-center > \.row \{[\s\S]*?flex: 1 1 100%;[\s\S]*?width: 100%/,
    "the home text and cat use the full desktop composition instead of shrink-wrapping",
  );
  assert.doesNotMatch(
    css,
    /\.page-view \.container-vertical-center/,
    "the sprout shell must not compress the original home text or cat",
  );
  assert.match(css, /\.page-view:not\(\.page-view--home\) p,/);
  assert.doesNotMatch(
    css,
    /animation: page-view-sprout[^;]*\bboth\b/,
    "the completed sprout must not leave a transformed containing block around fixed modals",
  );
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.page-view \{[\s\S]*?animation: none/);
});

test("places progressively disclosed skill bullets between projects and experience", async () => {
  const { html } = await render("/?view=resume");
  const projectsIndex = html.indexOf('id="projects-title"');
  const skillStacksIndex = html.indexOf('id="skill-stacks-title"');
  const timelineIndex = html.indexOf(">Timeline</h2>");

  assert.ok(projectsIndex >= 0, "Projects heading renders");
  assert.ok(skillStacksIndex > projectsIndex, "Skill Stacks follows Projects");
  assert.ok(timelineIndex > skillStacksIndex, "experience follows Skill Stacks");
  assert.equal((html.match(/class="skill-stack-disclosure"/g) ?? []).length, 7);
  assert.equal((html.match(/<summary aria-label="[^"]+ skills">Skills<\/summary>/g) ?? []).length, 7);
  assert.equal(
    (html.match(/<details class="skill-stack-disclosure"><summary[^>]*>Skills<\/summary><ul>/g) ?? []).length,
    7,
    "only each card's bullet list is progressively disclosed",
  );
  assert.match(html, />Continuous Integration and Deployment \(CI\/CD\)<\/li>/);
  assert.match(html, />Three\.js<\/li>/);
  assert.match(html, />IndexedDB<\/li>/);
  assert.match(html, />Threat Modeling<\/li>/);

  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.skill-stack-disclosure > summary \{[\s\S]*?cursor: pointer/);
  assert.match(css, /@media print \{[\s\S]*?\.skill-stack-disclosure:not\(\[open\]\) > ul \{[\s\S]*?display: block !important/);
});

test("applies equal subtle film grain and weave inside red, green, blue, gray, and cat glyphs and vectors", async () => {
  const [{ html: home }, { html: resume }, { html: tools }] = await Promise.all([
    render("/"),
    render("/?view=resume"),
    render("/?view=tools"),
  ]);

  assert.match(home, /class="pulse-effect text-center"[^>]*id="qa-title"|id="qa-title"[^>]*class="pulse-effect text-center"/);
  assert.match(home, /<span class="signal-fuzz signal-fuzz--pulse">Q &amp; A<\/span>/);
  assert.match(home, /<pre[^>]*class="signal-fuzz signal-fuzz--ascii"/);
  assert.match(resume, /class="text-red text-center signal-fuzz"/);
  assert.match(resume, /class="signal-fuzz" href="https:\/\/chorus\.observer\/">CHORUS<\/a>/);
  assert.match(tools, /class="tool-icon signal-fuzz"/);
  const homeDocument = home.split('<script id="_R_">')[0];
  const resumeDocument = resume.split('<script id="_R_">')[0];
  assert.equal((homeDocument.match(/signal-fuzz signal-fuzz--nav/g) ?? []).length, 4);
  assert.equal((resumeDocument.match(/signal-fuzz signal-fuzz--nav/g) ?? []).length, 4);

  const resumeExperience = await readFile(new URL("../app/resume/ResumeExperience.tsx", import.meta.url), "utf8");
  for (const circle of ["circle-1", "circle-2", "circle-3"]) {
    assert.match(resumeExperience, new RegExp(`className="${circle}"`));
  }
  assert.match(resumeExperience, /timeline-icon signal-fuzz/);
  assert.match(resumeExperience, /label text-blue signal-fuzz/);
  assert.match(resumeExperience, /label text-red signal-fuzz/);
  assert.match(resumeExperience, /label text-secondary signal-fuzz/);
  assert.match(resumeExperience, /className="circular-chart signal-fuzz"/);
  assert.doesNotMatch(resumeExperience, /circular-chart-film-host|ChorusFilm/);

  for (const html of [home, resume, tools]) {
    assert.match(html, /class="signal-fuzz-defs"/);
    assert.match(html, /<feTurbulence/);
    assert.match(html, /<feComposite[^>]*in2="SourceAlpha"[^>]*operator="in"/);
    assert.doesNotMatch(html, /chorus-film/);
  }

  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const filterSource = await readFile(new URL("../app/components/SignalFuzz.tsx", import.meta.url), "utf8");
  assert.match(filterSource, /id="signal-film-grain-static"/);
  assert.match(filterSource, /id="signal-film-grain" animated/);
  assert.match(filterSource, /x="-10%"[\s\S]*?y="-10%"[\s\S]*?width="120%"[\s\S]*?height="120%"/);
  assert.doesNotMatch(filterSource, /x="0%"[\s\S]*?y="0%"[\s\S]*?width="100%"[\s\S]*?height="100%"/);
  assert.match(filterSource, /type="fractalNoise"/);
  assert.match(filterSource, /baseFrequency="0\.38 0\.54"/);
  assert.match(filterSource, /numOctaves="2"/);
  assert.match(filterSource, /stitchTiles="stitch"/);
  assert.match(filterSource, /attributeName="seed"[\s\S]*?values="11;23;37;53;11"[\s\S]*?dur="\.48s"/);
  assert.match(filterSource, /<feOffset in="grain" dx="0" dy="0" result="woven-grain">/);
  assert.match(filterSource, /attributeName="dx"[\s\S]*?values="0;\.32;-\.26;\.18;0"/);
  assert.match(filterSource, /attributeName="dy"[\s\S]*?values="0;-\.36;\.44;-\.28;0"/);
  assert.match(filterSource, /dur="7\.6s"[\s\S]*?calcMode="spline"/);
  assert.match(filterSource, /\.2126 \.7152 \.0722 0 0/);
  assert.match(filterSource, /<feComponentTransfer in="grain-luminance" result="subtle-grain">/);
  assert.match(filterSource, /<feFuncA type="linear" slope="\.08" intercept="\.008"/);
  assert.doesNotMatch(filterSource, /type="discrete"|tableValues|snow|crisp|feDisplacementMap|feGaussianBlur/i);
  assert.match(filterSource, /in2="SourceAlpha"/);
  assert.match(filterSource, /result="clipped-grain"/);
  assert.match(filterSource, /<feBlend[\s\S]*?in="SourceGraphic"[\s\S]*?in2="clipped-grain"[\s\S]*?mode="soft-light"/);

  const grainUrls = [...css.matchAll(
    /--signal-grain-[1-4]: url\("(data:image\/png;base64,[^"]+)"\)/g,
  )].map((match) => match[1]);
  assert.equal(grainUrls.length, 4, "four dense film-grain frames are embedded");
  assert.equal(
    new Set(grainUrls.map((url) => createHash("sha256").update(url).digest("hex"))).size,
    4,
    "grain frames are distinct",
  );
  for (const grainUrl of grainUrls) {
    const { width, height, pixels } = decodeRgbaPng(grainUrl);
    assert.deepEqual([width, height], [64, 64]);
    const luminance = [];
    const alpha = [];
    for (let index = 0; index < pixels.length; index += 4) {
      luminance.push(pixels[index]);
      alpha.push(pixels[index + 3]);
      assert.equal(pixels[index], pixels[index + 1], "grain remains neutral");
      assert.equal(pixels[index], pixels[index + 2], "grain remains neutral");
    }
    assert.ok(new Set(luminance).size >= 12, "grain has continuous tonal variation");
    assert.ok(new Set(alpha).size >= 8, "grain has graduated low alpha");
    assert.ok(alpha.every((value) => value > 0), "grain is dense rather than isolated snow");
    assert.ok(Math.max(...alpha) <= 22, "grain never becomes high contrast");
    assert.ok(Math.max(...luminance) < 255, "grain contains no pure-white flecks");
  }

  assert.match(css, /@supports \(\(-webkit-background-clip: text\) or \(background-clip: text\)\)/);
  assert.match(css, /\.signal-fuzz:not\(svg\) \{[\s\S]*?background-clip: text;[\s\S]*?background-color: currentColor;[\s\S]*?background-size: 64px 64px/);
  assert.doesNotMatch(css, /image-rendering:\s*(?:crisp-edges|pixelated)/);
  assert.match(css, /svg\.signal-fuzz,[\s\S]*?\.signal-fuzz svg \{\s*filter: url\("#signal-film-grain-static"\)/);
  assert.match(css, /signal-film-grain-frame \.48s steps\(1, end\) infinite/);
  assert.match(css, /signal-film-weave 7\.6s cubic-bezier\(\.37, 0, \.63, 1\) infinite/);
  assert.match(css, /svg\.signal-fuzz,[\s\S]*?\.signal-fuzz svg \{\s*filter: url\("#signal-film-grain"\)/);
  assert.doesNotMatch(css, /\.circle-[123][^{]*\{[^}]*filter:/);
  assert.doesNotMatch(css, /\.circle-background,[\s\S]{0,120}filter: url\("#signal-film-grain/);
  assert.doesNotMatch(css, /\.signal-fuzz\.signal-fuzz--nav \{\s*background-image: none/);
  assert.doesNotMatch(css, /signal-snow|signal-fuzz-text-shift|signal-fuzz-vector-shift|chorus-film|radial-gradient\(circle at \.8px \.7px|repeating-radial-gradient\(circle at 23% 34%/);
  assert.doesNotMatch(css, /\.signal-fuzz(?:::before|::after)/);
  const weave = css.match(/@keyframes signal-film-weave \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const weaveOffsets = [...weave.matchAll(/(-?\d*\.?\d+)px\s+(-?\d*\.?\d+)px/g)];
  assert.ok(weaveOffsets.length >= 3, "film weave authors several irregular subpixel positions");
  for (const [, horizontal, vertical] of weaveOffsets) {
    assert.ok(Math.abs(Number(horizontal)) <= 0.5);
    assert.ok(Math.abs(Number(vertical)) <= 0.5);
  }
  const textFuzzBlocks = [...css.matchAll(/\.signal-fuzz:not\(svg\) \{([\s\S]*?)\n\s*\}/g)];
  for (const [, textFuzzBlock] of textFuzzBlocks) {
    assert.doesNotMatch(
      textFuzzBlock,
      /^\s*(?:position|inset|width|height|margin(?:-[\w-]+)?|font(?:-[\w-]+)?|letter-spacing|word-spacing|line-height|white-space|text-transform|tab-size|display|padding(?:-[\w-]+)?|border(?:-[\w-]+)?|transform|translate|opacity|text-shadow)\s*:/m,
    );
  }
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*?background-image: none !important/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*?background-color: transparent !important/);
  assert.match(css, /@media \(forced-colors: active\)[\s\S]*?filter: none !important/);
});

test("renders current projects and consistent project documentation icons", async () => {
  const { html } = await render("/?view=resume");

  assert.match(html, /class="bi bi-pen-fill"/);
  assert.match(
    html,
    /aria-haspopup="dialog"[^>]*aria-controls="lattice-demo-dialog"[^>]*>Lattice<\/button>/,
  );
  assert.match(
    html,
    /Lattice turns linguistic register into an explicit, testable system\./,
  );
  assert.match(html, /<summary>Read me<\/summary>/);
  assert.match(
    html,
    /It separates meaning from expression by decomposing content into semantic atoms that candidate prose must preserve\./,
  );
  assert.match(
    html,
    /href="https:\/\/github\.com\/howardhayden\/lattice"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*aria-label="Documentation for Lattice, opens in a new tab"/,
  );
  assert.match(html, /href="https:\/\/chorus\.observer\/">CHORUS<\/a>/);
  assert.match(
    html,
    /Social simulation of influence, uncertainty, and collective belief\./,
  );
  assert.match(html, /href="https:\/\/chorus\.observer\/notebooks\/"/);
  assert.match(html, /href="https:\/\/inkeep\.ing\/">IN KEEPING<\/a>/);
  assert.equal((html.match(/class="bi bi-bricks"/g) ?? []).length, 1);
  assert.match(
    html,
    /Local-first library continuity lab with user-created workspaces, explicit persistence, integrity-linked revisions, structured safeguards, and notebooks\. Models dependencies and access paths; records custody, fixity, rights, metadata, conditions, decisions, and recovery actions; preserves provenance and continuity through disruption and handoff\./,
  );
  assert.match(
    html,
    /href="https:\/\/inkeep\.ing\/\?view=reports"[^>]*aria-label="Technical report for IN KEEPING, opens in a new tab"/,
  );
  assert.match(
    html,
    /href="https:\/\/inkeep\.ing\/\?view=reports"[^>]*aria-label="Public notice for IN KEEPING, opens in a new tab"/,
  );
  assert.equal((html.match(/class="bi bi-backpack4"/g) ?? []).length, 5);
});

test("implements the bounded and accessible Lattice dialog contract", async () => {
  const source = await readFile(
    new URL("../app/resume/ResumeProjects.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby="lattice-demo-title"/);
  assert.match(source, /aria-describedby="lattice-demo-description"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /countLatticeCharacters\(value\) > LATTICE_INPUT_LIMIT/);
  assert.match(source, /Lattice-icized text/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
});

test("renders shelf records before client hydration", async () => {
  const { html } = await render("/?view=shelf");
  const searchFields = [...html.matchAll(
    /<label for="([^"]+)">([^<]+)<\/label><input type="text"[^>]*id="\1"[^>]*placeholder="([^"]+)"/g,
  )].map((match) => [match[1], match[2], match[3]]);
  assert.deepEqual(searchFields, [
    ["languageInput", "Language", " Search Language"],
    ["publisherInput", "Search Publisher", " Search Publisher"],
    ["authorInput", "Search Author", " Search Author"],
    ["collectionInput", "Search Collection", " Search Collection"],
  ]);
  assert.match(html, /aria-label="30 shelf results"/);
  assert.equal((html.match(/<article class="card">/g) ?? []).length, 30);
  assert.match(html, /Ethical Machines/i);
  assert.match(html, /20 Sep 2022/);
  assert.match(html, />1859</);
  assert.match(html, />180 C\.E\.<\/dd>/);
  assert.match(html, /Orb: On the Movements of the Earth/i);
});

test("filters and visibly rearranges Shelf in one deterministic input revision", () => {
  const fixture = [
    { title: "Alpha", languages: ["English"], publishers: ["One"], authors: ["A"], collections: ["Technology"] },
    { title: "Bravo", languages: ["English"], publishers: ["Two"], authors: ["B"], collections: ["Technology"] },
    { title: "Charlie", languages: ["Spanish"], publishers: ["One"], authors: ["C"], collections: ["Technology"] },
    { title: "Delta", languages: ["English"], publishers: ["One"], authors: ["D"], collections: ["History"] },
  ];
  const sourceOrder = fixture.map(({ title }) => title);
  const emptyFilters = { language: "", publisher: "", author: "", collection: "" };

  assert.deepEqual(
    filterShelfPapers(fixture, { ...emptyFilters, language: "ENGL", publisher: "one" }).map(({ title }) => title),
    ["Alpha", "Delta"],
    "filters remain case-insensitive and combine fields with AND semantics",
  );
  assert.deepEqual(
    shuffleShelfPapers(fixture, 42).map(({ title }) => title),
    shuffleShelfPapers(fixture, 42).map(({ title }) => title),
    "a revision seed has one reproducible arrangement",
  );

  let previousOrder = [];
  for (const [index, collection] of ["t", "te", "tec", "tech"].entries()) {
    const arranged = arrangeShelfPapers(
      fixture,
      { ...emptyFilters, collection },
      index + 1,
      previousOrder,
    );
    const titles = arranged.map(({ title }) => title);
    const expected = filterShelfPapers(fixture, { ...emptyFilters, collection }).map(({ title }) => title).sort();
    assert.deepEqual([...titles].sort(), expected, `${collection} filters and arranges the same committed result`);
    if (previousOrder.length === titles.length && titles.length > 1) {
      assert.notDeepEqual(titles, previousOrder, `${collection} visibly rearranges on this character input`);
    }
    previousOrder = titles;
  }

  assert.deepEqual(fixture.map(({ title }) => title), sourceOrder, "arrangement never mutates source records");
  assert.deepEqual(
    arrangeShelfPapers(fixture, { ...emptyFilters, author: "missing" }, 9),
    [],
    "zero-match filters stay empty",
  );
});

test("produces a complete static Pages artifact", async () => {
  const routes = ["index.html", "404.html"];

  for (const route of routes) {
    const html = await readFile(new URL(`../site/${route}`, import.meta.url), "utf8");
    assert.match(html, /<!DOCTYPE html>/i, route);
  }

  for (const supersededRoute of ["resume/index.html", "tools/index.html", "shelf/index.html"]) {
    await assert.rejects(
      readFile(new URL(`../site/${supersededRoute}`, import.meta.url), "utf8"),
      { code: "ENOENT" },
      `${supersededRoute} is not emitted as a separate document`,
    );
  }

  const cname = await readFile(new URL("../site/CNAME", import.meta.url), "utf8");
  assert.equal(cname.trim(), "hah.dev");
});
