import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

import Ajv2020 from "ajv/dist/2020.js";
import {
  DEPLOYMENT_EVIDENCE_AFTER_BASENAME,
  DEPLOYMENT_EVIDENCE_BEFORE_BASENAME,
  browserEvidenceSha256,
  parseBrowserEvidenceText,
  verifyBrowserEvidence,
  verifyBrowserEvidenceBundle,
  verifySanitizedPngBytes,
} from "../scripts/verify-text-to-lattice-browser-evidence.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = resolve(root, "docs/text-to-lattice/TEXT-TO-LATTICE-BROWSER-EVIDENCE.template.json");
const schemaPath = resolve(root, "docs/text-to-lattice/TEXT-TO-LATTICE-BROWSER-EVIDENCE.schema.json");
const scannedResourceTypes = [
  "document",
  "fetch",
  "xmlhttprequest",
  "beacon",
  "websocket",
  "eventsource",
  "image",
  "frame",
  "form",
  "navigation",
  "prefetch",
  "script",
  "style",
  "font",
  "media",
  "manifest",
  "other",
];
const providerHostPatterns = [
  "huggingface.co",
  "*.huggingface.co",
  "huggingface.co.",
  "*.huggingface.co.",
  "hf.co",
  "*.hf.co",
  "hf.co.",
  "*.hf.co.",
  "featherless.ai",
  "*.featherless.ai",
  "featherless.ai.",
  "*.featherless.ai.",
  "nscale.com",
  "*.nscale.com",
  "nscale.com.",
  "*.nscale.com.",
  "deepinfra.com",
  "*.deepinfra.com",
  "deepinfra.com.",
  "*.deepinfra.com.",
];
const markerEncodings = ["literal", "json-escaped", "percent-encoded", "base64", "base64url", "sha256"];

function digest(label) {
  return createHash("sha256").update(label).digest("hex");
}

function engineEvidence({
  engineId,
  browserName,
  browserVersion,
  engineName,
  engineVersion,
  hour,
  minute = 0,
}) {
  const instant = (seconds) => (
    `2026-09-14T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.000Z`
  );
  const engineDigest = (field) => digest(`${engineId}:${field}`);
  return {
    engine_id: engineId,
    browser_name: browserName,
    browser_version: browserVersion,
    engine_name: engineName,
    engine_version: engineVersion,
    operating_system_name: "macOS",
    operating_system_version: "26.5.1",
    operating_system_build: "25F80",
    capture_started_at: instant(0),
    text_entry_started_at: instant(1),
    confirmation_at: instant(2),
    visitor_session_requested_at: instant(3),
    visitor_session_established_at: instant(4),
    submitted_at: instant(5),
    response_received_at: instant(7),
    terminal_at: instant(8),
    result_visible_at: instant(8),
    result_focused_at: instant(8),
    observation_ended_at: instant(18),
    hard_reload_at: instant(18),
    post_reload_checked_at: instant(19),
    capture_ended_at: instant(20),
    canonical_url: "https://hah.dev/resume/#text-to-lattice",
    isolated_session: true,
    browser_cache_disabled: false,
    network_capture_started_before_text_entry: true,
    explicit_confirmation: {
      disclosure_prefix: "This text leaves hah.dev",
      authorization_checked: true,
      submit_button_label: "Process with external service",
      submit_activation_count: 1,
      source_marker_requests_before_submit: 0,
    },
    visitor_session_request: {
      request_count: 1,
      url: "https://hah.dev/api/lattice",
      origin_header: "https://hah.dev",
      method: "POST",
      application_set_header_names: ["accept"],
      content_type_header_present: false,
      accept: "application/vnd.hah.text-to-lattice-visitor-session.v1+json",
      request_body_present: false,
      request_body_utf8_bytes: 0,
      credentials_mode: "same-origin",
      cookie_header_present: false,
      authorization_header_present: false,
      provider_credential_present: false,
      referer_header_present: false,
      query_present: false,
      redirect_count: 0,
      transfer_source: "network",
    },
    visitor_session_response: {
      status: 204,
      content_type_header_present: false,
      cache_control: "no-store",
      response_body_present: false,
      response_body_utf8_bytes: 0,
      set_cookie_header_present: true,
      set_cookie_header_count: 1,
      set_cookie_name: "__Secure-hah-lattice-api-visitor",
      set_cookie_attribute_names: ["max-age", "path", "secure", "httponly", "samesite"],
      set_cookie_max_age_seconds: Math.ceil(
        (Date.parse("2026-09-15T00:00:00.000Z") - Date.parse(instant(4))) / 1_000,
      ),
      set_cookie_path: "/api/lattice",
      set_cookie_secure: true,
      set_cookie_http_only: true,
      set_cookie_same_site: "Strict",
      set_cookie_domain_present: false,
      access_control_allow_origin_header_present: false,
    },
    request: {
      request_count: 1,
      url: "https://hah.dev/api/lattice",
      origin_header: "https://hah.dev",
      method: "POST",
      application_set_header_names: ["accept", "content-type"],
      content_type: "application/json",
      accept: "application/json",
      request_body_key_order: ["text", "requested_mode", "schema_version"],
      request_body_member_count: 3,
      request_body_duplicate_member_count: 0,
      request_body_exact_contract: true,
      text_value_type: "string",
      requested_mode: "auto",
      schema_version: 1,
      request_body_utf8_bytes: 256,
      request_body_sha256: engineDigest("request"),
      credentials_mode: "same-origin",
      cookie_header_present: true,
      authorization_header_present: false,
      provider_credential_present: false,
      referer_header_present: false,
      query_present: false,
      redirect_count: 0,
      transfer_source: "network",
    },
    response: {
      status: 200,
      content_type: "application/json; charset=utf-8",
      cache_control: "no-store",
      response_body_key_order: ["result", "schema_version"],
      response_body_member_count: 2,
      response_body_duplicate_member_count: 0,
      response_body_exact_contract: true,
      schema_version: 1,
      result_version: "text-to-lattice.v7",
      strict_result_contract_valid: true,
      result_status: "translated",
      set_cookie_header_present: false,
      set_cookie_header_count: 0,
      access_control_allow_origin_header_present: false,
      response_body_utf8_bytes: 2_048,
      response_body_sha256: engineDigest("response"),
    },
    terminal: {
      announcement_prefix: "Result ready.",
      result_visible: true,
      result_region_focused: true,
      hard_reload_performed: true,
      bfcache_restore: false,
      source_persisted_after_reload: false,
      result_persisted_after_reload: false,
    },
    privacy: {
      observed_request_count: 14,
      visitor_session_request_count: 1,
      content_bearing_request_count: 1,
      unexpected_content_bearing_request_count: 0,
      provider_origin_request_count: 0,
      non_hah_transferred_request_count: 0,
      account_authorization_or_provider_credential_request_count: 0,
      browser_quota_cookie_request_count: 1,
      automatic_retry_count: 0,
      browser_fallback_request_count: 0,
      alternate_content_route_count: 0,
      service_worker_registration_count: 0,
      service_worker_interception_count: 0,
      cache_storage_entry_count: 0,
      api_cache_replay_count: 0,
      rum_request_count: 0,
      blocked_cloudflare_beacon_count: 0,
      cloudflare_beacon_transferred_bytes: 0,
      source_marker_request_body_matches: 1,
      source_marker_response_body_matches: 0,
      source_marker_prohibited_matches: 0,
      output_marker_response_body_matches: 1,
      output_marker_prohibited_matches: 0,
      persistent_storage_marker_matches: 0,
      url_marker_matches: 0,
      header_marker_matches: 0,
      error_marker_matches: 0,
      console_marker_matches: 0,
      analytics_marker_matches: 0,
      unrelated_request_marker_matches: 0,
      provider_origins_observed: [],
      content_bearing_urls: ["https://hah.dev/api/lattice"],
      scan_profile: "ttl-browser-egress-scan-v1",
      scanned_resource_types: [...scannedResourceTypes],
      provider_host_patterns_scanned: [...providerHostPatterns],
      provider_host_match_case_insensitive: true,
      marker_encodings_scanned: [...markerEncodings],
      csp_connect_src: ["'self'"],
      provider_connect_allowed: false,
      network_payload_inspection_supported: true,
      persistent_storage_inspection_supported: true,
      service_worker_registry_checked: true,
      cache_storage_checked: true,
      persistent_storage_checked_after_reload: true,
      server_side_provider_retry_proven: false,
      server_side_provider_retention_proven: false,
      post_terminal_observation_ms: 10_000,
    },
    content_fingerprints: {
      source_utf8_bytes: 120,
      sample_classification: "public-synthetic-nonsensitive",
      source_sha256: engineDigest("source"),
      source_marker_utf8_bytes: 32,
      source_marker_sha256: engineDigest("source-marker"),
      output_utf8_bytes: 1_000,
      output_sha256: engineDigest("output"),
      output_marker_utf8_bytes: 40,
      output_marker_sha256: engineDigest("output-marker"),
    },
    sanitized_capture: {
      format: "flattened-redacted-raster-png-v1",
      basename: `TEXT-TO-LATTICE-BROWSER-EVIDENCE.${engineId}.png`,
      media_type: "image/png",
      byte_count: 4_096,
      pixel_width: 640,
      pixel_height: 480,
      sha256: engineDigest("capture"),
      flattened_raster_png: true,
      png_ancillary_chunks_stripped: true,
      pixel_redaction_manually_reviewed: true,
      contains_raw_har: false,
      contains_raw_request_body: false,
      contains_raw_response_body: false,
      contains_raw_source: false,
      contains_raw_output: false,
      contains_cookie_values: false,
      contains_authorization_values: false,
      contains_provider_credentials: false,
      contains_sensitive_header_values: false,
    },
  };
}

function validEvidence() {
  return {
    format: "TEXT_TO_LATTICE_BROWSER_EVIDENCE",
    schema_version: 1,
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
      deployment_evidence_index_sha256: digest("deployment-evidence-index"),
      deployment_evidence_before_captures_sha256: digest("deployment-evidence-index"),
      deployment_evidence_after_captures_sha256: digest("deployment-evidence-index"),
      site_artifact_sha256: digest("site-artifact"),
      qualified_source_set_sha256: digest("qualified-source-set"),
      deployed_at: "2026-09-14T10:00:00.000Z",
      qualification_expires_at: "2026-09-14T11:15:00.000Z",
      deployment_evidence_checked_before_captures_at: "2026-09-14T10:59:00.000Z",
      deployment_evidence_checked_after_captures_at: "2026-09-14T11:11:00.000Z",
      deployment_evidence_unchanged_across_captures: true,
    },
    redaction: {
      profile: "metadata-digests-only-v1",
      raw_har_retained: false,
      raw_request_body_retained: false,
      raw_response_body_retained: false,
      raw_source_retained: false,
      raw_output_retained: false,
      cookie_values_retained: false,
      authorization_values_retained: false,
      provider_credentials_retained: false,
      sensitive_header_values_retained: false,
    },
    engines: [
      engineEvidence({
        engineId: "safari-webkit",
        browserName: "Safari",
        browserVersion: "26.5",
        engineName: "WebKit",
        engineVersion: "21624.2.5.11.4",
        hour: 11,
      }),
      engineEvidence({
        engineId: "brave-chromium",
        browserName: "Brave",
        browserVersion: "1.94.121",
        engineName: "Chromium",
        engineVersion: "152.0.7977.83",
        hour: 11,
        minute: 10,
      }),
    ],
  };
}

function deploymentIndexFor(evidence) {
  const { deployment } = evidence;
  return {
    format: "TEXT_TO_LATTICE_DEPLOYMENT_EVIDENCE_INDEX",
    schemaVersion: 1,
    generatedAt: deployment.deployed_at,
    deployedAt: deployment.deployed_at,
    deployedAtBasis: "post-live-verification-service-evidence-index-generation",
    canonicalUrl: deployment.canonical_url,
    qualificationExpiresAt: deployment.qualification_expires_at,
    workflow: {
      repository: "howardhayden/folio",
      commit: deployment.deployed_commit,
      ref: "refs/heads/main",
      runId: deployment.workflow_run_id,
      runAttempt: deployment.workflow_run_attempt,
      runUrl: deployment.workflow_run_url,
    },
    serviceJobId: deployment.service_job_id,
    pagesArtifactId: "987654321",
    siteArtifactSha256: deployment.site_artifact_sha256,
    qualifiedSourceSetSha256: deployment.qualified_source_set_sha256,
    workers: {
      api: {
        worker: "hahdev-text-to-lattice-api",
        deploymentId: deployment.api_worker_deployment_id,
        versionId: deployment.api_worker_version,
        percentage: 100,
        createdAt: "2026-09-14T09:58:00.000Z",
        activeVersionBindings: [
          { name: "HF_TOKEN", type: "secret_text" },
          { name: "VISITOR_COOKIE_SECRET", type: "secret_text" },
          {
            name: "LATTICE_API_RATE_LIMITER",
            type: "ratelimit",
            namespaceId: "857321",
            simple: { limit: 30, period: 60 },
          },
          {
            name: "LATTICE_TRANSFORMATION_BUDGET",
            type: "durable_object_namespace",
            className: "LatticeTransformationBudget",
          },
          {
            name: "LATTICE_QUALIFICATION_EXPIRES_AT",
            type: "plain_text",
            expiresAt: deployment.qualification_expires_at,
          },
        ],
        bindingSetExact: true,
      },
      responsePolicy: {
        worker: "hahdev-text-to-lattice-response-policy",
        deploymentId: deployment.response_policy_worker_deployment_id,
        versionId: deployment.response_policy_worker_version,
        percentage: 100,
        createdAt: "2026-09-14T09:59:00.000Z",
      },
    },
    evidenceFiles: {
      secretBindings: { basename: "secret-bindings.json", sha256: digest("secret-bindings") },
      routeInventory: { basename: "route-inventory.json", sha256: digest("route-inventory") },
      liveBoundary: { basename: "live-boundary.json", sha256: digest("live-boundary") },
    },
    rawWranglerStatusRetained: false,
    rawWranglerVersionRetained: false,
    contentBodiesRetained: false,
    secretValuesRead: false,
  };
}

async function writeDeploymentIndexCopies(directory, evidence, {
  before = deploymentIndexFor(evidence),
  after = before,
  bindDigest = true,
} = {}) {
  const beforeBytes = Buffer.from(`${JSON.stringify(before, null, 2)}\n`);
  const afterBytes = Buffer.from(`${JSON.stringify(after, null, 2)}\n`);
  if (bindDigest) {
    const indexSha256 = browserEvidenceSha256(beforeBytes);
    evidence.deployment.deployment_evidence_index_sha256 = indexSha256;
    evidence.deployment.deployment_evidence_before_captures_sha256 = indexSha256;
    evidence.deployment.deployment_evidence_after_captures_sha256 = indexSha256;
  }
  await Promise.all([
    writeFile(join(directory, DEPLOYMENT_EVIDENCE_BEFORE_BASENAME), beforeBytes),
    writeFile(join(directory, DEPLOYMENT_EVIDENCE_AFTER_BASENAME), afterBytes),
  ]);
  return { before, after, beforeBytes, afterBytes };
}

function invalidAfter(mutate, expression = /browser evidence is invalid/u) {
  const evidence = validEvidence();
  mutate(evidence);
  assert.throws(() => verifyBrowserEvidence(evidence), expression);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const payload = Buffer.from(data);
  const result = Buffer.alloc(payload.byteLength + 12);
  result.writeUInt32BE(payload.byteLength, 0);
  typeBytes.copy(result, 4);
  payload.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, 8 + payload.byteLength)), 8 + payload.byteLength);
  return result;
}

function capturePng(red, { width = 640, height = 480 } = {}) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rowByteCount = 1 + width * 4;
  const pixels = Buffer.alloc(rowByteCount * height);
  for (let row = 0; row < height; row += 1) {
    const start = row * rowByteCount;
    for (let column = 0; column < width; column += 1) {
      const pixel = start + 1 + column * 4;
      pixels[pixel] = red;
      pixels[pixel + 1] = 32;
      pixels[pixel + 2] = 64;
      pixels[pixel + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

test("the contract accepts exactly Safari/WebKit followed by Brave/Chromium", () => {
  const evidence = validEvidence();
  assert.deepEqual(verifyBrowserEvidence(evidence), {
    deployedCommit: evidence.deployment.deployed_commit,
    workflowRunId: evidence.deployment.workflow_run_id,
    qualifiedSourceSetSha256: evidence.deployment.qualified_source_set_sha256,
    engineIds: ["safari-webkit", "brave-chromium"],
  });

  invalidAfter((candidate) => candidate.engines.pop(), /exactly Safari\/WebKit followed by Brave\/Chromium/u);
  invalidAfter((candidate) => candidate.engines.reverse(), /engines\[0\]\.engine_id/u);
  invalidAfter((candidate) => { candidate.engines[0].browser_name = "Firefox"; }, /browser_name/u);
  invalidAfter((candidate) => { candidate.engines[1].engine_name = "WebKit"; }, /engine_name/u);
  invalidAfter((candidate) => candidate.engines.push(structuredClone(candidate.engines[1])), /exactly Safari/u);
});

test("top-level custody is exact, canonical, timestamp-bound, and closed", () => {
  invalidAfter((candidate) => { candidate.format = "OTHER"; }, /\.format/u);
  invalidAfter((candidate) => { candidate.schema_version = 2; }, /schema_version/u);
  invalidAfter((candidate) => { candidate.evidence_id = "ttl-browser-20260914T125959Z-deadbeef"; }, /same UTC second/u);
  invalidAfter((candidate) => { candidate.recorded_at = "2026-09-14T13:00:00Z"; }, /canonical millisecond UTC/u);
  invalidAfter((candidate) => { candidate.extra = "smuggled"; }, /must contain only these fields/u);
  invalidAfter((candidate) => {
    const format = candidate.format;
    delete candidate.format;
    candidate.format = format;
  }, /fields in order/u);
});

test("deployment evidence binds the commit, source set, services, site artifact, and bounded stable snapshot", () => {
  const mutations = [
    ["deployed_commit", "0".repeat(40), /all-zero placeholder commit/u],
    ["deployed_commit", "A".repeat(40), /lowercase 40-character Git commit/u],
    ["workflow_run_id", "0", /positive decimal workflow-run/u],
    ["workflow_run_attempt", "0", /positive decimal workflow-run attempt/u],
    ["workflow_run_url", "https://github.com/other/repo/actions/runs/34399999999", /workflow_run_url/u],
    ["service_job_id", "job-1", /service-job identifier/u],
    ["canonical_url", "https://hah.dev/resume/", /canonical_url/u],
    ["api_worker_deployment_id", "00000000-0000-0000-0000-000000000000", /all-zero placeholder UUID/u],
    ["api_worker_version", "not-a-uuid", /lowercase UUID/u],
    ["response_policy_worker_deployment_id", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", /distinct Worker deployment/u],
    ["response_policy_worker_version", "11111111-1111-4111-8111-111111111111", /distinct Worker version/u],
    ["deployment_evidence_index_sha256", "0".repeat(64), /all-zero placeholder digest/u],
    ["deployment_evidence_before_captures_sha256", digest("other"), /same deployment-evidence snapshot/u],
    ["deployment_evidence_after_captures_sha256", digest("other"), /same deployment-evidence snapshot/u],
    ["site_artifact_sha256", "0".repeat(64), /all-zero placeholder digest/u],
    ["qualified_source_set_sha256", "0".repeat(64), /all-zero placeholder digest/u],
    ["deployed_at", "2026-09-14T10:00:00Z", /canonical millisecond UTC/u],
    ["qualification_expires_at", "2026-09-14T10:00:00.000Z", /must follow deployment/u],
    ["deployment_evidence_checked_before_captures_at", "2026-09-14T09:59:59.000Z", /must not precede deployment/u],
    ["deployment_evidence_checked_after_captures_at", "2026-09-14T10:59:00.000Z", /must be later/u],
    ["deployment_evidence_unchanged_across_captures", false, /deployment_evidence_unchanged_across_captures/u],
  ];
  for (const [field, value, expression] of mutations) {
    invalidAfter((candidate) => { candidate.deployment[field] = value; }, expression);
  }
  invalidAfter((candidate) => {
    candidate.deployment.deployment_evidence_checked_after_captures_at = "2026-09-14T11:29:00.001Z";
  }, /within 30 minutes/u);
  invalidAfter((candidate) => {
    candidate.deployment.qualification_expires_at = "2026-09-14T11:10:59.999Z";
  }, /must not follow qualification expiry/u);
});

test("each engine lifecycle is ordered inside stable deployment custody", () => {
  const scalarMutations = [
    ["browser_version", "Version 26.5"],
    ["engine_version", "latest"],
    ["operating_system_name", "iOS"],
    ["operating_system_version", "26 beta"],
    ["operating_system_build", "unknown"],
    ["canonical_url", "https://hah.dev/"],
    ["isolated_session", false],
    ["browser_cache_disabled", true],
    ["network_capture_started_before_text_entry", false],
  ];
  for (const [field, value] of scalarMutations) {
    invalidAfter((candidate) => { candidate.engines[0][field] = value; }, new RegExp(field, "u"));
  }

  invalidAfter((candidate) => {
    candidate.engines[0].capture_started_at = "2026-09-14T10:58:59.000Z";
  }, /pre-capture deployment-evidence check/u);
  invalidAfter((candidate) => {
    candidate.engines[1].capture_ended_at = "2026-09-14T11:11:00.001Z";
  }, /post-capture deployment-evidence check/u);
  invalidAfter((candidate) => {
    candidate.engines[0].confirmation_at = candidate.engines[0].text_entry_started_at;
  }, /confirmation_at.*lifecycle order/u);
  invalidAfter((candidate) => {
    Object.assign(candidate.engines[0], {
      response_received_at: "2026-09-14T11:04:06.000Z",
      terminal_at: "2026-09-14T11:04:07.000Z",
      result_visible_at: "2026-09-14T11:04:07.000Z",
      result_focused_at: "2026-09-14T11:04:07.000Z",
      observation_ended_at: "2026-09-14T11:04:17.000Z",
      hard_reload_at: "2026-09-14T11:04:17.000Z",
      post_reload_checked_at: "2026-09-14T11:04:18.000Z",
      capture_ended_at: "2026-09-14T11:04:19.000Z",
    });
  }, /240-second client lifecycle bound/u);
  invalidAfter((candidate) => {
    candidate.engines[0].result_focused_at = "2026-09-14T11:00:09.000Z";
  }, /within one second/u);
  invalidAfter((candidate) => {
    candidate.engines[0].privacy.post_terminal_observation_ms = 10_001;
  }, /measured terminal-to-observation-end duration/u);
  invalidAfter((candidate) => {
    candidate.recorded_at = "2026-09-14T11:10:59.999Z";
    candidate.evidence_id = "ttl-browser-20260914T111059Z-deadbeef";
  }, /post-capture deployment-evidence check/u);
});

test("explicit confirmation rejects ambient transmission and extra activation", () => {
  const mutations = [
    ["disclosure_prefix", "Local only"],
    ["authorization_checked", false],
    ["submit_button_label", "Submit"],
    ["submit_activation_count", 2],
    ["source_marker_requests_before_submit", 1],
  ];
  for (const [field, value] of mutations) {
    invalidAfter((candidate) => { candidate.engines[0].explicit_confirmation[field] = value; }, new RegExp(field, "u"));
  }
});

test("the content-free visitor-session POST fixes route, headers, empty body, and cookie attributes", () => {
  const requestMutations = [
    ["request_count", 2],
    ["url", "https://hah.dev/api/lattice?setup=1"],
    ["origin_header", "https://example.com"],
    ["method", "GET"],
    ["application_set_header_names", ["accept", "content-type"]],
    ["content_type_header_present", true],
    ["accept", "application/json"],
    ["request_body_present", true],
    ["request_body_utf8_bytes", 1],
    ["credentials_mode", "omit"],
    ["cookie_header_present", true],
    ["authorization_header_present", true],
    ["provider_credential_present", true],
    ["referer_header_present", true],
    ["query_present", true],
    ["redirect_count", 1],
    ["transfer_source", "memory-cache"],
  ];
  for (const [field, value] of requestMutations) {
    invalidAfter((candidate) => {
      candidate.engines[0].visitor_session_request[field] = value;
    }, new RegExp(field, "u"));
  }

  const responseMutations = [
    ["status", 200],
    ["content_type_header_present", true],
    ["cache_control", "public, max-age=60"],
    ["response_body_present", true],
    ["response_body_utf8_bytes", 1],
    ["set_cookie_header_present", false],
    ["set_cookie_header_count", 2],
    ["set_cookie_name", "session"],
    ["set_cookie_attribute_names", ["path", "secure"]],
    ["set_cookie_max_age_seconds", 0],
    ["set_cookie_max_age_seconds", 86_400],
    ["set_cookie_max_age_seconds", 86_401],
    ["set_cookie_path", "/"],
    ["set_cookie_secure", false],
    ["set_cookie_http_only", false],
    ["set_cookie_same_site", "Lax"],
    ["set_cookie_domain_present", true],
    ["access_control_allow_origin_header_present", true],
  ];
  for (const [field, value] of responseMutations) {
    invalidAfter((candidate) => {
      candidate.engines[1].visitor_session_response[field] = value;
    }, new RegExp(field, "u"));
  }
});

test("the one content POST assertion fixes route, origin, cookie, exact body, and network delivery", () => {
  const mutations = [
    ["request_count", 2],
    ["url", "https://hah.dev/api/lattice?sample=1"],
    ["origin_header", "https://example.com"],
    ["method", "GET"],
    ["application_set_header_names", ["accept", "authorization", "content-type"]],
    ["content_type", "text/plain"],
    ["accept", "*/*"],
    ["request_body_key_order", ["text", "schema_version"]],
    ["request_body_member_count", 4],
    ["request_body_duplicate_member_count", 1],
    ["request_body_exact_contract", false],
    ["text_value_type", "array"],
    ["requested_mode", "experiential"],
    ["schema_version", 2],
    ["request_body_utf8_bytes", 0],
    ["request_body_utf8_bytes", 65_537],
    ["request_body_sha256", "0".repeat(64)],
    ["credentials_mode", "omit"],
    ["cookie_header_present", false],
    ["authorization_header_present", true],
    ["provider_credential_present", true],
    ["referer_header_present", true],
    ["query_present", true],
    ["redirect_count", 1],
    ["transfer_source", "memory-cache"],
  ];
  for (const [field, value] of mutations) {
    invalidAfter((candidate) => { candidate.engines[0].request[field] = value; }, new RegExp(field, "u"));
  }
});

test("only an exact no-store 200 result envelope and allowed terminal status qualifies", () => {
  const mutations = [
    ["status", 502],
    ["content_type", "text/html"],
    ["cache_control", "public, max-age=60"],
    ["response_body_key_order", ["schema_version", "result"]],
    ["response_body_member_count", 3],
    ["response_body_duplicate_member_count", 1],
    ["response_body_exact_contract", false],
    ["schema_version", 2],
    ["result_version", "text-to-lattice.v8"],
    ["strict_result_contract_valid", false],
    ["result_status", "unable-to-attempt"],
    ["set_cookie_header_present", true],
    ["set_cookie_header_count", 1],
    ["access_control_allow_origin_header_present", true],
    ["response_body_utf8_bytes", 0],
    ["response_body_utf8_bytes", 262_145],
    ["response_body_sha256", "0".repeat(64)],
  ];
  for (const [field, value] of mutations) {
    invalidAfter((candidate) => { candidate.engines[1].response[field] = value; }, new RegExp(field, "u"));
  }
  for (const resultStatus of ["translated", "conformant-for-context", "review-required"]) {
    const candidate = validEvidence();
    candidate.engines[0].response.result_status = resultStatus;
    assert.doesNotThrow(() => verifyBrowserEvidence(candidate));
  }
});

test("terminal evidence requires visible focus, a hard reload, and no persistence", () => {
  const mutations = [
    ["announcement_prefix", "Finished"],
    ["result_visible", false],
    ["result_region_focused", false],
    ["hard_reload_performed", false],
    ["bfcache_restore", true],
    ["source_persisted_after_reload", true],
    ["result_persisted_after_reload", true],
  ];
  for (const [field, value] of mutations) {
    invalidAfter((candidate) => { candidate.engines[0].terminal[field] = value; }, new RegExp(field, "u"));
  }
});

test("privacy evidence fails closed on provider, credential, retry, cache, worker, and reflection", () => {
  const zeroFields = [
    "unexpected_content_bearing_request_count",
    "provider_origin_request_count",
    "non_hah_transferred_request_count",
    "account_authorization_or_provider_credential_request_count",
    "automatic_retry_count",
    "browser_fallback_request_count",
    "alternate_content_route_count",
    "service_worker_registration_count",
    "service_worker_interception_count",
    "cache_storage_entry_count",
    "api_cache_replay_count",
    "rum_request_count",
    "cloudflare_beacon_transferred_bytes",
    "source_marker_response_body_matches",
    "source_marker_prohibited_matches",
    "output_marker_prohibited_matches",
    "persistent_storage_marker_matches",
    "url_marker_matches",
    "header_marker_matches",
    "error_marker_matches",
    "console_marker_matches",
    "analytics_marker_matches",
    "unrelated_request_marker_matches",
  ];
  for (const field of zeroFields) {
    invalidAfter((candidate) => { candidate.engines[0].privacy[field] = 1; }, new RegExp(field, "u"));
  }
  const exactFields = [
    ["observed_request_count", 0],
    ["visitor_session_request_count", 0],
    ["content_bearing_request_count", 2],
    ["browser_quota_cookie_request_count", 0],
    ["source_marker_request_body_matches", 0],
    ["output_marker_response_body_matches", 0],
    ["provider_origins_observed", ["https://router.huggingface.co"]],
    ["content_bearing_urls", ["https://hah.dev/api/lattice", "https://example.com/collect"]],
    ["scan_profile", "partial-scan"],
    ["scanned_resource_types", scannedResourceTypes.slice(1)],
    ["provider_host_patterns_scanned", providerHostPatterns.slice(1)],
    ["provider_host_match_case_insensitive", false],
    ["marker_encodings_scanned", markerEncodings.slice(1)],
    ["csp_connect_src", ["'self'", "https:"]],
    ["provider_connect_allowed", true],
    ["network_payload_inspection_supported", false],
    ["persistent_storage_inspection_supported", false],
    ["service_worker_registry_checked", false],
    ["cache_storage_checked", false],
    ["persistent_storage_checked_after_reload", false],
    ["server_side_provider_retry_proven", true],
    ["server_side_provider_retention_proven", true],
    ["post_terminal_observation_ms", 9_999],
  ];
  for (const [field, value] of exactFields) {
    invalidAfter((candidate) => { candidate.engines[1].privacy[field] = value; }, new RegExp(field, "u"));
  }
  invalidAfter((candidate) => { candidate.engines[0].privacy.blocked_cloudflare_beacon_count = 17; }, /blocked_cloudflare_beacon_count/u);
});

test("fingerprints retain bounded counts and distinct digests, never source or output", () => {
  const mutations = [
    ["source_utf8_bytes", 0],
    ["source_utf8_bytes", 12_001],
    ["sample_classification", "private-user-content"],
    ["source_sha256", "not-a-digest"],
    ["source_marker_utf8_bytes", 19],
    ["source_marker_sha256", "0".repeat(64)],
    ["output_utf8_bytes", 48_001],
    ["output_sha256", "A".repeat(64)],
    ["output_marker_utf8_bytes", 257],
    ["output_marker_sha256", "0".repeat(64)],
  ];
  for (const [field, value] of mutations) {
    invalidAfter((candidate) => { candidate.engines[0].content_fingerprints[field] = value; }, new RegExp(field, "u"));
  }
  invalidAfter((candidate) => { candidate.engines[0].content_fingerprints.source_marker_utf8_bytes = 121; }, /source byte count/u);
  invalidAfter((candidate) => { candidate.engines[0].content_fingerprints.output_marker_utf8_bytes = 1_001; }, /output_marker_utf8_bytes/u);
  invalidAfter((candidate) => {
    candidate.engines[0].content_fingerprints.output_marker_sha256 = candidate.engines[0].content_fingerprints.source_marker_sha256;
  }, /distinct source and output markers/u);
  invalidAfter((candidate) => {
    candidate.engines[0].request.request_body_utf8_bytes = candidate.engines[0].content_fingerprints.source_utf8_bytes;
  }, /complete JSON envelope/u);
  invalidAfter((candidate) => {
    candidate.engines[0].response.response_body_utf8_bytes = candidate.engines[0].content_fingerprints.output_utf8_bytes;
  }, /complete JSON envelope/u);
});

test("all evidence-custody flags prohibit raw, secret, and sensitive retained material", () => {
  for (const field of Object.keys(validEvidence().redaction).slice(1)) {
    invalidAfter((candidate) => { candidate.redaction[field] = true; }, new RegExp(field, "u"));
  }
  const captureFalseFields = Object.keys(validEvidence().engines[0].sanitized_capture).slice(10);
  for (const field of captureFalseFields) {
    invalidAfter((candidate) => { candidate.engines[1].sanitized_capture[field] = true; }, new RegExp(field, "u"));
  }
  const captureMutations = [
    ["format", "har-v1"],
    ["basename", "capture.png"],
    ["media_type", "application/json"],
    ["byte_count", 66],
    ["byte_count", 10_485_761],
    ["pixel_width", 639],
    ["pixel_height", 479],
    ["sha256", "0".repeat(64)],
    ["flattened_raster_png", false],
    ["png_ancillary_chunks_stripped", false],
    ["pixel_redaction_manually_reviewed", false],
  ];
  for (const [field, value] of captureMutations) {
    invalidAfter((candidate) => { candidate.engines[0].sanitized_capture[field] = value; }, new RegExp(field, "u"));
  }
  invalidAfter((candidate) => {
    candidate.engines[1].sanitized_capture.sha256 = candidate.engines[0].sanitized_capture.sha256;
  }, /distinct sanitized capture digest/u);
});

test("closed objects, bounded strings, and canonical JSON prevent content smuggling", () => {
  invalidAfter((candidate) => { candidate.engines[0].request.raw_body = "raw source"; }, /request.*only these fields/u);
  invalidAfter((candidate) => { candidate.engines[0].response.output = "raw output"; }, /response.*only these fields/u);
  invalidAfter((candidate) => { candidate.engines[0].notes = "Bearer secret-value"; }, /engines\[0\].*only these fields/u);
  invalidAfter((candidate) => { candidate.engines[0].browser_version = "26.5 hf_abcdefghijk"; }, /browser_version/u);
  invalidAfter((candidate) => { candidate.evidence_id = "Bearer secret-value"; }, /evidence_id/u);

  const evidence = validEvidence();
  const canonical = `${JSON.stringify(evidence, null, 2)}\n`;
  assert.deepEqual(parseBrowserEvidenceText(canonical), evidence);
  assert.throws(() => parseBrowserEvidenceText(JSON.stringify(evidence)), /canonical two-space JSON serialization/u);
  assert.throws(() => parseBrowserEvidenceText(`${canonical}\n`), /canonical two-space JSON serialization/u);
  const duplicate = canonical.replace(
    '  "format": "TEXT_TO_LATTICE_BROWSER_EVIDENCE",',
    '  "format": "raw source hidden in a duplicate",\n  "format": "TEXT_TO_LATTICE_BROWSER_EVIDENCE",',
  );
  assert.throws(() => parseBrowserEvidenceText(duplicate), /canonical two-space JSON serialization/u);
  assert.throws(() => parseBrowserEvidenceText("{not-json}\n"), /must be valid JSON/u);
  assert.equal(browserEvidenceSha256(Buffer.from(canonical)), createHash("sha256").update(canonical).digest("hex"));
});

test("sanitized capture bytes must be a complete bounded flattened RGB/RGBA PNG", () => {
  const png = capturePng(16);
  assert.deepEqual(verifySanitizedPngBytes(png), { width: 640, height: 480 });
  assert.throws(
    () => verifySanitizedPngBytes(capturePng(16, { width: 639, height: 480 })),
    /bounded, non-interlaced/u,
  );
  assert.throws(
    () => verifySanitizedPngBytes(capturePng(16, { width: 640, height: 479 })),
    /bounded, non-interlaced/u,
  );

  const withMetadata = Buffer.concat([
    png.subarray(0, png.byteLength - 12),
    pngChunk("tEXt", Buffer.from("Comment\0raw source", "utf8")),
    png.subarray(png.byteLength - 12),
  ]);
  assert.throws(() => verifySanitizedPngBytes(withMetadata), /prohibited PNG metadata or ancillary chunk tEXt/u);

  const invalidRaster = Buffer.concat([
    png.subarray(0, 33),
    pngChunk("IDAT", Buffer.from("not a compressed raster", "utf8")),
    png.subarray(png.byteLength - 12),
  ]);
  assert.throws(() => verifySanitizedPngBytes(invalidRaster), /invalid or oversized compressed raster/u);

  const badCrc = Buffer.from(png);
  badCrc[32] ^= 1;
  assert.throws(() => verifySanitizedPngBytes(badCrc), /invalid IHDR CRC/u);
  assert.throws(() => verifySanitizedPngBytes(Buffer.concat([png, Buffer.from([0])])), /trailing data after IEND/u);

  const interlaced = Buffer.from(png);
  interlaced[28] = 1;
  const ihdrCrc = crc32(interlaced.subarray(12, 29));
  interlaced.writeUInt32BE(ihdrCrc, 29);
  assert.throws(() => verifySanitizedPngBytes(interlaced), /bounded, non-interlaced/u);
});

test("bundle custody binds canonical JSON, two deployment indexes, and two fixed non-symlink PNG files", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "ttl-browser-evidence-"));
  context.after(() => rm(directory, { force: true, recursive: true }));
  const evidencePath = join(directory, "TEXT-TO-LATTICE-BROWSER-EVIDENCE.json");
  const pngs = [capturePng(16), capturePng(32)];
  const evidence = validEvidence();
  const deploymentIndexes = await writeDeploymentIndexCopies(directory, evidence);
  for (const [index, png] of pngs.entries()) {
    const capture = evidence.engines[index].sanitized_capture;
    capture.byte_count = png.byteLength;
    capture.sha256 = browserEvidenceSha256(png);
    await writeFile(join(directory, capture.basename), png);
  }
  const canonical = `${JSON.stringify(evidence, null, 2)}\n`;
  await writeFile(evidencePath, canonical);

  const result = await verifyBrowserEvidenceBundle(evidencePath);
  assert.equal(result.byteCount, Buffer.byteLength(canonical));
  assert.equal(result.sha256, browserEvidenceSha256(Buffer.from(canonical)));
  assert.equal(result.deploymentIndexSha256, browserEvidenceSha256(deploymentIndexes.beforeBytes));
  assert.equal(result.pagesArtifactId, "987654321");
  assert.equal(
    result.qualifiedSourceSetSha256,
    evidence.deployment.qualified_source_set_sha256,
  );
  const command = spawnSync(process.execPath, [
    resolve(root, "scripts/verify-text-to-lattice-browser-evidence.mjs"),
    evidencePath,
  ], { encoding: "utf8" });
  assert.equal(command.status, 0, command.stderr);
  assert.match(command.stdout, /^Text to Lattice browser evidence verified\. /u);
  for (const field of [
    "deployed_commit=",
    "workflow_run=",
    "workflow_attempt=",
    "service_job=",
    "api_worker=",
    "response_policy_worker=",
    "deployment_index=",
    `qualified_source_set=${evidence.deployment.qualified_source_set_sha256}`,
    "pages_artifact=987654321:",
    "engines=Safari/WebKit, Brave/Chromium",
    "captures=safari-webkit:",
    "brave-chromium:",
    "evidence_bytes=",
    "evidence_sha256=",
  ]) assert.ok(command.stdout.includes(field), `terminal output omitted ${field}`);
  assert.doesNotMatch(command.stdout, /raw source|raw output|Bearer|hf_/u);

  await writeFile(join(directory, evidence.engines[0].sanitized_capture.basename), capturePng(48));
  await assert.rejects(verifyBrowserEvidenceBundle(evidencePath), /does not match the retained PNG bytes/u);

  await writeFile(join(directory, evidence.engines[0].sanitized_capture.basename), pngs[0]);
  const changedAfter = structuredClone(deploymentIndexes.after);
  changedAfter.pagesArtifactId = "987654322";
  await writeFile(
    join(directory, DEPLOYMENT_EVIDENCE_AFTER_BASENAME),
    `${JSON.stringify(changedAfter, null, 2)}\n`,
  );
  await assert.rejects(verifyBrowserEvidenceBundle(evidencePath), /must be byte-identical/u);

  const changedBoth = structuredClone(deploymentIndexes.before);
  changedBoth.pagesArtifactId = "987654323";
  await writeDeploymentIndexCopies(directory, evidence, {
    before: changedBoth,
    after: changedBoth,
    bindDigest: false,
  });
  await assert.rejects(
    verifyBrowserEvidenceBundle(evidencePath),
    /does not match the retained deployment evidence index bytes/u,
  );

  const identityMismatch = structuredClone(deploymentIndexes.before);
  identityMismatch.serviceJobId = "102999999998";
  await writeDeploymentIndexCopies(directory, evidence, {
    before: identityMismatch,
    after: identityMismatch,
  });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  await assert.rejects(
    verifyBrowserEvidenceBundle(evidencePath),
    /service_job_id.*does not match the retained deployment evidence index/u,
  );

  const sourceSetMismatch = structuredClone(deploymentIndexes.before);
  sourceSetMismatch.qualifiedSourceSetSha256 = digest("other-qualified-source-set");
  await writeDeploymentIndexCopies(directory, evidence, {
    before: sourceSetMismatch,
    after: sourceSetMismatch,
  });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  await assert.rejects(
    verifyBrowserEvidenceBundle(evidencePath),
    /qualified_source_set_sha256.*does not match the retained deployment evidence index/u,
  );

  await writeDeploymentIndexCopies(directory, evidence, {
    before: deploymentIndexes.before,
    after: deploymentIndexes.before,
  });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  const indexLinkTarget = join(directory, "deployment-index-link-target.json");
  await writeFile(indexLinkTarget, deploymentIndexes.beforeBytes);
  await rm(join(directory, DEPLOYMENT_EVIDENCE_AFTER_BASENAME));
  await symlink(indexLinkTarget, join(directory, DEPLOYMENT_EVIDENCE_AFTER_BASENAME));
  await assert.rejects(verifyBrowserEvidenceBundle(evidencePath), /without following symbolic links/u);

  const linkPath = join(directory, "evidence-link.json");
  await symlink(evidencePath, linkPath);
  await assert.rejects(verifyBrowserEvidenceBundle(linkPath), /without following symbolic links/u);
});

test("the owner template is inert and the schema mirrors the closed contract", async () => {
  const [templateSource, schemaSource] = await Promise.all([
    readFile(templatePath, "utf8"),
    readFile(schemaPath, "utf8"),
  ]);
  const template = JSON.parse(templateSource);
  const schema = JSON.parse(schemaSource);

  assert.match(template.evidence_id, /^REPLACE_WITH_/u);
  assert.match(
    template.deployment.deployment_evidence_before_captures_sha256,
    /TEXT-TO-LATTICE-DEPLOYMENT-EVIDENCE\.before\.json/u,
  );
  assert.match(
    template.deployment.deployment_evidence_after_captures_sha256,
    /TEXT-TO-LATTICE-DEPLOYMENT-EVIDENCE\.after\.json/u,
  );
  assert.equal(template.engines.length, 2);
  assert.deepEqual(template.engines.map(({ engine_id: engineId }) => engineId), ["safari-webkit", "brave-chromium"]);
  assert.ok(Object.entries(template.redaction).filter(([field]) => field !== "profile").every(([, value]) => value === false));
  assert.ok(template.engines.every(({ content_fingerprints: fingerprints }) => (
    fingerprints.sample_classification === "public-synthetic-nonsensitive"
  )));
  assert.doesNotMatch(templateSource, /\bBearer\s+|\bhf_[A-Za-z0-9]|\bsk-[A-Za-z0-9]|-----BEGIN [A-Z ]+PRIVATE KEY-----/u);
  assert.throws(() => verifyBrowserEvidence(template), /evidence_id/u, "the unfilled template must never qualify itself");

  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.match(schema.description, /two deployment-index copies must be byte-identical/iu);
  assert.match(schema.$defs.deployment.description, /post-live-verification deployment-index generation time/iu);
  for (const definition of ["engine", "request", "response", "privacy", "sanitizedCapture"]) {
    assert.equal(schema.$defs[definition].additionalProperties, false);
  }
  assert.deepEqual(
    schema.properties.engines.prefixItems.map((entry) => entry.allOf[1].properties.engine_id.const),
    ["safari-webkit", "brave-chromium"],
  );

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  assert.equal(validate(validEvidence()), true, JSON.stringify(validate.errors));
  assert.equal(validate(template), false, "safe placeholders remain intentionally invalid until replaced");
});
