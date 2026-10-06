import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import {
  buildTextToLatticeDeploymentEvidence,
  inspectTextToLatticeApiEnvironment,
  sanitizeTextToLatticeAdmissionEnvironment,
  parseTextToLatticeDeploymentEvidenceIndexText,
  sanitizeTextToLatticeApiVersion,
  sanitizeTextToLatticeDeploymentStatus,
  verifyTextToLatticeDeploymentEvidenceIndex,
} from "../scripts/build-text-to-lattice-deployment-evidence.mjs";
import { LATTICE_PRODUCTION_ADMISSION_NEGATIVE_PROBE_IDS } from "../scripts/verify-text-to-lattice-api-production.mjs";
import { LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE } from "../workers/text-to-lattice-api/worker.js";
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
const liveProviderContract = Object.freeze({
  endpoint: "https://router.huggingface.co/v1/chat/completions",
  verification_endpoint: "https://router.huggingface.co/v1/chat/completions",
  verification_request_model: "meta-llama/Llama-3.1-8B-Instruct:nscale",
  verification_response_format: "json_schema",
  verification_schema_strict: true,
  certification_endpoint: "https://router.huggingface.co/v1/chat/completions",
  certification_request_model: "meta-llama/Llama-3.1-8B-Instruct:nscale",
  certification_response_format: "json_schema",
  certification_schema_strict: true,
  generator_model: "Qwen/Qwen3-235B-A22B-Instruct-2507:deepinfra",
  verifier_model: "meta-llama/Llama-3.1-8B-Instruct:nscale",
  automatic_retry: false,
  alternate_provider_or_model_fallback: false,
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
      script_runtime: {
        compatibility_date: "2026-09-14", compatibility_flags: ["enable_request_signal"], migration_tag: "v1",
        exports: { LatticeTransformationBudget: { type: "durable-object", storage: "sqlite" } },
      },
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
          namespace_id: "0123456789abcdef0123456789abcdef",
        },
      ],
    },
    ...overrides,
    ...(overrides.resources ? { resources: {
      script_runtime: { compatibility_date: "2026-09-14", compatibility_flags: ["enable_request_signal"], migration_tag: "v1", exports: { LatticeTransformationBudget: { type: "durable-object", storage: "sqlite" } } },
      ...overrides.resources,
    } } : {}),
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

function environmentWorkflow() {
  return { repository: "howardhayden/folio", commit: "a".repeat(40), ref: "refs/heads/main",
    runId: "123456789", runAttempt: "2", runUrl: "https://github.com/howardhayden/folio/actions/runs/123456789" };
}
function admissionFixture(complete = false) {
  const zero = { status: "complete", claim: "not-called", order: "not-called", provider: "not-started" };
  const base = { status: complete ? "complete" : "not-observed", diagnostic_revision: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
    scope: "request-scoped-host-observation", completed_at: "2026-09-14T08:02:00.000Z" };
  if (!complete) return base;
  return { ...base,
    scope: "request-scoped-host-observation", completed_at: "2026-09-14T08:02:00.000Z",
    setup: { ...zero }, negative_probes: LATTICE_PRODUCTION_ADMISSION_NEGATIVE_PROBE_IDS.map((id) => ({ id, observation: { ...zero } })),
    canary: { status: "complete", claim: "allowed-once", order: "after-validation", provider: "after-admission" },
    preservation: { ...zero }, tampered_cookie: { ...zero } };
}

async function writeObservation(pathname, value) {
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(pathname, bytes);
  await writeFile(`${pathname}.sha256`, `${createHash("sha256").update(bytes).digest("hex")}  ${pathname.split("/").at(-1)}\n`);
}

async function withEvidenceFiles(callback, overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), "lattice-deployment-evidence-"));
  const paths = {
    apiDeploymentPath: join(directory, "api.raw.json"),
    apiVersionPath: join(directory, "api-version.raw.json"),
    apiDeploymentAfterPath: join(directory, "api-after.raw.json"),
    apiEnvironmentBeforePath: join(directory, "api-before.json"),
    apiEnvironmentAfterPath: join(directory, "api-after.json"),
    policyDeploymentPath: join(directory, "policy.raw.json"),
    secretEvidencePath: join(directory, "secret-bindings.json"),
    routeEvidencePath: join(directory, "route-inventory.json"),
    liveEvidencePath: join(directory, "live-boundary.json"),
  };
  const values = {
    apiDeploymentPath: deployment(apiDeploymentId, apiVersion),
    apiVersionPath: apiVersionView(),
    apiDeploymentAfterPath: deployment(apiDeploymentId, apiVersion),
    apiEnvironmentBeforePath: {
      format: "TEXT_TO_LATTICE_API_ENVIRONMENT_OBSERVATION", schemaVersion: 2,
      validatedAt: "2026-09-14T08:00:01.000Z", workflow: { ...environmentWorkflow() },
      qualifiedSourceSetSha256: deploymentCustody.qualifiedSourceSetSha256,
      api: sanitizeTextToLatticeDeploymentStatus(deployment(apiDeploymentId, apiVersion), "hahdev-text-to-lattice-api"),
      admissionEnvironment: sanitizeTextToLatticeAdmissionEnvironment(apiVersionView()),
    },
    apiEnvironmentAfterPath: {
      format: "TEXT_TO_LATTICE_API_ENVIRONMENT_OBSERVATION", schemaVersion: 2,
      validatedAt: "2026-09-14T08:03:00.000Z", workflow: { ...environmentWorkflow() },
      qualifiedSourceSetSha256: deploymentCustody.qualifiedSourceSetSha256,
      api: sanitizeTextToLatticeDeploymentStatus(deployment(apiDeploymentId, apiVersion), "hahdev-text-to-lattice-api"),
      admissionEnvironment: sanitizeTextToLatticeAdmissionEnvironment(apiVersionView()),
    },
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
      schemaVersion: 3,
      verified_at: "2026-09-14T08:01:00.000Z",
      deployment: { repository: "howardhayden/folio", commit: "a".repeat(40), run_url: "https://github.com/howardhayden/folio/actions/runs/123456789", run_attempt: 2 },
      request_admission: admissionFixture(Boolean(overrides.apiVersionPath?.resources?.bindings?.some((entry) => entry.name === "LATTICE_QUALIFICATION_EXPIRES_AT"))),
      declared_provider_contract: liveProviderContract,
      checks: [{ id: "wrong-method", status: 405, bodyRetained: false }],
    },
    ...overrides,
  };
  try {
    await Promise.all(Object.entries(paths).map(([key, pathname]) => (
      key.startsWith("apiEnvironment") ? writeObservation(pathname, values[key])
        : writeFile(pathname, `${JSON.stringify(values[key])}\n`, "utf8")
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
      "--api-deployment-after", paths.apiDeploymentAfterPath,
      "--api-environment-before", paths.apiEnvironmentBeforePath,
      "--api-environment-after", paths.apiEnvironmentAfterPath,
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
      schemaVersion: 3,
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
      schemaVersion: 3,
      note: "Bearer should-not-be-retained",
    },
  });
});

test("deployment evidence binds format-specific versions and the complete current provider contract", async (context) => {
  for (const [field, version] of [
    ["liveEvidencePath", 1], ["liveEvidencePath", 2], ["liveEvidencePath", 4],
    ["secretEvidencePath", 2], ["routeEvidencePath", 2],
  ]) await context.test(`${field}: wrong version ${version}`, async () => {
    await withEvidenceFiles(async (paths) => {
      const value = JSON.parse(await readFile(paths[field], "utf8"));
      value.schemaVersion = version;
      await writeFile(paths[field], JSON.stringify(value));
      await assert.rejects(buildTextToLatticeDeploymentEvidence({
        ...paths, ...deploymentCustody, environment: environment(),
      }), /invalid format or schema version/u);
    });
  });
  for (const [name, patch] of [
    ["old verification route", { verification_endpoint: "https://router.huggingface.co/deepinfra/v1/openai/chat/completions" }],
    ["prior Next80B generator selector", { generator_model: "Qwen/Qwen3-Next-80B-A3B-Instruct:deepinfra" }],
    ["old generator selector", { generator_model: "Qwen/Qwen3-4B-Instruct-2507:nscale" }],
    ["old verifier selector", { verifier_model: "meta-llama/Llama-3.1-8B-Instruct:deepinfra" }],
    ["old verification format", { verification_response_format: "json_object" }],
    ["non-strict verification", { verification_schema_strict: false }],
    ["old certification route", { certification_endpoint: "https://router.huggingface.co/deepinfra/v1/openai/chat/completions" }],
    ["wrong certification model", { certification_request_model: "meta-llama/Llama-3.1-8B-Instruct:deepinfra" }],
    ["old certification format", { certification_response_format: "named_tool" }],
    ["non-strict certification", { certification_schema_strict: false }],
    ["replacement model", { verification_request_model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo" }],
    ["fallback", { alternate_provider_or_model_fallback: true }],
    ["unknown field", { extra: "undeclared" }],
    ["missing mapping", { verification_request_model: undefined }],
  ]) await context.test(name, async () => {
    await withEvidenceFiles(async (paths) => {
      const value = JSON.parse(await readFile(paths.liveEvidencePath, "utf8"));
      value.declared_provider_contract = { ...value.declared_provider_contract, ...patch };
      await writeFile(paths.liveEvidencePath, JSON.stringify(value));
      await assert.rejects(buildTextToLatticeDeploymentEvidence({
        ...paths, ...deploymentCustody, environment: environment(),
      }), /invalid fixed provider contract/u);
    });
  });
});

test("historical DeepInfra receipts retain their bytes and cannot qualify the Nscale deployment", async (context) => {
  for (const schemaVersion of [1, 2]) await context.test(`historical v${schemaVersion}`, async () => {
    const historicalProvider = {
      endpoint: "https://router.huggingface.co/v1/chat/completions",
      ...(schemaVersion === 2 ? {
        verification_endpoint: "https://router.huggingface.co/deepinfra/v1/openai/chat/completions",
        verification_request_model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
      } : {}),
      generator_model: "Qwen/Qwen3-4B-Instruct-2507:nscale",
      verifier_model: "meta-llama/Llama-3.1-8B-Instruct:deepinfra",
      automatic_retry: false,
      alternate_provider_or_model_fallback: false,
    };
    await withEvidenceFiles(async (paths) => {
      const before = await readFile(paths.liveEvidencePath);
      await assert.rejects(buildTextToLatticeDeploymentEvidence({
        ...paths, ...deploymentCustody, environment: environment(),
      }), /invalid format or schema version/u);
      assert.deepEqual(await readFile(paths.liveEvidencePath), before);
    }, {
      liveEvidencePath: {
        format: "TEXT_TO_LATTICE_REMOTE_DEPLOYMENT_EVIDENCE",
        schemaVersion,
        declared_provider_contract: historicalProvider,
        checks: [{ id: "wrong-method", status: 405, bodyRetained: false }],
      },
    });
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

test("admission environment comes from observed version metadata, including explicit SQLite backend", async (t) => {
  const expected = sanitizeTextToLatticeAdmissionEnvironment(apiVersionView());
  assert.equal(expected.namespaceId, "0123456789abcdef0123456789abcdef");
  assert.equal(expected.storageBackend, "sqlite");
  assert.equal(expected.migrationTag, "v1");
  const created = apiVersionView(); created.resources.script_runtime.exports.LatticeTransformationBudget.state = "created";
  assert.deepEqual(sanitizeTextToLatticeAdmissionEnvironment(created), expected);
  for (const [label, change] of [
    ["missing namespace", (v) => { delete v.resources.bindings.at(-1).namespace_id; }],
    ["line-terminated namespace", (v) => { v.resources.bindings.at(-1).namespace_id += "\n"; }],
    ["edge namespace", (v) => { v.resources.bindings.at(-1).namespace_id = "857321"; }],
    ["foreign script", (v) => { v.resources.bindings.at(-1).script_name = "other"; }],
    ["preview namespace", (v) => { v.resources.bindings.at(-1).preview = {}; }],
    ["dispatch namespace", (v) => { v.resources.bindings.at(-1).dispatch_namespace = "other"; }],
    ["binding environment", (v) => { v.resources.bindings.at(-1).environment = "preview"; }],
    ["missing runtime", (v) => { delete v.resources.script_runtime; }],
    ["missing exports", (v) => { delete v.resources.script_runtime.exports; }],
    ["missing storage", (v) => { delete v.resources.script_runtime.exports.LatticeTransformationBudget.storage; }],
    ["legacy storage", (v) => { v.resources.script_runtime.exports.LatticeTransformationBudget.storage = "legacy-kv"; }],
    ["transfer", (v) => { v.resources.script_runtime.exports.LatticeTransformationBudget.state = "expecting-transfer"; }],
    ["container", (v) => { v.resources.script_runtime.exports.LatticeTransformationBudget.container = "private"; }],
    ["wrong migration", (v) => { v.resources.script_runtime.migration_tag = "v2"; }],
    ["missing migration", (v) => { delete v.resources.script_runtime.migration_tag; }],
    ["compatibility drift", (v) => { v.resources.script_runtime.compatibility_date = "2026-09-15"; }],
    ["flag drift", (v) => { v.resources.script_runtime.compatibility_flags = []; }],
  ]) await t.test(label, () => {
    const changed = apiVersionView(); change(changed);
    assert.throws(() => sanitizeTextToLatticeAdmissionEnvironment(changed), /admission environment|deployed runtime/u);
  });
});

test("pre-live environment inspection is a bounded timestamped validation of the exact active version", async () => {
  await withEvidenceFiles(async (paths) => {
    const proof = await inspectTextToLatticeApiEnvironment({ ...paths, qualifiedSourceSetSha256: deploymentCustody.qualifiedSourceSetSha256, environment: environment(), now: () => new Date("2026-09-14T08:00:01.000Z") });
    assert.equal(proof.validatedAt, "2026-09-14T08:00:01.000Z");
    assert.equal(proof.api.versionId, apiVersion);
    assert.equal(proof.admissionEnvironment.namespaceIdentityBasis, "active-version-local-binding");
    assert.doesNotMatch(JSON.stringify(proof), /author_email|must-not-be-retained|secret_text/u);
    const outputPath = join(dirname(paths.apiDeploymentPath), "inspected.json");
    const command = spawnSync(process.execPath, [resolve("scripts/build-text-to-lattice-deployment-evidence.mjs"),
      "--inspect-api-environment", "--api-deployment", paths.apiDeploymentPath,
      "--api-version", paths.apiVersionPath, "--qualified-source-set-sha256", deploymentCustody.qualifiedSourceSetSha256, "--output", outputPath,
    ], { encoding: "utf8", env: { ...process.env, ...environment() } });
    assert.equal(command.status, 0, command.stderr);
    assert.equal(JSON.parse(await readFile(outputPath, "utf8")).api.versionId, apiVersion);
    const invalid = apiVersionView(); delete invalid.resources.script_runtime.exports;
    await writeFile(paths.apiVersionPath, JSON.stringify(invalid));
    const failed = spawnSync(process.execPath, [resolve("scripts/build-text-to-lattice-deployment-evidence.mjs"),
      "--inspect-api-environment", "--api-deployment", paths.apiDeploymentPath,
      "--api-version", paths.apiVersionPath, "--qualified-source-set-sha256", deploymentCustody.qualifiedSourceSetSha256, "--output", join(dirname(outputPath), "invalid.json"),
    ], { encoding: "utf8", env: { ...process.env, ...environment() } });
    assert.notEqual(failed.status, 0);
    await assert.rejects(readFile(join(dirname(outputPath), "invalid.json")), /ENOENT/u);
  });
});

test("assembly requires exact matching snapshots and current live receipt custody", async (t) => {
  for (const [label, file, change] of [
    ["post deployment changed", "apiDeploymentAfterPath", (v) => { v.id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"; }],
    ["post version changed", "apiDeploymentAfterPath", (v) => { v.versions[0].version_id = policyVersion; }],
    ["split traffic", "apiDeploymentAfterPath", (v) => { v.versions[0].percentage = 99; }],
    ["wrong namespace before", "apiEnvironmentBeforePath", (v) => { v.admissionEnvironment.namespaceId = "different-namespace"; }],
    ["wrong before workflow", "apiEnvironmentBeforePath", (v) => { v.workflow.runAttempt = "3"; }],
    ["before after live start", "apiEnvironmentBeforePath", (v) => { v.validatedAt = "2026-09-14T08:01:01.000Z"; }],
    ["line-terminated before", "apiEnvironmentBeforePath", (v) => { v.validatedAt += "\n"; }],
    ["live before start", "liveEvidencePath", (v) => { v.request_admission.completed_at = "2026-09-14T07:59:00.000Z"; }],
    ["live after assembly", "liveEvidencePath", (v) => { v.request_admission.completed_at = "2026-09-14T08:06:00.000Z"; }],
    ["live wrong commit", "liveEvidencePath", (v) => { v.deployment.commit = "b".repeat(40); }],
    ["live wrong run", "liveEvidencePath", (v) => { v.deployment.run_attempt = 3; }],
    ["missing additive group", "liveEvidencePath", (v) => { delete v.request_admission; }],
    ["unexpected complete without expiry", "liveEvidencePath", (v) => { v.request_admission = admissionFixture(true); }],
  ]) await t.test(label, () => withEvidenceFiles(async (paths) => {
    const value = JSON.parse(await readFile(paths[file], "utf8")); change(value);
    if (file.startsWith("apiEnvironment")) await writeObservation(paths[file], value);
    else await writeFile(paths[file], JSON.stringify(value));
    await assert.rejects(buildTextToLatticeDeploymentEvidence({ ...paths, ...deploymentCustody,
      environment: environment(), now: () => new Date("2026-09-14T08:05:00.000Z"),
    }), /bracket|timestamp|validation time|100 percent|incomplete or inconsistent/u);
  }));
});

test("qualification assembly refuses absent or unavailable admission observations", async () => {
  const qualificationExpiresAt = "2026-09-14T08:30:00.000Z";
  const raw = apiVersionView(); raw.resources.bindings.push({ name: "LATTICE_QUALIFICATION_EXPIRES_AT", type: "plain_text", text: qualificationExpiresAt });
  await withEvidenceFiles(async (paths) => {
    const live = JSON.parse(await readFile(paths.liveEvidencePath, "utf8"));
    for (const value of [admissionFixture(false), { ...admissionFixture(true), canary: { status: "unavailable", claim: "unavailable", order: "unavailable", provider: "unavailable" } }]) {
      live.request_admission = value; await writeFile(paths.liveEvidencePath, JSON.stringify(live));
      await assert.rejects(buildTextToLatticeDeploymentEvidence({ ...paths, ...deploymentCustody, qualificationExpiresAt,
        environment: environment(), now: () => new Date("2026-09-14T08:05:00.000Z"),
      }), /incomplete or inconsistent/u);
    }
  }, { apiVersionPath: raw });
});

test("legacy index absence retains its old meaning, while present partial or forged runtime custody fails", async () => {
  await withEvidenceFiles(async (paths) => {
    const current = await buildTextToLatticeDeploymentEvidence({ ...paths, ...deploymentCustody,
      environment: environment(), now: () => new Date("2026-09-14T08:05:00.000Z"),
    });
    const legacy = structuredClone(current); delete legacy.admissionEnvironment;
    assert.equal(verifyTextToLatticeDeploymentEvidenceIndex(legacy), legacy);
    assert.equal(legacy.admissionEnvironment, undefined);
    for (const change of [
      (v) => { delete v.runtime.storageBackend; }, (v) => { v.runtime.extra = true; },
      (v) => { v.versionId = policyVersion; }, (v) => { v.matchingBeforeAfterSnapshots = false; },
      (v) => { v.liveCompletedAt = "2026-09-14T08:06:00.000Z"; },
    ]) {
      const invalid = structuredClone(current); change(invalid.admissionEnvironment);
      assert.throws(() => verifyTextToLatticeDeploymentEvidenceIndex(invalid), /admission environment/u);
    }
  });
});

test("absent declarative exports require exact observed namespace SQLite proof", () => {
  const version = apiVersionView();
  delete version.resources.script_runtime.exports;
  version.resources.script = { named_handlers: [{ name: "LatticeTransformationBudget", handlers: [] }] };
  const namespace = { id: version.resources.bindings.at(-1).namespace_id,
    script: "hahdev-text-to-lattice-api", class: "LatticeTransformationBudget", use_sqlite: true };
  const observed = sanitizeTextToLatticeAdmissionEnvironment(version, namespace);
  assert.equal(observed.storageBackendBasis, "active-version-local-class-and-observed-namespace-sqlite");
  assert.throws(() => sanitizeTextToLatticeAdmissionEnvironment(version), /admission environment/u);
});

function namespaceVersion() {
  const version = apiVersionView();
  delete version.resources.script_runtime.exports;
  version.resources.script = { named_handlers: [{ name: "LatticeTransformationBudget", handlers: [] }] };
  return version;
}
function namespaceMetadata() {
  return { id: "0123456789abcdef0123456789abcdef", script: "hahdev-text-to-lattice-api",
    class: "LatticeTransformationBudget", use_sqlite: true };
}

test("observed namespace cannot bypass present exports or exact local class/runtime evidence", async (t) => {
  for (const [label, mutate] of [
    ["null exports", (v) => { v.resources.script_runtime.exports = null; }],
    ["empty exports", (v) => { v.resources.script_runtime.exports = {}; }],
    ["array exports", (v) => { v.resources.script_runtime.exports = []; }],
    ["wrong class export", (v) => { v.resources.script_runtime.exports = { Other: { type: "durable-object", storage: "sqlite" } }; }],
    ["conflicting backend", (v) => { v.resources.script_runtime.exports = { LatticeTransformationBudget: { type: "durable-object", storage: "legacy-kv" } }; }],
    ["deleted class", (v) => { v.resources.script_runtime.exports = { LatticeTransformationBudget: { type: "durable-object", storage: "sqlite", state: "deleted" } }; }],
    ["class transfer", (v) => { v.resources.script_runtime.exports = { LatticeTransformationBudget: { type: "durable-object", storage: "sqlite", transfer_from: "other" } }; }],
    ["missing named class", (v) => { v.resources.script.named_handlers = []; }],
    ["duplicate named class", (v) => { v.resources.script.named_handlers.push({ ...v.resources.script.named_handlers[0] }); }],
    ["missing named handlers", (v) => { delete v.resources.script.named_handlers[0].handlers; }],
    ["non-array named handlers", (v) => { v.resources.script.named_handlers[0].handlers = "fetch"; }],
    ["non-string named handler", (v) => { v.resources.script.named_handlers[0].handlers = [false]; }],
    ["duplicate binding", (v) => { v.resources.bindings.push({ ...v.resources.bindings.at(-1) }); }],
    ["wrong namespace", (v) => { v.resources.bindings.at(-1).namespace_id = "f".repeat(32); }],
    ["invalid namespace path", (v) => { v.resources.bindings.at(-1).namespace_id = "../../other"; }],
    ["foreign class", (v) => { v.resources.bindings.at(-1).class_name = "Other"; }],
    ["foreign script", (v) => { v.resources.bindings.at(-1).script_name = "other"; }],
    ["binding preview even null", (v) => { v.resources.bindings.at(-1).preview = null; }],
    ["runtime migration drift", (v) => { v.resources.script_runtime.migration_tag = "v2"; }],
    ["runtime date drift", (v) => { v.resources.script_runtime.compatibility_date = "2026-10-05"; }],
    ["runtime flags drift", (v) => { v.resources.script_runtime.compatibility_flags.push("other"); }],
  ]) await t.test(label, () => {
    const version = namespaceVersion(); mutate(version);
    assert.throws(() => sanitizeTextToLatticeAdmissionEnvironment(version, namespaceMetadata()), /admission environment|deployed runtime/u);
  });
});

test("namespace proof requires exact returned identity and explicit Boolean SQLite without auxiliary scope", async (t) => {
  for (const [label, mutate] of [
    ["missing ID", (v) => { delete v.id; }], ["wrong ID", (v) => { v.id = "f".repeat(32); }],
    ["missing script", (v) => { delete v.script; }], ["wrong script", (v) => { v.script = "other"; }],
    ["missing class", (v) => { delete v.class; }], ["wrong class", (v) => { v.class = "Other"; }],
    ["missing backend", (v) => { delete v.use_sqlite; }], ["false backend", (v) => { v.use_sqlite = false; }],
    ["string backend", (v) => { v.use_sqlite = "true"; }], ["numeric backend", (v) => { v.use_sqlite = 1; }],
    ["preview null", (v) => { v.preview = null; }], ["dispatch null", (v) => { v.dispatch_namespace = null; }],
    ["environment null", (v) => { v.environment = null; }],
  ]) await t.test(label, () => {
    const metadata = namespaceMetadata(); mutate(metadata);
    assert.throws(() => sanitizeTextToLatticeAdmissionEnvironment(namespaceVersion(), metadata), /admission environment/u);
  });
});

test("fresh namespace inspections emit closed source-bound v2 records, then assembly checks both exact samples", async () => {
  await withEvidenceFiles(async (paths) => {
    const requests = [];
    const options = { ...paths, qualifiedSourceSetSha256: deploymentCustody.qualifiedSourceSetSha256,
      environment: environment({ CLOUDFLARE_ACCOUNT_ID: "e".repeat(32), CLOUDFLARE_API_TOKEN: "synthetic-private-credential" }),
      fetchImpl: async (url, request) => {
        requests.push({ url, request });
        return new Response(JSON.stringify({ success: true, result: { ...namespaceMetadata(),
          incidental: "RAW-NAMESPACE-MUST-NOT-SURVIVE" } }), { headers: { "content-type": "application/json" } });
      } };
    const before = await inspectTextToLatticeApiEnvironment({ ...options, now: () => new Date("2026-09-14T08:00:01.000Z") });
    const after = await inspectTextToLatticeApiEnvironment({ ...options, apiDeploymentPath: paths.apiDeploymentAfterPath,
      now: () => new Date("2026-09-14T08:03:00.000Z") });
    assert.equal(requests.length, 2, "each sample performs a fresh exact namespace read");
    for (const { url, request } of requests) {
      assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${"e".repeat(32)}/workers/durable_objects/namespaces/${namespaceMetadata().id}`);
      assert.equal(request.method, "GET"); assert.equal(request.redirect, "error");
      assert.equal(request.body, undefined); assert.equal(request.headers["Accept-Encoding"], "identity");
    }
    assert.deepEqual(Object.keys(before), ["format", "schemaVersion", "validatedAt", "workflow", "qualifiedSourceSetSha256", "api", "admissionEnvironment"]);
    assert.equal(before.schemaVersion, 2);
    assert.doesNotMatch(JSON.stringify([before, after]), /RAW-NAMESPACE|synthetic-private|author_email|use_sqlite|secret_text/u);
    await writeObservation(paths.apiEnvironmentBeforePath, before);
    await writeObservation(paths.apiEnvironmentAfterPath, after);
    const index = await buildTextToLatticeDeploymentEvidence({ ...paths, ...deploymentCustody,
      environment: environment(), now: () => new Date("2026-09-14T08:05:00.000Z") });
    assert.equal(index.schemaVersion, 1);
    assert.equal(index.admissionEnvironment.runtime.storageBackendBasis, "active-version-local-class-and-observed-namespace-sqlite");
    assert.equal(index.admissionEnvironment.validatedAfterAt, index.deployedAt);
    assert.notEqual(index.admissionEnvironment.validatedAfterAt, after.validatedAt, "assembly time retains its historical meaning");
    assert.equal(verifyTextToLatticeDeploymentEvidenceIndex(index), index);
  }, { apiVersionPath: namespaceVersion() });
});

test("inspection rejects malformed version before any metadata GET and rejects mismatched GET without output", async () => {
  await withEvidenceFiles(async (paths) => {
    let calls = 0;
    const options = { ...paths, qualifiedSourceSetSha256: deploymentCustody.qualifiedSourceSetSha256,
      environment: environment({ CLOUDFLARE_ACCOUNT_ID: "e".repeat(32), CLOUDFLARE_API_TOKEN: "synthetic-token" }),
      fetchImpl: async () => { calls += 1; return new Response(JSON.stringify({ success: true, result: { ...namespaceMetadata(), id: "f".repeat(32) } }), { headers: { "content-type": "application/json" } }); } };
    const bad = namespaceVersion(); bad.resources.script_runtime.exports = null;
    await writeFile(paths.apiVersionPath, JSON.stringify(bad));
    await assert.rejects(inspectTextToLatticeApiEnvironment(options), /admission environment/u);
    assert.equal(calls, 0);
    await writeFile(paths.apiVersionPath, JSON.stringify(namespaceVersion()));
    await assert.rejects(inspectTextToLatticeApiEnvironment(options), /namespace-identity/u);
    assert.equal(calls, 1);
  });
});

test("current assembly rejects stale source, post sample replay, schema and exact byte-custody defects", async (t) => {
  for (const [label, file, change] of [
    ["v1 before", "apiEnvironmentBeforePath", (v) => { v.schemaVersion = 1; delete v.qualifiedSourceSetSha256; }],
    ["v1 after", "apiEnvironmentAfterPath", (v) => { v.schemaVersion = 1; }],
    ["wrong before source", "apiEnvironmentBeforePath", (v) => { v.qualifiedSourceSetSha256 = "f".repeat(64); }],
    ["wrong after source", "apiEnvironmentAfterPath", (v) => { v.qualifiedSourceSetSha256 = "f".repeat(64); }],
    ["missing source", "apiEnvironmentAfterPath", (v) => { delete v.qualifiedSourceSetSha256; }],
    ["post run replay", "apiEnvironmentAfterPath", (v) => { v.workflow.runAttempt = "1"; }],
    ["post workflow commit", "apiEnvironmentAfterPath", (v) => { v.workflow.commit = "b".repeat(40); }],
    ["post version drift", "apiEnvironmentAfterPath", (v) => { v.api.versionId = policyVersion; }],
    ["post deployment drift", "apiEnvironmentAfterPath", (v) => { v.api.deploymentId = policyDeploymentId; }],
    ["post split traffic", "apiEnvironmentAfterPath", (v) => { v.api.percentage = 50; }],
    ["post namespace drift", "apiEnvironmentAfterPath", (v) => { v.admissionEnvironment.namespaceId = "f".repeat(32); }],
    ["post basis drift", "apiEnvironmentAfterPath", (v) => { v.admissionEnvironment.storageBackendBasis = "active-version-local-class-and-observed-namespace-sqlite"; }],
    ["post class drift", "apiEnvironmentAfterPath", (v) => { v.admissionEnvironment.className = "Other"; }],
    ["before replayed as after", "apiEnvironmentAfterPath", (v) => { v.validatedAt = "2026-09-14T08:00:01.000Z"; }],
    ["after before live completion", "apiEnvironmentAfterPath", (v) => { v.validatedAt = "2026-09-14T08:01:59.999Z"; }],
    ["after after assembly", "apiEnvironmentAfterPath", (v) => { v.validatedAt = "2026-09-14T08:05:00.001Z"; }],
    ["post unknown raw field", "apiEnvironmentAfterPath", (v) => { v.raw = "PRIVATE-METADATA"; }],
  ]) await t.test(label, () => withEvidenceFiles(async (paths) => {
    const value = JSON.parse(await readFile(paths[file], "utf8")); change(value);
    await writeObservation(paths[file], value);
    await assert.rejects(buildTextToLatticeDeploymentEvidence({ ...paths, ...deploymentCustody,
      environment: environment(), now: () => new Date("2026-09-14T08:05:00.000Z") }));
  }));
  for (const file of ["apiEnvironmentBeforePath", "apiEnvironmentAfterPath"]) {
    for (const defect of ["missing file", "missing sidecar", "wrong digest", "wrong basename", "extra newline", "stale bytes"]) {
      await t.test(`${file}: ${defect}`, () => withEvidenceFiles(async (paths) => {
        const path = paths[file];
        const sidecar = await readFile(`${path}.sha256`, "utf8");
        if (defect === "missing file") await rm(path);
        else if (defect === "missing sidecar") await rm(`${path}.sha256`);
        else if (defect === "wrong digest") await writeFile(`${path}.sha256`, `${"f".repeat(64)}${sidecar.slice(64)}`);
        else if (defect === "wrong basename") await writeFile(`${path}.sha256`, `${sidecar.slice(0, 66)}other.json\n`);
        else if (defect === "extra newline") await writeFile(`${path}.sha256`, `${sidecar}\n`);
        else await writeFile(path, `${await readFile(path, "utf8")} `);
        await assert.rejects(buildTextToLatticeDeploymentEvidence({ ...paths, ...deploymentCustody,
          environment: environment(), now: () => new Date("2026-09-14T08:05:00.000Z") }));
      }));
    }
  }
});

test("second namespace inspection independently rejects mismatch and operation expiry instead of reusing preflight", async (t) => {
  for (const defect of ["identity", "operation-expiry"]) await t.test(defect, () => withEvidenceFiles(async (paths) => {
    let calls = 0;
    const options = { ...paths, qualifiedSourceSetSha256: deploymentCustody.qualifiedSourceSetSha256,
      environment: environment({ CLOUDFLARE_ACCOUNT_ID: "e".repeat(32), CLOUDFLARE_API_TOKEN: "synthetic-token" }),
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ success: true, result: { ...namespaceMetadata(),
          ...(calls === 2 && defect === "identity" ? { id: "f".repeat(32) } : {}) } }),
        { headers: { "content-type": "application/json" } });
      } };
    const before = await inspectTextToLatticeApiEnvironment({ ...options, now: () => new Date("2026-09-14T08:00:01.000Z") });
    let clocks = 0;
    await assert.rejects(inspectTextToLatticeApiEnvironment({ ...options,
      now: () => new Date("2026-09-14T08:03:00.000Z"),
      monotonicNow: () => { clocks += 1; return defect === "operation-expiry" && clocks === 3 ? 30_001 : 0; },
    }), defect === "identity" ? /namespace-identity/u : /deadline/u);
    assert.equal(calls, 2);
    assert.equal(before.validatedAt, "2026-09-14T08:00:01.000Z");
  }, { apiVersionPath: namespaceVersion() }));
});
