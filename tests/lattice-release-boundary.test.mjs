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

async function releaseRegister() {
  return JSON.parse(await readFile(registerPath, "utf8"));
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
      secret: capability.secretBindingName,
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
      secret: "HF_TOKEN",
      retry: false,
      fallback: false,
    },
  );
  assert.equal(capability.provider.endpoint, "https://router.huggingface.co/v1/chat/completions");
  assert.equal(capability.provider.generatorModel, "Qwen/Qwen3-4B:featherless-ai");
  assert.equal(capability.provider.verifierModel, "meta-llama/Llama-3.2-3B-Instruct:featherless-ai");
  assert.equal(capability.provider.historicalByteEquivalenceEstablished, false);
  assert.equal(register.artifactSet.historicalBrowserLocalArtifacts.status, "historical-inactive");

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
  assert.ok(register.authority.qualifiedSourceSet.files.includes("docs/lattice-resume-demo-requirements.md"));
  assert.ok(register.authority.qualifiedSourceSet.trees.includes("workers/text-to-lattice-api"));
  assert.ok(register.authority.qualifiedSourceSet.trees.includes("workers/text-to-lattice-lease"), "historical source remains digest-bound");

  assert.match(view, /from "\.\/ResumeProjectsHeld"/u);
  assert.match(view, /<ResumeSearch>[\s\S]*?<ResumeProjectsHeld \/>/u);
  assert.doesNotMatch(view, /from "\.\/ResumeProjects"/u);
  assert.doesNotMatch(search, /from ["']\.\/ResumeProjects["']|onLatticeLaunch|followLatticeResult|requestRemoteLattice/u);
  assert.doesNotMatch(held, /<form\b|<textarea\b|role="dialog"|aria-haspopup=/u);
  const lattice = projectBySlug("lattice");
  assert.equal(lattice.interactiveRelease, "held");
  assert.equal(lattice.interaction, null);

  assert.match(workflow, /Deploy bounded Text to Lattice API/u);
  assert.match(workflow, /Require the server-only provider credential binding/u);
  assert.match(workflow, /Deploy résumé response policy/u);
  assert.doesNotMatch(workflow, /Deploy isolated verification frame|Deploy lease Worker/u);
  assert.match(validatorSource, /verifyHistoricalInactiveGateEvidence/u);
  assert.match(validatorSource, /held résumé search must not import or replay the interactive Text to Lattice path/u);
});

test("the release state cannot become enabled while any remote production gate is open", async () => {
  const register = await releaseRegister();
  assert.deepEqual(verifyReleaseStatusState(register), { hasOpenBlocker: true, enabled: false, held: true });
  const falseRelease = structuredClone(register);
  falseRelease.overallStatus = "qualified";
  falseRelease.publicClient.status = "enabled";
  falseRelease.publicClient.publicationMode = "interactive-client";
  delete falseRelease.publicClient.heldBoundary;
  assert.throws(
    () => verifyReleaseStatusState(falseRelease),
    /public client must be enabled if and only if no open release blocker remains/u,
  );
  const hypotheticalQualified = structuredClone(falseRelease);
  for (const gate of hypotheticalQualified.gates) {
    if (gate.status === "open-release-blocker") gate.status = "satisfied-in-production";
  }
  assert.deepEqual(verifyReleaseStatusState(hypotheticalQualified), { hasOpenBlocker: false, enabled: true, held: false });
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
