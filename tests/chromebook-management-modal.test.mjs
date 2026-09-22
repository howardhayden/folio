import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  chromebookActionPaths,
  chromebookExceptionPhases,
  chromebookManagementViews,
  chromebookPathStates,
  chromebookServiceBlueprints,
  chromebookSkillDomains,
  chromebookStateFlows,
} from "../app/resume/chromebookManagementViews.js";
import {
  createFrostedStateTransition,
  FROSTED_STATE_DURATION_MS,
} from "../app/resume/frostedStateTransition.js";
import { projects } from "../app/resume/projects.js";

const readSource = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("models every operating condition as evidence to ordered action and outcome", async () => {
  const component = await readSource("../app/resume/ChromebookManagementViews.tsx");
  assert.deepEqual(chromebookActionPaths.map(({ id }) => id), [
    "normal-return",
    "overdue-unreturned",
    "late-return",
  ]);

  const normal = chromebookActionPaths.find(({ id }) => id === "normal-return");
  const overdue = chromebookActionPaths.find(({ id }) => id === "overdue-unreturned");
  const late = chromebookActionPaths.find(({ id }) => id === "late-return");
  assert.ok(normal);
  assert.ok(overdue);
  assert.ok(late);
  assert.deepEqual(normal.actions, ["Wipe", "Verify"]);
  assert.deepEqual(overdue.actions, ["Lock"]);
  assert.deepEqual(late.actions, ["Unlock", "Wipe", "Verify"]);
  assert.deepEqual(normal.activeDomains, ["return-timing", "return-assurance"]);
  assert.deepEqual(overdue.activeDomains, ["return-timing", "endpoint-control"]);
  assert.deepEqual(late.activeDomains, ["return-timing", "endpoint-control", "return-assurance"]);
  for (const path of chromebookActionPaths) {
    for (const field of ["condition", "physicalEvidence", "sierraEvidence", "endpointEvidence", "interpretation", "outcome"]) {
      assert.ok(path[field].trim(), `${path.id} exposes ${field}`);
    }
  }

  assert.match(chromebookStateFlows["normal-return"].diagram, /SIERRA ILS[\s\S]*GOOGLE ADMIN[\s\S]*WIPE[\s\S]*VERIFY[\s\S]*DEVICE WIPED AND VERIFIED/u);
  assert.match(chromebookStateFlows["overdue-unreturned"].diagram, /NOT TURNED IN FOR TOO LONG[\s\S]*LOCK[\s\S]*LOCKED PENDING PHYSICAL RETURN/u);
  assert.match(chromebookStateFlows["late-return"].diagram, /LOCKED WHILE STILL OUT[\s\S]*TURNED IN AFTER BEING OUT TOO LONG[\s\S]*UNLOCK[\s\S]*WIPE[\s\S]*VERIFY/u);
  for (const { diagram } of Object.values(chromebookStateFlows)) {
    assert.ok(Math.max(...diagram.split("\n").map((line) => line.length)) <= 36, "the colored-text flow fits a phone at a readable size without horizontal panning");
  }
  assert.match(component, /role="img"[\s\S]*?aria-label=\{stateFlow\.description\}/u);
  assert.match(component, /<pre className="tools-card-accent signal-fuzz" aria-hidden="true">[\s\S]*?\{stateFlow\.diagram\}/u);
});

test("nests the exception lifecycle inside the four keyboard-operable modal lenses", async () => {
  const component = await readSource("../app/resume/ChromebookManagementViews.tsx");
  assert.deepEqual(chromebookManagementViews, [
    { id: "flow", label: "State Flow" },
    { id: "skills", label: "Skill Map" },
    { id: "matrix", label: "Reconciliation Matrix" },
    { id: "blueprint", label: "Service Blueprint" },
  ]);
  assert.deepEqual(chromebookPathStates, [
    { id: "normal", label: "Normal return" },
    { id: "exception", label: "Exception lifecycle" },
  ]);
  assert.deepEqual(chromebookExceptionPhases, [
    { id: "overdue-unreturned", label: "Still out" },
    { id: "late-return", label: "Returned late" },
  ]);

  assert.match(component, /function RovingStateTabs/u);
  assert.match(component, /className="button-reset resume-search-close chromebook-state-tab signal-fuzz"/u);
  assert.match(component, /role="tablist" aria-label=\{label\}/u);
  assert.match(component, /role="tab"[\s\S]*?aria-controls=\{panelId\}[\s\S]*?aria-selected=\{isSelected\}/u);
  assert.match(component, /tabIndex=\{isSelected \? 0 : -1\}/u);
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"]) {
    assert.match(component, new RegExp(`event\\.key === "${key}"`, "u"), `${key} is handled`);
  }
  assert.match(component, /items=\{chromebookPathStates\}[\s\S]*?label="Return path"/u);
  assert.match(component, /className="chromebook-condition-navigation" role="group" aria-label="Selected operating condition"/u);
  assert.match(component, /selectedPath === "normal"[\s\S]*?chromebook-condition-leaf[\s\S]*?Returned before lock[\s\S]*?items=\{chromebookExceptionPhases\}[\s\S]*?label="Exception phase"/u);
  assert.doesNotMatch(component, /chromebook-exception-navigation--dormant/u, "the normal path exposes its nested terminal state instead of an empty reserved row");
  assert.match(component, /lastExceptionRef/u, "returning to the exception path remembers its selected phase");
  assert.doesNotMatch(component, /hidden=\{activeView !== view\.id\}/u, "hidden panels do not kill the state transition");
});

test("reuses Resume Search frost and fade for one persistent modal-state surface", async () => {
  const [component, css] = await Promise.all([
    readSource("../app/resume/ChromebookManagementViews.tsx"),
    readSource("../app/globals.css"),
  ]);

  assert.match(component, /type TransitionPhase = "stable" \| "outgoing" \| "incoming"/u);
  assert.equal(FROSTED_STATE_DURATION_MS, 180);
  assert.match(component, /createFrostedStateTransition\(\{/u);
  for (const query of [
    "(prefers-reduced-motion: reduce)",
    "(prefers-reduced-transparency: reduce)",
    "(forced-colors: active)",
  ]) {
    assert.ok(component.includes(`"${query}"`), `${query} disables timed replacement`);
  }
  assert.match(component, /controller\.dispose\(\)[\s\S]*?controllerRef\.current = null/u);
  assert.match(component, /resume-search-surface resume-search-results--replacing chromebook-state-surface/u);
  assert.match(component, /state\.frosted \? " resume-search-surface--frosted"/u);
  assert.match(component, /aria-busy=\{state\.transitioning\}[\s\S]*?aria-hidden=\{state\.transitioning \? "true" : undefined\}[\s\S]*?inert=\{state\.transitioning \? true : undefined\}/u);
  assert.match(component, /data-transition-phase=\{state\.phase\}[\s\S]*?tabIndex=\{0\}/u);
  assert.match(css, /\.resume-search-surface \{[\s\S]*?transition: filter \.5s ease, opacity \.5s ease/u);
  assert.match(css, /\.resume-search-results--replacing \{[\s\S]*?transition-duration: \.18s/u);
  assert.match(css, /\.chromebook-state-surface\.resume-search-surface--frosted \{[\s\S]*?opacity: 0/u);
});

test("keeps incoming content inert for the full fade and cancels rapid transition work", () => {
  const createHarness = (duration = FROSTED_STATE_DURATION_MS) => {
    let nextHandle = 1;
    const timers = new Map();
    const frames = new Map();
    const state = {
      displayed: "flow:normal-return",
      frosted: false,
      phase: "stable",
      selected: "flow:normal-return",
    };
    const controller = createFrostedStateTransition({
      cancelFrame: (handle) => frames.delete(handle),
      clearTimer: (handle) => timers.delete(handle),
      durationFor: () => duration,
      initialValue: state.displayed,
      onDisplayed: (value) => { state.displayed = value; },
      onFrosted: (value) => { state.frosted = value; },
      onPhase: (value) => { state.phase = value; },
      onSelected: (value) => { state.selected = value; },
      requestFrame: (callback) => {
        const handle = nextHandle++;
        frames.set(handle, callback);
        return handle;
      },
      setTimer: (callback, milliseconds) => {
        const handle = nextHandle++;
        timers.set(handle, { callback, milliseconds });
        return handle;
      },
    });
    const runTimer = () => {
      const [handle, task] = timers.entries().next().value ?? [];
      assert.ok(task, "a timer is pending");
      timers.delete(handle);
      task.callback();
      return task.milliseconds;
    };
    const runFrame = () => {
      const [handle, callback] = frames.entries().next().value ?? [];
      assert.ok(callback, "an animation frame is pending");
      frames.delete(handle);
      callback(0);
    };
    return { controller, frames, runFrame, runTimer, state, timers };
  };

  const transition = createHarness();
  transition.controller.select("skills:normal-return");
  assert.deepEqual(transition.state, {
    displayed: "flow:normal-return",
    frosted: true,
    phase: "outgoing",
    selected: "skills:normal-return",
  });
  assert.equal(transition.runTimer(), FROSTED_STATE_DURATION_MS);
  assert.equal(transition.state.displayed, "skills:normal-return");
  assert.equal(transition.state.phase, "incoming");
  assert.equal(transition.state.frosted, true);
  transition.runFrame();
  transition.runFrame();
  assert.equal(transition.state.frosted, false, "the incoming surface now fades into view");
  assert.equal(transition.state.phase, "incoming", "incoming content stays inert during its visible fade");
  assert.equal(transition.runTimer(), FROSTED_STATE_DURATION_MS);
  assert.equal(transition.state.phase, "stable");

  const retarget = createHarness();
  retarget.controller.select("skills:normal-return");
  retarget.controller.select("matrix:normal-return");
  assert.equal(retarget.timers.size, 1, "retargeting cancels the obsolete outgoing timer");
  retarget.runTimer();
  assert.equal(retarget.state.displayed, "matrix:normal-return");

  const reverse = createHarness();
  reverse.controller.select("skills:normal-return");
  reverse.controller.select("flow:normal-return");
  assert.equal(reverse.timers.size, 0);
  assert.equal(reverse.state.phase, "stable");
  assert.equal(reverse.state.frosted, false);

  const disposed = createHarness();
  disposed.controller.select("skills:normal-return");
  disposed.controller.dispose();
  assert.equal(disposed.timers.size, 0);
  assert.equal(disposed.frames.size, 0);

  const immediate = createHarness(0);
  immediate.controller.select("skills:normal-return");
  assert.equal(immediate.state.displayed, "skills:normal-return");
  assert.equal(immediate.state.phase, "stable");
  assert.equal(immediate.timers.size, 0);
});

test("keeps one responsive pastel skill map and lets the technologies stand on their own", async () => {
  const [component, css] = await Promise.all([
    readSource("../app/resume/ChromebookManagementViews.tsx"),
    readSource("../app/globals.css"),
  ]);
  const chromebook = projects.find(({ id }) => id === "chromebook-management");
  assert.ok(chromebook);

  assert.deepEqual(
    chromebookSkillDomains.map(({ id, tone, context }) => [id, tone, context]),
    [
      ["return-timing", "blue-green", "returned · overdue · lock condition"],
      ["endpoint-control", "red-orange", "lock while out · unlock after return"],
      ["return-assurance", "storm-gray", "wipe · verify every returned device"],
    ],
  );
  assert.match(component, /actionPath\.activeDomains\.includes\(domain\.id\)/u);
  assert.match(component, /chromebook-skill-domain--quiet/u);
  assert.match(component, /<ActionSequence value=\{actionPath\.actions\.join\(" → "\)\} \/>/u);
  assert.match(component, /Action: \{actionPath\.actions\.join\(", then "\)\}/u, "the selected map action remains available outside the decorative visual");
  assert.doesNotMatch(component, /chromebook-skill-action-paths/u, "condition cards are not stacked beneath the map");
  assert.match(component, /<ul className="chromebook-technology-list" aria-label="Technologies">[\s\S]*?technologies\.map/u);
  assert.doesNotMatch(component, /Recorded technologies:/u);
  for (const technology of chromebook.technologies) assert.ok(technology.length > 0);

  const domainRule = css.match(/\.chromebook-skill-domain\s*\{([^}]*)\}/u)?.[1] ?? "";
  assert.match(domainRule, /position:\s*absolute/u);
  assert.match(domainRule, /var\(--teaching-caret-fill\)/u);
  assert.match(domainRule, /var\(--teaching-caret-outline\)/u);
  assert.match(css, /@media \(max-width: 700px\) \{[\s\S]*?\.chromebook-skill-domain \{[\s\S]*?width: clamp\(9\.5rem, 52vw, 12\.5rem\)/u, "the mobile map remains overlaid rather than becoming a card stack");
});

test("shows one selected reconciliation case instead of a six-column scenario dump", async () => {
  const component = await readSource("../app/resume/ChromebookManagementViews.tsx");
  assert.match(component, /function ReconciliationMatrixView[\s\S]*?find\(\(\{ id \}\) => id === conditionId\)/u);
  assert.match(component, /<table className="chromebook-evidence-table">/u);
  for (const heading of ["Physical evidence", "Sierra ILS", "Endpoint context", "Interpretation", "Action sequence", "Operational result"]) {
    assert.match(component, new RegExp(`<th scope="row">${heading}<\\/th>`, "u"));
  }
  assert.match(component, /\{actionPath\.physicalEvidence\}[\s\S]*?\{actionPath\.sierraEvidence\}[\s\S]*?\{actionPath\.endpointEvidence\}/u);
  assert.match(component, /chromebook-matrix-action teaching-manifest-entry--\$\{actionPath\.tone\}[\s\S]*?<ActionSequence value=\{actionPath\.actions\.join\(" → "\)\}/u);
  assert.doesNotMatch(component, /chromebookActionPaths\.map[\s\S]*?<tr/u, "all scenarios are not rendered as adjacent matrix rows");
  assert.match(component, /Every physical return proceeds through <ReadableSequence value="Wipe → Verify" \/>/u);
});

test("renders one vertical blueprint while retaining the full late-return exception history", async () => {
  const component = await readSource("../app/resume/ChromebookManagementViews.tsx");
  assert.deepEqual(chromebookServiceBlueprints["normal-return"].map(({ lane }) => lane), [
    "Trigger",
    "Physical custody",
    "Sierra ILS evidence",
    "Endpoint context",
    "Interpretation",
    "Action sequence",
    "Outcome",
  ]);
  assert.equal(
    chromebookServiceBlueprints["normal-return"].find(({ lane }) => lane === "Action sequence")?.value,
    "Wipe → Verify",
  );
  assert.equal(
    chromebookServiceBlueprints["overdue-unreturned"].find(({ lane }) => lane === "Action sequence")?.value,
    "Lock",
  );
  assert.equal(
    chromebookServiceBlueprints["late-return"].find(({ lane }) => lane === "Action sequence")?.value,
    "Lock → Await physical return → Unlock → Wipe → Verify",
  );
  assert.match(component, /<dl className="timeline-manifest chromebook-blueprint-lanes">/u);
  assert.match(component, /blueprint\.map\(\(step, index\)/u);
  assert.match(component, /step\.lane[\s\S]*?step\.value/u);
  assert.match(component, /<ReadableSequence value=\{step\.value\} \/>/u, "every non-action arrow sequence has a spoken equivalent");
  assert.doesNotMatch(component, /chromebook-blueprint-table/u, "normal and exception blueprints are not parallel table columns");
  assert.match(component, /selected phase retains the earlier lock so the full exception lifecycle remains legible/u);
});

test("keeps action speech portable, claims bounded, and integration Chromebook-only", async () => {
  const [component, disclosure, resumeProjects, heldProjects, projectsPage] = await Promise.all([
    readSource("../app/resume/ChromebookManagementViews.tsx"),
    readSource("../app/resume/ProjectDescriptionDisclosure.tsx"),
    readSource("../app/resume/ResumeProjects.tsx"),
    readSource("../app/resume/ResumeProjectsHeld.tsx"),
    readSource("../app/projects/page.tsx"),
  ]);
  const chromebook = projects.find(({ id }) => id === "chromebook-management");
  assert.ok(chromebook);

  assert.match(component, /function ActionSequence[\s\S]*?aria-hidden="true"[\s\S]*?className="chromebook-visually-hidden"[\s\S]*?value\.replaceAll\(" → ", ", then "\)/u);
  const artifact = [
    JSON.stringify(chromebookActionPaths),
    JSON.stringify(chromebookServiceBlueprints),
    Object.values(chromebookStateFlows).map(({ diagram, description }) => `${diagram}\n${description}`).join("\n"),
    JSON.stringify(chromebook.summary),
    JSON.stringify(chromebook.capabilities),
    component,
  ].join("\n");
  assert.doesNotMatch(artifact, /\b\d+\s*[-–—]?\s*(?:hours?|days?|weeks?|months?)\b/iu);
  assert.doesNotMatch(artifact, /\b(?:automatic(?:ally)?|automation|synchroni[sz](?:e|ed|es|ing|ation)|write[- ]?back|API calls?|alerts?|logs?|policy)\b/iu);
  assert.doesNotMatch(artifact, /\b(?:Activate|Deactivate)\b/u);

  assert.match(disclosure, /const hasChromebookViews = projectSlug === "chromebook-management"/u);
  assert.match(disclosure, /element\.tabIndex >= 0 && !element\.closest\("\[hidden\], \[aria-hidden='true'\]"\)/u);
  assert.match(disclosure, /<ChromebookManagementViews[\s\S]*?instanceId=\{projectId\}[\s\S]*?technologies=\{technologies\}/u);
  for (const source of [resumeProjects, heldProjects, projectsPage]) {
    assert.match(source, /<ProjectDescriptionDisclosure[\s\S]*?projectSlug=\{project\.slug\}[\s\S]*?technologies=\{project\.technologies\}[\s\S]*?\/>/u);
  }
});
