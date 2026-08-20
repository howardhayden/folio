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

const PRIMARY_ROUTES = ["/", "/resume", "/tools", "/shelf"];
const SWAT_DIRECTIONS = ["left", "right", "upper-left", "upper-right"];

function startTags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map(
    ([tag]) => tag,
  );
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, "i"));
  return match?.[1] ?? match?.[2];
}

function hasClass(tag, className) {
  return (attribute(tag, "class") ?? "").split(/\s+/).includes(className);
}

function withoutReactComments(html) {
  return html.replace(/<!--.*?-->/gs, "");
}

function idsIn(html) {
  return startTags(html, "[a-z][a-z0-9-]*")
    .map((tag) => attribute(tag, "id"))
    .filter(Boolean);
}

function assertInternalLinksResolve(html, pathname) {
  const ids = new Set(idsIn(html));
  const internalHrefs = startTags(html, "a")
    .map((tag) => attribute(tag, "href"))
    .filter((href) => href?.startsWith("/") || href?.startsWith("#"));

  for (const href of internalHrefs) {
    if (href.startsWith("#")) {
      assert.ok(ids.has(href.slice(1)), `${pathname} resolves ${href}`);
      continue;
    }

    const route = new URL(href, "http://localhost").pathname.replace(/\/$/, "") || "/";
    assert.ok(PRIMARY_ROUTES.includes(route), `${pathname} links to known route ${href}`);
  }
}

function assertUniqueIds(html, pathname) {
  const ids = idsIn(html);
  assert.equal(new Set(ids).size, ids.length, `${pathname} has unique element IDs`);
}

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
  assert.equal(directionForAsciiPoint(ASCII_GAZE_ANCHOR.row, 38), "left");
  assert.equal(directionForAsciiPoint(ASCII_GAZE_ANCHOR.row, 39), "right");
  assert.equal(directionForAsciiPoint(24, 38), "upper-left");
  assert.equal(directionForAsciiPoint(24, 39), "upper-right");
  assert.equal(directionForAsciiPoint(25, 38), "left");
  assert.equal(directionForAsciiPoint(25, 39), "right");

  const blankTargets = [
    [0, 30, "upper-left"],
    [16, 60, "upper-right"],
    [26, 10, "left"],
    [25, 60, "right"],
  ];
  for (const [row, column, direction] of blankTargets) {
    assert.equal(classifyAsciiPoint(lines, row, column), "blank", `${row},${column}`);
    assert.equal(directionForAsciiPoint(row, column), direction, `${row},${column}`);
  }
});

test("keeps every animated swat arm raised, connected, bent, and holding a short pen", () => {
  const frames = createAsciiFrames(asciiPortrait);

  for (const poseName of articulatedPoseNames()) {
    const patches = ASCII_POSES[poseName];
    const frame = frames[poseName];
    const lines = frame.split("\n");
    const handPatch = patches.find(
      ({ text }) => text.includes("@") && text.includes(">"),
    );
    const elbowPatch = patches.find(({ text }) => text.includes("(OOO)"));

    assert.ok(handPatch, `${poseName} has a hand gripping a pen`);
    assert.ok(elbowPatch, `${poseName} has an authored elbow`);
    assert.ok(handPatch.row < ASCII_ANATOMY.head.top, `${poseName} raises the hand above the head`);

    const handColumn = handPatch.column + handPatch.text.indexOf("@");
    const penTipColumn = handPatch.column + handPatch.text.indexOf(">");
    assert.ok(
      penTipColumn - handColumn >= 5 && penTipColumn - handColumn <= 7,
      `${poseName} keeps the pen short and pointing behind the grip`,
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
      assert.ok(armRows.has(row), `${poseName} connects the arm through row ${row}`);
    }
    for (let index = 1; index < armSegments.length; index += 1) {
      const previous = armSegments[index - 1];
      const current = armSegments[index];
      assert.equal(current.row - previous.row, 1, `${poseName} has contiguous arm rows`);
      assert.ok(
        Math.abs(current.column - previous.column) <= 5,
        `${poseName} keeps adjacent arm segments connected laterally`,
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
      `${poseName} keeps a visible, slight elbow bend (${elbowAngle.toFixed(1)} degrees)`,
    );
    assert.equal(
      lines[ASCII_ANATOMY.shoulder.row][ASCII_ANATOMY.shoulder.column],
      "/",
      `${poseName} remains attached at the shoulder`,
    );
    assert.doesNotMatch(frame, /O<-{4,}|__\/{1,2}-{4,}|lxl\._|-----/, `${poseName} omits the old rod motifs`);
  }
});

test("preserves contact landmarks and turns the full head toward each target", () => {
  const frames = createAsciiFrames(asciiPortrait);

  for (const direction of SWAT_DIRECTIONS) {
    const anatomy = ASCII_ANATOMY.contact[direction];
    const contactLines = frames[anatomy.pose].split("\n");
    assert.equal(contactLines[anatomy.hand.row][anatomy.hand.column], "@", `${direction} hand`);
    assert.equal(contactLines[anatomy.elbow.row][anatomy.elbow.column], "O", `${direction} elbow`);
    assert.equal(contactLines[anatomy.penTip.row][anatomy.penTip.column], ">", `${direction} pen tip`);
    assert.ok(anatomy.hand.row < ASCII_ANATOMY.head.top, `${direction} hand is overhead`);
    assert.equal(anatomy.penTip.row, anatomy.hand.row, `${direction} pen follows the grip`);
    assert.ok(
      anatomy.penTip.column - anatomy.hand.column >= 5 &&
        anatomy.penTip.column - anatomy.hand.column <= 7,
      `${direction} contact pen stays short`,
    );

    const gazeMarker = direction.endsWith("left") ? "<" : ">";
    const directionalPoses = [
      ...ASCII_SEQUENCES.swat[direction],
      ...ASCII_SEQUENCES.recover[direction].filter(({ pose }) =>
        pose.startsWith("recover-"),
      ),
    ];
    for (const { pose } of directionalPoses) {
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
        assert.ok(brow.includes("^"), `${pose} keeps its upward gaze through recovery`);
      }
    }

    const gazeRows = new Set(
      ASCII_POSES[anatomy.gazePose]
        .filter(
          ({ row, column, text }) =>
            row >= ASCII_ANATOMY.head.top &&
            row <= ASCII_ANATOMY.head.bottom &&
            column <= ASCII_ANATOMY.head.right &&
            column + text.length - 1 >= ASCII_ANATOMY.head.left,
        )
        .map(({ row }) => row),
    );
    assert.ok(gazeRows.size >= 3, `${direction} tilts multiple rows of the head`);
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
  assert.match(html, /<noscript><style>#ascii/);
});

test("renders every primary route as a distinct branch of the index", async () => {
  const routes = [
    ["/", "home", "00", "Yes, my initials spell", "hah.dev"],
    ["/resume", "resume", "01", "Resume", "Resume | hah.dev."],
    ["/tools", "tools", "02", "Tools", "Tools | hah.dev."],
    ["/shelf", "shelf", "03", "Shelf", "Shelf | hah.dev."],
  ];

  for (const [pathname, routeKey, index, heading, title] of routes) {
    const { response, html } = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(html, new RegExp(`<h1[^>]*>[^<]*${heading}`, "i"), pathname);
    assert.ok(html.includes(`<title>${title}</title>`), `${pathname} title`);

    const mainTags = startTags(html, "main");
    assert.equal(mainTags.length, 1, `${pathname} has one main region`);
    assert.equal(attribute(mainTags[0], "id"), "main-content", `${pathname} main target`);
    assert.equal(attribute(mainTags[0], "tabindex"), "-1", `${pathname} focusable main target`);
    assert.equal(startTags(html, "nav").filter((tag) => attribute(tag, "aria-label") === "Primary navigation").length, 1, `${pathname} primary navigation`);
    assert.ok(
      startTags(html, "a").some(
        (tag) => attribute(tag, "href") === "#main-content" && hasClass(tag, "site-skip-link"),
      ),
      `${pathname} skip link`,
    );

    const navLinks = startTags(html, "a").filter((tag) => hasClass(tag, "nav-link"));
    assert.deepEqual(
      navLinks.map((tag) => attribute(tag, "href")),
      PRIMARY_ROUTES,
      `${pathname} preserves every primary branch link`,
    );
    const currentLinks = navLinks.filter((tag) => attribute(tag, "aria-current") === "page");
    assert.equal(currentLinks.length, 1, `${pathname} has one current branch`);
    assert.equal(attribute(currentLinks[0], "href"), pathname, `${pathname} marks ${routeKey} current`);
    assert.match(
      withoutReactComments(html),
      new RegExp(`<span class="site-wordmark-location"[^>]*>${index} / `),
      `${pathname} index marker`,
    );

    if (pathname === "/") {
      const directoryLinks = startTags(html, "a").filter((tag) =>
        hasClass(tag, "index-directory-link"),
      );
      assert.deepEqual(
        directoryLinks.map((tag) => attribute(tag, "href")),
        PRIMARY_ROUTES.slice(1),
        "home indexes every interior page",
      );
      assert.equal(startTags(html, "header").filter((tag) => hasClass(tag, "branch-lead")).length, 0);
      assert.equal(startTags(html, "footer").filter((tag) => hasClass(tag, "branch-return")).length, 0);
    } else {
      assert.equal(startTags(html, "header").filter((tag) => hasClass(tag, "branch-lead")).length, 1, `${pathname} branch lead`);
      assert.equal(startTags(html, "footer").filter((tag) => hasClass(tag, "branch-return")).length, 1, `${pathname} return to index`);
      assert.match(html, /class="branch-path"[^>]*><a href="\/">hah\.dev<\/a>/, `${pathname} breadcrumb`);
      assert.match(html, new RegExp(`<span class="branch-return-marker"[^>]*>${index}</span>`), `${pathname} return marker`);
    }

    assertUniqueIds(html, pathname);
    assertInternalLinksResolve(html, pathname);
  }
});

test("preserves each branch's content and server-rendered functionality", async () => {
  const [{ html: home }, { html: resume }, { html: tools }, { html: shelf }] =
    await Promise.all(PRIMARY_ROUTES.map((pathname) => render(pathname)));

  assert.equal(startTags(home, "h3").length, 8, "all eight index Q&A prompts");
  assert.match(home, /What enticed you into the world of coding, data, and analysis\?/);

  assert.equal(
    startTags(resume, "h5").filter((tag) => hasClass(tag, "tools-card-title")).length,
    7,
    "all seven resume skill stacks",
  );
  assert.equal(
    startTags(resume, "article").filter((tag) =>
      (attribute(tag, "aria-labelledby") ?? "").startsWith("project-"),
    ).length,
    4,
    "all four resume projects",
  );
  assert.match(resume, /role="button" tabindex="0"/i, "keyboard-operable timeline entry");
  assert.match(resume, /<noscript>.*University experience details.*<\/noscript>/s, "no-JS resume details");

  assert.equal(
    startTags(tools, "h5").filter((tag) => hasClass(tag, "tools-card-title")).length,
    6,
    "all six productivity tools",
  );
  assert.match(tools, /href="https:\/\/www\.linkedin\.com\/in\/howardhayden\/"/);
  assert.match(tools, /href="https:\/\/duolingo\.com\/profile\/hahdev"/);

  assert.equal(
    startTags(shelf, "article").filter((tag) => hasClass(tag, "card")).length,
    30,
    "all 30 shelf records",
  );
  assert.equal(startTags(shelf, "input").filter((tag) => attribute(tag, "type") === "text").length, 4, "all shelf filters");
  assert.ok(
    startTags(shelf, "button").some(
      (tag) => attribute(tag, "id") === "navbarDropdown" && attribute(tag, "aria-controls") === "shelf-search-menu shelf-results",
    ),
    "shelf search disclosure",
  );
  assert.match(shelf, /<noscript><style>\.nav-btn#navbarDropdown\{display:none\}<\/style><\/noscript>/);
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
  const routes = [
    ["index.html", "/"],
    ["resume/index.html", "/resume"],
    ["tools/index.html", "/tools"],
    ["shelf/index.html", "/shelf"],
    ["404.html", null],
  ];

  for (const [route, pathname] of routes) {
    const html = await readFile(new URL(`../site/${route}`, import.meta.url), "utf8");
    assert.match(html, /<!DOCTYPE html>/i, route);
    assert.equal(startTags(html, "main").length, 1, `${route} has one static main region`);
    assertUniqueIds(html, route);
    assertInternalLinksResolve(html, route);

    const navLinks = startTags(html, "a").filter((tag) => hasClass(tag, "nav-link"));
    assert.deepEqual(
      navLinks.map((tag) => attribute(tag, "href")),
      PRIMARY_ROUTES,
      `${route} keeps the complete index navigation`,
    );
    const currentLinks = navLinks.filter((tag) => attribute(tag, "aria-current") === "page");
    assert.equal(currentLinks.length, pathname === null ? 0 : 1, `${route} static current link`);
    if (pathname !== null) {
      assert.equal(attribute(currentLinks[0], "href"), pathname, `${route} static current route`);
    }
  }

  const staticHome = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  assert.match(staticHome, /data-ascii-frame="write-rest"/);
  assert.equal(startTags(staticHome, "h3").length, 8, "static home preserves every Q&A prompt");

  const cname = await readFile(new URL("../site/CNAME", import.meta.url), "utf8");
  assert.equal(cname.trim(), "hah.dev");
});
