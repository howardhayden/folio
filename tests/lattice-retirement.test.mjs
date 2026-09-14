import assert from "node:assert/strict";
import test from "node:test";

import {
  retireTextToLatticeLegacySurfaces,
  textToLatticeRetirementFailureEvidence,
} from "../scripts/retire-text-to-lattice-legacy-surfaces.mjs";

const accountId = "a".repeat(32);
const zoneId = "b".repeat(32);
const apiToken = "protected-test-token-value-123456";
const leaseRoute = Object.freeze({
  id: "lease-route-id-1234",
  pattern: "hah.dev/api/text-to-lattice/lease",
  script: "hahdev-text-to-lattice-lease",
});
const verificationDomain = Object.freeze({
  id: "frame-domain-id-1234",
  hostname: "verify.hah.dev",
  service: "hahdev-text-to-lattice-attestation-frame",
});

function apiResponse(result) {
  return new Response(JSON.stringify({ success: true, errors: [], messages: [], result }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function retirementFixture({
  initialRoutes = [leaseRoute],
  initialDomains = [verificationDomain],
} = {}) {
  let routes = structuredClone(initialRoutes);
  let domains = structuredClone(initialDomains);
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? "GET";
    calls.push(Object.freeze({ method, pathname: `${url.pathname}${url.search}` }));
    assert.equal(new Headers(init.headers).get("Authorization"), `Bearer ${apiToken}`);
    assert.equal(init.credentials, "omit");
    assert.equal(init.redirect, "error");
    if (method === "GET" && url.pathname === "/client/v4/zones") {
      assert.equal(url.searchParams.get("name"), "hah.dev");
      assert.equal(url.searchParams.get("status"), "active");
      return apiResponse([{ id: zoneId, name: "hah.dev", status: "active" }]);
    }
    if (method === "GET" && url.pathname === `/client/v4/zones/${zoneId}/workers/routes`) {
      return apiResponse(routes);
    }
    if (method === "GET" && url.pathname === `/client/v4/accounts/${accountId}/workers/domains`) {
      return apiResponse(domains);
    }
    if (method === "DELETE"
      && url.pathname === `/client/v4/zones/${zoneId}/workers/routes/${leaseRoute.id}`) {
      routes = routes.filter(({ id }) => id !== leaseRoute.id);
      return apiResponse(null);
    }
    if (method === "DELETE"
      && url.pathname === `/client/v4/accounts/${accountId}/workers/domains/${verificationDomain.id}`) {
      domains = domains.filter(({ id }) => id !== verificationDomain.id);
      return apiResponse(null);
    }
    throw new Error(`Unexpected Cloudflare request: ${method} ${url.pathname}`);
  };
  return { calls, fetchImpl };
}

const fixedNow = () => new Date("2026-09-14T09:00:00.000Z");

test("legacy retirement defaults to a read-only exact plan with sanitized evidence", async () => {
  const fixture = retirementFixture();
  const result = await retireTextToLatticeLegacySurfaces({
    accountId,
    apiToken,
    fetchImpl: fixture.fetchImpl,
    now: fixedNow,
  });

  assert.deepEqual(result, {
    format: "TEXT_TO_LATTICE_RETIREMENT_EVIDENCE",
    schemaVersion: 1,
    observedAt: "2026-09-14T09:00:00.000Z",
    mode: "plan",
    outcome: "planned",
    zone: "hah.dev",
    before: {
      leaseRoute: {
        script: "hahdev-text-to-lattice-lease",
        route: "hah.dev/api/text-to-lattice/lease",
        status: "attached",
      },
      verificationDomain: {
        script: "hahdev-text-to-lattice-attestation-frame",
        hostname: "verify.hah.dev",
        status: "attached",
      },
    },
    plannedMutations: [
      { kind: "detach-zone-route", target: "hah.dev/api/text-to-lattice/lease" },
      { kind: "detach-custom-domain", target: "verify.hah.dev" },
    ],
    preflightVerified: false,
    appliedMutationCount: 0,
    after: null,
    activationReady: false,
    workerScriptsDeleted: false,
    durableObjectStorageDeleted: false,
    secretValuesRead: false,
  });
  assert.equal(fixture.calls.some(({ method }) => method === "DELETE"), false);
  assert.doesNotMatch(JSON.stringify(result), /protected-test-token|lease-route-id|frame-domain-id/u);
});

test("legacy retirement apply detaches only the two exact entry surfaces and verifies absence", async () => {
  const fixture = retirementFixture();
  const result = await retireTextToLatticeLegacySurfaces({
    accountId,
    apiToken,
    apply: true,
    fetchImpl: fixture.fetchImpl,
    now: fixedNow,
  });

  assert.equal(result.mode, "apply");
  assert.equal(result.outcome, "applied-and-verified");
  assert.equal(result.appliedMutationCount, 2);
  assert.equal(result.preflightVerified, true);
  assert.equal(result.activationReady, true);
  assert.equal(result.after.leaseRoute.status, "detached");
  assert.equal(result.after.verificationDomain.status, "detached");
  assert.equal(result.workerScriptsDeleted, false);
  assert.equal(result.durableObjectStorageDeleted, false);
  assert.deepEqual(
    fixture.calls.filter(({ method }) => method === "DELETE"),
    [
      {
        method: "DELETE",
        pathname: `/client/v4/zones/${zoneId}/workers/routes/${leaseRoute.id}`,
      },
      {
        method: "DELETE",
        pathname: `/client/v4/accounts/${accountId}/workers/domains/${verificationDomain.id}`,
      },
    ],
  );
  assert.equal(fixture.calls.some(({ pathname }) => /workers\/scripts|storage|durable_objects/u.test(pathname)), false);
});

test("legacy retirement produces a conservative sanitized failure disposition", () => {
  assert.deepEqual(textToLatticeRetirementFailureEvidence({
    apply: true,
    now: fixedNow,
  }), {
    format: "TEXT_TO_LATTICE_RETIREMENT_EVIDENCE",
    schemaVersion: 1,
    observedAt: "2026-09-14T09:00:00.000Z",
    mode: "apply",
    outcome: "failed-closed",
    zone: "hah.dev",
    before: null,
    plannedMutations: null,
    preflightVerified: false,
    appliedMutationCount: null,
    after: null,
    activationReady: false,
    entrySurfaceDisposition: "unknown-or-partial",
    workerScriptsDeleted: false,
    durableObjectStorageDeleted: false,
    secretValuesRead: false,
  });
});

test("legacy retirement apply is idempotent when both entry surfaces are already absent", async () => {
  const fixture = retirementFixture({ initialRoutes: [], initialDomains: [] });
  const result = await retireTextToLatticeLegacySurfaces({
    accountId,
    apiToken,
    apply: true,
    fetchImpl: fixture.fetchImpl,
    now: fixedNow,
  });

  assert.deepEqual(result.plannedMutations, []);
  assert.equal(result.appliedMutationCount, 0);
  assert.equal(result.activationReady, true);
  assert.equal(fixture.calls.some(({ method }) => method === "DELETE"), false);
});

test("legacy retirement refuses ownership mismatches and extra legacy surfaces before mutation", async () => {
  const cases = [
    {
      initialRoutes: [{ ...leaseRoute, script: "unreviewed-worker" }],
      initialDomains: [verificationDomain],
      message: /is not owned by hahdev-text-to-lattice-lease/u,
    },
    {
      initialRoutes: [leaseRoute, {
        id: "extra-route-id-1234",
        pattern: "hah.dev/api/unreviewed-lease-entry",
        script: "hahdev-text-to-lattice-lease",
      }],
      initialDomains: [verificationDomain],
      message: /owns an extra zone route/u,
    },
    {
      initialRoutes: [leaseRoute],
      initialDomains: [{ ...verificationDomain, service: "unreviewed-worker" }],
      message: /is not owned by hahdev-text-to-lattice-attestation-frame/u,
    },
    {
      initialRoutes: [leaseRoute],
      initialDomains: [verificationDomain, {
        id: "extra-domain-id-1234",
        hostname: "unreviewed.hah.dev",
        service: "hahdev-text-to-lattice-attestation-frame",
      }],
      message: /owns an extra custom domain/u,
    },
  ];

  for (const { message, ...fixtureOptions } of cases) {
    const fixture = retirementFixture(fixtureOptions);
    await assert.rejects(retireTextToLatticeLegacySurfaces({
      accountId,
      apiToken,
      apply: true,
      fetchImpl: fixture.fetchImpl,
      now: fixedNow,
    }), message);
    assert.equal(fixture.calls.some(({ method }) => method === "DELETE"), false);
  }
});
