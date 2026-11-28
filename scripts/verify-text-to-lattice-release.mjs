import { createHash } from "node:crypto";
import { lstat, readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  LLAMA_3_2_TERMS_PROVENANCE,
  LATTICE_MODEL_ROLES,
  LATTICE_RUNTIME,
  LATTICE_STRUCTURED_OUTPUT_RUNTIME,
  LATTICE_TOKENIZER_FILENAME,
  LATTICE_TOKENIZER_RUNTIME,
  LATTICE_TOKENIZER_SHA256,
  LATTICE_TOKENIZER_SRI,
  LATTICE_WASM_BUILD_LINEAGE,
  LATTICE_WASM_REPOSITORY,
  LATTICE_WASM_REVISION,
  LATTICE_WASM_SHA256,
  LATTICE_COMPATIBILITY_WASM,
} from "../app/resume/lattice/modelContract.js";
import {
  LATTICE_SERVICE_EVENTS_MIME,
  LATTICE_SERVICE_PHASES,
  LATTICE_SERVICE_PHASE_LIMIT,
  LATTICE_SERVICE_ERROR_RESERVE_BYTES,
  LATTICE_SERVICE_KEEPALIVE_MS,
} from "../app/resume/lattice/serviceTelemetry.js";
import { REMOTE_CAPABILITIES } from "../app/privacy/networkCapabilities.js";
import {
  LATTICE_API_PATH,
  LATTICE_API_SCHEMA_VERSION,
  LATTICE_API_REQUEST_TIMEOUT_MS,
  LATTICE_CLIENT_TIMEOUT_MS, LATTICE_LONG_CLIENT_TIMEOUT_MS, LATTICE_LONG_API_REQUEST_TIMEOUT_MS,
  LATTICE_REQUEST_FIELDS,
  LATTICE_REQUEST_MODES,
  LATTICE_VISITOR_SESSION_ACCEPT,
  LATTICE_LONG_JOB_POLICY,
} from "../app/resume/lattice/remoteProtocol.js";
import { projectBySlug } from "../app/resume/projects.js";
import {
  HUGGING_FACE_CHAT_COMPLETIONS_URL,
  HUGGING_FACE_VERIFICATION_CHAT_COMPLETIONS_URL,
  LATTICE_VERIFICATION_REQUEST_MODEL,
  LATTICE_PROVIDER_CALL_LIMIT,
  LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT,
  LATTICE_PROVIDER_MAX_CALL_TIMEOUT_MS,
  LATTICE_PROVIDER_MAX_OUTPUT_TOKENS_PER_ADMITTED_REQUEST,
  LATTICE_PROVIDER_MAX_OUTPUT_TOKENS_PER_CALL,
  LATTICE_PROVIDER_OUTPUT_TOKEN_LIMITS,
  LATTICE_PROVIDER_RESPONSE_BYTE_LIMIT,
  LATTICE_PROVIDER_STAGE_CALL_TIMEOUTS_MS,
  LATTICE_REMOTE_MODELS,
} from "../workers/text-to-lattice-api/huggingFaceAdapter.js";
import {
  LATTICE_TRANSFORMATIONS_PER_UTC_DAY,
  LATTICE_TRANSFORMATIONS_PER_VISITOR_UTC_DAY,
} from "../workers/text-to-lattice-api/capacityPolicy.js";
import {
  LATTICE_API_VISITOR_COOKIE_NAME,
  LATTICE_API_VISITOR_COOKIE_PATH,
  LATTICE_API_VISITOR_COOKIE_SECRET_BINDING,
} from "../workers/text-to-lattice-api/visitorCookie.js";
import { verifyBrowserEvidenceBundle } from "./verify-text-to-lattice-browser-evidence.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const registerPath = join(root, "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json");
const atlasPath = join(root, "docs/text-to-lattice/LATTICE-DOCUMENTATION-ATLAS.json");
const qualificationPath = join(root, "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md");
const llamaEvaluationPath = join(root, "docs/text-to-lattice/LLAMA-USE-EVALUATION-CASES.json");
const canonicalRegisterSource = "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json";
const canonicalQualificationSource = "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md";
const historicalRemoteLlamaTermsProvenance = Object.freeze({
  version: "Llama 3.1",
  model: "meta-llama/Llama-3.1-8B-Instruct:nscale",
  modelRepository: "https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct",
  modelRepositoryRevision: "0e9e39f249a16976918f6564b8830bc894c89659",
  modelRepositoryRevisionUrl: "https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct/tree/0e9e39f249a16976918f6564b8830bc894c89659",
  officialSourceCommit: "1f0feb795a4130697ced243fb53051670d591653",
  reviewedAt: "2026-09-25",
  license: Object.freeze({
    path: "LICENSES/Llama-3.1-Community-License.txt",
    sha256: "64e1b2889b7892e6bbe7a7ed5bfe6ff793c61f9d584345f8f41cf9f5cb30a369",
    gitBlob: "a7c3ca16cee30425ed6ad841a809590f2bcbf290",
    sourceUrl: "https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct/blob/0e9e39f249a16976918f6564b8830bc894c89659/LICENSE",
    canonicalUrl: "https://developer.meta.com/ai/llama3_1/license/",
  }),
  acceptableUsePolicy: Object.freeze({
    path: "LICENSES/Llama-3.1-Acceptable-Use-Policy.md",
    sha256: "a568f2ebc73cec3fd74ba2afd992d4e945a8c7a9d851f9b66163aac834b7b859",
    gitBlob: "81ebb55902285e8dd5804ccf423d17ffb2a622ee",
    sourceUrl: "https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct/blob/0e9e39f249a16976918f6564b8830bc894c89659/USE_POLICY.md",
    canonicalUrl: "https://developer.meta.com/ai/llama3_1/use-policy/",
  }),
});
const activeLlamaTermsProvenance = Object.freeze({
  "version": "Llama 3.3",
  "model": "meta-llama/Llama-3.3-70B-Instruct:coreweave",
  "modelRepository": "https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct",
  "modelRepositoryRevision": "6f6073b423013f6a7d4d9f39144961bfbfbc386b",
  "modelRepositoryRevisionUrl": "https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct/tree/6f6073b423013f6a7d4d9f39144961bfbfbc386b",
  "license": {
    "path": "LICENSES/Llama-3.3-Community-License.txt",
    "sha256": "fb58d9a630ccc1dc0d08f8c00232de56bc73309020f59c8181d0c12ef28d9f8c",
    "gitBlob": "2c97b69e3c309cbaa55bf7e4a4c48b8c18ff8276",
    "sourceUrl": "https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct/blob/6f6073b423013f6a7d4d9f39144961bfbfbc386b/LICENSE",
    "canonicalUrl": "https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct/blob/6f6073b423013f6a7d4d9f39144961bfbfbc386b/LICENSE"
  },
  "acceptableUsePolicy": {
    "path": "LICENSES/Llama-3.3-Acceptable-Use-Policy.md",
    "sha256": "99299d72ac39fd55c461d497cefc23938b1945cd97277d83df32587799666239",
    "gitBlob": "2b5602b4faeaee48c52a33951f4036ab86a0406b",
    "sourceUrl": "https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct/blob/6f6073b423013f6a7d4d9f39144961bfbfbc386b/USE_POLICY.md",
    "canonicalUrl": "https://www.llama.com/llama3_3/use-policy"
  },
  "officialSourceCommit": "6f6073b423013f6a7d4d9f39144961bfbfbc386b",
  "reviewedAt": "2026-10-23"
});
const historicalLlamaBehaviorEvaluation = Object.freeze({
  "path": "docs/text-to-lattice/LLAMA-USE-EVALUATION-CASES.json",
  "sha256": "86aad271f8e6a5befb978d6146fbbf9ce7b1c7eca16b8c1b5d7681e3d99294a7",
  "caseCount": 10,
  "expectedAllowCount": 5,
  "expectedDenyCount": 5,
  "fixtureStatus": "defined-and-machine-checked",
  "targetVerifier": {
    "model": "meta-llama/Llama-3.1-8B-Instruct:nscale",
    "modelRepositoryRevision": "0e9e39f249a16976918f6564b8830bc894c89659"
  },
  "evidenceResetAt": "2026-10-04",
  "evidenceResetReason": "The owner-approved provider for the same Llama 3.1 8B Instruct verifier changed from DeepInfra to Nscale; no behavioral result from another provider or serving revision is carried forward.",
  "exactModelExecutionStatus": "accepted-residual-risk",
  "exactModelExecutionPerformed": false,
  "claimBoundary": "A balanced non-operational fixture defines expected dispositions; it does not establish how the exact active Llama 3.1 8B Instruct verifier behaves until the cases are run and reviewed against that provider-served model."
});
const expectedGateIds = Object.freeze([
  "GATE-01",
  "GATE-02",
  "GATE-03",
  "GATE-04A",
  "GATE-04B",
  "GATE-04C",
  "GATE-05",
  "GATE-06",
]);
const gateStatuses = new Set([
  "satisfied-in-source",
  "satisfied-in-production",
  "release-workflow-enforced",
  "accepted-residual-risk",
  "post-deployment-verification",
  "open-release-blocker",
  "historical-inactive",
]);
const artifactQualificationStatuses = new Set(
  [...gateStatuses].filter((status) => status !== "satisfied-in-production"),
);
const productionSatisfiedGateIds = new Set(["GATE-02", "GATE-03", "GATE-06"]);
const rollbackRequiredStatuses = new Set([
  "satisfied-in-production",
  "post-deployment-verification",
]);
const marginalValues = new Set(["high", "moderate", "low", "negative"]);
const marginalDecisionValues = new Set([...marginalValues, "moderate-to-high"]);
const gateProjectionFields = Object.freeze([
  "id",
  "label",
  "status",
  "marginalValue",
  "requirement",
  "currentEvidence",
  "evidenceNeeded",
  "rationale",
  "evidence",
  "safeguards",
  "followUp",
  "rollbackCondition",
  "acceptanceBasis",
  "historicalInactiveRecord",
  "activeCurrentEvidence",
  "activeEvidence",
]);
const qualifiedSourceSetAlgorithm = "sha256-path-and-bytes-v1";
const qualifiedSourceFiles = Object.freeze([
  ".github/workflows/pages.yml",
  ".github/workflows/text-to-lattice-environment-diagnostic.yml",
  ".github/workflows/text-to-lattice-qualification-context.yml",
  "CNAME",
  "COMMERCIAL-LICENSE.md",
  "COMMERCIAL_BASELINE.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "LICENSE-MAP.json",
  "LICENSING.md",
  "NOTICE",
  "PERMISSIVE-EXCEPTIONS.md",
  "README.md",
  "THIRD_PARTY_LICENSES.txt",
  "THIRD_PARTY_NOTICES.md",
  "TRADEMARKS.md",
  "WORKFLOW-BOUNDARIES.md",
  "docs/lattice-resume-demo-requirements.md",
  "docs/text-to-lattice/TEXT-TO-LATTICE-BROWSER-EVIDENCE.schema.json",
  "docs/text-to-lattice/TEXT-TO-LATTICE-BROWSER-EVIDENCE.template.json",
  "eslint.config.mjs",
  "next-env.d.ts",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "postcss.config.mjs",
  "tsconfig.json",
  "vite.config.ts",
  "workers/package-lock.json",
  "workers/package.json",
]);
const qualifiedSourceTrees = Object.freeze([
  "LICENSES",
  "app",
  "scripts",
  "tests",
  "workers/text-to-lattice-api",
  "workers/text-to-lattice-attestation-frame",
  "workers/text-to-lattice-lease",
  "workers/text-to-lattice-response-policy",
]);
const qualifiedToolResidueDirectories = new Set([".wrangler"]);
const sha256Pattern = /^[a-f0-9]{64}$/u;
const gitRevisionPattern = /^[a-f0-9]{40}$/u;
const dateRevisionPattern = /^\d{4}-\d{2}-\d{2}$/u;
const browserEvidenceRepositoryPathPattern = /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.json$/u;
const browserEvidenceAuthorityFields = Object.freeze([
  "status",
  "path",
  "sha256",
  "evidenceId",
  "recordedAt",
  "deployedCommit",
  "workflowRunId",
  "workflowRunAttempt",
  "workflowRunUrl",
  "serviceJobId",
  "canonicalUrl",
  "apiWorkerDeploymentId",
  "apiWorkerVersion",
  "responsePolicyWorkerDeploymentId",
  "responsePolicyWorkerVersion",
  "deploymentEvidenceIndexSha256",
  "deploymentEvidenceBeforeCapturesSha256",
  "deploymentEvidenceAfterCapturesSha256",
  "siteArtifactSha256",
  "qualifiedSourceSetSha256",
  "deployedAt",
  "qualificationExpiresAt",
  "deploymentEvidenceCheckedBeforeCapturesAt",
  "deploymentEvidenceCheckedAfterCapturesAt",
  "deploymentEvidenceUnchangedAcrossCaptures",
]);
const heldRuntimeAssetPatterns = Object.freeze([
  /\.wasm$/iu,
  /\.(?:bin|safetensors|params|ndarray|gguf)$/iu,
  /(?:^|\/)tokenizer(?:_config)?\.json$/iu,
  /(?:^|\/)tokenizer\.model$/iu,
  /(?:^|\/)mlc-chat-config\.json$/iu,
  /(?:^|\/)ndarray-cache(?:-[^/]*)?\.json$/iu,
]);
const heldExecutableExtensions = new Set([".js", ".mjs", ".cjs", ".map"]);
const heldArtifactDigests = new Set([
  ...Object.values(LATTICE_WASM_SHA256),
  ...Object.values(LATTICE_COMPATIBILITY_WASM).map(({ sha256 }) => sha256),
  ...Object.values(LATTICE_TOKENIZER_SHA256),
]);
const heldForbiddenNetworkStrings = Object.freeze([
  "/api/text-to-lattice/lease",
  "https://verify.hah.dev",
  "huggingface.co/mlc-ai/Qwen3-4B-q4f16_1-MLC/resolve/",
  "huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/resolve/",
  "raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs",
  "Qwen3-4B-q4f16_1-ctx4k_cs1k-webgpu.wasm",
  "Llama-3.2-3B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm",
  "Qwen3-4B-q4f32_1-ctx4k_cs1k-webgpu.wasm",
  "Llama-3.2-3B-Instruct-q4f32_1-ctx4k_cs1k-webgpu.wasm",
]);
const heldForbiddenExecutableStrings = Object.freeze([
  ...heldForbiddenNetworkStrings,
  "@mlc-ai/web-llm",
  "CreateMLCEngine",
  "CreateWebWorkerMLCEngine",
  "WebWorkerMLCEngine",
  "text-to-lattice:model:v1",
  "lattice-demo-dialog",
  "lattice-demo-input",
  "requestRemoteLattice",
  "Network policy denied text-to-lattice",
  "LatticeRemoteError",
  "https://router.huggingface.co/v1/chat/completions",
  "https://router.huggingface.co/deepinfra/v1/openai/chat/completions",
  "meta-llama/Meta-Llama-3.1-8B-Instruct",
  "Qwen/Qwen3-4B-Instruct-2507:nscale",
  "Qwen/Qwen3-Next-80B-A3B-Instruct:deepinfra",
  "Qwen/Qwen3-235B-A22B-Instruct-2507:deepinfra",
  "Qwen/Qwen3-235B-A22B-Instruct-2507:parasail",
  "Qwen/Qwen3-235B-A22B-Instruct-2507:venice",
  "meta-llama/Llama-3.1-8B-Instruct:deepinfra",
  "meta-llama/Llama-3.1-8B-Instruct:nscale",
  "meta-llama/Llama-3.3-70B-Instruct:scaleway",
  "meta-llama/Llama-3.3-70B-Instruct:ovhcloud",
]);
const staleEnabledPublicationPattern = /release gates remain open|must agree before the converter can open|model-use controls[\s\S]{0,120}WebAssembly provenance are qualified|dormant (?:interface|dialog)|sole open (?:release )?blocker|held solely because|hold the interactive client/iu;
const datedHeldDossierPublicationPath = "documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md";
const datedHeldDossierBoundary = Buffer.from("The complete held-parent dossier after the Safari result in run #510 follows as dated history.");
const datedHeldDossierSeparator = Buffer.from("The complete held-parent dossier after the Safari result in run #510 follows as dated history.\n\n---\n\n");
const datedHeldDossierBytes = 673885;
const datedHeldDossierSha256 = "9e4ee1874e2e4e3f57e8bdde60ad2d5257f622ec7fc6b07589cd7840c3d9a540";
const publishedReleaseRegister = "documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json";
const previousOwnerDecisionSha256 = "b6cbc8c1fb9a75390acd0662e13c16859aadac847cf57330b28e7421da2ec135";
const serializedVinextRscScript = /^\s*\(\(self\[Symbol\.for\("vinext\.navigationRuntime"\)\]\?\?=\{bootstrap:\{routeManifest:null\},functions:\{\}\}\)\.bootstrap\.rsc\?\?=\{rsc:\[\]\}\)\.rsc\.push\(("(?:\\[\s\S]|[^"\\])*")\)\s*;?\s*$/u;
const expectedLlamaUseCases = new Map([
  ["AUP-DENY-01", ["operational-harm", false]],
  ["AUP-DENY-02", ["malware-improvement", false]],
  ["AUP-DENY-03", ["deliberate-deception", false]],
  ["AUP-DENY-04", ["unauthorized-professional-practice", false]],
  ["AUP-DENY-05", ["sensitive-person-inference", false]],
  ["AUP-ALLOW-01", ["journalism", true]],
  ["AUP-ALLOW-02", ["history-and-criticism", true]],
  ["AUP-ALLOW-03", ["fiction", true]],
  ["AUP-ALLOW-04", ["prevention-and-defense", true]],
  ["AUP-ALLOW-05", ["rights-analysis", true]],
]);

function fail(message) {
  throw new Error(`Text to Lattice release verification failed: ${message}`);
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") fail(`${label} must be a nonempty string.`);
  return value;
}

function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} must be a nonempty array.`);
  value.forEach((item, index) => requireString(item, `${label}[${index}]`));
  return value;
}

function gateRequiresRollbackCondition(gate) {
  return rollbackRequiredStatuses.has(gate.status)
    || gate.status === "open-release-blocker";
}

export function verifyReleaseStatusState(register) {
  const gateStatus = (id) => register.gates?.find((gate) => gate.id === id)?.status;
  const productionBoundaryStatus = gateStatus("GATE-02");
  const capacityStatus = gateStatus("GATE-03");
  const lifecycleStatus = gateStatus("GATE-06");
  const hasOpenBlocker = register.gates.some(({ status }) => status === "open-release-blocker");
  const enabledTuple = register.publicClient?.status === "enabled"
    && register.publicClient?.publicationMode === "interactive-client";
  const heldTuple = register.overallStatus === "held"
    && register.publicClient?.status === "held"
    && register.publicClient?.publicationMode === "documentation-only";
  const qualificationPendingTuple = register.overallStatus === "qualification-pending"
    && enabledTuple;
  const qualifiedTuple = register.overallStatus === "qualified"
    && enabledTuple;
  const productionBoundarySatisfied = productionBoundaryStatus === "satisfied-in-production";
  const capacitySatisfied = capacityStatus === "satisfied-in-production";
  const lifecycleSatisfied = lifecycleStatus === "satisfied-in-production";
  const lifecyclePending = lifecycleStatus === "post-deployment-verification";

  if (!["open-release-blocker", "satisfied-in-production"].includes(productionBoundaryStatus)) {
    fail("GATE-02 must remain open or be satisfied in production.");
  }
  if (!["open-release-blocker", "satisfied-in-production"].includes(capacityStatus)) {
    fail("GATE-03 must remain open or be satisfied in production.");
  }
  if (!["open-release-blocker", "post-deployment-verification", "satisfied-in-production"].includes(lifecycleStatus)) {
    fail("GATE-06 must remain open, enter post-deployment verification, or be satisfied in production.");
  }

  if (lifecyclePending && (!qualificationPendingTuple
    || hasOpenBlocker
    || !productionBoundarySatisfied
    || !capacitySatisfied)) {
    fail("GATE-06 post-deployment verification is allowed only in the qualification-pending phase after GATE-02 and GATE-03 are satisfied.");
  }
  if (lifecycleSatisfied && (!productionBoundarySatisfied || !capacitySatisfied)) {
    fail("GATE-06 cannot remain satisfied in production unless GATE-02 and GATE-03 are also satisfied.");
  }

  let releasePhase;
  if (heldTuple && hasOpenBlocker && !lifecyclePending) releasePhase = "held";
  else if (qualificationPendingTuple
    && !hasOpenBlocker
    && productionBoundarySatisfied
    && capacitySatisfied
    && lifecyclePending) releasePhase = "qualification-pending";
  else if (qualifiedTuple
    && !hasOpenBlocker
    && productionBoundarySatisfied
    && capacitySatisfied
    && lifecycleSatisfied) releasePhase = "qualified";
  else {
    fail("release state must match exactly one held, qualification-pending, or qualified phase tuple.");
  }

  const enabled = releasePhase !== "held"
    && register.publicClient?.status === "enabled"
    && register.publicClient?.publicationMode === "interactive-client";
  return {
    hasOpenBlocker,
    releasePhase,
    enabled,
    qualificationPending: releasePhase === "qualification-pending",
    qualified: releasePhase === "qualified",
    held: releasePhase === "held",
  };
}

export function verifyHistoricalBrowserLocalLifecycleGateContract(productionBoundaryGate, productionLifecycleGate) {
  const gate02PreactivationBoundary = `${productionBoundaryGate.requirement} ${productionBoundaryGate.evidenceNeeded} ${productionBoundaryGate.followUp}`;
  if (!/noninteractive/iu.test(gate02PreactivationBoundary)
    || !/invalid-(?:token|attestation)/iu.test(gate02PreactivationBoundary)
    || !/intentionally invalid-attestation/iu.test(productionBoundaryGate.evidenceNeeded)
    || !/exact official demonstration-site-key, and exact official dummy-token acquisition-and-release probes/iu.test(productionBoundaryGate.evidenceNeeded)
    || !/direct dummy-token lifecycle establishes only the deployed Siteverify, lease, and release path/iu.test(productionBoundaryGate.evidenceNeeded)
    || !/not evidence that the frame or widget participated or that canonical-browser GATE-06 passed/iu.test(productionBoundaryGate.evidenceNeeded)) {
    fail("GATE-02 must bind live noninteractive, invalid-token, and direct official dummy-token probes without treating their server result as frame, widget, or canonical-browser evidence.");
  }
  const gate02Sentences = gate02PreactivationBoundary.split(/(?<=[.!?])\s+/u);
  const requiresRealLifecycle = gate02Sentences.some((sentence) => {
    if (/\b(?:not|cannot|without|rather than)\b/iu.test(sentence)) return false;
    return /\b(?:complete|finish|record|pass|require|wait through)\b/iu.test(sentence)
      && /\b(?:real|genuine|successful|production-widget|official-page|canonical-page)\b/iu.test(sentence)
      && /\b(?:acquisition|grant|renewal|release|lifecycle)\b/iu.test(sentence);
  });
  if (requiresRealLifecycle) {
    fail("GATE-02 cannot require a real canonical-page lifecycle while the public client is held.");
  }
  for (const exactRoute of ["hah.dev/", "hah.dev/index.html", "hah.dev/resume/", "hah.dev/resume/index.html"]) {
    if (!gate02PreactivationBoundary.includes(exactRoute)) {
      fail(`GATE-02 must bind the exact response-policy route ${exactRoute}.`);
    }
  }
  const gate02ProfileContradiction = gate02PreactivationBoundary
    .split(/(?<=[.!?])\s+/u)
    .some((sentence) => {
      if (/\b(?:does not|do not|must not|never|without|rather than|only after)\b/iu.test(sentence)) return false;
      const testingPairOverclaim = /\b(?:official testing pair|testing-key fallback|demonstration profile)\b[\s\S]{0,160}\b(?:counts? as|provides?|establishes?|proves?|is)\b[\s\S]{0,120}\banti-bot\b/iu.test(sentence);
      const bespokeAlternative = /\b(?:allow|permit|implement|add|use|accept)\w*\b[\s\S]{0,120}\b(?:bypass|unsigned)\b|\b(?:bypass|unsigned)\b[\s\S]{0,120}\b(?:allow|permit|implement|add|use|accept)\w*\b/iu.test(sentence);
      return testingPairOverclaim || bespokeAlternative;
    });
  if (productionBoundaryGate.label !== "Deployed origin, secret, and demonstration boundary"
    || !/four exact response-policy routes/iu.test(productionBoundaryGate.requirement)
    || !/bounded demonstrable release/iu.test(productionBoundaryGate.requirement)
    || !/Cloudflare's official testing pair/iu.test(`${productionBoundaryGate.requirement} ${productionBoundaryGate.evidenceNeeded}`)
    || !/does not count as production anti-bot evidence/iu.test(productionBoundaryGate.requirement)
    || !/preserve a complete existing Turnstile pair without reading or replacing its values, or install Cloudflare's official testing pair/iu.test(productionBoundaryGate.evidenceNeeded)
    || !/independent generated signing secrets/iu.test(productionBoundaryGate.evidenceNeeded)
    || !productionBoundaryGate.safeguards.some((safeguard) => /official testing pair.*exact published secret.*never described as anti-bot assurance/iu.test(safeguard))
    || !productionBoundaryGate.safeguards.some((safeguard) => /unrelated portfolio (?:paths|traffic).*bypass/iu.test(safeguard))
    || !/Before describing the release as operationally anti-bot protected, intentionally change the declared profile, workflow verifier, and register to a hostname-restricted real widget pair/iu.test(productionBoundaryGate.followUp)
    || !/do not add a bespoke bypass route or unsigned token mode/iu.test(productionBoundaryGate.followUp)
    || gate02ProfileContradiction) {
    fail("GATE-02 must disclose the bounded Cloudflare official-testing profile without claiming anti-bot assurance and must prohibit bespoke bypass or unsigned alternatives.");
  }
  if (productionBoundaryGate.status === "satisfied-in-production") {
    const productionEvidence = `${productionBoundaryGate.currentEvidence} ${productionBoundaryGate.evidence.join(" ")}`;
    const requiredEvidence = [
      /https:\/\/github\.com\/howardhayden\/folio\/actions\/runs\/\d+/u,
      /service job \d+/u,
      /commit [a-f0-9]{40}/u,
      /live verification at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/u,
      /response-policy Worker version [0-9a-f]{8}-[0-9a-f-]{27}/u,
      /verification-frame Worker version [0-9a-f]{8}-[0-9a-f-]{27}/u,
      /lease Worker version [0-9a-f]{8}-[0-9a-f-]{27}/u,
      /exact route inventory/iu,
      /four encrypted binding-name inventory without reading values/iu,
      /fail-closed probes[\s\S]*method[\s\S]*cross-origin[\s\S]*cookie[\s\S]*missing-attestation[\s\S]*invalid-attestation/iu,
      /HTTP 200 acquisition/iu,
      /authenticated bodyless HTTP 204 release/iu,
      /direct dummy-token lifecycle establishes only[\s\S]*Siteverify[\s\S]*lease[\s\S]*release path[\s\S]*not evidence[\s\S]*frame[\s\S]*widget[\s\S]*canonical-browser GATE-06 passed/iu,
    ];
    if (requiredEvidence.some((pattern) => !pattern.test(productionEvidence))) {
      fail("GATE-02 satisfied production evidence must bind the retained run, commit, job, live timestamp, Worker versions, route and encrypted-binding inventories, fail-closed probes, direct 200/204 lifecycle, and non-browser evidentiary limit.");
    }
  }

  const lifecycleStatuses = new Set([
    "satisfied-in-production",
    "post-deployment-verification",
    "open-release-blocker",
  ]);
  const privacyClasses = ["source", "clarification", "candidate", "verifier finding", "output"];
  if (!lifecycleStatuses.has(productionLifecycleGate.status)
    || productionLifecycleGate.label !== "Production lifecycle and privacy trace"
    || !/activated canonical page/iu.test(productionLifecycleGate.requirement)
    || !/200 acquisition/iu.test(productionLifecycleGate.requirement)
    || !/204 release/iu.test(productionLifecycleGate.requirement)
    || !/declared deployed credential profile/iu.test(productionLifecycleGate.requirement)
    || !/non-error terminal conversion result/iu.test(productionLifecycleGate.requirement)
    || !/Testing-profile success establishes demonstrator integration, not production anti-bot assurance/iu.test(productionLifecycleGate.requirement)
    || !/first activation session/iu.test(`${productionLifecycleGate.evidenceNeeded} ${productionLifecycleGate.followUp}`)
    || !/supported browser engines/iu.test(productionLifecycleGate.evidenceNeeded)
    || !/both origins/iu.test(productionLifecycleGate.evidenceNeeded)
    || /wait .*five-minute|record a 200 renewal/iu.test(`${productionLifecycleGate.requirement} ${productionLifecycleGate.evidenceNeeded} ${productionLifecycleGate.followUp}`)
    || !/naturally reaches the renewal interval/iu.test(`${productionLifecycleGate.evidenceNeeded} ${productionLifecycleGate.followUp}`)
    || !/do not deliberately wait/iu.test(productionLifecycleGate.evidenceNeeded)
    || privacyClasses.some((contentClass) => !productionLifecycleGate.requirement.includes(contentClass)
      || !productionLifecycleGate.rollbackCondition.includes(contentClass))
    || !/Do not create a public or operator bypass harness/iu.test(productionLifecycleGate.evidenceNeeded)
    || !/held documentation-only artifact/iu.test(productionLifecycleGate.rollbackCondition)
    || !/GATE-06 to open-release-blocker/iu.test(productionLifecycleGate.rollbackCondition)
    || !/acquisition fails/iu.test(productionLifecycleGate.rollbackCondition)
    || !/observed real renewal attempt fails/iu.test(productionLifecycleGate.rollbackCondition)
    || !/release fails/iu.test(productionLifecycleGate.rollbackCondition)
    || !/content-bearing request/iu.test(productionLifecycleGate.rollbackCondition)) {
    fail("GATE-06 must retain first-session canonical-page acquisition, a non-error terminal conversion result, release, and two-origin privacy verification or a machine-representable open blocker, defer a deliberately timed renewal trace, and preserve held rollback without a bypass harness.");
  }
  if (productionLifecycleGate.status === "open-release-blocker") {
    requireString(productionLifecycleGate.rollbackCondition, "GATE-06 rollbackCondition");
  }
  if (productionLifecycleGate.status === "satisfied-in-production") {
    const productionEvidence = `${productionLifecycleGate.currentEvidence} ${productionLifecycleGate.evidence.join(" ")}`;
    const evidenceEntries = productionLifecycleGate.evidence;
    const utcTimestamps = productionEvidence.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/gu) ?? [];
    const evidenceDigests = productionEvidence.match(/\b[a-f0-9]{64}\b/gu) ?? [];
    const repairedDeploymentRevisions = [
      ...productionLifecycleGate.currentEvidence.matchAll(/\brepaired runtime deployed commit ([a-f0-9]{40})\b/giu),
    ].map((match) => match[1].toLowerCase());
    const repairedDeploymentRevision = repairedDeploymentRevisions.length === 1
      ? repairedDeploymentRevisions[0]
      : undefined;
    const deployedRevisionFor = (entry) => (
      /(?:deployed (?:commit|revision)|commit) ([a-f0-9]{40})/iu.exec(entry)?.[1]?.toLowerCase()
    );
    const bindsRepairedDeployment = (entry) => (
      repairedDeploymentRevision !== undefined
      && deployedRevisionFor(entry) === repairedDeploymentRevision
    );
    const safariLifecycle = evidenceEntries.some((entry) => (
      /Safari Version \d+(?:\.\d+)* \([^)]+\)/u.test(entry)
      && /WebKit/iu.test(entry)
      && entry.includes("https://hah.dev/resume/#text-to-lattice")
      && bindsRepairedDeployment(entry)
      && /\bPOST\b[\s\S]{0,160}\btyped challenge\b[\s\S]{0,80}\bHTTP 200\b[\s\S]{0,320}\bPOST\b[\s\S]{0,160}\blease grant\b[\s\S]{0,80}\bHTTP 200\b[\s\S]{0,320}\bDELETE\b[\s\S]{0,160}\blease release\b[\s\S]{0,80}\bHTTP 204\b/iu.test(entry)
      && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/u.test(entry)
      && /\b[a-f0-9]{64}\b/u.test(entry)
    ));
    const braveStatusLifecycle = evidenceEntries.some((entry) => (
      /Brave \d+(?:\.\d+)*/u.test(entry)
      && /Chromium \d+(?:\.\d+)*/u.test(entry)
      && entry.includes("https://hah.dev/resume/#text-to-lattice")
      && bindsRepairedDeployment(entry)
      && /\blease outcome sequence\b[\s\S]{0,160}\btyped challenge\b[\s\S]{0,80}\bHTTP 200\b[\s\S]{0,160}\bgrant\b[\s\S]{0,80}\bHTTP 200\b[\s\S]{0,160}\brelease\b[\s\S]{0,80}\bHTTP 204\b/iu.test(entry)
      && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/u.test(entry)
      && /\b[a-f0-9]{64}\b/u.test(entry)
    ));
    const terminalConversion = evidenceEntries.some((entry) => {
      const supportedBrowserEngine = (
        /Safari Version \d+(?:\.\d+)* \([^)]+\)[\s\S]{0,160}\bWebKit\b/iu.test(entry)
        || /Brave \d+(?:\.\d+)*[\s\S]{0,160}\bChromium \d+(?:\.\d+)*/u.test(entry)
      );
      return supportedBrowserEngine
        && entry.includes("https://hah.dev/resume/#text-to-lattice")
        && bindsRepairedDeployment(entry)
        && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/u.test(entry)
        && /sanitized capture with SHA-256 [a-f0-9]{64}/iu.test(entry)
        && /supported-browser WebGPU terminal conversion result: (?:translated|conformant-for-context|review-required)/u.test(entry);
    });
    const hasBodylessEvidenceBoundary = (evidence) => {
      const payloadPaneOverclaim = /(?:Payload-pane|Payload pane) inspection (?:confirmed|showed|proved)/iu.test(evidence);
      return (
        /(?:Payload-pane|Payload pane) inspection (?:was not|is not) (?:captured|claimed)/iu.test(evidence)
          && /bodyless[\s\S]{0,240}(?:source contract|client source|pre-dispatch)/iu.test(evidence)
          && !payloadPaneOverclaim
      ) || (
        /(?:Payload-pane|Payload pane) inspection (?:captured|reviewed|confirmed|showed)[\s\S]{0,160}no request (?:body|data)/iu.test(evidence)
          && /bodyless/iu.test(evidence)
      );
    };
    const hasEdgeTelemetryBoundary = (evidence) => (
      /static\.cloudflareinsights\.com\/beacon\.min\.js/iu.test(evidence)
        && /(?:blocked:csp|blocked by (?:the )?Content-Security-Policy)/iu.test(evidence)
        && /(?:0(?:\.0)?\s*(?:B|bytes|kB)|zero bytes)/iu.test(evidence)
        && /no (?:observed )?\/cdn-cgi\/rum/iu.test(evidence)
    ) || (
      /no (?:edge-injected |observed |injected )?(?:https:\/\/)?static\.cloudflareinsights\.com\/beacon\.min\.js/iu.test(evidence)
        && /no (?:observed )?\/cdn-cgi\/rum/iu.test(evidence)
    );
    const bodylessEvidenceBoundary = hasBodylessEvidenceBoundary(productionEvidence);
    const edgeTelemetryBoundary = hasEdgeTelemetryBoundary(productionEvidence);
    const repairedPrivacyTrace = evidenceEntries.some((entry) => (
      /Brave \d+(?:\.\d+)*/u.test(entry)
      && /Chromium \d+(?:\.\d+)*/u.test(entry)
      && entry.includes("https://hah.dev/resume/#text-to-lattice")
      && bindsRepairedDeployment(entry)
      && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/u.test(entry)
      && /sanitized two-origin privacy capture with SHA-256 [a-f0-9]{64}/iu.test(entry)
      && /both hah\.dev and verify\.hah\.dev origins/iu.test(entry)
      && /owner(?:-attested| (?:reports?|reported))\b[\s\S]{0,320}\bcapture-wide\b[\s\S]{0,240}(?:returned|reported|found) `?0 matches`?[\s\S]{0,200}\bBrave\b/iu.test(entry)
      && privacyClasses.every((contentClass) => entry.includes(contentClass))
      && /lease[\s\S]{0,160}attestation[\s\S]{0,160}model-asset[\s\S]{0,160}error[\s\S]{0,160}telemetry/iu.test(entry)
      && hasBodylessEvidenceBoundary(entry)
      && hasEdgeTelemetryBoundary(entry)
    ));
    const braveZeroMatchAttribution = /owner(?:-attested| (?:reports?|reported))\b[\s\S]{0,320}\bcapture-wide\b[\s\S]{0,240}(?:returned|reported|found) `?0 matches`?[\s\S]{0,200}\bBrave\b/iu.test(productionEvidence);
    const requiredEvidence = [
      /https:\/\/hah\.dev\/resume\/#text-to-lattice/u,
      /https:\/\/github\.com\/howardhayden\/folio\/actions\/runs\/\d+/u,
      /(?:deployed (?:commit|revision)|commit) [a-f0-9]{40}/iu,
      /macOS \d+(?:\.\d+)*(?: \([A-Za-z0-9]+\))?/u,
      /both (?:hah\.dev and verify\.hah\.dev )?origins|hah\.dev[\s\S]{0,160}verify\.hah\.dev/iu,
      /capture-wide[\s\S]{0,160}(?:returned|reported|found) `?0 matches`?/iu,
      /source[\s\S]{0,160}clarification[\s\S]{0,160}candidate[\s\S]{0,160}verifier finding[\s\S]{0,160}output/iu,
      /lease[\s\S]{0,160}attestation[\s\S]{0,160}model-asset[\s\S]{0,160}error[\s\S]{0,160}telemetry/iu,
      /(?:official Cloudflare testing profile|Cloudflare(?:'s|\u2019s)?(?: exact)? official testing (?:pair|profile)|official demonstration profile)/iu,
      /(?:(?:does not|did not)[\s\S]{0,220}|\bnot\b[\s\S]{0,100})(?:production )?anti-bot assurance/iu,
    ];
    const evidenceSentences = productionEvidence.split(/(?<=[.!?])\s+/u);
    const antiBotContradiction = evidenceSentences.some((sentence) => (
      [...sentence.matchAll(/\b(?:testing|demonstration) (?:pair|profile)\b([\s\S]{0,200}?)\b(?:establishes?|proves?|provides?|assures?|claims?)\b([\s\S]{0,120}?)\banti-bot\b/giu)]
        .some((match) => (
          !/(?:\b(?:does|did|do|can|could|would|will|is|was|are|were)\s+not|\bcannot|\bnever)\s*$/iu.test(match[1])
          && !/\b(?:no|not|without|absent)\b/iu.test(match[2])
        ))
    ));
    const analyticsDisabledContradiction = evidenceSentences.some((sentence) => {
      const match = /\b(?:Cloudflare(?: Web)? Analytics|Cloudflare analytics|RUM)\b[\s\S]{0,60}\b(?:is|was|are|were)\s+disabled\b/iu.exec(sentence);
      if (!match) return false;
      const prefix = sentence.slice(0, match.index);
      return !/(?:\b(?:does|did|do|can|could|would|will|is|was|are|were)\s+not|\bcannot|\bnever)\s+(?:establish(?:es|ed)?|prov(?:e|es|ed)|confirm(?:s|ed)?|show(?:s|ed)?|mean(?:s|t)?|claim(?:s|ed)?|demonstrat(?:e|es|ed)|indicat(?:e|es|ed)|conclud(?:e|es|ed))(?:\s+that)?\s*$/iu.test(prefix);
    });
    if (!safariLifecycle
      || !braveStatusLifecycle
      || !terminalConversion
      || !repairedPrivacyTrace
      || !braveZeroMatchAttribution
      || !bodylessEvidenceBoundary
      || !edgeTelemetryBoundary
      || new Set(utcTimestamps).size < 2
      || new Set(evidenceDigests).size < 2
      || requiredEvidence.some((pattern) => !pattern.test(productionEvidence))
      || antiBotContradiction
      || analyticsDisabledContradiction
      || /before declaring the release operationally complete/iu.test(productionLifecycleGate.evidenceNeeded)
      || !/retain[\s\S]{0,160}(?:completed|reviewed)[\s\S]{0,160}first activation session/iu.test(productionLifecycleGate.evidenceNeeded)) {
      fail("GATE-06 satisfied production evidence must bind the canonical URL and exactly one repaired runtime deployed commit; timestamped and digested Safari/WebKit lifecycle, Brave/Chromium lifecycle, supported-browser WebGPU terminal conversion, and sanitized two-origin privacy records must each bind that same revision. The privacy record must retain the zero-match review, an honestly classified bodyless-request boundary, and an absent or CSP-blocked zero-byte Cloudflare beacon without RUM submission; the official testing profile must remain explicitly short of production anti-bot assurance.");
    }
  }
}

const historicalGateEvidenceDigests = Object.freeze({
  "GATE-02": "f3d468f06b104cbc4435e4902ca519aecb54bfd62da2d2ddf1001cf551c88b24",
  "GATE-03": "df0907c36021a720319c12fd81b3a55ee22c3aafed3e82f720f5e9c14fb0d1f7",
  "GATE-06": "5e46d2ba74a423dfb21b40dc1fe689d865d612eda66d703e077dff6217732dd7",
});

function verifyHistoricalInactiveGateEvidence(gate) {
  const record = gate.historicalInactiveRecord;
  if (record?.status !== "historical-inactive"
    || JSON.stringify(record.appliesToFields) !== JSON.stringify(["currentEvidence", "evidence"])
    || record.verbatimSha256 !== historicalGateEvidenceDigests[gate.id]) {
    fail(`${gate.id} must classify its preserved browser-local evidence as historical inactive.`);
  }
  const observed = digest(Buffer.from(JSON.stringify({
    currentEvidence: gate.currentEvidence,
    evidence: gate.evidence,
  })));
  if (observed !== record.verbatimSha256) {
    fail(`${gate.id} historical browser-local evidence is not verbatim.`);
  }
  requireString(record.architecture, `${gate.id} historical architecture`);
  requireString(record.claimBoundary, `${gate.id} historical claim boundary`);
}

function activeGateText(gate) {
  return [
    gate.label,
    gate.requirement,
    gate.activeCurrentEvidence,
    gate.evidenceNeeded,
    gate.rationale,
    ...(gate.activeEvidence ?? []),
    ...(gate.safeguards ?? []),
    gate.followUp,
    gate.rollbackCondition,
  ].join(" ");
}

export function verifyLifecycleGateContract(productionBoundaryGate, capacityGate, productionLifecycleGate, releasePhase) {
  for (const gate of [productionBoundaryGate, capacityGate, productionLifecycleGate]) {
    verifyHistoricalInactiveGateEvidence(gate);
    requireString(gate.activeCurrentEvidence, `${gate.id} activeCurrentEvidence`);
    requireStringArray(gate.activeEvidence, `${gate.id} activeEvidence`);
    if (/Turnstile|Siteverify|verify\.hah\.dev|WebGPU|WebLLM|\/api\/text-to-lattice\/lease|\blease\b|\battestation\b/iu.test(activeGateText(gate))) {
      fail(`${gate.id} active remote requirement contains a browser-local lease assumption.`);
    }
  }
  for (const gate of [productionBoundaryGate, capacityGate]) {
    if (!["open-release-blocker", "satisfied-in-production"].includes(gate.status)) {
      fail(`${gate.id} must remain open until its active remote production evidence is satisfied.`);
    }
  }
  if (!["open-release-blocker", "post-deployment-verification", "satisfied-in-production"].includes(productionLifecycleGate.status)) {
    fail("GATE-06 must remain open, enter post-deployment verification, or be satisfied by active remote production evidence.");
  }
  if (productionLifecycleGate.status === "post-deployment-verification"
    && (productionBoundaryGate.status !== "satisfied-in-production"
      || capacityGate.status !== "satisfied-in-production"
      || releasePhase !== "qualification-pending")) {
    fail("GATE-06 post-deployment verification requires the qualification-pending phase with GATE-02 and GATE-03 satisfied in production.");
  }
  if (productionLifecycleGate.status === "satisfied-in-production"
    && (productionBoundaryGate.status !== "satisfied-in-production"
      || capacityGate.status !== "satisfied-in-production")) {
    fail("GATE-06 cannot remain satisfied unless GATE-02 and GATE-03 are satisfied in production.");
  }

  const gate02 = activeGateText(productionBoundaryGate);
  for (const required of [
    "/api/lattice",
    "POST",
    "schema version 1",
    "text",
    "requested_mode",
    "schema_version",
    LATTICE_VISITOR_SESSION_ACCEPT,
    "bodyless",
    "same origin-wide browser Web Lock",
    "428 visitor_session_required",
    "without a quota claim or provider call",
    "HF_TOKEN",
    "VISITOR_COOKIE_SECRET",
    "__Secure-hah-lattice-api-visitor",
    "Hugging Face",
    "Qwen",
    "Llama",
    "no-store",
    "no application content storage or logging",
    "no automatic retry",
    "no alternate provider or model fallback",
    "connect-src 'self'",
  ]) {
    if (!gate02.includes(required)) fail(`GATE-02 omits the active remote boundary atom ${required}.`);
  }
  for (const failure of ["wrong path", "method", "origin", "media type", "additional or missing fields", "invalid mode", "invalid schema version", "undeclared cookie", "oversized input", "non-reflective JSON errors"]) {
    if (!gate02.includes(failure)) fail(`GATE-02 omits the live failure probe ${failure}.`);
  }

  const gate03 = activeGateText(capacityGate);
  for (const required of [
    "30 transformations globally per UTC day",
    "3 per cooperating canonical client with an ordinary persistent browser cookie jar per UTC day",
    "Intentional cookie clearing and uncooperative callers remain outside the per-browser identity claim",
    "global 30-per-day counter remains exact and authoritative",
    "setup must make no quota claim and no provider call",
    "before Durable Object admission or provider work",
    "one atomic admission",
    "provider failure",
    "without refund",
    "no IP address",
    "browser fingerprint",
    `${LATTICE_PROVIDER_OUTPUT_TOKEN_LIMITS.certification.toLocaleString("en-US")}-token certifier`,
    "32 provider calls",
    "64 provider calls",
    "1,920",
    "rate limiter",
    "timeout",
    "response size",
    "cost",
    "no generic proxy",
    "no availability",
  ]) {
    if (!gate03.toLowerCase().includes(required.toLowerCase())) fail(`GATE-03 omits the remote capacity atom ${required}.`);
  }
  for (const required of [
    /analysis calls have a 300-second ceiling/iu,
    /(?:2,048-token verifier|verifier (?:stage )?maximum[^.]*2,048 tokens|verification[^.]*2,048-token)/iu,
    /requested-output exposure[^.]*2,048(?: requested output tokens)? per (?:provider )?call/iu,
    /requested-output exposure[^.]*131,072(?: requested output tokens)? per admitted request/iu,
    /requested-output exposure[^.]*393,216(?: requested output tokens)? per cooperating (?:ordinary persistent )?browser cookie jar per UTC day/iu,
    /requested-output exposure[^.]*3,932,160(?: requested output tokens)? (?:global(?:ly)?|across[^.]*global)[^.]*UTC day/iu,
  ]) {
    if (!required.test(gate03)) fail(`GATE-03 omits the exact stage-budget or aggregate-exposure boundary ${required}.`);
  }

  const gate06 = activeGateText(productionLifecycleGate);
  for (const required of [
    "canonical page",
    "supported browser engines",
    "explicit confirmation",
    "origin-wide browser Web Lock",
    "bodyless content-free",
    LATTICE_VISITOR_SESSION_ACCEPT,
    "no body or Content-Type",
    "exactly one content-bearing",
    "POST /api/lattice",
    "text",
    "requested_mode",
    "schema_version 1",
    "non-error terminal result",
    "no provider-origin browser request",
    "no automatic retry",
    "no service-worker or cache replay",
    "Set-Cookie",
    "cookie value",
    "no transformation quota and make no provider call",
    "428 visitor_session_required before admission and provider work",
    "qualification expiry",
    "qualified source-set SHA-256",
    "timestamped sanitized captures",
  ]) {
    if (!gate06.includes(required)) fail(`GATE-06 omits the remote lifecycle atom ${required}.`);
  }

  if (productionBoundaryGate.status === "satisfied-in-production") {
    const evidence = `${productionBoundaryGate.activeCurrentEvidence} ${productionBoundaryGate.activeEvidence.join(" ")}`;
    for (const pattern of [
      /actions\/runs\/\d+/u,
      /deployed commit [a-f0-9]{40}/u,
      /API Worker version [0-9a-f-]{36}/u,
      /response-policy Worker version [0-9a-f-]{36}/u,
      /HF_TOKEN and VISITOR_COOKIE_SECRET binding names/iu,
      /live .*\/api\/lattice/iu,
    ]) {
      if (!pattern.test(evidence)) fail("GATE-02 cannot be satisfied without deployed remote route, version, commit, and binding-name evidence.");
    }
  }
  if (capacityGate.status === "satisfied-in-production"
    && (!/production[^.]*rate limiter/iu.test(capacityGate.activeCurrentEvidence)
      || !/30[^.]*global[^.]*UTC day/iu.test(capacityGate.activeCurrentEvidence)
      || !/3[^.]*browser[^.]*UTC day/iu.test(capacityGate.activeCurrentEvidence))) {
    fail("GATE-03 cannot be satisfied without observed production rate-limiter and exact daily-admission evidence.");
  }
  if (productionLifecycleGate.status === "satisfied-in-production") {
    const evidence = `${productionLifecycleGate.activeCurrentEvidence} ${productionLifecycleGate.activeEvidence.join(" ")}`;
    if (!/supported-browser/iu.test(evidence)
      || !/sanitized capture with SHA-256 [a-f0-9]{64}/iu.test(evidence)
      || !/deployed commit [a-f0-9]{40}/iu.test(evidence)
      || !/non-error terminal result/iu.test(evidence)
      || !/exactly one .*POST \/api\/lattice/iu.test(evidence)) {
      fail("GATE-06 cannot be satisfied without a revision-bound canonical-browser remote conversion and privacy trace.");
    }
  }
}

function exactIds(records, expected, label) {
  if (!Array.isArray(records)) fail(`${label} must be an array.`);
  const ids = records.map((record) => record?.id);
  if (new Set(ids).size !== ids.length || ids.length !== expected.length || expected.some((id) => !ids.includes(id))) {
    fail(`${label} must contain ${expected.join(", ")} exactly once.`);
  }
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function gitBlobDigest(bytes) {
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

function pathWithinRoot(path, label) {
  const absolute = resolve(root, path);
  const rel = relative(root, absolute);
  if (!path || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(rel)) {
    fail(`${label} escapes the repository root: ${path}.`);
  }
  return { absolute, relative: rel.split("\\").join("/") };
}

function exactObjectFields(value, fields, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
  if (JSON.stringify(Object.keys(value)) !== JSON.stringify(fields)) {
    fail(`${label} must contain only the exact typed fields in their canonical order.`);
  }
  return value;
}

function browserEvidenceIdentity(evidence) {
  const deployment = evidence.deployment;
  return Object.freeze({
    evidenceId: evidence.evidence_id,
    recordedAt: evidence.recorded_at,
    deployedCommit: deployment.deployed_commit,
    workflowRunId: deployment.workflow_run_id,
    workflowRunAttempt: deployment.workflow_run_attempt,
    workflowRunUrl: deployment.workflow_run_url,
    serviceJobId: deployment.service_job_id,
    canonicalUrl: deployment.canonical_url,
    apiWorkerDeploymentId: deployment.api_worker_deployment_id,
    apiWorkerVersion: deployment.api_worker_version,
    responsePolicyWorkerDeploymentId: deployment.response_policy_worker_deployment_id,
    responsePolicyWorkerVersion: deployment.response_policy_worker_version,
    deploymentEvidenceIndexSha256: deployment.deployment_evidence_index_sha256,
    deploymentEvidenceBeforeCapturesSha256: deployment.deployment_evidence_before_captures_sha256,
    deploymentEvidenceAfterCapturesSha256: deployment.deployment_evidence_after_captures_sha256,
    siteArtifactSha256: deployment.site_artifact_sha256,
    qualifiedSourceSetSha256: deployment.qualified_source_set_sha256,
    deployedAt: deployment.deployed_at,
    qualificationExpiresAt: deployment.qualification_expires_at,
    deploymentEvidenceCheckedBeforeCapturesAt: deployment.deployment_evidence_checked_before_captures_at,
    deploymentEvidenceCheckedAfterCapturesAt: deployment.deployment_evidence_checked_after_captures_at,
    deploymentEvidenceUnchangedAcrossCaptures: deployment.deployment_evidence_unchanged_across_captures,
    ...(Object.hasOwn(deployment, "qualification_mode") ? { qualificationMode: deployment.qualification_mode } : {}),
  });
}

const sourceCarryCapture = Object.freeze({
  commit: "6166a3f430338331ca3f0336450e500571cbb896",
  source: "0b3cd95947daa3a53ef731745c95dbaa3d0514799333087462d657e356f4faaa",
  evidenceId: "ttl-browser-20261123T143941Z-a495af12",
  evidenceSha256: "b4ebf4345afe1bd90fdc566140fb0f83c11abf3426fbb597e2610e5d45ce9595",
  fileDigestsSha256: "a3c557dcec1563f2f0023cfe39d89d470e77777059fb25414ff5714b2e18280f",
  proofPath: "docs/release-evidence/text-to-lattice/nov28-local-boundary-review-source-digests.json",
});
const sourceCarryEditorialPage = Object.freeze({
  path: "app/projects/lattice/text-to-lattice/page.tsx",
  beforeSha256: "1c64e9eb0fad6de81fecd8702d4adc2a6167fbd68a98246d9b385f58002518c8",
  afterSha256: "402159cf3350ed98b1f5227a58b42a7520c06c6d9e49cf4e1be7421d714dfbe9",
});
const approvedPublicationFiles = Object.freeze({
  ".github/workflows/pages.yml": { before: "c23120677b068f817ad2a1261e76db63bc3ac0013d2e7426d46d7cf0b52792fd", after: "5ee9f4476bf1d4d1475a4b561de4bb0d4dea3095c5ed8e4ed99b2ee3860ff373" },
  "app/content/projectDocuments.js": { before: "261c3150e2b68cc0c6944da91c29dca26544ec73126de52dbff195ed6a9c7251", after: "a7e92316b513757b6a19ece0fbc2fd4390e08d3c8766edc146c61184e4d21ca3" },
  "app/projects/[slug]/page.tsx": { before: "d9c197e75d35c3522104367272ab426f8c9bdec2253b7a619eecd2a47f4abf62", after: "43ab6d037e0c9eb5609ce5c17b0a4bbfdbd6a58689fc478f5b3b64f5464d268a" },
  "app/semantic/portfolio.js": { before: "7fcc144c8b57b75973b78ce43c9a407ac85d941d0ed8271c4e94b82c7195ffe6", after: "8506fd4f7d49f5b6ab672b5ba00265c39774c4e71ff035fee70beaa82462380c" },
  "scripts/docs/build-text-to-lattice-documentation.mjs": { before: "69908da7315c7d07500b18196cfe76912d3c58560510aec7a3b3a1474f810afc", after: "72d66fbae31755a268f7e799538a657ab7d87e36a3f6d3aa727ca6c78d3cff13" },
  "tests/lattice-deployment-workflow.test.mjs": { before: "3ff5d963b27488cac81ca7689636755ec9a6774dc8510387d688328fec541089", after: "db3de5aae975089e64a3674f4bd3f170bf9a995436f1d580f4fe7f5663167389" },
  "app/resume/ProjectDescriptionDisclosure.tsx": { before: "5e75a6ab95b261ea2ff77c5012998f618126de1c59456acde2310b663b174e89", after: "cef3f61fa66e2ceeb91cb61f8d236751c9d6f2e4688062bb496741110541d832" },
  "app/resume/ResumeProjects.tsx": { before: "42b88aa9be93601a305f266f2948722f401dc17d712293fee6e6ea78bffa7db4", after: "2b952acfbedcaa5ca6eae5b4114a7b7f8e77420bca4f3ed62757e4cb50579684" },
  "app/globals.css": { before: "c92afb6efeb29bdbb96462810cc458137e9ced07d89aab7023f07f701c55663f", after: "cefefec324c8ad824e125be7d465ce9ebbf3e645bc95e5a8754cb84de742f7b1" },
  "tests/lattice-service-view.test.mjs": { before: "5b35bad121018ef1a9e49f11a202d07529197e96336380c1b43c07c9e9785e73", after: "8621bf54a7b309a54ca43c8ab98070c174c44391cf65f459a9694caf9995ce09" },
  "app/content/textToLatticeContent.js": { before: "32f4c7f164c4e872230e12016fdffa0167565bc5afab742a7870935f26d09a41", after: "b12fee2313f7155af7204e43dd01b1ed35f7e5a22328ce474ad05f84c7198da6" },
  "app/resume/lattice/remoteProtocol.js": { before: "a7b33f6969f4593fa87a46e30420c3094f91e9e34dfbba5b65f932097aa9868d", after: "44d03e1564f6b76f33e27b0c1f9f435e337b0fa4cbb469b117554d20cc13ab95" },
  "app/resume/lattice/remoteRequest.js": { before: "161a4f068ee7357c4f42cc4c33a3237668ef01196e3fecde2a98694dd0261c92", after: "57da134fbc2345146f8bcd5d4f1b4d67bef7803a367563351bf1da9f45acc33d" },
  "app/resume/lattice/segments.js": { before: "6a32fdd7e9145579d86eb60e34994a89270e6b970db75b1f382b7be91aa7e8fd", after: "587d9cede544c0eb6a5d69eafe65417bd3b6a37c8ab5839e3f292ed4c1f8ca06" },
  "app/resume/lattice/serviceTelemetry.js": { before: "cc38fda1abb8a29d3fea10426b84e32cfff9f6ad14526b3367ccdbce6c52980a", after: "0ec5b1de48731d5f9db35c7fa936290668107a049768a45b0c18123a389be167" },
  "app/resume/latticeDemo.js": { before: "fec23b788e1bb970590a38d7046071ba90d62d268ff1cab4105dadaa84e50639", after: "173b91b79ab3da5ef29178eda9cb99e5737199e6c86d048a9609d26c09228f1a" },
  "scripts/read-text-to-lattice-active-version.mjs": { before: "1063485afc31efd16123f80f585210c1ae0c9c4e7103cbe7c236e019f73a0155", after: "2f43abcca26e8450d96f0beef70f291cd6dd3cfa5024928a6943f1ea12637f08" },
  "scripts/text-to-lattice-production-canary.mjs": { before: "fb5ca18a973ad1a6d1eead16535a0c6c4cea8852b72dbd53764e20f0c2f4efa4", after: "270ba635a44916756a1154bfa498ef6432b489de8392fe1bf3ead9a75677293d" },
  "scripts/verify-text-to-lattice-api-production.mjs": { before: "3c3d1803cbc4f610f1da6a5f571d165782498a3056aea07fb2ca44a6c69f8b90", after: "e2d10f5bc9cf26d8aee1459efbdb8ba932102208716a04569f811fcc433ab96f" },
  "tests/lattice-api-worker.test.mjs": { before: "460458b7f94de503c46d150da4712ccaef5ed757578aee2ae7d2dca323c2fb29", after: "175f2e69185b1b695f850a71afb46dbc7d50c1f968340f52dca75dd3e4ce5cb9" },
  "tests/lattice-demo.test.mjs": { before: "f02129d9939c76903310fae367146b85a5f7b62da55dd421c1a2d4229f5ed201", after: "da43866a29446c81961dff657be8c40ee53fe494ed69d8a14b2ec1f916ef5299" },
  "tests/lattice-network-capability.test.mjs": { before: "81b667a111103366cad61dae3486a69e3865ceb39b5ab1026319dfe61e39cab6", after: "771c069596ad3ed08a94f4f0cd089e20ef64e7d054e80e8710191193851d64c7" },
  "tests/lattice-production-api-verifier.test.mjs": { before: "b823726fa9b877151f29e48664a5bd7444bc7c205ddff11772e2cd4a55a260ce", after: "d67f98f78736cfb6fdf007b185f53f41eb04efd473458e988a0d3f75d8076aec" },
  "tests/lattice-service-telemetry-worker.test.mjs": { before: "0d03949ccd4cdda0f5f6bd16ade8c526fd13c599048d91230a556588ecdc1aa4", after: "5aadb894a43bb09644144a295579031fd0c7328cc770f549c58623e744d1e6e7" },
  "workers/package-lock.json": { before: "74684a6c780f38e5ea646ef6c29329be5541d05f23de1f65f64f050ea21ff96a", after: "494d6ea38fd6e7989673cf729c6792d7f4acbc1876bcb76b97c0a8c7c711eb5d" },
  "workers/package.json": { before: "7fa9a406742ff6a67d0565ea51e5a845384f1e11fa590ed46906ed5b186838bc", after: "f52444513091bbd4399396dbf8c3adee027b094c6666923f3acb042522ae9d6f" },
  "workers/text-to-lattice-api/huggingFaceAdapter.js": { before: "1306ad3d60560cbc9cdb629d1ea3e1ed6abbeb6db7559cda18ccdabe397012a9", after: "3dcd6369172c242b5cca979f96176ad93ea5c4a62a9cdc9ac72e13540d049f0d" },
  "workers/text-to-lattice-api/worker.js": { before: "89f67a96629041cd6f30fc95cba257ad98852be01b1fab144a59d8b3e0b7eac9", after: "0e6a8e64c882fc78f739106a099b4d3b5dd32ad85ed6919d234750227eb2cb7e" },
  "app/privacy/networkCapabilities.js": { before: "c47c98266b3bb00e1df9784554ce580dd4c4afba46104009491a565c980a793b", after: "00abdccf8482153e8e3b90b5aa994b2602c3851fd0a5e11b7f4512230532e0dd" },
  "tests/semantic-layer.test.mjs": { before: "9ed6f496e5bed6665457e825c9352d73029e99da9291101700e7b4e589b60e44", after: "753b5527dbcb37af13d12fc0783a27f32b77216de2312318db7f282a5e577455" },
  "workers/text-to-lattice-api/visitorCookie.js": { before: "5863a6b005939c58c54edcf430b82afaf56efc847ad9f373ce175e4fa17aff5e", after: "50db6f1a6d74cbf039c56510593d9fff2b5b9e7ddf74d3f5b24e5fa7bc97d9a2" },
  "app/resume/lattice/promptContract.js": { before: "3f6d97345b7239ab28ab2a9c88d6063bde1fcf8a9689d786e3c58e0a54577525", after: "9061759118b49241ca2d2331aa700d1f75ac8cc928c28a6b30c301bef429883c" },
  "app/resume/lattice/regenerationContext.js": { before: "000181ce30f4a44ff44a18cbaeb4f95674a2363241e35054b4a253794cc014fd", after: "02684fc4acd89396ae89d1f6c46d7c5d758ea5291396aa17b0a65d96ffce6a09" },
  "THIRD_PARTY_NOTICES.md": { before: "adcf64ae5a593ec15ec9be7c9287eba6d618541f8572e8b503e460838e2a288b", after: "41e3de3f20eeceed331ba02f33cf2bf12a5f120b8f02d44fdb09f42adc4d3cf6" },
  "app/resume/projects.js": { before: "67c1dc2c78fa4da256a805737ef857e7696e605f0d99d768539a2dedef2b0554", after: "bc7eae0311662430449534662738c2f48ec3d31edb080e1561198860f42d3158" },
  "scripts/text-to-lattice-qualification-usage.mjs": { before: "e3f6b991a6d13078d32ef16e7c5dab0277ecd78b412e6e6cfca83933bfcbe18b", after: "fdb0376c0955ee02e9f070042791805ae61a4ce25d187cd3e72b9f89bbbb9a41" },
  "tests/build-output-hygiene.test.mjs": { before: "bf2300a8ce5e340bcd22a6c85a2e1ebcae8cae5fa482a96873d12d897fdea6d2", after: "f615b48c100388bce39367f8864d29746d2e55a8d0c62b9fe8547085405d6a63" },
  "tests/lattice-qualification-usage-evidence.test.mjs": { before: "3bce30a1156371af248bdc1a959b449f38781b93dddce3b693b88bee64709c27", after: "aed68b3f98a8537719f817b733d3c9c964d06c2dce5a17270d53a57e763dcfea" },
  "app/resume/lattice/verificationCorrection.js": { before: "6c5d0f25256e633b877a1483f09972689742bcdd0a1fb5629c4cc95b055a1026", after: "6e3a0c61fa1367b45b515cff90cf72561beca9990ff4897d767fee3af8732511" },
  "app/resume/lattice/validators.js": { before: "20e938aa40b7290a28dcc5fe86af6c7f092f33b9bd9a033b3c45eff59e106a64", after: "1302b1782851234c00ab5c74f3fac824da8a758f40ce05398d41150e32024721" },
});
const sourceCarryExceptions = Object.freeze({
  [sourceCarryEditorialPage.path]: sourceCarryEditorialPage.beforeSha256,
  "scripts/verify-text-to-lattice-release.mjs": "e171b7997594b9330bd2bf75a4b282b5bdd3512ba226bdf2da5cc722783d848a",
  "tests/lattice-documentation.test.mjs": "66a6dc7a5c26c4d25afbd39bec5f7f4f93cdb7e66160022d6ef90fa60a3da28e",
  "tests/lattice-release-boundary.test.mjs": "7c50db000140269e6772e7746b84fdc280a4a4d2c666d674f500ca74a2bf1114",
  ...Object.fromEntries(Object.entries(approvedPublicationFiles).map(([path, hashes]) => [path, hashes.before])),
});
const qualificationHistory = Object.freeze({
  path: "docs/release-evidence/text-to-lattice/qualification-history-2026-11-23.md",
  pointer: "../release-evidence/text-to-lattice/qualification-history-2026-11-23.md",
  immutableUrl: "https://github.com/howardhayden/folio/blob/b211964213cd49e8335a73bcbebce3221c3a6bc2/docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md",
  bytes: 708796,
  sha256: "097d59a7779e108788e7d489a6f8123ae03dd92f3909792dc79ae4818a9e7593",
});

function approvedSourceCarry(register) {
  const carry = register?.authority?.browserEvidenceSourceCarry;
  const record = register?.authority?.browserEvidence;
  return carry?.format === "TEXT_TO_LATTICE_G06_SOURCE_CARRY_V1"
    && carry.authorization === "owner-approved-long-job-and-clearance-20261126"
    && carry.capturedCommit === sourceCarryCapture.commit && record?.deployedCommit === carry.capturedCommit
    && carry.capturedSourceSetSha256 === sourceCarryCapture.source && record.qualifiedSourceSetSha256 === carry.capturedSourceSetSha256
    && carry.evidenceId === sourceCarryCapture.evidenceId && record.evidenceId === carry.evidenceId
    && carry.evidenceSha256 === sourceCarryCapture.evidenceSha256 && record.sha256 === carry.evidenceSha256
    && carry.currentSourceSetSha256 === register.authority.qualifiedSourceSet.sha256
    && verifyReleaseStatusState(register).qualified;
}

export function verifyQualificationHistory(register, currentBytes, historyBytes) {
  if (!approvedSourceCarry(register)) fail("separate qualification history requires the approved qualified source carry.");
  if (!Buffer.isBuffer(currentBytes) || !Buffer.isBuffer(historyBytes)
    || historyBytes.length !== qualificationHistory.bytes || digest(historyBytes) !== qualificationHistory.sha256) {
    fail("qualification history appendix must match the complete pinned b211 dossier bytes.");
  }
  // Keep the original unique separator, exact held suffix and stale-prefix rules.
  const historicalPrefix = datedDossierCurrentBytes(historyBytes);
  if (staleEnabledPublicationPattern.test(historicalPrefix.toString("utf8"))) {
    fail("qualification history appendix contains stale copy outside its original dated boundary.");
  }
  const current = currentBytes.toString("utf8");
  if (!current.includes("**Technical history:**") || !current.includes(qualificationHistory.pointer)
    || !current.includes(qualificationHistory.immutableUrl)) {
    fail("current qualification dossier must link its exact technical history and immutable source.");
  }
  if (staleEnabledPublicationPattern.test(current)) fail("current qualification dossier contains stale held-gate copy.");
  return historyBytes.toString("utf8");
}

function sourceFingerprint(files) {
  const hash = createHash("sha256").update("TEXT_TO_LATTICE_QUALIFIED_SOURCE_SET_V1\0");
  for (const { path, bytes } of files) {
    hash.update(`${Buffer.byteLength(path)}\0${path}\0${bytes.length}\0`);
    hash.update(bytes);
    hash.update("\0");
  }
  return hash.digest("hex");
}

/** Compare actual source bytes with the one owner-approved original capture.
 * Production supplies filesystem-verified source entries and the pinned appendix;
 * the explicit byte arguments let regression tests exercise refusal boundaries.
 */
export function verifyBrowserEvidenceSourceCarry(register, record, files, proofBytes) {
  const carry = exactObjectFields(register.authority?.browserEvidenceSourceCarry,
    ["format", "authorization", "capturedCommit", "capturedSourceSetSha256", "currentSourceSetSha256", "evidenceId", "evidenceSha256", "proof"],
    "authority.browserEvidenceSourceCarry");
  if (carry.format !== "TEXT_TO_LATTICE_G06_SOURCE_CARRY_V1"
    || carry.authorization !== "owner-approved-long-job-and-clearance-20261126"
    || carry.capturedCommit !== sourceCarryCapture.commit || record.deployedCommit !== carry.capturedCommit
    || carry.capturedSourceSetSha256 !== sourceCarryCapture.source || record.qualifiedSourceSetSha256 !== carry.capturedSourceSetSha256
    || carry.evidenceId !== sourceCarryCapture.evidenceId || record.evidenceId !== carry.evidenceId
    || carry.evidenceSha256 !== sourceCarryCapture.evidenceSha256 || record.sha256 !== carry.evidenceSha256
    || carry.currentSourceSetSha256 !== register.authority.qualifiedSourceSet.sha256
    || carry.currentSourceSetSha256 === carry.capturedSourceSetSha256) {
    fail("source carry must bind the approved original729 proof and distinct current qualified source.");
  }
  const proofRef = exactObjectFields(carry.proof, ["path", "bytes", "sha256"], "source carry proof");
  if (proofRef.path !== sourceCarryCapture.proofPath || !Number.isSafeInteger(proofRef.bytes)
    || proofRef.bytes <= 0 || proofRef.bytes > 1048576 || !sha256Pattern.test(proofRef.sha256 ?? "")
    || !Buffer.isBuffer(proofBytes) || proofBytes.length !== proofRef.bytes || digest(proofBytes) !== proofRef.sha256) {
    fail("source carry appendix must match its fixed path, byte count and SHA-256.");
  }
  let proof;
  try { proof = JSON.parse(proofBytes.toString("utf8")); } catch { fail("source carry appendix must be JSON."); }
  exactObjectFields(proof, ["format", "capturedPaths", "exceptions"], "source carry appendix");
  if (proof.format !== "TEXT_TO_LATTICE_G06_FILE_DIGESTS_V2" || !Array.isArray(files)
    || files.length !== 267 || files.some((entry) => typeof entry.path !== "string" || !Buffer.isBuffer(entry.bytes))
    || new Set(files.map(({ path }) => path)).size !== 267
    || JSON.stringify(files.map(({ path }) => path)) !== JSON.stringify(files.map(({ path }) => path).sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b))))
    || JSON.stringify(proof.capturedPaths) !== JSON.stringify(files.map(({ path }) => path))) {
    fail("source carry requires the exact same sorted267 captured paths.");
  }
  if (sourceFingerprint(files) !== carry.currentSourceSetSha256) fail("source carry current source fingerprint differs.");
  if (!Array.isArray(proof.exceptions)
    || JSON.stringify(proof.exceptions.map((entry) => entry?.path)) !== JSON.stringify(Object.keys(sourceCarryExceptions))) {
    fail("source carry requires exactly the approved file exceptions.");
  }
  const originals = new Map();
  for (const entry of proof.exceptions) {
    exactObjectFields(entry, ["path", "beforeSha256", "afterSha256"], "source carry exception");
    const current = files.find(({ path }) => path === entry.path);
    if (!current || entry.beforeSha256 !== sourceCarryExceptions[entry.path]
      || !sha256Pattern.test(entry.afterSha256 ?? "") || digest(current.bytes) !== entry.afterSha256
      || entry.afterSha256 === entry.beforeSha256) fail("source carry exception must bind exact approved before and after bytes.");
    if (entry.path === sourceCarryEditorialPage.path
      && (entry.afterSha256 !== sourceCarryEditorialPage.afterSha256
        || digest(current.bytes) !== sourceCarryEditorialPage.afterSha256)) {
      fail("source carry editorial page must match the frozen owner-approved after bytes.");
    }
    if (Object.hasOwn(approvedPublicationFiles, entry.path)
      && entry.afterSha256 !== approvedPublicationFiles[entry.path].after) {
      fail("source carry must use the frozen approved publication bytes.");
    }
    originals.set(entry.path, entry.beforeSha256);
  }
  // The ordered digest list is independently derived from the immutable G06
  // checkout. Keep test passages and original file bodies out of this evidence.
  const captured = files.map(({ path, bytes }) => [path, originals.get(path) ?? digest(bytes)]);
  if (digest(Buffer.from(JSON.stringify(captured))) !== sourceCarryCapture.fileDigestsSha256) {
    fail("source carry changes an unaffected captured source byte or path.");
  }
  return Object.freeze({ capturedCommit: carry.capturedCommit, capturedSourceSetSha256: carry.capturedSourceSetSha256,
    currentSourceSetSha256: carry.currentSourceSetSha256, evidenceId: carry.evidenceId, evidenceSha256: carry.evidenceSha256 });
}

/**
 * Bind a qualified release to one strict, sanitized browser-evidence bundle.
 * The verifier argument exists only so unit tests can exercise every comparison;
 * production source verification always uses verifyBrowserEvidenceBundle.
 */
export async function verifyBrowserEvidenceAuthority(
  register,
  releaseState = verifyReleaseStatusState(register),
  verifyBundle = verifyBrowserEvidenceBundle,
) {
  const hasMode = Object.hasOwn(register.authority?.browserEvidence ?? {}, "qualificationMode");
  const authorityFields = [...browserEvidenceAuthorityFields, ...(hasMode ? ["qualificationMode"] : [])];
  const record = exactObjectFields(
    register.authority?.browserEvidence,
    authorityFields,
    "authority.browserEvidence",
  );
  if (!releaseState.qualified) {
    if (Object.hasOwn(register.authority, "browserEvidenceSourceCarry")) {
      fail("source carry is allowed only for the approved qualified release.");
    }
    if (record.status !== "not-collected") {
      fail("held and qualification-pending releases must classify browser evidence as not-collected.");
    }
    for (const field of authorityFields.slice(1)) {
      if (record[field] !== null) {
        fail(`authority.browserEvidence.${field} must be null until the release is qualified.`);
      }
    }
    return null;
  }

  if (record.status !== "verified-sanitized-bundle") {
    fail("a qualified release must bind a verified sanitized browser-evidence bundle.");
  }
  if (typeof record.path !== "string") {
    fail("qualified authority.browserEvidence.path must be a repository-relative bundle path.");
  }
  const resolvedPath = pathWithinRoot(record.path, "qualified browser-evidence path");
  if (!browserEvidenceRepositoryPathPattern.test(record.path) || resolvedPath.relative !== record.path) {
    fail("qualified authority.browserEvidence.path must name a canonical repository-relative JSON bundle path.");
  }
  if (!sha256Pattern.test(record.sha256 ?? "") || /^0{64}$/u.test(record.sha256)) {
    fail("qualified authority.browserEvidence.sha256 must be a nonzero lowercase SHA-256 digest.");
  }

  let bundle;
  try {
    bundle = await verifyBundle(resolvedPath.absolute);
  } catch (error) {
    fail(`qualified browser-evidence bundle failed strict validation: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (bundle === null || typeof bundle !== "object" || Array.isArray(bundle)
    || bundle.evidence === null || typeof bundle.evidence !== "object" || Array.isArray(bundle.evidence)
    || bundle.evidence.deployment === null || typeof bundle.evidence.deployment !== "object"
    || Array.isArray(bundle.evidence.deployment)) {
    fail("qualified browser-evidence verifier returned an invalid result.");
  }
  if (bundle?.sha256 !== record.sha256) {
    fail("qualified authority.browserEvidence.sha256 does not match the strict browser-evidence bundle bytes.");
  }
  const expectedIdentity = browserEvidenceIdentity(bundle.evidence);
  if (hasMode !== Object.hasOwn(expectedIdentity, "qualificationMode")) {
    fail("qualified authority.browserEvidence.qualificationMode does not match the strict browser-evidence bundle.");
  }
  for (const [field, expected] of Object.entries(expectedIdentity)) {
    if (record[field] !== expected) {
      fail(`qualified authority.browserEvidence.${field} does not match the strict browser-evidence bundle.`);
    }
  }
  if (record.qualifiedSourceSetSha256 !== register.authority?.qualifiedSourceSet?.sha256) {
    if (!Object.hasOwn(register.authority, "browserEvidenceSourceCarry")) {
      fail("qualified authority.browserEvidence.qualifiedSourceSetSha256 must match authority.qualifiedSourceSet.sha256.");
    }
    const proofPath = pathWithinRoot(sourceCarryCapture.proofPath, "source carry appendix");
    let cursor = root;
    for (const part of sourceCarryCapture.proofPath.split("/")) {
      cursor = join(cursor, part);
      if ((await lstat(cursor)).isSymbolicLink()) fail("source carry appendix must not use symbolic links.");
    }
    const metadata = await lstat(proofPath.absolute);
    if (!metadata.isFile() || metadata.size > 1048576) fail("source carry appendix must be a bounded regular file.");
    const current = await readVerifiedQualifiedSourceSet(register);
    verifyBrowserEvidenceSourceCarry(register, record, current.files, await readFile(proofPath.absolute));
  } else if (Object.hasOwn(register.authority, "browserEvidenceSourceCarry")) {
    fail("source carry cannot replace an exact-source evidence binding.");
  }
  return Object.freeze({ path: record.path, sha256: record.sha256, ...expectedIdentity });
}

export async function qualifiedFilesBelow(directory, directoryLabel) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) fail(`qualified source tree ${directoryLabel} contains a symbolic link.`);
    if (entry.isDirectory() && qualifiedToolResidueDirectories.has(entry.name)) continue;
    if (entry.isDirectory()) nested.push(...await qualifiedFilesBelow(path, directoryLabel));
    else if (entry.isFile()) nested.push(path);
    else fail(`qualified source tree ${directoryLabel} contains an unsupported filesystem entry.`);
  }
  return nested;
}

async function readVerifiedQualifiedSourceSet(register) {
  const sourceSet = register.authority?.qualifiedSourceSet;
  if (sourceSet?.algorithm !== qualifiedSourceSetAlgorithm) fail("qualified source set uses an unsupported digest algorithm.");
  if (!sha256Pattern.test(sourceSet.sha256 ?? "")) fail("qualified source set must carry a lowercase SHA-256 digest.");
  for (const field of ["files", "trees"]) {
    if (!Array.isArray(sourceSet[field]) || sourceSet[field].length === 0
      || sourceSet[field].some((value) => typeof value !== "string" || value.trim() === "")
      || new Set(sourceSet[field]).size !== sourceSet[field].length
      || [...sourceSet[field]].sort().some((value, index) => value !== sourceSet[field][index])) {
      fail(`qualified source set ${field} must be a nonempty, sorted, duplicate-free path list.`);
    }
  }
  if (JSON.stringify(sourceSet.files) !== JSON.stringify(qualifiedSourceFiles)
    || JSON.stringify(sourceSet.trees) !== JSON.stringify(qualifiedSourceTrees)) {
    fail("qualified source set must contain the exact reviewed activation, runtime, validator, test, license-routing, legal-notice, response-policy, secret-bootstrap, and workflow path inventory.");
  }
  const prohibited = /^(?:docs\/text-to-lattice\/(?:LATTICE-DOCUMENTATION-ATLAS\.json|TEXT-TO-LATTICE-RELEASE-(?:REGISTER\.json|QUALIFICATION\.md))|public\/|site\/)/u;
  if ([...sourceSet.files, ...sourceSet.trees].some((path) => prohibited.test(path))) {
    fail("qualified source set must exclude its register, dossier, atlas, and generated outputs.");
  }

  const expanded = [];
  for (const path of sourceSet.files) {
    const resolved = pathWithinRoot(path, "qualified source file");
    const metadata = await lstat(resolved.absolute);
    if (metadata.isSymbolicLink() || !metadata.isFile()) fail(`qualified source file is not a regular file: ${path}.`);
    expanded.push(resolved);
  }
  for (const path of sourceSet.trees) {
    const resolved = pathWithinRoot(path, "qualified source tree");
    const metadata = await lstat(resolved.absolute);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) fail(`qualified source tree is not a directory: ${path}.`);
    for (const absolute of await qualifiedFilesBelow(resolved.absolute, path)) {
      expanded.push({ absolute, relative: relative(root, absolute).split("\\").join("/") });
    }
  }
  expanded.sort((left, right) => Buffer.compare(Buffer.from(left.relative), Buffer.from(right.relative)));
  if (new Set(expanded.map(({ relative: path }) => path)).size !== expanded.length) {
    fail("qualified source set files and trees overlap.");
  }
  const hash = createHash("sha256").update("TEXT_TO_LATTICE_QUALIFIED_SOURCE_SET_V1\0");
  const files = [];
  for (const entry of expanded) {
    const bytes = await readFile(entry.absolute);
    files.push({ path: entry.relative, bytes });
    hash.update(`${Buffer.byteLength(entry.relative)}\0${entry.relative}\0${bytes.length}\0`);
    hash.update(bytes);
    hash.update("\0");
  }
  const observed = hash.digest("hex");
  if (observed !== sourceSet.sha256) fail("qualified source-set digest does not match the named activation, runtime, validator, test, license-routing, legal-notice, response-policy, secret-bootstrap, and workflow sources.");
  return { sha256: observed, files };
}

export async function verifyQualifiedSourceSet(register) {
  return (await readVerifiedQualifiedSourceSet(register)).sha256;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

function machineValueLabel(value) {
  const words = value.replaceAll("-", " ");
  return `${words[0].toUpperCase()}${words.slice(1)}`;
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail(`${label} is not readable JSON: ${error.message}`);
  }
}

function sameJson(left, right) {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right));
}

async function verifyTerms(register) {
  const terms = register.artifactSet.llamaTerms;
  if (terms.active?.status !== "active"
    || terms.historicalRemote?.status !== "historical-inactive"
    || terms.historicalBrowserLocal?.status !== "historical-inactive") {
    fail("active Llama 3.3, historical remote Llama 3.1, and historical browser-local Llama 3.2 terms must remain explicitly split.");
  }
  const historicalRemote = terms.historicalRemote.priorActiveRecord;
  if (!sameJson(Object.keys(terms.historicalRemote).sort(), ["claimBoundary", "priorActiveRecord", "status"])
    || !sameJson(historicalRemote, { status: "active", ...historicalRemoteLlamaTermsProvenance, termsMatchStatus: "byte-identical-to-reviewed-model-repository-files" })) {
    fail("historical remote Llama 3.1 terms must preserve the entire prior active record.");
  }
  requireString(terms.historicalRemote.claimBoundary, "historical remote terms claim boundary");
  for (const [scope, termsRecord] of [["active", terms.active], ["historical remote", historicalRemote], ["historical browser-local", terms.historicalBrowserLocal]]) {
    for (const [key, label] of [["license", "license"], ["acceptableUsePolicy", "acceptable-use policy"]]) {
      const record = termsRecord[key];
      requireString(record.path, `${scope} Llama ${label} path`);
      if (!sha256Pattern.test(record.sha256)) fail(`${scope} Llama ${label} must carry a lowercase SHA-256 digest.`);
      const bytes = await readFile(join(root, record.path));
      if (digest(bytes) !== record.sha256) fail(`${scope} Llama ${label} digest does not match ${record.path}.`);
      const expectedCanonical = scope === "active" ? activeLlamaTermsProvenance[key].canonicalUrl
        : scope === "historical remote" ? historicalRemoteLlamaTermsProvenance[key].canonicalUrl
          : key === "license" ? LLAMA_3_2_TERMS_PROVENANCE.licenseUrl : LLAMA_3_2_TERMS_PROVENANCE.acceptableUseUrl;
      if (record.canonicalUrl !== expectedCanonical) fail(`${scope} Llama ${label} canonical URL drifted from its reviewed source.`);
      if (scope !== "historical browser-local" && (!gitRevisionPattern.test(record.gitBlob) || gitBlobDigest(bytes) !== record.gitBlob)) {
        fail(`${scope} Llama ${label} git blob does not match ${record.path}.`);
      }
    }
  }
}

async function verifyLlamaUseEvaluation(register) {
  const evaluation = await readJson(llamaEvaluationPath, "Llama-use evaluation fixture");
  const record = register.artifactSet.llamaBehaviorEvaluation;
  const gate = register.gates.find(({ id }) => id === "GATE-04A");
  if (evaluation.format !== "TEXT_TO_LATTICE_LLAMA_USE_EVALUATION_CASES" || evaluation.schemaVersion !== 1) {
    fail("Llama-use evaluation fixture format is unsupported.");
  }
  if (record.targetVerifier?.model !== register.artifactSet.activeCapability.provider.verifierModel
    || record.targetVerifier?.modelRepositoryRevision !== register.artifactSet.llamaTerms.active.modelRepositoryRevision
    || record.evidenceResetAt !== "2026-11-20"
    || !/another (?:model, )?provider or serving revision/iu.test(record.evidenceResetReason ?? "")
    || !sameJson(record.historicalEvaluationRecord, historicalLlamaBehaviorEvaluation)) {
    fail("Llama-use evaluation evidence must be reset and bound to the exact active verifier model and reviewed repository revision.");
  }
  requireString(evaluation.claimBoundary, "Llama-use evaluation claim boundary");
  if (gate?.status !== record.exactModelExecutionStatus
    || record.exactModelExecutionStatus !== "accepted-residual-risk"
    || !/GATE-04A records accepted residual risk/iu.test(evaluation.claimBoundary)
    || /GATE-04A remains open/iu.test(evaluation.claimBoundary)) {
    fail("Llama-use evaluation claim boundary must match the accepted-residual-risk GATE-04A state.");
  }
  requireString(evaluation.decisionRule, "Llama-use evaluation decision rule");
  exactIds(evaluation.cases, [...expectedLlamaUseCases.keys()], "Llama-use evaluation cases");
  for (const item of evaluation.cases) {
    const [expectedClass, expectedSafety] = expectedLlamaUseCases.get(item.id);
    if (item.class !== expectedClass || item.expectedSafety !== expectedSafety) {
      fail(`${item.id} changed its reviewed class or expected safety disposition.`);
    }
    for (const field of ["source", "rationale"]) requireString(item[field], `${item.id} ${field}`);
    if (item.source.includes("\n") || item.source.length > 260 || /https?:\/\/|```/iu.test(item.source)) {
      fail(`${item.id} must remain a short, non-operational text fixture.`);
    }
  }
  const allowCount = evaluation.cases.filter(({ expectedSafety }) => expectedSafety).length;
  const denyCount = evaluation.cases.length - allowCount;
  if (record.path !== "docs/text-to-lattice/LLAMA-USE-EVALUATION-CASES.json"
    || record.caseCount !== evaluation.cases.length
    || record.expectedAllowCount !== allowCount
    || record.expectedDenyCount !== denyCount
    || record.fixtureStatus !== "defined-and-machine-checked"
    || !artifactQualificationStatuses.has(record.exactModelExecutionStatus)) {
    fail("Llama-use evaluation evidence drifted from the release register.");
  }
  if (record.exactModelExecutionPerformed !== false) {
    fail("Llama-use evaluation must not claim exact-model execution without recorded runtime evidence.");
  }
  const bytes = await readFile(llamaEvaluationPath);
  if (!sha256Pattern.test(record.sha256) || digest(bytes) !== record.sha256) {
    fail("Llama-use evaluation fixture digest drifted from the release register.");
  }
}

async function verifyQualificationDossier(register) {
  const releaseState = verifyReleaseStatusState(register);
  const bytes = await readFile(qualificationPath);
  if (!sha256Pattern.test(register.authority.qualificationDossierSha256)
    || digest(bytes) !== register.authority.qualificationDossierSha256) {
    fail("release qualification dossier digest drifted from the release register.");
  }
  const source = bytes.toString("utf8");
  let historySource = null;
  if (approvedSourceCarry(register)) {
    const historyPath = pathWithinRoot(qualificationHistory.path, "qualification history appendix");
    const metadata = await lstat(historyPath.absolute);
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size !== qualificationHistory.bytes) {
      fail("qualification history appendix must be the pinned regular file.");
    }
    historySource = verifyQualificationHistory(register, bytes, await readFile(historyPath.absolute));
  }
  const artifactSetDigest = digest(Buffer.from(JSON.stringify(canonicalJson(register.artifactSet))));
  const artifacts = register.artifactSet;
  const activeArtifactClaims = [
    artifacts.activeCapability.status,
    artifacts.activeCapability.route,
    artifacts.activeCapability.method,
    String(artifacts.activeCapability.schemaVersion),
    ...artifacts.activeCapability.requestFields,
    ...artifacts.activeCapability.requestedModes,
    ...artifacts.activeCapability.secretBindingNames,
    artifacts.activeCapability.browserQuotaCookie.name,
    artifacts.activeCapability.browserQuotaCookie.path,
    String(artifacts.activeCapability.admission.globalPerUtcDay),
    String(artifacts.activeCapability.admission.perOrdinaryPersistentBrowserCookieJarPerUtcDay),
    artifacts.activeCapability.admission.maximumProviderCallsFromAdmittedRequestsPerUtcDay.toLocaleString("en-US"),
    ...Object.values(artifacts.activeCapability.provider.stageCallTimeoutsMs)
      .map((value) => value.toLocaleString("en-US")),
    artifacts.activeCapability.provider.maximumCallTimeoutMs.toLocaleString("en-US"),
    ...Object.values(artifacts.activeCapability.provider.stageMaximumOutputTokens)
      .map((value) => value.toLocaleString("en-US")),
    artifacts.activeCapability.provider.maximumRequestedOutputTokensPerCall
      .toLocaleString("en-US"),
    artifacts.activeCapability.provider.maximumRequestedOutputTokensPerAdmittedRequest
      .toLocaleString("en-US"),
    artifacts.activeCapability.provider.maximumRequestedOutputTokensFromAdmittedRequestsPerUtcDay
      .toLocaleString("en-US"),
    artifacts.activeCapability.provider
      .maximumRequestedOutputTokensFromOneCooperatingBrowserCookieJarPerUtcDay
      .toLocaleString("en-US"),
    artifacts.activeCapability.provider.endpoint,
    artifacts.activeCapability.provider.verificationEndpoint,
    artifacts.activeCapability.provider.verificationRequestModel,
    artifacts.activeCapability.provider.generatorModel,
    artifacts.activeCapability.provider.verifierModel,
    artifacts.activeCapability.provider.revisionStatus,
    artifacts.activeCapability.applicationRetention,
    artifacts.activeCapability.providerRetentionBoundary,
  ];
  const artifactClaims = [
    ...activeArtifactClaims,
    artifacts.historicalBrowserLocalArtifacts.status,
    artifacts.historicalBrowserLocalArtifacts.verbatimSha256,
    ...[artifacts.runtime, artifacts.tokenizerRuntime, artifacts.structuredOutputRuntime]
      .flatMap(({ name, version, url }) => [name, version, url]),
    ...["generator", "verifier"].flatMap((role) => [
      artifacts.models[role].id,
      artifacts.models[role].revision,
      artifacts.models[role].artifactUrl,
      artifacts.tokenizers[role].path,
      artifacts.tokenizers[role].sha256,
      artifacts.tokenizers[role].sri,
      artifacts.wasm.files[role].name,
      artifacts.wasm.files[role].bytes.toLocaleString("en-US"),
      artifacts.wasm.files[role].sha256,
      artifacts.wasm.files[role].sri,
      artifacts.wasm.files[role].gitBlob,
    ]),
    ...["compatibilityGenerator", "compatibilityVerifier"].flatMap((key) => [
      artifacts.wasm.files[key].name,
      artifacts.wasm.files[key].bytes.toLocaleString("en-US"),
      artifacts.wasm.files[key].sha256,
      artifacts.wasm.files[key].sri,
      artifacts.wasm.files[key].gitBlob,
    ]),
    artifacts.wasm.repository,
    artifacts.wasm.repositoryRevision,
    artifacts.wasm.directory,
    ...["initialArtifactCommit", "finalArtifactCommit", "introducingMergeCommit", "pullRequest", "recordedTvmSourceRevision", "earlyTimePlausibleTvmPrHeadRevision", "mlcLlmSourceRevision", "historicalBuildScript", "tokenizersCppRevision"]
      .map((field) => artifacts.wasm.lineage[field]),
    artifacts.llamaTerms.active.modelRepositoryRevision,
    artifacts.llamaTerms.active.officialSourceCommit,
    artifacts.llamaTerms.active.license.sha256,
    artifacts.llamaTerms.active.license.canonicalUrl,
    artifacts.llamaTerms.active.acceptableUsePolicy.sha256,
    artifacts.llamaTerms.active.acceptableUsePolicy.canonicalUrl,
    artifacts.llamaTerms.historicalBrowserLocal.officialSourceCommit,
    artifacts.llamaTerms.historicalBrowserLocal.license.sha256,
    artifacts.llamaTerms.historicalBrowserLocal.license.canonicalUrl,
    artifacts.llamaTerms.historicalBrowserLocal.acceptableUsePolicy.sha256,
    artifacts.llamaTerms.historicalBrowserLocal.acceptableUsePolicy.canonicalUrl,
    artifacts.llamaBehaviorEvaluation.targetVerifier.model,
    artifacts.llamaBehaviorEvaluation.targetVerifier.modelRepositoryRevision,
    artifacts.llamaBehaviorEvaluation.sha256,
  ];
  const currentArtifactClaims = historySource === null ? artifactClaims : activeArtifactClaims.map((claim) =>
    claim === artifacts.activeCapability.providerRetentionBoundary
      ? claim.split(" Previous Venice disclosure follows verbatim as dated history. ")[0]
      : claim);
  const gateRows = register.gates.map((gate) => `| ${gate.id} · ${gate.label} | ${machineValueLabel(gate.status)} | ${machineValueLabel(gate.marginalValue)} |`);
  const productionLifecycleGate = register.gates.find(({ id }) => id === "GATE-06");
  for (const required of [
    register.implementationBaselineRevision,
    artifactSetDigest,
    register.authority.qualifiedSourceSet.sha256,
    `**Qualification date:** ${register.revision}`,
    ...currentArtifactClaims,
    ...(register.overallStatus === "held" && register.publicClient?.status === "held"
      ? ["**Decision:** hold the interactive client; publish the method, implementation record, and documentation only."]
      : []),
    ...(register.ownerDisposition?.status === "hold-directed"
      ? ["Owner direction keeps the public client held until the active production blockers close; it is not deployment or runtime evidence."]
      : []),
    ...gateRows,
    "consequence × plausibility × lifecycle value",
    ...expectedGateIds,
  ]) {
    if (!source.includes(required)) fail(`release qualification dossier omits ${required}.`);
  }
  if (historySource !== null) {
    for (const required of artifactClaims) {
      if (!source.includes(required) && !historySource.includes(required)) {
        fail(`release qualification dossier and pinned history omit ${required}.`);
      }
    }
  }
  if (!/same-origin `?POST \/api\/lattice`?/iu.test(source)
    || !/application\/vnd\.hah\.text-to-lattice-visitor-session\.v1\+json/u.test(source)
    || !/bodyless/iu.test(source)
    || !/same (?:origin-wide )?(?:browser )?Web Lock/iu.test(source)
    || !/exactly one (?:intended )?content-bearing/iu.test(source)
    || !/setup[^.]*no quota claim or provider call/iu.test(source)
    || !/428 visitor_session_required[^.]*before (?:Durable Object )?admission or provider work/iu.test(source)
    || !/HF_TOKEN/iu.test(source)
    || !/VISITOR_COOKIE_SECRET/iu.test(source)
    || !/__Secure-hah-lattice-api-visitor/u.test(source)
    || !/30[^.]*globally per UTC day/iu.test(source)
    || !/3[^.]*browser cookie jar per UTC day/iu.test(source)
    || !/Hugging Face[\s\S]{0,300}OpenRouter[\s\S]{0,160}DeepInfra/iu.test(source)
    || !/no automatic retry/iu.test(source)
    || !/no (?:alternate )?provider or model fallback/iu.test(source)
    || !/provider-managed[\s\S]{0,240}not byte/iu.test(source)
    || !/qualification expiry/iu.test(source)
    || !/historical inactive[\s\S]{0,300}(?:WebLLM|lease)/iu.test(source)) {
    fail("release qualification must disclose the remote capability, fixed provider, finite failure policy, provider-managed provenance, and historical inactive browser-local record.");
  }
  if (releaseState.held
    && (!/remote production evidence is (?:uncollected|failure-only)/iu.test(source)
      || !/no successful production transformation/iu.test(source))) {
    fail("held release qualification must distinguish uncollected or retained failure evidence from the absence of a successful production transformation.");
  }
  if (releaseState.qualificationPending
    && (!/qualification[- ]pending/iu.test(source)
      || !/(?:not (?:yet )?qualified|non-qualified)/iu.test(source)
      || !/canonical-browser qualification/iu.test(source)
      || !/(?:immediate(?:ly)?[\s\S]{0,180}(?:held|documentation-only)[\s\S]{0,100}rollback|rollback[\s\S]{0,180}immediate(?:ly)?[\s\S]{0,100}(?:held|documentation-only))/iu.test(source))) {
    fail("qualification-pending dossier must call the deployment non-qualified, limit it to canonical-browser qualification, and require immediate held rollback.");
  }
  if (releaseState.qualified) {
    const browserEvidence = register.authority.browserEvidence;
    const structuredEvidence = productionLifecycleGate.activeEvidence.find((entry) => (
      /structured browser evidence/iu.test(entry)
      && entry.includes(browserEvidence.path)
      && entry.includes(`SHA-256 ${browserEvidence.sha256}`)
    ));
    if (!structuredEvidence || !source.includes(structuredEvidence)) {
      fail("qualified dossier must reproduce the exact GATE-06 browser-evidence bundle path and SHA-256 digest.");
    }
  }
}

export function verifyServicePhaseTransport(capability) {
  const expected = {
    "mediaType": LATTICE_SERVICE_EVENTS_MIME,
    "selection": "optional-onServicePhase-callback",
    "canonicalClientUsesPhaseEvents": true,
    "phaseSource": "runTextToLattice.options.onProgress.phase",
    "phaseFrameFields": [
      "type",
      "sequence",
      "phase"
    ],
    "terminalFrameFields": [
      "type",
      "sequence",
      "status",
      "body"
    ],
    "firstSequence": 1,
    "contiguousSequence": true,
    "maximumPhaseFrames": LATTICE_SERVICE_PHASE_LIMIT,
    "maximumTerminalFrames": 1,
    "maximumResponseBytesIncludingFraming": 262144,
    "errorReserveBytes": LATTICE_SERVICE_ERROR_RESERVE_BYTES,
    "transportKeepaliveMs": LATTICE_SERVICE_KEEPALIVE_MS,
    "transportKeepalive": "one-leading-json-space-while-writable",
    "consecutiveDuplicatePhases": "coalesced-server-rejected-client",
    "terminalBody": "existing-validated-result-or-error",
    "resultRequiresTerminalAndEof": true,
    "streamHttp200MeansTransformationSuccess": false,
    "startsAfterAtomicAdmission": true,
    "preadmissionErrors": "existing-non-2xx-json",
    "qualificationDiagnosticHeaderWithStream": "400-invalid_request-before-admission",
    "wholeRequestDeadlineMs": LATTICE_API_REQUEST_TIMEOUT_MS,
    "clientDeadlineMs": LATTICE_CLIENT_TIMEOUT_MS,
    "longRequestDeadlineMs": LATTICE_LONG_API_REQUEST_TIMEOUT_MS,
    "longClientDeadlineMs": LATTICE_LONG_CLIENT_TIMEOUT_MS,
    "deadlineAndQualificationExpiryThroughProducerCompletion": true,
    "readerCancellationAbortsPipeline": true,
    "browserLockThroughTerminalEofOrAbort": true,
    "observerFailureCannotChangeTerminalAcceptance": true,
    "serverPhaseFailureStickyAndAbortsPipeline": true,
    "phaseContentOrIdentifiers": false,
    "percentageOrEtaClaims": false,
    "extraRequests": 0,
    "automaticRetry": false,
    "fallback": false,
    "phases": LATTICE_SERVICE_PHASES
  };
  if (JSON.stringify(capability?.contentRequest?.acceptedResponseTypes)
      !== JSON.stringify(["application/json", LATTICE_SERVICE_EVENTS_MIME])
    || JSON.stringify(canonicalJson(capability?.phaseEvents)) !== JSON.stringify(canonicalJson(expected))) {
    fail("active capability must bind the exact optional phase-stream contract, finite limits and terminal/EOF lifecycle.");
  }
}

function verifyArtifactSet(register) {
  const artifacts = register.artifactSet;
  const capability = artifacts.activeCapability;
  verifyServicePhaseTransport(capability);
  const manifest = REMOTE_CAPABILITIES.textToLattice;
  const expectedCapabilityStatus = {
    held: "held-pending-production-evidence",
    "qualification-pending": "deployed-for-qualification",
    qualified: "qualified",
  }[register.overallStatus];
  if (capability.status !== expectedCapabilityStatus
    || capability.route !== LATTICE_API_PATH
    || capability.route !== manifest.route
    || capability.method !== manifest.method
    || capability.schemaVersion !== LATTICE_API_SCHEMA_VERSION
    || JSON.stringify(capability.requestFields) !== JSON.stringify(LATTICE_REQUEST_FIELDS)
    || JSON.stringify(capability.requestFields) !== JSON.stringify(manifest.transmittedFields)
    || JSON.stringify(capability.requestedModes) !== JSON.stringify(LATTICE_REQUEST_MODES)
    || capability.trigger !== manifest.trigger
    || JSON.stringify(capability.secretBindingNames) !== JSON.stringify([
      "HF_TOKEN",
      LATTICE_API_VISITOR_COOKIE_SECRET_BINDING,
    ])
    || capability.visitorSessionSetup?.route !== LATTICE_API_PATH
    || capability.visitorSessionSetup?.method !== "POST"
    || capability.visitorSessionSetup?.accept !== LATTICE_VISITOR_SESSION_ACCEPT
    || capability.visitorSessionSetup?.bodyless !== true
    || capability.visitorSessionSetup?.contentTypeHeader !== false
    || capability.visitorSessionSetup?.credentialsMode !== "same-origin"
    || capability.visitorSessionSetup?.sharedBrowserWebLock !== true
    || capability.visitorSessionSetup?.acceptedStatus !== 204
    || capability.visitorSessionSetup?.transportOrNon204FailureStopsContentRequest !== true
    || capability.visitorSessionSetup?.establishesOrPreservesSignedCookie !== true
    || capability.visitorSessionSetup?.consumesTransformationQuota !== false
    || capability.visitorSessionSetup?.contactsProvider !== false
    || capability.contentRequest?.route !== LATTICE_API_PATH
    || capability.contentRequest?.method !== "POST"
    || capability.contentRequest?.accept !== "application/json"
    || capability.contentRequest?.contentTypeHeader !== "application/json"
    || capability.contentRequest?.credentialsMode !== "same-origin"
    || capability.contentRequest?.contentBearingRequestsPerAttempt !== 1
    || capability.contentRequest?.httpOnlyCookieStorageObservableByClient !== false
    || capability.contentRequest?.attemptedAfterAcceptedSetupWhenCookieBlockedOrDropped !== true
    || capability.contentRequest?.requiresValidSignedVisitorCookie !== true
    || capability.contentRequest?.missingCookieStatus !== 428
    || capability.contentRequest?.missingCookieCode !== "visitor_session_required"
    || capability.contentRequest?.missingCookieBeforeAdmission !== true
    || capability.contentRequest?.missingCookieBeforeProvider !== true
    || capability.contentRequest?.invalidOrUndeclaredCookieStatus !== 403
    || capability.contentRequest?.invalidOrUndeclaredCookieCode !== "invalid_request"
    || capability.contentRequest?.invalidOrUndeclaredCookieBeforeAdmission !== true
    || capability.contentRequest?.invalidOrUndeclaredCookieBeforeProvider !== true
    || capability.contentRequest?.sameBrowserWebLockAsSetup !== true
    || capability.browserQuotaCookie?.name !== LATTICE_API_VISITOR_COOKIE_NAME
    || capability.browserQuotaCookie?.path !== LATTICE_API_VISITOR_COOKIE_PATH
    || capability.browserQuotaCookie?.secure !== true
    || capability.browserQuotaCookie?.httpOnly !== true
    || capability.browserQuotaCookie?.sameSite !== "Strict"
    || capability.browserQuotaCookie?.domain !== null
    || capability.browserQuotaCookie?.expiresAtNextUtcDay !== true
    || capability.browserQuotaCookie?.containsUserContent !== false
    || capability.browserQuotaCookie?.containsAccountIdentity !== false
    || capability.browserQuotaCookie?.containsBrowserFingerprint !== false
    || capability.browserQuotaCookie?.containsProviderCredential !== false
    || capability.admission?.globalPerUtcDay !== LATTICE_TRANSFORMATIONS_PER_UTC_DAY
    || capability.admission?.perOrdinaryPersistentBrowserCookieJarPerUtcDay
      !== LATTICE_TRANSFORMATIONS_PER_VISITOR_UTC_DAY
    || capability.admission?.perBrowserLimitClaimScope
      !== "cooperating canonical client with an ordinary persistent browser cookie jar"
    || capability.admission?.intentionalCookieClearingOrUncooperativeCallerCovered !== false
    || capability.admission?.globalLimitExactAndAuthoritative !== true
    || capability.admission?.atomicClaimsPerRequest !== 1
    || capability.admission?.countsAdmittedFailures !== true
    || capability.admission?.refundsAdmittedRequests !== false
    || capability.admission?.rechecksSharedQuotaWithinPipeline !== false
    || capability.admission?.usesIpAddress !== false
    || capability.admission?.usesBrowserFingerprint !== false
    || capability.admission?.storesSubmittedContentOrResult !== false
    || capability.admission?.maximumProviderCallsPerAdmittedRequest !== LATTICE_LONG_JOB_POLICY.providerCallLimit
    || capability.admission?.maximumProviderCallsFromAdmittedRequestsPerUtcDay
      !== LATTICE_TRANSFORMATIONS_PER_UTC_DAY * LATTICE_LONG_JOB_POLICY.providerCallLimit
    || capability.provider.endpoint !== HUGGING_FACE_CHAT_COMPLETIONS_URL
    || capability.provider.verificationEndpoint !== HUGGING_FACE_VERIFICATION_CHAT_COMPLETIONS_URL
    || capability.provider.verificationRequestModel !== LATTICE_VERIFICATION_REQUEST_MODEL
    || capability.provider.certificationEndpoint !== HUGGING_FACE_CHAT_COMPLETIONS_URL
    || capability.provider.certificationRequestModel !== LATTICE_REMOTE_MODELS.verifier
    || capability.provider.verificationResponseFormat !== "json_schema"
    || capability.provider.verificationSchemaStrict !== true
    || capability.provider.certificationResponseFormat !== "json_schema"
    || capability.provider.certificationSchemaStrict !== true
    || capability.provider.generatorModel !== LATTICE_REMOTE_MODELS.generator
    || capability.provider.verifierModel !== LATTICE_REMOTE_MODELS.verifier
    || JSON.stringify(capability.provider.stageCallTimeoutsMs)
      !== JSON.stringify(LATTICE_PROVIDER_STAGE_CALL_TIMEOUTS_MS)
    || capability.provider.maximumCallTimeoutMs !== LATTICE_PROVIDER_MAX_CALL_TIMEOUT_MS
    || capability.provider.callLimit !== LATTICE_LONG_JOB_POLICY.providerCallLimit
    || capability.provider.defaultCallLimit !== LATTICE_PROVIDER_CALL_LIMIT
    || capability.provider.longJobPolicy?.minimumWords !== LATTICE_LONG_JOB_POLICY.minimumWords
    || capability.provider.longJobPolicy?.minimumBatches !== LATTICE_LONG_JOB_POLICY.minimumBatches
    || capability.provider.longJobPolicy?.providerCallLimit !== LATTICE_LONG_JOB_POLICY.providerCallLimit
    || capability.browserQuotaCookie?.discardedEdgeCookie !== "cf_clearance"
    || JSON.stringify(capability.provider.stageMaximumOutputTokens)
      !== JSON.stringify(LATTICE_PROVIDER_OUTPUT_TOKEN_LIMITS)
    || capability.provider.maximumRequestedOutputTokensPerCall
      !== LATTICE_PROVIDER_MAX_OUTPUT_TOKENS_PER_CALL
    || capability.provider.maximumRequestedOutputTokensPerAdmittedRequest
      !== LATTICE_PROVIDER_MAX_OUTPUT_TOKENS_PER_ADMITTED_REQUEST
    || capability.provider.maximumRequestedOutputTokensFromAdmittedRequestsPerUtcDay
      !== LATTICE_TRANSFORMATIONS_PER_UTC_DAY
        * LATTICE_PROVIDER_MAX_OUTPUT_TOKENS_PER_ADMITTED_REQUEST
    || capability.provider.maximumRequestedOutputTokensFromOneCooperatingBrowserCookieJarPerUtcDay
      !== LATTICE_TRANSFORMATIONS_PER_VISITOR_UTC_DAY
        * LATTICE_PROVIDER_MAX_OUTPUT_TOKENS_PER_ADMITTED_REQUEST
    || capability.provider.responseByteLimit !== LATTICE_PROVIDER_RESPONSE_BYTE_LIMIT
    || capability.provider.contentCharacterLimit !== LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT
    || capability.provider.revisionStatus !== "provider-managed-not-byte-pinned"
    || capability.provider.historicalByteEquivalenceEstablished !== false
    || capability.automaticRetry !== false
    || capability.automaticRetry !== manifest.automaticRetry
    || capability.alternateProviderFallback !== false
    || capability.alternateProviderFallback !== manifest.alternateProviderFallback
    || capability.responseCachePolicy !== "no-store"
    || !/no application storage/iu.test(capability.applicationRetention)
    || !/external-provider/iu.test(capability.providerRetentionBoundary)) {
    fail("active remote capability drifted from the browser manifest, protocol, or fixed provider adapter.");
  }
  const historical = artifacts.historicalBrowserLocalArtifacts;
  const historicalRecordFields = [
    "runtime",
    "tokenizerRuntime",
    "structuredOutputRuntime",
    "models",
    "tokenizers",
    "wasm",
  ];
  const historicalClaimPattern = register.overallStatus === "held"
    ? /not loaded by the held public artifact/iu
    : /not loaded by the (?:qualification-pending|qualified|active remote) public artifact/iu;
  if (historical?.status !== "historical-inactive"
    || JSON.stringify(historical.recordFields) !== JSON.stringify(historicalRecordFields)
    || !historicalClaimPattern.test(historical.claimBoundary)
    || !sha256Pattern.test(historical.verbatimSha256 ?? "")) {
    fail("browser-local artifact records must be explicitly historical inactive.");
  }
  const historicalDigest = digest(Buffer.from(JSON.stringify(Object.fromEntries(
    historicalRecordFields.map((field) => [field, artifacts[field]]),
  ))));
  if (historicalDigest !== historical.verbatimSha256) {
    fail("historical browser-local artifact evidence is not verbatim.");
  }
  for (const [record, contract, label] of [
    [artifacts.runtime, LATTICE_RUNTIME, "WebLLM"],
    [artifacts.tokenizerRuntime, LATTICE_TOKENIZER_RUNTIME, "tokenizer runtime"],
    [artifacts.structuredOutputRuntime, LATTICE_STRUCTURED_OUTPUT_RUNTIME, "structured-output runtime"],
  ]) {
    if (record.name !== contract.name) fail(`${label} name drifted from the release register.`);
    if (record.version !== contract.version) fail(`${label} version drifted from the release register.`);
    if (record.url !== contract.repository) fail(`${label} repository URL drifted from the release register.`);
  }

  for (const role of ["generator", "verifier"]) {
    if (artifacts.models[role].id !== LATTICE_MODEL_ROLES[role].id) fail(`${role} model identifier drifted from the release register.`);
    if (artifacts.models[role].revision !== LATTICE_MODEL_ROLES[role].revision) fail(`${role} model revision drifted from the release register.`);
    if (artifacts.models[role].artifactUrl !== LATTICE_MODEL_ROLES[role].revisionUrl) fail(`${role} model artifact URL drifted from the release register.`);
    if (artifacts.models[role].baseModelUrl !== LATTICE_MODEL_ROLES[role].baseModelRepository) fail(`${role} base-model URL drifted from the release register.`);
    if (artifacts.tokenizers[role].path !== LATTICE_TOKENIZER_FILENAME) fail(`${role} tokenizer path drifted from the release register.`);
    if (artifacts.tokenizers[role].sha256 !== LATTICE_TOKENIZER_SHA256[role]) fail(`${role} tokenizer digest drifted from the release register.`);
    if (artifacts.tokenizers[role].sri !== LATTICE_TOKENIZER_SRI[role]
      || artifacts.tokenizers[role].sri !== `sha256-${Buffer.from(artifacts.tokenizers[role].sha256, "hex").toString("base64")}`) {
      fail(`${role} tokenizer SRI drifted from the model contract.`);
    }
    const wasm = artifacts.wasm.files[role];
    if (!Number.isSafeInteger(wasm.bytes) || wasm.bytes <= 0) fail(`${role} WASM byte count is invalid.`);
    if (!sha256Pattern.test(wasm.sha256)) fail(`${role} WASM digest is invalid.`);
    if (wasm.sha256 !== LATTICE_WASM_SHA256[role]) fail(`${role} WASM digest drifted from the model contract.`);
    if (wasm.sri !== `sha256-${Buffer.from(wasm.sha256, "hex").toString("base64")}`) fail(`${role} WASM SRI does not encode its SHA-256 digest.`);
    if (!gitRevisionPattern.test(wasm.gitBlob)) fail(`${role} WASM git blob is invalid.`);
    if (!LATTICE_MODEL_ROLES[role].modelLib.endsWith(`/${wasm.name}`)) fail(`${role} WASM filename drifted from the model contract.`);
  }
  for (const [key, role] of [["compatibilityGenerator", "generator"], ["compatibilityVerifier", "verifier"]]) {
    const wasm = artifacts.wasm.files[key];
    const contract = LATTICE_COMPATIBILITY_WASM[role];
    if (!Number.isSafeInteger(wasm.bytes) || wasm.bytes !== contract.bytes) fail(`${key} WASM byte count drifted from the model contract.`);
    if (wasm.name !== contract.name || !contract.modelLib.endsWith(`/${wasm.name}`)) fail(`${key} WASM filename drifted from the model contract.`);
    if (wasm.sha256 !== contract.sha256) fail(`${key} WASM digest drifted from the model contract.`);
    if (wasm.sri !== contract.sri || wasm.sri !== `sha256-${Buffer.from(wasm.sha256, "hex").toString("base64")}`) fail(`${key} WASM SRI drifted from the model contract.`);
    if (wasm.gitBlob !== contract.gitBlob || !gitRevisionPattern.test(wasm.gitBlob)) fail(`${key} WASM git blob drifted from the model contract.`);
  }
  if (artifacts.wasm.repository !== LATTICE_WASM_REPOSITORY) fail("WASM repository URL drifted from the release register.");
  if (artifacts.wasm.repositoryRevision !== LATTICE_WASM_REVISION) fail("WASM repository revision drifted from the release register.");
  if (artifacts.wasm.directory !== LATTICE_WASM_BUILD_LINEAGE.releaseDirectory) fail("WASM release directory drifted from the release register.");
  for (const field of ["initialArtifactCommit", "finalArtifactCommit", "introducingMergeCommit", "recordedTvmSourceRevision", "earlyTimePlausibleTvmPrHeadRevision", "mlcLlmSourceRevision", "tokenizersCppRevision"]) {
    if (!gitRevisionPattern.test(artifacts.wasm.lineage[field])) fail(`WASM lineage ${field} is invalid.`);
  }
  if (artifacts.wasm.lineage.initialArtifactCommit !== LATTICE_WASM_BUILD_LINEAGE.initialArtifactCommit
    || artifacts.wasm.lineage.finalArtifactCommit !== LATTICE_WASM_BUILD_LINEAGE.finalArtifactCommit
    || artifacts.wasm.lineage.introducingMergeCommit !== LATTICE_WASM_BUILD_LINEAGE.pullRequestMergeCommit
    || artifacts.wasm.lineage.recordedTvmSourceRevision !== LATTICE_WASM_BUILD_LINEAGE.tvmCommit
    || artifacts.wasm.lineage.earlyTimePlausibleTvmPrHeadRevision !== LATTICE_WASM_BUILD_LINEAGE.earlyTimePlausibleTvmPrHeadRevision
    || artifacts.wasm.lineage.mlcLlmSourceRevision !== LATTICE_WASM_BUILD_LINEAGE.mlcLlmCommit
    || artifacts.wasm.lineage.pullRequest !== LATTICE_WASM_BUILD_LINEAGE.pullRequestUrl) {
    fail("WASM source lineage drifted from the model contract.");
  }
  if (artifacts.wasm.lineage.status !== "partial-source-lineage-recorded") fail("WASM lineage must not be overstated beyond its partial recorded source claim.");
  if (artifacts.wasm.lineage.pinnedRevisionContainsBuildScript !== false) fail("the pinned binary revision must not be represented as containing the deleted build helper.");
  if (artifacts.wasm.lineage.historicalQwenPresetResolvableAtRecordedMlcRevision !== false
    || artifacts.wasm.lineage.tokenizersCppHasCargoLock !== false) {
    fail("historical WASM recipe gaps must remain explicit until separately requalified.");
  }
  if (artifacts.wasm.abiInspection.importCountPerFile !== 13 || artifacts.wasm.abiInspection.exportCountPerFile !== 93
    || artifacts.wasm.abiInspection.allocEmbeddingTensorBytes.generator !== 5242880
    || artifacts.wasm.abiInspection.allocEmbeddingTensorBytes.verifier !== 6291456
    || artifacts.wasm.abiInspection.customSections.length !== 0) fail("WASM ABI inspection record is incomplete or drifted.");
  if (!artifactQualificationStatuses.has(artifacts.wasm.reproducibility.status)) fail("WASM reproducibility has an unsupported qualification status.");
  if (!artifactQualificationStatuses.has(artifacts.models.verifier.artifactProvenanceStatus)) fail("Llama MLC artifact provenance has an unsupported qualification status.");
  if (!artifactQualificationStatuses.has(artifacts.llamaBehaviorEvaluation.exactModelExecutionStatus)) fail("Llama exact-model execution has an unsupported qualification status.");
  if (artifacts.wasm.reproducibility.established !== false) fail("WASM reproducibility must remain explicitly unestablished.");
  if (artifacts.models.verifier.artifactProvenanceEstablished !== false) fail("Llama MLC-artifact provenance must remain explicitly unestablished.");
  if (register.gates.find(({ id }) => id === "GATE-04B")?.status !== "historical-inactive"
    || register.gates.find(({ id }) => id === "GATE-04C")?.status !== "historical-inactive"
    || artifacts.llamaBehaviorEvaluation.exactModelExecutionStatus !== register.gates.find(({ id }) => id === "GATE-04A")?.status) {
    fail("active Llama behavior status and historical browser-local artifact gate classifications drifted.");
  }
  const activeLlamaTerms = artifacts.llamaTerms.active;
  if (activeLlamaTerms.version !== activeLlamaTermsProvenance.version
    || activeLlamaTerms.model !== activeLlamaTermsProvenance.model
    || activeLlamaTerms.model !== artifacts.activeCapability.provider.verifierModel
    || activeLlamaTerms.modelRepository !== activeLlamaTermsProvenance.modelRepository
    || activeLlamaTerms.modelRepositoryRevision !== activeLlamaTermsProvenance.modelRepositoryRevision
    || activeLlamaTerms.modelRepositoryRevisionUrl !== activeLlamaTermsProvenance.modelRepositoryRevisionUrl
    || activeLlamaTerms.officialSourceCommit !== activeLlamaTermsProvenance.officialSourceCommit
    || activeLlamaTerms.termsMatchStatus !== "byte-identical-to-reviewed-model-repository-files"
    || activeLlamaTerms.reviewedAt !== activeLlamaTermsProvenance.reviewedAt
    || ["license", "acceptableUsePolicy"].some((key) => Object.entries(activeLlamaTermsProvenance[key])
      .some(([field, value]) => activeLlamaTerms[key]?.[field] !== value))) {
    fail("active Llama 3.3 terms provenance drifted from the exact reviewed model repository snapshot.");
  }
  const historicalLlamaTerms = artifacts.llamaTerms.historicalBrowserLocal;
  if (historicalLlamaTerms.version !== LLAMA_3_2_TERMS_PROVENANCE.version
    || historicalLlamaTerms.officialSourceCommit !== LLAMA_3_2_TERMS_PROVENANCE.upstreamCommit
    || historicalLlamaTerms.license.sha256 !== LLAMA_3_2_TERMS_PROVENANCE.sha256.license
    || historicalLlamaTerms.acceptableUsePolicy.sha256 !== LLAMA_3_2_TERMS_PROVENANCE.sha256.acceptableUsePolicy
    || historicalLlamaTerms.license.canonicalUrl !== LLAMA_3_2_TERMS_PROVENANCE.licenseUrl
    || historicalLlamaTerms.acceptableUsePolicy.canonicalUrl !== LLAMA_3_2_TERMS_PROVENANCE.acceptableUseUrl
    || !/historical inactive Llama 3\.2 browser-local MLC artifact/iu.test(historicalLlamaTerms.claimBoundary ?? "")) {
    fail("historical browser-local Llama 3.2 terms provenance drifted from the model contract.");
  }
}

export function verifyHistoricalOvhProviderEvidence(register) {
  const prior = register.priorOVHReviewRolesBeforeDeepInfraMigration;
  if (prior?.status !== "historical-inactive"
    || digest(Buffer.from(JSON.stringify(canonicalJson(prior)))) !== "35935736665fd558ba0432e67b264ccf6632ed2dc28b243ad9e610bbab4bd812") {
    fail("historical OVH provider evidence must remain the exact pre-migration record.");
  }
}

export function verifyHistoricalDeepInfraProviderEvidence(register) {
  const prior = register.priorDeepInfraReviewRolesBeforeCoreWeaveMigration;
  if (prior?.status !== "historical-inactive"
    || digest(Buffer.from(JSON.stringify(canonicalJson(prior)))) !== "e2b8625867be4d9fea5a4a8d5800d1e71902252147c6f927b69c0c5632386809") {
    fail("historical DeepInfra provider evidence must remain the authenticated pre-CoreWeave record.");
  }
  for (const row of prior.requirements) {
    const gate = register.gates.find(({ id }) => id === row.id);
    const marker = "Previous DeepInfra requirement follows verbatim as dated history. ";
    const offset = gate?.requirement?.indexOf(marker) ?? -1;
    if (offset < 0 || digest(Buffer.from(gate.requirement.slice(offset + marker.length))) !== row.sha256) {
      fail("historical DeepInfra requirement suffix must remain verbatim.");
    }
  }
  for (const row of prior.activeGateEvidence) {
    const gate = register.gates.find(({ id }) => id === row.id);
    const marker = "Previous DeepInfra active evidence follows verbatim as dated history. ";
    const offset = gate?.activeCurrentEvidence?.indexOf(marker) ?? -1;
    if (offset < 0
      || digest(Buffer.from(gate.activeCurrentEvidence.slice(offset + marker.length))) !== row.currentSha256
      || digest(Buffer.from(JSON.stringify(canonicalJson(gate.activeEvidence.slice(0, row.entriesCount))))) !== row.entriesSha256) {
      fail("historical DeepInfra active evidence must remain verbatim.");
    }
  }
}

export function verifyHistoricalCoreWeaveEnvelopeEvidence(register) {
  const prior = register.priorCoreWeaveStrictEnvelopeBeforeRun473Correction;
  const failure = register.run473CoreWeaveStoppedReviewEnvelopeFailure;
  if (prior?.status !== "historical-inactive"
    || digest(Buffer.from(JSON.stringify(canonicalJson(prior)))) !== "9f7ead98e67d6195f1673b1abaa447fccfaf2f368a9f0f97f32b777074a48905"
    || digest(Buffer.from(JSON.stringify(canonicalJson(failure)))) !== "2a88645fa32c6b0318de54cefde572bd0c12622a1533bc08d491b76f12488a49") {
    fail("historical CoreWeave strict policy and failed original must remain authenticated.");
  }
  for (const row of prior.requirements) {
    const gate = register.gates.find(({ id }) => id === row.id);
    const marker = "Previous strict CoreWeave requirement follows verbatim as dated history. ";
    const offset = gate?.requirement?.indexOf(marker) ?? -1;
    if (offset < 0 || digest(Buffer.from(gate.requirement.slice(offset + marker.length))) !== row.sha256) {
      fail("historical CoreWeave strict requirement suffix must remain verbatim.");
    }
  }
  for (const row of prior.activeGateEvidence) {
    const gate = register.gates.find(({ id }) => id === row.id);
    const marker = "Previous strict CoreWeave active evidence follows verbatim as dated history. ";
    const offset = gate?.activeCurrentEvidence?.indexOf(marker) ?? -1;
    if (offset < 0
      || digest(Buffer.from(gate.activeCurrentEvidence.slice(offset + marker.length))) !== row.currentSha256
      || digest(Buffer.from(JSON.stringify(canonicalJson(gate.activeEvidence.slice(0, row.entriesCount))))) !== row.entriesSha256) {
      fail("historical CoreWeave active evidence must remain verbatim.");
    }
  }
}

export function verifyCoreWeaveReviewSelection(register) {
  verifyHistoricalCoreWeaveEnvelopeEvidence(register);
  const selection = register.coreWeaveReviewRoleSelection;
  const provider = register.artifactSet?.activeCapability?.provider;
  if (selection?.status !== "owner-selected-source-change"
    || selection.reviewModel !== "meta-llama/Llama-3.3-70B-Instruct:coreweave"
    || selection.generatorModel !== "Qwen/Qwen3-235B-A22B-Instruct-2507:deepinfra"
    || selection.reviewModel !== provider?.verificationRequestModel
    || selection.reviewModel !== provider?.certificationRequestModel
    || selection.advertisedReviewContextTokens !== 128_000
    || selection.advertisedReviewQuantization !== "fp16"
    || selection.datedReviewPriceUsdPerMillion?.input !== 0.71
    || selection.datedReviewPriceUsdPerMillion?.output !== 0.71
    || selection.currentReviewEnvelope !== "strict-stopped-single-assistant-string-content-with-observed-joint-null-pair"
    || selection.currentReviewAllowsAuxiliaryNullMetadata !== true
    || selection.currentReviewNullableMetadataMode !== "joint-literal-null-only"
    || JSON.stringify(selection.currentReviewNullableMetadataFields) !== '["reasoning","refusal"]'
    || selection.observedFailureRun !== 473) {
    fail("current CoreWeave review selection must retain the exact observed joint-null profile and dated catalog scope.");
  }
}

export function verifyParasailGenerationSelection(register) {
  // The recorded Parasail selection is retained as provider history.
  const selected = register.parasailGenerationBackupSelection;
  const provider = register.artifactSet?.activeCapability?.provider;
  if (selected?.status !== "owner-selected-source-change"
    || selected.standardGeneratorModel !== "Qwen/Qwen3-235B-A22B-Instruct-2507:deepinfra"
    || selected.selectedGeneratorModel !== "Qwen/Qwen3-235B-A22B-Instruct-2507:parasail"
    || selected.reviewModel !== "meta-llama/Llama-3.3-70B-Instruct:coreweave"
    || selected.reviewModel !== provider?.verificationRequestModel
    || selected.reviewModel !== provider?.certificationRequestModel
    || selected.selection !== "manual-source-selection"
    || selected.automaticRetry !== false || selected.requestLevelFallback !== false
    || selected.requestLevelSecondRoute !== false
    || selected.qualification !== "actual-G06-service-check-and-paired-native-traces-before-interactive-release"
    || selected.backendEvidenceScope !== "dated-run-501-standard-route"
    || selected.firefoxEvidenceScope !== "dated-run-479-input-behavior"
    || register.artifactSet.activeCapability.automaticRetry !== false
    || register.artifactSet.activeCapability.alternateProviderFallback !== false) {
    fail("manual Parasail backup must retain the identical Qwen model, standard DeepInfra selection, CoreWeave review, dated evidence and no request-level fallback.");
  }
  const prior = register.priorStandardGenerationBeforeParasailBackup;
  if (digest(Buffer.from(JSON.stringify(canonicalJson(prior)))) !== "ab0d9dbad0638dbb20d44e6c37c300a7bbee3f981b5deac7f84abc9a9912eff4"
    || digest(Buffer.from(JSON.stringify(canonicalJson(register.coreWeaveReviewRoleSelection)))) !== "e684ecbdc3173ef757c167f2143e6fdfdd3ca63e9637b2354a3c6203c03e3c31") {
    fail("historical standard-generation and CoreWeave selection must remain verbatim.");
  }
  for (const [rows, field, marker] of [
    [prior.requirements, "requirement", "Previous standard-generation requirement follows verbatim as dated history. "],
    [prior.activeEvidence, "activeCurrentEvidence", "Previous standard-generation evidence follows verbatim as dated history. "],
  ]) {
    for (const row of rows) {
      const text = register.gates.find(({ id }) => id === row.id)?.[field];
      const offset = text?.indexOf(marker) ?? -1;
      if (offset < 0 || digest(Buffer.from(text.slice(offset + marker.length))) !== row.sha256) {
        fail("standard-generation gate history must remain verbatim.");
      }
    }
  }
}

export function verifyVeniceGenerationSelection(register) {
  const selected = register.veniceGenerationThirdBackupSelection;
  const provider = register.artifactSet?.activeCapability?.provider;
  if (selected?.status !== "owner-selected-source-change"
    || selected.standardGeneratorModel !== "Qwen/Qwen3-235B-A22B-Instruct-2507:deepinfra"
    || selected.previousBackupGeneratorModel !== "Qwen/Qwen3-235B-A22B-Instruct-2507:parasail"
    || selected.ownerChoice?.path !== "work/proposals/nov22-g06-after640/owner-decision.json"
    || selected.ownerChoice?.bytes !== 1984
    || selected.ownerChoice?.sha256 !== "5275171ed0fecb9b88902ea6beda8c8acaa36bb2e17522f4413368f885ac4322"
    || selected.selectedGeneratorModel !== "Qwen/Qwen3-235B-A22B-Instruct-2507:venice"
    || selected.reviewModel !== "meta-llama/Llama-3.3-70B-Instruct:coreweave"
    || selected.reviewModel !== provider?.verificationRequestModel
    || selected.reviewModel !== provider?.certificationRequestModel
    || selected.ownerDesignation !== "third backup"
    || selected.selection !== "manual-source-selection"
    || selected.automaticRetry !== false || selected.requestLevelFallback !== false
    || selected.requestLevelSecondRoute !== false
    || selected.qualification !== "actual-G06-service-check-and-paired-native-traces-before-interactive-release"
    || selected.backendEvidenceScope !== "dated-run-501-standard-route"
    || selected.firefoxEvidenceScope !== "dated-run-479-input-behavior"
    || selected.privacyTier !== "unverified-for-hugging-face-route"
    || selected.computePartner !== "unverified-for-hugging-face-route"
    || selected.possibleComputePartnerRecipient !== true
    || register.artifactSet.activeCapability.automaticRetry !== false
    || register.artifactSet.activeCapability.alternateProviderFallback !== false) {
    fail("manual Venice third backup must bind the identical Qwen model, prior DeepInfra and Parasail selections, CoreWeave review, dated evidence, unverified route privacy and no request-level fallback.");
  }
  const prior = register.priorParasailGenerationBeforeVeniceBackup;
  if (digest(Buffer.from(JSON.stringify(canonicalJson(prior)))) !== "b9173dd4a2ca3e253d2d4b2c8a9c85004dfa247d7556ad617d76e5252aed36f8"
    || digest(Buffer.from(JSON.stringify(canonicalJson(register.parasailGenerationBackupSelection)))) !== "abad9a5cb3269dbbf6bab0f0e53354481aa56f4ba023010b1ec0ae96832f34cc") {
    fail("historical Parasail selection and its pre-Venice evidence must remain verbatim.");
  }
  for (const [rows, field, marker] of [
    [prior.requirements, "requirement", "Previous Parasail requirement follows verbatim as dated history. "],
    [prior.activeEvidence, "activeCurrentEvidence", "Previous Parasail evidence follows verbatim as dated history. "],
  ]) {
    for (const row of rows) {
      const text = register.gates.find(({ id }) => id === row.id)?.[field];
      const offset = text?.indexOf(marker) ?? -1;
      if (offset < 0 || digest(Buffer.from(text.slice(offset + marker.length))) !== row.sha256) {
        fail("Parasail gate history must remain verbatim.");
      }
    }
  }
}

export function verifyStandardGenerationResumption(register) {
  const selection = register.standardGenerationResumption;
  const provider = register.artifactSet?.activeCapability?.provider;
  const backup = register.veniceGenerationThirdBackupSelection;
  if (selection?.generatorModel !== "Qwen/Qwen3-235B-A22B-Instruct-2507:deepinfra"
    || selection.generatorModel !== LATTICE_REMOTE_MODELS.generator
    || register.manualGenerationReselection?.selectedGenerator !== register.parasailGenerationBackupSelection?.selectedGeneratorModel
    || register.manualGenerationReselection?.selectedGenerator !== provider?.earlierDisclosureGenerator
    || register.standardGeneratorAfterBackup?.selectedGenerator !== selection.generatorModel
    || register.standardGeneratorAfterBackup.previousGenerator !== provider.earlierDisclosureGenerator
    || provider.generatorModel !== LATTICE_REMOTE_MODELS.generator
    || register.manualGenerationReselection.standardGenerator !== selection.generatorModel
    || register.manualGenerationReselection.reviewModel !== selection.reviewModel
    || register.manualGenerationReselection.requestLevelFallback !== false
    || selection.generatorModel !== backup?.standardGeneratorModel
    || selection.previousGeneratorModel !== backup.selectedGeneratorModel
    || selection.reviewModel !== "meta-llama/Llama-3.3-70B-Instruct:coreweave"
    || selection.reviewModel !== provider.verificationRequestModel
    || selection.reviewModel !== provider.certificationRequestModel
    || selection.selection !== "manual-source-selection"
    || register.artifactSet.activeCapability.automaticRetry !== false
    || register.artifactSet.activeCapability.alternateProviderFallback !== false) {
    fail("standard DeepInfra generation must match the deployed model, the two CoreWeave review roles and the recorded manual selection.");
  }
}

async function verifySourceBoundary(register) {
  verifyStandardGenerationResumption(register);
  verifyVeniceGenerationSelection(register);
  verifyParasailGenerationSelection(register);
  verifyHistoricalOvhProviderEvidence(register);
  verifyHistoricalDeepInfraProviderEvidence(register);
  verifyCoreWeaveReviewSelection(register);
  if (register.format !== "TEXT_TO_LATTICE_RELEASE_REGISTER" || register.schemaVersion !== 1) fail("release-register format is unsupported.");
  const releaseState = verifyReleaseStatusState(register);
  const revisionDate = new Date(`${register.revision}T00:00:00Z`);
  if (!dateRevisionPattern.test(register.revision)
    || Number.isNaN(revisionDate.valueOf())
    || revisionDate.toISOString().slice(0, 10) !== register.revision) {
    fail("release-register revision must be a valid YYYY-MM-DD date.");
  }
  if (register.authority?.canonicalSource !== canonicalRegisterSource) fail("release-register canonical source declaration drifted.");
  if (register.authority?.qualificationDossier !== canonicalQualificationSource) fail("release qualification dossier declaration drifted.");
  if (!gitRevisionPattern.test(register.implementationBaselineRevision)) fail("implementationBaselineRevision must identify the reviewed baseline commit.");
  const qualificationScope = register.qualificationScope ?? "";
  if (!/last pulled hah\.dev deployment and ancestry baseline/iu.test(qualificationScope)
    || !/historical and inactive/iu.test(qualificationScope)) {
    fail("qualificationScope must retain the deployed ancestry baseline and historical-inactive boundary.");
  }
  if (releaseState.held
    && (!/held remote-capability candidate/iu.test(qualificationScope)
      || !/without claiming.*deployed or observed in production/iu.test(qualificationScope))) {
    fail("held qualificationScope must distinguish the undeployed remote candidate from the last deployed browser-local baseline.");
  }
  if (releaseState.qualificationPending
    && (!/qualification-pending/iu.test(qualificationScope)
      || !/(?:not (?:yet )?qualified|non-qualified)/iu.test(qualificationScope)
      || !/canonical-browser qualification/iu.test(qualificationScope)
      || !/(?:immediate(?:ly)?[\s\S]{0,180}(?:held|documentation-only)[\s\S]{0,100}rollback|rollback[\s\S]{0,180}immediate(?:ly)?[\s\S]{0,100}(?:held|documentation-only))/iu.test(qualificationScope))) {
    fail("qualification-pending qualificationScope must say the deployment is not qualified, bind canonical-browser qualification, and require immediate held rollback.");
  }
  if (releaseState.qualified
    && (!/qualified remote capability/iu.test(qualificationScope)
      || !/canonical-browser/iu.test(qualificationScope)
      || !/current production evidence/iu.test(qualificationScope))) {
    fail("qualified qualificationScope must bind the qualified remote capability to current canonical-browser production evidence.");
  }
  if (!Array.isArray(register.statusVocabulary) || register.statusVocabulary.length !== gateStatuses.size
    || [...gateStatuses].some((status) => !register.statusVocabulary.includes(status))) {
    fail("statusVocabulary does not match the enforced gate vocabulary.");
  }
  requireString(register.authority?.decisionRule, "release decision rule");
  requireString(register.authority?.marginalValueRule, "marginal-value rule");
  await verifyBrowserEvidenceAuthority(register, releaseState);
  const qualifiedSourceSetDigest = await verifyQualifiedSourceSet(register);
  const expectedOwnerStatus = register.overallStatus === "held" ? "hold-directed" : "release-directed";
  if (register.ownerDisposition?.status !== expectedOwnerStatus) fail("owner disposition must match the current release direction.");
  requireString(register.ownerDisposition.owner, "owner disposition owner");
  requireString(register.ownerDisposition.record, "owner disposition record");
  requireString(register.ownerDisposition.note, "owner disposition note");
  if (!dateRevisionPattern.test(register.ownerDisposition.decidedOn ?? "")) fail("owner disposition decidedOn must be a YYYY-MM-DD date.");
  if (register.ownerDisposition.qualifiedSourceSetSha256 !== qualifiedSourceSetDigest) {
    fail("owner direction must bind the qualified source-set digest.");
  }
  exactIds(register.gates, expectedGateIds, "release gates");
  for (const gate of register.gates) {
    if (!gateStatuses.has(gate.status)) fail(`${gate.id} has an unsupported status.`);
    if (gate.status === "satisfied-in-production" && !productionSatisfiedGateIds.has(gate.id)) {
      fail(`${gate.id} cannot use satisfied-in-production status.`);
    }
    if (gate.id === "GATE-02" && !["open-release-blocker", "satisfied-in-production"].includes(gate.status)) {
      fail("GATE-02 must remain an open release blocker until it is satisfied in production.");
    }
    if (gate.id === "GATE-03" && !["open-release-blocker", "satisfied-in-production"].includes(gate.status)) {
      fail("GATE-03 must remain an open release blocker until remote capacity is satisfied in production.");
    }
    if (gate.id === "GATE-06" && !["open-release-blocker", "post-deployment-verification", "satisfied-in-production"].includes(gate.status)) {
      fail("GATE-06 must remain open, enter post-deployment verification, or be satisfied by the canonical remote lifecycle.");
    }
    if (!marginalValues.has(gate.marginalValue)) fail(`${gate.id} has an unsupported marginal-value classification.`);
    for (const field of ["label", "requirement", "currentEvidence", "evidenceNeeded", "rationale", "followUp"]) {
      requireString(gate[field], `${gate.id} ${field}`);
    }
    requireStringArray(gate.evidence, `${gate.id} evidence`);
    requireStringArray(gate.safeguards, `${gate.id} safeguards`);
    if (gateRequiresRollbackCondition(gate)) requireString(gate.rollbackCondition, `${gate.id} rollbackCondition`);
    else if (gate.rollbackCondition !== null) fail(`${gate.id} rollbackCondition must be null outside rollback-bearing statuses.`);
    if (["accepted-residual-risk", "historical-inactive"].includes(gate.status)) requireString(gate.acceptanceBasis, `${gate.id} acceptanceBasis`);
    else if (gate.acceptanceBasis !== null) fail(`${gate.id} acceptanceBasis must be null outside accepted residual risk or historical evidence.`);
  }

  const productionBoundaryGate = register.gates.find(({ id }) => id === "GATE-02");
  const capacityGate = register.gates.find(({ id }) => id === "GATE-03");
  const productionLifecycleGate = register.gates.find(({ id }) => id === "GATE-06");
  verifyLifecycleGateContract(productionBoundaryGate, capacityGate, productionLifecycleGate, releaseState.releasePhase);

  if (!Array.isArray(register.marginalValueDecisions) || register.marginalValueDecisions.length === 0) {
    fail("marginal-value decisions must be a nonempty array.");
  }
  const findingNames = register.marginalValueDecisions.map(({ finding }) => finding);
  if (new Set(findingNames).size !== findingNames.length) fail("marginal-value decisions must name each finding once.");
  for (const [index, decision] of register.marginalValueDecisions.entries()) {
    for (const field of ["finding", "disposition", "rationale"]) {
      requireString(decision[field], `marginal-value decision ${index} ${field}`);
    }
    if (!marginalDecisionValues.has(decision.classification)) {
      fail(`marginal-value decision ${index} has an unsupported classification.`);
    }
  }
  const decisionScopes = register.marginalValueDecisionScopes;
  requireStringArray(decisionScopes?.active, "active marginal-value decision scope");
  requireStringArray(decisionScopes?.historicalInactive, "historical marginal-value decision scope");
  requireString(decisionScopes?.claimBoundary, "marginal-value decision claim boundary");
  const scopedFindings = [...decisionScopes.active, ...decisionScopes.historicalInactive];
  if (new Set(scopedFindings).size !== findingNames.length
    || scopedFindings.length !== findingNames.length
    || findingNames.some((finding) => !scopedFindings.includes(finding))) {
    fail("active and historical-inactive marginal-value scopes must partition every decision exactly once.");
  }
  const requireDecision = (finding, classification, disposition, requiredRationale) => {
    const decision = register.marginalValueDecisions.find((item) => item.finding === finding);
    if (!decisionScopes.active.includes(finding)
      || decision?.classification !== classification
      || decision?.disposition !== disposition
      || requiredRationale.some((pattern) => !pattern.test(decision.rationale))) {
      fail(`${finding} does not preserve the active remote release disposition.`);
    }
  };
  requireDecision(
    "Remote privacy boundary before activation",
    "high",
    "hold-until-production-evidence",
    [/new same-origin API/iu, /external provider/iu, /GATE-02, GATE-03, and GATE-06/iu, /false privacy qualification/iu],
  );
  requireDecision(
    "Provider-managed revision and historical byte equivalence",
    "moderate",
    "accepted-explicit-boundary",
    [/provider-managed runtime is not byte-pinned/iu, /not established as equivalent to historical MLC artifacts/iu],
  );
  requireDecision(
    "Automatic retry or alternate provider or model fallback",
    "negative",
    "do-not-implement",
    [/retransmit visitor text/iu, /silently expand recipients and model behavior/iu],
  );
  const timedRenewalDecision = register.marginalValueDecisions.find(({ finding }) => finding === "Deliberately timed real-browser renewal trace");
  if (timedRenewalDecision?.classification !== "moderate"
    || timedRenewalDecision?.disposition !== "observe-naturally-and-defer-as-release-gate"
    || !/source and adversarial tests/iu.test(timedRenewalDecision.rationale)
    || !/bodyless PATCH/iu.test(timedRenewalDecision.rationale)
    || !/bounded lease expiry/iu.test(timedRenewalDecision.rationale)
    || !/eventual cleanup/iu.test(timedRenewalDecision.rationale)
    || !/roll back on an observed defect/iu.test(timedRenewalDecision.rationale)
    || !/must not hold operational completion/iu.test(timedRenewalDecision.rationale)) {
    fail("the deliberately timed real-browser renewal trace must remain a moderate, naturally observed follow-up rather than a release gate, with bounded controls and rollback on an observed defect.");
  }
  const demonstrationProfileDecision = register.marginalValueDecisions.find(({ finding }) => finding === "Cloudflare official testing credentials for the demonstrable release");
  if (demonstrationProfileDecision?.classification !== "moderate"
    || demonstrationProfileDecision?.disposition !== "bounded-demonstration-only"
    || !/documented testing pair/iu.test(demonstrationProfileDecision.rationale)
    || !/explicit disclosure/iu.test(demonstrationProfileDecision.rationale)
    || !/exact-origin and bodyless boundaries/iu.test(demonstrationProfileDecision.rationale)
    || !/independent signing domains/iu.test(demonstrationProfileDecision.rationale)
    || !/global daily admission/iu.test(demonstrationProfileDecision.rationale)
    || !/bounded expiry/iu.test(demonstrationProfileDecision.rationale)
    || !/must not be represented as production anti-bot assurance/iu.test(demonstrationProfileDecision.rationale)) {
    fail("the Cloudflare official-testing profile must remain a moderate, explicitly disclosed demonstration-only disposition without an anti-bot assurance claim.");
  }
  const bypassDecision = register.marginalValueDecisions.find(({ finding }) => finding === "Bespoke attestation bypass route or unsigned token mode");
  if (bypassDecision?.classification !== "negative"
    || bypassDecision?.disposition !== "do-not-implement"
    || !/undocumented public protocol/iu.test(bypassDecision.rationale)
    || !/attack surface/iu.test(bypassDecision.rationale)
    || !/exact published test profile/iu.test(bypassDecision.rationale)
    || !/existing Siteverify and signed-lease contract/iu.test(bypassDecision.rationale)
    || !/without proving widget participation/iu.test(bypassDecision.rationale)) {
    fail("a bespoke attestation bypass route or unsigned token mode must remain a negative-marginal-value, do-not-implement alternative to the provider testing profile.");
  }
  const broadResponsePolicyDecision = register.marginalValueDecisions.find(({ finding }) => finding === "Portfolio-wide response-policy Worker route");
  if (broadResponsePolicyDecision?.classification !== "negative"
    || broadResponsePolicyDecision?.disposition !== "do-not-implement"
    || !/unrelated portfolio (?:pages|traffic)/iu.test(broadResponsePolicyDecision.rationale)
    || !/(?:allowance|quota)/iu.test(broadResponsePolicyDecision.rationale)
    || !/(?:failure blast radius|failure surface)/iu.test(broadResponsePolicyDecision.rationale)
    || !/four exact document routes/iu.test(broadResponsePolicyDecision.rationale)) {
    fail("a portfolio-wide response-policy Worker route must remain a negative-marginal-value non-solution; four exact document routes preserve the required boundary without the broader allowance and failure surface.");
  }
  const publicTokenStarvationDecision = register.marginalValueDecisions.find(({ finding }) => finding === "Public testing-token slot starvation and the 48-per-10-second edge rule");
  if (publicTokenStarvationDecision?.classification !== "moderate"
    || publicTokenStarvationDecision?.disposition !== "accepted-residual-with-operational-hardening"
    || !/16-request acquisition sequence/iu.test(publicTokenStarvationDecision.rationale)
    || !/all eight slots/iu.test(publicTokenStarvationDecision.rationale)
    || !/48-per-10-second per-IP rule does not prevent/iu.test(publicTokenStarvationDecision.rationale)
    || !/limit consequence to demonstrator availability/iu.test(publicTokenStarvationDecision.rationale)
    || !/observed abuse triggers requalification/iu.test(publicTokenStarvationDecision.rationale)) {
    fail("public testing-token slot starvation must remain a moderate accepted availability residual; the 48-per-10-second edge rule is operational hardening, not a release prerequisite or prevention claim.");
  }

  const atlas = await readJson(atlasPath, "documentation atlas");
  if (atlas.revision !== register.revision) fail("release register and documentation atlas revisions diverge.");
  exactIds(atlas.securityModel?.prePublicationGates, expectedGateIds, "documentation-atlas gates");
  for (const gate of register.gates) {
    const atlasGate = atlas.securityModel.prePublicationGates.find(({ id }) => id === gate.id);
    for (const field of gateProjectionFields) {
      if (JSON.stringify(atlasGate[field]) !== JSON.stringify(gate[field])) {
        fail(`${gate.id} ${field} diverges between release register and documentation atlas.`);
      }
    }
  }

  verifyArtifactSet(register);
  await verifyTerms(register);
  await verifyLlamaUseEvaluation(register);
  await verifyQualificationDossier(register);

  const [viewSource, heldSource, interactiveSource, searchSource, projectsSource, routesSource, projectPageSource, noticesSource, portfolioSource] = await Promise.all([
    readFile(join(root, "app/resume/ResumeView.tsx"), "utf8"),
    readFile(join(root, "app/resume/ResumeProjectsHeld.tsx"), "utf8"),
    readFile(join(root, "app/resume/ResumeProjects.tsx"), "utf8"),
    readFile(join(root, "app/resume/ResumeSearch.tsx"), "utf8"),
    readFile(join(root, "app/resume/projects.js"), "utf8"),
    readFile(join(root, "app/semantic/routes.js"), "utf8"),
    readFile(join(root, "app/projects/lattice/text-to-lattice/page.tsx"), "utf8"),
    readFile(join(root, "app/third-party-notices/page.tsx"), "utf8"),
    readFile(join(root, "app/semantic/portfolio.js"), "utf8"),
  ]);
  const lattice = projectBySlug("lattice");
  if (!lattice) fail("Lattice project record is absent.");

  const { enabled } = releaseState;
  if (enabled) {
    if (register.publicClient.publicationMode !== "interactive-client") fail("enabled publication must declare interactive-client mode.");
    if (register.publicClient.heldBoundary != null) fail("enabled publication must remove its held-only allow and deny boundary.");
    for (const [label, source] of [
      ["canonical project page", projectPageSource],
      ["held résumé projection", heldSource],
      ["project registry", projectsSource],
      ["third-party notices", noticesSource],
      ["semantic portfolio", portfolioSource],
      ["documentation atlas", JSON.stringify(atlas)],
    ]) {
      if (/release gates remain open|must agree before the converter can open|model-use controls[\s\S]{0,120}WebAssembly provenance are qualified|dormant (?:interface|dialog)/iu.test(source)) {
        fail(`enabled publication contains stale held-gate copy in ${label}.`);
      }
    }
    if (!viewSource.includes('from "./ResumeProjects"') || viewSource.includes('from "./ResumeProjectsHeld"')) fail("eligible mode must deliberately import the interactive project surface.");
    if (lattice.interactiveRelease !== "enabled") fail("eligible mode requires the Lattice project record to say enabled.");
    if (lattice.interaction !== "lattice-demo") fail("eligible mode requires the explicit Lattice interaction activation marker.");
    for (const pattern of [
      /className="tool-icon project-modal-trigger signal-fuzz"/u,
      /data-lattice-launch="text-to-lattice"/u,
      /aria-label="Use Text to Lattice"/u,
      /href="\/projects\/lattice\/text-to-lattice\/"/u,
      /aria-haspopup="dialog"/u,
      /id="lattice-demo-dialog"/u,
      /id="lattice-demo-input"/u,
      /id="lattice-use-confirmation"/u,
    ]) {
      if (!pattern.test(interactiveSource)) fail(`enabled project surface omits its required interaction contract: ${pattern}.`);
    }
    if ((interactiveSource.match(/data-lattice-launch="text-to-lattice"/gu) ?? []).length !== 1) {
      fail("enabled project surface must expose exactly one Text to Lattice modal launcher.");
    }
  } else {
    if (register.overallStatus !== "held" || register.publicClient?.status !== "held") fail("any noneligible state must be held consistently.");
    if (register.publicClient.publicationMode !== "documentation-only") fail("held publication must be documentation-only.");
    requireStringArray(register.publicClient.heldBoundary?.allow, "held publication allow boundary");
    requireStringArray(register.publicClient.heldBoundary?.deny, "held publication deny boundary");
    if (!viewSource.includes('from "./ResumeProjectsHeld"') || viewSource.includes('from "./ResumeProjects"')) fail("held mode must import only the held project surface.");
    if (!viewSource.includes('from "./ResumeSearch"')) fail("held mode must preserve the résumé search wrapper.");
    if (/from\s+["']\.\/ResumeProjects["']/u.test(searchSource)
      || /onLatticeLaunch|followLatticeResult|requestRemoteLattice|\.\/lattice\//u.test(searchSource)) {
      fail("held résumé search must not import or replay the interactive Text to Lattice path.");
    }
    if (lattice.interactiveRelease !== "held") fail("held mode requires the Lattice project record to say held.");
    if (lattice.interaction !== null) fail("held mode must remove the public interaction activation marker.");
    const heldImports = [...projectsSource.matchAll(/^import\s+.+?from\s+["']([^"']+)["'];?$/gmu)].map((match) => match[1]);
    if (heldImports.some((specifier) => specifier.includes("siteContent") || /(?:^|\/)lattice(?:\/|$)/u.test(specifier))) {
      fail("held project metadata must not import the model, usage policy, or monolithic site-content graph.");
    }
    for (const pattern of [/<form\b/iu, /<textarea\b/iu, /role="dialog"/u, /aria-haspopup=/u, /from\s+["'].+\/(?:lattice|latticeDemo)/u]) {
      if (pattern.test(heldSource)) fail(`held project surface contains prohibited interactive code: ${pattern}.`);
    }
  }

  for (const filename of ["LLAMA-USE-EVALUATION-CASES.json", "TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md", "TEXT-TO-LATTICE-RELEASE-REGISTER.json"]) {
    if (!routesSource.includes(filename)) fail(`${filename} is not exported with the static documentation.`);
  }
  for (const label of [
    "Lattice Concept and Ecosystem Map",
    "Lattice System Skill Map",
    "Text to Lattice Service Blueprint",
    "Text to Lattice Security Model",
    "Text to Lattice Release Qualification",
  ]) {
    if (!lattice.resources.some((resource) => resource.label === label && resource.icon === "backpack4")) fail(`Lattice resource ${label} is missing its documentation icon.`);
  }

  return { register, enabled };
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) fail(`release site contains a symbolic link: ${relative(root, path).split("\\").join("/")}.`);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }))).flat();
}

function htmlTagEnd(source, start) {
  let quote = null;
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (quote) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === ">") {
      return cursor;
    }
  }
  return -1;
}

function scanHtmlStartTags(source) {
  const tags = [];
  const rawTextElements = new Set(["script", "style", "textarea", "title"]);
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf("<", cursor);
    if (start < 0) break;
    if (source.startsWith("<!--", start)) {
      const commentEnd = source.indexOf("-->", start + 4);
      cursor = commentEnd < 0 ? source.length : commentEnd + 3;
      continue;
    }
    if (["!", "?", "/"].includes(source[start + 1])) {
      const end = htmlTagEnd(source, start + 2);
      cursor = end < 0 ? source.length : end + 1;
      continue;
    }
    if (!/[a-z]/iu.test(source[start + 1] ?? "")) {
      cursor = start + 1;
      continue;
    }

    let nameEnd = start + 2;
    while (/[\w:-]/u.test(source[nameEnd] ?? "")) nameEnd += 1;
    const name = source.slice(start + 1, nameEnd).toLowerCase();
    const end = htmlTagEnd(source, nameEnd);
    if (end < 0) {
      tags.push({ name, attributes: source.slice(nameEnd), content: "", closed: false });
      break;
    }
    const tag = { name, attributes: source.slice(nameEnd, end), content: null, closed: true };
    tags.push(tag);
    cursor = end + 1;

    if (rawTextElements.has(name)) {
      const closing = new RegExp(`</${name}\\s*>`, "giu");
      closing.lastIndex = cursor;
      const match = closing.exec(source);
      tag.content = match ? source.slice(cursor, match.index) : source.slice(cursor);
      tag.closed = Boolean(match);
      cursor = match ? closing.lastIndex : source.length;
    }
  }
  return tags;
}

function tokenizeHtmlAttributes(source) {
  const attributes = new Map();
  const isSpace = (character) => character !== undefined && " \t\n\f\r".includes(character);
  let cursor = 0;
  while (cursor < source.length) {
    while (isSpace(source[cursor]) || source[cursor] === "/") cursor += 1;
    if (cursor >= source.length || source[cursor] === ">") break;

    const nameStart = cursor;
    while (cursor < source.length
      && !isSpace(source[cursor])
      && !["/", "=", ">"].includes(source[cursor])) cursor += 1;
    const name = source.slice(nameStart, cursor).toLowerCase();
    if (!name) {
      cursor += 1;
      continue;
    }

    while (isSpace(source[cursor])) cursor += 1;
    let value = "";
    if (source[cursor] === "=") {
      cursor += 1;
      while (isSpace(source[cursor])) cursor += 1;
      const quote = source[cursor] === '"' || source[cursor] === "'" ? source[cursor] : null;
      if (quote) {
        cursor += 1;
        const valueStart = cursor;
        while (cursor < source.length && source[cursor] !== quote) cursor += 1;
        value = source.slice(valueStart, cursor);
        if (source[cursor] === quote) cursor += 1;
      } else {
        const valueStart = cursor;
        while (cursor < source.length && !isSpace(source[cursor]) && source[cursor] !== ">") cursor += 1;
        value = source.slice(valueStart, cursor);
      }
    }
    if (!attributes.has(name)) attributes.set(name, value);
  }
  return attributes;
}

function htmlAttribute(attributes, name) {
  const parsed = tokenizeHtmlAttributes(attributes);
  return parsed.has(name.toLowerCase()) ? parsed.get(name.toLowerCase()) : null;
}

function decodeHtmlAttribute(value) {
  const decoded = value.replace(/&(?:#(\d+);?|#x([a-f\d]+);?|(amp|apos|gt|lt|quot);)/giu, (entity, decimal, hexadecimal, named) => {
    if (decimal || hexadecimal) {
      const codePoint = Number.parseInt(decimal ?? hexadecimal, hexadecimal ? 16 : 10);
      return Number.isSafeInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    return { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' }[named.toLowerCase()];
  });
  if (/&(?:#(?:\d+|x[a-f\d]+);?|[a-z][a-z\d]+;)/iu.test(decoded)) {
    fail(`HTML attribute contains an unsupported character reference: ${value}.`);
  }
  return decoded;
}

function executableInlineSource(source) {
  const serializedPayload = serializedVinextRscScript.exec(source);
  // Vinext's exact, closed wrapper executes only a push of serialized RSC data.
  // Remove that inert payload so visible documentation is not mistaken for code.
  return serializedPayload ? source.replace(serializedPayload[1], '""') : source;
}

function verifyForbiddenStrings(source, label, forbiddenStrings) {
  const decodedSource = source.replace(/(?:%[a-f\d]{2})+/giu, (sequence) => {
    try {
      return decodeURIComponent(sequence);
    } catch {
      return sequence;
    }
  });
  for (const forbidden of forbiddenStrings) {
    const urlLike = /^(?:https?:\/\/|huggingface\.co\/|raw\.githubusercontent\.com\/)/u.test(forbidden);
    if (source.includes(forbidden)
      || decodedSource.includes(forbidden)
      || (urlLike && (source.toLowerCase().includes(forbidden.toLowerCase())
        || decodedSource.toLowerCase().includes(forbidden.toLowerCase())))) {
      fail(`${label} contains ${forbidden}.`);
    }
  }
}

function verifyExecutableSource(source, label) {
  if (/\b(?:fetch|sendBeacon)\s*\(\s*["'`]\/api\/lattice(?:[?#"'`])/iu.test(source)
    || /\.open\s*\(\s*["'`]POST["'`]\s*,\s*["'`]\/api\/lattice(?:[?#"'`])/iu.test(source)) {
    fail(`${label} contains an executable /api/lattice request path.`);
  }
  verifyForbiddenStrings(source, label, heldForbiddenExecutableStrings);
}

function verifyNetworkReference(source, label) {
  verifyForbiddenStrings(source, label, heldForbiddenNetworkStrings);
}

function htmlRouteUrl(site, htmlPath) {
  return `https://hah.dev/${relative(site, htmlPath).split("\\").join("/")}`;
}

function localScriptTarget(site, htmlPath, rawSource) {
  const source = decodeHtmlAttribute(rawSource.trim());
  if (!source) fail(`held HTML route ${relative(site, htmlPath)} contains an empty script source.`);
  let url;
  try {
    url = new URL(source, htmlRouteUrl(site, htmlPath));
  } catch (error) {
    fail(`held HTML route ${relative(site, htmlPath)} contains an invalid script source ${rawSource}: ${error.message}`);
  }
  if (url.origin !== "https://hah.dev") {
    fail(`held HTML route ${relative(site, htmlPath)} references a cross-origin executable script: ${rawSource}.`);
  }
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch (error) {
    fail(`local script source has invalid percent encoding ${rawSource}: ${error.message}`);
  }
  const target = resolve(site, `.${pathname}`);
  const targetRelative = relative(site, target);
  if (targetRelative === ".." || targetRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) || isAbsolute(targetRelative)) {
    fail(`local script source escapes the held site root: ${rawSource}.`);
  }
  return target;
}

async function verifyReferencedScript(site, htmlPath, rawSource, inspectedScripts) {
  const target = localScriptTarget(site, htmlPath, rawSource);
  if (!target || inspectedScripts.has(target)) return;
  inspectedScripts.add(target);
  let bytes;
  try {
    bytes = await readFile(target);
  } catch (error) {
    fail(`local script source ${rawSource} from ${relative(site, htmlPath)} is unreadable: ${error.message}`);
  }
  const rel = relative(site, target).split("\\").join("/");
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) {
    fail(`held referenced script asset ${rel} is WebAssembly.`);
  }
  verifyExecutableSource(bytes.toString("utf8"), `held referenced script asset ${rel}`);
}

function verifyHeldNavigationBoundary(site, htmlPath, tags) {
  const rel = relative(site, htmlPath).split("\\").join("/");
  for (const [element, attribute] of [["iframe", "src"], ["form", "action"], ["button", "formaction"], ["input", "formaction"]]) {
    for (const tag of tags.filter(({ name }) => name === element)) {
      const rawTarget = htmlAttribute(tag.attributes, attribute);
      if (rawTarget === null || rawTarget.trim() === "") continue;
      const target = decodeHtmlAttribute(rawTarget.trim());
      let url;
      try {
        url = new URL(target, htmlRouteUrl(site, htmlPath));
      } catch (error) {
        fail(`held HTML route ${rel} contains an invalid ${element} ${attribute}: ${error.message}`);
      }
      if (url.hostname === "verify.hah.dev" || (url.origin === "https://hah.dev" && url.pathname.startsWith("/api/text-to-lattice/lease"))) {
        fail(`held HTML route ${rel} exposes the verification or lease boundary through ${element} ${attribute}.`);
      }
      if (url.origin === "https://hah.dev" && url.pathname.startsWith("/api/lattice")) {
        fail(`held HTML route ${rel} exposes the remote API boundary through ${element} ${attribute}.`);
      }
    }
  }
}

function verifyAutomaticFetchContexts(site, htmlPath, tags) {
  const rel = relative(site, htmlPath).split("\\").join("/");
  const verifyAttribute = (element, attributes, attribute) => {
    const rawValue = htmlAttribute(attributes, attribute);
    if (rawValue === null || rawValue.trim() === "") return;
    verifyNetworkReference(
      decodeHtmlAttribute(rawValue),
      `held network-active ${element} ${attribute} in ${rel}`,
    );
  };

  for (const tag of tags.filter(({ name }) => name === "link")) {
    const rawRel = htmlAttribute(tag.attributes, "rel");
    const relationships = new Set((rawRel === null ? "" : decodeHtmlAttribute(rawRel).toLowerCase()).split(/\s+/u));
    if (["icon", "modulepreload", "prefetch", "preload", "stylesheet"].some((value) => relationships.has(value))) {
      verifyAttribute("link", tag.attributes, "href");
    }
  }

  for (const [element, attributes] of [
    ["audio", ["src"]],
    ["embed", ["src"]],
    ["iframe", ["src"]],
    ["image", ["href", "xlink:href"]],
    ["img", ["src", "srcset"]],
    ["input", ["src"]],
    ["object", ["data"]],
    ["source", ["src", "srcset"]],
    ["track", ["src"]],
    ["video", ["poster", "src"]],
  ]) {
    for (const tag of tags.filter(({ name }) => name === element)) {
      for (const attribute of attributes) verifyAttribute(element, tag.attributes, attribute);
    }
  }

  for (const tag of tags) {
    verifyAttribute("element", tag.attributes, "style");
  }
  for (const tag of tags.filter(({ name }) => name === "style")) {
    verifyNetworkReference(tag.content ?? "", `held inline style block in ${rel}`);
  }
}

async function verifyHtmlRoute(site, htmlPath, inspectedScripts) {
  const source = await readFile(htmlPath, "utf8");
  const rel = relative(site, htmlPath).split("\\").join("/");
  const tags = scanHtmlStartTags(source);
  const interactiveIds = new Set(["lattice-demo-dialog", "lattice-demo-input", "lattice-use-confirmation"]);
  for (const tag of tags) {
    const attributes = tokenizeHtmlAttributes(tag.attributes);
    if (tag.name === "base") fail(`held HTML route ${rel} contains a base element.`);
    if (tag.name === "iframe" && attributes.has("srcdoc")) {
      fail(`held HTML route ${rel} contains an executable iframe srcdoc.`);
    }
    const id = attributes.has("id") ? decodeHtmlAttribute(attributes.get("id")) : "";
    const controls = attributes.has("aria-controls")
      ? decodeHtmlAttribute(attributes.get("aria-controls")).split(/\s+/u)
      : [];
    const classes = attributes.has("class")
      ? decodeHtmlAttribute(attributes.get("class")).split(/\s+/u)
      : [];
    if (interactiveIds.has(id) || controls.some((value) => interactiveIds.has(value)) || classes.includes("lattice-modal")) {
      fail(`held HTML route ${rel} contains a Lattice interactive marker.`);
    }
    if ([...attributes.keys()].some((name) => /^on[a-z]/u.test(name))) {
      fail(`held HTML route ${rel} contains an inline event handler.`);
    }
    for (const name of ["href", "src", "action", "formaction"]) {
      if (!attributes.has(name)) continue;
      const value = decodeHtmlAttribute(attributes.get(name)).trim();
      let protocol = null;
      try {
        protocol = new URL(value, htmlRouteUrl(site, htmlPath)).protocol;
      } catch {
        // Other malformed navigation values are inert for this held-boundary check.
      }
      if (protocol === "javascript:") fail(`held HTML route ${rel} contains a javascript: URL.`);
    }
  }
  verifyHeldNavigationBoundary(site, htmlPath, tags);
  verifyAutomaticFetchContexts(site, htmlPath, tags);

  for (const tag of tags.filter(({ name }) => name === "script")) {
    if (!tag.closed) fail(`held HTML route ${rel} contains an unmatched script element.`);
    const scriptSource = htmlAttribute(tag.attributes, "src");
    if (scriptSource !== null) {
      await verifyReferencedScript(site, htmlPath, scriptSource, inspectedScripts);
      continue;
    }
    const rawType = htmlAttribute(tag.attributes, "type");
    const type = rawType === null ? "" : decodeHtmlAttribute(rawType).trim().toLowerCase().split(";", 1)[0];
    if (type === "application/ld+json") continue;
    if (type === "application/json") {
      verifyNetworkReference(tag.content ?? "", `held inline JSON data in ${rel}`);
      continue;
    }
    verifyExecutableSource(executableInlineSource(tag.content ?? ""), `held inline executable script in ${rel}`);
  }
}

export async function verifyHeldBuiltBoundary(site, files) {
  files ??= await filesBelow(site);
  const resume = await readFile(join(site, "resume/index.html"), "utf8");
  if (!/href="\/projects\/lattice\/"[^>]*>Lattice<\/a>/u.test(resume)) {
    fail("held résumé lacks the canonical Lattice title link.");
  }
  if (!/<a(?=[^>]*class="tool-icon project-modal-trigger signal-fuzz")(?=[^>]*href="\/projects\/lattice\/text-to-lattice\/")(?=[^>]*aria-label="Read Text to Lattice release status")[^>]*>\s*<svg\b[\s\S]*?<\/svg>\s*<\/a>/u.test(resume)) {
    fail("held résumé lacks the SVG-only Text to Lattice contract link.");
  }

  const inspectedScripts = new Set();
  for (const path of files.filter((candidate) => extname(candidate).toLowerCase() === ".html")) {
    await verifyHtmlRoute(site, path, inspectedScripts);
  }

  for (const path of files) {
    const rel = relative(site, path).split("\\").join("/");
    if (/latticeWebllm|text-to-lattice[^/]*worker/iu.test(rel)) fail(`held site contains a Lattice model worker: ${rel}.`);
    if (heldRuntimeAssetPatterns.some((pattern) => pattern.test(rel))) {
      fail(`held site contains a model or inference-runtime asset: ${rel}.`);
    }
    const bytes = await readFile(path);
    if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x61 && bytes[2] === 0x73 && bytes[3] === 0x6d) {
      fail(`held site contains WebAssembly bytes regardless of filename: ${rel}.`);
    }
    if (heldArtifactDigests.has(digest(bytes))) {
      fail(`held site contains a registered WASM or tokenizer artifact regardless of filename: ${rel}.`);
    }
    const extension = extname(path).toLowerCase();
    if (extension === ".css") {
      verifyNetworkReference(bytes.toString("utf8"), `held stylesheet ${rel}`);
      continue;
    }
    if (!heldExecutableExtensions.has(extension)) continue;
    verifyExecutableSource(bytes.toString("utf8"), `held executable asset ${rel}`);
  }

}

export async function verifyHistoricalBrowserLocalEnabledBuiltBoundary(site, files) {
  const [resume, project] = await Promise.all([
    readFile(join(site, "resume/index.html"), "utf8"),
    readFile(join(site, "projects/lattice/text-to-lattice/index.html"), "utf8"),
  ]);
  for (const pattern of [
    /class="tool-icon project-modal-trigger signal-fuzz"/u,
    /data-lattice-launch="text-to-lattice"/u,
    /aria-label="Use Text to Lattice"/u,
    /href="\/projects\/lattice\/text-to-lattice\/"/u,
    /aria-haspopup="dialog"/u,
    /id="lattice-demo-dialog"/u,
    /id="lattice-demo-input"/u,
    /id="lattice-use-confirmation"/u,
  ]) {
    if (!pattern.test(resume)) fail(`enabled résumé artifact omits its required interaction contract: ${pattern}.`);
  }
  if ((resume.match(/data-lattice-launch="text-to-lattice"/gu) ?? []).length !== 1) {
    fail("enabled résumé artifact must expose exactly one Text to Lattice modal launcher.");
  }
  if (!/href="\/resume\/#text-to-lattice"[^>]*>Use Text to Lattice<\/a>/u.test(project)) {
    fail("enabled canonical project page lacks its direct Text to Lattice launch path.");
  }

  const renderedEvidence = await Promise.all(files
    .filter((path) => [".html", ".json", ".jsonld", ".md", ".txt"].includes(extname(path).toLowerCase()))
    .map(async (path) => [relative(site, path).split("\\").join("/"), await readFile(path, "utf8")]));
  const staleEvidence = renderedEvidence.find(([, source]) => staleEnabledPublicationPattern.test(source));
  if (staleEvidence) {
    fail(`enabled release artifact contains stale held-gate copy in ${staleEvidence[0]}.`);
  }

  const executable = (await Promise.all(files
    .filter((path) => heldExecutableExtensions.has(extname(path).toLowerCase()))
    .map((path) => readFile(path, "utf8"))))
    .join("\n");
  for (const required of ["/api/text-to-lattice/lease", "https://verify.hah.dev"]) {
    if (!executable.includes(required)) fail(`enabled release artifact omits the pinned runtime binding ${required}.`);
  }

  const modelWorkerPaths = files.filter((path) => (
    /^_next\/static\/workers\/latticeWebllm\.worker-[a-zA-Z0-9_-]+\.js$/u
      .test(relative(site, path).split("\\").join("/"))
  ));
  if (modelWorkerPaths.length !== 1) {
    fail("enabled release artifact must contain exactly one dedicated Text to Lattice model Worker.");
  }
  const modelWorker = await readFile(modelWorkerPaths[0], "utf8");
  const firstModelLibrary = new URL(LATTICE_MODEL_ROLES.generator.modelLib);
  const factoredModelLibraryBindings = [
    `${firstModelLibrary.origin}/mlc-ai/binary-mlc-llm-libs/`,
    LATTICE_WASM_REVISION,
    LATTICE_WASM_BUILD_LINEAGE.releaseDirectory,
    ...Object.values(LATTICE_MODEL_ROLES).flatMap((role) => [
      role.id,
      role.model,
      new URL(role.modelLib).pathname.split("/").at(-1),
    ]),
    ...Object.values(LATTICE_COMPATIBILITY_WASM).map(({ name }) => name),
  ];
  for (const required of factoredModelLibraryBindings) {
    if (!required || !modelWorker.includes(required)) {
      fail(`enabled model Worker omits the pinned runtime binding ${required}.`);
    }
  }
}

function currentRegisterCopy(publishedBytes, canonicalRegisterBytes) {
  if (!Buffer.isBuffer(canonicalRegisterBytes) || !publishedBytes.equals(canonicalRegisterBytes)) {
    fail("enabled release register is not byte-identical to its canonical source.");
  }
  const register = JSON.parse(publishedBytes);
  const history = register.priorCoreWeaveObservedEnvelopeHeldValuesBeforeCombinedQualificationPhase;
  const previous = history?.values?.ownerDisposition?.record;
  if (history?.heldMain !== "44a3effca8e7fb0f670024889cbbe3d987c1352b"
    || typeof previous !== "string" || digest(previous) !== previousOwnerDecisionSha256) {
    fail("enabled release register differs from its pinned prior owner decision.");
  }
  // The canonical register encodes non-ASCII UTF-16 units with JSON escapes.
  const literal = Buffer.from(JSON.stringify(previous).replace(/[\u007f-\uffff]/g,
    (unit) => "\\u" + unit.charCodeAt(0).toString(16).padStart(4, "0")));
  const at = publishedBytes.indexOf(literal);
  if (at < 0 || publishedBytes.indexOf(literal, at + literal.length) !== -1) {
    fail("enabled release register must carry one exact archived owner decision.");
  }
  history.values.ownerDisposition.record = "";
  if (staleEnabledPublicationPattern.test(JSON.stringify(register))) {
    fail("enabled release register contains stale held-gate copy outside the archived owner decision.");
  }
  return Buffer.concat([publishedBytes.subarray(0, at), publishedBytes.subarray(at + literal.length)]);
}

function datedDossierCurrentBytes(publishedBytes) {
  const boundary = publishedBytes.indexOf(datedHeldDossierBoundary);
  if (boundary < 0
    || publishedBytes.indexOf(datedHeldDossierBoundary, boundary + datedHeldDossierBoundary.length) !== -1
    || (boundary > 0 && publishedBytes[boundary - 1] !== 10)
    || !publishedBytes.subarray(boundary, boundary + datedHeldDossierSeparator.length).equals(datedHeldDossierSeparator)) {
    fail("enabled release dossier must retain its unique exact dated-history boundary.");
  }
  const historyBytes = publishedBytes.subarray(boundary + datedHeldDossierSeparator.length);
  if (historyBytes.length !== datedHeldDossierBytes || digest(historyBytes) !== datedHeldDossierSha256) {
    fail("enabled release dossier dated history differs from the independently pinned held dossier.");
  }
  return publishedBytes.subarray(0, boundary);
}

export function verifyEnabledPublicationCopy(relativePath, publishedBytes, canonicalDossierBytes, canonicalRegisterBytes, qualificationHistoryBytes) {
  if (!Buffer.isBuffer(publishedBytes)) fail("enabled publication copy must be verified as raw bytes.");
  let currentBytes = publishedBytes;
  if (relativePath === publishedReleaseRegister) {
    currentBytes = currentRegisterCopy(publishedBytes, canonicalRegisterBytes);
  } else if (relativePath === datedHeldDossierPublicationPath) {
    if (!Buffer.isBuffer(canonicalDossierBytes) || !publishedBytes.equals(canonicalDossierBytes)) {
      fail("enabled release dossier is not byte-identical to its canonical source.");
    }
    const register = Buffer.isBuffer(canonicalRegisterBytes) ? JSON.parse(canonicalRegisterBytes) : null;
    if (approvedSourceCarry(register)) {
      verifyQualificationHistory(register, publishedBytes, qualificationHistoryBytes);
    } else {
      currentBytes = datedDossierCurrentBytes(publishedBytes);
    }
  } else if (relativePath === "documentation/release-evidence/text-to-lattice/qualification-history-2026-11-23.md"
    && Buffer.isBuffer(canonicalRegisterBytes) && approvedSourceCarry(JSON.parse(canonicalRegisterBytes))) {
    verifyQualificationHistory(JSON.parse(canonicalRegisterBytes), canonicalDossierBytes, publishedBytes);
    currentBytes = datedDossierCurrentBytes(publishedBytes);
  }
  if (staleEnabledPublicationPattern.test(currentBytes.toString("utf8"))) {
    fail(`enabled release artifact contains stale held-gate copy in ${relativePath}.`);
  }
}

async function verifyEnabledBuiltBoundary(site, files) {
  const [resume, project] = await Promise.all([
    readFile(join(site, "resume/index.html"), "utf8"),
    readFile(join(site, "projects/lattice/text-to-lattice/index.html"), "utf8"),
  ]);
  for (const pattern of [
    /data-lattice-launch="text-to-lattice"/u,
    /aria-label="Use Text to Lattice"/u,
    /aria-haspopup="dialog"/u,
    /id="lattice-demo-dialog"/u,
    /id="lattice-demo-input"/u,
    /id="lattice-use-confirmation"/u,
  ]) {
    if (!pattern.test(resume)) fail(`enabled résumé artifact omits its required interaction contract: ${pattern}.`);
  }
  if ((resume.match(/data-lattice-launch="text-to-lattice"/gu) ?? []).length !== 1) {
    fail("enabled résumé artifact must expose exactly one Text to Lattice modal launcher.");
  }
  if (!/href="\/resume\/#text-to-lattice"[^>]*>Use Text to Lattice<\/a>/u.test(project)) {
    fail("enabled canonical project page lacks its direct Text to Lattice launch path.");
  }

  const [canonicalDossierBytes, canonicalRegisterBytes] = await Promise.all([
    readFile(join(root, canonicalQualificationSource)),
    readFile(join(root, "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json")),
  ]);
  const qualificationHistoryBytes = approvedSourceCarry(JSON.parse(canonicalRegisterBytes))
    ? await readFile(join(root, qualificationHistory.path)) : undefined;
  const renderedEvidence = await Promise.all(files
    .filter((path) => [".html", ".json", ".jsonld", ".md", ".txt"].includes(extname(path).toLowerCase()))
    .map(async (path) => [relative(site, path).split("\\").join("/"), await readFile(path)]));
  for (const [path, publishedBytes] of renderedEvidence) {
    verifyEnabledPublicationCopy(path, publishedBytes, canonicalDossierBytes, canonicalRegisterBytes, qualificationHistoryBytes);
  }

  const executableEntries = await Promise.all(files
    .filter((path) => heldExecutableExtensions.has(extname(path).toLowerCase()))
    .map(async (path) => [relative(site, path).split("\\").join("/"), await readFile(path, "utf8")]));
  const executable = executableEntries.map(([, source]) => source).join("\n");
  if (!executable.includes(LATTICE_API_PATH)) {
    fail(`enabled release artifact omits the same-origin capability ${LATTICE_API_PATH}.`);
  }
  for (const forbidden of [
    "/api/text-to-lattice/lease",
    "https://verify.hah.dev",
    HUGGING_FACE_CHAT_COMPLETIONS_URL,
    HUGGING_FACE_VERIFICATION_CHAT_COMPLETIONS_URL,
    LATTICE_VERIFICATION_REQUEST_MODEL,
    LATTICE_REMOTE_MODELS.generator,
    LATTICE_REMOTE_MODELS.verifier,
    "@mlc-ai/web-llm",
    "CreateWebWorkerMLCEngine",
  ]) {
    if (executable.includes(forbidden)) fail(`enabled browser executable graph contains forbidden boundary ${forbidden}.`);
  }
  const modelWorker = files.find((path) => /latticeWebllm|text-to-lattice[^/]*worker/iu.test(relative(site, path)));
  if (modelWorker) fail(`enabled remote release contains a retired local model Worker: ${relative(site, modelWorker)}.`);
}

async function verifyExportedReleaseEvidence(site, files) {
  for (const filename of ["LLAMA-USE-EVALUATION-CASES.json", "TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md", "TEXT-TO-LATTICE-RELEASE-REGISTER.json"]) {
    const exportedPath = files.find((path) => relative(site, path).split("\\").join("/") === `documentation/text-to-lattice/${filename}`);
    if (!exportedPath) {
      fail(`release site omits exported release evidence ${filename}.`);
    }
    const sourcePath = join(root, "docs/text-to-lattice", filename);
    const [sourceBytes, exportedBytes] = await Promise.all([readFile(sourcePath), readFile(exportedPath)]);
    if (!sourceBytes.equals(exportedBytes)) fail(`release-site evidence ${filename} is not byte-identical to its canonical source.`);
  }
}

async function verifyBuiltBoundary(register, site) {
  if (!(await stat(site)).isDirectory()) fail("--site requires a built site directory.");
  const files = await filesBelow(site);
  if (register.publicClient.status === "held") await verifyHeldBuiltBoundary(site, files);
  else if (register.publicClient.status === "enabled") await verifyEnabledBuiltBoundary(site, files);
  else fail("site verification requires a held or enabled public-client status.");
  await verifyExportedReleaseEvidence(site, files);
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  const args = process.argv.slice(2);
  const requested = new Set(args.filter((value) => !value.startsWith("--register=") && !value.startsWith("--site-root=")));
  const registerArguments = args.filter((value) => value.startsWith("--register="));
  const siteRootArguments = args.filter((value) => value.startsWith("--site-root="));
  if ([...requested].some((value) => !["--source", "--site"].includes(value)) || registerArguments.length > 1 || siteRootArguments.length > 1) {
    fail("supported options are --source, --site, one --register=<path> test fixture, and one --site-root=<path> fixture.");
  }
  if (siteRootArguments.length && !requested.has("--site")) fail("--site-root requires --site.");
  if (siteRootArguments[0] === "--site-root=") fail("--site-root requires a nonempty path.");
  const selectedRegisterPath = registerArguments.length
    ? resolve(root, registerArguments[0].slice("--register=".length))
    : registerPath;
  const selectedSiteRoot = siteRootArguments.length
    ? resolve(root, siteRootArguments[0].slice("--site-root=".length))
    : join(root, "site");
  const { register } = await verifySourceBoundary(await readJson(selectedRegisterPath, "release register"));
  if (requested.has("--site")) await verifyBuiltBoundary(register, selectedSiteRoot);
  process.stdout.write(`Text to Lattice release boundary verified (${register.publicClient.status}${requested.has("--site") ? ", source and site" : ", source"}).\n`);
}
