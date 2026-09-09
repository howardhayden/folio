import {
  hardenedLatticeCacheMatch,
  hardenedLatticeAssetRequest,
  isAllowedLatticeAssetUrl,
} from "./assetRequestPolicy.js";
import { LATTICE_MODEL_ROLES, LOCAL_LATTICE_MODEL } from "./modelContract.js";
import {
  ANALYSIS_SCHEMA,
  CANDIDATE_SCHEMA,
  DOCUMENT_CERTIFICATION_SCHEMA,
  REANALYSIS_SCHEMA,
  VERIFICATION_SCHEMA,
} from "./promptContract.js";
import {
  LATTICE_MODEL_RPC_MAX_PENDING,
  LATTICE_MODEL_RPC_MAX_RESPONSE_TEXT,
  latticeModelRpcFailure,
  latticeModelRpcProgress,
  latticeModelRpcSuccess,
  parseLatticeModelRpcRequest,
  serializeLatticeModelError,
} from "./modelRpc.js";

const CONTEXT_WINDOW_TOKENS = 4_096;
const nativeFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  if (isAllowedLatticeAssetUrl(request)) {
    return nativeFetch(hardenedLatticeAssetRequest(request));
  }
  const url = new URL(request.url);
  if ((url.protocol === "blob:" || url.protocol === "data:") && request.method === "GET" && request.body === null) {
    return nativeFetch(new Request(request.url, { method: "GET", credentials: "omit", referrerPolicy: "no-referrer" }));
  }
  return Promise.reject(new TypeError("Text to Lattice blocked an unexpected worker request."));
}) as typeof fetch;

if (typeof Cache !== "undefined") {
  const nativeCacheMatch = Cache.prototype.match;
  const nativeCacheDelete = Cache.prototype.delete;
  Cache.prototype.match = function match(input: RequestInfo | URL, options?: CacheQueryOptions) {
    return hardenedLatticeCacheMatch(this, nativeCacheMatch, nativeCacheDelete, input, options);
  };

  const nativeCacheAdd = Cache.prototype.add;
  Cache.prototype.add = function add(input: RequestInfo | URL) {
    return nativeCacheAdd.call(this, hardenedLatticeAssetRequest(input));
  };

  const nativeCacheAddAll = Cache.prototype.addAll;
  Cache.prototype.addAll = function addAll(inputs: Iterable<RequestInfo | URL>) {
    return nativeCacheAddAll.call(
      this,
      Array.from(inputs, (input) => hardenedLatticeAssetRequest(input)),
    );
  };
}

for (const constructorName of ["XMLHttpRequest", "WebSocket", "EventSource", "WebTransport"] as const) {
  if (!(constructorName in globalThis)) continue;
  Object.defineProperty(globalThis, constructorName, {
    configurable: false,
    value: class BlockedWorkerNetworkTransport {
      constructor() {
        throw new TypeError("Text to Lattice blocked an unexpected worker network transport.");
      }
    },
    writable: false,
  });
}

// These modules evaluate only after the worker's network and cache boundaries are installed.
const guardedWebLlmModule = import("@mlc-ai/web-llm");
const guardedTokenizerModule = import("@mlc-ai/web-tokenizers");

type WebLlmModule = Awaited<typeof guardedWebLlmModule>;
type ModelEngine = Awaited<ReturnType<WebLlmModule["CreateMLCEngine"]>>;
type TokenizerModule = Awaited<typeof guardedTokenizerModule>;
type ModelTokenizer = Awaited<ReturnType<TokenizerModule["Tokenizer"]["fromJSON"]>>;
type ModelRole = keyof typeof LATTICE_MODEL_ROLES;

const SCHEMAS = Object.freeze({
  analysis: ANALYSIS_SCHEMA,
  reanalysis: REANALYSIS_SCHEMA,
  candidate: CANDIDATE_SCHEMA,
  verification: VERIFICATION_SCHEMA,
  certification: DOCUMENT_CERTIFICATION_SCHEMA,
});

let modelEngine: ModelEngine | null = null;
let activeModelRole: ModelRole | null = null;
let queuedRequestCount = 0;
let operationQueue = Promise.resolve();
const tokenizerPromises = new Map<ModelRole, Promise<ModelTokenizer>>();

function localAppConfig(webllm: WebLlmModule) {
  const records = LOCAL_LATTICE_MODEL.models.map((model) => {
    const record = webllm.prebuiltAppConfig.model_list.find(({ model_id: modelId }) => modelId === model.id);
    if (!record) throw new Error(`The configured local model ${model.id} is unavailable in this WebLLM build.`);
    return {
      ...record,
      model: model.model,
      model_lib: model.modelLib,
    };
  });
  return { model_list: records, useIndexedDBCache: false };
}

function postFailure(id: number, operation: string, error: unknown) {
  self.postMessage(latticeModelRpcFailure(id, operation, serializeLatticeModelError(error)));
}

function progressCallback(id: number, role: ModelRole) {
  return (report: { progress?: number; text?: string }) => {
    self.postMessage(latticeModelRpcProgress(id, role, report));
  };
}

async function prepareRole(role: ModelRole, id: number) {
  if (modelEngine && activeModelRole === role) return;
  const webllm = await guardedWebLlmModule;
  const progress = progressCallback(id, role);
  if (!modelEngine) {
    try {
      modelEngine = await webllm.CreateMLCEngine(
        LATTICE_MODEL_ROLES[role].id,
        { appConfig: localAppConfig(webllm), logLevel: "SILENT", initProgressCallback: progress },
        { context_window_size: CONTEXT_WINDOW_TOKENS },
      );
      activeModelRole = role;
      return;
    } catch (error) {
      modelEngine = null;
      activeModelRole = null;
      throw error;
    }
  }

  modelEngine.setInitProgressCallback(progress);
  try {
    await modelEngine.reload(
      LATTICE_MODEL_ROLES[role].id,
      { context_window_size: CONTEXT_WINDOW_TOKENS },
    );
    activeModelRole = role;
  } catch (error) {
    const failedEngine = modelEngine;
    modelEngine = null;
    activeModelRole = null;
    await failedEngine.unload().catch(() => {});
    throw error;
  }
}

async function tokenizerForRole(role: ModelRole) {
  let loading = tokenizerPromises.get(role);
  if (!loading) {
    loading = (async () => {
      const [{ Tokenizer }, response] = await Promise.all([
        guardedTokenizerModule,
        fetch(new URL("tokenizer.json", LATTICE_MODEL_ROLES[role].model), {
          cache: "force-cache",
          mode: "cors",
        }),
      ]);
      if (!response.ok) throw new Error(`The ${role} tokenizer could not be loaded.`);
      return Tokenizer.fromJSON(await response.arrayBuffer());
    })().catch((error) => {
      tokenizerPromises.delete(role);
      throw error;
    });
    tokenizerPromises.set(role, loading);
  }
  return loading;
}

async function unloadRuntime() {
  const engine = modelEngine;
  modelEngine = null;
  activeModelRole = null;
  if (engine) await engine.unload().catch(() => {});
  for (const tokenizerPromise of tokenizerPromises.values()) {
    tokenizerPromise.then((tokenizer) => tokenizer.dispose()).catch(() => {});
  }
  tokenizerPromises.clear();
}

async function runRequest(request: NonNullable<ReturnType<typeof parseLatticeModelRpcRequest>>) {
  const { id, operation, payload } = request;
  try {
    switch (operation) {
      case "cached": {
        const webllm = await guardedWebLlmModule;
        const appConfig = localAppConfig(webllm);
        const cached = await Promise.all(
          LOCAL_LATTICE_MODEL.models.map(({ id: modelId }) => webllm.hasModelInCache(modelId, appConfig)),
        );
        self.postMessage(latticeModelRpcSuccess(id, operation, cached.every(Boolean)));
        return;
      }
      case "prepare":
        await prepareRole(payload.role as ModelRole, id);
        self.postMessage(latticeModelRpcSuccess(id, operation, null));
        return;
      case "token-count": {
        const tokenizer = await tokenizerForRole(payload.role as ModelRole);
        const count = tokenizer.encode(payload.serialized).length;
        self.postMessage(latticeModelRpcSuccess(id, operation, count));
        return;
      }
      case "complete": {
        const role = payload.role as ModelRole;
        const schema = payload.schema as keyof typeof SCHEMAS;
        await prepareRole(role, id);
        if (!modelEngine) throw new Error("The local model was not prepared.");
        const generatorInference = LATTICE_MODEL_ROLES.generator.inference;
        const inference = role === "generator"
          ? generatorInference.stages[schema as keyof typeof generatorInference.stages]
          : LATTICE_MODEL_ROLES.verifier.inference;
        if (!inference) throw new TypeError("The local generator received an unsupported completion stage.");
        const response = await modelEngine.chat.completions.create({
          model: LATTICE_MODEL_ROLES[role].id,
          messages: payload.messages,
          temperature: inference.temperature,
          top_p: inference.topP,
          seed: LATTICE_MODEL_ROLES[role].inference.seed,
          max_tokens: payload.maxTokens,
          response_format: { type: "json_object", schema: JSON.stringify(SCHEMAS[schema]) },
          ...(role === "generator" ? { extra_body: { enable_thinking: false } } : {}),
        });
        const choice = response.choices[0];
        const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
        const content = typeof choice?.message?.content === "string" ? choice.message.content : null;
        if (content && content.length > LATTICE_MODEL_RPC_MAX_RESPONSE_TEXT) {
          throw new RangeError("The local model returned an oversized response.");
        }
        self.postMessage(latticeModelRpcSuccess(id, operation, { finishReason, content }));
        return;
      }
      case "unload":
        await unloadRuntime();
        self.postMessage(latticeModelRpcSuccess(id, operation, null));
        return;
      default:
        throw new TypeError("Text to Lattice rejected an unsupported model-worker operation.");
    }
  } catch (error) {
    postFailure(id, operation, error);
  }
}

async function interruptRequest(request: NonNullable<ReturnType<typeof parseLatticeModelRpcRequest>>) {
  try {
    await modelEngine?.interruptGenerate();
    self.postMessage(latticeModelRpcSuccess(request.id, request.operation, null));
  } catch (error) {
    postFailure(request.id, request.operation, error);
  }
}

self.onmessage = (message: MessageEvent) => {
  const request = parseLatticeModelRpcRequest(message.data);
  if (!request) return;
  if (request.operation === "interrupt") {
    void interruptRequest(request);
    return;
  }
  if (queuedRequestCount >= LATTICE_MODEL_RPC_MAX_PENDING) {
    postFailure(request.id, request.operation, new RangeError("The local model worker queue is full."));
    return;
  }
  queuedRequestCount += 1;
  operationQueue = operationQueue
    .then(() => runRequest(request))
    .finally(() => {
      queuedRequestCount -= 1;
    })
    .catch(() => {});
};
