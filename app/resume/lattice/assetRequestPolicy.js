import {
  LATTICE_MODEL_ROLES,
  LATTICE_TOKENIZER_FILENAME,
  LATTICE_TOKENIZER_SHA256,
  LATTICE_TOKENIZER_SRI,
  LATTICE_WASM_SHA256,
  LATTICE_WASM_SRI,
} from "./modelContract.js";

const sha256Pattern = /^[0-9a-f]{64}$/u;
const sha256SriPattern = /^sha256-[A-Za-z0-9+/]{43}=$/u;

export function validateLatticeAssetIntegrity(sha256, integrity) {
  if (!sha256Pattern.test(sha256) || !sha256SriPattern.test(integrity)) {
    throw new TypeError("Text to Lattice rejected an invalid protected-asset integrity record.");
  }
  let decoded;
  try {
    decoded = atob(integrity.slice("sha256-".length));
  } catch {
    throw new TypeError("Text to Lattice rejected an invalid protected-asset integrity record.");
  }
  const decodedHex = Array.from(decoded, (character) => (
    character.charCodeAt(0).toString(16).padStart(2, "0")
  )).join("");
  if (decoded.length !== 32 || decodedHex !== sha256) {
    throw new TypeError("Text to Lattice rejected an invalid protected-asset integrity record.");
  }
  return integrity;
}

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
const PROTECTED_ASSETS = Object.freeze(Object.entries(LATTICE_MODEL_ROLES).flatMap(([role, model]) => [
  Object.freeze({
    integrity: validateLatticeAssetIntegrity(LATTICE_WASM_SHA256[role], LATTICE_WASM_SRI[role]),
    sha256: LATTICE_WASM_SHA256[role],
    url: model.modelLib,
  }),
  Object.freeze({
    integrity: validateLatticeAssetIntegrity(LATTICE_TOKENIZER_SHA256[role], LATTICE_TOKENIZER_SRI[role]),
    sha256: LATTICE_TOKENIZER_SHA256[role],
    url: new URL(LATTICE_TOKENIZER_FILENAME, model.model).href,
  }),
]));
const INTEGRITY_BY_ASSET_URL = new Map(PROTECTED_ASSETS.map(({ integrity, url }) => [url, integrity]));
const PROTECTED_ASSET_BY_URL = new Map(PROTECTED_ASSETS.map((asset) => [asset.url, asset]));

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

export function latticeAssetIntegrity(input) {
  let url;
  try {
    url = new URL(input instanceof Request ? input.url : input);
  } catch {
    return null;
  }
  return INTEGRITY_BY_ASSET_URL.get(url.href) ?? null;
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
    integrity: latticeAssetIntegrity(request) ?? request.integrity,
    keepalive: false,
    method: "GET",
    mode: request.mode,
    referrerPolicy: "no-referrer",
    redirect: request.redirect,
    signal: request.signal,
  });
}

export async function hardenedLatticeCacheMatch(cache, nativeMatch, nativeDelete, input, options) {
  const request = hardenedLatticeAssetRequest(input);
  const response = await nativeMatch.call(cache, request, options);
  const protectedAsset = PROTECTED_ASSET_BY_URL.get(request.url);
  if (!response || !protectedAsset) return response;

  let matches = false;
  try {
    const bytes = await response.clone().arrayBuffer();
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    const digestHex = Array.from(new Uint8Array(digest), (byte) => (
      byte.toString(16).padStart(2, "0")
    )).join("");
    matches = digestHex === protectedAsset.sha256;
  } catch {
    // An unreadable or unverifiable protected response must be treated as a miss.
  }
  if (matches) return response;

  await nativeDelete.call(cache, request, { ignoreVary: true });
  return undefined;
}
