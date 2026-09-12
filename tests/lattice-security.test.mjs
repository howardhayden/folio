import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  hardenedLatticeCacheMatch,
  hardenedLatticeAssetRequest,
  isAllowedLatticeAssetUrl,
  latticeAssetIntegrity,
  validateLatticeAssetIntegrity,
} from "../app/resume/lattice/assetRequestPolicy.js";
import {
  LATTICE_MODEL_ROLES,
  LATTICE_TOKENIZER_SHA256,
  LATTICE_TOKENIZER_SRI,
  LATTICE_WASM_BASE,
  LATTICE_WASM_REVISION,
  LATTICE_WASM_SHA256,
  LATTICE_WASM_SRI,
} from "../app/resume/lattice/modelContract.js";
import {
  LATTICE_ENVIRONMENT_TIMEOUTS,
  LATTICE_COMPLETION_CALL_LIMIT,
  claimLatticeCompletionCall,
  createLocalLatticeAdapter,
  discardLocalLatticeModel,
  isLocalLatticeModelCached,
  prepareLocalLatticeModel,
  probeLocalLatticeCapability,
  probeLocalLatticeStorage,
} from "../app/resume/lattice/localModel.js";
import {
  LATTICE_MODEL_RPC_MAX_MESSAGE_TEXT,
  createLatticeModelRpcRequest,
  latticeModelRpcFailure,
  latticeModelRpcProgress,
  latticeModelRpcStarted,
  latticeModelRpcSuccess,
  parseLatticeModelRpcMessage,
  parseLatticeModelRpcRequest,
  serializeLatticeModelError,
} from "../app/resume/lattice/modelRpc.js";

test("model asset requests are fixed, credential-free, bodyless, and no-referrer", () => {
  const modelUrl = new URL("tokenizer.json", LATTICE_MODEL_ROLES.generator.model).href;
  const request = hardenedLatticeAssetRequest(modelUrl, {
    headers: {
      Authorization: "Bearer must-not-leave",
      Cookie: "must-not-leave=yes",
      Referer: "https://hah.dev/resume/",
      "X-Benign": "retained",
    },
  });
  assert.equal(request.method, "GET");
  assert.equal(request.body, null);
  assert.equal(request.credentials, "omit");
  assert.equal(request.referrerPolicy, "no-referrer");
  assert.equal(request.headers.has("authorization"), false);
  assert.equal(request.headers.has("cookie"), false);
  assert.equal(request.headers.has("referer"), false);
  assert.equal(request.headers.get("x-benign"), null);
  assert.equal(request.headers.get("accept"), "*/*");

  assert.equal(isAllowedLatticeAssetUrl(modelUrl), true);
  assert.equal(isAllowedLatticeAssetUrl(new URL("tensor-cache.json", LATTICE_MODEL_ROLES.generator.model)), true);
  assert.equal(isAllowedLatticeAssetUrl(`${LATTICE_WASM_BASE}/Qwen3-4B-q4f16_1-ctx4k_cs1k-webgpu.wasm`), true);
  for (const blocked of [
    "https://huggingface.co/unpinned/model/resolve/main/tokenizer.json",
    `${modelUrl}?source=entered-text`,
    `${LATTICE_MODEL_ROLES.generator.model}entered-source-text.bin`,
    `${LATTICE_MODEL_ROLES.generator.model}params_shard_1.bin/entered-source-text`,
    `${LATTICE_MODEL_ROLES.generator.model}params_shard_74.bin`,
    `${LATTICE_MODEL_ROLES.verifier.model}params_shard_58.bin`,
    `${LATTICE_MODEL_ROLES.generator.model}ndarray-cache.json`,
    `${LATTICE_MODEL_ROLES.generator.model}tokenizer_config.json`,
    `${LATTICE_MODEL_ROLES.generator.model}merges.txt`,
    modelUrl.replace("https://", "http://"),
    "https://example.invalid/model.bin",
  ]) {
    assert.equal(isAllowedLatticeAssetUrl(blocked), false, blocked);
    assert.throws(() => hardenedLatticeAssetRequest(blocked), /blocked an unexpected model-asset request/u);
  }
  assert.throws(() => hardenedLatticeAssetRequest(modelUrl, { method: "POST", body: "x" }), /blocked/u);

  for (const role of Object.values(LATTICE_MODEL_ROLES)) {
    assert.match(role.revision, /^[0-9a-f]{40}$/u);
    assert.ok(role.model.includes(`/resolve/${role.revision}/`));
    assert.equal(isAllowedLatticeAssetUrl(new URL("tokenizer.json", role.model)), true);
  }
  assert.equal(isAllowedLatticeAssetUrl(new URL("params_shard_73.bin", LATTICE_MODEL_ROLES.generator.model)), true);
  assert.equal(isAllowedLatticeAssetUrl(new URL("params_shard_57.bin", LATTICE_MODEL_ROLES.verifier.model)), true);
  assert.match(LATTICE_WASM_REVISION, /^[0-9a-f]{40}$/u);
  assert.ok(LATTICE_WASM_BASE.includes(`/${LATTICE_WASM_REVISION}/`));
});

test("pinned executable and tokenizer requests enforce their exact SHA-256 integrity", () => {
  for (const [role, model] of Object.entries(LATTICE_MODEL_ROLES)) {
    const tokenizerUrl = new URL("tokenizer.json", model.model);
    for (const [url, sha256, sri] of [
      [model.modelLib, LATTICE_WASM_SHA256[role], LATTICE_WASM_SRI[role]],
      [tokenizerUrl, LATTICE_TOKENIZER_SHA256[role], LATTICE_TOKENIZER_SRI[role]],
    ]) {
      assert.equal(sri, `sha256-${Buffer.from(sha256, "hex").toString("base64")}`);
      assert.equal(latticeAssetIntegrity(url), sri);
      assert.equal(latticeAssetIntegrity(new Request(url)), sri);
      assert.equal(hardenedLatticeAssetRequest(url).integrity, sri);
      assert.equal(hardenedLatticeAssetRequest(new Request(url)).integrity, sri);
      assert.equal(hardenedLatticeAssetRequest(url, { integrity: "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" }).integrity, sri);
      assert.equal(hardenedLatticeAssetRequest(new Request(url, { integrity: "sha384-forged" })).integrity, sri);
    }
  }

  const shardUrl = new URL("params_shard_0.bin", LATTICE_MODEL_ROLES.generator.model);
  const configUrl = new URL("mlc-chat-config.json", LATTICE_MODEL_ROLES.verifier.model);
  assert.equal(latticeAssetIntegrity(shardUrl), null);
  assert.equal(latticeAssetIntegrity(configUrl), null);
  assert.equal(hardenedLatticeAssetRequest(shardUrl).integrity, "");
  assert.equal(hardenedLatticeAssetRequest(new Request(configUrl, { integrity: "sha384-existing" })).integrity, "sha384-existing");

  for (const unknownUrl of [
    "https://example.invalid/unknown.wasm",
    new URL("tokenizer_config.json", LATTICE_MODEL_ROLES.generator.model),
    `${LATTICE_MODEL_ROLES.verifier.model}tokenizer.json?revision=forged`,
  ]) {
    assert.equal(latticeAssetIntegrity(unknownUrl), null);
    assert.throws(() => hardenedLatticeAssetRequest(unknownUrl), /blocked an unexpected model-asset request/u);
  }
});

test("protected-asset integrity records fail closed instead of silently downgrading", () => {
  assert.equal(
    validateLatticeAssetIntegrity(LATTICE_WASM_SHA256.generator, LATTICE_WASM_SRI.generator),
    LATTICE_WASM_SRI.generator,
  );
  for (const [sha256, integrity] of [
    [undefined, LATTICE_WASM_SRI.generator],
    [LATTICE_WASM_SHA256.generator, undefined],
    [LATTICE_WASM_SHA256.generator, "sha384-forged"],
    [LATTICE_WASM_SHA256.generator, "sha256-not-base64"],
    [LATTICE_WASM_SHA256.generator, LATTICE_WASM_SRI.verifier],
  ]) {
    assert.throws(
      () => validateLatticeAssetIntegrity(sha256, integrity),
      /invalid protected-asset integrity record/u,
    );
  }
});

test("protected cache hits are hashed, removed on mismatch, and treated as misses", async () => {
  for (const model of Object.values(LATTICE_MODEL_ROLES)) {
    for (const url of [model.modelLib, new URL("tokenizer.json", model.model)]) {
      const events = [];
      const poisonedResponse = new Response("pre-integrity poisoned cache entry");
      const cache = {};
      const nativeMatch = async function match(request, options) {
        events.push({ operation: "match", options, request });
        return poisonedResponse;
      };
      const nativeDelete = async function remove(request, options) {
        events.push({ operation: "delete", options, request });
        return true;
      };

      const result = await hardenedLatticeCacheMatch(
        cache,
        nativeMatch,
        nativeDelete,
        new Request(url, { integrity: "sha384-forged" }),
        { ignoreSearch: false },
      );
      events.push({ operation: "create-engine" });

      assert.equal(result, undefined);
      assert.deepEqual(events.map(({ operation }) => operation), ["match", "delete", "create-engine"]);
      assert.equal(events[0].request.integrity, latticeAssetIntegrity(url));
      assert.equal(events[1].request.integrity, latticeAssetIntegrity(url));
      assert.deepEqual(events[1].options, { ignoreVary: true });
    }
  }
});

test("an exact protected cache hit is preserved without a redownload", async (context) => {
  let bytes;
  try {
    bytes = await readFile(process.env.LATTICE_QWEN_TOKENIZER_JSON ?? "/tmp/qwen3-lattice-tokenizer.json");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    context.skip("fetch the pinned Qwen tokenizer fixture to exercise a valid protected cache hit");
    return;
  }

  const tokenizerUrl = new URL("tokenizer.json", LATTICE_MODEL_ROLES.generator.model);
  const cachedResponse = new Response(bytes);
  let deleteCalled = false;
  const result = await hardenedLatticeCacheMatch(
    {},
    async function match(request) {
      assert.equal(request.integrity, LATTICE_TOKENIZER_SRI.generator);
      return cachedResponse;
    },
    async function remove() {
      deleteCalled = true;
      return true;
    },
    tokenizerUrl,
  );
  assert.equal(result, cachedResponse);
  assert.equal(deleteCalled, false);
});

test("allowed unprotected cache hits pass through without hashing or deletion", async () => {
  const shardUrl = new URL("params_shard_0.bin", LATTICE_MODEL_ROLES.generator.model);
  const cachedResponse = { marker: "unchanged allowed shard" };
  const matchedRequests = [];
  const result = await hardenedLatticeCacheMatch(
    {},
    async function match(request) {
      matchedRequests.push(request);
      return cachedResponse;
    },
    async function remove() {
      assert.fail("an allowed unprotected cache hit must not be removed");
    },
    new Request(shardUrl, { integrity: "sha384-existing" }),
  );
  assert.equal(result, cachedResponse);
  assert.equal(matchedRequests[0].integrity, "sha384-existing");
});

test("cache matching blocks requests outside the worker asset boundary", async () => {
  let nativeMatchCalled = false;
  const nativeMatch = async () => {
    nativeMatchCalled = true;
    return new Response("must not be visible");
  };
  const nativeDelete = async () => assert.fail("blocked cache requests must not delete entries");
  for (const request of [
    "https://example.invalid/unknown.wasm",
    new Request(LATTICE_MODEL_ROLES.generator.modelLib, { method: "POST", body: "x" }),
  ]) {
    await assert.rejects(
      hardenedLatticeCacheMatch({}, nativeMatch, nativeDelete, request),
      /blocked an unexpected model-asset request/u,
    );
  }
  assert.equal(nativeMatchCalled, false);
});

test("the inference worker rejects unexpected external fetch destinations", async () => {
  const source = await readFile(new URL("../app/resume/lattice/latticeWebllm.worker.ts", import.meta.url), "utf8");
  const localModelSource = await readFile(new URL("../app/resume/lattice/localModel.js", import.meta.url), "utf8");
  assert.match(source, /isAllowedLatticeAssetUrl\(request\)/u);
  assert.match(source, /hardenedLatticeAssetRequest\(request\)/u);
  assert.doesNotMatch(source, /url\.origin === self\.location\.origin/u);
  assert.match(source, /blocked an unexpected worker request/u);
  assert.match(source, /Cache\.prototype\.match/u);
  assert.match(source, /Cache\.prototype\.addAll/u);
  assert.match(source, /hardenedLatticeCacheMatch\(this, nativeCacheMatch, nativeCacheDelete, input, options\)/u);
  assert.match(source, /guardedWebLlmModule = import\("@mlc-ai\/web-llm"\)/u);
  assert.match(source, /guardedTokenizerModule = import\("@mlc-ai\/web-tokenizers"\)/u);
  assert.ok(
    source.indexOf("globalThis.fetch =") < source.indexOf('import("@mlc-ai/web-llm")'),
    "the network boundary is installed before WebLLM evaluates",
  );
  assert.ok(
    source.indexOf("Cache.prototype.match =") < source.indexOf('import("@mlc-ai/web-llm")'),
    "the cache-read boundary is installed before WebLLM evaluates",
  );
  assert.ok(
    source.indexOf("Object.defineProperty(globalThis, constructorName") < source.indexOf('import("@mlc-ai/web-tokenizers")'),
    "all alternate transports are disabled before the tokenizer runtime evaluates",
  );
  assert.doesNotMatch(source, /^import .*@mlc-ai\/web-llm/mu);
  assert.doesNotMatch(source, /^import .*@mlc-ai\/web-tokenizers/mu);
  assert.doesNotMatch(localModelSource, /@mlc-ai\/web-(?:llm|tokenizers)/u);
  assert.doesNotMatch(localModelSource, /\bfetch\s*\(/u);
  assert.doesNotMatch(localModelSource, /chat\.completions|\.encode\(/u);
  assert.match(source, /modelEngine\.chat\.completions\.create/u);
  assert.match(source, /tokenizer\.encode\(payload\.serialized\)/u);
  for (const transport of ["XMLHttpRequest", "WebSocket", "EventSource", "WebTransport"]) {
    assert.ok(source.includes(`"${transport}"`));
  }
});

test("the model RPC rejects oversized, ambiguous, and mismatched messages", () => {
  const probe = createLatticeModelRpcRequest(2, "probe", {});
  assert.equal(parseLatticeModelRpcRequest(probe), probe);
  const probeSuccess = latticeModelRpcSuccess(2, "probe", { supported: true, reason: null });
  assert.equal(parseLatticeModelRpcMessage(probeSuccess, "probe"), probeSuccess);
  assert.equal(parseLatticeModelRpcMessage({ ...probeSuccess, value: { supported: "yes", reason: null } }, "probe"), null);

  const valid = createLatticeModelRpcRequest(1, "complete", {
    role: "generator",
    messages: [{ role: "user", content: "bounded" }],
    schema: "candidate",
    maxTokens: 800,
  });
  assert.equal(parseLatticeModelRpcRequest(valid), valid);
  assert.equal(parseLatticeModelRpcRequest({ ...valid, unexpected: true }), null);
  assert.equal(parseLatticeModelRpcRequest({ ...valid, payload: { ...valid.payload, role: "other" } }), null);
  assert.equal(parseLatticeModelRpcRequest({
    ...valid,
    payload: {
      ...valid.payload,
      messages: [{ role: "user", content: "x".repeat(LATTICE_MODEL_RPC_MAX_MESSAGE_TEXT + 1) }],
    },
  }), null);
  assert.equal(parseLatticeModelRpcRequest({ ...valid, payload: { ...valid.payload, maxTokens: 2_001 } }), null);

  const success = latticeModelRpcSuccess(1, "complete", { finishReason: "stop", content: "{}" });
  const started = latticeModelRpcStarted(1, "complete");
  assert.equal(parseLatticeModelRpcMessage(started, "complete"), started);
  assert.equal(parseLatticeModelRpcMessage(started, "prepare"), null);
  assert.equal(parseLatticeModelRpcMessage({ ...started, unexpected: true }, "complete"), null);
  assert.equal(parseLatticeModelRpcMessage(success, "complete"), success);
  assert.equal(parseLatticeModelRpcMessage(success, "token-count"), null);
  assert.equal(parseLatticeModelRpcMessage({ ...success, value: { finishReason: "stop", content: "{}", extra: true } }, "complete"), null);
  assert.equal(parseLatticeModelRpcMessage(latticeModelRpcProgress(1, "generator", { progress: 2, text: "loading" }), "complete")?.progress, 1);

  const serialized = serializeLatticeModelError(Object.assign(new RangeError("bounded"), {
    code: "bounded-code",
    stack: "must stay inside the worker",
  }));
  assert.deepEqual(serialized, { name: "RangeError", message: "bounded", code: "bounded-code" });
  const failure = latticeModelRpcFailure(1, "complete", serialized);
  assert.equal(parseLatticeModelRpcMessage(failure, "complete"), failure);
});

test("capability and preparation run through the worker and clear a completed download bar", async () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const workerDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  const operations = [];

  class FakeWorker {
    constructor() {
      this.listeners = new Map();
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    postMessage(request) {
      operations.push(request.operation);
      queueMicrotask(() => {
        this.listeners.get("message")?.({
          data: latticeModelRpcStarted(request.id, request.operation),
        });
        if (request.operation === "probe") {
          this.listeners.get("message")?.({
            data: latticeModelRpcSuccess(request.id, request.operation, { supported: true, reason: null }),
          });
          return;
        }
        if (request.operation === "prepare") {
          this.listeners.get("message")?.({
            data: latticeModelRpcProgress(request.id, request.payload.role, { progress: 1, text: "done" }),
          });
          this.listeners.get("message")?.({
            data: latticeModelRpcSuccess(request.id, request.operation, null),
          });
        }
      });
    }

    terminate() {}
  }

  const limits = {
    maxBufferSize: 268_435_456,
    maxStorageBufferBindingSize: 134_217_728,
    maxComputeWorkgroupStorageSize: 32_768,
    maxStorageBuffersPerShaderStage: 10,
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { isSecureContext: true } });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { gpu: { requestAdapter: async () => ({ limits }) } },
  });
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: FakeWorker });

  try {
    assert.deepEqual(await probeLocalLatticeCapability(), { supported: true, reason: null });
    const reports = [];
    await prepareLocalLatticeModel({ onProgress: (report) => reports.push(report) });
    assert.deepEqual(operations, ["probe", "prepare"]);
    assert.equal(reports.at(-1)?.phase, "initializing-model");
    assert.equal(reports.at(-1)?.progress, null);
  } finally {
    discardLocalLatticeModel();
    for (const [name, descriptor] of [
      ["window", windowDescriptor],
      ["navigator", navigatorDescriptor],
      ["Worker", workerDescriptor],
    ]) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});

test("environment probes settle and distinguish retryable checks from hardware negatives", async () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = [];
  globalThis.setTimeout = (callback, milliseconds) => {
    const timer = { callback, milliseconds, cleared: false };
    timers.push(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => { if (timer) timer.cleared = true; };
  Object.defineProperty(globalThis, "window", { configurable: true, value: { isSecureContext: true } });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      gpu: { requestAdapter: () => new Promise(() => {}) },
      storage: { estimate: () => new Promise(() => {}) },
    },
  });
  try {
    const capability = probeLocalLatticeCapability();
    const adapterDeadline = timers.find(({ milliseconds }) => milliseconds === LATTICE_ENVIRONMENT_TIMEOUTS.adapter);
    assert.ok(adapterDeadline);
    adapterDeadline.callback();
    await assert.rejects(capability, /did not finish checking its WebGPU adapter/u);

    const storage = probeLocalLatticeStorage();
    const storageDeadline = timers.find(({ milliseconds, cleared }) => milliseconds === LATTICE_ENVIRONMENT_TIMEOUTS.storage && !cleared);
    assert.ok(storageDeadline);
    storageDeadline.callback();
    assert.deepEqual(await storage, { known: false, sufficient: null, availableBytes: null });
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
    else delete globalThis.window;
    if (navigatorDescriptor) Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    else delete globalThis.navigator;
  }
});

test("preparation progress survives WebLLM phase resets without restoring a completed bar", async () => {
  const previousWorker = globalThis.Worker;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = [];
  const workers = [];
  class FakeWorker {
    constructor() {
      this.listeners = new Map();
      this.terminated = false;
      this.request = null;
      workers.push(this);
    }

    addEventListener(type, listener) { this.listeners.set(type, listener); }
    postMessage(request) { this.request = request; }
    terminate() { this.terminated = true; }
  }
  globalThis.setTimeout = (callback, milliseconds) => {
    const timer = { callback, milliseconds, cleared: false };
    timers.push(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => { if (timer) timer.cleared = true; };
  globalThis.Worker = FakeWorker;
  try {
    const reports = [];
    const preparing = prepareLocalLatticeModel({ onProgress: (report) => reports.push(report) });
    workers[0].listeners.get("message")?.({
      data: latticeModelRpcStarted(workers[0].request.id, workers[0].request.operation),
    });
    const send = (progress) => workers[0].listeners.get("message")?.({
      data: latticeModelRpcProgress(workers[0].request.id, "generator", { progress, text: `progress ${progress}` }),
    });
    const initialInactivity = timers.find(({ milliseconds }) => milliseconds === 120_000);
    assert.ok(initialInactivity);
    send(0.5);
    const advancedInactivity = timers.find(({ milliseconds, cleared }) => milliseconds === 120_000 && !cleared);
    assert.ok(advancedInactivity);
    send(0.5);
    assert.equal(advancedInactivity.cleared, false, "duplicate progress does not slide the watchdog");
    send(1);
    send(0.1);
    send(0.2);
    send(1);
    assert.equal(timers.some(({ milliseconds, cleared }) => milliseconds === 60_000 && !cleared), false,
      "a phase-local 100 percent report is not treated as global finalization");
    assert.ok(reports.slice(-4).every(({ phase, progress }) => phase === "initializing-model" && progress === null),
      "once one phase completes, later phase resets remain nondeterminate");
    workers[0].listeners.get("message")?.({
      data: latticeModelRpcSuccess(workers[0].request.id, workers[0].request.operation, null),
    });
    await preparing;
    assert.equal(workers[0].terminated, false);
  } finally {
    discardLocalLatticeModel();
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    if (previousWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = previousWorker;
  }
});

test("a duplicate preparation report cannot postpone the active inactivity deadline", async () => {
  const previousWorker = globalThis.Worker;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = [];
  const workers = [];
  class FakeWorker {
    constructor() {
      this.listeners = new Map();
      this.terminated = false;
      this.request = null;
      workers.push(this);
    }

    addEventListener(type, listener) { this.listeners.set(type, listener); }
    postMessage(request) { this.request = request; }
    terminate() { this.terminated = true; }
  }
  globalThis.setTimeout = (callback, milliseconds) => {
    const timer = { callback, milliseconds, cleared: false };
    timers.push(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => { if (timer) timer.cleared = true; };
  globalThis.Worker = FakeWorker;
  try {
    const preparing = prepareLocalLatticeModel();
    const request = workers[0].request;
    const deliver = (data) => workers[0].listeners.get("message")?.({ data });
    deliver(latticeModelRpcStarted(request.id, request.operation));
    deliver(latticeModelRpcProgress(request.id, "generator", { progress: 0.25, text: "phase" }));
    const activeInactivity = timers.findLast(({ milliseconds, cleared }) => milliseconds === 120_000 && !cleared);
    assert.ok(activeInactivity);
    deliver(latticeModelRpcProgress(request.id, "generator", { progress: 0.25, text: "duplicate" }));
    assert.equal(activeInactivity.cleared, false);
    activeInactivity.callback();
    await assert.rejects(preparing, /stopped making progress during prepare/u);
    assert.equal(workers[0].terminated, true);
  } finally {
    discardLocalLatticeModel();
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    if (previousWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = previousWorker;
  }
});

test("queued RPC deadlines begin only when the worker starts that request", async () => {
  const previousWorker = globalThis.Worker;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = [];
  const workers = [];
  class FakeWorker {
    constructor() {
      this.listeners = new Map();
      this.requests = [];
      this.terminated = false;
      workers.push(this);
    }

    addEventListener(type, listener) { this.listeners.set(type, listener); }
    postMessage(request) { this.requests.push(request); }
    terminate() { this.terminated = true; }
  }
  globalThis.setTimeout = (callback, milliseconds) => {
    const timer = { callback, milliseconds, cleared: false };
    timers.push(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => { if (timer) timer.cleared = true; };
  globalThis.Worker = FakeWorker;
  try {
    const preparing = prepareLocalLatticeModel();
    const worker = workers[0];
    const prepareRequest = worker.requests[0];
    const deliver = (data) => worker.listeners.get("message")?.({ data });
    deliver(latticeModelRpcStarted(prepareRequest.id, prepareRequest.operation));
    const cached = isLocalLatticeModelCached();
    const cachedRequest = worker.requests[1];
    assert.equal(timers.some(({ milliseconds, cleared }) => milliseconds === 30_000 && !cleared), false,
      "the queued cache probe has no execution deadline while preparation is active");
    deliver(latticeModelRpcSuccess(prepareRequest.id, prepareRequest.operation, null));
    await preparing;
    const queuedStartWatchdog = timers.findLast(({ milliseconds, cleared }) => milliseconds === 30_000 && !cleared);
    assert.ok(queuedStartWatchdog, "the next queued request is bounded while waiting for its start acknowledgement");
    deliver(latticeModelRpcStarted(cachedRequest.id, cachedRequest.operation));
    assert.equal(queuedStartWatchdog.cleared, true);
    const cacheExecutionDeadline = timers.findLast(({ milliseconds, cleared }) => milliseconds === 30_000 && !cleared);
    assert.ok(cacheExecutionDeadline);
    deliver(latticeModelRpcSuccess(cachedRequest.id, cachedRequest.operation, true));
    assert.equal(await cached, true);
    assert.equal(worker.terminated, false);
  } finally {
    discardLocalLatticeModel();
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    if (previousWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = previousWorker;
  }
});

test("only the queue head owns a start watchdog before the first acknowledgement", async () => {
  const previousWorker = globalThis.Worker;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timers = [];
  const workers = [];
  class FakeWorker {
    constructor() {
      this.listeners = new Map();
      this.requests = [];
      this.terminated = false;
      workers.push(this);
    }

    addEventListener(type, listener) { this.listeners.set(type, listener); }
    postMessage(request) { this.requests.push(request); }
    terminate() { this.terminated = true; }
  }
  globalThis.setTimeout = (callback, milliseconds) => {
    const timer = { callback, milliseconds, cleared: false };
    timers.push(timer);
    return timer;
  };
  globalThis.clearTimeout = (timer) => { if (timer) timer.cleared = true; };
  globalThis.Worker = FakeWorker;
  try {
    const preparing = prepareLocalLatticeModel();
    const cached = isLocalLatticeModelCached();
    const worker = workers[0];
    const [prepareRequest, cachedRequest] = worker.requests;
    const liveStartTimers = () => timers.filter(({ milliseconds, cleared }) => (
      milliseconds === 30_000 && !cleared
    ));
    assert.equal(liveStartTimers().length, 1, "the unstarted queue has one head watchdog");
    const deliver = (data) => worker.listeners.get("message")?.({ data });
    deliver(latticeModelRpcStarted(prepareRequest.id, prepareRequest.operation));
    assert.equal(liveStartTimers().length, 0, "the queue-head watchdog clears on acknowledgement");
    deliver(latticeModelRpcSuccess(prepareRequest.id, prepareRequest.operation, null));
    await preparing;
    assert.equal(liveStartTimers().length, 1, "the successor becomes bounded only after the head settles");
    deliver(latticeModelRpcStarted(cachedRequest.id, cachedRequest.operation));
    deliver(latticeModelRpcSuccess(cachedRequest.id, cachedRequest.operation, true));
    assert.equal(await cached, true);
    assert.equal(worker.terminated, false);
  } finally {
    discardLocalLatticeModel();
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    if (previousWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = previousWorker;
  }
});

test("aborting an RPC rejects pending work, terminates its worker, and permits a clean successor", async () => {
  const previousWorker = globalThis.Worker;
  const workers = [];
  class FakeWorker {
    constructor() {
      this.listeners = new Map();
      this.terminated = false;
      workers.push(this);
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    postMessage(request) {
      if (request.operation !== "cached") return;
      queueMicrotask(() => {
        this.listeners.get("message")?.({ data: latticeModelRpcStarted(request.id, request.operation) });
        this.listeners.get("message")?.({
          data: latticeModelRpcSuccess(request.id, request.operation, true),
        });
      });
    }

    terminate() {
      this.terminated = true;
    }
  }

  globalThis.Worker = FakeWorker;
  try {
    const controller = new AbortController();
    const preparing = prepareLocalLatticeModel({ signal: controller.signal });
    controller.abort();
    await assert.rejects(preparing, (error) => error?.name === "AbortError");
    assert.equal(workers[0].terminated, true);
    assert.equal(await isLocalLatticeModelCached(), true);
    assert.equal(workers.length, 2);
  } finally {
    discardLocalLatticeModel();
    if (previousWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = previousWorker;
  }
});

test("context sizing and correction announce nondeterminate work before every model RPC", async () => {
  const previousWorker = globalThis.Worker;
  const observations = [];
  const reports = [];
  let completionCount = 0;

  class FakeWorker {
    constructor() {
      this.listeners = new Map();
    }

    addEventListener(type, listener) {
      this.listeners.set(type, listener);
    }

    postMessage(request) {
      if (request.operation === "token-count" || request.operation === "complete") {
        observations.push({
          operation: request.operation,
          phase: reports.at(-1)?.phase,
          progress: reports.at(-1)?.progress,
          correction: request.operation === "token-count"
            ? request.payload.serialized.includes("<INVALID_MODEL_DATA>")
            : request.payload.messages.some(({ content }) => content.includes("<INVALID_MODEL_DATA>")),
        });
      }
      queueMicrotask(() => {
        this.listeners.get("message")?.({
          data: latticeModelRpcStarted(request.id, request.operation),
        });
        if (request.operation === "prepare") {
          this.listeners.get("message")?.({
            data: latticeModelRpcSuccess(request.id, request.operation, null),
          });
          return;
        }
        if (request.operation === "token-count") {
          this.listeners.get("message")?.({
            data: latticeModelRpcSuccess(request.id, request.operation, 1),
          });
          return;
        }
        if (request.operation === "complete") {
          completionCount += 1;
          this.listeners.get("message")?.({
            data: latticeModelRpcSuccess(request.id, request.operation, {
              finishReason: "stop",
              content: completionCount === 1 ? "not JSON" : '{"corrected":true}',
            }),
          });
        }
      });
    }

    terminate() {}
  }

  globalThis.Worker = FakeWorker;
  try {
    const adapter = createLocalLatticeAdapter(undefined, {
      onProgress: (report) => reports.push(report),
    });
    const result = await adapter.analyze({
      batch: {
        id: "progress-order",
        passages: [{
          id: "p0001",
          text: "A short sentence.",
          separatorBefore: "",
          separatorAfter: "",
        }],
      },
      sourceSpans: [{
        passageId: "p0001",
        spans: [{ id: "p0001:s01", kind: "source", text: "A short sentence." }],
        literalAnnotations: [],
        directionFrames: [],
      }],
      context: null,
      documentLedger: [],
      clarificationAnswers: [],
    });

    assert.deepEqual(result, { corrected: true });
    const tokenCounts = observations.filter(({ operation }) => operation === "token-count");
    const completions = observations.filter(({ operation }) => operation === "complete");
    assert.ok(tokenCounts.length >= 3, "initial fitting, final sizing, and correction are each counted");
    assert.ok(tokenCounts.every(({ phase, progress }) => phase === "token-counting" && progress === null));
    assert.ok(completions.every(({ phase, progress }) => phase === "model-inference" && progress === null));
    assert.deepEqual(completions.map(({ correction }) => correction), [false, true]);
    assert.equal(tokenCounts.some(({ correction }) => correction), true,
      "the invalid first response enters the correction-sizing path");
  } finally {
    discardLocalLatticeModel();
    if (previousWorker === undefined) delete globalThis.Worker;
    else globalThis.Worker = previousWorker;
  }
});

test("local completion work uses a caller-shareable hard budget", () => {
  const shared = { used: 0, limit: LATTICE_COMPLETION_CALL_LIMIT };
  assert.doesNotThrow(() => createLocalLatticeAdapter(undefined, { completionBudget: shared }));
  assert.throws(
    () => createLocalLatticeAdapter(undefined, {
      completionBudget: { used: LATTICE_COMPLETION_CALL_LIMIT + 1, limit: LATTICE_COMPLETION_CALL_LIMIT },
    }),
    /invalid local completion budget/u,
  );

  for (let count = 0; count < LATTICE_COMPLETION_CALL_LIMIT; count += 1) {
    assert.doesNotThrow(() => claimLatticeCompletionCall(shared));
  }
  assert.equal(shared.used, LATTICE_COMPLETION_CALL_LIMIT);
  assert.throws(() => claimLatticeCompletionCall(shared), /local work limit/u);
  assert.equal(shared.used, LATTICE_COMPLETION_CALL_LIMIT);
});
