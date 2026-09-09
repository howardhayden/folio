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
});

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

export const LATTICE_TOKENIZER_SHA256 = Object.freeze({
  generator: "aeb13307a71acd8fe81861d94ad54ab689df773318809eed3cbe794b4492dae4",
  verifier: "79e3e522635f3171300913bb421464a87de6222182a0570b9b2ccba2a964b2b4",
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
    licenseName: "Llama 3.2 Community License Agreement",
    licenseUrl: "https://www.llama.com/llama3_2/license/",
    acceptableUseUrl: "https://www.llama.com/llama3_2/use-policy/",
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
  wasmLicenseStatus: "No standalone license metadata published in the pinned binary repository; deployment requires upstream confirmation or a documented source build.",
});
