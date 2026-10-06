import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  createLatticeQualificationUsageEvidence,
  LATTICE_QUALIFICATION_CATALOG,
  parseLatticeQualificationUsageHeaders,
  verifyLatticeQualificationUsageEvidence,
} from "../scripts/text-to-lattice-qualification-usage.mjs";
import {
  LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS as names,
} from "../workers/text-to-lattice-api/worker.js";

function headers(values = {}) {
  return new Headers(Object.entries(values).map(([key, value]) => [names[key], value]));
}

const complete = Object.freeze({ status: "complete", generator: "2,1000,200", verifier: "3,2000,100" });
const observed = Object.freeze({
  status: "complete",
  generator: { calls: 2, prompt_tokens: 1000, completion_tokens: 200 },
  verifier: { calls: 3, prompt_tokens: 2000, completion_tokens: 100 },
});

function liveReceipt(patch = {}) {
  return {
    format: "TEXT_TO_LATTICE_REMOTE_DEPLOYMENT_EVIDENCE",
    schemaVersion: 3,
    verified_at: "2026-10-05T12:34:56.000Z",
    deployment: {
      repository: "howardhayden/folio",
      run_url: "https://github.com/howardhayden/folio/actions/runs/12345",
      run_attempt: 1,
      job: "deploy_text_to_lattice_services",
      commit: "a".repeat(40),
    },
    declared_provider_contract: {
      generator_model: LATTICE_QUALIFICATION_CATALOG.generator.model,
      verifier_model: LATTICE_QUALIFICATION_CATALOG.verifier.model,
    },
    transformation_canary: {
      request_count: 1,
      http_status: 200,
      terminal_status: "translated",
      strict_result_valid: true,
      input_content_recorded: false,
      result_content_recorded: false,
    },
    ...patch,
  };
}

const bytes = (value = liveReceipt()) => new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);

test("usage parsing distinguishes absence, explicit unavailability, and complete reported zero values", () => {
  assert.deepEqual(parseLatticeQualificationUsageHeaders(headers()), { status: "not-observed" });
  assert.deepEqual(parseLatticeQualificationUsageHeaders(headers({ status: "unavailable" })), { status: "unavailable" });
  assert.deepEqual(parseLatticeQualificationUsageHeaders(headers(complete)), observed);
  assert.deepEqual(parseLatticeQualificationUsageHeaders(headers({
    status: "complete", generator: "1,0,0", verifier: "1,0,0",
  })), {
    status: "complete",
    generator: { calls: 1, prompt_tokens: 0, completion_tokens: 0 },
    verifier: { calls: 1, prompt_tokens: 0, completion_tokens: 0 },
  });
});

test("usage header parser rejects partial groups, malformed integers, impossible counts, and duplicate joins", async (t) => {
  const cases = [
    ["missing status", { generator: complete.generator, verifier: complete.verifier }],
    ["empty status", { ...complete, status: "" }],
    ["unknown status", { ...complete, status: "partial" }],
    ["missing role", { status: "complete", generator: complete.generator }],
    ["unavailable with role", { status: "unavailable", generator: complete.generator }],
    ["unavailable with empty role", { status: "unavailable", verifier: "" }],
    ...["0,1,1", "01,1,1", "1,01,1", "1,1.0,1", "1,1e3,1", "1,-1,1", "1,+1,1",
      "1, 1,1", "1,1,1,1", "1,1,1, 1,1,1", "33,1,1", "1,1048577,1",
      "1,1,1048577", "32,33554433,0", "1,NaN,1", "1,Infinity,1"]
      .map((value) => [value, { ...complete, generator: value }]),
    ["total 33 calls", { status: "complete", generator: "16,1,1", verifier: "17,1,1" }],
  ];
  for (const [label, values] of cases) await t.test(label, () => {
    assert.throws(() => parseLatticeQualificationUsageHeaders(headers(values)), /usage|observation/u);
  });
  const duplicate = headers(complete);
  duplicate.append(names.generator, complete.generator);
  assert.throws(() => parseLatticeQualificationUsageHeaders(duplicate), /usage/u);
});

test("reported token observation limits are accepted exactly and are not treated as runtime ceilings", () => {
  const observation = parseLatticeQualificationUsageHeaders(headers({
    status: "complete", generator: "31,32505856,32505856", verifier: "1,1048576,1048576",
  }));
  assert.equal(observation.generator.calls + observation.verifier.calls, 32);
  const evidence = createLatticeQualificationUsageEvidence(bytes(), observation);
  assert.equal(evidence.cost.guaranteed_cost_bound, false);
});

test("role header parsing rejects line terminators even without platform header normalization", () => {
  for (const suffix of ["\n", "\r", "\r\n", "\u2028", "\u2029"]) {
    for (const role of ["generator", "verifier"]) {
      const values = { ...complete, [role]: `${complete[role]}${suffix}` };
      const rawHeaders = {
        keys() { return Object.values(names).values(); },
        get(name) {
          const field = Object.keys(names).find((key) => names[key] === name);
          return values[field] ?? null;
        },
      };
      assert.throws(() => parseLatticeQualificationUsageHeaders(rawHeaders), /usage role header/u);
    }
  }
});

test("unknown usage-family headers fail before the absent-group branch without reflecting values", () => {
  for (const unknownName of [
    "X-Lattice-Qualification-Usage-Raw",
    "X-Lattice-Qualification-Usage",
    "X-Lattice-Qualification-Generator-Usage-Detail",
    "X-Lattice-Qualification-Verifier-Usage-Cached",
  ]) {
    for (const values of [{}, complete, { status: "unavailable" }]) {
      const input = headers(values);
      input.set(unknownName, "sensitive-untrusted-observation");
      assert.throws(() => parseLatticeQualificationUsageHeaders(input), (error) => {
        assert.match(error.message, /undeclared qualification usage header/u);
        assert.equal(error.message.includes("sensitive"), false);
        assert.equal(error.message.includes(unknownName), false);
        return true;
      });
    }
  }
});

test("qualification usage cannot appear on a failed or uncertified canary", () => {
  assert.deepEqual(parseLatticeQualificationUsageHeaders(headers(), { acceptedSuccess: false }), { status: "not-observed" });
  for (const values of [complete, { status: "unavailable" }]) {
    assert.throws(() => parseLatticeQualificationUsageHeaders(headers(values), { acceptedSuccess: false }), /outside an accepted/u);
  }
});

test("usage sidecar binds the exact live v3 bytes and computes the dated catalog estimate without floating-point rounding", () => {
  const liveBytes = bytes();
  const evidence = createLatticeQualificationUsageEvidence(liveBytes, observed);
  assert.equal(evidence.live_boundary.sha256, createHash("sha256").update(liveBytes).digest("hex"));
  assert.deepEqual(evidence.deployment, liveReceipt().deployment);
  assert.equal(evidence.catalog.source_sha256, "558f77423f195a611fd60411cde5cef062d3ed80b7ec70116c2c67e10ce617de");
  assert.equal(evidence.catalog.observed_on, "2026-10-06");
  assert.equal(evidence.cost.generator_usd, "0.00020000");
  assert.equal(evidence.cost.verifier_usd, "0.00012600");
  assert.equal(evidence.cost.total_usd, "0.00032600");
  assert.equal(evidence.cost.billed_cost_observed, false);
  assert.equal(evidence.cost.complete_account_cost_observed, false);
  assert.equal(evidence.cost.discounts_credits_taxes_and_other_charges_included, false);
  assert.equal(verifyLatticeQualificationUsageEvidence(evidence, liveBytes, { requireComplete: true }), evidence);
});

test("usage sidecar never converts unavailable observations into numeric or zero cost", () => {
  for (const status of ["not-observed", "unavailable"]) {
    const evidence = createLatticeQualificationUsageEvidence(bytes(), { status });
    assert.deepEqual(evidence.observation, { status });
    assert.equal(evidence.cost.status, "unavailable");
    assert.equal(Object.hasOwn(evidence.cost, "total_usd"), false);
    assert.equal(verifyLatticeQualificationUsageEvidence(evidence, bytes()), evidence);
    assert.throws(() => verifyLatticeQualificationUsageEvidence(evidence, bytes(), { requireComplete: true }), /unavailable/u);
  }
});

test("sidecar consumer rejects hash, workflow, rate, estimate, privacy, extra-content and completeness drift", async (t) => {
  const mutations = [
    ["hash", (v) => { v.live_boundary.sha256 = "b".repeat(64); }],
    ["commit", (v) => { v.deployment.commit = "b".repeat(40); }],
    ["run", (v) => { v.deployment.run_attempt = 2; }],
    ["catalog rate", (v) => { v.catalog.generator.input_rate = "0.02"; }],
    ["catalog model", (v) => { v.catalog.verifier.model = "unreviewed"; }],
    ["amount", (v) => { v.cost.total_usd = "0.00000000"; }],
    ["invoice claim", (v) => { v.cost.billed_cost_observed = true; }],
    ["privacy claim", (v) => { v.privacy.provider_envelopes_recorded = true; }],
    ["raw content", (v) => { v.raw_response = "not permitted"; }],
    ["cached detail", (v) => { v.observation.generator.cached_tokens = 1; }],
    ["partial numeric data", (v) => { v.observation.status = "unavailable"; }],
    ["observation overflow", (v) => { v.observation.generator.calls = 32; }],
  ];
  for (const [label, mutate] of mutations) await t.test(label, () => {
    const value = structuredClone(createLatticeQualificationUsageEvidence(bytes(), observed));
    mutate(value);
    assert.throws(() => verifyLatticeQualificationUsageEvidence(value, bytes()), /evidence failed/u);
  });
  const evidence = createLatticeQualificationUsageEvidence(bytes(), observed);
  assert.throws(() => verifyLatticeQualificationUsageEvidence(evidence, new TextEncoder().encode(JSON.stringify(liveReceipt()))), /binding drifted/u);
});

test("only a current-model successful live v3 receipt can carry a usage sidecar", async (t) => {
  const mutations = [
    ["preflight", (v) => { v.format = "TEXT_TO_LATTICE_REMOTE_PREFLIGHT_EVIDENCE"; }],
    ["v2", (v) => { v.schemaVersion = 2; }],
    ["future version", (v) => { v.schemaVersion = 4; }],
    ["wrong repository", (v) => { v.deployment.repository = "other/repo"; }],
    ["failed canary", (v) => { v.transformation_canary.http_status = 502; }],
    ["uncertified", (v) => { v.transformation_canary.terminal_status = "unable-to-attempt"; }],
    ["no strict result", (v) => { v.transformation_canary.strict_result_valid = false; }],
    ["prior Next80B generator", (v) => { v.declared_provider_contract.generator_model = "Qwen/Qwen3-Next-80B-A3B-Instruct:deepinfra"; }],
    ["old generator", (v) => { v.declared_provider_contract.generator_model = "Qwen/Qwen3-4B-Instruct-2507:nscale"; }],
    ["old provider", (v) => { v.declared_provider_contract.verifier_model = "meta-llama/Llama-3.1-8B-Instruct:deepinfra"; }],
    ["missing timestamp", (v) => { delete v.verified_at; }],
    ["content retained", (v) => { v.transformation_canary.input_content_recorded = true; }],
  ];
  for (const [label, mutate] of mutations) await t.test(label, () => {
    const value = liveReceipt(); mutate(value);
    assert.throws(() => createLatticeQualificationUsageEvidence(bytes(value), observed), /live v3/u);
  });
  for (const badBytes of [new Uint8Array(), new Uint8Array(65_537), new Uint8Array([255]), new TextEncoder().encode("{")]) {
    assert.throws(() => createLatticeQualificationUsageEvidence(badBytes, observed), /evidence failed/u);
  }
});

test("live workflow identity rejects trailing line terminators and normalized invalid dates", () => {
  for (const suffix of ["\n", "\r", "\r\n", "\u2028", "\u2029"]) {
    for (const field of ["run_url", "job", "commit"]) {
      const live = liveReceipt(); live.deployment[field] += suffix;
      assert.throws(() => createLatticeQualificationUsageEvidence(bytes(live), observed), /live v3/u);
    }
    const live = liveReceipt(); live.verified_at += suffix;
    assert.throws(() => createLatticeQualificationUsageEvidence(bytes(live), observed), /live v3/u);
  }
  assert.throws(() => createLatticeQualificationUsageEvidence(bytes(liveReceipt({
    verified_at: "2026-02-30T00:00:00.000Z",
  })), observed), /live v3/u);
});
