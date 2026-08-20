import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ASCII_ANATOMY,
  ASCII_COLUMNS,
  ASCII_GAZE_ANCHOR,
  ASCII_POSES,
  ASCII_ROWS,
  ASCII_SEQUENCES,
  asciiPortrait,
  classifyAsciiPoint,
  createAsciiFrames,
  directionForAsciiPoint,
  normalizeAsciiArt,
  validateAsciiCharacterDefinition,
} from "../app/components/asciiCharacter.js";

const SWAT_DIRECTIONS = ["left", "right", "upper-left", "upper-right"];

function articulatedPoseNames() {
  return new Set([
    ...Object.values(ASCII_SEQUENCES.swat).flatMap((sequence) =>
      sequence.map(({ pose }) => pose),
    ),
    ...Object.values(ASCII_SEQUENCES.recover).flatMap((sequence) =>
      sequence
        .map(({ pose }) => pose)
        .filter((pose) => pose.startsWith("recover-")),
    ),
  ]);
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

test("authors notice, swat, and recovery sequences for all four directions", () => {
  const expected = [...SWAT_DIRECTIONS].sort();

  for (const phase of ["notice", "swat", "recover"]) {
    assert.deepEqual(Object.keys(ASCII_SEQUENCES[phase]).sort(), expected, phase);
    for (const direction of SWAT_DIRECTIONS) {
      assert.ok(ASCII_SEQUENCES[phase][direction].length > 0, `${phase}.${direction}`);
    }
  }
});

test("classifies portrait collisions and aims from the face center, including blank cells", () => {
  const lines = normalizeAsciiArt(asciiPortrait);

  assert.equal(classifyAsciiPoint(lines, 29, 40), "tablet");
  assert.equal(classifyAsciiPoint(lines, 0, 0), "image");
  assert.equal(classifyAsciiPoint(lines, 33, 69), "blank");
  assert.deepEqual(ASCII_GAZE_ANCHOR, { row: 26, column: 39 });
  assert.equal(directionForAsciiPoint(24, 38), "upper-left");
  assert.equal(directionForAsciiPoint(24, 39), "upper-right");
  assert.equal(directionForAsciiPoint(25, 38), "left");
  assert.equal(directionForAsciiPoint(25, 39), "right");

  for (const [row, column, direction] of [
    [0, 30, "upper-left"],
    [16, 60, "upper-right"],
    [26, 10, "left"],
    [25, 60, "right"],
  ]) {
    assert.equal(classifyAsciiPoint(lines, row, column), "blank", `${row},${column}`);
    assert.equal(directionForAsciiPoint(row, column), direction, `${row},${column}`);
  }
});

test("keeps every swat arm raised, connected, bent, and holding a short pen", () => {
  const frames = createAsciiFrames(asciiPortrait);

  for (const poseName of articulatedPoseNames()) {
    const patches = ASCII_POSES[poseName];
    const lines = frames[poseName].split("\n");
    const handPatch = patches.find(
      ({ text }) => text.includes("@") && text.includes(">"),
    );
    const elbowPatch = patches.find(({ text }) => text.includes("(OOO)"));

    assert.ok(handPatch, `${poseName} has a hand gripping a pen`);
    assert.ok(elbowPatch, `${poseName} has an authored elbow`);
    assert.ok(handPatch.row < ASCII_ANATOMY.head.top, `${poseName} raises its hand`);

    const handColumn = handPatch.column + handPatch.text.indexOf("@");
    const penTipColumn = handPatch.column + handPatch.text.indexOf(">");
    assert.ok(
      penTipColumn - handColumn >= 5 && penTipColumn - handColumn <= 7,
      `${poseName} keeps the pen short`,
    );

    const elbowColumn = elbowPatch.column + elbowPatch.text.indexOf("OOO") + 1;
    const armSegments = patches
      .filter(({ text }) => text.includes("OOO"))
      .map(({ row, column, text }) => ({
        row,
        column: column + text.indexOf("OOO") + 1,
      }))
      .sort((a, b) => a.row - b.row);
    const armRows = new Set(armSegments.map(({ row }) => row));

    for (let row = handPatch.row + 1; row <= ASCII_ANATOMY.shoulder.row; row += 1) {
      assert.ok(armRows.has(row), `${poseName} connects through row ${row}`);
    }
    for (let index = 1; index < armSegments.length; index += 1) {
      const previous = armSegments[index - 1];
      const current = armSegments[index];
      assert.equal(current.row - previous.row, 1, `${poseName} has contiguous rows`);
      assert.ok(
        Math.abs(current.column - previous.column) <= 5,
        `${poseName} keeps adjacent segments connected`,
      );
    }

    const rowAspect = 2.25;
    const handVector = [
      handColumn - elbowColumn,
      (handPatch.row - elbowPatch.row) * rowAspect,
    ];
    const shoulderVector = [
      ASCII_ANATOMY.shoulder.column - elbowColumn,
      (ASCII_ANATOMY.shoulder.row - elbowPatch.row) * rowAspect,
    ];
    const cosine =
      (handVector[0] * shoulderVector[0] + handVector[1] * shoulderVector[1]) /
      (Math.hypot(...handVector) * Math.hypot(...shoulderVector));
    const elbowAngle =
      (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
    assert.ok(
      elbowAngle >= 98 && elbowAngle <= 155,
      `${poseName} keeps a slight elbow bend`,
    );
    assert.equal(
      lines[ASCII_ANATOMY.shoulder.row][ASCII_ANATOMY.shoulder.column],
      "/",
      `${poseName} remains attached at the shoulder`,
    );
    assert.doesNotMatch(frames[poseName], /O<-{4,}|__\/{1,2}-{4,}|lxl\._|-----/);
  }
});

test("turns the full head toward each swat target", () => {
  const frames = createAsciiFrames(asciiPortrait);

  for (const direction of SWAT_DIRECTIONS) {
    const anatomy = ASCII_ANATOMY.contact[direction];
    const contactLines = frames[anatomy.pose].split("\n");
    assert.equal(contactLines[anatomy.hand.row][anatomy.hand.column], "@");
    assert.equal(contactLines[anatomy.elbow.row][anatomy.elbow.column], "O");
    assert.equal(contactLines[anatomy.penTip.row][anatomy.penTip.column], ">");

    const gazeMarker = direction.endsWith("left") ? "<" : ">";
    for (const { pose } of [
      ...ASCII_SEQUENCES.swat[direction],
      ...ASCII_SEQUENCES.recover[direction].filter(({ pose }) =>
        pose.startsWith("recover-"),
      ),
    ]) {
      const poseLines = frames[pose].split("\n");
      const face = poseLines[27].slice(
        ASCII_ANATOMY.head.left,
        ASCII_ANATOMY.head.right + 1,
      );
      const brow = poseLines[26].slice(
        ASCII_ANATOMY.head.left,
        ASCII_ANATOMY.head.right + 1,
      );
      assert.ok(face.includes(gazeMarker), `${pose} faces ${direction}`);
      if (direction.startsWith("upper-")) {
        assert.ok(brow.includes("^"), `${pose} retains its upward gaze`);
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

  assert.match(html, /data-ascii-character="writer"/);
  assert.match(html, /data-ascii-interaction="pointer-swat"/);
  assert.match(html, /data-ascii-frame="write-rest"/);
  assert.match(html, /role="img"/);
  assert.match(
    html,
    /aria-label="A person sitting beneath a tree writes on a tablet, turns toward a moving mouse pointer, and occasionally raises a bent arm overhead to swat while keeping a pen in hand\."/,
  );
  assert.match(html, /<pre[^>]*aria-hidden="true"/);
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
