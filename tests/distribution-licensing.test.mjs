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
});

test("Lattice documentation source, generator, and exported editions retain distinct terms", async () => {
  const licenseMap = JSON.parse(await readText("LICENSE-MAP.json"));
  const ruleFor = (path) => licenseMap.rules.find(({ paths }) => paths.includes(path));

  assert.equal(ruleFor("scripts/docs/**")?.license, "PolyForm-Noncommercial-1.0.0");
  assert.equal(ruleFor("docs/text-to-lattice/**")?.license, "LicenseRef-Hayden-Portfolio-Content");
  assert.equal(ruleFor("public/documentation/text-to-lattice/*.md")?.license, "LicenseRef-Hayden-Portfolio-Content");
  assert.equal(ruleFor("public/documentation/text-to-lattice/**")?.license, "SOURCE-COMPONENT-TERMS");
  assert.ok(
    licenseMap.rules.indexOf(ruleFor("public/documentation/text-to-lattice/*.md"))
      < licenseMap.rules.indexOf(ruleFor("public/documentation/text-to-lattice/**")),
    "authored public Markdown precedes the mixed generated-artifact rule",
  );
});
