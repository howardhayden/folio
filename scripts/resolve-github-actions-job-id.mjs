import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
const POSITIVE_DECIMAL_PATTERN = /^[1-9][0-9]{0,19}$/u;
const SHA_PATTERN = /^[a-f0-9]{40}$/u;

function fail(message) {
  throw new Error(`GitHub Actions job identity failed: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function positiveDecimal(value, label) {
  const normalized = typeof value === "number" && Number.isSafeInteger(value)
    ? String(value)
    : value;
  if (typeof normalized !== "string" || !POSITIVE_DECIMAL_PATTERN.test(normalized)) {
    fail(`${label} must be a positive decimal identifier.`);
  }
  return normalized;
}

function validJobUrl(value, { repository, runId, jobId }) {
  return value === `https://github.com/${repository}/actions/runs/${runId}/job/${jobId}`
    || value === `https://github.com/${repository}/runs/${runId}/jobs/${jobId}`;
}

/** Resolve the actual Actions job ID from one complete run-attempt Jobs API payload. */
export function resolveGithubActionsJobId(payload, {
  repository,
  runId,
  commit,
  jobName,
} = {}) {
  if (!REPOSITORY_PATTERN.test(repository ?? "") || repository.includes("..")) {
    fail("repository is invalid.");
  }
  const expectedRunId = positiveDecimal(runId, "runId");
  if (!SHA_PATTERN.test(commit ?? "") || /^0{40}$/u.test(commit)) fail("commit is invalid.");
  if (typeof jobName !== "string" || jobName.length < 1 || jobName.length > 160
    || /[\r\n\u0000]/u.test(jobName)) {
    fail("jobName is invalid.");
  }
  if (!isRecord(payload) || !Number.isSafeInteger(payload.total_count)
    || payload.total_count < 1 || !Array.isArray(payload.jobs)
    || payload.total_count !== payload.jobs.length || payload.jobs.length > 100) {
    fail("the Jobs API payload must contain one complete, unpaginated job set.");
  }

  const matches = payload.jobs.filter((job) => (
    isRecord(job)
    && job.name === jobName
    && String(job.run_id) === expectedRunId
    && job.head_sha === commit
  ));
  if (matches.length !== 1) {
    fail(`the run attempt must contain exactly one current ${jobName} job.`);
  }
  const [job] = matches;
  const id = positiveDecimal(job.id, "service job id");
  if (job.status !== "in_progress" || job.conclusion !== null) {
    fail("the service job must be the currently executing job.");
  }
  if (!validJobUrl(job.html_url, { repository, runId: expectedRunId, jobId: id })) {
    fail("the service job URL does not match its repository, run, and job identifiers.");
  }
  if (job.check_run_url !== `https://api.github.com/repos/${repository}/check-runs/${id}`) {
    fail("the service job check-run identity does not match its Actions job ID.");
  }
  return id;
}

function exactApiRoot(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail("GITHUB_API_URL is invalid.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password
    || parsed.search || parsed.hash) {
    fail("GITHUB_API_URL must be an HTTPS URL without credentials, query, or fragment.");
  }
  const canonical = parsed.href.replace(/\/$/u, "");
  if (canonical !== "https://api.github.com") {
    fail("GITHUB_API_URL must be the canonical GitHub.com API origin.");
  }
  return canonical;
}

export async function readCurrentGithubActionsJobId({
  environment = process.env,
  jobName,
  fetchImpl = fetch,
} = {}) {
  const repository = environment.GITHUB_REPOSITORY;
  const runId = positiveDecimal(environment.GITHUB_RUN_ID, "GITHUB_RUN_ID");
  const runAttempt = positiveDecimal(environment.GITHUB_RUN_ATTEMPT, "GITHUB_RUN_ATTEMPT");
  const commit = environment.GITHUB_SHA;
  if (!REPOSITORY_PATTERN.test(repository ?? "") || repository.includes("..")) {
    fail("GITHUB_REPOSITORY is invalid.");
  }
  if (!SHA_PATTERN.test(commit ?? "") || /^0{40}$/u.test(commit)) fail("GITHUB_SHA is invalid.");
  const token = environment.GITHUB_TOKEN;
  if (typeof token !== "string" || token.length < 1 || /[\r\n\u0000]/u.test(token)) {
    fail("GITHUB_TOKEN is not configured.");
  }
  const apiUrl = exactApiRoot(environment.GITHUB_API_URL);
  const response = await fetchImpl(
    `${apiUrl}/repos/${repository}/actions/runs/${runId}/attempts/${runAttempt}/jobs?per_page=100`,
    {
      method: "GET",
      redirect: "error",
      credentials: "omit",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "hahdev-text-to-lattice-evidence",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );
  if (!response.ok) fail(`the Jobs API returned HTTP ${response.status}.`);
  const source = await response.text();
  if (Buffer.byteLength(source) > 524_288) fail("the Jobs API response exceeds 524288 bytes.");
  let payload;
  try {
    payload = JSON.parse(source);
  } catch {
    fail("the Jobs API response is not JSON.");
  }
  return resolveGithubActionsJobId(payload, { repository, runId, commit, jobName });
}

function cliArguments(argumentsList) {
  const values = {};
  const optionMap = new Map([
    ["--job-name", "jobName"],
    ["--github-output", "githubOutputPath"],
  ]);
  for (let index = 0; index < argumentsList.length; index += 1) {
    const option = argumentsList[index];
    const key = optionMap.get(option);
    if (!key) fail(`unknown option ${option}.`);
    const value = argumentsList[index + 1];
    if (!value || value.startsWith("--")) fail(`${option} requires a value.`);
    if (Object.hasOwn(values, key)) fail(`${option} may be passed only once.`);
    values[key] = value;
    index += 1;
  }
  for (const key of optionMap.values()) {
    if (!values[key]) fail(`${key} is required.`);
  }
  return values;
}

const isCommand = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isCommand) {
  const { jobName, githubOutputPath } = cliArguments(process.argv.slice(2));
  const serviceJobId = await readCurrentGithubActionsJobId({ jobName });
  await appendFile(resolve(githubOutputPath), `service_job_id=${serviceJobId}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  process.stdout.write(`Resolved Text to Lattice service job ${serviceJobId}.\n`);
}
