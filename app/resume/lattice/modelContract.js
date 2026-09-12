export const LATTICE_RUNTIME = Object.freeze({
  name: "WebLLM",
  version: "0.2.82",
  packageUrl: "https://www.npmjs.com/package/@mlc-ai/web-llm/v/0.2.82",
  documentationUrl: "https://webllm.mlc.ai/",
  repository: "https://github.com/mlc-ai/web-llm",
});

export const LATTICE_TOKENIZER_RUNTIME = Object.freeze({
  name: "Web Tokenizers",
  version: "0.1.6",
  packageUrl: "https://www.npmjs.com/package/@mlc-ai/web-tokenizers/v/0.1.6",
  repository: "https://github.com/mlc-ai/tokenizers-cpp",
});

export const LATTICE_TOKENIZER_FILENAME = "tokenizer.json";

export const LATTICE_STRUCTURED_OUTPUT_RUNTIME = Object.freeze({
  name: "MLC Web XGrammar",
  version: "0.1.27",
  packageUrl: "https://www.npmjs.com/package/@mlc-ai/web-xgrammar/v/0.1.27",
  repository: "https://github.com/mlc-ai/xgrammar",
  licenseName: "Apache License 2.0",
  licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
});

export const LATTICE_WASM_REVISION = "025bcaf3780fa8254f5e5efd3bfea0a5397248f4";
export const LATTICE_WASM_REPOSITORY = "https://github.com/mlc-ai/binary-mlc-llm-libs";
export const LATTICE_WASM_BASE = `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/${LATTICE_WASM_REVISION}/web-llm-models/v0_2_80`;

export const LATTICE_WASM_SHA256 = Object.freeze({
  generator: "5ddf44e49b03e53e24fd29a45591850924346140452f60c29280190388571340",
  verifier: "34de0d60ab598c6a85ae882b48474f250193076f902057a21070bb2daae96d5b",
});

export const LATTICE_WASM_SRI = Object.freeze({
  generator: "sha256-Xd9E5JsD5T4k/SmkVZGFCSQ0YUBFL2DCkoAZA4hXE0A=",
  verifier: "sha256-NN4NYKtZjGqFrogrSEdPJQGTB2+QIFeiEHC7LarpbVs=",
});

export const LATTICE_COMPATIBILITY_WASM = Object.freeze({
  generator: Object.freeze({
    name: "Qwen3-4B-q4f32_1-ctx4k_cs1k-webgpu.wasm",
    bytes: 5_929_497,
    gitBlob: "0031457311199bad79750852478fe44e2ae62627",
    modelLib: `${LATTICE_WASM_BASE}/Qwen3-4B-q4f32_1-ctx4k_cs1k-webgpu.wasm`,
    sha256: "6484148ff499c15433ab85e4d2c376aef453a6d797f48047e6bd6fd495a59e39",
    sri: "sha256-ZIQUj/SZwVQzq4Xk0sN2rvRTpteX9IBH5r1v1JWlnjk=",
  }),
  verifier: Object.freeze({
    name: "Llama-3.2-3B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
    bytes: 5_935_137,
    gitBlob: "5f1cc840767185ed275b008205cb27750a8abe8d",
    modelLib: `${LATTICE_WASM_BASE}/Llama-3.2-3B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm`,
    sha256: "224e4cd5c235621684257aad3ebfdaf6e337d50f783614d1e7ed63e78d693ad6",
    sri: "sha256-Ik5M1cI1YhaEJXqtPr/a9uM31Q94NhTR5+1j541pOtY=",
  }),
});

export function requiresCompatibleLatticeKernels(userAgent = "", shaderF16Supported = true) {
  const webKit = /AppleWebKit\//u.test(userAgent)
    && /Safari\//u.test(userAgent)
    && !/(?:Chrome|Chromium|CriOS|Edg|OPR|FxiOS)\//u.test(userAgent);
  const firefox = /(?:Firefox|FxiOS)\//u.test(userAgent);
  return webKit || firefox || shaderF16Supported !== true;
}

export function latticeModelLibrary(role, userAgent = "", shaderF16Supported = true) {
  if (!(role in LATTICE_MODEL_ROLES)) {
    throw new TypeError("Text to Lattice rejected an unknown model role.");
  }
  return requiresCompatibleLatticeKernels(userAgent, shaderF16Supported)
    ? LATTICE_COMPATIBILITY_WASM[role].modelLib
    : LATTICE_MODEL_ROLES[role].modelLib;
}

export const LATTICE_WASM_BUILD_LINEAGE = Object.freeze({
  binaryRepositoryRevision: LATTICE_WASM_REVISION,
  releaseDirectory: "web-llm-models/v0_2_80",
  pullRequestNumber: 158,
  pullRequestUrl: `${LATTICE_WASM_REPOSITORY}/pull/158`,
  initialArtifactCommit: "40ef9663ecf3474f2b03b4edcead0d362a283e41",
  finalArtifactCommit: "a973639103dd389292a0315274495cb1bc406c7c",
  pullRequestMergeCommit: "6ed5b97c37f4cdc49d1a8044a339db5588176d7e",
  tvmCommit: "c8515e1ddfaf4d1afff916c484e68e1513631dd6",
  tvmCommitUrl: "https://github.com/apache/tvm/commit/c8515e1ddfaf4d1afff916c484e68e1513631dd6",
  earlyTimePlausibleTvmPrHeadRevision: "372c92844ce708cb1c9e1d13a2102823a4e50498",
  mlcLlmCommit: "4084e7fe7532fb932810d8b707f2d760eefd0dea",
  mlcLlmCommitUrl: "https://github.com/mlc-ai/mlc-llm/commit/4084e7fe7532fb932810d8b707f2d760eefd0dea",
});

export const LLAMA_3_2_TERMS_UPSTREAM_COMMIT = "8d29d93fa5700a60532e0061a02ffa89d0acd3fc";
export const LLAMA_3_2_TERMS_SHA256 = Object.freeze({
  license: "8cc15535a8a34b41888f644b339a1a9eb428af793a4f5e24df58a3e5b1487d74",
  acceptableUsePolicy: "40e2777d7faa6beaf98400654170f414d8ab29b921b5163ad4ea0a1d39894201",
});
export const LLAMA_3_2_TERMS_PROVENANCE = Object.freeze({
  version: "Llama 3.2",
  upstreamRepository: "https://github.com/meta-llama/llama-models",
  upstreamCommit: LLAMA_3_2_TERMS_UPSTREAM_COMMIT,
  upstreamCommitUrl: `https://github.com/meta-llama/llama-models/commit/${LLAMA_3_2_TERMS_UPSTREAM_COMMIT}`,
  licenseUrl: "https://developer.meta.com/ai/llama3_2/license/",
  acceptableUseUrl: "https://developer.meta.com/ai/llama3_2/use-policy/",
  sha256: LLAMA_3_2_TERMS_SHA256,
});

export const LATTICE_TOKENIZER_SHA256 = Object.freeze({
  generator: "aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4",
  verifier: "79e3e522635f3171300913bb421464a87de6222182a0570b9b2ccba2a964b2b4",
});

export const LATTICE_TOKENIZER_SRI = Object.freeze({
  generator: "sha256-rrEzB6cazY/oGGHZStVKtonfdzMYgJ7tPL55S0SS2uQ=",
  verifier: "sha256-eePlImNfMXEwCRO7QhRkqH3mIiGCoFcLmyzLoqlksrQ=",
});

const LATTICE_GENERATOR_INFERENCE_STAGES = Object.freeze({
  analysis: Object.freeze({ temperature: 0.1, topP: 0.9 }),
  reanalysis: Object.freeze({ temperature: 0.1, topP: 0.9 }),
  candidate: Object.freeze({ temperature: 0.45, topP: 0.9 }),
});

export const LATTICE_MODEL_ROLES = Object.freeze({
  generator: Object.freeze({
    role: "generator",
    id: "Qwen3-4B-q4f16_1-MLC",
    label: "Qwen3 4B generator",
    family: "Qwen3",
    revision: "a5c9fab855e3ccbdfed2e7e69683d75f30332161",
    model: "https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC/resolve/a5c9fab855e3ccbdfed2e7e69683d75f30332161/",
    repository: "https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC",
    revisionUrl: "https://huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC/tree/a5c9fab855e3ccbdfed2e7e69683d75f30332161",
    baseModelRepository: "https://huggingface.co/Qwen/Qwen3-4B",
    licenseName: "Apache License 2.0 (base model)",
    licenseUrl: "https://www.apache.org/licenses/LICENSE-2.0",
    modelLib: `${LATTICE_WASM_BASE}/Qwen3-4B-q4f16_1-ctx4k_cs1k-webgpu.wasm`,
    modelLibSha256: LATTICE_WASM_SHA256.generator,
    inference: Object.freeze({
      stages: LATTICE_GENERATOR_INFERENCE_STAGES,
      seed: 71_903,
      thinking: false,
    }),
  }),
  verifier: Object.freeze({
    role: "verifier",
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B verifier",
    family: "Llama 3.2",
    revision: "1e80abf71e3d17cd564e2d2b63caa15cb226018e",
    model: "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/resolve/1e80abf71e3d17cd564e2d2b63caa15cb226018e/",
    repository: "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC",
    revisionUrl: "https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/tree/1e80abf71e3d17cd564e2d2b63caa15cb226018e",
    baseModelRepository: "https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct",
    modelLib: `${LATTICE_WASM_BASE}/Llama-3.2-3B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm`,
    modelLibSha256: LATTICE_WASM_SHA256.verifier,
    licenseName: "Llama 3.2 Community License Agreement",
    licenseUrl: LLAMA_3_2_TERMS_PROVENANCE.licenseUrl,
    acceptableUseUrl: LLAMA_3_2_TERMS_PROVENANCE.acceptableUseUrl,
    termsProvenance: LLAMA_3_2_TERMS_PROVENANCE,
    inference: Object.freeze({ temperature: 0, topP: 1, seed: 71_903 }),
  }),
});

export const LOCAL_LATTICE_MODEL = Object.freeze({
  id: LATTICE_MODEL_ROLES.generator.id,
  label: "Qwen3 4B generator with Llama 3.2 3B verifier",
  downloadSizeLabel: "about 4.10 GB total",
  workingMemoryLabel: "up to about 3.5 GB",
  minimumStorageBytes: 4_700_000_000,
  models: Object.freeze([LATTICE_MODEL_ROLES.generator, LATTICE_MODEL_ROLES.verifier]),
  runtime: LATTICE_RUNTIME,
  tokenizerRuntime: LATTICE_TOKENIZER_RUNTIME,
  structuredOutputRuntime: LATTICE_STRUCTURED_OUTPUT_RUNTIME,
  wasmRevision: LATTICE_WASM_REVISION,
  wasmRepository: LATTICE_WASM_REPOSITORY,
  wasmSha256: LATTICE_WASM_SHA256,
  wasmBuildLineage: LATTICE_WASM_BUILD_LINEAGE,
  wasmLicenseStatus: "Exact artifact hashes and PR 158/TVM/MLC source lineage are recorded; reproducible-build evidence and complete artifact-level license/NOTICE coverage remain explicitly unestablished and are tracked as accepted residual risk rather than the active release blocker.",
});
