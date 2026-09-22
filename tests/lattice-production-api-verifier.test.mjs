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
  LATTICE_PRODUCTION_PREFLIGHT_EVIDENCE_SCHEMA,
  LATTICE_PRODUCTION_READINESS_CONTRACT,
  LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT,
  serializeLatticeProductionEvidence,
  verifyTextToLatticeApiProduction,
  writeLatticeProductionEvidenceReceipt,
} from "../scripts/verify-text-to-lattice-api-production.mjs";
import {
  verifyTextToLatticeHeldApi,
} from "../scripts/verify-text-to-lattice-held-api.mjs";
import {
  LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER,
  LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS,
} from "../workers/text-to-lattice-api/worker.js";
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
const setupApiHeaders = Object.freeze({
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
});
const quotaSetCookie = "__Secure-hah-lattice-api-visitor=v1.AAAAAAAAAAAAAAAAAAAAAAAA.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; Max-Age=41104; Path=/api/lattice; Secure; HttpOnly; SameSite=Strict";
const SUCCESSFUL_PRODUCTION_REQUEST_COUNT = 4
  + LATTICE_PRODUCTION_READINESS_CONTRACT.requiredConsecutiveActiveSamples
  + 1
  + LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS.length
  + 1;

function apiJson(value, status, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...apiHeaders, ...headers },
  });
}

function validResult() {
  return {
    version: LATTICE_RESULT_VERSION,
    status: "translated",
    text: "The notebook rests on the desk. The visitor reads its first page, then closes it.",
    wordCount: 14,
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

function activeReadinessResponse() {
  return apiJson({ error: "invalid_request" }, 405, { Allow: "POST" });
}

function heldReadinessResponse() {
  return apiJson({ error: "upstream_unavailable" }, 503, {
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  });
}

function successfulFixture({ canaryResponse, readinessResponses, setupResponse } = {}) {
  const calls = [];
  const readinessSequence = readinessResponses ?? Array.from(
    { length: LATTICE_PRODUCTION_READINESS_CONTRACT.requiredConsecutiveActiveSamples },
    activeReadinessResponse,
  );
  let readinessIndex = 0;
  let negativeIndex = 0;
  let setupRequests = 0;
  let canaryRequests = 0;
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
      && init.method === "GET"
      && readinessIndex < readinessSequence.length) {
      const response = readinessSequence[readinessIndex];
      readinessIndex += 1;
      if (response instanceof Error) throw response;
      return response;
    }

    if (init.headers.Accept === LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT) {
      setupRequests += 1;
      return setupResponse ?? new Response(null, {
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
      return apiJson({ error: expected.error }, expected.status, expected.allow
        ? { Allow: expected.allow }
        : {});
    }

    canaryRequests += 1;
    const body = JSON.parse(init.body);
    canaryText = body.text;
    return canaryResponse ?? apiJson({ result: validResult(), schema_version: 1 }, 200);
  };
  return {
    calls,
    fetchImpl,
    get readinessRequests() { return readinessIndex; },
    get negativeRequests() { return negativeIndex; },
    get setupRequests() { return setupRequests; },
    get canaryRequests() { return canaryRequests; },
    get canaryText() { return canaryText; },
  };
}

test("the production verifier establishes one bodyless visitor session before exactly one content canary", async () => {
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
    },
  });

  assert.equal(evidence.format, LATTICE_PRODUCTION_EVIDENCE_SCHEMA);
  assert.equal(evidence.schemaVersion, 1);
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
  ]);
  assert.deepEqual(
    evidence.negative_probes.outcomes.map(({ id }) => id),
    LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS,
  );
  assert.equal(evidence.negative_probes.count, LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS.length);
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
    method: "GET",
    path: "/api/lattice",
    required_consecutive_active_samples: readinessRequestCount,
    observed_consecutive_active_samples: readinessRequestCount,
    active_response_count: readinessRequestCount,
    held_response_count: 0,
    network_error_count: 0,
    final_http_status: 405,
    final_error_code: "invalid_request",
    request_body_present: false,
    request_body_bytes: 0,
    origin_header_present: false,
    cookie_header_present: false,
    visitor_session_created: false,
    quota_claimed: false,
    provider_called: false,
    response_bodies_retained: false,
  });
  assert.equal(fixture.setupRequests, 1);
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
  assert.equal(evidence.transformation_canary.strict_result_valid, true);
  assert.equal(evidence.transformation_canary.terminal_status, "translated");
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
    provider_call_timeout_ms: 60_000,
    provider_request_bytes: 1_048_576,
    provider_response_bytes: 262_144,
    provider_calls_per_request: 32,
    accepted_transformations_per_utc_day: 30,
    accepted_transformations_per_cooperating_ordinary_persistent_browser_cookie_jar_utc_day: 3,
    maximum_provider_calls_from_accepted_transformations_per_utc_day: 960,
  });
  assert.equal(
    fixture.calls.length,
    4 + readinessRequestCount + 1 + LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS.length + 1,
  );

  const readinessCalls = fixture.calls.slice(4, 4 + readinessRequestCount);
  assert.equal(readinessCalls.length, readinessRequestCount);
  for (const call of readinessCalls) {
    assert.equal(call.url, "https://hah.dev/api/lattice");
    assert.equal(call.init.method, "GET");
    assert.equal(call.init.headers.Accept, "application/json");
    assert.equal(Object.hasOwn(call.init, "body"), false);
    assert.equal(Object.keys(call.init.headers).some((name) => name.toLowerCase() === "origin"), false);
    assert.equal(Object.keys(call.init.headers).some((name) => name.toLowerCase() === "cookie"), false);
    assert.equal(Object.keys(call.init.headers).some((name) => name.toLowerCase() === "content-type"), false);
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

  const canaryCall = fixture.calls.at(-1);
  assert.match(canaryCall.init.headers.Cookie, /^__Secure-hah-lattice-api-visitor=v1\./u);
  assert.equal(canaryCall.init.headers.Cookie.includes(";"), false);
  assert.equal(
    canaryCall.init.headers[LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER],
    LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  );

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

  const serializedEvidence = JSON.stringify(evidence);
  assert.ok(fixture.canaryText.length > 0);
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
        assert.equal(fixture.calls.length, SUCCESSFUL_PRODUCTION_REQUEST_COUNT - 1);
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
    activeReadinessResponse(),
    heldReadinessResponse(),
    activeReadinessResponse(),
    activeReadinessResponse(),
    activeReadinessResponse(),
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
    method: "GET",
    path: "/api/lattice",
    required_consecutive_active_samples: 3,
    observed_consecutive_active_samples: 3,
    active_response_count: 4,
    held_response_count: 2,
    network_error_count: 1,
    final_http_status: 405,
    final_error_code: "invalid_request",
    request_body_present: false,
    request_body_bytes: 0,
    origin_header_present: false,
    cookie_header_present: false,
    visitor_session_created: false,
    quota_claimed: false,
    provider_called: false,
    response_bodies_retained: false,
  });
  assert.equal(fixture.setupRequests, 1);
  assert.equal(fixture.canaryRequests, 1);

  const readinessCalls = fixture.calls.slice(4, 4 + readinessResponses.length);
  assert.equal(readinessCalls.length, readinessResponses.length);
  for (const { url, init } of readinessCalls) {
    assert.equal(url, "https://hah.dev/api/lattice");
    assert.equal(init.method, "GET");
    assert.deepEqual(init.headers, { Accept: "application/json" });
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
    init.method === "GET"
      && !Object.hasOwn(init, "body")
      && Object.keys(init.headers).every((name) => !["cookie", "origin", "content-type"].includes(
        name.toLowerCase(),
      ))
  )));
});

test("active-API readiness fails immediately on any non-exact complete response", async (contextTest) => {
  const cases = [
    [
      "unexpected status",
      apiJson({ error: "invalid_request" }, 200),
      /returned HTTP 200; expected the active 405 or held 503 boundary/u,
    ],
    [
      "malformed held headers",
      apiJson({ error: "upstream_unavailable" }, 503),
      /omitted content-security-policy/u,
    ],
    [
      "malformed active envelope",
      apiJson({ error: "upstream_unavailable" }, 405, { Allow: "POST" }),
      /unexpected closed error envelope/u,
    ],
    [
      "oversized active body",
      new Response("x".repeat(4_097), {
        status: 405,
        headers: { ...apiHeaders, Allow: "POST" },
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
  assert.equal(fixture.setupRequests, 1);
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
        [LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.failureClass]:
          "provider_http_error",
        [LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.upstreamStatus]: "503",
        [LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.stage]: "analysis",
        [LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.callOrdinal]: "1",
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
    /synthetic transformation canary returned HTTP 502 \(upstream_unavailable\); failure_class=provider_http_error; upstream_status=503; stage=analysis; call_ordinal=1/u,
  );
  assert.equal(fixture.canaryRequests, 1);
  assert.equal(fixture.setupRequests, 1);
  assert.equal(fixture.calls.length, SUCCESSFUL_PRODUCTION_REQUEST_COUNT);
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
  const exactDiagnostic = {
    [LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.failureClass]:
      "provider_http_error",
    [LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.upstreamStatus]: "503",
    [LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.stage]: "analysis",
    [LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.callOrdinal]: "1",
  };
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
      assert.equal(fixture.calls.length, SUCCESSFUL_PRODUCTION_REQUEST_COUNT);
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
        new RegExp(`class=${expectedClass}; batch_count=2; verification_passes=0; finding_count=2`, "u"),
      );
      assert.equal(failure.message.includes(privateMarker), false);
      assert.equal(fixture.canaryRequests, 1);
      assert.equal(fixture.setupRequests, 1);
      assert.equal(fixture.calls.length, SUCCESSFUL_PRODUCTION_REQUEST_COUNT);
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
      assert.equal(fixture.calls.length, SUCCESSFUL_PRODUCTION_REQUEST_COUNT);
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

test("the rollback verifier binds one held Worker version to a bounded public 503 without content evidence", async () => {
  let calls = 0;
  const evidence = await verifyTextToLatticeHeldApi({
    deploymentStatus: {
      id: "deployment-held-123",
      created_on: "2026-09-14T12:35:00.000Z",
      versions: [{
        version_id: "123e4567-e89b-42d3-a456-426614174000",
        percentage: 100,
      }],
    },
    environment: {
      GITHUB_REPOSITORY: context.repository,
      GITHUB_SHA: context.commit,
      GITHUB_RUN_ID: context.runId,
      GITHUB_RUN_ATTEMPT: context.runAttempt,
      GITHUB_SERVER_URL: context.serverUrl,
    },
    now: fixedNow,
    async fetchImpl(url, init) {
      calls += 1;
      assert.equal(url, "https://hah.dev/api/lattice");
      assert.equal(init.method, "GET");
      return apiJson({ error: "upstream_unavailable" }, 503, {
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      });
    },
  });
  assert.equal(calls, 1);
  assert.equal(evidence.format, "TEXT_TO_LATTICE_HELD_ROLLBACK_EVIDENCE");
  assert.equal(evidence.worker.versionId, "123e4567-e89b-42d3-a456-426614174000");
  assert.equal(evidence.boundary.httpStatus, 503);
  assert.equal(evidence.boundary.errorCode, "upstream_unavailable");
  assert.equal(evidence.contentBodiesRetained, false);
  assert.equal(evidence.secretValuesRead, false);
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
