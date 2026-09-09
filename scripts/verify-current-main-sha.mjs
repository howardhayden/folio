import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const gitShaPattern = /^[a-f0-9]{40}$/u;
const repositoryComponentPattern = /^[A-Za-z0-9_.-]+$/u;

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function validateRepository(value) {
  const components = value.split("/");
  if (components.length !== 2
    || components.some((component) => !repositoryComponentPattern.test(component) || component === "." || component === "..")) {
    throw new Error("GITHUB_REPOSITORY must be owner/repository without dot-path components.");
  }
}

function apiBaseUrl(value) {
  let url;
  try {
    url = new URL(requiredString(value, "GITHUB_API_URL"));
  } catch (error) {
    throw new Error(`GITHUB_API_URL is invalid: ${error.message}`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("GITHUB_API_URL must be an HTTPS origin or HTTPS path without credentials, query, or fragment.");
  }
  return new URL(url.pathname.endsWith("/") ? url.href : `${url.href}/`);
}

function currentMainRefUrl(apiUrl, repository) {
  return new URL(`repos/${repository}/git/ref/heads/main`, apiBaseUrl(apiUrl));
}

async function requestCurrentMainSha({
  apiUrl,
  repository,
  token,
  fetchImpl,
  timeoutMs,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(currentMainRefUrl(apiUrl, repository), {
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Cache-Control": "no-cache",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "hah-dev-current-main-sha-guard",
      },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`GitHub ref request returned HTTP ${response.status}.`);
    }
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error(`GitHub ref response was not valid JSON: ${error.message}`);
    }
    const currentSha = payload?.object?.sha;
    if (payload?.ref !== "refs/heads/main" || payload?.object?.type !== "commit" || !gitShaPattern.test(currentSha ?? "")) {
      throw new Error("GitHub ref response did not identify refs/heads/main at an exact commit SHA.");
    }
    return currentSha;
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyCurrentMainSha({
  repository,
  workflowSha,
  workflowRef,
  token,
  apiUrl = "https://api.github.com",
  fetchImpl = globalThis.fetch,
  attempts = 3,
  timeoutMs = 10_000,
} = {}) {
  const normalizedRepository = requiredString(repository, "GITHUB_REPOSITORY");
  const normalizedWorkflowSha = requiredString(workflowSha, "GITHUB_SHA");
  const normalizedWorkflowRef = requiredString(workflowRef, "GITHUB_REF");
  const normalizedToken = requiredString(token, "GITHUB_TOKEN");
  validateRepository(normalizedRepository);
  if (!gitShaPattern.test(normalizedWorkflowSha)) throw new Error("GITHUB_SHA must be an exact lowercase 40-character commit SHA.");
  if (normalizedWorkflowRef !== "refs/heads/main") throw new Error("This deployment guard permits only refs/heads/main.");
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 3) throw new Error("attempts must be an integer from 1 through 3.");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new Error("timeoutMs must be an integer from 1 through 30000.");

  let currentSha;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      currentSha = await requestCurrentMainSha({
        apiUrl,
        repository: normalizedRepository,
        token: normalizedToken,
        fetchImpl,
        timeoutMs,
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!currentSha) {
    throw new Error(`Could not prove the current main SHA after ${attempts} attempt${attempts === 1 ? "" : "s"}: ${lastError?.message ?? "unknown failure"}`);
  }
  if (currentSha !== normalizedWorkflowSha) {
    throw new Error(`Refusing stale deployment: workflow SHA ${normalizedWorkflowSha} is not current main ${currentSha}.`);
  }
  return currentSha;
}

const isMainModule = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  try {
    const sha = await verifyCurrentMainSha({
      repository: process.env.GITHUB_REPOSITORY,
      workflowSha: process.env.GITHUB_SHA,
      workflowRef: process.env.GITHUB_REF,
      token: process.env.GITHUB_TOKEN,
      apiUrl: process.env.GITHUB_API_URL,
    });
    console.log(`Verified current main workflow SHA ${sha}.`);
  } catch (error) {
    console.error(`Current-main deployment guard failed: ${error.message}`);
    process.exitCode = 1;
  }
}
