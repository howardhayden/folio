import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import {
  buildTextToLatticeDeploymentEvidence,
  parseTextToLatticeDeploymentEvidenceIndexText,
  sanitizeTextToLatticeApiVersion,
  sanitizeTextToLatticeDeploymentStatus,
  verifyTextToLatticeDeploymentEvidenceIndex,
} from "../scripts/build-text-to-lattice-deployment-evidence.mjs";
import { hashRegularFileSha256 } from "../scripts/hash-regular-file-sha256.mjs";
import { readTextToLatticeActiveVersion } from "../scripts/read-text-to-lattice-active-version.mjs";
import {
  readCurrentGithubActionsJobId,
  resolveGithubActionsJobId,
} from "../scripts/resolve-github-actions-job-id.mjs";

const apiVersion = "11111111-1111-4111-8111-111111111111";
const policyVersion = "22222222-2222-4222-8222-222222222222";
const apiDeploymentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const policyDeploymentId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const deploymentCustody = Object.freeze({
  serviceJobId: "102999999999",
  pagesArtifactId: "987654321",
  siteArtifactSha256: createHash("sha256").update("exact-pages-artifact.tar").digest("hex"),
  qualifiedSourceSetSha256: createHash("sha256").update("qualified-source-set").digest("hex"),
});

function jobsApiPayload(overrides = {}) {
  const job = {
    id: Number(deploymentCustody.serviceJobId),
    run_id: 123456789,
    head_sha: "a".repeat(40),
    html_url: `https://github.com/howardhayden/folio/actions/runs/123456789/job/${deploymentCustody.serviceJobId}`,
    status: "in_progress",
    conclusion: null,
    name: "Qualify or verify Text to Lattice services",
    check_run_url: `https://api.github.com/repos/howardhayden/folio/check-runs/${deploymentCustody.serviceJobId}`,
    ...overrides,
  };
  return { total_count: 1, jobs: [job] };
}

function deployment(id, versionId, overrides = {}) {
  return {
    id,
    source: "wrangler",
    author_email: "must-not-be-retained@example.test",
    created_on: "2026-09-14T08:00:00.000Z",
    versions: [{ version_id: versionId, percentage: 100 }],
    ...overrides,
  };
}

function apiVersionView(overrides = {}) {
  return {
    id: apiVersion,
    metadata: {
      author_email: "must-not-be-retained@example.test",
      source: "wrangler",
    },
    resources: {
      bindings: [
        { name: "HF_TOKEN", type: "secret_text" },
        { name: "VISITOR_COOKIE_SECRET", type: "secret_text" },
        {
          name: "LATTICE_API_RATE_LIMITER",
          type: "ratelimit",
          namespace_id: "857321",
          simple: { limit: 30, period: 60 },
        },
        {
          name: "LATTICE_TRANSFORMATION_BUDGET",
          type: "durable_object_namespace",
          class_name: "LatticeTransformationBudget",
          namespace_id: "provider-budget-namespace-must-not-be-retained",
        },
      ],
    },
    ...overrides,
  };
}

function environment(overrides = {}) {
  return {
    GITHUB_REPOSITORY: "howardhayden/folio",
    GITHUB_SHA: "a".repeat(40),
    GITHUB_REF: "refs/heads/main",
    GITHUB_RUN_ID: "123456789",
    GITHUB_RUN_ATTEMPT: "2",
    GITHUB_SERVER_URL: "https://github.com",
    ...overrides,
  };
}

async function withEvidenceFiles(callback, overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), "lattice-deployment-evidence-"));
  const paths = {
    apiDeploymentPath: join(directory, "api.raw.json"),
    apiVersionPath: join(directory, "api-version.raw.json"),
    policyDeploymentPath: join(directory, "policy.raw.json"),
    secretEvidencePath: join(directory, "secret-bindings.json"),
    routeEvidencePath: join(directory, "route-inventory.json"),
    liveEvidencePath: join(directory, "live-boundary.json"),
  };
  const values = {
    apiDeploymentPath: deployment(apiDeploymentId, apiVersion),
    apiVersionPath: apiVersionView(),
    policyDeploymentPath: deployment(policyDeploymentId, policyVersion),
    secretEvidencePath: {
      format: "TEXT_TO_LATTICE_SECRET_BINDING_EVIDENCE",
      schemaVersion: 1,
      worker: "hahdev-text-to-lattice-api",
      bindings: [
        { name: "HF_TOKEN", type: "secret_text" },
        { name: "VISITOR_COOKIE_SECRET", type: "secret_text" },
      ],
      valuesRead: false,
    },
    routeEvidencePath: {
      format: "TEXT_TO_LATTICE_ROUTE_INVENTORY_EVIDENCE",
      schemaVersion: 1,
      releasePhase: "held",
      active: [],
      retired: [{
        script: "hahdev-text-to-lattice-lease",
        status: "retirement-required",
        observedRoutes: ["hah.dev/api/text-to-lattice/lease"],
      }],
    },
    liveEvidencePath: {
      format: "TEXT_TO_LATTICE_REMOTE_DEPLOYMENT_EVIDENCE",
      schemaVersion: 1,
      checks: [{ id: "wrong-method", status: 405, bodyRetained: false }],
    },
    ...overrides,
  };
  try {
    await Promise.all(Object.entries(paths).map(([key, pathname]) => (
      writeFile(pathname, `${JSON.stringify(values[key])}\n`, "utf8")
    )));
    await callback(paths);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("deployment status evidence requires one 100-percent immutable Worker version", () => {
  assert.deepEqual(
    sanitizeTextToLatticeDeploymentStatus(
      deployment("api-deployment-1", apiVersion),
      "hahdev-text-to-lattice-api",
    ),
    {
      worker: "hahdev-text-to-lattice-api",
      deploymentId: "api-deployment-1",
      versionId: apiVersion,
      percentage: 100,
      createdAt: "2026-09-14T08:00:00.000Z",
    },
  );
  assert.throws(
    () => sanitizeTextToLatticeDeploymentStatus(
      deployment("api-deployment-1", apiVersion, {
        versions: [
          { version_id: apiVersion, percentage: 50 },
          { version_id: policyVersion, percentage: 50 },
        ],
      }),
      "hahdev-text-to-lattice-api",
    ),
    /exactly one production version/u,
  );
  assert.throws(
    () => sanitizeTextToLatticeDeploymentStatus(
      deployment("api-deployment-1", "not-a-version"),
      "hahdev-text-to-lattice-api",
    ),
    /100 percent/u,
  );
});

test("the active API version has exactly the reviewed production bindings", async () => {
  assert.deepEqual(sanitizeTextToLatticeApiVersion(apiVersionView(), apiVersion), {
    worker: "hahdev-text-to-lattice-api",
    versionId: apiVersion,
    bindings: [
      { name: "HF_TOKEN", type: "secret_text" },
      { name: "VISITOR_COOKIE_SECRET", type: "secret_text" },
      {
        name: "LATTICE_API_RATE_LIMITER",
        type: "ratelimit",
        namespaceId: "857321",
        simple: { limit: 30, period: 60 },
      },
      {
        name: "LATTICE_TRANSFORMATION_BUDGET",
        type: "durable_object_namespace",
        className: "LatticeTransformationBudget",
      },
    ],
    bindingSetExact: true,
    secretValuesRead: false,
  });

  await withEvidenceFiles(async ({ apiDeploymentPath }) => {
    assert.equal(await readTextToLatticeActiveVersion(apiDeploymentPath), apiVersion);
  });
  await withEvidenceFiles(async ({ apiDeploymentPath }) => {
    await assert.rejects(
      readTextToLatticeActiveVersion(apiDeploymentPath),
      /exactly one production version/u,
    );
  }, {
    apiDeploymentPath: deployment("split-deployment", apiVersion, {
      versions: [
        { version_id: apiVersion, percentage: 50 },
        { version_id: policyVersion, percentage: 50 },
      ],
    }),
  });

  for (const bindings of [
    [...apiVersionView().resources.bindings, {
      name: "UNREVIEWED_QUEUE",
      type: "queue",
      queue_name: "must-not-exist",
    }],
    apiVersionView().resources.bindings.map((binding) => (
      binding.name === "LATTICE_API_RATE_LIMITER"
        ? { ...binding, namespace_id: "857322" }
        : binding
    )),
    apiVersionView().resources.bindings.map((binding) => (
      binding.name === "LATTICE_TRANSFORMATION_BUDGET"
        ? { ...binding, class_name: "UnreviewedClass" }
        : binding
    )),
    apiVersionView().resources.bindings.map((binding) => (
      binding.name === "HF_TOKEN" ? { ...binding, text: "must-not-be-returned" } : binding
    )),
  ]) {
    assert.throws(
      () => sanitizeTextToLatticeApiVersion(apiVersionView({ resources: { bindings } }), apiVersion),
      /exactly 4 reviewed bindings|rate-limit binding|Durable Object binding|exposed secret material/u,
    );
  }
  assert.throws(
    () => sanitizeTextToLatticeApiVersion(apiVersionView(), policyVersion),
    /does not match its deployment status/u,
  );

  const qualificationExpiresAt = "2026-09-14T08:30:00.000Z";
  const qualificationRaw = apiVersionView({
    resources: {
      bindings: [
        ...apiVersionView().resources.bindings,
        {
          name: "LATTICE_QUALIFICATION_EXPIRES_AT",
          type: "plain_text",
          text: qualificationExpiresAt,
        },
      ],
    },
  });
  const qualified = sanitizeTextToLatticeApiVersion(qualificationRaw, apiVersion, {
    qualificationExpiresAt,
  });
  assert.deepEqual(qualified.bindings.at(-1), {
    name: "LATTICE_QUALIFICATION_EXPIRES_AT",
    type: "plain_text",
    expiresAt: qualificationExpiresAt,
  });
  assert.doesNotMatch(JSON.stringify(qualified), /"text"/u);
  assert.throws(
    () => sanitizeTextToLatticeApiVersion(qualificationRaw, apiVersion),
    /exactly 4 reviewed bindings/u,
  );
  const wrongExpiryRaw = structuredClone(qualificationRaw);
  wrongExpiryRaw.resources.bindings.at(-1).text = "2026-09-14T08:31:00.000Z";
  assert.throws(
    () => sanitizeTextToLatticeApiVersion(wrongExpiryRaw, apiVersion, { qualificationExpiresAt }),
    /qualification-expiry binding is not the reviewed timestamp/u,
  );
});

test("deployment evidence retains only sanitized identities and evidence digests", async () => {
  await withEvidenceFiles(async (paths) => {
    const result = await buildTextToLatticeDeploymentEvidence({
      ...paths,
      ...deploymentCustody,
      environment: environment(),
      now: () => new Date("2026-09-14T08:05:00.000Z"),
    });
    assert.equal(result.format, "TEXT_TO_LATTICE_DEPLOYMENT_EVIDENCE_INDEX");
    assert.equal(result.generatedAt, "2026-09-14T08:05:00.000Z");
    assert.equal(result.deployedAt, result.generatedAt);
    assert.equal(result.deployedAtBasis, "post-live-verification-service-evidence-index-generation");
    assert.equal(result.canonicalUrl, "https://hah.dev/resume/#text-to-lattice");
    assert.deepEqual(result.workflow, {
      repository: "howardhayden/folio",
      commit: "a".repeat(40),
      ref: "refs/heads/main",
      runId: "123456789",
      runAttempt: "2",
      runUrl: "https://github.com/howardhayden/folio/actions/runs/123456789",
    });
    assert.equal(result.serviceJobId, deploymentCustody.serviceJobId);
    assert.equal(result.pagesArtifactId, deploymentCustody.pagesArtifactId);
    assert.equal(result.siteArtifactSha256, deploymentCustody.siteArtifactSha256);
    assert.equal(result.qualifiedSourceSetSha256, deploymentCustody.qualifiedSourceSetSha256);
    assert.equal(result.workers.api.versionId, apiVersion);
    assert.equal(result.workers.api.bindingSetExact, true);
    assert.deepEqual(
      result.workers.api.activeVersionBindings.map(({ name, type }) => ({ name, type })),
      [
        { name: "HF_TOKEN", type: "secret_text" },
        { name: "VISITOR_COOKIE_SECRET", type: "secret_text" },
        { name: "LATTICE_API_RATE_LIMITER", type: "ratelimit" },
        { name: "LATTICE_TRANSFORMATION_BUDGET", type: "durable_object_namespace" },
      ],
    );
    assert.equal(result.workers.responsePolicy.versionId, policyVersion);
    assert.ok(Object.values(result.evidenceFiles).every(({ sha256 }) => /^[a-f0-9]{64}$/u.test(sha256)));
    assert.equal(result.rawWranglerStatusRetained, false);
    assert.equal(result.rawWranglerVersionRetained, false);
    assert.equal(result.contentBodiesRetained, false);
    assert.equal(result.secretValuesRead, false);
    assert.equal(verifyTextToLatticeDeploymentEvidenceIndex(result), result);
    assert.deepEqual(
      parseTextToLatticeDeploymentEvidenceIndexText(`${JSON.stringify(result, null, 2)}\n`),
      result,
    );
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(
      serialized,
      /must-not-be-retained|provider-budget-namespace|author_email|Bearer|hf_[A-Za-z0-9]{8,}/u,
    );
  });
});

test("deployment evidence requires exact workflow-to-Pages custody identities", async () => {
  await withEvidenceFiles(async (paths) => {
    for (const [field, value, expression] of [
      ["serviceJobId", "0", /serviceJobId must be a positive decimal/u],
      ["pagesArtifactId", "artifact-1", /pagesArtifactId must be a positive decimal/u],
      ["siteArtifactSha256", "0".repeat(64), /nonzero lowercase SHA-256/u],
      ["qualifiedSourceSetSha256", "0".repeat(64), /nonzero lowercase SHA-256/u],
    ]) {
      await assert.rejects(
        buildTextToLatticeDeploymentEvidence({
          ...paths,
          ...deploymentCustody,
          [field]: value,
          environment: environment(),
        }),
        expression,
      );
    }
  });
});

test("qualification deployment index binds one expiring Worker version without raw binding text", async () => {
  const qualificationExpiresAt = "2026-09-14T08:30:00.000Z";
  const qualificationApi = apiVersionView({
    resources: {
      bindings: [
        ...apiVersionView().resources.bindings,
        {
          name: "LATTICE_QUALIFICATION_EXPIRES_AT",
          type: "plain_text",
          text: qualificationExpiresAt,
        },
      ],
    },
  });
  await withEvidenceFiles(async (paths) => {
    const result = await buildTextToLatticeDeploymentEvidence({
      ...paths,
      ...deploymentCustody,
      qualificationExpiresAt,
      environment: environment(),
      now: () => new Date("2026-09-14T08:05:00.000Z"),
    });
    assert.equal(result.qualificationExpiresAt, qualificationExpiresAt);
    assert.deepEqual(result.workers.api.activeVersionBindings.at(-1), {
      name: "LATTICE_QUALIFICATION_EXPIRES_AT",
      type: "plain_text",
      expiresAt: qualificationExpiresAt,
    });
    assert.doesNotMatch(JSON.stringify(result), /"text"/u);
  }, { apiVersionPath: qualificationApi });
});

test("closed deployment-index validation rejects identity and custody drift", async () => {
  await withEvidenceFiles(async (paths) => {
    const result = await buildTextToLatticeDeploymentEvidence({
      ...paths,
      ...deploymentCustody,
      environment: environment(),
      now: () => new Date("2026-09-14T08:05:00.000Z"),
    });
    for (const mutate of [
      (candidate) => { candidate.extra = true; },
      (candidate) => { candidate.deployedAt = "2026-09-14T08:05:01.000Z"; },
      (candidate) => { candidate.canonicalUrl = "https://hah.dev/resume/"; },
      (candidate) => { candidate.workflow.runUrl = "https://github.com/other/repo/actions/runs/123456789"; },
      (candidate) => { candidate.workers.api.versionId = candidate.workers.responsePolicy.versionId; },
      (candidate) => { candidate.evidenceFiles.liveBoundary.sha256 = "0".repeat(64); },
      (candidate) => { candidate.qualifiedSourceSetSha256 = "0".repeat(64); },
      (candidate) => { candidate.contentBodiesRetained = true; },
    ]) {
      const candidate = structuredClone(result);
      mutate(candidate);
      assert.throws(
        () => verifyTextToLatticeDeploymentEvidenceIndex(candidate),
        /deployment evidence|deployedAt|canonical URL|workflow|Worker|SHA-256|contentBodiesRetained/u,
      );
    }
    assert.throws(
      () => parseTextToLatticeDeploymentEvidenceIndexText(JSON.stringify(result)),
      /canonical two-space JSON/u,
    );
  });
});

test("deployment-index CLI writes canonical JSON and its exact SHA-256 sidecar", async () => {
  const qualificationExpiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  await withEvidenceFiles(async (paths) => {
    const outputPath = join(dirname(paths.apiDeploymentPath), "deployment-index.json");
    const command = spawnSync(process.execPath, [
      resolve("scripts/build-text-to-lattice-deployment-evidence.mjs"),
      "--api-deployment", paths.apiDeploymentPath,
      "--api-version", paths.apiVersionPath,
      "--policy-deployment", paths.policyDeploymentPath,
      "--secret-evidence", paths.secretEvidencePath,
      "--route-evidence", paths.routeEvidencePath,
      "--live-evidence", paths.liveEvidencePath,
      "--service-job-id", deploymentCustody.serviceJobId,
      "--pages-artifact-id", deploymentCustody.pagesArtifactId,
      "--site-artifact-sha256", deploymentCustody.siteArtifactSha256,
      "--qualified-source-set-sha256", deploymentCustody.qualifiedSourceSetSha256,
      "--qualification-expires-at", qualificationExpiresAt,
      "--output", outputPath,
    ], {
      encoding: "utf8",
      env: { ...process.env, ...environment() },
    });
    assert.equal(command.status, 0, command.stderr);
    const bytes = await readFile(outputPath);
    const index = parseTextToLatticeDeploymentEvidenceIndexText(bytes.toString("utf8"));
    assert.equal(index.qualificationExpiresAt, qualificationExpiresAt);
    assert.equal(
      await readFile(`${outputPath}.sha256`, "utf8"),
      `${createHash("sha256").update(bytes).digest("hex")}  deployment-index.json\n`,
    );
  }, {
    apiVersionPath: apiVersionView({
      resources: {
        bindings: [
          ...apiVersionView().resources.bindings,
          {
            name: "LATTICE_QUALIFICATION_EXPIRES_AT",
            type: "plain_text",
            text: qualificationExpiresAt,
          },
        ],
      },
    }),
  });
});

test("regular-file hashing is exact, bounded, and refuses symbolic links", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "lattice-site-artifact-hash-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const artifactPath = join(directory, "artifact.tar");
  const bytes = Buffer.from("exact uploaded Pages artifact bytes");
  await writeFile(artifactPath, bytes);
  assert.deepEqual(await hashRegularFileSha256(artifactPath), {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteCount: bytes.byteLength,
  });
  await assert.rejects(
    hashRegularFileSha256(artifactPath, { maximumBytes: bytes.byteLength - 1 }),
    /must be 1 through/u,
  );
  const linkPath = join(directory, "artifact-link.tar");
  await symlink(artifactPath, linkPath);
  await assert.rejects(hashRegularFileSha256(linkPath), /without following a symbolic link/u);

  const githubOutputPath = join(directory, "github-output");
  const command = spawnSync(process.execPath, [
    resolve("scripts/hash-regular-file-sha256.mjs"),
    artifactPath,
    "--github-output",
    githubOutputPath,
  ], { encoding: "utf8" });
  assert.equal(command.status, 0, command.stderr);
  assert.equal(
    await readFile(githubOutputPath, "utf8"),
    `sha256=${createHash("sha256").update(bytes).digest("hex")}\nbyte_count=${bytes.byteLength}\n`,
  );
});

test("service-job resolver returns only the exact current Actions job ID", async () => {
  const identity = {
    repository: "howardhayden/folio",
    runId: "123456789",
    commit: "a".repeat(40),
    jobName: "Qualify or verify Text to Lattice services",
  };
  assert.equal(
    resolveGithubActionsJobId(jobsApiPayload(), identity),
    deploymentCustody.serviceJobId,
  );
  for (const payload of [
    { total_count: 2, jobs: jobsApiPayload().jobs },
    { total_count: 1, jobs: [{ ...jobsApiPayload().jobs[0], head_sha: "b".repeat(40) }] },
    { total_count: 1, jobs: [{ ...jobsApiPayload().jobs[0], status: "completed", conclusion: "success" }] },
    { total_count: 1, jobs: [{ ...jobsApiPayload().jobs[0], check_run_url: "https://api.github.com/repos/howardhayden/folio/check-runs/1" }] },
  ]) {
    assert.throws(
      () => resolveGithubActionsJobId(payload, identity),
      /complete, unpaginated|exactly one current|currently executing|check-run identity/u,
    );
  }

  const requests = [];
  assert.equal(await readCurrentGithubActionsJobId({
    environment: {
      ...environment(),
      GITHUB_API_URL: "https://api.github.com",
      GITHUB_TOKEN: "test-token-not-a-production-secret",
    },
    jobName: identity.jobName,
    async fetchImpl(url, init) {
      requests.push({ url, init });
      return new Response(JSON.stringify(jobsApiPayload()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  }), deploymentCustody.serviceJobId);
  assert.equal(
    requests[0].url,
    "https://api.github.com/repos/howardhayden/folio/actions/runs/123456789/attempts/2/jobs?per_page=100",
  );
  assert.equal(requests[0].init.credentials, "omit");
  assert.equal(requests[0].init.redirect, "error");
  assert.equal(requests[0].init.headers.Authorization, "Bearer test-token-not-a-production-secret");
  await assert.rejects(
    readCurrentGithubActionsJobId({
      environment: {
        ...environment(),
        GITHUB_API_URL: "https://untrusted.example",
        GITHUB_TOKEN: "must-not-be-sent",
      },
      jobName: identity.jobName,
      async fetchImpl() {
        throw new Error("fetch must not run for an untrusted API origin");
      },
    }),
    /canonical GitHub\.com API origin/u,
  );
});

test("deployment evidence rejects content-bearing or credential-shaped retained files", async () => {
  await withEvidenceFiles(async (paths) => {
    await assert.rejects(buildTextToLatticeDeploymentEvidence({
      ...paths,
      ...deploymentCustody,
      environment: environment(),
    }), /evidence\.text is not permitted/u);
  }, {
    liveEvidencePath: {
      format: "TEXT_TO_LATTICE_REMOTE_DEPLOYMENT_EVIDENCE",
      schemaVersion: 1,
      text: "must not persist",
    },
  });

  await withEvidenceFiles(async (paths) => {
    await assert.rejects(buildTextToLatticeDeploymentEvidence({
      ...paths,
      ...deploymentCustody,
      environment: environment(),
    }), /credential-shaped material/u);
  }, {
    liveEvidencePath: {
      format: "TEXT_TO_LATTICE_REMOTE_DEPLOYMENT_EVIDENCE",
      schemaVersion: 1,
      note: "Bearer should-not-be-retained",
    },
  });
});

test("deployment evidence refuses to bind a non-main or malformed workflow identity", async () => {
  await withEvidenceFiles(async (paths) => {
    await assert.rejects(buildTextToLatticeDeploymentEvidence({
      ...paths,
      ...deploymentCustody,
      environment: environment({ GITHUB_REF: "refs/heads/topic" }),
    }), /only refs\/heads\/main/u);
    await assert.rejects(buildTextToLatticeDeploymentEvidence({
      ...paths,
      ...deploymentCustody,
      environment: environment({ GITHUB_SHA: "abc123" }),
    }), /GITHUB_SHA is invalid/u);
  });
});
