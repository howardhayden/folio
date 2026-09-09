import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { basename } from "node:path";
import test from "node:test";
import vm from "node:vm";

import { LATTICE_MODEL_ROLES } from "../app/resume/lattice/modelContract.js";
import { createLatticeModelRpcRequest } from "../app/resume/lattice/modelRpc.js";

const workerDirectory = new URL("../site/_next/static/workers/", import.meta.url);
const workerFilenamePattern = /^latticeWebllm\.worker-[A-Za-z0-9_-]+\.js$/u;
const responseTimeoutMs = 10_000;

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("the emitted model Worker boots in a Worker realm and reaches its first guarded model request", { timeout: 20_000 }, async () => {
  const workerFilenames = (await readdir(workerDirectory)).filter((filename) => workerFilenamePattern.test(filename));
  assert.equal(workerFilenames.length, 1, "the Pages artifact must contain exactly one emitted model Worker");

  const workerUrl = new URL(workerFilenames[0], workerDirectory);
  const workerSource = await readFile(workerUrl, "utf8");
  const cacheAdds = [];
  const networkRequests = [];
  const responseWaiters = new Map();

  class WorkerHarnessStop extends Error {
    constructor() {
      super("intentional emitted-worker smoke stop");
      this.name = "WorkerHarnessStop";
    }
  }

  class MockCache {
    async keys() {
      return [];
    }

    async match() {
      return undefined;
    }

    async delete() {
      return true;
    }

    async add(request) {
      cacheAdds.push(new Request(request).url);
      throw new WorkerHarnessStop();
    }

    async addAll(requests) {
      cacheAdds.push(...Array.from(requests, (request) => new Request(request).url));
      throw new WorkerHarnessStop();
    }
  }

  const sandbox = {
    AbortController,
    AbortSignal,
    Blob,
    Cache: MockCache,
    DOMException,
    File,
    FormData,
    Headers,
    Request,
    Response,
    TextDecoder,
    TextEncoder,
    URL,
    URLSearchParams,
    WebAssembly,
    atob,
    btoa,
    caches: {
      async open() {
        return new MockCache();
      },
    },
    clearInterval,
    clearTimeout,
    console,
    crypto,
    fetch: async (input, init) => {
      networkRequests.push(new Request(input, init).url);
      throw new WorkerHarnessStop();
    },
    importScripts() {
      throw new WorkerHarnessStop();
    },
    location: { href: `https://hah.dev/_next/static/workers/${basename(workerUrl.pathname)}` },
    navigator: { language: "en-US", languages: ["en-US"] },
    performance,
    postMessage(message) {
      const response = jsonClone(message);
      if (response.kind !== "response") return;
      const waiter = responseWaiters.get(response.id);
      if (!waiter) return;
      responseWaiters.delete(response.id);
      clearTimeout(waiter.timeout);
      waiter.resolve(response);
    },
    queueMicrotask,
    setInterval,
    setTimeout,
    structuredClone,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext("globalThis.self = globalThis", context);
  assert.equal(vm.runInContext("self === globalThis", context), true);
  for (const windowOnlyGlobal of ["window", "document", "process"]) {
    assert.equal(vm.runInContext(`typeof ${windowOnlyGlobal}`, context), "undefined");
  }

  new vm.Script(workerSource, { filename: workerUrl.pathname }).runInContext(context, { timeout: 10_000 });

  function send(request) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        responseWaiters.delete(request.id);
        reject(new Error(`The emitted model Worker did not answer ${request.operation}.`));
      }, responseTimeoutMs);
      responseWaiters.set(request.id, { resolve, timeout });
      try {
        vm.runInContext(`self.onmessage({ data: ${JSON.stringify(request)} })`, context);
      } catch (error) {
        responseWaiters.delete(request.id);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  assert.deepEqual(
    await send(createLatticeModelRpcRequest(1, "cached", {})),
    {
      channel: "text-to-lattice:model:v1",
      kind: "response",
      id: 1,
      operation: "cached",
      ok: true,
      value: false,
    },
  );

  assert.deepEqual(
    await send(createLatticeModelRpcRequest(2, "prepare", { role: "generator" })),
    {
      channel: "text-to-lattice:model:v1",
      kind: "response",
      id: 2,
      operation: "prepare",
      ok: false,
      error: {
        name: "WorkerHarnessStop",
        message: "intentional emitted-worker smoke stop",
      },
    },
  );
  assert.deepEqual(cacheAdds, [new URL("mlc-chat-config.json", LATTICE_MODEL_ROLES.generator.model).href]);
  assert.deepEqual(networkRequests, []);
});
