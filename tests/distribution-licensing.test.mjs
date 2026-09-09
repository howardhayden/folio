import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { staticSourceCopies } from "../app/semantic/routes.js";

const sourceUrl = (path) => new URL(`../${path}`, import.meta.url);
const readText = (path) => readFile(sourceUrl(path), "utf8");
const readPackage = async (name) => JSON.parse(await readText(`node_modules/${name}/package.json`));
const repositoryUrl = ({ repository }) => (typeof repository === "string" ? repository : repository.url)
  .replace(/^git\+/u, "")
  .replace(/\.git$/u, "");

test("direct framework dependencies ship their resolved MIT notices and exact license texts", async () => {
  const [notices, index, react, reactDom, vinext, bootstrap] = await Promise.all([
    readText("THIRD_PARTY_NOTICES.md"),
    readText("THIRD_PARTY_LICENSES.txt"),
    readPackage("react"),
    readPackage("react-dom"),
    readPackage("vinext"),
    readPackage("bootstrap"),
  ]);

  for (const dependency of [react, reactDom, vinext, bootstrap]) {
    assert.equal(dependency.license, "MIT", `${dependency.name} declares MIT terms`);
  }
  assert.equal(react.version, reactDom.version, "React and React DOM use one shared notice version");

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
});

test("Text to Lattice implementation stays under the declared software license", async () => {
  const licenseMap = JSON.parse(await readText("LICENSE-MAP.json"));
  const latticeRuleIndex = licenseMap.rules.findIndex(({ paths }) => paths.includes("app/resume/lattice/**"));
  const resumeContentRuleIndex = licenseMap.rules.findIndex(({ paths }) => paths.includes("app/resume/**"));

  assert.ok(latticeRuleIndex >= 0, "the map has an explicit Text to Lattice software rule");
  assert.ok(resumeContentRuleIndex > latticeRuleIndex, "the specific software rule precedes the resume-content rule");

  const latticeRule = licenseMap.rules[latticeRuleIndex];
  assert.equal(latticeRule.license, licenseMap.default_license);
  assert.equal(latticeRule.license, "PolyForm-Noncommercial-1.0.0");
  assert.ok(latticeRule.paths.includes("app/resume/latticeDemo.js"));
  assert.ok(latticeRule.paths.includes("app/resume/ResumeProjects.tsx"));
  assert.ok(latticeRule.paths.includes("app/resume/ResumeProjectsHeld.tsx"));
});

test("Llama terms, required attribution, and held-artifact provenance are regression-bound", async () => {
  const { createHash } = await import("node:crypto");
  const [notice, notices, license, acceptableUse, registerSource] = await Promise.all([
    readText("NOTICE"),
    readText("THIRD_PARTY_NOTICES.md"),
    readFile(sourceUrl("LICENSES/Llama-3.2-Community-License.txt")),
    readFile(sourceUrl("LICENSES/Llama-3.2-Acceptable-Use-Policy.md")),
    readText("docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json"),
  ]);
  const register = JSON.parse(registerSource);
  const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

  assert.equal(sha256(license), register.artifactSet.llamaTerms.license.sha256);
  assert.equal(sha256(acceptableUse), register.artifactSet.llamaTerms.acceptableUsePolicy.sha256);
  assert.match(notice, /Built with Llama\./u);
  assert.match(notice, /Llama 3\.2 is licensed under the Llama 3\.2 Community License, Copyright © Meta Platforms, Inc\. All Rights Reserved\./u);
  assert.match(notices, /developer\.meta\.com\/ai\/llama3_2\/license\//u);
  assert.match(notices, /developer\.meta\.com\/ai\/llama3_2\/use-policy\//u);
  assert.match(notices, new RegExp(register.artifactSet.wasm.files.generator.sha256, "u"));
  assert.match(notices, new RegExp(register.artifactSet.wasm.files.verifier.sha256, "u"));
  assert.equal(register.artifactSet.wasm.reproducibility.status, "open-before-publication");
  assert.equal(register.artifactSet.models.verifier.artifactProvenanceStatus, "open-before-publication");
});

test("Lattice documentation source, generator, and exported editions retain distinct terms", async () => {
  const licenseMap = JSON.parse(await readText("LICENSE-MAP.json"));
  const ruleFor = (path) => licenseMap.rules.find(({ paths }) => paths.includes(path));
  const publicReleaseEvidence = [
    "public/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md",
    "public/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json",
    "public/documentation/text-to-lattice/LLAMA-USE-EVALUATION-CASES.json",
  ];

  assert.equal(ruleFor("scripts/docs/**")?.license, "PolyForm-Noncommercial-1.0.0");
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
  assert.match(noticePage, /completed client is held outside the public bundle/u);
  assert.doesNotMatch(noticePage, /The browser downloads[^.]+when the tool is used/u);
});
