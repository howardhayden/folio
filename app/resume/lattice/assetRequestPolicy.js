import { LATTICE_MODEL_ROLES } from "./modelContract.js";

const sharedModelFiles = Object.freeze([
  "mlc-chat-config.json",
  "tensor-cache.json",
  "tokenizer.json",
]);
const shardFiles = (maximumIndex) => Array.from(
  { length: maximumIndex + 1 },
  (_, index) => `params_shard_${index}.bin`,
);
const MODEL_ASSET_MANIFEST = new Map([
  [LATTICE_MODEL_ROLES.generator.model, new Set([
    ...sharedModelFiles,
    ...shardFiles(73),
  ])],
  [LATTICE_MODEL_ROLES.verifier.model, new Set([
    ...sharedModelFiles,
    ...shardFiles(57),
  ])],
]);
const ALLOWED_MODEL_ROOTS = Object.freeze([...MODEL_ASSET_MANIFEST.keys()]);
const ALLOWED_WASM_URLS = new Set(Object.values(LATTICE_MODEL_ROLES).map(({ modelLib }) => modelLib));

export const LATTICE_ASSET_REQUEST_POLICY = Object.freeze({
  allowedModelRoots: ALLOWED_MODEL_ROOTS,
  allowedWasmUrls: Object.freeze([...ALLOWED_WASM_URLS]),
  credentials: "omit",
  referrerPolicy: "no-referrer",
  methods: Object.freeze(["GET"]),
});

export function isAllowedLatticeAssetUrl(input) {
  let url;
  try {
    url = new URL(input instanceof Request ? input.url : input);
  } catch {
    return false;
  }
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.search
    || url.hash
  ) return false;
  if (ALLOWED_WASM_URLS.has(url.href)) return true;
  return ALLOWED_MODEL_ROOTS.some((root) => {
    if (!url.href.startsWith(root)) return false;
    const relativePath = url.href.slice(root.length);
    return MODEL_ASSET_MANIFEST.get(root)?.has(relativePath) === true;
  });
}

export function hardenedLatticeAssetRequest(input, init) {
  const request = new Request(input, init);
  if (!isAllowedLatticeAssetUrl(request) || request.method !== "GET" || request.body !== null) {
    throw new TypeError("Text to Lattice blocked an unexpected model-asset request.");
  }
  return new Request(request.url, {
    cache: request.cache,
    credentials: "omit",
    headers: { Accept: "*/*" },
    integrity: request.integrity,
    keepalive: false,
    method: "GET",
    mode: request.mode,
    referrerPolicy: "no-referrer",
    redirect: request.redirect,
    signal: request.signal,
  });
}
