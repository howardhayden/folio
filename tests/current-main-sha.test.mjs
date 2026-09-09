import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { verifyCurrentMainSha } from "../scripts/verify-current-main-sha.mjs";

const currentSha = "a".repeat(40);
const staleSha = "b".repeat(40);

function githubRefResponse(sha = currentSha) {
  return new Response(JSON.stringify({
    ref: "refs/heads/main",
    object: { type: "commit", sha },
  }), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

function options(overrides = {}) {
  return {
    apiUrl: "https://api.github.com",
    attempts: 1,
    fetchImpl: async () => githubRefResponse(),
    repository: "howardhayden/folio",
    timeoutMs: 100,
    token: "test-token",
    workflowRef: "refs/heads/main",
    workflowSha: currentSha,
    ...overrides,
  };
}

test("the deployment guard accepts only the current main commit", async () => {
  const requests = [];
  const result = await verifyCurrentMainSha(options({
    apiUrl: "https://github.example/api/v3",
    fetchImpl: async (url, init) => {
      requests.push({ url: url.href, init });
      return githubRefResponse();
    },
  }));

  assert.equal(result, currentSha);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://github.example/api/v3/repos/howardhayden/folio/git/ref/heads/main");
  assert.equal(requests[0].init.headers.Authorization, "Bearer test-token");
  assert.equal(requests[0].init.redirect, "error");
  assert.equal(requests[0].init.cache, "no-store");
});

test("the deployment guard rejects a retained run whose SHA is no longer current main", async () => {
  await assert.rejects(
    verifyCurrentMainSha(options({ workflowSha: staleSha })),
    new RegExp(`Refusing stale deployment: workflow SHA ${staleSha} is not current main ${currentSha}`, "u"),
  );

  assert.equal(
    await verifyCurrentMainSha(options({ workflowSha: currentSha })),
    currentSha,
    "a rerun of the current tip remains eligible",
  );
});

test("the deployment guard fails closed on invalid workflow context", async (context) => {
  const invalidContexts = [
    ["missing token", { token: "" }, /GITHUB_TOKEN is required/u],
    ["non-main ref", { workflowRef: "refs/heads/release" }, /permits only refs\/heads\/main/u],
    ["abbreviated SHA", { workflowSha: "abc123" }, /exact lowercase 40-character commit SHA/u],
    ["dot owner", { repository: "./folio" }, /without dot-path components/u],
    ["dot-dot owner", { repository: "../folio" }, /without dot-path components/u],
    ["dot repository", { repository: "howardhayden/." }, /without dot-path components/u],
    ["dot-dot repository", { repository: "howardhayden/.." }, /without dot-path components/u],
    ["leading slash", { repository: "/folio" }, /must be owner\/repository/u],
    ["trailing slash", { repository: "howardhayden/" }, /must be owner\/repository/u],
    ["extra component", { repository: "howardhayden/folio/archive" }, /must be owner\/repository/u],
    ["backslash separator", { repository: "howardhayden\\folio" }, /must be owner\/repository/u],
    ["insecure API URL", { apiUrl: "http://github.example/api/v3" }, /must be an HTTPS origin or HTTPS path/u],
  ];

  for (const [name, override, expected] of invalidContexts) {
    await context.test(name, async () => {
      await assert.rejects(verifyCurrentMainSha(options(override)), expected);
    });
  }
});

test("the repository validator permits bounded GitHub punctuation without path traversal", async () => {
  let endpoint;
  const result = await verifyCurrentMainSha(options({
    fetchImpl: async (url) => {
      endpoint = url.href;
      return githubRefResponse();
    },
    repository: "open-ai/.github",
  }));
  assert.equal(result, currentSha);
  assert.equal(endpoint, "https://api.github.com/repos/open-ai/.github/git/ref/heads/main");
});

test("the deployment guard fails closed on unknown remote state", async (context) => {
  const cases = [
    ["HTTP error", async () => new Response("unavailable", { status: 503 }), /HTTP 503/u],
    ["network error", async () => { throw new Error("network unavailable"); }, /network unavailable/u],
    ["malformed JSON", async () => new Response("not-json", { status: 200 }), /not valid JSON/u],
    ["wrong ref", async () => new Response(JSON.stringify({ ref: "refs/heads/topic", object: { type: "commit", sha: currentSha } }), { status: 200 }), /did not identify refs\/heads\/main/u],
    ["wrong object type", async () => new Response(JSON.stringify({ ref: "refs/heads/main", object: { type: "tag", sha: currentSha } }), { status: 200 }), /did not identify refs\/heads\/main/u],
    ["malformed SHA", async () => new Response(JSON.stringify({ ref: "refs/heads/main", object: { type: "commit", sha: "abc123" } }), { status: 200 }), /did not identify refs\/heads\/main/u],
  ];

  for (const [name, fetchImpl, expected] of cases) {
    await context.test(name, async () => {
      let calls = 0;
      await assert.rejects(
        verifyCurrentMainSha(options({
          attempts: 2,
          fetchImpl: async (...args) => {
            calls += 1;
            return fetchImpl(...args);
          },
        })),
        expected,
      );
      assert.equal(calls, 2);
    });
  }
});

test("the deployment guard bounds an unresponsive ref request", async () => {
  const fetchImpl = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  await assert.rejects(
    verifyCurrentMainSha(options({ attempts: 1, fetchImpl, timeoutMs: 5 })),
    /Could not prove the current main SHA after 1 attempt/u,
  );
});

test("Pages checks current main around build, service deployment, and page deployment boundaries", async () => {
  const [workflow, qualification] = await Promise.all([
    readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8"),
    readFile(new URL("../docs/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md", import.meta.url), "utf8"),
  ]);
  const command = "node scripts/verify-current-main-sha.mjs";
  const firstGuard = workflow.indexOf(command);
  const uploadGuard = workflow.indexOf(command, firstGuard + command.length);
  const deployGuard = workflow.lastIndexOf(command);
  const install = workflow.indexOf("npm ci --ignore-scripts");
  const siteVerification = workflow.indexOf("npm run release:lattice:verify:site");
  const configurePages = workflow.indexOf("actions/configure-pages@");
  const serviceDeployGuard = workflow.indexOf("Require current main before service deployment");
  const installWorkers = workflow.indexOf("npm ci --ignore-scripts --prefix workers");
  const liveServiceVerification = workflow.indexOf("run: node scripts/verify-text-to-lattice-services.mjs\n");
  const postServiceGuard = workflow.indexOf("Require current main after service verification");
  const deploy = workflow.indexOf("name: Deploy", workflow.indexOf("deploy:"));

  assert.ok(firstGuard >= 0 && firstGuard < install, "the build guard must run before dependency installation and build work");
  assert.ok(uploadGuard > siteVerification && uploadGuard < configurePages, "the artifact guard must run after site verification and before upload");
  assert.ok(serviceDeployGuard > configurePages && serviceDeployGuard < installWorkers, "the service guard must run before Worker deployment tooling is installed");
  assert.ok(postServiceGuard > liveServiceVerification && postServiceGuard < deploy, "the post-service guard must run after live verification and before page deployment");
  assert.ok(deployGuard > uploadGuard && deployGuard < deploy, "the deployment guard must be the final verification before deploy-pages");
  for (const name of [
    "Require current main before build",
    "Require current main before artifact upload",
    "Require current main before service deployment",
    "Require current main after service verification",
    "Require current main before deployment",
  ]) assert.match(workflow, new RegExp(`${name}[\\s\\S]*?run: node scripts\\/verify-current-main-sha\\.mjs`, "u"));
  assert.match(workflow, /Require current main before deployment[\s\S]*?run: node scripts\/verify-current-main-sha\.mjs\n\s+- name: Deploy/u);
  assert.equal(workflow.match(/node scripts\/verify-current-main-sha\.mjs/gu)?.length, 5);
  assert.equal(workflow.match(/GITHUB_TOKEN: \$\{\{ github\.token \}\}/gu)?.length, 5);
  assert.match(qualification, /requires its exact commit to equal `GITHUB_SHA` at its publication boundaries/u);
  assert.match(qualification, /a stale workflow commit fail closed/u);
  assert.match(qualification, /A successful future run and deployed commit remain workflow evidence; this source record does not predeclare them/u);
});
