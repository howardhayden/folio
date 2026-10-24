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
  verifyEnabledPublicationCopy,
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

const publishedDossierPath = "documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md";
const datedHistoryBoundary = Buffer.from("The complete held dossier follows verbatim as dated history.");
const datedHistorySeparator = Buffer.from("The complete held dossier follows verbatim as dated history.\n\n---\n\n");
const staleEnabledClaims = [
  "release gates remain open",
  "must agree before the converter can open",
  "model-use controls and WebAssembly provenance are qualified",
  "dormant interface",
  "dormant dialog",
  "sole open blocker",
  "sole open release blocker",
  "held solely because",
  "hold the interactive client",
];

async function canonicalPublicationDossier() {
  return readFile(join(root, "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md"));
}

function verifyEqualDossierCopies(bytes) {
  verifyEnabledPublicationCopy(publishedDossierPath, bytes, Buffer.from(bytes));
}

function enabledPublicationDossierFixture(dossier) {
  const boundary = dossier.indexOf(datedHistorySeparator);
  assert.ok(boundary > 0);
  return Buffer.concat([
    Buffer.from("# Synthetic enabled publication fixture\n\nThis is a test fixture, not an actual release disposition.\n\n"),
    dossier.subarray(boundary),
  ]);
}

test("enabled publication history permits only the exact bound canonical held dossier", async () => {
  const dossier = await canonicalPublicationDossier();
  const boundary = dossier.indexOf(datedHistorySeparator);
  assert.ok(boundary > 0);
  const history = dossier.subarray(boundary + datedHistorySeparator.length);
  assert.equal(history.length, 500890);
  assert.equal(sha256(history), "71ecdf46afb200964f0b791e94bf20b819766c818b685cd974422d5dbccb5980");
  assert.match(history.toString("utf8"), /hold the interactive client/iu);
  const phase = verifyReleaseStatusState(await releaseRegister());
  if (phase.enabled) assert.doesNotThrow(() => verifyEqualDossierCopies(dossier));
  else assert.throws(() => verifyEqualDossierCopies(dossier), /stale held-gate copy/u);
  assert.doesNotThrow(() => verifyEqualDossierCopies(enabledPublicationDossierFixture(dossier)));
  assert.throws(() => verifyEnabledPublicationCopy(publishedDossierPath, dossier.toString("utf8"), dossier), /raw bytes/u);
});

test("enabled publication history rejects every stale current claim even when canonical copies agree", async () => {
  const dossier = enabledPublicationDossierFixture(await canonicalPublicationDossier());
  for (const claim of staleEnabledClaims) {
    const bytes = Buffer.concat([Buffer.from(`Current owner decision: ${claim}.\n\n`), dossier]);
    assert.throws(() => verifyEqualDossierCopies(bytes), /stale held-gate copy/u, claim);
  }
});

test("enabled publication history rejects changed, shortened, extended, or relocated held bytes", async () => {
  const dossier = enabledPublicationDossierFixture(await canonicalPublicationDossier());
  const boundary = dossier.indexOf(datedHistorySeparator);
  const historyStart = boundary + datedHistorySeparator.length;
  const changed = Buffer.from(dossier);
  changed[historyStart + 20] ^= 1;
  const relocated = Buffer.concat([
    dossier.subarray(0, boundary),
    dossier.subarray(historyStart, historyStart + 1),
    Buffer.from("\n"),
    datedHistorySeparator,
    dossier.subarray(historyStart + 1),
  ]);
  for (const bytes of [changed, dossier.subarray(0, -1), Buffer.concat([dossier, Buffer.from("\nextra")]), relocated]) {
    assert.throws(() => verifyEqualDossierCopies(bytes), /independently pinned held dossier/u);
  }
});

test("enabled publication history rejects missing, duplicate, altered, or ambiguous boundaries", async () => {
  const dossier = enabledPublicationDossierFixture(await canonicalPublicationDossier());
  const boundary = dossier.indexOf(datedHistorySeparator);
  const cases = [
    Buffer.concat([dossier.subarray(0, boundary), dossier.subarray(boundary + datedHistoryBoundary.length)]),
    Buffer.concat([datedHistorySeparator, dossier]),
    Buffer.from(dossier.toString("utf8").replace(datedHistoryBoundary.toString("utf8"), "The complete old dossier follows verbatim as dated history.")),
    Buffer.from(dossier.toString("utf8").replace(datedHistorySeparator.toString("utf8"), `${datedHistoryBoundary.toString("utf8")}\n---\n\n`)),
    Buffer.concat([dossier.subarray(0, boundary), Buffer.from("ambiguous "), dossier.subarray(boundary)]),
  ];
  for (const bytes of cases) {
    assert.throws(() => verifyEqualDossierCopies(bytes), /unique exact dated-history boundary/u);
  }
});

test("enabled publication history refuses raw canonical mismatch before projecting any history", async () => {
  const dossier = enabledPublicationDossierFixture(await canonicalPublicationDossier());
  const mismatch = Buffer.concat([Buffer.from("Different current text.\n"), dossier]);
  assert.throws(() => verifyEnabledPublicationCopy(publishedDossierPath, dossier, mismatch), /not byte-identical/u);
  assert.throws(() => verifyEnabledPublicationCopy(publishedDossierPath, mismatch, dossier), /not byte-identical/u);
  assert.throws(() => verifyEnabledPublicationCopy(publishedDossierPath, dossier), /not byte-identical/u);
});

test("enabled publication history grants no exception to other paths, formats, or historical JSON labels", async () => {
  const dossier = enabledPublicationDossierFixture(await canonicalPublicationDossier());
  const paths = [
    "other.md", "other.html", "other.json", "other.jsonld", "other.txt",
    "documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION-OLD.md",
    "documentation/text-to-lattice/text-to-lattice-release-qualification.md",
    `neighbor/${publishedDossierPath}`,
  ];
  for (const path of paths) {
    assert.throws(() => verifyEnabledPublicationCopy(path, dossier, dossier), /stale held-gate copy/u, path);
    assert.throws(() => verifyEnabledPublicationCopy(path, Buffer.from(JSON.stringify({ historical: { text: "release gates remain open" } })), dossier), /stale held-gate copy/u, path);
  }
});

test("enabled publication history permits a future truthful qualified prefix without changing the held pin", async () => {
  const dossier = await canonicalPublicationDossier();
  const boundary = dossier.indexOf(datedHistorySeparator);
  assert.ok(boundary > 0);
  const future = Buffer.concat([
    Buffer.from("# Future qualification record fixture\n\nCurrent browser evidence is qualified only when independently verified. This is a test fixture, not an actual release disposition.\n\n"),
    dossier.subarray(boundary),
  ]);
  assert.doesNotThrow(() => verifyEqualDossierCopies(future));
  for (const claim of staleEnabledClaims) {
    const stale = Buffer.concat([Buffer.from(`Current release says ${claim}.\n`), future]);
    assert.throws(() => verifyEqualDossierCopies(stale), /stale held-gate copy/u, claim);
  }
});

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

function clearBrowserEvidence(register) {
  register.authority.browserEvidence = Object.fromEntries(
    Object.keys(register.authority.browserEvidence).map((key) => [key, key === "status" ? "not-collected" : null]),
  );
  return register;
}

function heldRegisterFixture(register) {
  const fixture = structuredClone(register);
  fixture.overallStatus = "held";
  fixture.publicClient.status = "held";
  fixture.publicClient.publicationMode = "documentation-only";
  fixture.publicClient.heldBoundary ??= structuredClone(register.publicClient.priorHeldDisposition?.heldBoundary);
  fixture.gates.find(({ id }) => id === "GATE-06").status = "open-release-blocker";
  return clearBrowserEvidence(fixture);
}

function qualifyRegister(register) {
  register.overallStatus = "qualified";
  register.publicClient.status = "enabled";
  register.publicClient.publicationMode = "interactive-client";
  delete register.publicClient.heldBoundary;
  for (const gate of register.gates) {
    if (["GATE-02", "GATE-03", "GATE-06"].includes(gate.id)) gate.status = "satisfied-in-production";
  }
  return clearBrowserEvidence(register);
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

test("the release register enforces its exact current phase and preserves historical evidence", async () => {
  const [register, view, held, search, workflow, validatorSource, dossier] = await Promise.all([
    releaseRegister(),
    readFile(join(root, "app/resume/ResumeView.tsx"), "utf8"),
    readFile(join(root, "app/resume/ResumeProjectsHeld.tsx"), "utf8"),
    readFile(join(root, "app/resume/ResumeSearch.tsx"), "utf8"),
    readFile(join(root, ".github/workflows/pages.yml"), "utf8"),
    readFile(validator, "utf8"),
    readFile(join(root, "docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md"), "utf8"),
  ]);
  const phase = verifyReleaseStatusState(register);
  const heldBoundary = register.publicClient.heldBoundary ?? register.publicClient.priorHeldDisposition?.heldBoundary;
  assert.ok(heldBoundary, "held rollback boundary remains explicit in current or typed predecessor evidence");
  assert.equal(register.overallStatus, phase.releasePhase);
  assert.deepEqual(
    { status: register.publicClient.status, mode: register.publicClient.publicationMode },
    phase.enabled ? { status: "enabled", mode: "interactive-client" } : { status: "held", mode: "documentation-only" },
  );
  assert.ok(heldBoundary.allow.length > 0);
  assert.ok(heldBoundary.deny.some((item) => item.includes("/api/lattice")));
  assert.match(register.revision, /^\d{4}-\d{2}-\d{2}$/u);
  assert.ok(dossier.includes(`**Qualification date:** ${register.revision}`));
  if (phase.enabled) assert.equal(register.publicClient.heldBoundary, undefined);
  assert.match(register.qualificationScope, /last pulled hah\.dev deployment and ancestry baseline/u);
  assert.match(register.publicClient.reason, /run #162[\s\S]{0,140}diagnostic revision 5 merged by PR #51/iu);
  assert.match(register.publicClient.reason, /terminal_failure=host-validation, stage=verification, attempt=2, validation=response-shape, prior_validation=response-shape, calls_used=5, batch_count=1, verification_passes=0, and finding_count=1/u);
  assert.match(register.publicClient.reason, /aggregate calls_used=5 is not a failure-call ordinal/u);
  assert.match(register.publicClient.reason, /No exact invalid private structure or decoding-versus-host-normalization rejection origin was retained/u);
  assert.match(register.publicClient.reason, /diagnostic extension, revision 7/iu);
  assert.match(register.publicClient.reason, /Qualification run #166[\s\S]{0,250}diagnostic revision 7 merged by PR #53/iu);
  assert.match(register.publicClient.reason, /provider-envelope rejection at initial verification before private-wire decoding/iu);
  assert.match(register.publicClient.reason, /retained no revision-7 host predicate code or first deterministic finding/iu);
  assert.match(register.publicClient.reason, /diagnostic extension, revision 8/iu);
  assert.match(register.publicClient.reason, /Qualification run #168[\s\S]{0,250}diagnostic revision 8 merged by PR #54/iu);
  assert.match(register.publicClient.reason, /rejection_rule=V01F, prior_rejection_boundary=wire-decoder, prior_rejection_category=coverage, prior_rejection_rule=V16M/u);
  assert.match(register.publicClient.reason, /first_deterministic_rule=D14/u);
  assert.match(register.publicClient.reason, /four readiness probes observed one active response followed by three consecutive held responses/iu);
  assert.match(register.publicClient.reason, /no retrospective exact-predicate or deterministic-finding evidence for run #164/iu);
  assert.match(register.publicClient.reason, /source-only until separately deployed and observed/iu);
  assert.match(register.publicClient.reason, /run #160 exercised the merged correction/iu);
  assert.match(register.publicClient.reason, /run #158 supplied earlier partial, non-qualifying production failure/iu);
  assert.match(register.publicClient.reason, /verification under the 2,048-token ceiling[\s\S]*finish_reason=length[\s\S]*call_ordinal=3/iu);
  assert.match(register.publicClient.reason, /correction merged by PR #50 changes the private verifier and certifier representation/iu);
  const reviewedBaseline = dossier.match(/^\*\*Reviewed baseline:\*\* `([a-f0-9]{40})`$/mu)?.[1];
  assert.equal(reviewedBaseline, register.implementationBaselineRevision, "the dossier binds the current register baseline");
  assert.match(register.publicClient.reason, /merged by PR #50 was deployed for bounded qualification by run #160 but remains unqualified/iu);
  assert.match(register.publicClient.reason, /The current qualification-only diagnostic extension, revision 8/iu);
  assert.ok(heldBoundary.deny.some((item) => /production-verified or qualified/iu.test(item)));
  assert.ok(heldBoundary.deny.some((item) => /public client is activated/iu.test(item)));
  assert.ok(heldBoundary.deny.every((item) => !/candidate is deployed/iu.test(item)));
  assert.match(register.publicClient.reason, /2,048-token verifier cap, 520-token certifier cap[\s\S]*remain unchanged/iu);
  assert.match(register.publicClient.reason, /complete legal verifier output at 1,326 tokens[\s\S]*722 tokens or 54\.45 percent/iu);
  assert.match(register.publicClient.reason, /conservative accepted legal maximum is 440 tokens[\s\S]*80 under its 520-token cap/iu);
  assert.match(register.publicClient.reason, /correction remains unqualified and has no successful remote transformation or canonical-browser trace/iu);
  assert.match(register.publicClient.reason, /do not prove prior-call outcomes, the size or validity of a discarded object, or provider-managed token accounting/iu);
  assert.match(register.publicClient.reason, /Attempt 1 did not reach the live request boundary or provider canary and remains inconclusive transport evidence/iu);
  assert.doesNotMatch(register.publicClient.reason, /run #158[^.]{0,200}(?:proves|establishes)[^.]{0,100}(?:insufficient|budget is too small)/iu);
  assert.doesNotMatch(register.publicClient.reason, /run #150 supplied the newest/iu);
  assert.equal(register.ownerDisposition.status, phase.held ? "hold-directed" : "release-directed");
  assert.deepEqual(register.gates.map(({ id }) => id), expectedGateIds);
  assert.deepEqual(
    Object.fromEntries(register.gates.map(({ id, status }) => [id, status])),
    {
      "GATE-01": "release-workflow-enforced",
      "GATE-02": "satisfied-in-production",
      "GATE-03": "satisfied-in-production",
      "GATE-04A": "accepted-residual-risk",
      "GATE-04B": "historical-inactive",
      "GATE-04C": "historical-inactive",
      "GATE-05": "accepted-residual-risk",
      "GATE-06": phase.qualified ? "satisfied-in-production" : phase.qualificationPending ? "post-deployment-verification" : "open-release-blocker",
    },
  );
  const workflowGate = register.gates.find(({ id }) => id === "GATE-01");
  assert.match(
    workflowGate.currentEvidence,
    /run #158 built merged main commit 66c34fd4775efa8de6cf35110f8d623f4418210f[\s\S]*verification call ordinal 3[\s\S]*predecessor private representation[\s\S]*does not establish a complete legal verifier object, successful transformation, or qualification of the later private-representation correction/iu,
  );
  assert.match(workflowGate.currentEvidence, /Runs #156, #154, #152, #150, #147[^.]*remain earlier held-publication history/iu);

  const activeRemoteEvidence = [
    register.publicClient.reason,
    ...register.gates.flatMap((gate) => [gate.activeCurrentEvidence, ...(gate.activeEvidence ?? [])]),
  ].join(" ");
  for (const exactEvidence of [
    "https://github.com/howardhayden/folio/actions/runs/36725067719",
    "be20fab7dbf312deef5ccc77997932f077b21f6e",
    "2a7130b71189bb790f84ff8809b51542b6baf056",
    "7419de535c9d3b35b74a7455e11dad52073618403c874d33631759d04f119ca2",
    "d642e6f1bd47b5cdd92a139ea1653f7fe931fc84f9558f5f427626b53ebb5663",
    "c462dbefa7c781cfd1d68fb80cc10fe57ad55511e0ff616cfb3b1601492b97d9",
    "2026-09-30T13:58:37.984Z",
    "revision=coherent, deterministic=blocked, verification=unavailable, certification=not-reached",
    "terminal_failure=host-validation, stage=verification, attempt=2, validation=response-shape, prior_validation=response-shape, calls_used=5",
    "calls_used=5 is aggregate provider-call usage, not a failure-call ordinal",
    "44b459f6-b828-4aa0-8ad3-687347c17cfb",
    "83f5b124-ded8-45ea-a148-c43b5f15f5bf",
    "2026-09-30T13:58:48.168Z",
    "69c38fbd-1cd0-4d72-911d-3bcd5b087962",
    "7496d68f-29dd-4373-b078-0ab9b09942fa",
    "2026-09-30T13:59:14.894Z",
    "artifact ID 11101749025",
    "2759e725a3b66ed2aa25ad69254eeb4c54957702e0bb682cc11c988354045571",
    "artifact ID 11102479909",
    "d98087260e75f8cf60714b0b2d975e422902fa9be33dc0af11bc4c57fc129f60",
    "artifact ID 11101164549",
    "32c80e168a87a93e084ce60237f34c2052cc63ac4fe34b3af19bbc812a3bde19",
    "https://github.com/howardhayden/folio/actions/runs/36716298072",
    "94fba0deb97748f3a91693a3bae15296b0ef3699",
    "d483b0124f2d7fb8c76cf028f8667b7ffb264299630b3cba7736f8cb8cac37a6",
    "artifact ID 11096801240",
    "b9a44b22b8f61d607ea09ef4c8662fe776eec2410bafa972939c19778d638696",
    "stage_attempt=initial",
    "upstream_status=504",
    "prior_validation=none",
    "post-candidate-withheld with batch_count=1, verification_passes=0, and finding_count=1",
    "retained summary does not identify the exact internal cause",
    "6118ad58-8448-4d10-b564-ecee5538e0b8",
    "f24b2a69-a426-456e-99c5-cb1020f02e4a",
    "2026-09-30T12:56:33.469Z",
    "artifact ID 11097350508",
    "58c5d4dbaf2f715e316e2b0e3814e6036de7c5cdf9088115e0771dc9a5e6e446",
    "https://github.com/howardhayden/folio/actions/runs/36595292369",
    "66c34fd4775efa8de6cf35110f8d623f4418210f",
    "2677c607d748582348930f1b90087e09455fff9773ce2eca203a4a7474ab7a8a",
    "artifact ID 11046285940",
    "SHA-256 3bbf85126def25c4e71436015ca1d0ffc8f5b2e0cc8f99dd50016891dfd949ae",
    "1b32ab5c9fab139bd534a0e0ff6f2fbb89500bd37a1d8ed4150fbedbcdfb84ce",
    "artifact ID 11045708140",
    "SHA-256 55c8523d0fa64ae76435c30923ff5b9dfe87520578c6ad63f96b7e211abd88a0",
    "5c0a5749-0de2-4bd8-9494-7fa09ed38064",
    "b63929e2-e8f2-4c36-8555-ffa38312b32d",
    "64231b70-01b4-4b3f-be63-a1aed0600f97",
    "1fce513a-1059-424e-8175-8553e3d5c88e",
    "artifact ID 11046432393",
    "SHA-256 65983a6970b8ad8993ad4e47c3bf4b9c8b61adcaf7860655f87abedbaf0da6a2",
    "https://github.com/howardhayden/folio/actions/runs/36589409202",
    "run #156 is retained as predecessor-representation bounded failure and fail-closed rollback history",
  ]) assert.ok(activeRemoteEvidence.includes(exactEvidence), `active evidence includes ${exactEvidence}`);
  assert.match(
    activeRemoteEvidence,
    /run #158 attempt 2 canary[^\n]*outer HTTP 502[^\n]*malformed_upstream_response[^\n]*failure_class=provider_output_limit[^\n]*stage=verification[^\n]*call_ordinal=3[^\n]*finish_reason=length[^\n]*completion_tokens=2048-3071/iu,
  );

  const capability = register.artifactSet.activeCapability;
  assert.deepEqual(Object.keys(capability).sort(), [
    "status", "route", "method", "schemaVersion", "requestFields", "requestedModes",
    "trigger", "secretBindingNames", "visitorSessionSetup", "contentRequest",
    "browserQuotaCookie", "admission", "provider", "applicationRetention",
    "providerRetentionBoundary", "automaticRetry", "alternateProviderFallback",
    "responseCachePolicy",
  ].sort(), "the public capability cannot carry undeclared private wire fields");
  assert.deepEqual(Object.keys(capability.provider).sort(), [
    "endpoint", "verificationEndpoint", "verificationRequestModel", "generatorModel", "verifierModel", "stageCallTimeoutsMs",
    "certificationEndpoint", "certificationRequestModel", "verificationResponseFormat",
    "verificationSchemaStrict", "certificationResponseFormat", "certificationSchemaStrict",
    "maximumCallTimeoutMs", "callLimit", "stageMaximumOutputTokens",
    "maximumRequestedOutputTokensPerCall", "maximumRequestedOutputTokensPerAdmittedRequest",
    "maximumRequestedOutputTokensFromAdmittedRequestsPerUtcDay",
    "maximumRequestedOutputTokensFromOneCooperatingBrowserCookieJarPerUtcDay",
    "responseByteLimit", "contentCharacterLimit", "revisionStatus",
    "historicalByteEquivalenceEstablished",
  ].sort(), "the public provider contract cannot carry undeclared private wire fields");
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
      status: { held: "held-pending-production-evidence", "qualification-pending": "deployed-for-qualification", qualified: "qualified" }[phase.releasePhase],
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
  assert.equal(capability.provider.verificationEndpoint, "https://router.huggingface.co/v1/chat/completions");
  assert.equal(capability.provider.verificationRequestModel, "meta-llama/Llama-3.3-70B-Instruct:scaleway");
  assert.equal(capability.provider.generatorModel, "Qwen/Qwen3-235B-A22B-Instruct-2507:deepinfra");
  assert.equal(capability.provider.verifierModel, "meta-llama/Llama-3.3-70B-Instruct:scaleway");
  assert.equal(capability.provider.certificationEndpoint, "https://router.huggingface.co/v1/chat/completions");
  assert.equal(capability.provider.certificationRequestModel, "meta-llama/Llama-3.3-70B-Instruct:scaleway");
  assert.equal(capability.provider.verificationResponseFormat, "json_schema");
  assert.equal(capability.provider.verificationSchemaStrict, true);
  assert.equal(capability.provider.certificationResponseFormat, "json_schema");
  assert.equal(capability.provider.certificationSchemaStrict, true);
  assert.deepEqual(capability.provider.stageCallTimeoutsMs, {
    analysis: 120_000,
    candidate: 120_000,
    verification: 180_000,
    certification: 120_000,
    repair: 120_000,
  });
  assert.equal(capability.provider.maximumCallTimeoutMs, 180_000);
  assert.deepEqual(capability.provider.stageMaximumOutputTokens, {
    analysis: 2_048,
    candidate: 800,
    verification: 2_048,
    certification: 520,
    repair: 800,
  });
  assert.equal(capability.provider.maximumRequestedOutputTokensPerCall, 2_048);
  assert.equal(capability.provider.maximumRequestedOutputTokensPerAdmittedRequest, 65_536);
  assert.equal(
    capability.provider.maximumRequestedOutputTokensFromAdmittedRequestsPerUtcDay,
    1_966_080,
  );
  assert.equal(
    capability.provider.maximumRequestedOutputTokensFromOneCooperatingBrowserCookieJarPerUtcDay,
    196_608,
  );
  assert.equal(capability.provider.historicalByteEquivalenceEstablished, false);
  assert.equal(register.artifactSet.historicalBrowserLocalArtifacts.status, "historical-inactive");
  assert.deepEqual(register.artifactSet.llamaTerms.active, {
  "status": "active",
  "version": "Llama 3.3",
  "model": "meta-llama/Llama-3.3-70B-Instruct:scaleway",
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
  "termsMatchStatus": "byte-identical-to-reviewed-model-repository-files",
  "reviewedAt": "2026-10-23"
});
  assert.deepEqual(Object.keys(register.artifactSet.llamaTerms.historicalRemote).sort(), ["claimBoundary", "priorActiveRecord", "status"]);
  assert.equal(register.artifactSet.llamaTerms.historicalRemote.status, "historical-inactive");
  assert.deepEqual(register.artifactSet.llamaTerms.historicalRemote.priorActiveRecord, {
    status: "active",
    version: "Llama 3.1",
    model: "meta-llama/Llama-3.1-8B-Instruct:nscale",
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
  assert.equal(register.artifactSet.llamaBehaviorEvaluation.evidenceResetAt, "2026-10-23");
  assert.match(register.artifactSet.llamaBehaviorEvaluation.evidenceResetReason, /another (?:model, )?provider or serving revision/iu);
  assert.equal(register.artifactSet.llamaBehaviorEvaluation.exactModelExecutionPerformed, false);
  assert.deepEqual(register.artifactSet.llamaBehaviorEvaluation.historicalEvaluationRecord, {
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
  assert.deepEqual(register.artifactSet.historicalRemoteProvider.priorActiveProvider, {
  "endpoint": "https://router.huggingface.co/v1/chat/completions",
  "generatorModel": "Qwen/Qwen3-235B-A22B-Instruct-2507:deepinfra",
  "verifierModel": "meta-llama/Llama-3.1-8B-Instruct:nscale",
  "stageCallTimeoutsMs": {
    "analysis": 120000,
    "candidate": 120000,
    "verification": 180000,
    "certification": 120000,
    "repair": 120000
  },
  "maximumCallTimeoutMs": 180000,
  "callLimit": 32,
  "stageMaximumOutputTokens": {
    "analysis": 2048,
    "candidate": 800,
    "verification": 2048,
    "certification": 520,
    "repair": 800
  },
  "maximumRequestedOutputTokensPerCall": 2048,
  "maximumRequestedOutputTokensPerAdmittedRequest": 65536,
  "maximumRequestedOutputTokensFromAdmittedRequestsPerUtcDay": 1966080,
  "maximumRequestedOutputTokensFromOneCooperatingBrowserCookieJarPerUtcDay": 196608,
  "responseByteLimit": 262144,
  "contentCharacterLimit": 128000,
  "revisionStatus": "provider-managed-not-byte-pinned",
  "historicalByteEquivalenceEstablished": false,
  "verificationEndpoint": "https://router.huggingface.co/v1/chat/completions",
  "verificationRequestModel": "meta-llama/Llama-3.1-8B-Instruct:nscale",
  "certificationEndpoint": "https://router.huggingface.co/v1/chat/completions",
  "certificationRequestModel": "meta-llama/Llama-3.1-8B-Instruct:nscale",
  "verificationResponseFormat": "json_schema",
  "verificationSchemaStrict": true,
  "certificationResponseFormat": "json_schema",
  "certificationSchemaStrict": true
});

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
  if (phase.qualified) {
    await verifyBrowserEvidenceAuthority(register, phase);
    assert.equal(register.authority.browserEvidence.status, "verified-sanitized-bundle");
  } else {
    assert.deepEqual(register.authority.browserEvidence, {
      status: "not-collected",
      path: null,
      sha256: null,
      ...Object.fromEntries(browserEvidenceIdentityFields.map((field) => [field, null])),
    });
  }

  if (phase.enabled) {
    assert.match(view, /from "\.\/ResumeProjects"/u);
    assert.match(view, /<ResumeSearch>[\s\S]*?<ResumeProjects \/>/u);
    assert.doesNotMatch(view, /ResumeProjectsHeld/u);
  } else {
    assert.match(view, /from "\.\/ResumeProjectsHeld"/u);
    assert.match(view, /<ResumeSearch>[\s\S]*?<ResumeProjectsHeld \/>/u);
    assert.doesNotMatch(view, /from "\.\/ResumeProjects"/u);
  }
  assert.doesNotMatch(search, /from ["']\.\/ResumeProjects["']|onLatticeLaunch|followLatticeResult|requestRemoteLattice/u);
  assert.doesNotMatch(held, /<form\b|<textarea\b|role="dialog"|aria-haspopup=/u);
  const lattice = projectBySlug("lattice");
  assert.equal(lattice.interactiveRelease, phase.enabled ? "enabled" : "held");
  assert.equal(lattice.interaction, phase.enabled ? "lattice-demo" : null);

  assert.match(workflow, /Deploy bounded Text to Lattice API/u);
  assert.match(workflow, /Require the exact provider and visitor-cookie encrypted bindings/u);
  assert.match(workflow, /Deploy résumé response policy/u);
  assert.doesNotMatch(workflow, /Deploy isolated verification frame|Deploy lease Worker/u);
  assert.match(validatorSource, /verifyHistoricalInactiveGateEvidence/u);
  assert.match(validatorSource, /held résumé search must not import or replay the interactive Text to Lattice path/u);
});

test("the release state enforces exact held, qualification-pending, and qualified tuples", async () => {
  const register = heldRegisterFixture(await releaseRegister());
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
  staleLifecycleQualification.gates.find(({ id }) => id === "GATE-03").status = "open-release-blocker";
  assert.throws(
    () => verifyReleaseStatusState(staleLifecycleQualification),
    /GATE-06 cannot remain satisfied in production unless GATE-02 and GATE-03 are also satisfied/u,
  );

  const hypotheticalQualified = qualifyRegister(structuredClone(falseRelease));
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
    const register = await releaseRegister();
    const phase = verifyReleaseStatusState(register);
    assert.ok(stdout.includes(`release phase: ${phase.releasePhase}; public-client status: ${register.publicClient.status}`));
    assert.equal(
      await readFile(outputPath, "utf8"),
      `public_client_status=${register.publicClient.status}\nrelease_phase=${phase.releasePhase}\nqualified_source_set_sha256=${register.authority.qualifiedSourceSet.sha256}\n`,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("held and qualification-pending phases prohibit browser-evidence authority claims", async () => {
  const held = heldRegisterFixture(await releaseRegister());
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
  const phase = verifyReleaseStatusState(register).releasePhase;
  assert.doesNotThrow(() => verifyLifecycleGateContract(gate02, gate03, gate06, phase));
  const pendingGate06 = structuredClone(gate06);
  pendingGate06.status = "post-deployment-verification";
  assert.doesNotThrow(() => verifyLifecycleGateContract(gate02, gate03, pendingGate06, "qualification-pending"));
  assert.throws(
    () => verifyLifecycleGateContract(gate02, gate03, pendingGate06, "held"),
    /post-deployment verification requires the qualification-pending phase/u,
  );

  const missingRoute = structuredClone(gate02);
  for (const field of ["label", "requirement", "activeCurrentEvidence", "evidenceNeeded", "rationale", "followUp", "rollbackCondition"]) {
    missingRoute[field] = missingRoute[field].replaceAll("/api/lattice", "/api/other");
  }
  for (const field of ["activeEvidence", "safeguards"]) {
    missingRoute[field] = missingRoute[field].map((entry) => entry.replaceAll("/api/lattice", "/api/other"));
  }
  assert.throws(() => verifyLifecycleGateContract(missingRoute, gate03, gate06, phase), /GATE-02 omits the active remote boundary atom \/api\/lattice/u);
  const staleStatus = structuredClone(gate03);
  staleStatus.status = "post-deployment-verification";
  assert.throws(() => verifyLifecycleGateContract(gate02, staleStatus, gate06, phase), /GATE-03 must remain open/u);
  const alteredHistory = structuredClone(gate06);
  alteredHistory.currentEvidence += " altered";
  assert.throws(() => verifyLifecycleGateContract(gate02, gate03, alteredHistory, phase), /historical browser-local evidence is not verbatim/u);
  const leakedLegacyAssumption = structuredClone(gate06);
  leakedLegacyAssumption.followUp += " Reacquire a lease.";
  assert.throws(() => verifyLifecycleGateContract(gate02, gate03, leakedLegacyAssumption, phase), /active remote requirement contains a browser-local lease assumption/u);
});

test("the source release verifier accepts the exact current phase record", async () => {
  const { stdout } = await execute(process.execPath, [validator, "--source"], { cwd: root });
  const phase = verifyReleaseStatusState(await releaseRegister());
  assert.ok(stdout.includes(`release boundary verified (${phase.enabled ? "enabled" : "held"}, source)`));
});

test("the built Pages artifact enforces the exact current interaction boundary", async () => {
  const [sourceRegister, exportedRegister, resume] = await Promise.all([
    readFile(registerPath, "utf8"),
    readFile(join(root, "site/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json"), "utf8"),
    readFile(join(root, "site/resume/index.html"), "utf8"),
  ]);
  assert.equal(exportedRegister, sourceRegister);
  const phase = verifyReleaseStatusState(JSON.parse(sourceRegister));
  assert.equal(JSON.parse(exportedRegister).overallStatus, phase.releasePhase);
  if (phase.enabled) {
    assert.equal((resume.match(/data-lattice-launch="text-to-lattice"/gu) ?? []).length, 1);
    for (const id of ["lattice-demo-dialog", "lattice-demo-input", "lattice-use-confirmation"]) assert.ok(resume.includes(`id="${id}"`));
    const consent = resume.match(/<input[^>]*id="lattice-use-confirmation"[^>]*>/u)?.[0];
    assert.ok(consent);
    assert.doesNotMatch(consent, /\bchecked(?:=|\s|>)/u);
  } else {
    assert.match(resume, /aria-label="Read Text to Lattice release status"/u);
    assert.doesNotMatch(resume, /data-lattice-launch="text-to-lattice"|id="lattice-demo-dialog"/u);
  }
  await execute(process.execPath, [validator, "--source", "--site"], { cwd: root });
});

test("the held-site validator rejects executable bypasses outside the résumé", async () => {
  const route = (site) => join(site, "projects/medium/index.html");
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<script>const model="Qwen/Qwen3-Next-80B-A3B-Instruct:deepinfra"</script>'),
    /contains Qwen\/Qwen3-Next-80B-A3B-Instruct:deepinfra/u,
  );
  await withHeldSiteFixture(
    (site) => appendToHtml(route(site), '<script>const model="Qwen/Qwen3-235B-A22B-Instruct-2507:deepinfra"</script>'),
    /contains Qwen\/Qwen3-235B-A22B-Instruct-2507:deepinfra/u,
  );
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
    (site) => appendToHtml(route(site), '<script>const endpoint="https://router.huggingface.co/deepinfra/v1/openai/chat/completions"</script>'),
    /contains https:\/\/router\.huggingface\.co\/deepinfra\/v1\/openai\/chat\/completions/u,
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
