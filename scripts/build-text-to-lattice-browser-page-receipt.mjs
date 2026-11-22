import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const zipLimit = 12 * 1024 * 1024;
const archiveLimit = 64 * 1024 * 1024;
const pageLimit = 2 * 1024 * 1024;
const memberPath = "resume/index.html";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function need(condition, subject) {
  if (!condition) throw new Error(`Invalid qualification Pages ${subject}`);
}

// This is the strict TAR reader used to bind the canonical page during G06.
function archive(bytes) {
    need(bytes.length % 512 === 0 && bytes.length >= 1024, 'archive');
    const entries = new Map();
    let p = 0, ended = false;
    const text = b => {
        const zero = b.indexOf(0), s = b.subarray(0, zero < 0 ? b.length : zero).toString('ascii');
        need(!b.some(x => x > 127) && /^[\x20-\x7e]*$/.test(s), 'archive');
        if (zero >= 0)
            need(b.subarray(zero).every(x => x === 0), 'archive');
        return s;
    };
    while (p + 512 <= bytes.length) {
        const h = bytes.subarray(p, p + 512);
        if (h.every(x => x === 0)) {
            need(bytes.subarray(p).every(x => x === 0) && bytes.length - p >= 1024, 'archive');
            ended = true;
            break;
        }
        const oct = (start, len) => { const s = h.subarray(start, start + len).toString('ascii').replace(/[\0 ]+$/, '').trim(); need(/^[0-7]+$/.test(s), 'archive'); const n = parseInt(s, 8); need(Number.isSafeInteger(n), 'archive'); return n; };
        let sum = 0;
        for (let i = 0; i < 512; i++)
            sum += i >= 148 && i < 156 ? 32 : h[i];
        const magic = h.subarray(257, 265).toString('hex'), gnu = magic === '7573746172202000';
        need(sum === oct(148, 8) && (gnu || magic === '7573746172003030'), 'archive');
        // GNU uses this region for incremental/sparse extensions, not a path prefix.
        if (gnu)
            need(h.subarray(345, 512).every(x => x === 0), 'archive');
        else
            need(h.subarray(500, 512).every(x => x === 0), 'archive');
        let name = text(h.subarray(0, 100)), prefix = gnu ? '' : text(h.subarray(345, 500));
        if (prefix)
            name = prefix + '/' + name;
        const type = h[156], size = oct(124, 12);
        need([0, 48, 53].includes(type) && text(h.subarray(157, 257)) === '', 'archive');
        if (name === './' || name === '.') {
            need(p === 0 && type === 53 && size === 0 && entries.size === 0, 'archive');
            p += 512;
            continue;
        }
        if (name.startsWith('./'))
            name = name.slice(2);
        if (type === 53) {
            need(size === 0 && name.endsWith('/'), 'archive');
            name = name.slice(0, -1);
        }
        need(name.length > 0 && name.length < 512 && /^[A-Za-z0-9_.\/-]+$/.test(name) && name.split('/').every(x => x && x !== '.' && x !== '..') && !entries.has(name), 'archive');
        const end = p + 512 + size;
        need(end <= bytes.length, 'archive');
        const body = bytes.subarray(p + 512, end);
        entries.set(name, { directory: type === 53, bytes: body, sha256: sha(body) });
        const next = p + 512 + Math.ceil(size / 512) * 512;
        need(bytes.subarray(end, next).every(x => x === 0), 'archive');
        p = next;
    }
    need(ended, 'archive');
    return entries;
}

function validateWorkflow(env) {
  need(env.GITHUB_REPOSITORY === "howardhayden/folio" && env.GITHUB_REF === "refs/heads/main"
    && env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.GITHUB_RUN_ATTEMPT === "1", "workflow");
  need(/^[1-9][0-9]{0,19}$/u.test(env.GITHUB_RUN_ID) && /^[1-9][0-9]{0,19}$/u.test(env.PAGES_ARTIFACT_ID), "identity");
  need(/^[a-f0-9]{40}$/u.test(env.GITHUB_SHA) && /^[a-f0-9]{64}$/u.test(env.QUALIFIED_SOURCE_SHA256), "source");
  need(/^[a-f0-9]{64}$/u.test(env.SITE_ARTIFACT_SHA256), "expected TAR digest");
}

function validateArtifact(artifact, env) {
  const run = artifact?.workflow_run;
  need(artifact?.name === "github-pages" && String(artifact.id) === env.PAGES_ARTIFACT_ID
    && artifact.expired === false && String(run?.id) === env.GITHUB_RUN_ID
    && run.head_sha === env.GITHUB_SHA && run.head_branch === "main"
    && run.repository_id === 841112230 && run.head_repository_id === run.repository_id, "original artifact");
  need(Number.isSafeInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0 && artifact.size_in_bytes <= zipLimit
    && /^sha256:[a-f0-9]{64}$/u.test(artifact.digest), "ZIP metadata");
}

export function buildBrowserPageReceipt(zip, artifact, env) {
  validateWorkflow(env);
  validateArtifact(artifact, env);
  need(Buffer.isBuffer(zip) && zip.length > 0 && zip.length <= zipLimit
    && zip.length === artifact.size_in_bytes && `sha256:${sha(zip)}` === artifact.digest, "ZIP digest");
  const extractor = fileURLToPath(new URL("./read-text-to-lattice-pages-zip.py", import.meta.url));
  let bytes;
  try {
    bytes = execFileSync("python3", ["-I", "-B", extractor], {
      input: zip, maxBuffer: archiveLimit, timeout: 15_000, stdio: ["pipe", "pipe", "ignore"],
      env: { PATH: process.env.PATH },
    });
  } catch {
    throw new Error("Invalid qualification Pages ZIP member");
  }
  const digest = sha(bytes);
  need(digest === env.SITE_ARTIFACT_SHA256, "TAR digest");
  const member = archive(bytes).get(memberPath);
  need(member && !member.directory && member.bytes.length > 0 && member.bytes.length <= pageLimit, "résumé member");
  return {
    format: "TEXT_TO_LATTICE_G06_BROWSER_PAGE_RECEIPT", schemaVersion: 1,
    workflow: { repository: env.GITHUB_REPOSITORY, ref: env.GITHUB_REF, runId: env.GITHUB_RUN_ID,
      runAttempt: env.GITHUB_RUN_ATTEMPT, commit: env.GITHUB_SHA },
    pagesArtifactId: env.PAGES_ARTIFACT_ID, qualifiedSourceSetSha256: env.QUALIFIED_SOURCE_SHA256,
    pagesZipSha256: artifact.digest.slice("sha256:".length), pagesZipBytes: zip.length,
    siteArtifactSha256: digest, siteArtifactBytes: bytes.length,
    resumeMember: { path: memberPath, bytes: member.bytes.length, sha256: member.sha256 },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const dir = process.env.RUNNER_TEMP;
  need(typeof dir === "string" && resolve(dir) === dir && process.argv.length === 2, "runner directory");
  validateWorkflow(process.env);
  const endpoint = `repos/howardhayden/folio/actions/artifacts/${process.env.PAGES_ARTIFACT_ID}`;
  function github(path, maximumBytes) {
    try {
      return execFileSync("gh", ["api", path], {
        maxBuffer: maximumBytes, timeout: 60_000, stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      throw new Error("The original G06 Pages artifact could not be read");
    }
  }
  const artifact = JSON.parse(github(endpoint, 200_000).toString("utf8"));
  validateArtifact(artifact, process.env);
  const receipt = buildBrowserPageReceipt(github(`${endpoint}/zip`, artifact.size_in_bytes), artifact, process.env);
  await writeFile(join(dir, "g06-browser-page.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx", mode: 0o600 });
}
