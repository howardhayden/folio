import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { mayRevealLatticeOutput } from "../app/resume/lattice/outputProtection.js";

const source = await readFile(new URL("../app/resume/ResumeProjects.tsx", import.meta.url), "utf8");
const outputSetup = source.indexOf("    const output = latticeOutputRef.current;");
const effectStart = source.lastIndexOf("  useEffect(() => {", outputSetup);
const effectEnd = source.indexOf("  const openLattice = useCallback", outputSetup);
assert.ok(outputSetup > 0 && effectStart > 0 && effectEnd > outputSetup);
// Execute the actual shipped effects, removing only their TypeScript event annotation.
const visibilityEffects = source.slice(effectStart, effectEnd).replace(/event: KeyboardEvent/gu, "event");

function events() {
  const listeners = new Map();
  return {
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    removeEventListener(name, callback) {
      listeners.get(name)?.delete(callback);
    },
    emit(name, event = {}) {
      for (const callback of [...(listeners.get(name) ?? [])]) callback(event);
    },
    count() {
      return [...listeners.values()].reduce((sum, callbacks) => sum + callbacks.size, 0);
    },
  };
}

function visibilityHarness() {
  let now = 10_000;
  let focused = true;
  let sequence = 0;
  let mountedEffects = [];
  const frames = new Map();
  const timers = new Map();
  const attributes = new Map();
  const output = {
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
  };
  const refresh = { current: null };
  const document = { ...events(), hidden: false, hasFocus: () => focused };
  const window = {
    ...events(),
    requestAnimationFrame(callback) { const id = ++sequence; frames.set(id, callback); return id; },
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout: (id) => timers.delete(id),
  };
  const flushFrames = () => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) callback(now);
  };
  return {
    window,
    document,
    refresh,
    setFocused(value) { focused = value; },
    shielded: () => attributes.get("data-shielded") === "true",
    flushFrames,
    render(open, result) {
      const declared = [];
      vm.runInNewContext(visibilityEffects, {
        useEffect: (callback, dependencies) => declared.push({ callback, dependencies }),
        latticeOpen: open,
        latticeResult: result,
        latticeOutputRef: { current: output },
        latticeOutputRefreshRef: refresh,
        mayRevealLatticeOutput,
        document,
        window,
        Date: { now: () => now },
      });
      declared.forEach(({ callback, dependencies }, index) => {
        const previous = mountedEffects[index];
        const unchanged = previous
          && previous.dependencies.length === dependencies.length
          && dependencies.every((dependency, i) => Object.is(dependency, previous.dependencies[i]));
        if (unchanged) return;
        previous?.cleanup?.();
        mountedEffects[index] = { dependencies, cleanup: callback() };
      });
    },
    advance(milliseconds) {
      const end = now + milliseconds;
      for (;;) {
        const next = [...timers.entries()].filter(([, timer]) => timer.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [id, timer] = next;
        timers.delete(id);
        now = timer.at;
        timer.callback();
        flushFrames();
      }
      now = end;
      flushFrames();
    },
    pending: () => frames.size + timers.size,
    unmount() {
      mountedEffects.forEach(({ cleanup }) => cleanup?.());
      mountedEffects = [];
    },
  };
}

const returnedResult = () => ({ text: "Returned local result", status: "review-required" });

test("returned output refreshes visibility without a new focus or visibility event", () => {
  const h = visibilityHarness();
  h.setFocused(false);
  h.render(true, null);
  h.flushFrames();
  assert.equal(h.shielded(), true);
  // A focus transition was not delivered, but the browser is now focused.
  h.setFocused(true);
  h.render(true, returnedResult());
  h.flushFrames();
  assert.equal(h.shielded(), false);
  h.unmount();
});

test("replacement results refresh the existing controller rather than reopening it", () => {
  const h = visibilityHarness();
  h.render(true, returnedResult());
  h.flushFrames();
  const controller = h.refresh.current;
  assert.equal(typeof controller, "function");
  h.window.emit("blur");
  assert.equal(h.shielded(), true);
  h.render(true, returnedResult());
  assert.equal(h.refresh.current, controller);
  h.flushFrames();
  assert.equal(h.shielded(), false);
  h.unmount();
});

test("result arrival preserves an active PrintScreen deadline", () => {
  const h = visibilityHarness();
  h.render(true, null);
  h.flushFrames();
  h.document.emit("keydown", { key: "PrintScreen" });
  h.advance(500);
  h.render(true, returnedResult());
  h.flushFrames();
  assert.equal(h.shielded(), true);
  h.advance(999);
  assert.equal(h.shielded(), true);
  h.advance(17);
  assert.equal(h.shielded(), false);
  h.unmount();
});

test("result replacement preserves the latest repeated capture deadline", () => {
  const h = visibilityHarness();
  h.render(true, null);
  h.flushFrames();
  h.document.emit("keydown", { key: "PrintScreen" });
  h.advance(1_000);
  h.document.emit("keyup", { key: "PrintScreen" });
  h.render(true, returnedResult());
  h.advance(516);
  assert.equal(h.shielded(), true);
  h.render(true, returnedResult());
  h.advance(983);
  assert.equal(h.shielded(), true);
  h.advance(17);
  assert.equal(h.shielded(), false);
  h.unmount();
});

test("result arrival during printing stays shielded until afterprint", () => {
  const h = visibilityHarness();
  h.render(true, null);
  h.flushFrames();
  h.window.emit("beforeprint");
  h.render(true, returnedResult());
  h.flushFrames();
  assert.equal(h.shielded(), true);
  h.window.emit("afterprint");
  h.flushFrames();
  assert.equal(h.shielded(), false);
  h.unmount();
});

test("hidden or unfocused result arrivals do not reveal output", () => {
  for (const boundary of ["hidden", "unfocused"]) {
    const h = visibilityHarness();
    h.render(true, null);
    h.flushFrames();
    if (boundary === "hidden") h.document.hidden = true;
    else h.setFocused(false);
    h.render(true, returnedResult());
    h.flushFrames();
    assert.equal(h.shielded(), true, boundary);
    h.document.hidden = false;
    h.setFocused(true);
    h.window.emit("focus");
    h.flushFrames();
    assert.equal(h.shielded(), false);
    h.unmount();
  }
});

test("a blur or print event between result arrival and its frame cancels the reveal", () => {
  for (const event of ["blur", "beforeprint"]) {
    const h = visibilityHarness();
    h.render(true, null);
    h.flushFrames();
    h.render(true, returnedResult());
    if (event === "blur") h.setFocused(false);
    h.window.emit(event);
    h.flushFrames();
    assert.equal(h.shielded(), true, event);
    h.unmount();
  }
});

test("a result returned while closed stays shielded and appears on reopening", () => {
  const h = visibilityHarness();
  h.render(true, null);
  h.flushFrames();
  h.render(false, null);
  const result = returnedResult();
  h.render(false, result);
  h.flushFrames();
  assert.equal(h.shielded(), true);
  assert.equal(h.refresh.current, null);
  h.render(true, result);
  h.flushFrames();
  assert.equal(h.shielded(), false);
  h.unmount();
});

test("protection teardown removes the refresh callback, listeners, frames, and timers", () => {
  const h = visibilityHarness();
  h.render(true, returnedResult());
  h.document.emit("keydown", { key: "PrintScreen" });
  h.unmount();
  assert.equal(h.refresh.current, null);
  assert.equal(h.window.count() + h.document.count(), 0);
  assert.equal(h.pending(), 0);
  assert.equal(h.shielded(), true);
});
