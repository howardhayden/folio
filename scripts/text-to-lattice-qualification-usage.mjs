import { createHash } from "node:crypto";

import {
  LATTICE_PROVIDER_CALL_LIMIT,
  LATTICE_QUALIFICATION_USAGE_TOKEN_LIMIT_PER_CALL,
  LATTICE_QUALIFICATION_USAGE_TOKEN_LIMIT_AGGREGATE,
  LATTICE_REMOTE_MODELS,
} from "../workers/text-to-lattice-api/huggingFaceAdapter.js";
import {
  LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS,
} from "../workers/text-to-lattice-api/worker.js";

export const LATTICE_QUALIFICATION_USAGE_EVIDENCE_FORMAT =
  "TEXT_TO_LATTICE_QUALIFICATION_USAGE_EVIDENCE";
export const LATTICE_QUALIFICATION_USAGE_EVIDENCE_BASENAME = "qualification-usage.json";

// Dated public catalog observation, not a billing contract or live rate lookup.
// The retained full catalog's bytes were independently hashed before extraction.
export const LATTICE_QUALIFICATION_CATALOG = Object.freeze({
  source_url: "https://router.huggingface.co/v1/models",
  observed_on: "2026-10-05",
  source_sha256: "d7b7bb1ff1333ad9b0f0c8259180fe0d374e2ef6ac65647b99d4aebe0838ecb0",
  unit: "USD-per-million-tokens",
  unit_documentation_url: "https://huggingface.co/docs/inference-providers/en/hub-api",
  generator: Object.freeze({
    model: "Qwen/Qwen3-Next-80B-A3B-Instruct:deepinfra",
    input_rate: "0.09",
    output_rate: "1.10",
  }),
  verifier: Object.freeze({
    model: "meta-llama/Llama-3.1-8B-Instruct:nscale",
    input_rate: "0.06",
    output_rate: "0.06",
  }),
});

const ROLES = Object.freeze(["generator", "verifier"]);
const PRIVACY = Object.freeze({
  application_content_recorded: false,
  provider_envelopes_recorded: false,
  credentials_recorded: false,
  cached_token_details_recorded: false,
});

function fail(message) {
  throw new Error(`Text to Lattice qualification usage evidence failed: ${message}`);
}

function exactFields(value, fields) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === fields.length
    && fields.every((field) => Object.hasOwn(value, field));
}

function wholeString(value, pattern) {
  return typeof value === "string" && pattern.exec(value)?.[0] === value;
}

function validRole(value) {
  if (!exactFields(value, ["calls", "prompt_tokens", "completion_tokens"])
    || !Number.isSafeInteger(value.calls) || value.calls < 1
    || value.calls > LATTICE_PROVIDER_CALL_LIMIT) return false;
  return [value.prompt_tokens, value.completion_tokens].every((count) => (
    Number.isSafeInteger(count) && count >= 0
    && count <= LATTICE_QUALIFICATION_USAGE_TOKEN_LIMIT_AGGREGATE
    && count <= value.calls * LATTICE_QUALIFICATION_USAGE_TOKEN_LIMIT_PER_CALL
  ));
}

function validatedObservation(value) {
  if (exactFields(value, ["status"])
    && ["not-observed", "unavailable"].includes(value.status)) {
    return Object.freeze({ status: value.status });
  }
  if (!exactFields(value, ["status", ...ROLES]) || value.status !== "complete"
    || !ROLES.every((role) => validRole(value[role]))
    || value.generator.calls + value.verifier.calls > LATTICE_PROVIDER_CALL_LIMIT) {
    fail("the closed provider-reported usage observation is invalid");
  }
  return Object.freeze({
    status: "complete",
    ...Object.fromEntries(ROLES.map((role) => [role, Object.freeze({
      calls: value[role].calls,
      prompt_tokens: value[role].prompt_tokens,
      completion_tokens: value[role].completion_tokens,
    })])),
  });
}

/** Parse only the qualification header group; never copy arbitrary header values. */
export function parseLatticeQualificationUsageHeaders(headers, { acceptedSuccess = true } = {}) {
  if (typeof headers?.get !== "function" || typeof headers?.keys !== "function") {
    fail("the usage header interface is invalid");
  }
  const allowedNames = new Set(Object.values(LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS)
    .map((name) => name.toLowerCase()));
  const prefixes = [
    "x-lattice-qualification-usage",
    "x-lattice-qualification-generator-usage",
    "x-lattice-qualification-verifier-usage",
  ];
  for (const name of headers.keys()) {
    if (typeof name !== "string") fail("the usage header interface is invalid");
    const lowerName = name.toLowerCase();
    if (prefixes.some((prefix) => lowerName.startsWith(prefix)) && !allowedNames.has(lowerName)) {
      fail("an undeclared qualification usage header was present");
    }
  }
  const values = Object.fromEntries(Object.entries(LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS)
    .map(([field, name]) => [field, headers.get(name)]));
  if (Object.values(values).every((value) => value === null)) {
    return Object.freeze({ status: "not-observed" });
  }
  if (!acceptedSuccess) fail("usage headers were present outside an accepted canary success");
  if (values.status === "unavailable" && values.generator === null && values.verifier === null) {
    return Object.freeze({ status: "unavailable" });
  }
  if (values.status !== "complete") fail("the usage header group is incomplete or invalid");
  const roles = {};
  for (const role of ROLES) {
    // Canonical decimal counts only: no whitespace, exponent, sign, or duplicate header join.
    if (typeof values[role] !== "string"
      || !/^[1-9]\d{0,1},(?:0|[1-9]\d{0,7}),(?:0|[1-9]\d{0,7})$/u.test(values[role])) {
      fail("a usage role header is missing or malformed");
    }
    const [calls, prompt_tokens, completion_tokens] = values[role].split(",").map(Number);
    if ([calls, prompt_tokens, completion_tokens].join(",") !== values[role]) {
      fail("a usage role header is not canonical");
    }
    roles[role] = { calls, prompt_tokens, completion_tokens };
  }
  return validatedObservation({ status: "complete", ...roles });
}

function catalogCost(observation) {
  const common = {
    basis: "provider-reported-usage-times-dated-catalog-rates",
    currency: "USD",
    billed_cost_observed: false,
    complete_account_cost_observed: false,
    discounts_credits_taxes_and_other_charges_included: false,
    guaranteed_cost_bound: false,
  };
  if (observation.status !== "complete") return Object.freeze({ status: "unavailable", ...common });
  // Rates are cents per million tokens, so the exact integer unit is 10^-8 USD.
  const roleUnits = ROLES.map((role) => {
    const rate = LATTICE_QUALIFICATION_CATALOG[role];
    return BigInt(observation[role].prompt_tokens) * BigInt(rate.input_rate.replace(".", ""))
      + BigInt(observation[role].completion_tokens) * BigInt(rate.output_rate.replace(".", ""));
  });
  const dollars = (units) => `${units / 100_000_000n}.${`${units % 100_000_000n}`.padStart(8, "0")}`;
  return Object.freeze({
    status: "estimated",
    ...common,
    generator_usd: dollars(roleUnits[0]),
    verifier_usd: dollars(roleUnits[1]),
    total_usd: dollars(roleUnits[0] + roleUnits[1]),
  });
}

function liveContext(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0 || bytes.byteLength > 65_536) {
    fail("the live receipt bytes are missing or exceed the evidence boundary");
  }
  let live;
  try { live = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { fail("the live receipt is not UTF-8 JSON"); }
  const deployment = live?.deployment;
  const canary = live?.transformation_canary;
  if (live?.format !== "TEXT_TO_LATTICE_REMOTE_DEPLOYMENT_EVIDENCE" || live.schemaVersion !== 3
    || !exactFields(deployment, ["repository", "run_url", "run_attempt", "job", "commit"])
    || deployment.repository !== "howardhayden/folio"
    || !wholeString(deployment.run_url, /^https:\/\/github\.com\/howardhayden\/folio\/actions\/runs\/[1-9]\d*$/u)
    || !Number.isSafeInteger(deployment.run_attempt) || deployment.run_attempt < 1
    || !wholeString(deployment.job, /^[A-Za-z0-9_-]{1,100}$/u)
    || !wholeString(deployment.commit, /^[a-f0-9]{40}$/u)
    || !wholeString(live.verified_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u)
    || !Number.isFinite(Date.parse(live.verified_at))
    || new Date(live.verified_at).toISOString() !== live.verified_at
    || canary?.request_count !== 1 || canary.http_status !== 200
    || !["translated", "conformant-for-context"].includes(canary.terminal_status)
    || canary.strict_result_valid !== true
    || canary.input_content_recorded !== false || canary.result_content_recorded !== false
    || live.declared_provider_contract?.generator_model !== LATTICE_QUALIFICATION_CATALOG.generator.model
    || live.declared_provider_contract?.verifier_model !== LATTICE_QUALIFICATION_CATALOG.verifier.model
    || LATTICE_REMOTE_MODELS.generator !== LATTICE_QUALIFICATION_CATALOG.generator.model
    || LATTICE_REMOTE_MODELS.verifier !== LATTICE_QUALIFICATION_CATALOG.verifier.model) {
    fail("the usage observation is not bound to an accepted current-model live v3 receipt");
  }
  return { verified_at: live.verified_at, deployment: Object.freeze({ ...deployment }) };
}

/** Keep this separate from the unchanged v3 deployment receipt and browser index. */
export function createLatticeQualificationUsageEvidence(liveEvidenceBytes, observation) {
  const context = liveContext(liveEvidenceBytes);
  const usage = validatedObservation(observation);
  return Object.freeze({
    format: LATTICE_QUALIFICATION_USAGE_EVIDENCE_FORMAT,
    schemaVersion: 1,
    ...context,
    scope: "one-successful-synthetic-canary",
    live_boundary: Object.freeze({
      basename: "live-boundary.json",
      sha256: createHash("sha256").update(liveEvidenceBytes).digest("hex"),
    }),
    observation: usage,
    catalog: LATTICE_QUALIFICATION_CATALOG,
    cost: catalogCost(usage),
    privacy: PRIVACY,
  });
}

/** Require byte custody and exact derived fields; unknown/missing data cannot close cost evidence. */
export function verifyLatticeQualificationUsageEvidence(evidence, liveEvidenceBytes, {
  requireComplete = false,
} = {}) {
  const expected = createLatticeQualificationUsageEvidence(liveEvidenceBytes, evidence?.observation);
  if (JSON.stringify(evidence) !== JSON.stringify(expected)) fail("the closed sidecar or live-byte binding drifted");
  if (requireComplete && evidence.observation.status !== "complete") fail("provider-reported cost observation is unavailable");
  return evidence;
}
