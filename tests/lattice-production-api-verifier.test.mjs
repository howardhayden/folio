import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { LATTICE_RESULT_VERSION } from "../app/resume/lattice/remoteProtocol.js";
import {
  LATTICE_PRODUCTION_EVIDENCE_SCHEMA,
  LATTICE_PRODUCTION_NEGATIVE_PROBE_CONTRACT,
  LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS,
  LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT,
  serializeLatticeProductionEvidence,
  verifyTextToLatticeApiProduction,
} from "../scripts/verify-text-to-lattice-api-production.mjs";
import {
  verifyTextToLatticeHeldApi,
} from "../scripts/verify-text-to-lattice-held-api.mjs";
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

function successfulFixture({ canaryResponse, setupResponse } = {}) {
  const calls = [];
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
    get setupRequests() { return setupRequests; },
    get canaryRequests() { return canaryRequests; },
    get canaryText() { return canaryText; },
  };
}

test("the production verifier establishes one bodyless visitor session before exactly one content canary", async () => {
  const fixture = successfulFixture();
  const evidence = await verifyTextToLatticeApiProduction({
    fetchImpl: fixture.fetchImpl,
    context,
    now: fixedNow,
  });

  assert.equal(evidence.format, LATTICE_PRODUCTION_EVIDENCE_SCHEMA);
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.verified_at, "2026-09-14T12:34:56.000Z");
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
  assert.equal(fixture.calls.length, 4 + 1 + LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS.length + 1);

  const setupCall = fixture.calls[4];
  assert.equal(setupCall.init.method, "POST");
  assert.equal(setupCall.init.headers.Accept, LATTICE_PRODUCTION_VISITOR_SESSION_ACCEPT);
  assert.equal(Object.hasOwn(setupCall.init, "body"), false);
  assert.equal(Object.keys(setupCall.init.headers).some((name) => name.toLowerCase() === "content-type"), false);
  assert.equal(Object.keys(setupCall.init.headers).some((name) => name.toLowerCase() === "cookie"), false);

  const canaryCall = fixture.calls.at(-1);
  assert.match(canaryCall.init.headers.Cookie, /^__Secure-hah-lattice-api-visitor=v1\./u);
  assert.equal(canaryCall.init.headers.Cookie.includes(";"), false);

  const missingSessionCall = fixture.calls[
    5 + LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS.indexOf("missing-visitor-session")
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

  const credentialCalls = fixture.calls.slice(5)
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

test("a failed transformation canary is attempted once without retry or retained content", async () => {
  const fixture = successfulFixture({
    canaryResponse: apiJson(
      { error: "upstream_unavailable" },
      502,
    ),
  });
  await assert.rejects(
    verifyTextToLatticeApiProduction({ fetchImpl: fixture.fetchImpl, context, now: fixedNow }),
    /synthetic transformation canary returned HTTP 502 \(upstream_unavailable\)/u,
  );
  assert.equal(fixture.canaryRequests, 1);
  assert.equal(fixture.setupRequests, 1);
  assert.equal(fixture.calls.length, 4 + 1 + LATTICE_PRODUCTION_NEGATIVE_PROBE_IDS.length + 1);
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
      verifyTextToLatticeApiProduction({ fetchImpl: fixture.fetchImpl, context, now: fixedNow }),
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
    verifyTextToLatticeApiProduction({ fetchImpl: fixture.fetchImpl, context, now: fixedNow }),
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
