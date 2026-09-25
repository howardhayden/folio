import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SITE_SOURCE_TERMS_URL } from "../app/content/siteContent.js";
import { staticSourceCopies } from "../app/semantic/routes.js";

const sourceUrl = (path) => new URL(`../${path}`, import.meta.url);
const readText = (path) => readFile(sourceUrl(path), "utf8");
const readPackage = async (name) => JSON.parse(await readText(`node_modules/${name}/package.json`));
const repositoryUrl = ({ repository }) => (typeof repository === "string" ? repository : repository.url)
  .replace(/^git\+/u, "")
  .replace(/\.git$/u, "");

test("direct framework and font dependencies ship their resolved notices and license texts", async () => {
  const [notices, index, react, reactDom, vinext, bootstrap, jost] = await Promise.all([
    readText("THIRD_PARTY_NOTICES.md"),
    readText("THIRD_PARTY_LICENSES.txt"),
    readPackage("react"),
    readPackage("react-dom"),
    readPackage("vinext"),
    readPackage("bootstrap"),
    readPackage("@fontsource/jost"),
  ]);

  for (const dependency of [react, reactDom, vinext, bootstrap]) {
    assert.equal(dependency.license, "MIT", `${dependency.name} declares MIT terms`);
  }
  assert.equal(react.version, reactDom.version, "React and React DOM use one shared notice version");
  assert.equal(jost.license, "OFL-1.1");

  const distributions = [
    {
      component: "React and React DOM",
      version: react.version,
      upstream: repositoryUrl(react),
      supplied: "LICENSES/MIT-React.txt",
      installed: ["node_modules/react/LICENSE", "node_modules/react-dom/LICENSE"],
    },
    {
      component: "Vinext",
      version: vinext.version,
      upstream: repositoryUrl(vinext),
      supplied: "LICENSES/MIT-vinext.txt",
      installed: ["node_modules/vinext/LICENSE"],
    },
    {
      component: "Bootstrap",
      version: bootstrap.version,
      upstream: repositoryUrl(bootstrap),
      supplied: "LICENSES/MIT-Bootstrap.txt",
      installed: ["node_modules/bootstrap/LICENSE"],
    },
  ];

  const copiedSources = new Set(staticSourceCopies.map(({ source }) => source));
  for (const distribution of distributions) {
    assert.ok(
      notices.includes(`| ${distribution.component} | ${distribution.version} | ${distribution.upstream} |`),
      `${distribution.component} resolved version and installed upstream are disclosed`,
    );
    assert.ok(notices.includes(`](${distribution.supplied})`), `${distribution.component} notice links its terms`);
    assert.ok(index.includes(distribution.supplied), `${distribution.component} terms are indexed`);
    assert.ok(copiedSources.has(distribution.supplied), `${distribution.component} terms are copied into the static site`);

    const suppliedText = await readText(distribution.supplied);
    for (const installedPath of distribution.installed) {
      assert.equal(suppliedText, await readText(installedPath), `${distribution.supplied} matches ${installedPath}`);
    }
  }

  const jostTerms = "LICENSES/OFL-1.1-Jost.txt";
  assert.ok(
    notices.includes("| Jost | Font files distributed through `@fontsource/jost` " + jost.version + " |"),
    "the resolved Jost package version is disclosed",
  );
  assert.ok(notices.includes(`](${jostTerms})`), "the Jost notice links its OFL terms");
  assert.ok(index.includes(jostTerms), "the Jost terms are indexed");
  assert.ok(copiedSources.has(jostTerms), "the Jost terms are copied into the static site");
  assert.match(await readText(jostTerms), /SIL OPEN FONT LICENSE Version 1\.1/u);
});

test("current Owner terms align across policy, package, semantic, and baseline records", async () => {
  const [
    rootLicense,
    publishedLicense,
    historicalLicense,
    licensing,
    notice,
    baseline,
    licenseMapSource,
    packageSource,
    packageLockSource,
    workerPackageSource,
    workerPackageLockSource,
    semanticSource,
  ] = await Promise.all([
    readText("LICENSE"),
    readText("LICENSES/LicenseRef-Hayden-Proprietary-1.1.txt"),
    readText("LICENSES/HISTORICAL/LicenseRef-Hayden-Proprietary-1.0.txt"),
    readText("LICENSING.md"),
    readText("NOTICE"),
    readText("COMMERCIAL_BASELINE.md"),
    readText("LICENSE-MAP.json"),
    readText("package.json"),
    readText("package-lock.json"),
    readText("workers/package.json"),
    readText("workers/package-lock.json"),
    readText("app/semantic/portfolio.js"),
  ]);
  const licenseMap = JSON.parse(licenseMapSource);
  const packageManifest = JSON.parse(packageSource);
  const packageLock = JSON.parse(packageLockSource);
  const workerPackage = JSON.parse(workerPackageSource);
  const workerPackageLock = JSON.parse(workerPackageLockSource);
  const copiedSources = new Set(staticSourceCopies.map(({ source }) => source));

  assert.equal(rootLicense, publishedLicense, "the public current-terms copy matches the root authority");
  assert.equal(
    createHash("sha256").update(rootLicense).digest("hex"),
    "07b7734eb4da7c79ffdd32d4641ab64eea1922e8149ebf50c430e5f54657628c",
    "the active 1.1 terms match the canonical cross-repository bytes",
  );
  assert.equal(
    createHash("sha256").update(historicalLicense).digest("hex"),
    "3789df4e97aa03942c669fe067346f8ff13ab84e9bb6514b0c81552a48c4681e",
    "the superseded 1.0 baseline terms remain byte-exact historical evidence",
  );
  assert.match(rootLicense, /SPDX-License-Identifier: LicenseRef-Hayden-Proprietary-1\.1/u);
  assert.match(rootLicense, /This license applies prospectively/u);
  assert.match(rootLicense, /do not automatically attach to later copies or snapshots/u);
  assert.match(licensing, /Historical MIT and PolyForm notices/u);
  assert.match(notice, /Permissions validly attached to earlier distributed copies/u);
  assert.match(notice, /do not automatically attach to later copies or snapshots/u);
  assert.match(baseline, /5bd566fb2ae4f456a03efcfa11b1ed96dd201912/u);
  assert.match(baseline, /3d3b57d1a8f007eb9151549385a2ca49fb1e46cd/u);

  assert.equal(licenseMap.default_license, "LicenseRef-Hayden-Proprietary-1.1");
  assert.equal(licenseMap.implementation_reuse_granted, false);
  assert.equal(licenseMap.noncommercial_reuse_granted, false);
  assert.equal(licenseMap.rules.some(({ license }) => license === "PolyForm-Noncommercial-1.0.0"), false);
  assert.match(licenseMap.historical_notice, /earlier distributed copies remain governed by their own terms/u);
  assert.match(licenseMap.historical_notice, /do not automatically attach to later copies or snapshots/u);
  assert.match(licenseMap.historical_notice, /does not determine whether an earlier permission applies to a different copy or later distribution/u);

  assert.deepEqual(
    [packageManifest.private, packageManifest.license, packageLock.packages[""].license],
    [true, "UNLICENSED", "UNLICENSED"],
  );
  assert.deepEqual(
    [workerPackage.private, workerPackage.license, workerPackageLock.packages[""].license],
    [true, "UNLICENSED", "UNLICENSED"],
  );
  assert.equal(SITE_SOURCE_TERMS_URL, "https://hah.dev/LICENSES/LicenseRef-Hayden-Proprietary-1.1.txt");
  assert.ok(copiedSources.has("LICENSES/LicenseRef-Hayden-Proprietary-1.1.txt"));
  assert.ok(copiedSources.has("LICENSES/HISTORICAL/LicenseRef-Hayden-Proprietary-1.0.txt"));
  assert.ok(copiedSources.has("LICENSES/HISTORICAL/PolyForm-Noncommercial-1.0.0.txt"));
  assert.equal(copiedSources.has("LICENSES/PolyForm-Noncommercial-1.0.0.txt"), false);
  assert.match(semanticSource, /Historical PolyForm Noncommercial 1\.0\.0/u);
  assert.match(semanticSource, /not a new grant over material first published under the current terms/u);
});

test("Text to Lattice implementation stays under the declared proprietary terms", async () => {
  const licenseMap = JSON.parse(await readText("LICENSE-MAP.json"));
  const latticeRuleIndex = licenseMap.rules.findIndex(({ paths }) => paths.includes("app/resume/lattice/**"));
  const resumeContentRuleIndex = licenseMap.rules.findIndex(({ paths }) => paths.includes("app/resume/**"));

  assert.ok(latticeRuleIndex >= 0, "the map has an explicit Text to Lattice software rule");
  assert.ok(resumeContentRuleIndex > latticeRuleIndex, "the specific software rule precedes the resume-content rule");

  const latticeRule = licenseMap.rules[latticeRuleIndex];
  assert.equal(latticeRule.license, licenseMap.default_license);
  assert.equal(latticeRule.license, "LicenseRef-Hayden-Proprietary-1.1");
  assert.ok(latticeRule.paths.includes("app/resume/latticeDemo.js"));
  assert.ok(latticeRule.paths.includes("app/resume/ResumeProjects.tsx"));
  assert.ok(latticeRule.paths.includes("app/resume/ResumeProjectsHeld.tsx"));
});

test("active Llama terms, required attribution, and historical artifacts are regression-bound", async () => {
  const { createHash } = await import("node:crypto");
  const [
    notice,
    notices,
    activeLicense,
    activeAcceptableUse,
    historicalLicense,
    historicalAcceptableUse,
    registerSource,
  ] = await Promise.all([
    readText("NOTICE"),
    readText("THIRD_PARTY_NOTICES.md"),
    readFile(sourceUrl("LICENSES/Llama-3.1-Community-License.txt")),
    readFile(sourceUrl("LICENSES/Llama-3.1-Acceptable-Use-Policy.md")),
    readFile(sourceUrl("LICENSES/Llama-3.2-Community-License.txt")),
    readFile(sourceUrl("LICENSES/Llama-3.2-Acceptable-Use-Policy.md")),
    readText("docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json"),
  ]);
  const register = JSON.parse(registerSource);
  const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
  const { active, historicalBrowserLocal } = register.artifactSet.llamaTerms;
  const copiedSources = new Set(staticSourceCopies.map(({ source }) => source));

  assert.equal(active.status, "active");
  assert.equal(active.version, "Llama 3.1");
  assert.equal(active.model, "meta-llama/Llama-3.1-8B-Instruct:deepinfra");
  assert.equal(active.modelRepositoryRevision, "0e9e39f249a16976918f6564b8830bc894c89659");
  assert.equal(sha256(activeLicense), active.license.sha256);
  assert.equal(sha256(activeAcceptableUse), active.acceptableUsePolicy.sha256);
  assert.equal(active.license.gitBlob, "a7c3ca16cee30425ed6ad841a809590f2bcbf290");
  assert.equal(active.acceptableUsePolicy.gitBlob, "81ebb55902285e8dd5804ccf423d17ffb2a622ee");
  assert.ok(copiedSources.has(active.license.path));
  assert.ok(copiedSources.has(active.acceptableUsePolicy.path));

  assert.equal(historicalBrowserLocal.status, "historical-inactive");
  assert.equal(historicalBrowserLocal.version, "Llama 3.2");
  assert.equal(sha256(historicalLicense), historicalBrowserLocal.license.sha256);
  assert.equal(sha256(historicalAcceptableUse), historicalBrowserLocal.acceptableUsePolicy.sha256);
  assert.ok(copiedSources.has(historicalBrowserLocal.license.path));
  assert.ok(copiedSources.has(historicalBrowserLocal.acceptableUsePolicy.path));
  assert.match(notice, /Built with Llama\./u);
  assert.match(notice, /Llama 3\.1 is licensed under the Llama 3\.1 Community License, Copyright © Meta Platforms, Inc\. All Rights Reserved\./u);
  assert.match(notice, /Llama 3\.2 is licensed under the Llama 3\.2 Community License, Copyright © Meta Platforms, Inc\. All Rights Reserved\./u);
  assert.match(notices, new RegExp(active.modelRepositoryRevision, "u"));
  assert.match(notices, new RegExp(active.license.sha256, "u"));
  assert.match(notices, new RegExp(active.acceptableUsePolicy.sha256, "u"));
  assert.match(notices, /developer\.meta\.com\/ai\/llama3_1\/license\//u);
  assert.match(notices, /developer\.meta\.com\/ai\/llama3_1\/use-policy\//u);
  assert.match(notices, /historical inactive Llama 3\.2/u);
  assert.match(notices, new RegExp(register.artifactSet.wasm.files.generator.sha256, "u"));
  assert.match(notices, new RegExp(register.artifactSet.wasm.files.verifier.sha256, "u"));
  assert.equal(register.artifactSet.wasm.reproducibility.status, "accepted-residual-risk");
  assert.equal(register.artifactSet.wasm.reproducibility.established, false);
  assert.equal(register.artifactSet.models.verifier.artifactProvenanceStatus, "accepted-residual-risk");
  assert.equal(register.artifactSet.models.verifier.artifactProvenanceEstablished, false);
});

test("Lattice documentation source, generator, and exported editions retain distinct terms", async () => {
  const licenseMap = JSON.parse(await readText("LICENSE-MAP.json"));
  const ruleFor = (path) => licenseMap.rules.find(({ paths }) => paths.includes(path));
  const publicReleaseEvidence = [
    "public/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md",
    "public/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json",
    "public/documentation/text-to-lattice/LLAMA-USE-EVALUATION-CASES.json",
  ];

  assert.equal(ruleFor("scripts/docs/**")?.license, "LicenseRef-Hayden-Proprietary-1.1");
  assert.equal(ruleFor("docs/text-to-lattice/**")?.license, "LicenseRef-Hayden-Portfolio-Content");
  assert.equal(ruleFor("public/documentation/text-to-lattice/*.md")?.license, "LicenseRef-Hayden-Portfolio-Content");
  for (const path of publicReleaseEvidence) {
    assert.equal(ruleFor(path)?.license, "LicenseRef-Hayden-Portfolio-Content", `${path} has explicit authored-content terms`);
  }
  assert.equal(ruleFor("public/documentation/text-to-lattice/**")?.license, "SOURCE-COMPONENT-TERMS");
  assert.ok(
    licenseMap.rules.indexOf(ruleFor("public/documentation/text-to-lattice/*.md"))
      < licenseMap.rules.indexOf(ruleFor("public/documentation/text-to-lattice/**")),
    "authored public Markdown precedes the mixed generated-artifact rule",
  );
});

test("third-party notice release-evidence links resolve from the deployed site root", async () => {
  const [notices, noticePage] = await Promise.all([
    readText("THIRD_PARTY_NOTICES.md"),
    readText("app/third-party-notices/page.tsx"),
  ]);
  const expectedLinks = [
    ["release qualification", "/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md"],
    ["machine-readable release register", "/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json"],
  ];
  const copiedPaths = new Set(staticSourceCopies.map(({ pathname }) => pathname));

  for (const [label, pathname] of expectedLinks) {
    assert.ok(notices.includes(`[${label}](${pathname})`), `${label} uses its deployed root-relative path`);
    assert.ok(copiedPaths.has(pathname), `${label} is copied to the linked deployed path`);
  }
  assert.doesNotMatch(notices, /\]\(docs\/text-to-lattice\/TEXT-TO-LATTICE-RELEASE-/u);
  assert.match(noticePage, /"interactiveRelease" in latticeProject/u);
  assert.match(
    noticePage,
    /When the machine release record contains an open blocker, the client stays outside the public bundle and makes no transformation submission/u,
  );
  assert.match(
    noticePage,
    /The enabled browser flow first sends one content-free cookie setup <code>POST \/api\/lattice<\/code>[\s\S]*?then exactly one content-bearing <code>POST \/api\/lattice<\/code> whose JSON body contains exactly[\s\S]*?Only the second request includes submitted text or can initiate external-provider processing/u,
  );
  assert.match(
    noticePage,
    /former browser-local WebLLM\/MLC runtime[\s\S]*?historical and inactive/u,
  );
  assert.doesNotMatch(noticePage, /enabled implementation[^.]*downloads pinned model|active browser-local/iu);
});
