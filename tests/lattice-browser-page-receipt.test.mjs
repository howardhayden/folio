import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildBrowserPageReceipt } from "../scripts/build-text-to-lattice-browser-page-receipt.mjs";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const html = "<main>Text to Lattice fixture</main>";

function fixture(page = "./resume/index.html", extraZipMember = false) {
  const data = execFileSync("python3", ["-I", "-B", "-c", `
import base64, hashlib, io, json, sys, tarfile, zipfile
name, html, extra = sys.argv[1:]
body = html.encode()
tar = io.BytesIO()
with tarfile.open(fileobj=tar, mode="w", format=tarfile.USTAR_FORMAT) as archive:
    item = tarfile.TarInfo(name)
    item.size = len(body)
    archive.addfile(item, io.BytesIO(body))
zip_bytes = io.BytesIO()
with zipfile.ZipFile(zip_bytes, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    archive.writestr("artifact.tar", tar.getvalue())
    if extra == "true":
        archive.writestr("second-file.txt", "unexpected")
print(json.dumps([base64.b64encode(zip_bytes.getvalue()).decode(), hashlib.sha256(tar.getvalue()).hexdigest()]))
`, page, html, String(extraZipMember)], { encoding: "utf8" });
  const [encoded, tarHash] = JSON.parse(data);
  const zip = Buffer.from(encoded, "base64");
  const env = { GITHUB_REPOSITORY: "howardhayden/folio", GITHUB_REF: "refs/heads/main", GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_RUN_ATTEMPT: "1", GITHUB_RUN_ID: "51", GITHUB_SHA: "a".repeat(40), PAGES_ARTIFACT_ID: "52",
    QUALIFIED_SOURCE_SHA256: "b".repeat(64), SITE_ARTIFACT_SHA256: tarHash };
  const artifact = { name: "github-pages", id: 52, expired: false, size_in_bytes: zip.length, digest: `sha256:${sha(zip)}`,
    workflow_run: { id: 51, head_sha: env.GITHUB_SHA, head_branch: "main", repository_id: 841112230, head_repository_id: 841112230 } };
  return { zip, artifact, env };
}

test("the G06 receipt binds the canonical member of the exact uploaded and re-read Pages TAR", () => {
  const { zip, artifact, env } = fixture();
  const receipt = buildBrowserPageReceipt(zip, artifact, env);
  assert.deepEqual(receipt.resumeMember, { path: "resume/index.html", bytes: Buffer.byteLength(html), sha256: sha(html) });
  assert.equal(receipt.pagesArtifactId, env.PAGES_ARTIFACT_ID);
  assert.equal(receipt.siteArtifactSha256, env.SITE_ARTIFACT_SHA256);
  assert.equal(receipt.pagesZipSha256, sha(zip));
  assert.equal(receipt.pagesZipBytes, zip.length);
  assert.equal(receipt.workflow.commit, env.GITHUB_SHA);
  assert.equal(JSON.stringify(receipt).includes(html), false);
});

test("the G06 receipt refuses another run, archive, or missing canonical member", () => {
  const { zip, artifact, env } = fixture();
  assert.throws(() => buildBrowserPageReceipt(zip, { ...artifact, expired: true }, env), /original artifact/u);
  assert.throws(() => buildBrowserPageReceipt(zip, artifact, { ...env, GITHUB_RUN_ID: "53" }), /original artifact/u);
  assert.throws(() => buildBrowserPageReceipt(zip, artifact, { ...env, GITHUB_RUN_ATTEMPT: "2" }), /workflow/u);
  assert.throws(() => buildBrowserPageReceipt(zip, { ...artifact, digest: `sha256:${"c".repeat(64)}` }, env), /ZIP digest/u);
  assert.throws(() => buildBrowserPageReceipt(zip, artifact, { ...env, SITE_ARTIFACT_SHA256: "d".repeat(64) }), /TAR digest/u);
  const missing = fixture("./another/index.html");
  assert.throws(() => buildBrowserPageReceipt(missing.zip, missing.artifact, missing.env), /résumé member/u);
  const extra = fixture("./resume/index.html", true);
  assert.throws(() => buildBrowserPageReceipt(extra.zip, extra.artifact, extra.env), /ZIP member/u);
});
