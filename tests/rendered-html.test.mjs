import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
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

test("renders every primary route with its page heading", async () => {
  const routes = [
    ["/", "Yes, my initials spell", "hah.dev"],
    ["/resume", "Resume", "Resume | hah.dev."],
    ["/tools", "Tools", "Tools | hah.dev."],
    ["/shelf", "Shelf", "Shelf | hah.dev."],
  ];

  for (const [pathname, heading, title] of routes) {
    const { response, html } = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(html, new RegExp(`<h1[^>]*>[^<]*${heading}`, "i"), pathname);
    assert.ok(html.includes(`<title>${title}</title>`), `${pathname} title`);
  }
});

test("preserves the original visual shell and page copy", async () => {
  for (const pathname of ["/", "/resume", "/tools", "/shelf"]) {
    const { html } = await render(pathname);
    assert.match(html, /class="navbar navbar-expand navbar-light bg-light"/);
    assert.match(html, /<a href="\/" class="navbar-brand">HAH<\/a>/);
    assert.doesNotMatch(
      html,
      /site-chrome|site-nav-map|branch-lead|branch-return|index-directory|Continue from the index/,
      `${pathname} contains no redesign shell`,
    );
  }

  const { html: resume } = await render("/resume");
  assert.doesNotMatch(resume, /Hayden Howard’s experience, education, projects/);
  assert.match(resume, /<h1[^>]*>Resume<\/h1>/);
});

test("renders CHORUS and consistent project documentation icons", async () => {
  const { html } = await render("/resume");

  assert.match(html, /href="https:\/\/chorus\.observer\/">CHORUS<\/a>/);
  assert.match(
    html,
    /Social simulation of influence, uncertainty, and collective belief\./,
  );
  assert.match(html, /href="https:\/\/chorus\.observer\/notebooks\/"/);
  assert.equal((html.match(/class="bi bi-backpack4"/g) ?? []).length, 2);
});

test("renders shelf records before client hydration", async () => {
  const { html } = await render("/shelf");
  assert.equal((html.match(/<article class="card">/g) ?? []).length, 30);
  assert.match(html, /Ethical Machines/i);
  assert.match(html, /20 Sep 2022/);
  assert.match(html, />1859</);
  assert.match(html, />180 C\.E\.<\/dd>/);
  assert.match(html, /Orb: On the Movements of the Earth/i);
});

test("produces a complete static Pages artifact", async () => {
  const routes = ["index.html", "resume/index.html", "tools/index.html", "shelf/index.html", "404.html"];

  for (const route of routes) {
    const html = await readFile(new URL(`../site/${route}`, import.meta.url), "utf8");
    assert.match(html, /<!DOCTYPE html>/i, route);
  }

  const cname = await readFile(new URL("../site/CNAME", import.meta.url), "utf8");
  assert.equal(cname.trim(), "hah.dev");
});
