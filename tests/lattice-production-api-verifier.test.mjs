import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { LATTICE_RESULT_VERSION } from "../app/resume/lattice/remoteProtocol.js";
import {
  LATTICE_PRODUCTION_EVIDENCE_SCHEMA,
  LATTICE_PRODUCTION_NEGATIVE_PROBE_CONTRACT,
  LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS,
  LATTICE_PRODUCTION_ADMISSION_NEGATIVE_PROBE_IDS,
  parseLatticeQualificationAdmissionHeaders,
  parseLatticeRequireAdmissionEvidence,
  verifyLatticeProductionAdmissionEvidence,
  LATTICE_PRODUCTION_PREFLIGHT_EVIDENCE_SCHEMA,
  LATTICE_PRODUCTION_READINESS_CONTENT_TYPE,
  LATTICE_PRODUCTION_READINESS_CONTRACT,
  LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT,
  serializeLatticeProductionEvidence,
  verifyTextToLatticeApiProduction,
  writeLatticeProductionEvidenceReceipt,
} from "../scripts/verify-text-to-lattice-api-production.mjs";
import {
  LATTICE_PRODUCTION_CANARY_REQUEST,
  LATTICE_PRODUCTION_CANARY_TEXT,
} from "../scripts/text-to-lattice-production-canary.mjs";
import {
  LATTICE_HELD_API_READINESS_CONTRACT,
  verifyTextToLatticeHeldApi,
} from "../scripts/verify-text-to-lattice-held-api.mjs";
import {
  createLatticeApiWorker,
  LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER,
  LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_ADMISSION_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_HTTP_DIAGNOSTIC_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_ENVELOPE_SHAPE_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_STRICT_MESSAGE_SHAPE_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_PRIOR_VERIFICATION_REJECTION_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_TERMINAL_ANALYSIS_DIAGNOSTIC_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_WITHHELD_DIAGNOSTIC_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_PIPELINE_DIAGNOSTIC_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS,
} from "../workers/text-to-lattice-api/worker.js";
import {
  verifyLatticeQualificationUsageEvidence,
} from "../scripts/text-to-lattice-qualification-usage.mjs";
import {
  TEXT_TO_LATTICE_DOCUMENT_POLICY,
} from "../workers/text-to-lattice-response-policy/worker.js";

const context = Object.freeze({
  commit: "a".repeat(40),
  runId: "12345",
  runAttempt: "2",
  job: "deploy_text_to_lattice_services",
  repository: "howardhayden/folio",
  serverUrl: "https://github.com",
});
const fixedNow = () => new Date("2026-09-14T12:34:56.000Z");
const noWait = async () => {};
const apiHeaders = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
});
const admissionHeaders = (overrides = {}) => Object.fromEntries(Object.entries(
  LATTICE_QUALIFICATION_ADMISSION_RESPONSE_HEADERS,
).map(([key, name]) => [name, ({ status: "complete", claim: "not-called", order: "not-called", provider: "not-started", ...overrides })[key]]));
const setupApiHeaders = Object.freeze({
  ...admissionHeaders(),
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
});
const completeUsageHeaders = Object.freeze({
  [LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS.status]: "complete",
  [LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS.generator]: "2,1000,200",
  [LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS.verifier]: "2,2000,100",
});
const quotaSetCookie = "__Secure-hah-lattice-api-visitor=v1.AAAAAAAAAAAAAAAAAAAAAAAA.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaA; Max-Age=41104; Path=/api/lattice; Secure; HttpOnly; SameSite=Strict";
const CANARY_FLOW_REQUEST_COUNT = 4
  + LATTICE_PRODUCTION_READINESS_CONTRACT.requiredConsecutiveActiveSamples
  + 1
  + LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS.length
  + 1;

function apiJson(value, status, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...apiHeaders,
      ...(status === 200 && ["translated", "conformant-for-context"].includes(value?.result?.status)
        ? admissionHeaders({ claim: "allowed-once", order: "after-validation", provider: "after-admission" }) : {}),
      ...headers },
  });
}

function qualificationDiagnosticHeaders(overrides = {}) {
  const values = {
    failureClass: "provider_http_error",
    upstreamStatus: "503",
    stage: "analysis",
    callOrdinal: "1",
    subtype: "none",
    finishReason: "none",
    requestSize: "4097-16384",
    responseSize: "none",
    contentSize: "none",
    completionTokens: "none",
    stageAttempt: "initial",
    analysisOrigin: "initial",
    analysisAttempt: "1",
    priorValidationCategory: "none",
    ...overrides,
  };
  const headers = Object.fromEntries(Object.entries(
    LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS,
  ).map(([field, header]) => [header, values[field]]));
  if (values.failureClass !== "provider_http_error" && overrides.upstreamStatus === undefined) {
    headers[LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.upstreamStatus] = "none";
  }
  if (values.failureClass === "provider_http_error") {
    Object.assign(headers, Object.fromEntries(Object.values(
      LATTICE_QUALIFICATION_HTTP_DIAGNOSTIC_RESPONSE_HEADERS,
    ).map((header) => [header, "absent"])));
  }
  return headers;
}

function terminalAnalysisDiagnosticHeaders(overrides = {}) {
  const values = {
    cause: "host-validation",
    validationCategory: "evidence",
    priorValidationCategory: "passage-coverage",
    origin: "split",
    attempt: "2",
    atomLimit: "6",
    callOrdinal: "4",
    ...overrides,
  };
  return Object.fromEntries(Object.entries(
    LATTICE_QUALIFICATION_TERMINAL_ANALYSIS_DIAGNOSTIC_RESPONSE_HEADERS,
  ).map(([field, header]) => [header, values[field]]));
}

function withheldDiagnosticHeaders(overrides = {}) {
  const values = {
    revision: "coherent", deterministic: "clear", firstDeterministicRule: "none", verification: "unavailable", certification: "not-reached",
    failureCause: "host-validation", stage: "verification", attempt: "2",
    validationCategory: "response-shape", priorValidationCategory: "evidence", callsUsed: "4",
    rejectionBoundary: "wire-decoder", rejectionCategory: "field-set", rejectionRule: "V01F",
    priorRejectionBoundary: "host-normalizer", priorRejectionCategory: "other", priorRejectionRule: "unknown",
    ...overrides,
  };
  return { ...Object.fromEntries(Object.entries(LATTICE_QUALIFICATION_WITHHELD_DIAGNOSTIC_RESPONSE_HEADERS)
    .map(([field, header]) => [header, values[field]])),
    ...pipelineDiagnosticHeaders(),
  };
}

function pipelineDiagnosticHeaders(overrides = {}) {
  const values = { retryPath: "none", candidateLineage: "initial", initialDeterministic: "clear", successfulCorrectionStage: "none", initialRetentionDowngrade: "none", ...overrides };
  return Object.fromEntries(Object.entries(LATTICE_QUALIFICATION_PIPELINE_DIAGNOSTIC_RESPONSE_HEADERS)
    .map(([field, header]) => [header, values[field]]));
}

function validResult() {
  return {
    version: LATTICE_RESULT_VERSION,
    status: "translated",
    text: "The notebook rests on the desk. The visitor reads its first page, then closes it.\n",
    wordCount: 16,
    primaryLayer: "operative",
    layerId: "operative",
    layerLabel: "Operative layer",
    layersUsed: ["operative"],
    passageCount: 1,
    revisedPassageCount: 1,
    retainedPassageCount: 0,
    batchCount: 1,
    verificationPasses: 1,
    findings: [],
    questions: [],
  };
}

function unableResult(findings, overrides = {}) {
  return {
    ...validResult(),
    status: "unable-to-attempt",
    text: null,
    primaryLayer: null,
    layerId: null,
    layerLabel: "Undetermined",
    layersUsed: [],
    revisedPassageCount: 0,
    retainedPassageCount: 0,
    verificationPasses: 0,
    findings,
    ...overrides,
  };
}

function activeReadinessResponse(headers = {}) {
  return apiJson({ error: "invalid_request" }, 405, { Allow: "POST", ...headers });
}

function productionActiveReadinessResponse(headers = {}) {
  return apiJson({ error: "invalid_request" }, 400, headers);
}

function heldReadinessResponse(headers = {}) {
  return apiJson({ error: "upstream_unavailable" }, 503, {
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    ...headers,
  });
}

function successfulFixture({ canaryResponse, readinessResponses, setupResponse, preservationResponse, tamperedCookieResponse } = {}) {
  const calls = [];
  const readinessSequence = readinessResponses ?? Array.from(
    { length: LATTICE_PRODUCTION_READINESS_CONTRACT.requiredConsecutiveActiveSamples },
    productionActiveReadinessResponse,
  );
  let readinessIndex = 0;
  let negativeIndex = 0;
  let setupRequests = 0;
  let canaryRequests = 0;
  let tamperedCookieRequests = 0;
  let canaryText = null;
  const fetchImpl = async (url, init) => {
    calls.push({ url: `${url}`, init });
    const pathname = new URL(url).pathname;
    if (["/", "/index.html", "/resume/", "/resume/index.html"].includes(pathname)) {
      return new Response("<main>Portfolio</main>", {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=60, no-transform",
          "Content-Security-Policy": TEXT_TO_LATTICE_DOCUMENT_POLICY["Content-Security-Policy"],
          "Permissions-Policy": TEXT_TO_LATTICE_DOCUMENT_POLICY["Permissions-Policy"],
        },
      });
    }

    if (pathname === "/api/lattice"
      && init.method === "POST"
      && init.headers.Accept === LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT
      && init.headers["Content-Type"] === LATTICE_PRODUCTION_READINESS_CONTENT_TYPE
      && readinessIndex < readinessSequence.length) {
      const response = readinessSequence[readinessIndex];
      readinessIndex += 1;
      if (response instanceof Error) throw response;
      return response;
    }

    if (init.headers.Accept === LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT) {
      setupRequests += 1;
      return (setupRequests > 1 ? preservationResponse : setupResponse) ?? new Response(null, {
        status: 204,
        headers: {
          ...setupApiHeaders,
          "Set-Cookie": quotaSetCookie,
        },
      });
    }

    if (negativeIndex < LATTICE_PRODUCTION_NEGATIVE_PROBE_CONTRACT.length) {
      const expected = LATTICE_PRODUCTION_NEGATIVE_PROBE_CONTRACT[negativeIndex];
      negativeIndex += 1;
      if (!expected.apiJson) return new Response("Not found", { status: expected.status });
      return apiJson({ error: expected.error }, expected.status, {
        ...(expected.allow ? { Allow: expected.allow } : {}),
        ...(LATTICE_PRODUCTION_ADMISSION_NEGATIVE_PROBE_IDS.includes(expected.id) ? admissionHeaders() : {}),
      });
    }

    if (canaryRequests > 0) {
      tamperedCookieRequests += 1;
      return tamperedCookieResponse ?? apiJson({ error: "invalid_request" }, 403, admissionHeaders());
    }

    canaryRequests += 1;
    const body = JSON.parse(init.body);
    canaryText = body.text;
    return canaryResponse ?? apiJson({ result: validResult(), schema_version: 1 }, 200, completeUsageHeaders);
  };
  return {
    calls,
    fetchImpl,
    get readinessRequests() { return readinessIndex; },
    get negativeRequests() { return negativeIndex; },
    get setupRequests() { return setupRequests; },
    get canaryRequests() { return canaryRequests; },
    get tamperedCookieRequests() { return tamperedCookieRequests; },
    get canaryText() { return canaryText; },
  };
}

test("the production verifier emits separate exact-byte-bound usage evidence with compatible v3 metadata", async () => {
  const fixture = successfulFixture();
  const sidecars = [];
  const evidence = await verifyTextToLatticeApiProduction({
    fetchImpl: fixture.fetchImpl, context, now: fixedNow, wait: noWait,
    onUsageEvidence(value) { sidecars.push(value); },
  });
  assert.equal(evidence.schemaVersion, 3);
  assert.equal(Object.hasOwn(evidence, "usage"), false);
  assert.equal(Object.hasOwn(evidence.transformation_canary, "usage"), false);
  assert.equal(sidecars.length, 1);
  const liveBytes = new TextEncoder().encode(serializeLatticeProductionEvidence(evidence).serialized);
  verifyLatticeQualificationUsageEvidence(sidecars[0], liveBytes, { requireComplete: true });
  assert.equal(sidecars[0].observation.status, "complete");
  assert.equal(sidecars[0].observation.generator.calls, 2);
  assert.equal(sidecars[0].observation.verifier.calls, 2);
  assert.equal(sidecars[0].cost.total_usd, "0.00014200");
  assert.equal(JSON.stringify(sidecars[0]).includes(LATTICE_PRODUCTION_CANARY_TEXT), false);
  assert.equal(JSON.stringify(sidecars[0]).includes(validResult().text), false);
  assert.equal(fixture.canaryRequests, 1);
});

test("successful qualification preserves missing usage as unavailable cost without inventing zeros", async (t) => {
  for (const [status, usageHeaders] of [
    ["not-observed", {}],
    ["unavailable", { [LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS.status]: "unavailable" }],
  ]) await t.test(status, async () => {
    const fixture = successfulFixture({ canaryResponse: apiJson({ result: validResult(), schema_version: 1 }, 200, usageHeaders) });
    let sidecar;
    const evidence = await verifyTextToLatticeApiProduction({
      fetchImpl: fixture.fetchImpl, context, now: fixedNow, wait: noWait,
      onUsageEvidence(value) { sidecar = value; },
    });
    assert.equal(evidence.transformation_canary.strict_result_valid, true);
    assert.deepEqual(sidecar.observation, { status });
    assert.equal(sidecar.cost.status, "unavailable");
    assert.equal(Object.hasOwn(sidecar.cost, "total_usd"), false);
  });
});

test("invalid or out-of-scope qualification usage fails without a sidecar or content retry", async (t) => {
  const responses = [
    apiJson({ result: validResult(), schema_version: 1 }, 200, { ...completeUsageHeaders, [LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS.generator]: "2,1000,200,extra" }),
    apiJson({ error: "upstream_unavailable" }, 502, completeUsageHeaders),
    apiJson({ result: unableResult([{ code: "candidate-withheld", message: "The candidate was withheld." }]), schema_version: 1 }, 200, completeUsageHeaders),
  ];
  for (const [index, canaryResponse] of responses.entries()) await t.test(String(index), async () => {
    const fixture = successfulFixture({ canaryResponse });
    let sidecarCalls = 0;
    await assert.rejects(verifyTextToLatticeApiProduction({
      fetchImpl: fixture.fetchImpl, context, now: fixedNow, wait: noWait,
      onUsageEvidence() { sidecarCalls += 1; },
    }), /qualification usage evidence failed/u);
    assert.equal(sidecarCalls, 0);
    assert.equal(fixture.canaryRequests, 1);
  });
});

test("the production verifier preserves one setup and one canary before separate backend postflight probes", async () => {
  const fixture = successfulFixture();
  let preflightCallbacks = 0;
  const readinessRequestCount =
    LATTICE_PRODUCTION_READINESS_CONTRACT.requiredConsecutiveActiveSamples;
  const evidence = await verifyTextToLatticeApiProduction({
    fetchImpl: fixture.fetchImpl,
    context,
    now: fixedNow,
    wait: noWait,
    async onPreflightEvidence(preflightEvidence) {
      preflightCallbacks += 1;
      assert.equal(fixture.canaryRequests, 0);
      assert.equal(preflightEvidence.format, LATTICE_PRODUCTION_PREFLIGHT_EVIDENCE_SCHEMA);
      assert.equal(preflightEvidence.schemaVersion, 3);
      assert.equal(preflightEvidence.declared_provider_contract.verification_endpoint,
        "https://router.huggingface.co/v1/chat/completions");
      assert.equal(preflightEvidence.declared_provider_contract.verification_request_model,
        "meta-llama/Llama-3.1-8B-Instruct:nscale");
    },
  });

  assert.equal(evidence.format, LATTICE_PRODUCTION_EVIDENCE_SCHEMA);
  assert.equal(evidence.schemaVersion, 3);
  assert.deepEqual(evidence.declared_provider_contract, {
    endpoint: "https://router.huggingface.co/v1/chat/completions",
    verification_endpoint: "https://router.huggingface.co/v1/chat/completions",
    verification_request_model: "meta-llama/Llama-3.1-8B-Instruct:nscale",
    verification_response_format: "json_schema",
    verification_schema_strict: true,
    certification_endpoint: "https://router.huggingface.co/v1/chat/completions",
    certification_request_model: "meta-llama/Llama-3.1-8B-Instruct:nscale",
    certification_response_format: "json_schema",
    certification_schema_strict: true,
    generator_model: "Qwen/Qwen3-4B-Instruct-2507:nscale",
    verifier_model: "meta-llama/Llama-3.1-8B-Instruct:nscale",
    automatic_retry: false,
    alternate_provider_or_model_fallback: false,
  });
  assert.equal(evidence.verified_at, "2026-09-14T12:34:56.000Z");
  assert.equal(preflightCallbacks, 1);
  assert.deepEqual(Object.keys(evidence), [
    "format",
    "schemaVersion",
    "verified_at",
    "deployment",
    "boundary",
    "declared_provider_contract",
    "declared_hard_limits",
    "document_policy",
    "deployment_readiness",
    "negative_probes",
    "visitor_session_setup",
    "transformation_canary",
    "visitor_session_postflight",
    "request_admission",
  ]);
  assert.deepEqual(
    evidence.negative_probes.outcomes.map(({ id }) => id),
    LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS,
  );
  assert.equal(evidence.negative_probes.count, LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS.length);
  assert.equal(evidence.negative_probes.count, 24);
  assert.equal(evidence.negative_probes.all_rejected, true);
  assert.ok(evidence.negative_probes.outcomes.every(({ elapsed_ms: elapsed, response_bytes: bytes }) => (
    Number.isSafeInteger(elapsed) && elapsed >= 0 && Number.isSafeInteger(bytes) && bytes > 0
  )));
  assert.equal(evidence.document_policy.paths.length, 4);
  assert.ok(evidence.document_policy.paths.every(({ connect_src: sources }) => (
    JSON.stringify(sources) === JSON.stringify(["'self'"])
  )));
  assert.equal(fixture.readinessRequests, readinessRequestCount);
  assert.deepEqual(evidence.deployment_readiness, {
    request_count: readinessRequestCount,
    method: "POST",
    path: "/api/lattice",
    accept: LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT,
    content_type: LATTICE_PRODUCTION_READINESS_CONTENT_TYPE,
    content_type_header_present: true,
    required_consecutive_active_samples: readinessRequestCount,
    observed_consecutive_active_samples: readinessRequestCount,
    active_response_count: readinessRequestCount,
    held_response_count: 0,
    network_error_count: 0,
    final_http_status: 400,
    final_error_code: "invalid_request",
    request_body_present: false,
    request_body_bytes: 0,
    origin_header_present: true,
    cookie_header_present: false,
    visitor_session_created: false,
    quota_claimed: false,
    provider_called: false,
    response_bodies_retained: false,
  });
  assert.equal(fixture.setupRequests, 2);
  const { elapsed_ms: setupElapsed, ...visitorSessionSetup } = evidence.visitor_session_setup;
  assert.ok(Number.isSafeInteger(setupElapsed) && setupElapsed >= 0);
  assert.deepEqual(visitorSessionSetup, {
    request_count: 1,
    automatic_retry: false,
    method: "POST",
    path: "/api/lattice",
    accept: LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT,
    content_type_header_present: false,
    request_body_present: false,
    request_body_bytes: 0,
    http_status: 204,
    response_body_present: false,
    response_body_bytes: 0,
    browser_quota: {
      name: "__Secure-hah-lattice-api-visitor",
      path: "/api/lattice",
      max_age_seconds: 41_104,
      secure: true,
      http_only: true,
      same_site: "Strict",
      domain_attribute_present: false,
      value_recorded: false,
    },
  });
  assert.equal(fixture.canaryRequests, 1);
  assert.equal(evidence.transformation_canary.request_count, 1);
  assert.equal(evidence.transformation_canary.automatic_retry, false);
  assert.equal(
    evidence.transformation_canary.input_id,
    "synthetic-notebook-certification-v2",
  );
  assert.equal(evidence.transformation_canary.input_requires_document_certification, true);
  assert.equal(evidence.transformation_canary.strict_result_valid, true);
  assert.equal(evidence.transformation_canary.terminal_status, "translated");
  assert.equal(evidence.transformation_canary.word_count, 16);
  assert.equal(evidence.transformation_canary.passage_count, 1);
  assert.equal(evidence.transformation_canary.revised_passage_count, 1);
  assert.equal(evidence.transformation_canary.retained_passage_count, 0);
  assert.equal(evidence.transformation_canary.batch_count, 1);
  assert.equal(evidence.transformation_canary.verification_passes, 1);
  assert.equal(evidence.transformation_canary.finding_count, 0);
  assert.equal(evidence.transformation_canary.result_content_recorded, false);
  assert.equal(evidence.transformation_canary.browser_quota_cookie_sent, true);
  assert.equal(evidence.transformation_canary.browser_quota_cookie_value_recorded, false);
  assert.equal(evidence.transformation_canary.set_cookie_header_present, false);
  assert.equal(evidence.transformation_canary.browser_quota_cookie_rotated, false);
  assert.ok(Number.isSafeInteger(evidence.transformation_canary.elapsed_ms));
  assert.ok(evidence.transformation_canary.response_bytes > 0);
  assert.deepEqual(evidence.declared_hard_limits, {
    api_request_timeout_ms: 240_000,
    api_request_bytes: 65_536,
    api_response_bytes: 262_144,
    provider_stage_call_timeout_ms: {
      analysis: 120_000,
      candidate: 120_000,
      verification: 180_000,
      certification: 120_000,
      repair: 120_000,
    },
    maximum_provider_call_timeout_ms: 180_000,
    provider_request_bytes: 1_048_576,
    provider_response_bytes: 262_144,
    provider_calls_per_request: 32,
    provider_stage_max_output_tokens: {
      analysis: 2_048,
      candidate: 800,
      verification: 2_048,
      certification: 520,
      repair: 800,
    },
    maximum_requested_output_tokens_per_provider_call: 2_048,
    maximum_requested_output_tokens_per_admitted_request: 65_536,
    accepted_transformations_per_utc_day: 30,
    accepted_transformations_per_cooperating_ordinary_persistent_browser_cookie_jar_utc_day: 3,
    maximum_provider_calls_from_accepted_transformations_per_utc_day: 960,
    maximum_requested_output_tokens_from_accepted_transformations_per_utc_day: 1_966_080,
    maximum_requested_output_tokens_from_one_cooperating_ordinary_persistent_browser_cookie_jar_per_utc_day:
      196_608,
  });
  assert.equal(
    fixture.calls.length,
    4 + readinessRequestCount + 1 + LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS.length + 3,
  );

  const readinessCalls = fixture.calls.slice(4, 4 + readinessRequestCount);
  assert.equal(readinessCalls.length, readinessRequestCount);
  for (const call of readinessCalls) {
    assert.equal(call.url, "https://hah.dev/api/lattice");
    assert.equal(call.init.method, "POST");
    assert.deepEqual(call.init.headers, {
      Accept: LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT,
      "Content-Type": LATTICE_PRODUCTION_READINESS_CONTENT_TYPE,
      Origin: "https://hah.dev",
    });
    assert.equal(Object.hasOwn(call.init, "body"), false);
    assert.equal(Object.keys(call.init.headers).some((name) => name.toLowerCase() === "cookie"), false);
    assert.equal(call.init.credentials, "omit");
  }

  const setupIndex = 4 + readinessRequestCount;
  const negativeProbeStartIndex = setupIndex + 1;
  const setupCall = fixture.calls[setupIndex];
  assert.equal(setupCall.init.method, "POST");
  assert.equal(setupCall.init.headers.Accept, LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT);
  assert.equal(Object.hasOwn(setupCall.init, "body"), false);
  assert.equal(Object.keys(setupCall.init.headers).some((name) => name.toLowerCase() === "content-type"), false);
  assert.equal(Object.keys(setupCall.init.headers).some((name) => name.toLowerCase() === "cookie"), false);

  const canaryCall = fixture.calls.at(-3);
  const expectedCanaryRequest = {
    text: "A visitor places a blue notebook on the desk, reads the first page, and closes it.\n",
    requested_mode: "operative",
    schema_version: 1,
  };
  assert.deepEqual(LATTICE_PRODUCTION_CANARY_REQUEST, expectedCanaryRequest);
  assert.equal(Object.isFrozen(LATTICE_PRODUCTION_CANARY_REQUEST), true);
  assert.equal(canaryCall.url, "https://hah.dev/api/lattice");
  assert.equal(canaryCall.init.method, "POST");
  assert.deepEqual(canaryCall.init.headers, {
    Accept: "application/json",
    "Content-Type": "application/json",
    Origin: "https://hah.dev",
    [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]:
      LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
    Cookie: quotaSetCookie.split(";", 1)[0],
  });
  assert.equal(canaryCall.init.body, JSON.stringify(expectedCanaryRequest));
  assert.equal(canaryCall.init.cache, "no-store");
  assert.equal(canaryCall.init.credentials, "omit");
  assert.equal(canaryCall.init.redirect, "error");
  assert.equal(canaryCall.init.referrerPolicy, "no-referrer");
  assert.ok(canaryCall.init.signal instanceof AbortSignal);
  assert.equal(canaryCall.init.signal.aborted, false);

  const missingSessionCall = fixture.calls[
    negativeProbeStartIndex
      + LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS.indexOf("missing-visitor-session")
  ];
  assert.equal(
    Object.keys(missingSessionCall.init.headers).some((name) => name.toLowerCase() === "cookie"),
    false,
  );
  assert.deepEqual(JSON.parse(missingSessionCall.init.body), {
    text: "lattice-live-negative-canary-2026-09-14",
    requested_mode: "operative",
    schema_version: 1,
  });

  const exactRequestBoundaryCall = fixture.calls[
    negativeProbeStartIndex
      + LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS.indexOf("request-byte-limit-exact")
  ];
  const plusOneRequestBoundaryCall = fixture.calls[
    negativeProbeStartIndex
      + LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS.indexOf("request-byte-limit-plus-one")
  ];
  assert.equal(new TextEncoder().encode(exactRequestBoundaryCall.init.body).byteLength, 65_536);
  assert.equal(new TextEncoder().encode(plusOneRequestBoundaryCall.init.body).byteLength, 65_537);

  const serializedEvidence = JSON.stringify(evidence);
  assert.equal(fixture.canaryText, LATTICE_PRODUCTION_CANARY_TEXT);
  assert.equal(serializedEvidence.includes(fixture.canaryText), false);
  assert.equal(serializedEvidence.includes(validResult().text), false);
  assert.doesNotMatch(serializedEvidence, /synthetic-credential|lattice-live-negative-canary/u);

  const credentialCalls = fixture.calls.slice(negativeProbeStartIndex)
    .filter((_call, index) => LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS[index]?.startsWith("credential-"));
  assert.equal(credentialCalls.length, 6);
  assert.ok(credentialCalls.every(({ init }) => init.method === "POST"));
  assert.deepEqual(
    JSON.parse(credentialCalls[0].init.body),
    {
      text: "lattice-live-negative-canary-2026-09-14",
      requested_mode: "operative",
      schema_version: 1,
    },
  );
  assert.ok(credentialCalls.slice(1).every(({ init }) => init.body === "{"));

  const serialized = serializeLatticeProductionEvidence(evidence);
  assert.equal(
    serialized.payloadSha256,
    createHash("sha256").update(serialized.serialized).digest("hex"),
  );
  assert.deepEqual(JSON.parse(serialized.serialized), evidence);
});

test("the certification canary rejects an unaccepted status or an inexact terminal document boundary", async (contextTest) => {
  const base = validResult();
  const cases = [
    [
      "review-required",
      { ...base, status: "review-required" },
      /did not prove an accepted certified result/u,
    ],
    [
      "missing terminal line feed",
      { ...base, text: base.text.slice(0, -1) },
      /did not preserve its required terminal document boundary/u,
    ],
    [
      "carriage-return line feed",
      { ...base, text: `${base.text.slice(0, -1)}\r\n` },
      /did not preserve its required terminal document boundary/u,
    ],
    [
      "multiple terminal line feeds",
      { ...base, text: `${base.text}\n` },
      /did not preserve its required terminal document boundary/u,
    ],
    [
      "terminal Unicode line separator",
      { ...base, text: `${base.text.slice(0, -1)}\u2028\n` },
      /did not preserve its required terminal document boundary/u,
    ],
    [
      "terminal Unicode paragraph separator",
      { ...base, text: `${base.text.slice(0, -1)}\u2029\n` },
      /did not preserve its required terminal document boundary/u,
    ],
  ];

  for (const [name, result, expectedFailure] of cases) {
    await contextTest.test(name, async () => {
      const fixture = successfulFixture({
        canaryResponse: apiJson({ result, schema_version: 1 }, 200),
      });
      await assert.rejects(
        verifyTextToLatticeApiProduction({
          fetchImpl: fixture.fetchImpl,
          context,
          now: fixedNow,
          wait: noWait,
        }),
        expectedFailure,
      );
      assert.equal(fixture.canaryRequests, 1);
      assert.equal(fixture.setupRequests, 1);
      assert.equal(fixture.calls.length, CANARY_FLOW_REQUEST_COUNT);
    });
  }
});

test("the certification canary accepts supported no-split and adaptive-split outcomes", async (contextTest) => {
  const cases = [
    ["translated without a split", validResult()],
    ["translated after an adaptive split", {
      ...validResult(),
      passageCount: 2,
      revisedPassageCount: 2,
      batchCount: 2,
      verificationPasses: 2,
    }],
    ["conformant without a split", {
      ...validResult(),
      status: "conformant-for-context",
      text: LATTICE_PRODUCTION_CANARY_TEXT,
      revisedPassageCount: 0,
      retainedPassageCount: 1,
    }],
    ["conformant after an adaptive split", {
      ...validResult(),
      status: "conformant-for-context",
      text: LATTICE_PRODUCTION_CANARY_TEXT,
      passageCount: 2,
      revisedPassageCount: 0,
      retainedPassageCount: 2,
      batchCount: 2,
      verificationPasses: 2,
    }],
  ];
  for (const [name, result] of cases) {
    await contextTest.test(name, async () => {
      const fixture = successfulFixture({
        canaryResponse: apiJson({
          result,
          schema_version: 1,
        }, 200),
      });
      const evidence = await verifyTextToLatticeApiProduction({
        fetchImpl: fixture.fetchImpl,
        context,
        now: fixedNow,
        wait: noWait,
      });
      assert.equal(evidence.transformation_canary.terminal_status, result.status);
      assert.equal(fixture.canaryRequests, 1);
      assert.equal(fixture.setupRequests, 2);
      assert.equal(fixture.calls.length, CANARY_FLOW_REQUEST_COUNT + 2);
    });
  }
});

test("the certification canary rejects deterministic document-invariant drift", async (contextTest) => {
  const base = validResult();
  const cases = [
    ["internal line boundary", { ...base, text: base.text.replace(". The", ".\nThe") }],
    ["disallowed control", { ...base, text: base.text.replace("notebook", "note\u0000book") }],
  ];
  for (const [name, result] of cases) {
    await contextTest.test(name, async () => {
      const fixture = successfulFixture({
        canaryResponse: apiJson({ result, schema_version: 1 }, 200),
      });
      await assert.rejects(
        verifyTextToLatticeApiProduction({
          fetchImpl: fixture.fetchImpl,
          context,
          now: fixedNow,
          wait: noWait,
        }),
        /did not preserve its required document invariants/u,
      );
    });
  }
});

test("the certification canary rejects count, pass, finding, and status-accounting drift", async (contextTest) => {
  const base = validResult();
  const finding = {
    id: "document-certification",
    passageId: "",
    atomIds: [],
    message: "Certification did not accept the candidate.",
  };
  const cases = [
    ["source word count", { ...base, wordCount: 15 }, /exact source word count/u],
    ["passage batch count", { ...base, batchCount: 0 }, /every supported canary passage batch/u],
    ["verification pass count", { ...base, verificationPasses: 0 }, /supported verification pass count/u],
    ["unresolved finding", { ...base, findings: [finding] }, /unresolved certification findings/u],
    [
      "unmodified translated result",
      { ...base, text: LATTICE_PRODUCTION_CANARY_TEXT },
      /materially revised accounted result/u,
    ],
    [
      "presentation-only translated result",
      { ...base, text: LATTICE_PRODUCTION_CANARY_TEXT.toUpperCase() },
      /materially revised accounted result/u,
    ],
    [
      "translated revision accounting",
      { ...base, passageCount: 2, batchCount: 2 },
      /materially revised accounted result/u,
    ],
    [
      "modified conformant result",
      {
        ...base,
        status: "conformant-for-context",
        revisedPassageCount: 0,
        retainedPassageCount: 1,
      },
      /unchanged conformant accounted result/u,
    ],
    [
      "conformant revision accounting",
      {
        ...base,
        status: "conformant-for-context",
        text: LATTICE_PRODUCTION_CANARY_TEXT,
      },
      /unchanged conformant accounted result/u,
    ],
  ];
  for (const [name, result, expectedFailure] of cases) {
    await contextTest.test(name, async () => {
      const fixture = successfulFixture({
        canaryResponse: apiJson({ result, schema_version: 1 }, 200),
      });
      await assert.rejects(
        verifyTextToLatticeApiProduction({
          fetchImpl: fixture.fetchImpl,
          context,
          now: fixedNow,
          wait: noWait,
        }),
        expectedFailure,
      );
    });
  }
});

test("certification failure diagnostics never reflect candidate or finding content", async (contextTest) => {
  const marker = "PRIVATE-CANARY-RESULT-MUST-NOT-CROSS";
  const base = validResult();
  const cases = [
    {
      name: "candidate",
      result: { ...base, text: `${marker}\u0000\n` },
      expectedFailure: /required document invariants/u,
    },
    {
      name: "finding",
      result: {
        ...base,
        findings: [{
          id: "document-certification",
          passageId: "",
          atomIds: [],
          message: marker,
        }],
      },
      expectedFailure: /unresolved certification findings/u,
    },
  ];
  for (const { name, result, expectedFailure } of cases) {
    await contextTest.test(name, async () => {
      const fixture = successfulFixture({
        canaryResponse: apiJson({ result, schema_version: 1 }, 200),
      });
      await assert.rejects(
        verifyTextToLatticeApiProduction({
          fetchImpl: fixture.fetchImpl,
          context,
          now: fixedNow,
          wait: noWait,
        }),
        (error) => {
          assert.match(error.message, expectedFailure);
          assert.equal(error.message.includes(marker), false);
          assert.equal(JSON.stringify(error).includes(marker), false);
          return true;
        },
      );
    });
  }
});

test("the sanitized preflight callback completes before any transformation canary", async () => {
  const fixture = successfulFixture();
  const stopAfterPreflight = new Error("stop after sanitized preflight");
  let preflightEvidence = null;
  let callbackCalls = 0;

  await assert.rejects(
    verifyTextToLatticeApiProduction({
      fetchImpl: fixture.fetchImpl,
      context,
      now: fixedNow,
      wait: noWait,
      async onPreflightEvidence(evidence) {
        callbackCalls += 1;
        assert.equal(fixture.calls.length, CANARY_FLOW_REQUEST_COUNT - 1);
        assert.equal(fixture.setupRequests, 1);
        assert.equal(
          fixture.negativeRequests,
          LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS.length,
        );
        assert.equal(fixture.canaryRequests, 0);
        preflightEvidence = evidence;
        throw stopAfterPreflight;
      },
    }),
    (error) => error === stopAfterPreflight,
  );

  assert.equal(fixture.canaryRequests, 0);
  assert.equal(callbackCalls, 1);
  assert.equal(preflightEvidence.format, LATTICE_PRODUCTION_PREFLIGHT_EVIDENCE_SCHEMA);
  assert.equal(Object.hasOwn(preflightEvidence, "transformation_canary"), false);
  assert.deepEqual(preflightEvidence.qualification, {
    status: "preflight-only",
    gate_closing: false,
    transformation_canary_performed: false,
    provider_success_observed: false,
  });
  const serialized = JSON.stringify(preflightEvidence);
  const cookieValue = quotaSetCookie.match(/^[^=]+=(?<value>[^;]+)/u)?.groups?.value;
  assert.equal(typeof cookieValue, "string");
  assert.equal(serialized.includes(cookieValue), false);
  assert.doesNotMatch(
    serialized,
    /blue notebook|synthetic-credential|lattice-live-negative-canary/u,
  );
});

test("the evidence writer rejects a relative receipt path", async () => {
  await assert.rejects(
    writeLatticeProductionEvidenceReceipt("preflight-boundary.json", {}),
    /evidence receipt path must be absolute/u,
  );
});

test("active-API readiness settles only after consecutive exact content-free samples", async () => {
  const readinessResponses = [
    new Error("synthetic edge transport failure"),
    heldReadinessResponse(),
    productionActiveReadinessResponse(),
    heldReadinessResponse(),
    productionActiveReadinessResponse(),
    productionActiveReadinessResponse(),
    productionActiveReadinessResponse(),
  ];
  const waits = [];
  const fixture = successfulFixture({ readinessResponses });
  const evidence = await verifyTextToLatticeApiProduction({
    fetchImpl: fixture.fetchImpl,
    context,
    now: fixedNow,
    wait: async (milliseconds) => { waits.push(milliseconds); },
  });

  assert.equal(fixture.readinessRequests, readinessResponses.length);
  assert.equal(waits.length, readinessResponses.length - 1);
  assert.ok(waits.every((milliseconds) => (
    milliseconds === LATTICE_PRODUCTION_READINESS_CONTRACT.intervalMs
  )));
  assert.deepEqual(evidence.deployment_readiness, {
    request_count: 7,
    method: "POST",
    path: "/api/lattice",
    accept: LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT,
    content_type: LATTICE_PRODUCTION_READINESS_CONTENT_TYPE,
    content_type_header_present: true,
    required_consecutive_active_samples: 3,
    observed_consecutive_active_samples: 3,
    active_response_count: 4,
    held_response_count: 2,
    network_error_count: 1,
    final_http_status: 400,
    final_error_code: "invalid_request",
    request_body_present: false,
    request_body_bytes: 0,
    origin_header_present: true,
    cookie_header_present: false,
    visitor_session_created: false,
    quota_claimed: false,
    provider_called: false,
    response_bodies_retained: false,
  });
  assert.equal(fixture.setupRequests, 2);
  assert.equal(fixture.canaryRequests, 1);

  const readinessCalls = fixture.calls.slice(4, 4 + readinessResponses.length);
  assert.equal(readinessCalls.length, readinessResponses.length);
  for (const { url, init } of readinessCalls) {
    assert.equal(url, "https://hah.dev/api/lattice");
    assert.equal(init.method, "POST");
    assert.deepEqual(init.headers, {
      Accept: LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT,
      "Content-Type": LATTICE_PRODUCTION_READINESS_CONTENT_TYPE,
      Origin: "https://hah.dev",
    });
    assert.equal(Object.hasOwn(init, "body"), false);
    assert.equal(init.credentials, "omit");
  }
});

test("active-API readiness exhausts a fixed held window before any cookie, quota, or content request", async () => {
  const readinessResponses = Array.from(
    { length: LATTICE_PRODUCTION_READINESS_CONTRACT.attemptLimit },
    heldReadinessResponse,
  );
  let waits = 0;
  const fixture = successfulFixture({ readinessResponses });
  await assert.rejects(
    verifyTextToLatticeApiProduction({
      fetchImpl: fixture.fetchImpl,
      context,
      now: fixedNow,
      wait: async () => { waits += 1; },
    }),
    /content-free active API boundary did not settle within its fixed readiness window/u,
  );
  assert.equal(fixture.readinessRequests, LATTICE_PRODUCTION_READINESS_CONTRACT.attemptLimit);
  assert.equal(waits, LATTICE_PRODUCTION_READINESS_CONTRACT.attemptLimit - 1);
  assert.equal(fixture.setupRequests, 0);
  assert.equal(fixture.negativeRequests, 0);
  assert.equal(fixture.canaryRequests, 0);
  assert.equal(
    fixture.calls.length,
    4 + LATTICE_PRODUCTION_READINESS_CONTRACT.attemptLimit,
  );
  assert.ok(fixture.calls.slice(4).every(({ init }) => (
    init.method === "POST"
      && !Object.hasOwn(init, "body")
      && init.headers.Accept === LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT
      && init.headers["Content-Type"] === LATTICE_PRODUCTION_READINESS_CONTENT_TYPE
      && init.headers.Origin === "https://hah.dev"
      && Object.keys(init.headers).every((name) => name.toLowerCase() !== "cookie")
  )));
});

test("active-API readiness fails immediately on any non-exact complete response", async (contextTest) => {
  const cases = [
    [
      "unexpected status",
      apiJson({ error: "invalid_request" }, 200),
      /returned HTTP 200; expected the active 400 or held 503 boundary/u,
    ],
    [
      "malformed held headers",
      apiJson({ error: "upstream_unavailable" }, 503),
      /omitted content-security-policy/u,
    ],
    [
      "malformed active envelope",
      apiJson({ error: "upstream_unavailable" }, 400),
      /unexpected closed error envelope/u,
    ],
    [
      "active response mutates visitor state",
      apiJson({ error: "invalid_request" }, 400, { "Set-Cookie": quotaSetCookie }),
      /set an undeclared cookie/u,
    ],
    [
      "oversized active body",
      new Response("x".repeat(4_097), {
        status: 400,
        headers: apiHeaders,
      }),
      /exceeded its response-size boundary/u,
    ],
  ];
  for (const [name, readinessResponse, expectedFailure] of cases) {
    await contextTest.test(name, async () => {
      let waits = 0;
      const fixture = successfulFixture({ readinessResponses: [readinessResponse] });
      await assert.rejects(
        verifyTextToLatticeApiProduction({
          fetchImpl: fixture.fetchImpl,
          context,
          now: fixedNow,
          wait: async () => { waits += 1; },
        }),
        expectedFailure,
      );
      assert.equal(fixture.readinessRequests, 1);
      assert.equal(waits, 0);
      assert.equal(fixture.setupRequests, 0);
      assert.equal(fixture.negativeRequests, 0);
      assert.equal(fixture.canaryRequests, 0);
      assert.equal(fixture.calls.length, 5);
    });
  }
});

test("the wrong-query probe verifies exact route exclusion as a non-API 405", async () => {
  const fixture = successfulFixture();
  let wrongQueryResponseBody = null;
  const evidence = await verifyTextToLatticeApiProduction({
    async fetchImpl(url, init) {
      const response = await fixture.fetchImpl(url, init);
      if (`${url}` === "https://hah.dev/api/lattice?undeclared=1") {
        assert.equal(response.status, 405);
        wrongQueryResponseBody = await response.clone().text();
      }
      return response;
    },
    context,
    now: fixedNow,
    wait: noWait,
  });
  const probeIndex = LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS.indexOf("wrong-query");
  assert.notEqual(probeIndex, -1);
  assert.deepEqual(LATTICE_PRODUCTION_NEGATIVE_PROBE_CONTRACT[probeIndex], {
    id: "wrong-query",
    status: 405,
    error: null,
    apiJson: false,
    allow: null,
  });

  const call = fixture.calls[
    5
      + LATTICE_PRODUCTION_READINESS_CONTRACT.requiredConsecutiveActiveSamples
      + probeIndex
  ];
  assert.equal(call.url, "https://hah.dev/api/lattice?undeclared=1");
  assert.equal(call.init.method, "POST");
  assert.deepEqual(JSON.parse(call.init.body), {
    text: "lattice-live-negative-canary-2026-09-14",
    requested_mode: "operative",
    schema_version: 1,
  });

  const outcome = evidence.negative_probes.outcomes[probeIndex];
  const { elapsed_ms: elapsed, response_bytes: responseBytes, ...stableOutcome } = outcome;
  assert.deepEqual(stableOutcome, {
    id: "wrong-query",
    status: 405,
    api_json: false,
  });
  assert.ok(Number.isSafeInteger(elapsed) && elapsed >= 0);
  assert.ok(responseBytes > 0);
  assert.equal(typeof wrongQueryResponseBody, "string");
  assert.doesNotMatch(
    wrongQueryResponseBody,
    /lattice-live-negative-canary-2026-09-14/u,
  );
  assert.equal(fixture.setupRequests, 2);
  assert.equal(fixture.canaryRequests, 1);
});

test("a failed transformation canary retains only sanitized non-qualifying preflight evidence", async (contextTest) => {
  const receiptDirectory = await mkdtemp(join(tmpdir(), "lattice-preflight-"));
  contextTest.after(async () => rm(receiptDirectory, { recursive: true, force: true }));
  const preflightPath = join(receiptDirectory, "preflight-boundary.json");
  const privateProviderDetail = "PRIVATE-PROVIDER-DETAIL-MUST-NOT-CROSS";
  const fixture = successfulFixture({
    canaryResponse: apiJson(
      { error: "upstream_unavailable" },
      502,
      {
        ...qualificationDiagnosticHeaders(),
        "X-Private-Provider-Diagnostic": privateProviderDetail,
      },
    ),
  });
  const events = [];
  await assert.rejects(
    verifyTextToLatticeApiProduction({
      async fetchImpl(url, init) {
        const canaryRequestsBefore = fixture.canaryRequests;
        const response = await fixture.fetchImpl(url, init);
        if (fixture.canaryRequests > canaryRequestsBefore) events.push("canary");
        return response;
      },
      context,
      now: fixedNow,
      wait: noWait,
      async onPreflightEvidence(evidence) {
        events.push("preflight");
        await writeLatticeProductionEvidenceReceipt(preflightPath, evidence);
      },
    }),
    /synthetic transformation canary returned HTTP 502 \(upstream_unavailable\); failure_class=provider_http_error; upstream_status=503; stage=analysis; call_ordinal=1; subtype=none; finish_reason=none; request_size=4097-16384; response_size=none; content_size=none; completion_tokens=none; stage_attempt=initial; analysis_origin=initial; analysis_attempt=1; prior_validation=none/u,
  );
  assert.equal(fixture.canaryRequests, 1);
  assert.equal(fixture.setupRequests, 1);
  assert.equal(fixture.calls.length, CANARY_FLOW_REQUEST_COUNT);
  assert.deepEqual(events, ["preflight", "canary"]);

  const serialized = await readFile(preflightPath, "utf8");
  const digestReceipt = await readFile(`${preflightPath}.sha256`, "utf8");
  const evidence = JSON.parse(serialized);
  assert.equal(evidence.format, LATTICE_PRODUCTION_PREFLIGHT_EVIDENCE_SCHEMA);
  assert.equal(Object.hasOwn(evidence, "transformation_canary"), false);
  assert.deepEqual(evidence.qualification, {
    status: "preflight-only",
    gate_closing: false,
    transformation_canary_performed: false,
    provider_success_observed: false,
  });
  assert.equal(
    digestReceipt,
    `${createHash("sha256").update(serialized).digest("hex")}  preflight-boundary.json\n`,
  );
  const cookieValue = quotaSetCookie.match(/^[^=]+=(?<value>[^;]+)/u)?.groups?.value;
  assert.equal(typeof cookieValue, "string");
  assert.equal(serialized.includes(quotaSetCookie), false);
  assert.equal(serialized.includes(cookieValue), false);
  assert.equal(serialized.includes(privateProviderDetail), false);
  assert.doesNotMatch(
    serialized,
    /blue notebook|synthetic-credential|lattice-live-negative-canary/u,
  );
});

test("the canary rejects absent, partial, malformed, or success diagnostics without reflecting values", async (contextTest) => {
  const privateMarker = "PRIVATE-DIAGNOSTIC-MARKER-MUST-NOT-CROSS";
  const exactDiagnostic = qualificationDiagnosticHeaders();
  const cases = [
    ["absent", {}, /without a qualification diagnostic/u, 502],
    [
      "partial",
      { [LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.failureClass]: "provider_http_error" },
      /incomplete qualification diagnostic/u,
      502,
    ],
    [
      "failure class",
      { ...exactDiagnostic, [LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.failureClass]: privateMarker },
      /invalid qualification diagnostic/u,
      502,
    ],
    [
      "upstream status",
      { ...exactDiagnostic, [LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.upstreamStatus]: "399" },
      /invalid qualification diagnostic/u,
      502,
    ],
    [
      "stage",
      { ...exactDiagnostic, [LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.stage]: privateMarker },
      /invalid qualification diagnostic/u,
      502,
    ],
    [
      "ordinal",
      { ...exactDiagnostic, [LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.callOrdinal]: "33" },
      /invalid qualification diagnostic/u,
      502,
    ],
    [
      "subtype",
      qualificationDiagnosticHeaders({ subtype: privateMarker }),
      /invalid qualification diagnostic/u,
      502,
    ],
    [
      "size bucket",
      qualificationDiagnosticHeaders({ requestSize: "4096-ish" }),
      /invalid qualification diagnostic/u,
      502,
    ],
    [
      "stage attempt",
      qualificationDiagnosticHeaders({ stageAttempt: "retry" }),
      /invalid qualification diagnostic/u,
      502,
    ],
    [
      "initial attempt prior validation",
      qualificationDiagnosticHeaders({ priorValidationCategory: "response-shape" }),
      /invalid qualification diagnostic/u,
      502,
    ],
    [
      "correction attempt missing prior validation",
      qualificationDiagnosticHeaders({ stageAttempt: "correction" }),
      /invalid qualification diagnostic/u,
      502,
    ],
    [
      "analysis attempt",
      qualificationDiagnosticHeaders({ analysisAttempt: "3" }),
      /invalid qualification diagnostic/u,
      502,
    ],
    [
      "missing prior validation",
      qualificationDiagnosticHeaders({
        stageAttempt: "correction",
        analysisAttempt: "2",
      }),
      /invalid qualification diagnostic/u,
      502,
    ],
    [
      "inconsistent output limit",
      qualificationDiagnosticHeaders({
        failureClass: "provider_output_limit",
        finishReason: "stop",
      }),
      /invalid qualification diagnostic/u,
      502,
    ],
    [
      "non-analysis initial attempt",
      qualificationDiagnosticHeaders({
        stage: "candidate",
        analysisOrigin: "none",
        analysisAttempt: "none",
      }),
      /returned HTTP 502 \(upstream_unavailable\); .*stage=candidate; .*stage_attempt=initial; analysis_origin=none; analysis_attempt=none; prior_validation=none/u,
      502,
    ],
    [
      "non-analysis correction attempt",
      qualificationDiagnosticHeaders({
        stage: "verification",
        stageAttempt: "correction",
        analysisOrigin: "none",
        analysisAttempt: "none",
        priorValidationCategory: "response-shape",
      }),
      /returned HTTP 502 \(upstream_unavailable\); .*stage=verification; .*stage_attempt=correction; analysis_origin=none; analysis_attempt=none; prior_validation=response-shape/u,
      502,
    ],
    [
      "non-analysis analysis origin",
      qualificationDiagnosticHeaders({ stage: "candidate" }),
      /invalid qualification diagnostic/u,
      502,
    ],
    ["success", exactDiagnostic, /qualification diagnostic on success/u, 200],
  ];
  for (const [name, headers, expected, status] of cases) {
    await contextTest.test(name, async () => {
      const body = status === 200
        ? { result: validResult(), schema_version: 1 }
        : { error: "upstream_unavailable" };
      const fixture = successfulFixture({ canaryResponse: apiJson(body, status, headers) });
      let failure;
      try {
        await verifyTextToLatticeApiProduction({
          fetchImpl: fixture.fetchImpl,
          context,
          now: fixedNow,
          wait: noWait,
        });
      } catch (error) {
        failure = error;
      }
      assert.ok(failure instanceof Error);
      assert.match(failure.message, expected);
      assert.equal(failure.message.includes(privateMarker), false);
      assert.equal(fixture.canaryRequests, 1);
      assert.equal(fixture.setupRequests, 1);
      assert.equal(fixture.calls.length, CANARY_FLOW_REQUEST_COUNT);
    });
  }
});

test("provider envelope codes reject impossible stage or finish provenance", async (contextTest) => {
  const base = { failureClass: "provider_malformed_response", upstreamStatus: "none", stage: "verification",
    subtype: "E06", finishReason: "stop", analysisOrigin: "none", analysisAttempt: "none" };
  const cases = [
    ["named predicate", {}, /subtype=E06; finish_reason=stop/u],
    ["stopped predicate", { subtype: "S02" }, /subtype=S02; finish_reason=stop/u],
    ["literal null predicate", { subtype: "S02N" }, /subtype=S02N; finish_reason=stop/u],
    ["null wrong stage", { subtype: "S02N", stage: "analysis", analysisOrigin: "initial", analysisAttempt: "1" }, /invalid qualification diagnostic/u],
    ["null wrong finish", { subtype: "S02N", finishReason: "tool_calls" }, /invalid qualification diagnostic/u],
    ["wrong stage", { stage: "analysis", analysisOrigin: "initial", analysisAttempt: "1" }, /invalid qualification diagnostic/u],
    ["wrong stopped finish", { subtype: "S01" }, /invalid qualification diagnostic/u],
    ["wrong collection finish", { subtype: "S02", finishReason: "tool_calls" }, /invalid qualification diagnostic/u],
    ["absent native finish", { finishReason: "none" }, /invalid qualification diagnostic/u],
    ["unreachable disabled compatibility", { subtype: "S00" }, /invalid qualification diagnostic/u],
  ];
  for (const [name, overrides, expected] of cases) {
    await contextTest.test(name, async () => {
      const fixture = successfulFixture({ canaryResponse: apiJson({ error: "malformed_upstream_response" }, 502,
        qualificationDiagnosticHeaders({ ...base, ...overrides })) });
      let failure;
      try { await verifyTextToLatticeApiProduction({ fetchImpl: fixture.fetchImpl, context, now: fixedNow, wait: noWait }); }
      catch (error) { failure = error; }
      assert.ok(failure instanceof Error);
      assert.match(failure.message, expected);
      assert.equal(fixture.canaryRequests, 1);
    });
  }
});

test("an unable canary reports only an allowlisted homogeneous failure class and safe counts", async (contextTest) => {
  const cases = [
    ["atomization-unavailable", "pre-candidate-analysis-contract"],
    ["generation-context-unavailable", "pre-candidate-generation-context"],
    ["generation-unavailable", "pre-candidate-generation-contract"],
    ["candidate-withheld", "post-candidate-withheld"],
  ];
  for (const [findingId, expectedClass] of cases) {
    await contextTest.test(findingId, async () => {
      const privateMarker = `PRIVATE-${findingId}-DETAIL`;
      const fixture = successfulFixture({
        canaryResponse: apiJson({
          result: unableResult([
            { id: findingId, passageId: "p001", atomIds: [], message: privateMarker },
            { id: findingId, passageId: "p002", atomIds: [], message: privateMarker },
          ], { batchCount: 2, passageCount: 2 }),
          schema_version: 1,
        }, 200, findingId === "atomization-unavailable"
          ? terminalAnalysisDiagnosticHeaders()
          : findingId === "candidate-withheld" ? withheldDiagnosticHeaders() : {}),
      });
      let failure;
      try {
        await verifyTextToLatticeApiProduction({
          fetchImpl: fixture.fetchImpl,
          context,
          now: fixedNow,
          wait: noWait,
        });
      } catch (error) {
        failure = error;
      }
      assert.ok(failure instanceof Error);
      if (findingId === "atomization-unavailable") {
        assert.match(
          failure.message,
          /class=pre-candidate-analysis-contract; terminal_cause=host-validation; validation=evidence; prior_validation=passage-coverage; analysis_origin=split; analysis_attempt=2; atom_limit=6; call_ordinal=4; batch_count=2; verification_passes=0; finding_count=2/u,
        );
      } else if (findingId === "candidate-withheld") {
        assert.match(failure.message, /class=post-candidate-withheld; revision=coherent; deterministic=clear; verification=unavailable; first_deterministic_rule=none; certification=not-reached; terminal_failure=host-validation; stage=verification; attempt=2; validation=response-shape; prior_validation=evidence; rejection_boundary=wire-decoder; rejection_category=field-set; rejection_rule=V01F; prior_rejection_boundary=host-normalizer; prior_rejection_category=other; prior_rejection_rule=unknown; calls_used=4; batch_count=2; verification_passes=0; finding_count=2/u);
      } else {
        assert.match(
          failure.message,
          new RegExp(`class=${expectedClass}; batch_count=2; verification_passes=0; finding_count=2`, "u"),
        );
      }
      assert.equal(failure.message.includes(privateMarker), false);
      assert.equal(fixture.canaryRequests, 1);
      assert.equal(fixture.setupRequests, 1);
      assert.equal(fixture.calls.length, CANARY_FLOW_REQUEST_COUNT);
    });
  }
});

test("terminal analysis diagnostics are complete, allowlisted, and confined to analysis unable results", async (contextTest) => {
  const privateMarker = "PRIVATE-TERMINAL-DIAGNOSTIC-MUST-NOT-CROSS";
  const exactTerminal = terminalAnalysisDiagnosticHeaders();
  const atomizationBody = {
    result: unableResult([
      { id: "atomization-unavailable", passageId: "p001", atomIds: [], message: "fixed" },
    ]),
    schema_version: 1,
  };
  const planningTerminal = terminalAnalysisDiagnosticHeaders({
    cause: "planning",
    validationCategory: "none",
    priorValidationCategory: "none",
    origin: "none",
    attempt: "none",
    atomLimit: "none",
    callOrdinal: "0",
  });
  const invalidSemanticDiagnostics = [
    ["planning validation", { ...planningTerminal,
      [LATTICE_QUALIFICATION_TERMINAL_ANALYSIS_DIAGNOSTIC_RESPONSE_HEADERS.validationCategory]:
        "evidence" }],
    ["planning prior validation", { ...planningTerminal,
      [LATTICE_QUALIFICATION_TERMINAL_ANALYSIS_DIAGNOSTIC_RESPONSE_HEADERS.priorValidationCategory]:
        "evidence" }],
    ["planning origin", { ...planningTerminal,
      [LATTICE_QUALIFICATION_TERMINAL_ANALYSIS_DIAGNOSTIC_RESPONSE_HEADERS.origin]: "split" }],
    ["planning attempt", { ...planningTerminal,
      [LATTICE_QUALIFICATION_TERMINAL_ANALYSIS_DIAGNOSTIC_RESPONSE_HEADERS.attempt]: "1" }],
    ["non-planning validation", terminalAnalysisDiagnosticHeaders({ validationCategory: "none" })],
    ["non-planning origin", terminalAnalysisDiagnosticHeaders({ origin: "none" })],
    ["non-planning attempt", terminalAnalysisDiagnosticHeaders({ attempt: "none" })],
    ["non-planning atom limit", terminalAnalysisDiagnosticHeaders({ atomLimit: "none" })],
    ["first-attempt prior validation", terminalAnalysisDiagnosticHeaders({
      cause: "output-limit",
      validationCategory: "capacity",
      attempt: "1",
    })],
    ["second-attempt missing prior validation", terminalAnalysisDiagnosticHeaders({
      priorValidationCategory: "none",
    })],
    ["first-attempt host validation", terminalAnalysisDiagnosticHeaders({
      attempt: "1",
      priorValidationCategory: "none",
    })],
    ["output-limit validation", terminalAnalysisDiagnosticHeaders({ cause: "output-limit" })],
    ["context-capacity validation", terminalAnalysisDiagnosticHeaders({
      cause: "context-capacity",
    })],
  ];
  const cases = [
    [
      "valid planning",
      atomizationBody,
      200,
      planningTerminal,
      /terminal_cause=planning; validation=none; prior_validation=none; analysis_origin=none; analysis_attempt=none; atom_limit=none; call_ordinal=0/u,
    ],
    ["absent", atomizationBody, 200, {}, /without a terminal analysis diagnostic/u],
    [
      "partial",
      atomizationBody,
      200,
      {
        [LATTICE_QUALIFICATION_TERMINAL_ANALYSIS_DIAGNOSTIC_RESPONSE_HEADERS.cause]:
          "host-validation",
      },
      /incomplete terminal analysis diagnostic/u,
    ],
    [
      "hostile cause",
      atomizationBody,
      200,
      terminalAnalysisDiagnosticHeaders({ cause: privateMarker }),
      /invalid terminal analysis diagnostic/u,
    ],
    [
      "invalid ordinal",
      atomizationBody,
      200,
      terminalAnalysisDiagnosticHeaders({ callOrdinal: "33" }),
      /invalid terminal analysis diagnostic/u,
    ],
    [
      "translated",
      { result: validResult(), schema_version: 1 },
      200,
      exactTerminal,
      /terminal analysis diagnostic on success/u,
    ],
    [
      "other unable",
      {
        result: unableResult([
          { id: "generation-unavailable", passageId: "p001", atomIds: [], message: "fixed" },
        ]),
        schema_version: 1,
      },
      200,
      exactTerminal,
      /terminal analysis diagnostic on an incompatible unable result/u,
    ],
    [
      "provider error",
      { error: "upstream_unavailable" },
      502,
      { ...qualificationDiagnosticHeaders(), ...exactTerminal },
      /terminal analysis diagnostic on a non-success response/u,
    ],
    ...invalidSemanticDiagnostics.map(([name, headers]) => [
      name,
      atomizationBody,
      200,
      headers,
      /invalid terminal analysis diagnostic/u,
    ]),
  ];
  for (const [name, body, status, headers, expected] of cases) {
    await contextTest.test(name, async () => {
      const fixture = successfulFixture({
        canaryResponse: apiJson(body, status, headers),
      });
      let failure;
      try {
        await verifyTextToLatticeApiProduction({
          fetchImpl: fixture.fetchImpl,
          context,
          now: fixedNow,
          wait: noWait,
        });
      } catch (error) {
        failure = error;
      }
      assert.ok(failure instanceof Error);
      assert.match(failure.message, expected);
      assert.equal(failure.message.includes(privateMarker), false);
      assert.equal(fixture.canaryRequests, 1);
      assert.equal(fixture.setupRequests, 1);
      assert.equal(fixture.calls.length, CANARY_FLOW_REQUEST_COUNT);
    });
  }
});

test("mixed or unknown unable findings remain unclassified without leaking hostile result content", async (contextTest) => {
  const hostileId = "HOSTILE-RESULT-ID-DO-NOT-RETAIN";
  const hostileMessage = "HOSTILE-RESULT-MESSAGE-DO-NOT-RETAIN";
  const cases = [
    [
      "mixed",
      [
        { id: "atomization-unavailable", passageId: "p001", atomIds: [], message: "fixed" },
        { id: hostileId, passageId: "p001", atomIds: [], message: hostileMessage },
      ],
    ],
    [
      "unknown homogeneous",
      [
        { id: hostileId, passageId: "p001", atomIds: [], message: hostileMessage },
        { id: hostileId, passageId: "p002", atomIds: [], message: hostileMessage },
      ],
    ],
    ["empty", []],
  ];
  for (const [name, findings] of cases) {
    await contextTest.test(name, async () => {
      const fixture = successfulFixture({
        canaryResponse: apiJson({
          result: unableResult(findings, { batchCount: 2, passageCount: 2 }),
          schema_version: 1,
        }, 200),
      });
      let failure;
      try {
        await verifyTextToLatticeApiProduction({
          fetchImpl: fixture.fetchImpl,
          context,
          now: fixedNow,
          wait: noWait,
        });
      } catch (error) {
        failure = error;
      }
      assert.ok(failure instanceof Error);
      assert.match(
        failure.message,
        new RegExp(`class=unclassified-unable; batch_count=2; verification_passes=0; finding_count=${findings.length}`, "u"),
      );
      assert.equal(failure.message.includes(hostileId), false);
      assert.equal(failure.message.includes(hostileMessage), false);
      assert.equal(fixture.canaryRequests, 1);
      assert.equal(fixture.setupRequests, 1);
      assert.equal(fixture.calls.length, CANARY_FLOW_REQUEST_COUNT);
    });
  }
});

test("the bodyless setup requires only the exact value-free browser quota cookie metadata", async () => {
  for (const setCookie of [
    null,
    quotaSetCookie.replace("; HttpOnly", ""),
    `${quotaSetCookie}; Domain=hah.dev`,
    quotaSetCookie.replace("Max-Age=41104", "Max-Age=86401"),
    quotaSetCookie.replace("SameSite=Strict", "SameSite=Lax"),
  ]) {
    const fixture = successfulFixture({
      setupResponse: new Response(null, {
        status: 204,
        headers: {
          ...setupApiHeaders,
          ...(setCookie === null ? {} : { "Set-Cookie": setCookie }),
        },
      }),
    });
    await assert.rejects(
      verifyTextToLatticeApiProduction({
        fetchImpl: fixture.fetchImpl,
        context,
        now: fixedNow,
        wait: noWait,
      }),
      /browser quota cookie/u,
    );
    assert.equal(fixture.setupRequests, 1);
    assert.equal(fixture.canaryRequests, 0);
  }
});

test("a setup-time 503 is validated and classified as the exact held boundary", async () => {
  const fixture = successfulFixture({ setupResponse: heldReadinessResponse() });
  await assert.rejects(
    verifyTextToLatticeApiProduction({
      fetchImpl: fixture.fetchImpl,
      context,
      now: fixedNow,
      wait: noWait,
    }),
    /reached the exact held API boundary after active readiness; expected 204/u,
  );
  assert.equal(fixture.readinessRequests, 3);
  assert.equal(fixture.setupRequests, 1);
  assert.equal(fixture.negativeRequests, 0);
  assert.equal(fixture.canaryRequests, 0);
});

test("the transformation response cannot rotate the setup cookie", async () => {
  const fixture = successfulFixture({
    canaryResponse: apiJson(
      { result: validResult(), schema_version: 1 },
      200,
      { "Set-Cookie": quotaSetCookie },
    ),
  });
  await assert.rejects(
    verifyTextToLatticeApiProduction({
      fetchImpl: fixture.fetchImpl,
      context,
      now: fixedNow,
      wait: noWait,
    }),
    /set an undeclared cookie/u,
  );
  assert.equal(fixture.setupRequests, 1);
  assert.equal(fixture.canaryRequests, 1);
});

const heldDeploymentStatus = Object.freeze({
  id: "deployment-held-123",
  created_on: "2026-09-14T12:35:00.000Z",
  versions: Object.freeze([Object.freeze({
    version_id: "123e4567-e89b-42d3-a456-426614174000",
    percentage: 100,
  })]),
});

const heldWorkflowEnvironment = Object.freeze({
  GITHUB_REPOSITORY: context.repository,
  GITHUB_SHA: context.commit,
  GITHUB_RUN_ID: context.runId,
  GITHUB_RUN_ATTEMPT: context.runAttempt,
  GITHUB_SERVER_URL: context.serverUrl,
});

test("the held readiness contract mirrors the active propagation envelope", () => {
  assert.deepEqual(LATTICE_HELD_API_READINESS_CONTRACT, {
    attemptLimit: 18,
    deadlineMs: 45_000,
    intervalMs: 2_000,
    requestTimeoutMs: 7_000,
    requiredConsecutiveHeldSamples: 3,
  });
});

test("the rollback verifier binds one held Worker version to three bounded public 503 samples without content evidence", async () => {
  let calls = 0;
  const evidence = await verifyTextToLatticeHeldApi({
    deploymentStatus: heldDeploymentStatus,
    environment: heldWorkflowEnvironment,
    wait: noWait,
    now: fixedNow,
    async fetchImpl(url, init) {
      calls += 1;
      assert.equal(url, "https://hah.dev/api/lattice");
      assert.equal(init.method, "GET");
      assert.deepEqual(init.headers, { Accept: "application/json" });
      assert.equal(init.cache, "no-store");
      assert.equal(init.credentials, "omit");
      assert.equal(init.redirect, "error");
      assert.equal(init.referrerPolicy, "no-referrer");
      assert.equal("body" in init, false);
      assert.ok(init.signal instanceof AbortSignal);
      return heldReadinessResponse();
    },
  });
  assert.equal(calls, LATTICE_HELD_API_READINESS_CONTRACT.requiredConsecutiveHeldSamples);
  assert.equal(evidence.format, "TEXT_TO_LATTICE_HELD_ROLLBACK_EVIDENCE");
  assert.equal(evidence.worker.versionId, "123e4567-e89b-42d3-a456-426614174000");
  assert.equal(evidence.attemptCount, 3);
  assert.deepEqual(evidence.readiness, {
    requestCount: 3,
    requiredConsecutiveHeldSamples: 3,
    observedConsecutiveHeldSamples: 3,
    heldResponseCount: 3,
    activeResponseCount: 0,
    networkErrorCount: 0,
  });
  assert.equal(evidence.boundary.httpStatus, 503);
  assert.equal(evidence.boundary.errorCode, "upstream_unavailable");
  assert.equal(evidence.contentBodiesRetained, false);
  assert.equal(evidence.secretValuesRead, false);
});

test("the rollback verifier waits through the observed run-102 propagation sequence", async () => {
  let calls = 0;
  const waits = [];
  const evidence = await verifyTextToLatticeHeldApi({
    deploymentStatus: heldDeploymentStatus,
    environment: heldWorkflowEnvironment,
    async wait(milliseconds) {
      waits.push(milliseconds);
    },
    now: fixedNow,
    async fetchImpl() {
      calls += 1;
      return calls <= 14 ? activeReadinessResponse() : heldReadinessResponse();
    },
  });
  assert.equal(calls, 17);
  assert.equal(waits.length, 16);
  assert.ok(waits.every((milliseconds) => (
    milliseconds === LATTICE_HELD_API_READINESS_CONTRACT.intervalMs
  )));
  assert.equal(evidence.attemptCount, 17);
  assert.deepEqual(evidence.readiness, {
    requestCount: 17,
    requiredConsecutiveHeldSamples: 3,
    observedConsecutiveHeldSamples: 3,
    heldResponseCount: 3,
    activeResponseCount: 14,
    networkErrorCount: 0,
  });
  assert.equal(evidence.boundary.httpStatus, 503);
});

test("the rollback verifier resets held settlement after an exact active observation", async () => {
  let calls = 0;
  const dispositions = ["held", "held", "active", "held", "held", "held"];
  const evidence = await verifyTextToLatticeHeldApi({
    deploymentStatus: heldDeploymentStatus,
    environment: heldWorkflowEnvironment,
    wait: noWait,
    now: fixedNow,
    async fetchImpl() {
      const disposition = dispositions[calls];
      calls += 1;
      return disposition === "active" ? activeReadinessResponse() : heldReadinessResponse();
    },
  });
  assert.equal(calls, 6);
  assert.equal(evidence.attemptCount, 6);
  assert.equal(evidence.readiness.observedConsecutiveHeldSamples, 3);
  assert.equal(evidence.readiness.heldResponseCount, 5);
  assert.equal(evidence.readiness.activeResponseCount, 1);
});

test("the rollback verifier resets held settlement after a transient network failure", async () => {
  let calls = 0;
  const evidence = await verifyTextToLatticeHeldApi({
    deploymentStatus: heldDeploymentStatus,
    environment: heldWorkflowEnvironment,
    wait: noWait,
    now: fixedNow,
    async fetchImpl() {
      calls += 1;
      if (calls === 3) throw new Error("synthetic network failure");
      return heldReadinessResponse();
    },
  });
  assert.equal(calls, 6);
  assert.equal(evidence.readiness.heldResponseCount, 5);
  assert.equal(evidence.readiness.activeResponseCount, 0);
  assert.equal(evidence.readiness.networkErrorCount, 1);
});

test("the rollback verifier fails closed on a malformed held readiness response", async () => {
  let calls = 0;
  await assert.rejects(
    verifyTextToLatticeHeldApi({
      deploymentStatus: heldDeploymentStatus,
      environment: heldWorkflowEnvironment,
      wait: noWait,
      async fetchImpl() {
        calls += 1;
        if (calls === 3) return heldReadinessResponse({ "Set-Cookie": "unexpected=true" });
        return heldReadinessResponse();
      },
    }),
    /cross-origin or cookie surface/u,
  );
  assert.equal(calls, 3);
});

test("the rollback verifier immediately rejects other non-exact complete readiness responses", async (t) => {
  for (const fixture of [
    {
      label: "malformed active Allow header",
      response: () => activeReadinessResponse({ Allow: "GET" }),
      pattern: /invalid Allow header/u,
    },
    {
      label: "missing held CSP",
      response: () => heldReadinessResponse({ "Content-Security-Policy": "" }),
      pattern: /invalid content-security-policy/u,
    },
    {
      label: "wrong held envelope",
      response: () => apiJson({ error: "invalid_request" }, 503, {
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      }),
      pattern: /invalid error envelope/u,
    },
  ]) {
    await t.test(fixture.label, async () => {
      let calls = 0;
      await assert.rejects(
        verifyTextToLatticeHeldApi({
          deploymentStatus: heldDeploymentStatus,
          environment: heldWorkflowEnvironment,
          wait: noWait,
          async fetchImpl() {
            calls += 1;
            return fixture.response();
          },
        }),
        fixture.pattern,
      );
      assert.equal(calls, 1);
    });
  }
});

test("the rollback verifier cancels a streamed response at its byte boundary", async () => {
  let pulls = 0;
  let cancelled = false;
  await assert.rejects(
    verifyTextToLatticeHeldApi({
      deploymentStatus: heldDeploymentStatus,
      environment: heldWorkflowEnvironment,
      wait: noWait,
      async fetchImpl() {
        return new Response(new ReadableStream({
          pull(controller) {
            pulls += 1;
            controller.enqueue(new Uint8Array(2_048).fill(0x20));
            if (pulls === 10) controller.close();
          },
          cancel() {
            cancelled = true;
          },
        }), {
          status: 503,
          headers: {
            ...apiHeaders,
            "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
          },
        });
      },
    }),
    /exceeded its size boundary/u,
  );
  assert.equal(cancelled, true);
  assert.ok(pulls < 10);
});

test("the rollback verifier exhausts its fixed propagation window without accepting the active boundary", async () => {
  let calls = 0;
  const waits = [];
  await assert.rejects(
    verifyTextToLatticeHeldApi({
      deploymentStatus: heldDeploymentStatus,
      environment: heldWorkflowEnvironment,
      async wait(milliseconds) {
        waits.push(milliseconds);
      },
      async fetchImpl() {
        calls += 1;
        return activeReadinessResponse();
      },
    }),
    /did not settle within its fixed readiness window/u,
  );
  assert.equal(calls, LATTICE_HELD_API_READINESS_CONTRACT.attemptLimit);
  assert.equal(waits.length, LATTICE_HELD_API_READINESS_CONTRACT.attemptLimit - 1);
  assert.ok(waits.every((milliseconds) => (
    milliseconds === LATTICE_HELD_API_READINESS_CONTRACT.intervalMs
  )));
});

test("the rollback verifier stops at its absolute readiness deadline", async () => {
  let calls = 0;
  const waits = [];
  const clockValues = [0, 0, 0, LATTICE_HELD_API_READINESS_CONTRACT.deadlineMs];
  await assert.rejects(
    verifyTextToLatticeHeldApi({
      deploymentStatus: heldDeploymentStatus,
      environment: heldWorkflowEnvironment,
      async wait(milliseconds) {
        waits.push(milliseconds);
      },
      monotonicNow() {
        return clockValues.shift() ?? LATTICE_HELD_API_READINESS_CONTRACT.deadlineMs;
      },
      async fetchImpl() {
        calls += 1;
        return activeReadinessResponse();
      },
    }),
    /did not settle within its fixed readiness window/u,
  );
  assert.equal(calls, 1);
  assert.deepEqual(waits, [LATTICE_HELD_API_READINESS_CONTRACT.intervalMs]);
});

test("the rollback verifier cannot accept a final held sample that completes at the deadline", async () => {
  let calls = 0;
  const deadline = LATTICE_HELD_API_READINESS_CONTRACT.deadlineMs;
  const clockValues = [0, 0, 0, 0, 0, 0, deadline];
  await assert.rejects(
    verifyTextToLatticeHeldApi({
      deploymentStatus: heldDeploymentStatus,
      environment: heldWorkflowEnvironment,
      wait: noWait,
      monotonicNow() {
        return clockValues.shift() ?? deadline;
      },
      async fetchImpl() {
        calls += 1;
        return heldReadinessResponse();
      },
    }),
    /did not settle within its fixed readiness window/u,
  );
  assert.equal(calls, 3);
});

test("the rollback verifier rejects invalid dependencies and clocks before any public request", async () => {
  let calls = 0;
  const baseOptions = {
    deploymentStatus: heldDeploymentStatus,
    environment: heldWorkflowEnvironment,
    wait: noWait,
    async fetchImpl() {
      calls += 1;
      return heldReadinessResponse();
    },
  };
  for (const overrides of [
    { wait: null },
    { fetchImpl: null },
    { now: null },
    { monotonicNow: null },
  ]) {
    await assert.rejects(
      verifyTextToLatticeHeldApi({ ...baseOptions, ...overrides }),
      TypeError,
    );
  }
  await assert.rejects(
    verifyTextToLatticeHeldApi({ ...baseOptions, monotonicNow: () => Number.NaN }),
    /readiness clock/u,
  );
  await assert.rejects(
    verifyTextToLatticeHeldApi({
      ...baseOptions,
      monotonicNow: (() => {
        const values = [10, 9];
        return () => values.shift() ?? 9;
      })(),
    }),
    /moved backwards/u,
  );
  assert.equal(calls, 0);
});

test("the held entry preserves the Durable Object export and has no provider path", async () => {
  const source = await readFile(
    new URL("../workers/text-to-lattice-api/held.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /export \{ LatticeTransformationBudget \} from "\.\/capacityGate\.js"/u);
  assert.match(source, /status: 503/u);
  assert.match(source, /"Cache-Control": "no-store"/u);
  assert.match(source, /"X-Content-Type-Options": "nosniff"/u);
  assert.doesNotMatch(source, /huggingface|HF_TOKEN|globalThis\.fetch|await\s+fetch/iu);
});

test("withheld canary diagnostics fail closed on missing, hostile, or incompatible terminal observations", async (contextTest) => {
  const privateMarker = "PRIVATE-WITHHELD-DIAGNOSTIC-MUST-NOT-CROSS";
  const body = { result: unableResult([{ id: "candidate-withheld", passageId: "", atomIds: [], message: privateMarker }]), schema_version: 1 };
  const exact = withheldDiagnosticHeaders();
  const withoutPipeline = Object.fromEntries(Object.entries(exact)
    .filter(([header]) => !header.toLowerCase().startsWith("x-lattice-qualification-pipeline-")));
  const cases = [
    ["pipeline retry and lineage", body, 200, { ...exact, ...pipelineDiagnosticHeaders({ retryPath: "regeneration", candidateLineage: "initial", initialDeterministic: "d14-only" }) }, /retry_path=regeneration; candidate_lineage=initial; initial_deterministic=d14-only/u],
    ["successful correction stage", body, 200, { ...exact, ...pipelineDiagnosticHeaders({ retryPath: "repair", successfulCorrectionStage: "repair" }) }, /successful_correction_stage=repair/u],
    ["retention downgrade observed", body, 200, { ...exact, ...pipelineDiagnosticHeaders({ initialRetentionDowngrade: "present" }) }, /initial_retention_downgrade=present/u],
    ["historical v16 four-field group", body, 200, Object.fromEntries(Object.entries(exact).filter(([header]) => header !== LATTICE_QUALIFICATION_PIPELINE_DIAGNOSTIC_RESPONSE_HEADERS.initialRetentionDowngrade)), /incomplete pipeline diagnostic/u],
    ["historical three-field group", body, 200, Object.fromEntries(Object.entries(exact).filter(([header]) => ![LATTICE_QUALIFICATION_PIPELINE_DIAGNOSTIC_RESPONSE_HEADERS.successfulCorrectionStage, LATTICE_QUALIFICATION_PIPELINE_DIAGNOSTIC_RESPONSE_HEADERS.initialRetentionDowngrade].includes(header))), /incomplete pipeline diagnostic/u],
    ["impossible successful correction path", body, 200, { ...exact, ...pipelineDiagnosticHeaders({ successfulCorrectionStage: "repair" }) }, /invalid pipeline diagnostic/u],
    ["missing pipeline group", body, 200, withoutPipeline, /without a pipeline diagnostic/u],
    ["partial pipeline group", body, 200, { ...withoutPipeline, [LATTICE_QUALIFICATION_PIPELINE_DIAGNOSTIC_RESPONSE_HEADERS.retryPath]: "none" }, /incomplete pipeline diagnostic/u],
    ["pipeline without withheld", body, 200, pipelineDiagnosticHeaders(), /pipeline diagnostic without a withheld diagnostic/u],
    ["pipeline unknown field", body, 200, { ...exact, "X-Lattice-Qualification-Pipeline-Unknown": privateMarker }, /invalid pipeline diagnostic/u],
    ["pipeline bare family", body, 200, { ...exact, "X-Lattice-Qualification-Pipeline": privateMarker }, /invalid pipeline diagnostic/u],
    ...["retryPath", "candidateLineage", "initialDeterministic", "successfulCorrectionStage", "initialRetentionDowngrade"].map((field) => (
      [`hostile pipeline ${field}`, body, 200, { ...exact, ...pipelineDiagnosticHeaders({ [field]: privateMarker }) }, /invalid pipeline diagnostic/u]
    )),
    ["pipeline impossible lineage", body, 200, { ...exact, ...pipelineDiagnosticHeaders({ retryPath: "none", candidateLineage: "repair" }) }, /invalid pipeline diagnostic/u],
    ["pipeline duplicate enum", body, 200, { ...exact, ...pipelineDiagnosticHeaders({ retryPath: "repair, repair" }) }, /invalid pipeline diagnostic/u],
    ["valid terminal observation", body, 200, exact, /terminal_failure=host-validation; stage=verification; attempt=2; validation=response-shape; prior_validation=evidence; rejection_boundary=wire-decoder; rejection_category=field-set; rejection_rule=V01F; prior_rejection_boundary=host-normalizer; prior_rejection_category=other; prior_rejection_rule=unknown; calls_used=4/u],
    ["reanalysis evidence predicates", body, 200, withheldDiagnosticHeaders({ stage: "re-atomization", validationCategory: "evidence", priorValidationCategory: "evidence", rejectionCategory: "reference", rejectionRule: "A02R", priorRejectionBoundary: "wire-decoder", priorRejectionCategory: "coverage", priorRejectionRule: "A03" }), /stage=re-atomization; attempt=2; validation=evidence; prior_validation=evidence; rejection_boundary=wire-decoder; rejection_category=reference; rejection_rule=A02R; prior_rejection_boundary=wire-decoder; prior_rejection_category=coverage; prior_rejection_rule=A03/u],
    ["analysis predicate wrong stage", body, 200, withheldDiagnosticHeaders({ rejectionCategory: "coverage", rejectionRule: "A01" }), /invalid withheld diagnostic/u],
    ["prior analysis predicate wrong stage", body, 200, withheldDiagnosticHeaders({ priorRejectionBoundary: "wire-decoder", priorRejectionCategory: "coverage", priorRejectionRule: "A03" }), /invalid withheld diagnostic/u],
    ["simultaneous blockers", body, 200, withheldDiagnosticHeaders({ revision: "incomplete", deterministic: "blocked", firstDeterministicRule: "unknown", verification: "mixed", certification: "performed-not-accepted", failureCause: "multiple", stage: "multiple", attempt: "multiple", validationCategory: "multiple", priorValidationCategory: "multiple", rejectionBoundary: "multiple", rejectionCategory: "multiple", rejectionRule: "multiple", priorRejectionRule: "multiple", priorRejectionBoundary: "multiple", priorRejectionCategory: "multiple" }), /revision=incomplete; deterministic=blocked; verification=mixed; first_deterministic_rule=unknown; certification=performed-not-accepted; terminal_failure=multiple; stage=multiple/u],
    ["legitimate checks without contract failure", body, 200, withheldDiagnosticHeaders({ verification: "semantic-rejection", failureCause: "none", stage: "none", attempt: "none", validationCategory: "none", priorValidationCategory: "none", rejectionBoundary: "none", rejectionCategory: "none", rejectionRule: "none", priorRejectionRule: "none", priorRejectionBoundary: "none", priorRejectionCategory: "none" }), /verification=semantic-rejection; first_deterministic_rule=none; certification=not-reached; terminal_failure=none; stage=none/u],
    ["absent", body, 200, {}, /without a withheld diagnostic/u],
    ["partial", body, 200, { [LATTICE_QUALIFICATION_WITHHELD_DIAGNOSTIC_RESPONSE_HEADERS.stage]: "verification" }, /incomplete withheld diagnostic/u],
    ["hostile field", body, 200, withheldDiagnosticHeaders({ validationCategory: privateMarker }), /invalid withheld diagnostic/u],
    ["hostile rejection", body, 200, withheldDiagnosticHeaders({ rejectionCategory: privateMarker }), /invalid withheld diagnostic/u],
    ["hostile rule", body, 200, withheldDiagnosticHeaders({ rejectionRule: privateMarker }), /invalid withheld diagnostic/u],
    ["impossible predicate", body, 200, withheldDiagnosticHeaders({ rejectionCategory: "coverage", rejectionRule: "V06M" }), /invalid withheld diagnostic/u],
    ["wrong decoder stage", body, 200, withheldDiagnosticHeaders({ stage: "repair" }), /invalid withheld diagnostic/u],
    ["wrong decoder family", body, 200, withheldDiagnosticHeaders({ rejectionRule: "C01F" }), /invalid withheld diagnostic/u],
    ["clear with deterministic finding", body, 200, withheldDiagnosticHeaders({ firstDeterministicRule: "D14" }), /invalid withheld diagnostic/u],
    ["blocked without deterministic finding", body, 200, withheldDiagnosticHeaders({ deterministic: "blocked" }), /invalid withheld diagnostic/u],
    ["unknown specific rejection", body, 200, withheldDiagnosticHeaders({ rejectionBoundary: "unknown" }), /invalid withheld diagnostic/u],
    ["absent rejection mismatch", body, 200, withheldDiagnosticHeaders({ rejectionBoundary: "none" }), /invalid withheld diagnostic/u],
    ["inconsistent none", body, 200, withheldDiagnosticHeaders({ failureCause: "none" }), /invalid withheld diagnostic/u],
    ["inconsistent multiple", body, 200, withheldDiagnosticHeaders({ failureCause: "multiple" }), /invalid withheld diagnostic/u],
    ["first exhausted host verifier", body, 200, withheldDiagnosticHeaders({ attempt: "1", priorValidationCategory: "none" }), /invalid withheld diagnostic/u],
    ["missing prior validation", body, 200, withheldDiagnosticHeaders({ priorValidationCategory: "none" }), /invalid withheld diagnostic/u],
    ["capacity category mismatch", body, 200, withheldDiagnosticHeaders({ failureCause: "context-capacity" }), /invalid withheld diagnostic/u],
    ["unbounded calls", body, 200, withheldDiagnosticHeaders({ callsUsed: "33" }), /invalid withheld diagnostic/u],
    ["zero calls", body, 200, withheldDiagnosticHeaders({ callsUsed: "0" }), /invalid withheld diagnostic/u],
    ["incompatible analysis trace", body, 200, { ...exact, ...terminalAnalysisDiagnosticHeaders() }, /incompatible terminal diagnostics/u],
    ["different unable finding", { result: unableResult([{ id: "generation-unavailable", passageId: "", atomIds: [], message: privateMarker }]), schema_version: 1 }, 200, exact, /withheld diagnostic on an incompatible unable result/u],
    ["accepted result", { result: validResult(), schema_version: 1 }, 200, exact, /withheld diagnostic on success/u],
    ["HTTP failure", { error: "upstream_unavailable", schema_version: 1 }, 502, exact, /withheld diagnostic on a non-success response/u],
  ];
  for (const [name, resultBody, status, headers, expected] of cases) {
    await contextTest.test(name, async () => {
      const fixture = successfulFixture({ canaryResponse: apiJson(resultBody, status, headers) });
      await assert.rejects(verifyTextToLatticeApiProduction({ fetchImpl: fixture.fetchImpl, context, now: fixedNow, wait: noWait }), (error) => {
        assert.match(error.message, expected);
        assert.equal(error.message.includes(privateMarker), false);
        return true;
      });
      assert.equal(fixture.canaryRequests, 1);
      assert.equal(fixture.setupRequests, 1);
    });
  }
});


test("qualification HTTP diagnostic completeness and applicability fail closed without reflection", async (t) => {
  const marker = "PRIVATE-HTTP-METADATA";
  const exact = qualificationDiagnosticHeaders({ upstreamStatus: "405", stage: "verification", callOrdinal: "4", analysisOrigin: "none", analysisAttempt: "none" });
  const onlyHttp = Object.fromEntries(Object.values(LATTICE_QUALIFICATION_HTTP_DIAGNOSTIC_RESPONSE_HEADERS).map((header) => [header, "absent"]));
  const missing = { ...exact }; delete missing[LATTICE_QUALIFICATION_HTTP_DIAGNOSTIC_RESPONSE_HEADERS.allow];
  const cases = [
    ["complete HTTP failure", exact, 502, /upstream_status=405; stage=verification; call_ordinal=4.*http_mediaType=absent; http_allow=absent; http_routerRoute=absent; http_routerModel=absent; http_inferenceProvider=absent/u],
    ["HTTP failure without numeric status", { ...exact, [LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.upstreamStatus]: "none" }, 502, /invalid qualification diagnostic/u],
    ["network failure with numeric status", qualificationDiagnosticHeaders({ failureClass: "provider_unavailable", upstreamStatus: "405" }), 502, /invalid qualification diagnostic/u],
    ["missing HTTP field", missing, 502, /incomplete qualification HTTP diagnostic/u],
    ["unrecognized HTTP value", { ...exact, [LATTICE_QUALIFICATION_HTTP_DIAGNOSTIC_RESPONSE_HEADERS.routerModel]: marker }, 502, /invalid qualification HTTP diagnostic/u],
    ["partial HTTP group", { ...qualificationDiagnosticHeaders({ failureClass: "provider_unavailable" }), [LATTICE_QUALIFICATION_HTTP_DIAGNOSTIC_RESPONSE_HEADERS.allow]: "empty" }, 502, /incompatible qualification HTTP diagnostic/u],
    ["HTTP group on network failure", { ...qualificationDiagnosticHeaders({ failureClass: "provider_unavailable" }), ...onlyHttp }, 502, /incompatible qualification HTTP diagnostic/u],
    ["HTTP group on success", onlyHttp, 200, /incompatible qualification HTTP diagnostic/u],
  ];
  for (const [name, headers, status, expected] of cases) {
    await t.test(name, async () => {
      const body = status === 200 ? { result: validResult(), schema_version: 1 } : { error: "upstream_unavailable" };
      const fixture = successfulFixture({ canaryResponse: apiJson(body, status, headers) });
      let failure;
      try { await verifyTextToLatticeApiProduction({ fetchImpl: fixture.fetchImpl, context, now: fixedNow, wait: noWait }); }
      catch (error) { failure = error; }
      assert.ok(failure instanceof Error); assert.match(failure.message, expected);
      assert.equal(failure.message.includes(marker), false); assert.equal(fixture.canaryRequests, 1); assert.equal(fixture.setupRequests, 1);
    });
  }
});


test("S06 qualification shape is complete, compatible and non-reflective", async (t) => {
  const base = qualificationDiagnosticHeaders({ failureClass: "provider_malformed_response", upstreamStatus: "none",
    stage: "verification", subtype: "S06", finishReason: "stop", analysisOrigin: "none", analysisAttempt: "none" });
  const shape = Object.fromEntries(Object.entries(LATTICE_QUALIFICATION_ENVELOPE_SHAPE_RESPONSE_HEADERS)
    .map(([field, header]) => [header, { namedShape: "--n-a---", unknownCount: "0", unknownShapes: "000000000" }[field]]));
  const exact = { ...base, ...shape };
  const h = LATTICE_QUALIFICATION_ENVELOPE_SHAPE_RESPONSE_HEADERS;
  const d = LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS;
  const partial = { ...exact }; delete partial[h.unknownShapes];
  const cases = [
    ["actual finite observation", exact, 502, /subtype=S06.*envelope_namedShape=--n-a---; envelope_unknownCount=0; envelope_unknownShapes=000000000/u],
    ["missing all", base, 502, /incomplete qualification envelope shape/u],
    ["partial", partial, 502, /incomplete qualification envelope shape/u],
    ["private value", { ...exact, [h.namedShape]: "PRIVATE-CONTENT" }, 502, /invalid qualification envelope shape/u],
    ["impossible absence", { ...exact, [h.namedShape]: "--------" }, 502, /invalid qualification envelope shape/u],
    ["impossible count", { ...exact, [h.unknownShapes]: "100000000" }, 502, /invalid qualification envelope shape/u],
    ["wrong subtype", { ...exact, [d.subtype]: "S02" }, 502, /incompatible qualification envelope shape/u],
    ["wrong stage", { ...exact, [d.stage]: "candidate" }, 502, /invalid qualification diagnostic/u],
    ["wrong finish", { ...exact, [d.finishReason]: "tool_calls" }, 502, /invalid qualification diagnostic/u],
    ["on success", exact, 200, /qualification diagnostic on success/u],
    ["alone on success", shape, 200, /incompatible qualification envelope shape/u],
  ];
  for (const [name, headers, status, expected] of cases) {
    await t.test(name, async () => {
      const body = status === 200 ? { result: validResult(), schema_version: 1 } : { error: "malformed_upstream_response" };
      const fixture = successfulFixture({ canaryResponse: apiJson(body, status, headers) });
      await assert.rejects(verifyTextToLatticeApiProduction({ fetchImpl: fixture.fetchImpl, context, now: fixedNow, wait: noWait }), (error) => {
        assert.match(error.message, expected); assert.doesNotMatch(error.message, /PRIVATE/u); return true;
      });
      assert.equal(fixture.canaryRequests, 1); assert.equal(fixture.setupRequests, 1);
    });
  }
});


test("M01 qualification strict message shape is complete, stage-bound and non-reflective", async (t) => {
  const h = LATTICE_QUALIFICATION_STRICT_MESSAGE_SHAPE_RESPONSE_HEADERS;
  const d = LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS;
  const base = qualificationDiagnosticHeaders({ failureClass: "provider_malformed_response", upstreamStatus: "none",
    stage: "verification", subtype: "M01", finishReason: "stop", analysisOrigin: "none", analysisAttempt: "none" });
  const shape = Object.fromEntries(Object.entries(h).map(([field, header]) => [header,
    { namedShape: "-----nn-a-", unknownCount: "0", unknownShapes: "000000000" }[field]]));
  const exact = { ...base, ...shape };
  const invalid = /invalid qualification strict message shape/u;
  const partial = { ...exact }; delete partial[h.unknownShapes];
  const unknown = "X-Lattice-Qualification-Strict-Message-PRIVATE-KEY";
  const legacy = Object.fromEntries(Object.entries(LATTICE_QUALIFICATION_ENVELOPE_SHAPE_RESPONSE_HEADERS)
    .map(([field, header]) => [header, { namedShape: "-----nn-", unknownCount: "0", unknownShapes: "000000000" }[field]]));
  for (const [name, headers, status, expected] of [
    ["exact verification", exact, 502, /subtype=M01.*strict_message_namedShape=-----nn-a-; strict_message_unknownCount=0; strict_message_unknownShapes=000000000/u],
    ["exact certification", { ...exact, [d.stage]: "certification" }, 502, /stage=certification.*subtype=M01/u],
    ["exact correction", { ...exact, [d.stageAttempt]: "correction", [d.priorValidationCategory]: "response-shape", [d.callOrdinal]: "4" }, 502, /subtype=M01/u],
    ["missing all", base, 502, /incomplete qualification strict message shape/u],
    ["partial", partial, 502, /incomplete qualification strict message shape/u],
    ["private value", { ...exact, [h.namedShape]: "PRIVATE-VALUE" }, 502, invalid],
    ["legacy width", { ...exact, [h.namedShape]: "-----nn-" }, 502, invalid],
    ["impossible absence", { ...exact, [h.namedShape]: "----------" }, 502, invalid],
    ["impossible count", { ...exact, [h.unknownShapes]: "100000000" }, 502, invalid],
    ["unknown header alone", { [unknown]: "PRIVATE-VALUE" }, 502, invalid],
    ["unknown header with shape", { ...exact, [unknown]: "PRIVATE-VALUE" }, 502, invalid],
    ["wrong subtype", { ...exact, [d.subtype]: "message_shape" }, 502, /incompatible qualification strict message shape/u],
    ["wrong stage", { ...exact, [d.stage]: "candidate" }, 502, /invalid qualification diagnostic/u],
    ["wrong finish", { ...exact, [d.finishReason]: "tool_calls" }, 502, /invalid qualification diagnostic/u],
    ["on success", exact, 200, /qualification diagnostic on success/u],
    ["alone on success", shape, 200, /incompatible qualification strict message shape/u],
    ["legacy group on M01", { ...exact, ...legacy }, 502, /incompatible qualification envelope shape/u],
    ["strict group on S06", { ...exact, ...legacy, [d.subtype]: "S06" }, 502, /incompatible qualification strict message shape/u],
  ]) await t.test(name, async () => {
    const body = status === 200 ? { result: validResult(), schema_version: 1 } : { error: "malformed_upstream_response" };
    const fixture = successfulFixture({ canaryResponse: apiJson(body, status, headers) });
    await assert.rejects(verifyTextToLatticeApiProduction({ fetchImpl: fixture.fetchImpl, context, now: fixedNow, wait: noWait }), (error) => {
      assert.match(error.message, expected); assert.doesNotMatch(error.message, /PRIVATE/u); return true;
    });
    assert.equal(fixture.canaryRequests, 1); assert.equal(fixture.setupRequests, 1);
  });
});

test("first verification rejection on a correction provider failure is finite, complete and compatible", async (t) => {
  const marker = "PRIVATE-PRIOR-VERIFICATION-MUST-NOT-CROSS";
  const base = {
    failureClass: "provider_output_limit", stage: "verification", callOrdinal: "5",
    finishReason: "length", requestSize: "4097-16384", responseSize: "4097-16384",
    contentSize: "4097-16384", completionTokens: "2048-3071",
    stageAttempt: "correction", analysisOrigin: "none", analysisAttempt: "none",
    priorValidationCategory: "other",
  };
  const diagnostic = qualificationDiagnosticHeaders(base);
  const headerNames = LATTICE_QUALIFICATION_PRIOR_VERIFICATION_REJECTION_RESPONSE_HEADERS;
  const priorHeaders = (overrides = {}) => {
    const values = { boundary: "wire-decoder", category: "field-set", rule: "V01F", ...overrides };
    return Object.fromEntries(Object.entries(headerNames).map(([field, header]) => [header, values[field]]));
  };
  const prior = priorHeaders();
  const exact = { ...diagnostic, ...prior };
  const incompatible = /incompatible prior verification rejection diagnostic/u;
  const invalid = /invalid prior verification rejection diagnostic/u;
  const unknownHeader = `X-Lattice-Qualification-Prior-Verification-Rejection-${marker}`;
  const cases = [
    ["unknown header alone", { [unknownHeader]: marker }, 502, invalid, false],
    ["unknown header alongside exact triplet", { ...exact, [unknownHeader]: marker }, 502, invalid, false],
    ["optional group absent", diagnostic, 502, /finish_reason=length; .*prior_validation=other$/u, false],
    ["exact first wire rejection", exact, 502, /prior_validation=other; prior_rejection_boundary=wire-decoder; prior_rejection_category=field-set; prior_rejection_rule=V01F$/u, true],
    ["host normalizer unknown", { ...diagnostic, ...priorHeaders({ boundary: "host-normalizer", category: "other", rule: "unknown" }) }, 502, /prior_rejection_boundary=host-normalizer; prior_rejection_category=other; prior_rejection_rule=unknown$/u, true],
    ["wire unknown remains uncertain", { ...diagnostic, ...priorHeaders({ category: "other", rule: "unknown" }) }, 502, /prior_rejection_boundary=wire-decoder; prior_rejection_category=other; prior_rejection_rule=unknown$/u, true],
    ["mask coverage rejection", { ...diagnostic, ...priorHeaders({ category: "coverage", rule: "V16M" }) }, 502, /prior_rejection_category=coverage; prior_rejection_rule=V16M$/u, true],
    ...["V14L", "V14LE", "V14LS", "V14LG"].flatMap((rule) => [
      [`passage-check width ${rule}`, { ...diagnostic, ...priorHeaders({ category: "value-domain", rule }) }, 502,
        new RegExp(`prior_rejection_boundary=wire-decoder; prior_rejection_category=value-domain; prior_rejection_rule=${rule}$`, "u"), true],
      [`width category mismatch ${rule}`, { ...diagnostic, ...priorHeaders({ category: "coverage", rule }) }, 502, invalid, false],
      [`width host-boundary mismatch ${rule}`, { ...diagnostic, ...priorHeaders({ boundary: "host-normalizer", category: "value-domain", rule }) }, 502, invalid, false],
    ]),
    ...["V14LX", "V14LS8", "V14LG10"].map((rule) =>
      [`unregistered width refinement ${rule}`, { ...diagnostic, ...priorHeaders({ category: "value-domain", rule }) }, 502, invalid, false]),
    ["consistency rejection", { ...diagnostic, ...priorHeaders({ category: "consistency", rule: "V19" }) }, 502, /prior_rejection_category=consistency; prior_rejection_rule=V19$/u, true],
    ["all fields without base diagnostic", prior, 502, incompatible, false],
    ["private boundary", { ...exact, [headerNames.boundary]: marker }, 502, invalid, false],
    ["private category", { ...exact, [headerNames.category]: marker }, 502, invalid, false],
    ["private rule", { ...exact, [headerNames.rule]: marker }, 502, invalid, false],
    ["unregistered rule", { ...exact, [headerNames.rule]: "V999" }, 502, invalid, false],
    ["unregistered boundary", { ...exact, [headerNames.boundary]: "unknown" }, 502, invalid, false],
    ["mismatched category and rule", { ...exact, [headerNames.category]: "coverage" }, 502, invalid, false],
    ["analysis rule", { ...diagnostic, ...priorHeaders({ category: "reference", rule: "A02R" }) }, 502, invalid, false],
    ["certifier rule", { ...diagnostic, ...priorHeaders({ category: "reference", rule: "C02" }) }, 502, invalid, false],
    ["host normalizer with decoder rule", { ...exact, [headerNames.boundary]: "host-normalizer" }, 502, invalid, false],
    ["host normalizer with precise category", { ...diagnostic, ...priorHeaders({ boundary: "host-normalizer", rule: "unknown" }) }, 502, invalid, false],
    ["joined duplicate rule values", { ...exact, [headerNames.rule]: "V01F, V01F" }, 502, invalid, false],
    ["empty rule", { ...exact, [headerNames.rule]: "" }, 502, invalid, false],
    ["wrong stage", { ...qualificationDiagnosticHeaders({ ...base, stage: "candidate" }), ...prior }, 502, incompatible, false],
    ["initial attempt", { ...qualificationDiagnosticHeaders({ ...base, stageAttempt: "initial", priorValidationCategory: "none" }), ...prior }, 502, incompatible, false],
    ["first call", { ...qualificationDiagnosticHeaders({ ...base, callOrdinal: "1" }), ...prior }, 502, incompatible, false],
    ["ordinal outside call budget", { ...qualificationDiagnosticHeaders({ ...base, callOrdinal: "33" }), ...prior }, 502, /invalid qualification diagnostic/u, false],
    ["all groups on success", exact, 200, incompatible, false],
    ["prior group alone on success", prior, 200, incompatible, false],
  ];
  for (const [field, header] of Object.entries(headerNames)) {
    const partial = { ...exact };
    delete partial[header];
    cases.push([`missing ${field}`, partial, 502, /incomplete prior verification rejection diagnostic/u, false]);
  }
  for (const [name, headers, status, expected, reportsPrior] of cases) {
    await t.test(name, async () => {
      const body = status === 200
        ? { result: validResult(), schema_version: 1 }
        : { error: "malformed_upstream_response" };
      const fixture = successfulFixture({ canaryResponse: apiJson(body, status, headers) });
      await assert.rejects(verifyTextToLatticeApiProduction({
        fetchImpl: fixture.fetchImpl, context, now: fixedNow, wait: noWait,
      }), (error) => {
        assert.match(error.message, expected);
        assert.equal(error.message.toLowerCase().includes(marker.toLowerCase()), false);
        if (!reportsPrior) assert.doesNotMatch(error.message, /prior_rejection_(?:boundary|category|rule)=/u);
        return true;
      });
      assert.equal(fixture.canaryRequests, 1);
      assert.equal(fixture.setupRequests, 1);
      assert.equal(fixture.calls.length, CANARY_FLOW_REQUEST_COUNT);
    });
  }
});


function cookieSetupResponse(setCookie = quotaSetCookie) {
  return new Response(null, { status: 204, headers: { ...setupApiHeaders, "Set-Cookie": setCookie } });
}

function sequencedWallClock(values) {
  let index = 0;
  return () => new Date(values[Math.min(index++, values.length - 1)]);
}

test("GATE02 postflight checks preserve the core flow and retain only finite cookie facts", async () => {
  const fixture = successfulFixture();
  let preflight;
  const evidence = await verifyTextToLatticeApiProduction({
    fetchImpl: fixture.fetchImpl, context, now: fixedNow, wait: noWait,
    onPreflightEvidence(value) { preflight = value; },
  });
  assert.equal(preflight.visitor_session_postflight, undefined);
  assert.equal(preflight.visitor_session_setup.request_count, 1);
  assert.equal(preflight.negative_probes.count, 24);
  assert.equal(evidence.transformation_canary.request_count, 1);
  assert.equal(fixture.setupRequests, 2);
  assert.equal(fixture.canaryRequests, 1);
  assert.equal(fixture.tamperedCookieRequests, 1);
  assert.equal(fixture.calls.length, CANARY_FLOW_REQUEST_COUNT + 2);
  const [canary, preservation, tampered] = fixture.calls.slice(-3);
  const originalCookie = canary.init.headers.Cookie;
  assert.deepEqual(JSON.parse(canary.init.body), LATTICE_PRODUCTION_CANARY_REQUEST);
  assert.equal(preservation.init.headers.Cookie, originalCookie);
  assert.equal(preservation.init.headers.Accept, LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT);
  assert.equal(Object.hasOwn(preservation.init, "body"), false);
  assert.equal(Object.hasOwn(preservation.init.headers, "Content-Type"), false);
  assert.equal(tampered.init.body, "{");
  assert.equal(tampered.init.headers.Accept, "application/json");
  assert.equal(tampered.init.headers[LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER], LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE);
  const originalParts = originalCookie.split(".");
  const changedParts = tampered.init.headers.Cookie.split(".");
  assert.deepEqual(changedParts.slice(0, 2), originalParts.slice(0, 2));
  assert.notEqual(changedParts[2], originalParts[2]);
  assert.equal(Buffer.from(changedParts[2], "base64url").length, 32);
  assert.equal(Buffer.from(changedParts[2], "base64url").toString("base64url"), changedParts[2]);
  const postflight = evidence.visitor_session_postflight;
  assert.equal(postflight.scope, "backend-probes-after-successful-canary");
  assert.equal(postflight.request_count, 2);
  assert.equal(postflight.automatic_retry, false);
  assert.equal(postflight.raw_request_or_response_content_recorded, false);
  assert.deepEqual(postflight.initial_setup_expiry, {
    basis: "runner-wall-clock-interval",
    request_started_at: fixedNow().toISOString(), response_received_at: fixedNow().toISOString(),
    minimum_max_age_seconds: 41_104, maximum_max_age_seconds: 41_104,
    clock_tolerance_ms: 1_000, wall_clock_consistent: true,
    next_utc_boundary_matched: true,
  });
  assert.equal(postflight.preservation.cookie_value_preserved, true);
  assert.equal(postflight.preservation.cookie_header_present, true);
  assert.equal(postflight.preservation.http_status, 204);
  assert.equal(postflight.preservation.response_body_bytes, 0);
  assert.equal(postflight.tampered_cookie.http_status, 403);
  assert.equal(postflight.tampered_cookie.error, "invalid_request");
  assert.equal(postflight.tampered_cookie.request_body_bytes, 1);
  assert.equal(postflight.tampered_cookie.canonical_signature_mutation, true);
  const serialized = JSON.stringify(evidence);
  for (const cookie of [originalCookie, tampered.init.headers.Cookie]) {
    assert.equal(serialized.includes(cookie), false);
    assert.equal(serialized.includes(cookie.slice(cookie.indexOf("=") + 1)), false);
  }
});

test("GATE02 expiry is bounded by the measured setup wall-clock interval", async () => {
  const fixture = successfulFixture({
    setupResponse: cookieSetupResponse(quotaSetCookie.replace("41104", "41103")),
    preservationResponse: cookieSetupResponse(quotaSetCookie.replace("41104", "41102")),
  });
  let monotonic = 0;
  const evidence = await verifyTextToLatticeApiProduction({
    async fetchImpl(url, init) {
      const response = await fixture.fetchImpl(url, init);
      if (fixture.setupRequests === 1) monotonic = 2_000;
      return response;
    },
    context, wait: noWait, monotonicNow: () => monotonic,
    now: sequencedWallClock([
      "2026-09-14T12:34:56.000Z", "2026-09-14T12:34:56.100Z", "2026-09-14T12:34:58.100Z",
      "2026-09-14T12:34:58.100Z", "2026-09-14T12:34:58.100Z",
    ]),
  });
  assert.equal(evidence.visitor_session_postflight.initial_setup_expiry.minimum_max_age_seconds, 41_102);
  assert.equal(evidence.visitor_session_postflight.initial_setup_expiry.maximum_max_age_seconds, 41_104);
  assert.equal(evidence.visitor_session_postflight.preservation.expiry.minimum_max_age_seconds, 41_102);
});

test("GATE02 rejects future, short, reversed, invalid and cross-midnight cookie expiry observations", async (t) => {
  const cases = [
    { name: "expiry after UTC boundary", age: 41_105 },
    { name: "expiry before UTC boundary", age: 41_103 },
    { name: "full-day lifetime at midday", age: 86_400 },
    { name: "reversed clock", times: ["2026-09-14T12:34:56.000Z", "2026-09-14T12:34:58.000Z", "2026-09-14T12:34:56.000Z"] },
    { name: "midnight during setup", age: 1, times: ["2026-09-14T23:59:59.900Z", "2026-09-14T23:59:59.900Z", "2026-09-15T00:00:00.100Z"] },
    { name: "invalid response time", times: ["2026-09-14T12:34:56.000Z", "2026-09-14T12:34:56.000Z", "invalid"] },
  ];
  for (const { name, age = 41_104, times } of cases) await t.test(name, async () => {
    const fixture = successfulFixture({ setupResponse: cookieSetupResponse(quotaSetCookie.replace("41104", `${age}`)) });
    await assert.rejects(verifyTextToLatticeApiProduction({
      fetchImpl: fixture.fetchImpl, context, now: times ? sequencedWallClock(times) : fixedNow, wait: noWait,
    }), /cookie expiry/u);
    assert.equal(fixture.setupRequests, 1);
    assert.equal(fixture.negativeRequests, 0);
    assert.equal(fixture.canaryRequests, 0);
    assert.equal(fixture.tamperedCookieRequests, 0);
  });
});

test("GATE02 rejects postflight rotation or failed tamper rejection without retry or raw leakage", async (t) => {
  const rotated = quotaSetCookie.replace("AAAAAAAAAAAAAAAAAAAAAAAA", "BBBBBBBBBBBBBBBBBBBBBBBB");
  for (const [name, options, expectedTamperCount] of [
    ["rotated cookie", { preservationResponse: cookieSetupResponse(rotated) }, 0],
    ["wrong preservation expiry", { preservationResponse: cookieSetupResponse(quotaSetCookie.replace("41104", "41105")) }, 0],
    ["tampered authentication accepted", { tamperedCookieResponse: apiJson({ error: "invalid_request" }, 400) }, 1],
    ["tampered cookie reflected", { tamperedCookieResponse: apiJson({ error: "invalid_request", cookie: rotated }, 403) }, 1],
  ]) await t.test(name, async () => {
    const fixture = successfulFixture(options);
    let usageEmissions = 0;
    await assert.rejects(verifyTextToLatticeApiProduction({
      fetchImpl: fixture.fetchImpl, context, now: fixedNow, wait: noWait,
      onUsageEvidence() { usageEmissions += 1; },
    }), (error) => {
      assert.match(error.message, /postflight/u);
      assert.equal(error.message.includes(rotated), false);
      assert.equal(error.message.includes(quotaSetCookie.split(";", 1)[0]), false);
      return true;
    });
    assert.equal(fixture.canaryRequests, 1);
    assert.equal(fixture.setupRequests, 2);
    assert.equal(fixture.tamperedCookieRequests, expectedTamperCount);
    assert.equal(usageEmissions, 0);
  });
});

test("GATE02 tampered-cookie malformed payload cannot cause an extra admission even if authentication regresses", async () => {
  const fixture = successfulFixture();
  let admissions = 0;
  let providerFactories = 0;
  let pipelineCalls = 0;
  const worker = createLatticeApiWorker({
    now: () => fixedNow().valueOf(),
    async admitTransformation() { admissions += 1; return { allowed: true, retryAfterSeconds: null }; },
    createAdapter() { providerFactories += 1; throw new Error("No provider factory permitted"); },
    async runTextToLatticeImpl() { pipelineCalls += 1; throw new Error("No pipeline permitted"); },
  });
  const env = { HF_TOKEN: "synthetic-test-token", VISITOR_COOKIE_SECRET: "s".repeat(48), LATTICE_QUALIFICATION_EXPIRES_AT: "2026-09-14T12:55:00.000Z" };
  let tamperedRequest;
  const fetchImpl = async (url, init) => {
    if (init.headers.Accept === LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT
      && !Object.hasOwn(init.headers, "Content-Type")) {
      return worker.fetch(new Request(url, init), env);
    }
    if (fixture.canaryRequests === 1 && init.body === "{") {
      tamperedRequest = new Request(url, init);
      return worker.fetch(tamperedRequest.clone(), env);
    }
    return fixture.fetchImpl(url, init);
  };
  const evidence = await verifyTextToLatticeApiProduction({ fetchImpl, context, now: fixedNow, wait: noWait });
  assert.equal(evidence.visitor_session_postflight.tampered_cookie.http_status, 403);
  const permissiveWorker = createLatticeApiWorker({
    now: () => fixedNow().valueOf(),
    async resolveVisitor() { return { visitorId: "A".repeat(24), cookieValue: "in-memory-fixture" }; },
    async admitTransformation() { admissions += 1; return { allowed: true, retryAfterSeconds: null }; },
    createAdapter() { providerFactories += 1; throw new Error("No provider factory permitted"); },
    async runTextToLatticeImpl() { pipelineCalls += 1; throw new Error("No pipeline permitted"); },
  });
  const response = await permissiveWorker.fetch(tamperedRequest.clone(), env);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_request" });
  assert.equal(admissions, 0);
  assert.equal(providerFactories, 0);
  assert.equal(pipelineCalls, 0);
});


test("GATE02 expiry accepts exact midnight and ceil-rounded subsecond intervals", async (t) => {
  for (const [time, maxAge] of [["2026-09-15T00:00:00.000Z", 86_400], ["2026-09-14T23:59:59.999Z", 1]]) {
    await t.test(time, async () => {
      const setCookie = quotaSetCookie.replace("41104", `${maxAge}`);
      const fixture = successfulFixture({ setupResponse: cookieSetupResponse(setCookie), preservationResponse: cookieSetupResponse(setCookie) });
      const evidence = await verifyTextToLatticeApiProduction({ fetchImpl: fixture.fetchImpl, context, now: () => new Date(time), wait: noWait });
      assert.equal(evidence.visitor_session_postflight.initial_setup_expiry.minimum_max_age_seconds, maxAge);
      assert.equal(evidence.visitor_session_postflight.initial_setup_expiry.maximum_max_age_seconds, maxAge);
    });
  }
});

test("GATE02 additive postflight metadata does not reinterpret earlier v3 usage receipts", async () => {
  let usage;
  const fixture = successfulFixture();
  const evidence = await verifyTextToLatticeApiProduction({
    fetchImpl: fixture.fetchImpl, context, now: fixedNow, wait: noWait,
    onUsageEvidence(value) { usage = value; },
  });
  const earlierV3 = { ...evidence };
  delete earlierV3.visitor_session_postflight;
  const bytes = new TextEncoder().encode(serializeLatticeProductionEvidence(earlierV3).serialized);
  const priorUsage = {
    ...usage,
    live_boundary: { ...usage.live_boundary, sha256: createHash("sha256").update(bytes).digest("hex") },
  };
  assert.equal(verifyLatticeQualificationUsageEvidence(priorUsage, bytes, { requireComplete: true }), priorUsage);
  assert.equal(earlierV3.visitor_session_postflight, undefined);
  assert.equal(earlierV3.schemaVersion, 3);
});


test("GATE02 expiry rejects wall-clock discontinuities during and between setup calls", async (t) => {
  for (const [name, times, expectedSetups] of [
    ["forward jump during initial setup", ["12:34:56", "12:34:56", "18:34:56"], 1],
    ["backward jump before postflight", ["12:34:56", "12:34:56", "12:34:56", "11:34:56"], 1],
    ["forward jump before postflight", ["12:34:56", "12:34:56", "12:34:56", "13:34:56"], 1],
    ["forward jump during postflight", ["12:34:56", "12:34:56", "12:34:56", "12:34:56", "18:34:56"], 2],
  ]) await t.test(name, async () => {
    const fixture = successfulFixture();
    await assert.rejects(verifyTextToLatticeApiProduction({
      fetchImpl: fixture.fetchImpl, context, wait: noWait,
      monotonicNow: () => 0,
      now: sequencedWallClock(times.map((time) => `2026-09-14T${time}.000Z`)),
    }), /inconsistent cookie expiry observation clock/u);
    assert.equal(fixture.setupRequests, expectedSetups);
    assert.equal(fixture.canaryRequests, name === "forward jump during initial setup" ? 0 : 1);
    assert.equal(fixture.tamperedCookieRequests, 0);
  });
});


test("GATE02 cookie expiry observation cannot outlive the bounded setup request", async () => {
  const fixture = successfulFixture();
  let monotonic = 0;
  await assert.rejects(verifyTextToLatticeApiProduction({
    async fetchImpl(url, init) {
      const response = await fixture.fetchImpl(url, init);
      if (fixture.setupRequests === 1) monotonic = 16_000;
      return response;
    },
    context, wait: noWait, monotonicNow: () => monotonic,
    now: sequencedWallClock(["2026-09-14T12:34:56.000Z", "2026-09-14T12:34:56.000Z", "2026-09-14T12:35:12.000Z"]),
  }), /bounded cookie expiry observation interval/u);
  assert.equal(fixture.setupRequests, 1);
  assert.equal(fixture.negativeRequests, 0);
  assert.equal(fixture.canaryRequests, 0);
});

test("admission headers are a closed finite group with no implicit zero or raw error reflection", async (t) => {
  const zero = { status: "complete", claim: "not-called", order: "not-called", provider: "not-started" };
  assert.deepEqual(parseLatticeQualificationAdmissionHeaders(new Headers(admissionHeaders()), { required: "zero" }), zero);
  assert.equal(parseLatticeQualificationAdmissionHeaders(new Headers()), null);
  for (const [label, change] of [
    ["absent", (h) => { for (const name of Object.values(LATTICE_QUALIFICATION_ADMISSION_RESPONSE_HEADERS)) h.delete(name); }],
    ["partial", (h) => h.delete(LATTICE_QUALIFICATION_ADMISSION_RESPONSE_HEADERS.claim)],
    ["unknown family", (h) => h.set("x-lattice-qualification-admission-extra", "UNTRUSTED_PRIVATE_TEXT")],
    ["unknown claim", (h) => h.set(LATTICE_QUALIFICATION_ADMISSION_RESPONSE_HEADERS.claim, "UNTRUSTED_PRIVATE_TEXT")],
    ["contradictory order", (h) => h.set(LATTICE_QUALIFICATION_ADMISSION_RESPONSE_HEADERS.order, "after-validation")],
    ["unavailable", (h) => { for (const name of Object.values(LATTICE_QUALIFICATION_ADMISSION_RESPONSE_HEADERS)) h.set(name, "unavailable"); }],
  ]) await t.test(label, () => {
    const headers = new Headers(admissionHeaders()); change(headers);
    assert.throws(() => parseLatticeQualificationAdmissionHeaders(headers, { required: "zero" }), (error) => {
      assert.match(error.message, /qualification admission observation/u);
      assert.doesNotMatch(error.message, /UNTRUSTED_PRIVATE_TEXT/u); return true;
    });
  });
  for (const suffix of ["\n", "\r\n", "\u2028"]) {
    const values = admissionHeaders(); values[LATTICE_QUALIFICATION_ADMISSION_RESPONSE_HEADERS.claim] += suffix;
    const fakeHeaders = { keys: () => Object.keys(values), get: (name) => values[name] ?? null };
    assert.throws(() => parseLatticeQualificationAdmissionHeaders(fakeHeaders), /qualification admission observation/u);
  }
});

test("admission evidence option is strict and cannot silently disable qualification", () => {
  assert.equal(parseLatticeRequireAdmissionEvidence(undefined), true);
  assert.equal(parseLatticeRequireAdmissionEvidence("true"), true);
  assert.equal(parseLatticeRequireAdmissionEvidence("false"), false);
  for (const value of ["", "TRUE", " false", "false\n", false, 0, null]) {
    assert.throws(() => parseLatticeRequireAdmissionEvidence(value), /must be true or false/u);
  }
});

function stripAdmissionFixture(fetchImpl) {
  return async (...args) => {
    const response = await fetchImpl(...args);
    for (const name of Object.values(LATTICE_QUALIFICATION_ADMISSION_RESPONSE_HEADERS)) response.headers.delete(name);
    return response;
  };
}

test("already-qualified absence is explicitly not-observed while qualification requires all actual observations", async () => {
  const fixture = successfulFixture();
  const evidence = await verifyTextToLatticeApiProduction({
    fetchImpl: stripAdmissionFixture(fixture.fetchImpl), context, now: fixedNow, wait: noWait,
    requireAdmissionEvidence: false,
  });
  assert.deepEqual(evidence.request_admission, {
    status: "not-observed", diagnostic_revision: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
    scope: "request-scoped-host-observation", completed_at: fixedNow().toISOString(),
  });
  assert.equal(fixture.canaryRequests, 1);
  assert.equal(fixture.negativeRequests, 24);
  assert.equal(verifyLatticeProductionAdmissionEvidence(evidence.request_admission, { requireComplete: false }), evidence.request_admission);
  assert.throws(() => verifyLatticeProductionAdmissionEvidence(evidence.request_admission), /incomplete or inconsistent/u);
  const missing = successfulFixture();
  await assert.rejects(verifyTextToLatticeApiProduction({
    fetchImpl: stripAdmissionFixture(missing.fetchImpl), context, now: fixedNow, wait: noWait,
  }), /qualification admission observation/u);
  assert.equal(missing.canaryRequests, 0);
});

test("already-qualified mode never turns present partial or unavailable groups into absence", async (t) => {
  for (const fields of [
    { status: "complete" },
    { status: "unavailable", claim: "unavailable", order: "unavailable", provider: "unavailable" },
    { status: "complete", claim: "allowed-once", order: "not-called", provider: "not-started" },
    { status: "UNTRUSTED_PRIVATE_TEXT" },
  ]) await t.test(JSON.stringify(fields), async () => {
    const fixture = successfulFixture();
    const stripped = stripAdmissionFixture(fixture.fetchImpl);
    await assert.rejects(verifyTextToLatticeApiProduction({
      fetchImpl: async (...args) => {
        const response = await stripped(...args);
        if (response.status === 204) for (const [key, value] of Object.entries(fields)) response.headers.set(LATTICE_QUALIFICATION_ADMISSION_RESPONSE_HEADERS[key], value);
        return response;
      }, context, now: fixedNow, wait: noWait, requireAdmissionEvidence: false,
    }), /qualification admission observation/u);
    assert.equal(fixture.canaryRequests, 0);
  });
});

test("complete admission receipt accounts for the exact covered requests without adding admissions", async () => {
  const fixture = successfulFixture();
  const evidence = await verifyTextToLatticeApiProduction({ fetchImpl: fixture.fetchImpl, context, now: fixedNow, wait: noWait });
  assert.equal(verifyLatticeProductionAdmissionEvidence(evidence.request_admission), evidence.request_admission);
  assert.deepEqual(evidence.request_admission.negative_probes.map(({ id }) => id), LATTICE_PRODUCTION_ADMISSION_NEGATIVE_PROBE_IDS);
  assert.deepEqual(evidence.request_admission.canary, { status: "complete", claim: "allowed-once", order: "after-validation", provider: "after-admission" });
  assert.equal(fixture.calls.length, CANARY_FLOW_REQUEST_COUNT + 2);
  for (const mutation of [
    (x) => { x.negative_probes.pop(); },
    (x) => { x.negative_probes[0].id = "wrong-path"; },
    (x) => { x.setup.claim = "allowed-once"; },
    (x) => { x.canary.provider = "not-started"; },
    (x) => { x.diagnostic_revision = "v17"; },
    (x) => { x.completed_at += "\n"; },
    (x) => { x.unknown = true; },
  ]) {
    const changed = structuredClone(evidence.request_admission); mutation(changed);
    assert.throws(() => verifyLatticeProductionAdmissionEvidence(changed), /incomplete or inconsistent/u);
  }
  const legacy = structuredClone(evidence); delete legacy.request_admission;
  assert.equal(JSON.parse(serializeLatticeProductionEvidence(legacy).serialized).request_admission, undefined);
});
