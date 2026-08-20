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

const BAT_DIRECTIONS = ["left", "right", "upper-left", "upper-right"];

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

  assert.ok(ASCII_SEQUENCES.idle.length >= 3, "idle loaf includes a tail cycle");
  for (const phase of ["track", "bat", "settle"]) {
    assert.deepEqual(Object.keys(ASCII_SEQUENCES[phase]).sort(), expected, phase);
    for (const direction of BAT_DIRECTIONS) {
      assert.ok(ASCII_SEQUENCES[phase][direction].length > 0, `${phase}.${direction}`);
    }
  }
});

test("classifies the cat, glass-facing paws, and pointer direction", () => {
  const lines = normalizeAsciiArt(asciiPortrait);

  assert.equal(classifyAsciiPoint(lines, 24, 25), "paw");
  assert.equal(classifyAsciiPoint(lines, 16, 35), "cat");
  assert.equal(classifyAsciiPoint(lines, 4, 45), "image");
  assert.equal(classifyAsciiPoint(lines, 0, 0), "blank");
  assert.equal(classifyAsciiPoint(lines, 33, 69), "blank");
  assert.deepEqual(ASCII_GAZE_ANCHOR, { row: 16, column: 35 });
  assert.equal(directionForAsciiPoint(10, 34), "upper-left");
  assert.equal(directionForAsciiPoint(10, 35), "upper-right");
  assert.equal(directionForAsciiPoint(20, 34), "left");
  assert.equal(directionForAsciiPoint(20, 35), "right");
});

test("keeps the cat loafed above the glass while its tail swishes", () => {
  const frames = createAsciiFrames(asciiPortrait);
  const loaf = frames["loaf-center"].split("\n");
  assert.equal(loaf[ASCII_ANATOMY.loafPaws.left.row][ASCII_ANATOMY.loafPaws.left.column], "o");
  assert.equal(loaf[ASCII_ANATOMY.loafPaws.right.row][ASCII_ANATOMY.loafPaws.right.column], "o");
  assert.equal(
    new Set([frames["loaf-tail-left"], frames["loaf-center"], frames["loaf-tail-right"]]).size,
    3,
    "tail has three visibly distinct positions",
  );
  for (const frame of Object.values(frames)) {
    assert.doesNotMatch(frame, /\(@\)=====>|\(OOO\)/, "human rig is fully superseded");
  }
});

test("tracks every pointer quadrant and bats with a visible glass-facing paw", () => {
  const frames = createAsciiFrames(asciiPortrait);
  for (const direction of BAT_DIRECTIONS) {
    const anatomy = ASCII_ANATOMY.contact[direction];
    const contactLines = frames[anatomy.pose].split("\n");
    assert.equal(contactLines[anatomy.paw.row][anatomy.paw.column], "o", `${direction} contact pad`);
    assert.ok(
      ASCII_SEQUENCES.bat[direction].some(({ pose }) => pose === anatomy.pose),
      `${direction} contact is part of its bat`,
    );
    const tracking = frames[anatomy.gazePose];
    assert.notEqual(tracking, frames["loaf-center"], `${direction} changes the gaze`);
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
  assert.match(
    html,
    /aria-label="A cat loafs on a glass table above the viewer, follows the pointer with its eyes, swishes its tail, and reaches down to bat at it with a soft paw\."/,
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
