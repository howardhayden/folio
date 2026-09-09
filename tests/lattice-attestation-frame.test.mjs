import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

import {
  LATTICE_ATTESTATION_FRAME_URL,
  LATTICE_ATTESTATION_ORIGIN,
  LATTICE_ATTESTATION_PROTOCOL,
  LATTICE_ATTESTATION_PROTOCOL_VERSION,
  createLatticeAttestationRequestId,
  isLatticeAttestationFrameEvent,
  obtainLatticeAttestation,
  parseLatticeAttestationFrameMessage,
} from "../app/resume/lattice/attestation.js";
import { LATTICE_USAGE_POLICY } from "../app/resume/lattice/usagePolicy.js";
import { LATTICE_ATTESTATION_HOSTNAME } from "../workers/text-to-lattice-lease/attestation.js";

const parentSource = await readFile(new URL("../app/resume/lattice/attestation.js", import.meta.url), "utf8");
const bridgeSource = await readFile(new URL("../workers/text-to-lattice-attestation-frame/public/turnstile/bridge.js", import.meta.url), "utf8");
const frameHtml = await readFile(new URL("../workers/text-to-lattice-attestation-frame/public/turnstile/index.html", import.meta.url), "utf8");
const frameHeaders = await readFile(new URL("../workers/text-to-lattice-attestation-frame/public/_headers", import.meta.url), "utf8");
const frameConfig = await readFile(new URL("../workers/text-to-lattice-attestation-frame/wrangler.jsonc", import.meta.url), "utf8");

const requestId = "abcdefghijklmnopqrstuvwx";
const plainData = (value) => JSON.parse(JSON.stringify(value));
const message = (type, extra = {}) => ({
  protocol: LATTICE_ATTESTATION_PROTOCOL,
  version: LATTICE_ATTESTATION_PROTOCOL_VERSION,
  type,
  requestId,
  ...extra,
});

test("attestation correlation IDs contain 144 random bits in fixed base64url form", () => {
  let requestedBytes = 0;
  const cryptoImpl = {
    getRandomValues(bytes) {
      requestedBytes = bytes.byteLength;
      bytes.fill(0xff);
      return bytes;
    },
  };
  const value = createLatticeAttestationRequestId(cryptoImpl);
  assert.equal(requestedBytes, 18);
  assert.equal(value.length, 24);
  assert.match(value, /^[A-Za-z0-9_-]{24}$/u);
});

test("the frame protocol accepts only closed schemas and a matching correlation ID", () => {
  assert.deepEqual(parseLatticeAttestationFrameMessage({
    protocol: LATTICE_ATTESTATION_PROTOCOL,
    version: LATTICE_ATTESTATION_PROTOCOL_VERSION,
    type: "ready",
  }, requestId), { type: "ready" });
  assert.deepEqual(parseLatticeAttestationFrameMessage(message("interactive"), requestId), { type: "interactive" });
  assert.deepEqual(parseLatticeAttestationFrameMessage(message("noninteractive"), requestId), { type: "noninteractive" });
  assert.deepEqual(parseLatticeAttestationFrameMessage(message("token", { token: "0.provider+/token=:~" }), requestId), {
    type: "token",
    token: "0.provider+/token=:~",
  });
  assert.deepEqual(parseLatticeAttestationFrameMessage(message("error"), requestId), { type: "error" });

  for (const invalid of [
    null,
    [],
    { protocol: LATTICE_ATTESTATION_PROTOCOL, version: 2, type: "ready" },
    { protocol: LATTICE_ATTESTATION_PROTOCOL, version: 1, type: "ready", extra: true },
    message("interactive", { extra: true }),
    message("token", { token: "token with spaces" }),
    message("token", { token: "x".repeat(2_049) }),
    message("unexpected"),
  ]) {
    assert.equal(parseLatticeAttestationFrameMessage(invalid, requestId), null);
  }
  assert.equal(parseLatticeAttestationFrameMessage(message("error"), "zyxwvutsrqponmlkjihgfedc"), null);
});

test("message admission binds both the dedicated origin and the exact child window", () => {
  const frameWindow = {};
  const data = message("error");
  assert.deepEqual(isLatticeAttestationFrameEvent({
    origin: LATTICE_ATTESTATION_ORIGIN,
    source: frameWindow,
    data,
  }, frameWindow, requestId), { type: "error" });
  assert.equal(isLatticeAttestationFrameEvent({
    origin: "https://hah.dev",
    source: frameWindow,
    data,
  }, frameWindow, requestId), null);
  assert.equal(isLatticeAttestationFrameEvent({
    origin: LATTICE_ATTESTATION_ORIGIN,
    source: {},
    data,
  }, frameWindow, requestId), null);
});

test("the parent broker completes one exact-origin handshake and destroys the frame", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const windowListeners = new Map();
  const posted = [];
  let removed = false;
  let focusCount = 0;
  let appendedFrame = null;

  class FakeHTMLElement {}
  const container = new FakeHTMLElement();
  container.dataset = {};
  container.getBoundingClientRect = () => ({ width: 480 });
  container.replaceChildren = (frame) => {
    appendedFrame = frame;
  };
  container.removeAttribute = (name) => {
    if (name === "data-verification-state") delete container.dataset.verificationState;
  };

  const frameWindow = {
    postMessage(value, targetOrigin) {
      posted.push({ value, targetOrigin });
    },
  };
  const frameListeners = new Map();
  const frame = {
    contentWindow: frameWindow,
    dataset: {},
    setAttribute(name, value) {
      this[name] = value;
    },
    addEventListener(type, listener) {
      frameListeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (frameListeners.get(type) === listener) frameListeners.delete(type);
    },
    remove() {
      removed = true;
    },
    focus() {
      focusCount += 1;
    },
  };

  globalThis.HTMLElement = FakeHTMLElement;
  globalThis.document = {
    createElement(type) {
      assert.equal(type, "iframe");
      return frame;
    },
  };
  globalThis.window = {
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (windowListeners.get(type) === listener) windowListeners.delete(type);
    },
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
  };

  try {
    const attestation = obtainLatticeAttestation("0x4AAAA-public-site-key", container);
    assert.equal(appendedFrame, frame);
    assert.equal(frame.src, LATTICE_ATTESTATION_FRAME_URL);
    assert.equal(frame.sandbox, "allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts");
    assert.equal(frame.tabIndex, -1);
    assert.equal(posted.length, 0);

    const receive = windowListeners.get("message");
    assert.equal(typeof receive, "function");
    receive({
      origin: LATTICE_ATTESTATION_ORIGIN,
      source: {},
      data: { protocol: LATTICE_ATTESTATION_PROTOCOL, version: 1, type: "ready" },
    });
    assert.equal(posted.length, 0);
    receive({
      origin: LATTICE_ATTESTATION_ORIGIN,
      source: frameWindow,
      data: { protocol: LATTICE_ATTESTATION_PROTOCOL, version: 1, type: "ready" },
    });
    assert.equal(posted.length, 1);
    assert.equal(posted[0].targetOrigin, LATTICE_ATTESTATION_ORIGIN);
    assert.deepEqual(Object.keys(posted[0].value).sort(), [
      "protocol",
      "requestId",
      "siteKey",
      "size",
      "type",
      "version",
    ]);
    assert.doesNotMatch(JSON.stringify(posted[0].value), /source|prompt|text|output/iu);

    receive({
      origin: LATTICE_ATTESTATION_ORIGIN,
      source: frameWindow,
      data: message("interactive", { requestId: posted[0].value.requestId }),
    });
    assert.equal(frame.tabIndex, 0);
    assert.equal(container.dataset.verificationState, "interactive");
    assert.equal(frame.dataset.size, "flexible");
    assert.equal(focusCount, 1);
    receive({
      origin: LATTICE_ATTESTATION_ORIGIN,
      source: frameWindow,
      data: message("noninteractive", { requestId: posted[0].value.requestId }),
    });
    assert.equal(frame.tabIndex, -1);
    assert.equal(container.dataset.verificationState, "pending");

    receive({
      origin: LATTICE_ATTESTATION_ORIGIN,
      source: frameWindow,
      data: {
        protocol: LATTICE_ATTESTATION_PROTOCOL,
        version: 1,
        type: "token",
        requestId: posted[0].value.requestId,
        token: "0.valid-token",
      },
    });
    assert.equal(await attestation, "0.valid-token");
    assert.equal(removed, true);
    assert.equal(windowListeners.has("message"), false);
    assert.equal(container.dataset.verificationState, undefined);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalHTMLElement === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = originalHTMLElement;
  }
});

test("cancellation removes the isolated frame and all parent listeners", async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const windowListeners = new Map();
  let removed = false;

  class FakeHTMLElement {}
  const container = new FakeHTMLElement();
  container.dataset = {};
  container.clientWidth = 480;
  container.replaceChildren = () => {};
  container.removeAttribute = () => {
    delete container.dataset.verificationState;
  };
  const frameListeners = new Map();
  const frame = {
    contentWindow: { postMessage() {} },
    dataset: {},
    setAttribute() {},
    addEventListener(type, listener) {
      frameListeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (frameListeners.get(type) === listener) frameListeners.delete(type);
    },
    remove() {
      removed = true;
    },
  };

  globalThis.HTMLElement = FakeHTMLElement;
  globalThis.document = { createElement: () => frame };
  globalThis.window = {
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (windowListeners.get(type) === listener) windowListeners.delete(type);
    },
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
  };

  try {
    const controller = new AbortController();
    const attestation = obtainLatticeAttestation("0x4AAAA-public-site-key", container, controller.signal);
    assert.equal(frame.tabIndex, -1);
    assert.equal(container.dataset.verificationState, "pending");
    controller.abort();
    await assert.rejects(attestation, (error) => error?.name === "AbortError");
    assert.equal(removed, true);
    assert.equal(windowListeners.has("message"), false);
    assert.equal(frameListeners.has("error"), false);
    assert.equal(container.dataset.verificationState, undefined);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalHTMLElement === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = originalHTMLElement;
  }
});

test("Cloudflare code is confined to the dedicated static origin", () => {
  assert.equal(LATTICE_ATTESTATION_ORIGIN, "https://verify.hah.dev");
  assert.equal(LATTICE_ATTESTATION_HOSTNAME, "verify.hah.dev");
  assert.equal(
    LATTICE_USAGE_POLICY.enforcement.humanAttestation.realProfile.hostname,
    LATTICE_ATTESTATION_HOSTNAME,
  );
  assert.equal(LATTICE_USAGE_POLICY.enforcement.humanAttestation.frameOrigin, LATTICE_ATTESTATION_ORIGIN);
  assert.doesNotMatch(parentSource, /challenges\.cloudflare\.com|window\.turnstile|createElement\("script"\)/u);
  assert.match(parentSource, /postMessage\([\s\S]*?LATTICE_ATTESTATION_ORIGIN\)/u);
  assert.match(parentSource, /event\?\.origin !== LATTICE_ATTESTATION_ORIGIN[\s\S]*?event\?\.source !== frameWindow/u);
  assert.match(parentSource, /frame\.remove\(\)/u);

  assert.match(bridgeSource, /const PARENT_ORIGIN = "https:\/\/hah\.dev"/u);
  assert.match(bridgeSource, /https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/u);
  assert.match(bridgeSource, /event\.origin !== PARENT_ORIGIN[\s\S]*?event\.source !== window\.parent/u);
  assert.match(bridgeSource, /window\.parent\.postMessage\([\s\S]*?, PARENT_ORIGIN\)/u);
  assert.doesNotMatch(frameHtml, /textarea|source text|sample text/iu);
  assert.match(frameHtml, /<title>Text to Lattice acquisition check<\/title>/u);
  assert.match(frameHtml, /<main aria-label="Text to Lattice acquisition check">/u);
  assert.match(frameHtml, /Preparing the acquisition check\./u);
  assert.doesNotMatch(`${frameHtml}\n${bridgeSource}`, /Human verification|Security verification|security check/iu);
});

test("the static bridge rejects foreign messages and returns only bounded protocol results", async () => {
  const parentWindow = {};
  const posted = [];
  const windowListeners = new Map();
  const scriptListeners = new Map();
  let appendCount = 0;
  let executeCount = 0;
  let renderOptions = null;
  let removedWidget = null;
  const status = { textContent: "" };
  const widget = {};
  const script = {
    addEventListener(type, listener) {
      scriptListeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (scriptListeners.get(type) === listener) scriptListeners.delete(type);
    },
    remove() {},
  };
  parentWindow.postMessage = (value, targetOrigin) => {
    posted.push({ value, targetOrigin });
  };
  const windowObject = {
    parent: parentWindow,
    turnstile: null,
    addEventListener(type, listener) {
      windowListeners.set(type, listener);
    },
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
  };
  const documentObject = {
    getElementById(id) {
      return id === "verification-status" ? status : widget;
    },
    createElement(type) {
      assert.equal(type, "script");
      return script;
    },
    head: {
      append(value) {
        assert.equal(value, script);
        appendCount += 1;
        windowObject.turnstile = {
          render(_container, options) {
            renderOptions = options;
            return "widget-id";
          },
          execute(id) {
            assert.equal(id, "widget-id");
            executeCount += 1;
          },
          remove(id) {
            removedWidget = id;
          },
        };
        scriptListeners.get("load")?.();
      },
    },
  };

  vm.runInNewContext(bridgeSource, {
    document: documentObject,
    window: windowObject,
  });
  assert.deepEqual(plainData(posted), [{
    targetOrigin: "https://hah.dev",
    value: {
      protocol: LATTICE_ATTESTATION_PROTOCOL,
      version: LATTICE_ATTESTATION_PROTOCOL_VERSION,
      type: "ready",
    },
  }]);

  const receive = windowListeners.get("message");
  assert.equal(typeof receive, "function");
  const validStart = {
    protocol: LATTICE_ATTESTATION_PROTOCOL,
    version: LATTICE_ATTESTATION_PROTOCOL_VERSION,
    type: "start",
    requestId,
    siteKey: "0x4AAAA-public-site-key",
    size: "flexible",
  };
  receive({ origin: "https://example.com", source: parentWindow, data: validStart });
  receive({ origin: "https://hah.dev", source: {}, data: validStart });
  receive({ origin: "https://hah.dev", source: parentWindow, data: { ...validStart, source: "forbidden" } });
  assert.equal(appendCount, 0);

  receive({ origin: "https://hah.dev", source: parentWindow, data: validStart });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(appendCount, 1);
  assert.equal(executeCount, 1);
  assert.equal(script.src, "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
  assert.equal(script.referrerPolicy, "no-referrer");
  assert.equal(renderOptions.sitekey, validStart.siteKey);
  assert.equal(renderOptions.action, "text_to_lattice");
  assert.equal(renderOptions["response-field"], false);
  assert.equal(renderOptions["feedback-enabled"], false);
  assert.equal(status.textContent, "The acquisition check is starting.");

  renderOptions["before-interactive-callback"]();
  assert.equal(status.textContent, "Complete the acquisition check to continue.");
  assert.deepEqual(plainData(posted.at(-1)), {
    targetOrigin: "https://hah.dev",
    value: {
      protocol: LATTICE_ATTESTATION_PROTOCOL,
      version: LATTICE_ATTESTATION_PROTOCOL_VERSION,
      type: "interactive",
      requestId,
    },
  });
  renderOptions.callback("0.valid-token");
  assert.equal(status.textContent, "The acquisition check is complete.");
  assert.deepEqual(plainData(posted.at(-1)), {
    targetOrigin: "https://hah.dev",
    value: {
      protocol: LATTICE_ATTESTATION_PROTOCOL,
      version: LATTICE_ATTESTATION_PROTOCOL_VERSION,
      type: "token",
      requestId,
      token: "0.valid-token",
    },
  });
  assert.equal(removedWidget, "widget-id");
});

test("the verification origin ships a restrictive embed policy and static-only route", () => {
  assert.match(frameHeaders, /Content-Security-Policy: default-src 'none';/u);
  assert.match(frameHeaders, /script-src 'self' https:\/\/challenges\.cloudflare\.com/u);
  assert.match(frameHeaders, /frame-ancestors https:\/\/hah\.dev/u);
  assert.match(frameHeaders, /Referrer-Policy: no-referrer/u);
  assert.match(frameHeaders, /Permissions-Policy: camera=\(\), document-domain=\(\), geolocation=\(\), microphone=\(\), payment=\(\), usb=\(\)/u);
  assert.match(frameHeaders, /X-Robots-Tag: noindex, nofollow, nosnippet/u);

  const config = JSON.parse(frameConfig);
  assert.equal(config.main, undefined);
  assert.deepEqual(config.assets, { directory: "./public" });
  assert.deepEqual(config.routes, [{ pattern: "verify.hah.dev", custom_domain: true }]);
  assert.equal(config.workers_dev, false);
  assert.equal(config.preview_urls, false);
  assert.equal(config.send_metrics, false);
  assert.deepEqual(config.observability, { enabled: false });
  assert.equal(LATTICE_USAGE_POLICY.freeTierBasis.verificationFrameWorkerCallsForDailyGrants, 0);
  assert.match(LATTICE_USAGE_POLICY.freeTierBasis.verificationFrameHosting, /Static Assets[\s\S]*?no Worker script/iu);
});
