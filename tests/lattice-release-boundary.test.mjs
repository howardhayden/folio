import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { projectBySlug } from "../app/resume/projects.js";
import {
  qualifiedFilesBelow,
  verifyBrowserEvidenceAuthority,
  verifyHeldBuiltBoundary,
  verifyLifecycleGateContract,
  verifyReleaseStatusState,
} from "../scripts/verify-text-to-lattice-release.mjs";

const execute = promisify(execFile);
const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const validator = join(root, "scripts/verify-text-to-lattice-release.mjs");
const registerPath = join(root, "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json");
const expectedGateIds = ["GATE-01", "GATE-02", "GATE-03", "GATE-04A", "GATE-04B", "GATE-04C", "GATE-05", "GATE-06"];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const browserEvidenceIdentityFields = [
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
];

async function releaseRegister() {
  return JSON.parse(await readFile(registerPath, "utf8"));
}

function browserEvidenceFixture(qualifiedSourceSetSha256) {
  const evidence = {
    evidence_id: "ttl-browser-20260914T130000Z-deadbeef",
    recorded_at: "2026-09-14T13:00:00.000Z",
    deployment: {
      deployed_commit: "1234567890abcdef1234567890abcdef12345678",
      workflow_run_id: "34399999999",
      workflow_run_attempt: "1",
      workflow_run_url: "https://github.com/howardhayden/folio/actions/runs/34399999999",
      service_job_id: "102999999999",
      canonical_url: "https://hah.dev/resume/#text-to-lattice",
      api_worker_deployment_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      api_worker_version: "11111111-1111-4111-8111-111111111111",
      response_policy_worker_deployment_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      response_policy_worker_version: "22222222-2222-4222-8222-222222222222",
      deployment_evidence_index_sha256: sha256("deployment-evidence-index"),
      deployment_evidence_before_captures_sha256: sha256("deployment-evidence-index"),
      deployment_evidence_after_captures_sha256: sha256("deployment-evidence-index"),
      site_artifact_sha256: sha256("site-artifact"),
      qualified_source_set_sha256: qualifiedSourceSetSha256,
      deployed_at: "2026-09-14T10:00:00.000Z",
      qualification_expires_at: "2026-09-14T11:15:00.000Z",
      deployment_evidence_checked_before_captures_at: "2026-09-14T10:59:00.000Z",
      deployment_evidence_checked_after_captures_at: "2026-09-14T11:11:00.000Z",
      deployment_evidence_unchanged_across_captures: true,
    },
  };
  const path = `docs/text-to-lattice/browser-evidence/${evidence.evidence_id}/TEXT-TO-LATTICE-BROWSER-EVIDENCE.json`;
  const bundleSha256 = sha256("strict-sanitized-browser-evidence-bundle");
  const deployment = evidence.deployment;
  const record = {
    status: "verified-sanitized-bundle",
    path,
    sha256: bundleSha256,
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
  };
  return {
    evidence,
    record,
    bundle: { evidence, sha256: bundleSha256, byteCount: 4096 },
  };
}

function qualifyRegister(register) {
  register.overallStatus = "qualified";
  register.publicClient.status = "enabled";
  register.publicClient.publicationMode = "interactive-client";
  delete register.publicClient.heldBoundary;
  for (const gate of register.gates) {
    if (gate.status === "open-release-blocker") gate.status = "satisfied-in-production";
  }
  return register;
}

async function withHeldSiteFixture(mutate, expectedFailure) {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "lattice-held-site-test-"));
  const fixtureSite = join(temporaryDirectory, "site");
  try {
    await mkdir(join(fixtureSite, "resume"), { recursive: true });
    await mkdir(join(fixtureSite, "projects/medium"), { recursive: true });
    await mkdir(join(fixtureSite, "_next"), { recursive: true });
    await writeFile(join(fixtureSite, "resume/index.html"), '<a href="/projects/lattice/">Lattice</a><a class="tool-icon project-modal-trigger signal-fuzz" href="/projects/lattice/text-to-lattice/" aria-label="Read Text to Lattice release status"><svg></svg></a>');
    await writeFile(join(fixtureSite, "projects/medium/index.html"), "<body></body>");
    await verifyHeldBuiltBoundary(fixtureSite);
    await mutate(fixtureSite);
    await assert.rejects(
      verifyHeldBuiltBoundary(fixtureSite),
      (error) => expectedFailure.test(`${error.stderr ?? ""}${error.message ?? ""}`),
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function appendToHtml(path, markup) {
  const source = await readFile(path, "utf8");
  assert.match(source, /<\/body>/u);
  await writeFile(path, source.replace("</body>", `${markup}</body>`));
}

test("qualified source trees ignore only Wrangler's reserved local residue", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "lattice-qualified-tree-test-"));
  try {
    await mkdir(join(temporaryDirectory, ".wrangler", "tmp"), { recursive: true });
    await writeFile(join(temporaryDirectory, ".wrangler", "tmp", "bundle.js"), "generated");
    await writeFile(join(temporaryDirectory, "worker.js"), "tracked source");
    await writeFile(join(temporaryDirectory, "meaningful-untracked.js"), "meaningful drift");
    const qualified = (await qualifiedFilesBelow(temporaryDirectory, "test fixture"))
      .map((path) => relative(temporaryDirectory, path).split("\\").join("/"))
      .sort();
    assert.deepEqual(qualified, ["meaningful-untracked.js", "worker.js"]);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("the release register honestly holds the remote capability and preserves historical evidence", async () => {
  const [register, view, held, search, workflow, validatorSource] = await Promise.all([
    releaseRegister(),
    readFile(join(root, "app/resume/ResumeView.tsx"), "utf8"),
    readFile(join(root, "app/resume/ResumeProjectsHeld.tsx"), "utf8"),
    readFile(join(root, "app/resume/ResumeSearch.tsx"), "utf8"),
    readFile(join(root, ".github/workflows/pages.yml"), "utf8"),
    readFile(validator, "utf8"),
  ]);
  assert.equal(register.overallStatus, "held");
  assert.deepEqual(
    { status: register.publicClient.status, mode: register.publicClient.publicationMode },
    { status: "held", mode: "documentation-only" },
  );
  assert.ok(register.publicClient.heldBoundary.allow.length > 0);
  assert.ok(register.publicClient.heldBoundary.deny.some((item) => item.includes("/api/lattice")));
  assert.equal(register.ownerDisposition.status, "hold-directed");
  assert.deepEqual(register.gates.map(({ id }) => id), expectedGateIds);
  assert.deepEqual(
    Object.fromEntries(register.gates.map(({ id, status }) => [id, status])),
    {
      "GATE-01": "release-workflow-enforced",
      "GATE-02": "open-release-blocker",
      "GATE-03": "open-release-blocker",
      "GATE-04A": "accepted-residual-risk",
      "GATE-04B": "historical-inactive",
      "GATE-04C": "historical-inactive",
      "GATE-05": "accepted-residual-risk",
      "GATE-06": "open-release-blocker",
    },
  );

  const capability = register.artifactSet.activeCapability;
  assert.deepEqual(
    {
      status: capability.status,
      route: capability.route,
      method: capability.method,
      schemaVersion: capability.schemaVersion,
      requestFields: capability.requestFields,
      requestedModes: capability.requestedModes,
      secrets: capability.secretBindingNames,
      visitorSessionSetup: capability.visitorSessionSetup,
      contentRequest: capability.contentRequest,
      browserQuotaCookie: capability.browserQuotaCookie,
      admission: capability.admission,
      retry: capability.automaticRetry,
      fallback: capability.alternateProviderFallback,
    },
    {
      status: "held-pending-production-evidence",
      route: "/api/lattice",
      method: "POST",
      schemaVersion: 1,
      requestFields: ["text", "requested_mode", "schema_version"],
      requestedModes: ["auto", "operative", "experiential"],
      secrets: ["HF_TOKEN", "VISITOR_COOKIE_SECRET"],
      visitorSessionSetup: {
        route: "/api/lattice",
        method: "POST",
        accept: "application/vnd.hah.text-to-lattice-visitor-session.v1+json",
        bodyless: true,
        contentTypeHeader: false,
        credentialsMode: "same-origin",
        sharedBrowserWebLock: true,
        acceptedStatus: 204,
        transportOrNon204FailureStopsContentRequest: true,
        establishesOrPreservesSignedCookie: true,
        consumesTransformationQuota: false,
        contactsProvider: false,
      },
      contentRequest: {
        route: "/api/lattice",
        method: "POST",
        accept: "application/json",
        contentTypeHeader: "application/json",
        credentialsMode: "same-origin",
        contentBearingRequestsPerAttempt: 1,
        httpOnlyCookieStorageObservableByClient: false,
        attemptedAfterAcceptedSetupWhenCookieBlockedOrDropped: true,
        requiresValidSignedVisitorCookie: true,
        missingCookieStatus: 428,
        missingCookieCode: "visitor_session_required",
        missingCookieBeforeAdmission: true,
        missingCookieBeforeProvider: true,
        invalidOrUndeclaredCookieStatus: 403,
        invalidOrUndeclaredCookieCode: "invalid_request",
        invalidOrUndeclaredCookieBeforeAdmission: true,
        invalidOrUndeclaredCookieBeforeProvider: true,
        sameBrowserWebLockAsSetup: true,
      },
      browserQuotaCookie: {
        name: "__Secure-hah-lattice-api-visitor",
        path: "/api/lattice",
        secure: true,
        httpOnly: true,
        sameSite: "Strict",
        domain: null,
        expiresAtNextUtcDay: true,
        containsUserContent: false,
        containsAccountIdentity: false,
        containsBrowserFingerprint: false,
        containsProviderCredential: false,
      },
      admission: {
        globalPerUtcDay: 30,
        perOrdinaryPersistentBrowserCookieJarPerUtcDay: 3,
        perBrowserLimitClaimScope: "cooperating canonical client with an ordinary persistent browser cookie jar",
        intentionalCookieClearingOrUncooperativeCallerCovered: false,
        globalLimitExactAndAuthoritative: true,
        atomicClaimsPerRequest: 1,
        countsAdmittedFailures: true,
        refundsAdmittedRequests: false,
        rechecksSharedQuotaWithinPipeline: false,
        usesIpAddress: false,
        usesBrowserFingerprint: false,
        storesSubmittedContentOrResult: false,
        maximumProviderCallsPerAdmittedRequest: 32,
        maximumProviderCallsFromAdmittedRequestsPerUtcDay: 960,
      },
      retry: false,
      fallback: false,
    },
  );
  assert.equal(capability.provider.endpoint, "https://router.huggingface.co/v1/chat/completions");
  assert.equal(capability.provider.generatorModel, "Qwen/Qwen3-4B-Instruct-2507:nscale");
  assert.equal(capability.provider.verifierModel, "meta-llama/Llama-3.1-8B-Instruct:deepinfra");
  assert.equal(capability.provider.historicalByteEquivalenceEstablished, false);
  assert.equal(register.artifactSet.historicalBrowserLocalArtifacts.status, "historical-inactive");
  assert.deepEqual(register.artifactSet.llamaTerms.active, {
    status: "active",
    version: "Llama 3.1",
    model: "meta-llama/Llama-3.1-8B-Instruct:deepinfra",
    modelRepository: "https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct",
    modelRepositoryRevision: "0e9e39f249a16976918f6564b8830bc894c89659",
    modelRepositoryRevisionUrl: "https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct/tree/0e9e39f249a16976918f6564b8830bc894c89659",
    license: {
      path: "LICENSES/Llama-3.1-Community-License.txt",
      sha256: "64e1b2889b7892e6bbe7a7ed5bfe6ff793c61f9d584345f8f41cf9f5cb30a369",
      gitBlob: "a7c3ca16cee30425ed6ad841a809590f2bcbf290",
      sourceUrl: "https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct/blob/0e9e39f249a16976918f6564b8830bc894c89659/LICENSE",
      canonicalUrl: "https://developer.meta.com/ai/llama3_1/license/",
    },
    acceptableUsePolicy: {
      path: "LICENSES/Llama-3.1-Acceptable-Use-Policy.md",
      sha256: "a568f2ebc73cec3fd74ba2afd992d4e945a8c7a9d851f9b66163aac834b7b859",
      gitBlob: "81ebb55902285e8dd5804ccf423d17ffb2a622ee",
      sourceUrl: "https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct/blob/0e9e39f249a16976918f6564b8830bc894c89659/USE_POLICY.md",
      canonicalUrl: "https://developer.meta.com/ai/llama3_1/use-policy/",
    },
    officialSourceCommit: "1f0feb795a4130697ced243fb53051670d591653",
    termsMatchStatus: "byte-identical-to-reviewed-model-repository-files",
    reviewedAt: "2026-09-25",
  });
  assert.equal(register.artifactSet.llamaTerms.historicalBrowserLocal.status, "historical-inactive");
  assert.equal(register.artifactSet.llamaTerms.historicalBrowserLocal.version, "Llama 3.2");
  assert.equal(
    register.artifactSet.llamaTerms.historicalBrowserLocal.license.path,
    "LICENSES/Llama-3.2-Community-License.txt",
  );
  assert.equal(
    register.artifactSet.llamaTerms.historicalBrowserLocal.acceptableUsePolicy.path,
    "LICENSES/Llama-3.2-Acceptable-Use-Policy.md",
  );
  assert.equal(register.artifactSet.llamaBehaviorEvaluation.targetVerifier.model, capability.provider.verifierModel);
  assert.equal(
    register.artifactSet.llamaBehaviorEvaluation.targetVerifier.modelRepositoryRevision,
    register.artifactSet.llamaTerms.active.modelRepositoryRevision,
  );
  assert.equal(register.artifactSet.llamaBehaviorEvaluation.evidenceResetAt, "2026-09-25");
  assert.match(register.artifactSet.llamaBehaviorEvaluation.evidenceResetReason, /different model or serving revision/iu);
  assert.equal(register.artifactSet.llamaBehaviorEvaluation.exactModelExecutionPerformed, false);

  for (const id of ["GATE-02", "GATE-03", "GATE-06"]) {
    const gate = register.gates.find((item) => item.id === id);
    assert.equal(gate.historicalInactiveRecord.status, "historical-inactive");
    assert.equal(
      sha256(JSON.stringify({ currentEvidence: gate.currentEvidence, evidence: gate.evidence })),
      gate.historicalInactiveRecord.verbatimSha256,
    );
    assert.ok(gate.activeEvidence.length > 0);
    assert.match(gate.activeCurrentEvidence, /Source/u);
  }
  assert.match(register.gates.find(({ id }) => id === "GATE-02").currentEvidence, /actions\/runs\/34320931448/u);
  assert.match(register.gates.find(({ id }) => id === "GATE-06").currentEvidence, /actions\/runs\/34325228788/u);
  for (const legalAuthorityPath of [
    "COMMERCIAL-LICENSE.md",
    "COMMERCIAL_BASELINE.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "LICENSE-MAP.json",
    "LICENSING.md",
    "NOTICE",
    "PERMISSIVE-EXCEPTIONS.md",
    "README.md",
    "TRADEMARKS.md",
    "WORKFLOW-BOUNDARIES.md",
  ]) {
    assert.ok(register.authority.qualifiedSourceSet.files.includes(legalAuthorityPath), `${legalAuthorityPath} is release-bound`);
  }
  assert.ok(register.authority.qualifiedSourceSet.files.includes("docs/lattice-resume-demo-requirements.md"));
  assert.ok(register.authority.qualifiedSourceSet.files.includes("docs/text-to-lattice/TEXT-TO-LATTICE-BROWSER-EVIDENCE.schema.json"));
  assert.ok(register.authority.qualifiedSourceSet.files.includes("docs/text-to-lattice/TEXT-TO-LATTICE-BROWSER-EVIDENCE.template.json"));
  assert.ok(register.authority.qualifiedSourceSet.trees.includes("workers/text-to-lattice-api"));
  assert.ok(register.authority.qualifiedSourceSet.trees.includes("workers/text-to-lattice-lease"), "historical source remains digest-bound");
  assert.deepEqual(register.authority.browserEvidence, {
    status: "not-collected",
    path: null,
    sha256: null,
    ...Object.fromEntries(browserEvidenceIdentityFields.map((field) => [field, null])),
  });

  assert.match(view, /from "\.\/ResumeProjectsHeld"/u);
  assert.match(view, /<ResumeSearch>[\s\S]*?<ResumeProjectsHeld \/>/u);
  assert.doesNotMatch(view, /from "\.\/ResumeProjects"/u);
  assert.doesNotMatch(search, /from ["']\.\/ResumeProjects["']|onLatticeLaunch|followLatticeResult|requestRemoteLattice/u);
  assert.doesNotMatch(held, /<form\b|<textarea\b|role="dialog"|aria-haspopup=/u);
  const lattice = projectBySlug("lattice");
  assert.equal(lattice.interactiveRelease, "held");
  assert.equal(lattice.interaction, null);

  assert.match(workflow, /Deploy bounded Text to Lattice API/u);
  assert.match(workflow, /Require the exact provider and visitor-cookie encrypted bindings/u);
  assert.match(workflow, /Deploy résumé response policy/u);
  assert.doesNotMatch(workflow, /Deploy isolated verification frame|Deploy lease Worker/u);
  assert.match(validatorSource, /verifyHistoricalInactiveGateEvidence/u);
  assert.match(validatorSource, /held résumé search must not import or replay the interactive Text to Lattice path/u);
});

test("the release state enforces exact held, qualification-pending, and qualified tuples", async () => {
  const register = await releaseRegister();
  assert.deepEqual(verifyReleaseStatusState(register), {
    hasOpenBlocker: true,
    releasePhase: "held",
    enabled: false,
    qualificationPending: false,
    qualified: false,
    held: true,
  });

  const heldAfterServiceQualification = structuredClone(register);
  for (const id of ["GATE-02", "GATE-03"]) {
    heldAfterServiceQualification.gates.find((gate) => gate.id === id).status = "satisfied-in-production";
  }
  assert.equal(verifyReleaseStatusState(heldAfterServiceQualification).releasePhase, "held");

  const falseRelease = structuredClone(register);
  falseRelease.overallStatus = "qualified";
  falseRelease.publicClient.status = "enabled";
  falseRelease.publicClient.publicationMode = "interactive-client";
  delete falseRelease.publicClient.heldBoundary;
  assert.throws(
    () => verifyReleaseStatusState(falseRelease),
    /release state must match exactly one held, qualification-pending, or qualified phase tuple/u,
  );

  const qualificationPending = structuredClone(falseRelease);
  qualificationPending.overallStatus = "qualification-pending";
  for (const gate of qualificationPending.gates) {
    if (["GATE-02", "GATE-03"].includes(gate.id)) gate.status = "satisfied-in-production";
    if (gate.id === "GATE-06") gate.status = "post-deployment-verification";
  }
  assert.deepEqual(verifyReleaseStatusState(qualificationPending), {
    hasOpenBlocker: false,
    releasePhase: "qualification-pending",
    enabled: true,
    qualificationPending: true,
    qualified: false,
    held: false,
  });

  const prematureQualification = structuredClone(qualificationPending);
  prematureQualification.gates.find(({ id }) => id === "GATE-03").status = "open-release-blocker";
  assert.throws(
    () => verifyReleaseStatusState(prematureQualification),
    /GATE-06 post-deployment verification is allowed only in the qualification-pending phase after GATE-02 and GATE-03 are satisfied/u,
  );

  const staleLifecycleQualification = structuredClone(register);
  staleLifecycleQualification.gates.find(({ id }) => id === "GATE-06").status = "satisfied-in-production";
  assert.throws(
    () => verifyReleaseStatusState(staleLifecycleQualification),
    /GATE-06 cannot remain satisfied in production unless GATE-02 and GATE-03 are also satisfied/u,
  );

  const hypotheticalQualified = structuredClone(falseRelease);
  for (const gate of hypotheticalQualified.gates) {
    if (gate.status === "open-release-blocker") gate.status = "satisfied-in-production";
  }
  assert.deepEqual(verifyReleaseStatusState(hypotheticalQualified), {
    hasOpenBlocker: false,
    releasePhase: "qualified",
    enabled: true,
    qualificationPending: false,
    qualified: true,
    held: false,
  });
});

test("the release-state reader emits the phase and public-client status", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "lattice-release-state-test-"));
  const outputPath = join(temporaryDirectory, "github-output");
  try {
    const { stdout } = await execute(process.execPath, [
      join(root, "scripts/read-text-to-lattice-release-state.mjs"),
    ], {
      cwd: root,
      env: { ...process.env, GITHUB_OUTPUT: outputPath },
    });
    assert.match(stdout, /release phase: held; public-client status: held/u);
    const register = await releaseRegister();
    assert.equal(
      await readFile(outputPath, "utf8"),
      `public_client_status=held\nrelease_phase=held\nqualified_source_set_sha256=${register.authority.qualifiedSourceSet.sha256}\n`,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("held and qualification-pending phases prohibit browser-evidence authority claims", async () => {
  const held = await releaseRegister();
  await assert.doesNotReject(verifyBrowserEvidenceAuthority(held));

  const qualificationPending = qualifyRegister(structuredClone(held));
  qualificationPending.overallStatus = "qualification-pending";
  qualificationPending.gates.find(({ id }) => id === "GATE-06").status = "post-deployment-verification";
  await assert.doesNotReject(verifyBrowserEvidenceAuthority(
    qualificationPending,
    verifyReleaseStatusState(qualificationPending),
  ));

  const strayPath = structuredClone(held);
  strayPath.authority.browserEvidence.path = "docs/text-to-lattice/browser-evidence/unverified.json";
  await assert.rejects(
    verifyBrowserEvidenceAuthority(strayPath),
    /browserEvidence\.path must be null until the release is qualified/u,
  );
  const extraField = structuredClone(held);
  extraField.authority.browserEvidence.note = "prose is not evidence";
  await assert.rejects(
    verifyBrowserEvidenceAuthority(extraField),
    /only the exact typed fields in their canonical order/u,
  );
});

test("a fabricated GATE-06 prose hook and digest cannot qualify a release", async () => {
  const register = qualifyRegister(await releaseRegister());
  const gate06 = register.gates.find(({ id }) => id === "GATE-06");
  gate06.activeEvidence.push(
    `Fabricated structured browser evidence at made-up.json with SHA-256 ${sha256("fabricated")}.`,
  );
  await assert.rejects(
    verifyBrowserEvidenceAuthority(register, verifyReleaseStatusState(register)),
    /must bind a verified sanitized browser-evidence bundle/u,
  );
});

test("qualified browser evidence binds one strict bundle path, digest, and every deployment identity", async () => {
  const register = qualifyRegister(await releaseRegister());
  const fixture = browserEvidenceFixture(register.authority.qualifiedSourceSet.sha256);
  register.authority.browserEvidence = structuredClone(fixture.record);
  const expectedAbsolutePath = join(root, fixture.record.path);
  let observedPath = null;
  const verifyBundle = async (path) => {
    observedPath = path;
    return fixture.bundle;
  };
  await assert.doesNotReject(verifyBrowserEvidenceAuthority(
    register,
    verifyReleaseStatusState(register),
    verifyBundle,
  ));
  assert.equal(observedPath, expectedAbsolutePath);

  const wrongPath = structuredClone(register);
  wrongPath.authority.browserEvidence.path = "../outside-browser-evidence.json";
  await assert.rejects(
    verifyBrowserEvidenceAuthority(wrongPath, verifyReleaseStatusState(wrongPath), verifyBundle),
    /escapes the repository root/u,
  );

  const wrongBundle = async () => {
    throw new Error("strict browser fixture rejected");
  };
  await assert.rejects(
    verifyBrowserEvidenceAuthority(register, verifyReleaseStatusState(register), wrongBundle),
    /bundle failed strict validation: strict browser fixture rejected/u,
  );

  const wrongDigest = structuredClone(register);
  wrongDigest.authority.browserEvidence.sha256 = sha256("wrong-bundle");
  await assert.rejects(
    verifyBrowserEvidenceAuthority(wrongDigest, verifyReleaseStatusState(wrongDigest), verifyBundle),
    /sha256 does not match the strict browser-evidence bundle bytes/u,
  );

  for (const field of browserEvidenceIdentityFields) {
    const mismatch = structuredClone(register);
    mismatch.authority.browserEvidence[field] = field === "deploymentEvidenceUnchangedAcrossCaptures"
      ? false
      : `wrong-${field}`;
    await assert.rejects(
      verifyBrowserEvidenceAuthority(mismatch, verifyReleaseStatusState(mismatch), verifyBundle),
      new RegExp(`browserEvidence\\.${field} does not match`, "u"),
      field,
    );
  }

  const wrongQualifiedSourceSet = structuredClone(register);
  const wrongQualifiedSourceSetBundle = structuredClone(fixture.bundle);
  wrongQualifiedSourceSet.authority.browserEvidence.qualifiedSourceSetSha256 = sha256("other-qualified-source-set");
  wrongQualifiedSourceSetBundle.evidence.deployment.qualified_source_set_sha256 = sha256("other-qualified-source-set");
  await assert.rejects(
    verifyBrowserEvidenceAuthority(
      wrongQualifiedSourceSet,
      verifyReleaseStatusState(wrongQualifiedSourceSet),
      async () => wrongQualifiedSourceSetBundle,
    ),
    /qualifiedSourceSetSha256 must match authority\.qualifiedSourceSet\.sha256/u,
  );
});

test("the active remote gate contract is semantic and historical evidence is tamper-evident", async () => {
  const register = await releaseRegister();
  const gate02 = register.gates.find(({ id }) => id === "GATE-02");
  const gate03 = register.gates.find(({ id }) => id === "GATE-03");
  const gate06 = register.gates.find(({ id }) => id === "GATE-06");
  assert.doesNotThrow(() => verifyLifecycleGateContract(gate02, gate03, gate06));

  const missingRoute = structuredClone(gate02);
  for (const field of ["requirement", "evidenceNeeded", "rationale", "followUp", "rollbackCondition"]) {
    missingRoute[field] = missingRoute[field].replaceAll("/api/lattice", "/api/other");
  }
  assert.throws(() => verifyLifecycleGateContract(missingRoute, gate03, gate06), /GATE-02 omits the active remote boundary atom \/api\/lattice/u);
  const staleStatus = structuredClone(gate03);
  staleStatus.status = "post-deployment-verification";
  assert.throws(() => verifyLifecycleGateContract(gate02, staleStatus, gate06), /GATE-03 must remain open/u);
  const alteredHistory = structuredClone(gate06);
  alteredHistory.currentEvidence += " altered";
  assert.throws(() => verifyLifecycleGateContract(gate02, gate03, alteredHistory), /historical browser-local evidence is not verbatim/u);
  const leakedLegacyAssumption = structuredClone(gate06);
  leakedLegacyAssumption.followUp += " Reacquire a lease.";
  assert.throws(() => verifyLifecycleGateContract(gate02, gate03, leakedLegacyAssumption), /active remote requirement contains a browser-local lease assumption/u);
});

test("the source release verifier accepts the exact held record", async () => {
  const { stdout } = await execute(process.execPath, [validator, "--source"], { cwd: root });
  assert.match(stdout, /release boundary verified \(held, source\)/u);
});

test("the built Pages artifact remains documentation-only", async () => {
  const [sourceRegister, exportedRegister, resume] = await Promise.all([
    readFile(registerPath, "utf8"),
    readFile(join(root, "site/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json"), "utf8"),
    readFile(join(root, "site/resume/index.html"), "utf8"),
  ]);
  assert.equal(exportedRegister, sourceRegister);
  assert.equal(JSON.parse(exportedRegister).overallStatus, "held");
  assert.match(resume, /aria-label="Read Text to Lattice release status"/u);
  assert.doesNotMatch(resume, /data-lattice-launch="text-to-lattice"|id="lattice-demo-dialog"/u);
  await execute(process.execPath, [validator, "--source", "--site"], { cwd: root });
});

test("the held-site validator rejects executable bypasses outside the résumé", async () => {
  const route = (site) => join(site, "projects/medium/index.html");
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<script>fetch("/api/lattice")</script>'),
    /contains an executable \/api\/lattice request path/u,
  );
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<form action="/api/lattice"></form>'),
    /exposes the remote API boundary through form action/u,
  );
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<script>const endpoint="https://router.huggingface.co/v1/chat/completions"</script>'),
    /contains https:\/\/router\.huggingface\.co\/v1\/chat\/completions/u,
  );
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<script>throw new Error("Network policy denied text-to-lattice")</script>'),
    /contains Network policy denied text-to-lattice/u,
  );
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<script type="text/&#106;avascript">fetch("/api/text-to-lattice/lease")</script>'),
    /contains \/api\/text-to-lattice\/lease/u,
  );
  await withHeldSiteFixture(async (site) => {
    await writeFile(join(site, "runtime-entry"), 'fetch("https://verify.hah.dev")');
    await appendToHtml(route(site), '<script src="/runtime-entry"></script>');
  }, /held referenced script asset runtime-entry contains https:\/\/verify\.hah\.dev/u);
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<div id="lattice-demo-dialog"></div>'),
    /contains a Lattice interactive marker/u,
  );
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<script src="https://attacker.example/inference.js"></script>'),
    /references a cross-origin executable script/u,
  );
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<iframe src="HTTPS://VERIFY.HAH.DEV/challenge"></iframe>'),
    /exposes the verification or lease boundary through iframe src/u,
  );
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<iframe srcdoc="&lt;script&gt;fetch(\'/api/lattice\')&lt;/script&gt;"></iframe>'),
    /contains an executable iframe srcdoc/u,
  );
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<button onclick="fetch(\'/api/lattice\')">Run</button>'),
    /contains an inline event handler/u,
  );
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<base href="https://attacker.example/"><script src="/_next/static/chunks/index.js"></script>'),
    /contains a base element/u,
  );
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<a href="java&#x09script:fetch(\'/api/lattice\')">Run</a>'),
    /contains a javascript: URL/u,
  );
  await withHeldSiteFixture(
    (site) => writeFile(join(site, "runtime.data"), Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])),
    /contains WebAssembly bytes regardless of filename: runtime\.data/u,
  );
  await withHeldSiteFixture(
    (site) => symlink(join(site, "_next"), join(site, "linked-assets"), "dir"),
    /release site contains a symbolic link/u,
  );
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<link rel="preload" as="fetch" href="https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/Qwen3-4B-q4f16_1-ctx4k_cs1k-webgpu.wasm">'),
    /contains raw\.githubusercontent\.com\/mlc-ai\/binary-mlc-llm-libs/u,
  );
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<style>.preview { background: url("https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC/resolve/model.safetensors"); }</style>'),
    /contains huggingface\.co\/mlc-ai\/Llama-3\.2-3B-Instruct-q4f16_1-MLC\/resolve\//u,
  );
});
