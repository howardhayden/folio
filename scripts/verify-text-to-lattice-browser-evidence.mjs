import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import {
  parseTextToLatticeDeploymentEvidenceIndexText,
} from "./build-text-to-lattice-deployment-evidence.mjs";
import {
  LATTICE_VISITOR_SESSION_ACCEPT,
} from "../app/resume/lattice/remoteProtocol.js";

const EVIDENCE_FORMAT = "TEXT_TO_LATTICE_BROWSER_EVIDENCE";
const EVIDENCE_SCHEMA_VERSION = 1;
const EVIDENCE_FILE_BYTE_LIMIT = 131_072;
const DEPLOYMENT_INDEX_FILE_BYTE_LIMIT = 65_536;
const CAPTURE_FILE_BYTE_LIMIT = 10_485_760;
const VISITOR_SESSION_MAX_AGE_TOLERANCE_SECONDS = 5;
export const DEPLOYMENT_EVIDENCE_BEFORE_BASENAME =
  "TEXT-TO-LATTICE-DEPLOYMENT-EVIDENCE.before.json";
export const DEPLOYMENT_EVIDENCE_AFTER_BASENAME =
  "TEXT-TO-LATTICE-DEPLOYMENT-EVIDENCE.after.json";
const CANONICAL_URL = "https://hah.dev/resume/#text-to-lattice";
const API_URL = "https://hah.dev/api/lattice";
const API_ORIGIN = "https://hah.dev";
const API_COOKIE_NAME = "__Secure-hah-lattice-api-visitor";
const API_COOKIE_PATH = "/api/lattice";
const API_COOKIE_ATTRIBUTE_NAMES = Object.freeze([
  "max-age",
  "path",
  "secure",
  "httponly",
  "samesite",
]);
const EXPECTED_ENGINE_IDENTITIES = Object.freeze([
  Object.freeze({
    engineId: "safari-webkit",
    browserName: "Safari",
    engineName: "WebKit",
  }),
  Object.freeze({
    engineId: "brave-chromium",
    browserName: "Brave",
    engineName: "Chromium",
  }),
]);
const TERMINAL_STATUSES = new Set([
  "translated",
  "conformant-for-context",
  "review-required",
]);
const HEX_40 = /^[a-f0-9]{40}$/u;
const HEX_64 = /^[a-f0-9]{64}$/u;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const VERSION = /^[0-9]+(?:\.[0-9]+){0,5}$/u;
const MACOS_VERSION = /^[0-9]+(?:\.[0-9]+){0,3}$/u;
const APPLE_BUILD = /^[0-9]{2}[A-Z][0-9A-Za-z]{1,5}$/u;
const EVIDENCE_ID = /^ttl-browser-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{8}$/u;
const UTC_TIMESTAMP = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/u;
const SENSITIVE_VALUE = /(?:\bBearer\s+[A-Za-z0-9._~+/-]+=*|\bhf_[A-Za-z0-9]{8,}|\bsk-[A-Za-z0-9]{8,}|-----BEGIN [A-Z ]+PRIVATE KEY-----)/u;

const TOP_LEVEL_FIELDS = Object.freeze([
  "format",
  "schema_version",
  "evidence_id",
  "recorded_at",
  "deployment",
  "redaction",
  "engines",
]);
const DEPLOYMENT_FIELDS = Object.freeze([
  "deployed_commit",
  "workflow_run_id",
  "workflow_run_attempt",
  "workflow_run_url",
  "service_job_id",
  "canonical_url",
  "api_worker_deployment_id",
  "api_worker_version",
  "response_policy_worker_deployment_id",
  "response_policy_worker_version",
  "deployment_evidence_index_sha256",
  "deployment_evidence_before_captures_sha256",
  "deployment_evidence_after_captures_sha256",
  "site_artifact_sha256",
  "qualified_source_set_sha256",
  "deployed_at",
  "qualification_expires_at",
  "deployment_evidence_checked_before_captures_at",
  "deployment_evidence_checked_after_captures_at",
  "deployment_evidence_unchanged_across_captures",
]);
const REDACTION_FIELDS = Object.freeze([
  "profile",
  "raw_har_retained",
  "raw_request_body_retained",
  "raw_response_body_retained",
  "raw_source_retained",
  "raw_output_retained",
  "cookie_values_retained",
  "authorization_values_retained",
  "provider_credentials_retained",
  "sensitive_header_values_retained",
]);
const ENGINE_FIELDS = Object.freeze([
  "engine_id",
  "browser_name",
  "browser_version",
  "engine_name",
  "engine_version",
  "operating_system_name",
  "operating_system_version",
  "operating_system_build",
  "capture_started_at",
  "text_entry_started_at",
  "confirmation_at",
  "visitor_session_requested_at",
  "visitor_session_established_at",
  "submitted_at",
  "response_received_at",
  "terminal_at",
  "result_visible_at",
  "result_focused_at",
  "observation_ended_at",
  "hard_reload_at",
  "post_reload_checked_at",
  "capture_ended_at",
  "canonical_url",
  "isolated_session",
  "browser_cache_disabled",
  "network_capture_started_before_text_entry",
  "explicit_confirmation",
  "visitor_session_request",
  "visitor_session_response",
  "request",
  "response",
  "terminal",
  "privacy",
  "content_fingerprints",
  "sanitized_capture",
]);
const LIFECYCLE_TIMESTAMP_FIELDS = Object.freeze([
  "capture_started_at",
  "text_entry_started_at",
  "confirmation_at",
  "visitor_session_requested_at",
  "visitor_session_established_at",
  "submitted_at",
  "response_received_at",
  "terminal_at",
  "result_visible_at",
  "result_focused_at",
  "observation_ended_at",
  "hard_reload_at",
  "post_reload_checked_at",
  "capture_ended_at",
]);
const CONFIRMATION_FIELDS = Object.freeze([
  "disclosure_prefix",
  "authorization_checked",
  "submit_button_label",
  "submit_activation_count",
  "source_marker_requests_before_submit",
]);
const VISITOR_SESSION_REQUEST_FIELDS = Object.freeze([
  "request_count",
  "url",
  "origin_header",
  "method",
  "application_set_header_names",
  "content_type_header_present",
  "accept",
  "request_body_present",
  "request_body_utf8_bytes",
  "credentials_mode",
  "cookie_header_present",
  "authorization_header_present",
  "provider_credential_present",
  "referer_header_present",
  "query_present",
  "redirect_count",
  "transfer_source",
]);
const VISITOR_SESSION_RESPONSE_FIELDS = Object.freeze([
  "status",
  "content_type_header_present",
  "cache_control",
  "response_body_present",
  "response_body_utf8_bytes",
  "set_cookie_header_present",
  "set_cookie_header_count",
  "set_cookie_name",
  "set_cookie_attribute_names",
  "set_cookie_max_age_seconds",
  "set_cookie_path",
  "set_cookie_secure",
  "set_cookie_http_only",
  "set_cookie_same_site",
  "set_cookie_domain_present",
  "access_control_allow_origin_header_present",
]);
const REQUEST_FIELDS = Object.freeze([
  "request_count",
  "url",
  "origin_header",
  "method",
  "application_set_header_names",
  "content_type",
  "accept",
  "request_body_key_order",
  "request_body_member_count",
  "request_body_duplicate_member_count",
  "request_body_exact_contract",
  "text_value_type",
  "requested_mode",
  "schema_version",
  "request_body_utf8_bytes",
  "request_body_sha256",
  "credentials_mode",
  "cookie_header_present",
  "authorization_header_present",
  "provider_credential_present",
  "referer_header_present",
  "query_present",
  "redirect_count",
  "transfer_source",
]);
const RESPONSE_FIELDS = Object.freeze([
  "status",
  "content_type",
  "cache_control",
  "response_body_key_order",
  "response_body_member_count",
  "response_body_duplicate_member_count",
  "response_body_exact_contract",
  "schema_version",
  "result_version",
  "strict_result_contract_valid",
  "result_status",
  "set_cookie_header_present",
  "set_cookie_header_count",
  "access_control_allow_origin_header_present",
  "response_body_utf8_bytes",
  "response_body_sha256",
]);
const TERMINAL_FIELDS = Object.freeze([
  "announcement_prefix",
  "result_visible",
  "result_region_focused",
  "hard_reload_performed",
  "bfcache_restore",
  "source_persisted_after_reload",
  "result_persisted_after_reload",
]);
const PRIVACY_FIELDS = Object.freeze([
  "observed_request_count",
  "visitor_session_request_count",
  "content_bearing_request_count",
  "unexpected_content_bearing_request_count",
  "provider_origin_request_count",
  "non_hah_transferred_request_count",
  "account_authorization_or_provider_credential_request_count",
  "browser_quota_cookie_request_count",
  "automatic_retry_count",
  "browser_fallback_request_count",
  "alternate_content_route_count",
  "service_worker_registration_count",
  "service_worker_interception_count",
  "cache_storage_entry_count",
  "api_cache_replay_count",
  "rum_request_count",
  "blocked_cloudflare_beacon_count",
  "cloudflare_beacon_transferred_bytes",
  "source_marker_request_body_matches",
  "source_marker_response_body_matches",
  "source_marker_prohibited_matches",
  "output_marker_response_body_matches",
  "output_marker_prohibited_matches",
  "persistent_storage_marker_matches",
  "url_marker_matches",
  "header_marker_matches",
  "error_marker_matches",
  "console_marker_matches",
  "analytics_marker_matches",
  "unrelated_request_marker_matches",
  "provider_origins_observed",
  "content_bearing_urls",
  "scan_profile",
  "scanned_resource_types",
  "provider_host_patterns_scanned",
  "provider_host_match_case_insensitive",
  "marker_encodings_scanned",
  "csp_connect_src",
  "provider_connect_allowed",
  "network_payload_inspection_supported",
  "persistent_storage_inspection_supported",
  "service_worker_registry_checked",
  "cache_storage_checked",
  "persistent_storage_checked_after_reload",
  "server_side_provider_retry_proven",
  "server_side_provider_retention_proven",
  "post_terminal_observation_ms",
]);
const FINGERPRINT_FIELDS = Object.freeze([
  "source_utf8_bytes",
  "sample_classification",
  "source_sha256",
  "source_marker_utf8_bytes",
  "source_marker_sha256",
  "output_utf8_bytes",
  "output_sha256",
  "output_marker_utf8_bytes",
  "output_marker_sha256",
]);
const SANITIZED_CAPTURE_FIELDS = Object.freeze([
  "format",
  "basename",
  "media_type",
  "byte_count",
  "pixel_width",
  "pixel_height",
  "sha256",
  "flattened_raster_png",
  "png_ancillary_chunks_stripped",
  "pixel_redaction_manually_reviewed",
  "contains_raw_har",
  "contains_raw_request_body",
  "contains_raw_response_body",
  "contains_raw_source",
  "contains_raw_output",
  "contains_cookie_values",
  "contains_authorization_values",
  "contains_provider_credentials",
  "contains_sensitive_header_values",
]);

const SCANNED_RESOURCE_TYPES = Object.freeze([
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
]);
const PROVIDER_HOST_PATTERNS = Object.freeze([
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
]);
const MARKER_ENCODINGS = Object.freeze([
  "literal",
  "json-escaped",
  "percent-encoded",
  "base64",
  "base64url",
  "sha256",
]);

export class BrowserEvidenceError extends Error {
  constructor(path, message) {
    super(`Text to Lattice browser evidence is invalid at ${path}: ${message}`);
    this.name = "BrowserEvidenceError";
    this.path = path;
  }
}

function fail(path, message) {
  throw new BrowserEvidenceError(path, message);
}

function exactObject(value, fields, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "must be an object");
  }
  const keys = Object.keys(value);
  if (JSON.stringify(keys) !== JSON.stringify(fields)) {
    fail(path, `must contain only these fields in order: ${fields.join(", ")}`);
  }
  return value;
}

function exactArray(value, expected, path) {
  if (!Array.isArray(value) || JSON.stringify(value) !== JSON.stringify(expected)) {
    fail(path, `must equal ${JSON.stringify(expected)}`);
  }
}

function exactValue(value, expected, path) {
  if (value !== expected) fail(path, `must equal ${JSON.stringify(expected)}`);
}

function trueValue(value, path) {
  exactValue(value, true, path);
}

function falseValue(value, path) {
  exactValue(value, false, path);
}

function integer(value, minimum, maximum, path) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(path, `must be an integer from ${minimum} through ${maximum}`);
  }
  return value;
}

function pattern(value, expression, description, path) {
  if (typeof value !== "string" || !expression.test(value)) {
    fail(path, `must be ${description}`);
  }
  return value;
}

function nonzeroDigest(value, path) {
  pattern(value, HEX_64, "a lowercase SHA-256 digest", path);
  if (/^0{64}$/u.test(value)) fail(path, "must not use the all-zero placeholder digest");
  return value;
}

function nonzeroCommit(value, path) {
  pattern(value, HEX_40, "a lowercase 40-character Git commit", path);
  if (/^0{40}$/u.test(value)) fail(path, "must not use the all-zero placeholder commit");
  return value;
}

function nonzeroUuid(value, path) {
  pattern(value, UUID, "a lowercase UUID", path);
  if (value === "00000000-0000-0000-0000-000000000000") {
    fail(path, "must not use the all-zero placeholder UUID");
  }
  return value;
}

function timestamp(value, path) {
  pattern(value, UTC_TIMESTAMP, "a canonical millisecond UTC timestamp", path);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail(path, "must identify a real canonical UTC instant");
  }
  return parsed.getTime();
}

function noSensitiveStrings(value, path = "$") {
  if (typeof value === "string") {
    if (SENSITIVE_VALUE.test(value)) fail(path, "contains a credential-shaped value");
    if (/[\r\n\u0000]/u.test(value)) fail(path, "contains prohibited control or multiline text");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => noSensitiveStrings(item, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => noSensitiveStrings(item, `${path}.${key}`));
  }
}

function verifyDeployment(value) {
  const deployment = exactObject(value, DEPLOYMENT_FIELDS, "$.deployment");
  nonzeroCommit(deployment.deployed_commit, "$.deployment.deployed_commit");
  pattern(deployment.workflow_run_id, /^[1-9][0-9]{0,19}$/u, "a positive decimal workflow-run identifier", "$.deployment.workflow_run_id");
  pattern(deployment.workflow_run_attempt, /^[1-9][0-9]{0,5}$/u, "a positive decimal workflow-run attempt", "$.deployment.workflow_run_attempt");
  exactValue(
    deployment.workflow_run_url,
    `https://github.com/howardhayden/folio/actions/runs/${deployment.workflow_run_id}`,
    "$.deployment.workflow_run_url",
  );
  pattern(deployment.service_job_id, /^[1-9][0-9]{0,19}$/u, "a positive decimal service-job identifier", "$.deployment.service_job_id");
  exactValue(deployment.canonical_url, CANONICAL_URL, "$.deployment.canonical_url");
  nonzeroUuid(deployment.api_worker_deployment_id, "$.deployment.api_worker_deployment_id");
  nonzeroUuid(deployment.api_worker_version, "$.deployment.api_worker_version");
  nonzeroUuid(deployment.response_policy_worker_deployment_id, "$.deployment.response_policy_worker_deployment_id");
  nonzeroUuid(deployment.response_policy_worker_version, "$.deployment.response_policy_worker_version");
  if (deployment.api_worker_version === deployment.response_policy_worker_version) {
    fail("$.deployment.response_policy_worker_version", "must identify a distinct Worker version");
  }
  if (deployment.api_worker_deployment_id === deployment.response_policy_worker_deployment_id) {
    fail("$.deployment.response_policy_worker_deployment_id", "must identify a distinct Worker deployment");
  }
  const deploymentEvidenceSha256 = nonzeroDigest(
    deployment.deployment_evidence_index_sha256,
    "$.deployment.deployment_evidence_index_sha256",
  );
  const evidenceBeforeSha256 = nonzeroDigest(
    deployment.deployment_evidence_before_captures_sha256,
    "$.deployment.deployment_evidence_before_captures_sha256",
  );
  const evidenceAfterSha256 = nonzeroDigest(
    deployment.deployment_evidence_after_captures_sha256,
    "$.deployment.deployment_evidence_after_captures_sha256",
  );
  if (evidenceBeforeSha256 !== deploymentEvidenceSha256 || evidenceAfterSha256 !== deploymentEvidenceSha256) {
    fail("$.deployment", "must bind the same deployment-evidence snapshot before and after both captures");
  }
  nonzeroDigest(deployment.site_artifact_sha256, "$.deployment.site_artifact_sha256");
  nonzeroDigest(
    deployment.qualified_source_set_sha256,
    "$.deployment.qualified_source_set_sha256",
  );
  const deployedAt = timestamp(deployment.deployed_at, "$.deployment.deployed_at");
  const qualificationExpiresAt = timestamp(
    deployment.qualification_expires_at,
    "$.deployment.qualification_expires_at",
  );
  const evidenceCheckedBeforeAt = timestamp(
    deployment.deployment_evidence_checked_before_captures_at,
    "$.deployment.deployment_evidence_checked_before_captures_at",
  );
  const evidenceCheckedAfterAt = timestamp(
    deployment.deployment_evidence_checked_after_captures_at,
    "$.deployment.deployment_evidence_checked_after_captures_at",
  );
  if (evidenceCheckedBeforeAt < deployedAt) {
    fail("$.deployment.deployment_evidence_checked_before_captures_at", "must not precede deployment");
  }
  if (evidenceCheckedAfterAt <= evidenceCheckedBeforeAt) {
    fail("$.deployment.deployment_evidence_checked_after_captures_at", "must be later than the pre-capture deployment-evidence check");
  }
  if (evidenceCheckedAfterAt - evidenceCheckedBeforeAt > 1_800_000) {
    fail("$.deployment.deployment_evidence_checked_after_captures_at", "must close the complete two-browser capture and deployment-evidence window within 30 minutes");
  }
  if (qualificationExpiresAt <= deployedAt) {
    fail("$.deployment.qualification_expires_at", "must follow deployment");
  }
  if (evidenceCheckedAfterAt > qualificationExpiresAt) {
    fail("$.deployment.deployment_evidence_checked_after_captures_at", "must not follow qualification expiry");
  }
  trueValue(
    deployment.deployment_evidence_unchanged_across_captures,
    "$.deployment.deployment_evidence_unchanged_across_captures",
  );
  return Object.freeze({
    deployedAt,
    qualificationExpiresAt,
    evidenceCheckedBeforeAt,
    evidenceCheckedAfterAt,
  });
}

function verifyRedaction(value) {
  const redaction = exactObject(value, REDACTION_FIELDS, "$.redaction");
  exactValue(redaction.profile, "metadata-digests-only-v1", "$.redaction.profile");
  for (const field of REDACTION_FIELDS.slice(1)) falseValue(redaction[field], `$.redaction.${field}`);
}

function verifyConfirmation(value, path) {
  const confirmation = exactObject(value, CONFIRMATION_FIELDS, path);
  exactValue(confirmation.disclosure_prefix, "This text leaves hah.dev", `${path}.disclosure_prefix`);
  trueValue(confirmation.authorization_checked, `${path}.authorization_checked`);
  exactValue(confirmation.submit_button_label, "Process with external service", `${path}.submit_button_label`);
  exactValue(confirmation.submit_activation_count, 1, `${path}.submit_activation_count`);
  exactValue(confirmation.source_marker_requests_before_submit, 0, `${path}.source_marker_requests_before_submit`);
}

function verifyVisitorSessionRequest(value, path) {
  const request = exactObject(value, VISITOR_SESSION_REQUEST_FIELDS, path);
  exactValue(request.request_count, 1, `${path}.request_count`);
  exactValue(request.url, API_URL, `${path}.url`);
  exactValue(request.origin_header, API_ORIGIN, `${path}.origin_header`);
  exactValue(request.method, "POST", `${path}.method`);
  exactArray(request.application_set_header_names, ["accept"], `${path}.application_set_header_names`);
  falseValue(request.content_type_header_present, `${path}.content_type_header_present`);
  exactValue(request.accept, LATTICE_VISITOR_SESSION_ACCEPT, `${path}.accept`);
  falseValue(request.request_body_present, `${path}.request_body_present`);
  exactValue(request.request_body_utf8_bytes, 0, `${path}.request_body_utf8_bytes`);
  exactValue(request.credentials_mode, "same-origin", `${path}.credentials_mode`);
  falseValue(request.cookie_header_present, `${path}.cookie_header_present`);
  falseValue(request.authorization_header_present, `${path}.authorization_header_present`);
  falseValue(request.provider_credential_present, `${path}.provider_credential_present`);
  falseValue(request.referer_header_present, `${path}.referer_header_present`);
  falseValue(request.query_present, `${path}.query_present`);
  exactValue(request.redirect_count, 0, `${path}.redirect_count`);
  exactValue(request.transfer_source, "network", `${path}.transfer_source`);
}

function secondsUntilNextUtcDay(instant) {
  const date = new Date(instant);
  const nextUtcDay = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
  return Math.ceil((nextUtcDay - instant) / 1_000);
}

function verifyVisitorSessionResponse(value, path, establishedAt) {
  const response = exactObject(value, VISITOR_SESSION_RESPONSE_FIELDS, path);
  exactValue(response.status, 204, `${path}.status`);
  falseValue(response.content_type_header_present, `${path}.content_type_header_present`);
  exactValue(response.cache_control, "no-store", `${path}.cache_control`);
  falseValue(response.response_body_present, `${path}.response_body_present`);
  exactValue(response.response_body_utf8_bytes, 0, `${path}.response_body_utf8_bytes`);
  trueValue(response.set_cookie_header_present, `${path}.set_cookie_header_present`);
  exactValue(response.set_cookie_header_count, 1, `${path}.set_cookie_header_count`);
  exactValue(response.set_cookie_name, API_COOKIE_NAME, `${path}.set_cookie_name`);
  exactArray(
    response.set_cookie_attribute_names,
    API_COOKIE_ATTRIBUTE_NAMES,
    `${path}.set_cookie_attribute_names`,
  );
  integer(response.set_cookie_max_age_seconds, 1, 86_400, `${path}.set_cookie_max_age_seconds`);
  const expectedMaxAge = secondsUntilNextUtcDay(establishedAt);
  if (Math.abs(response.set_cookie_max_age_seconds - expectedMaxAge)
    > VISITOR_SESSION_MAX_AGE_TOLERANCE_SECONDS) {
    fail(
      `${path}.set_cookie_max_age_seconds`,
      `must expire at the next UTC-day boundary within ${VISITOR_SESSION_MAX_AGE_TOLERANCE_SECONDS} seconds of response-latency and capture-rounding tolerance`,
    );
  }
  exactValue(response.set_cookie_path, API_COOKIE_PATH, `${path}.set_cookie_path`);
  trueValue(response.set_cookie_secure, `${path}.set_cookie_secure`);
  trueValue(response.set_cookie_http_only, `${path}.set_cookie_http_only`);
  exactValue(response.set_cookie_same_site, "Strict", `${path}.set_cookie_same_site`);
  falseValue(response.set_cookie_domain_present, `${path}.set_cookie_domain_present`);
  falseValue(response.access_control_allow_origin_header_present, `${path}.access_control_allow_origin_header_present`);
}

function verifyRequest(value, path) {
  const request = exactObject(value, REQUEST_FIELDS, path);
  exactValue(request.request_count, 1, `${path}.request_count`);
  exactValue(request.url, API_URL, `${path}.url`);
  exactValue(request.origin_header, API_ORIGIN, `${path}.origin_header`);
  exactValue(request.method, "POST", `${path}.method`);
  exactArray(request.application_set_header_names, ["accept", "content-type"], `${path}.application_set_header_names`);
  exactValue(request.content_type, "application/json", `${path}.content_type`);
  exactValue(request.accept, "application/json", `${path}.accept`);
  exactArray(request.request_body_key_order, ["text", "requested_mode", "schema_version"], `${path}.request_body_key_order`);
  exactValue(request.request_body_member_count, 3, `${path}.request_body_member_count`);
  exactValue(request.request_body_duplicate_member_count, 0, `${path}.request_body_duplicate_member_count`);
  trueValue(request.request_body_exact_contract, `${path}.request_body_exact_contract`);
  exactValue(request.text_value_type, "string", `${path}.text_value_type`);
  exactValue(request.requested_mode, "auto", `${path}.requested_mode`);
  exactValue(request.schema_version, 1, `${path}.schema_version`);
  integer(request.request_body_utf8_bytes, 1, 65_536, `${path}.request_body_utf8_bytes`);
  nonzeroDigest(request.request_body_sha256, `${path}.request_body_sha256`);
  exactValue(request.credentials_mode, "same-origin", `${path}.credentials_mode`);
  trueValue(request.cookie_header_present, `${path}.cookie_header_present`);
  falseValue(request.authorization_header_present, `${path}.authorization_header_present`);
  falseValue(request.provider_credential_present, `${path}.provider_credential_present`);
  falseValue(request.referer_header_present, `${path}.referer_header_present`);
  falseValue(request.query_present, `${path}.query_present`);
  exactValue(request.redirect_count, 0, `${path}.redirect_count`);
  exactValue(request.transfer_source, "network", `${path}.transfer_source`);
}

function verifyResponse(value, path) {
  const response = exactObject(value, RESPONSE_FIELDS, path);
  exactValue(response.status, 200, `${path}.status`);
  exactValue(response.content_type, "application/json; charset=utf-8", `${path}.content_type`);
  exactValue(response.cache_control, "no-store", `${path}.cache_control`);
  exactArray(response.response_body_key_order, ["result", "schema_version"], `${path}.response_body_key_order`);
  exactValue(response.response_body_member_count, 2, `${path}.response_body_member_count`);
  exactValue(response.response_body_duplicate_member_count, 0, `${path}.response_body_duplicate_member_count`);
  trueValue(response.response_body_exact_contract, `${path}.response_body_exact_contract`);
  exactValue(response.schema_version, 1, `${path}.schema_version`);
  exactValue(response.result_version, "text-to-lattice.v7", `${path}.result_version`);
  trueValue(response.strict_result_contract_valid, `${path}.strict_result_contract_valid`);
  if (!TERMINAL_STATUSES.has(response.result_status)) {
    fail(`${path}.result_status`, "must be translated, conformant-for-context, or review-required");
  }
  falseValue(response.set_cookie_header_present, `${path}.set_cookie_header_present`);
  exactValue(response.set_cookie_header_count, 0, `${path}.set_cookie_header_count`);
  falseValue(response.access_control_allow_origin_header_present, `${path}.access_control_allow_origin_header_present`);
  integer(response.response_body_utf8_bytes, 1, 262_144, `${path}.response_body_utf8_bytes`);
  nonzeroDigest(response.response_body_sha256, `${path}.response_body_sha256`);
}

function verifyTerminal(value, path) {
  const terminal = exactObject(value, TERMINAL_FIELDS, path);
  exactValue(terminal.announcement_prefix, "Result ready.", `${path}.announcement_prefix`);
  trueValue(terminal.result_visible, `${path}.result_visible`);
  trueValue(terminal.result_region_focused, `${path}.result_region_focused`);
  trueValue(terminal.hard_reload_performed, `${path}.hard_reload_performed`);
  falseValue(terminal.bfcache_restore, `${path}.bfcache_restore`);
  falseValue(terminal.source_persisted_after_reload, `${path}.source_persisted_after_reload`);
  falseValue(terminal.result_persisted_after_reload, `${path}.result_persisted_after_reload`);
}

function verifyPrivacy(value, path) {
  const privacy = exactObject(value, PRIVACY_FIELDS, path);
  integer(privacy.observed_request_count, 2, 10_000, `${path}.observed_request_count`);
  exactValue(privacy.visitor_session_request_count, 1, `${path}.visitor_session_request_count`);
  exactValue(privacy.content_bearing_request_count, 1, `${path}.content_bearing_request_count`);
  exactValue(privacy.browser_quota_cookie_request_count, 1, `${path}.browser_quota_cookie_request_count`);
  for (const field of [
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
    "source_marker_prohibited_matches",
    "output_marker_prohibited_matches",
    "persistent_storage_marker_matches",
    "url_marker_matches",
    "header_marker_matches",
    "error_marker_matches",
    "console_marker_matches",
    "analytics_marker_matches",
    "unrelated_request_marker_matches",
  ]) exactValue(privacy[field], 0, `${path}.${field}`);
  integer(privacy.blocked_cloudflare_beacon_count, 0, 16, `${path}.blocked_cloudflare_beacon_count`);
  exactValue(privacy.source_marker_request_body_matches, 1, `${path}.source_marker_request_body_matches`);
  exactValue(privacy.source_marker_response_body_matches, 0, `${path}.source_marker_response_body_matches`);
  exactValue(privacy.output_marker_response_body_matches, 1, `${path}.output_marker_response_body_matches`);
  exactArray(privacy.provider_origins_observed, [], `${path}.provider_origins_observed`);
  exactArray(privacy.content_bearing_urls, [API_URL], `${path}.content_bearing_urls`);
  exactValue(privacy.scan_profile, "ttl-browser-egress-scan-v1", `${path}.scan_profile`);
  exactArray(privacy.scanned_resource_types, SCANNED_RESOURCE_TYPES, `${path}.scanned_resource_types`);
  exactArray(privacy.provider_host_patterns_scanned, PROVIDER_HOST_PATTERNS, `${path}.provider_host_patterns_scanned`);
  trueValue(privacy.provider_host_match_case_insensitive, `${path}.provider_host_match_case_insensitive`);
  exactArray(privacy.marker_encodings_scanned, MARKER_ENCODINGS, `${path}.marker_encodings_scanned`);
  exactArray(privacy.csp_connect_src, ["'self'"], `${path}.csp_connect_src`);
  falseValue(privacy.provider_connect_allowed, `${path}.provider_connect_allowed`);
  trueValue(privacy.network_payload_inspection_supported, `${path}.network_payload_inspection_supported`);
  trueValue(privacy.persistent_storage_inspection_supported, `${path}.persistent_storage_inspection_supported`);
  trueValue(privacy.service_worker_registry_checked, `${path}.service_worker_registry_checked`);
  trueValue(privacy.cache_storage_checked, `${path}.cache_storage_checked`);
  trueValue(privacy.persistent_storage_checked_after_reload, `${path}.persistent_storage_checked_after_reload`);
  falseValue(privacy.server_side_provider_retry_proven, `${path}.server_side_provider_retry_proven`);
  falseValue(privacy.server_side_provider_retention_proven, `${path}.server_side_provider_retention_proven`);
  integer(privacy.post_terminal_observation_ms, 10_000, 60_000, `${path}.post_terminal_observation_ms`);
}

function verifyFingerprints(value, path) {
  const fingerprints = exactObject(value, FINGERPRINT_FIELDS, path);
  integer(fingerprints.source_utf8_bytes, 1, 12_000, `${path}.source_utf8_bytes`);
  exactValue(fingerprints.sample_classification, "public-synthetic-nonsensitive", `${path}.sample_classification`);
  nonzeroDigest(fingerprints.source_sha256, `${path}.source_sha256`);
  integer(fingerprints.source_marker_utf8_bytes, 20, 128, `${path}.source_marker_utf8_bytes`);
  nonzeroDigest(fingerprints.source_marker_sha256, `${path}.source_marker_sha256`);
  integer(fingerprints.output_utf8_bytes, 1, 48_000, `${path}.output_utf8_bytes`);
  nonzeroDigest(fingerprints.output_sha256, `${path}.output_sha256`);
  integer(fingerprints.output_marker_utf8_bytes, 20, 256, `${path}.output_marker_utf8_bytes`);
  nonzeroDigest(fingerprints.output_marker_sha256, `${path}.output_marker_sha256`);
  if (fingerprints.source_marker_utf8_bytes > fingerprints.source_utf8_bytes) {
    fail(`${path}.source_marker_utf8_bytes`, "must not exceed the source byte count");
  }
  if (fingerprints.output_marker_utf8_bytes > fingerprints.output_utf8_bytes) {
    fail(`${path}.output_marker_utf8_bytes`, "must not exceed the output byte count");
  }
  if (fingerprints.source_marker_sha256 === fingerprints.output_marker_sha256) {
    fail(path, "must use distinct source and output markers");
  }
  return fingerprints;
}

function verifySanitizedCapture(value, path, expectedBasename) {
  const capture = exactObject(value, SANITIZED_CAPTURE_FIELDS, path);
  exactValue(capture.format, "flattened-redacted-raster-png-v1", `${path}.format`);
  exactValue(capture.basename, expectedBasename, `${path}.basename`);
  exactValue(capture.media_type, "image/png", `${path}.media_type`);
  integer(capture.byte_count, 67, CAPTURE_FILE_BYTE_LIMIT, `${path}.byte_count`);
  integer(capture.pixel_width, 640, 8_192, `${path}.pixel_width`);
  integer(capture.pixel_height, 480, 8_192, `${path}.pixel_height`);
  nonzeroDigest(capture.sha256, `${path}.sha256`);
  trueValue(capture.flattened_raster_png, `${path}.flattened_raster_png`);
  trueValue(capture.png_ancillary_chunks_stripped, `${path}.png_ancillary_chunks_stripped`);
  trueValue(capture.pixel_redaction_manually_reviewed, `${path}.pixel_redaction_manually_reviewed`);
  for (const field of SANITIZED_CAPTURE_FIELDS.slice(10)) falseValue(capture[field], `${path}.${field}`);
  return Object.freeze({
    sha256: capture.sha256,
    pixelWidth: capture.pixel_width,
    pixelHeight: capture.pixel_height,
  });
}

function verifyEngine(value, expectedIdentity, index, deployment) {
  const path = `$.engines[${index}]`;
  const engine = exactObject(value, ENGINE_FIELDS, path);
  exactValue(engine.engine_id, expectedIdentity.engineId, `${path}.engine_id`);
  exactValue(engine.browser_name, expectedIdentity.browserName, `${path}.browser_name`);
  pattern(engine.browser_version, VERSION, "a numeric browser version", `${path}.browser_version`);
  exactValue(engine.engine_name, expectedIdentity.engineName, `${path}.engine_name`);
  pattern(engine.engine_version, VERSION, "a numeric engine version", `${path}.engine_version`);
  exactValue(engine.operating_system_name, "macOS", `${path}.operating_system_name`);
  pattern(engine.operating_system_version, MACOS_VERSION, "a numeric macOS version", `${path}.operating_system_version`);
  pattern(engine.operating_system_build, APPLE_BUILD, "an Apple build identifier", `${path}.operating_system_build`);

  const instants = LIFECYCLE_TIMESTAMP_FIELDS.map((field) => timestamp(engine[field], `${path}.${field}`));
  const [
    captureStartedAt,
    textEntryStartedAt,
    confirmationAt,
    visitorSessionRequestedAt,
    visitorSessionEstablishedAt,
    submittedAt,
    responseReceivedAt,
    terminalAt,
    resultVisibleAt,
    resultFocusedAt,
    observationEndedAt,
    hardReloadAt,
    postReloadCheckedAt,
    captureEndedAt,
  ] = instants;
  if (captureStartedAt < deployment.evidenceCheckedBeforeAt) {
    fail(`${path}.capture_started_at`, "must not precede the pre-capture deployment-evidence check");
  }
  if (captureEndedAt > deployment.evidenceCheckedAfterAt) {
    fail(`${path}.capture_ended_at`, "must not follow the post-capture deployment-evidence check");
  }
  const orderedChecks = [
    [captureStartedAt < textEntryStartedAt, "text_entry_started_at"],
    [textEntryStartedAt < confirmationAt, "confirmation_at"],
    [confirmationAt < visitorSessionRequestedAt, "visitor_session_requested_at"],
    [visitorSessionRequestedAt < visitorSessionEstablishedAt, "visitor_session_established_at"],
    [visitorSessionEstablishedAt < submittedAt, "submitted_at"],
    [submittedAt < responseReceivedAt, "response_received_at"],
    [responseReceivedAt <= terminalAt, "terminal_at"],
    [terminalAt <= resultVisibleAt, "result_visible_at"],
    [resultVisibleAt <= resultFocusedAt, "result_focused_at"],
    [resultFocusedAt < observationEndedAt, "observation_ended_at"],
    [observationEndedAt <= hardReloadAt, "hard_reload_at"],
    [hardReloadAt < postReloadCheckedAt, "post_reload_checked_at"],
    [postReloadCheckedAt <= captureEndedAt, "capture_ended_at"],
  ];
  const failedOrder = orderedChecks.find(([satisfied]) => !satisfied);
  if (failedOrder) {
    fail(`${path}.${failedOrder[1]}`, "is not in the required production lifecycle order");
  }
  if (responseReceivedAt - submittedAt > 240_000) {
    fail(`${path}.response_received_at`, "exceeds the 240-second client lifecycle bound");
  }
  if (resultVisibleAt - responseReceivedAt > 1_000 || resultFocusedAt - responseReceivedAt > 1_000) {
    fail(`${path}.result_visible_at`, "the visible and focused result must follow the response within one second");
  }

  exactValue(engine.canonical_url, CANONICAL_URL, `${path}.canonical_url`);
  trueValue(engine.isolated_session, `${path}.isolated_session`);
  falseValue(engine.browser_cache_disabled, `${path}.browser_cache_disabled`);
  trueValue(engine.network_capture_started_before_text_entry, `${path}.network_capture_started_before_text_entry`);
  verifyConfirmation(engine.explicit_confirmation, `${path}.explicit_confirmation`);
  verifyVisitorSessionRequest(engine.visitor_session_request, `${path}.visitor_session_request`);
  verifyVisitorSessionResponse(
    engine.visitor_session_response,
    `${path}.visitor_session_response`,
    visitorSessionEstablishedAt,
  );
  verifyRequest(engine.request, `${path}.request`);
  verifyResponse(engine.response, `${path}.response`);
  verifyTerminal(engine.terminal, `${path}.terminal`);
  verifyPrivacy(engine.privacy, `${path}.privacy`);
  const observationDuration = observationEndedAt - terminalAt;
  if (observationDuration !== engine.privacy.post_terminal_observation_ms) {
    fail(`${path}.privacy.post_terminal_observation_ms`, "must equal the measured terminal-to-observation-end duration");
  }
  const fingerprints = verifyFingerprints(engine.content_fingerprints, `${path}.content_fingerprints`);
  const capture = verifySanitizedCapture(
    engine.sanitized_capture,
    `${path}.sanitized_capture`,
    `TEXT-TO-LATTICE-BROWSER-EVIDENCE.${expectedIdentity.engineId}.png`,
  );

  if (engine.request.request_body_utf8_bytes <= fingerprints.source_utf8_bytes) {
    fail(`${path}.request.request_body_utf8_bytes`, "must exceed the source byte count because it is the complete JSON envelope");
  }
  if (engine.response.response_body_utf8_bytes <= fingerprints.output_utf8_bytes) {
    fail(`${path}.response.response_body_utf8_bytes`, "must exceed the output byte count because it is the complete JSON envelope");
  }
  return Object.freeze({
    captureStartedAt,
    captureEndedAt,
    captureSha256: capture.sha256,
    capturePixelWidth: capture.pixelWidth,
    capturePixelHeight: capture.pixelHeight,
  });
}

/** Validate a parsed, already-sanitized GATE-06 browser evidence record. */
export function verifyBrowserEvidence(value) {
  const evidence = exactObject(value, TOP_LEVEL_FIELDS, "$");
  exactValue(evidence.format, EVIDENCE_FORMAT, "$.format");
  exactValue(evidence.schema_version, EVIDENCE_SCHEMA_VERSION, "$.schema_version");
  pattern(evidence.evidence_id, EVIDENCE_ID, "a bounded Text to Lattice browser-evidence identifier", "$.evidence_id");
  const recordedAt = timestamp(evidence.recorded_at, "$.recorded_at");
  const evidenceIdTimestamp = evidence.evidence_id.slice("ttl-browser-".length, "ttl-browser-YYYYMMDDTHHMMSSZ".length);
  const recordedAtTimestamp = evidence.recorded_at.slice(0, 19).replaceAll(/[-:]/gu, "") + "Z";
  if (evidenceIdTimestamp !== recordedAtTimestamp) {
    fail("$.evidence_id", "must encode the same UTC second as recorded_at");
  }
  const deployment = verifyDeployment(evidence.deployment);
  verifyRedaction(evidence.redaction);
  if (!Array.isArray(evidence.engines) || evidence.engines.length !== EXPECTED_ENGINE_IDENTITIES.length) {
    fail("$.engines", "must contain exactly Safari/WebKit followed by Brave/Chromium");
  }
  const results = evidence.engines.map((engine, index) => (
    verifyEngine(engine, EXPECTED_ENGINE_IDENTITIES[index], index, deployment)
  ));
  if (recordedAt < deployment.evidenceCheckedAfterAt) {
    fail("$.recorded_at", "must not precede the post-capture deployment-evidence check");
  }
  if (new Set(results.map(({ captureSha256 }) => captureSha256)).size !== results.length) {
    fail("$.engines", "must bind a distinct sanitized capture digest for each engine");
  }
  noSensitiveStrings(evidence);
  return Object.freeze({
    deployedCommit: evidence.deployment.deployed_commit,
    workflowRunId: evidence.deployment.workflow_run_id,
    qualifiedSourceSetSha256: evidence.deployment.qualified_source_set_sha256,
    engineIds: Object.freeze(evidence.engines.map(({ engine_id: engineId }) => engineId)),
  });
}

/** Parse canonical JSON. Canonical serialization rejects duplicate or hidden fields. */
export function parseBrowserEvidenceText(source) {
  if (typeof source !== "string") fail("$", "evidence bytes must decode as UTF-8 text");
  let value;
  try {
    value = JSON.parse(source);
  } catch (error) {
    fail("$", `must be valid JSON (${error instanceof Error ? error.message : "parse failure"})`);
  }
  const canonical = `${JSON.stringify(value, null, 2)}\n`;
  if (source !== canonical) {
    fail("$", "must use the canonical two-space JSON serialization with one final newline");
  }
  verifyBrowserEvidence(value);
  return value;
}

export function browserEvidenceSha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Verify that a retained capture is a flattened PNG without metadata chunks. */
export function verifySanitizedPngBytes(bytes, path = "sanitized capture") {
  if (!(bytes instanceof Uint8Array)) fail(path, "must be PNG bytes");
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.byteLength < 67 || signature.some((byte, index) => bytes[index] !== byte)) {
    fail(path, "must have a valid PNG signature and minimum structure");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = signature.length;
  let ihdrCount = 0;
  let idatCount = 0;
  let iendCount = 0;
  let width = 0;
  let height = 0;
  let bytesPerPixel = 0;
  const idatParts = [];
  let phase = "header";
  while (offset < bytes.byteLength) {
    if (offset + 12 > bytes.byteLength) fail(path, "contains a truncated PNG chunk");
    const length = view.getUint32(offset, false);
    const chunkEnd = offset + 12 + length;
    if (!Number.isSafeInteger(chunkEnd) || chunkEnd > bytes.byteLength) {
      fail(path, "contains an out-of-bounds PNG chunk");
    }
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = new TextDecoder("ascii", { fatal: true }).decode(typeBytes);
    if (!/^[A-Za-z]{4}$/u.test(type)) fail(path, "contains an invalid PNG chunk type");
    const allowed = new Set(["IHDR", "IDAT", "IEND"]);
    if (!allowed.has(type)) fail(path, `contains prohibited PNG metadata or ancillary chunk ${type}`);
    const expectedCrc = view.getUint32(offset + 8 + length, false);
    const actualCrc = crc32(bytes.subarray(offset + 4, offset + 8 + length));
    if (expectedCrc !== actualCrc) fail(path, `contains an invalid ${type} CRC`);

    if (type === "IHDR") {
      ihdrCount += 1;
      if (phase !== "header" || ihdrCount !== 1 || length !== 13) fail(path, "contains an invalid IHDR sequence");
      width = view.getUint32(offset + 8, false);
      height = view.getUint32(offset + 12, false);
      const bitDepth = bytes[offset + 16];
      const colorType = bytes[offset + 17];
      const compression = bytes[offset + 18];
      const filter = bytes[offset + 19];
      const interlace = bytes[offset + 20];
      if (width < 640 || width > 8_192 || height < 480 || height > 8_192
        || bitDepth !== 8 || ![2, 6].includes(colorType)
        || compression !== 0 || filter !== 0 || interlace !== 0) {
        fail(path, "must be a bounded, non-interlaced, 8-bit RGB or RGBA raster");
      }
      bytesPerPixel = colorType === 2 ? 3 : 4;
      phase = "image";
    } else if (type === "IDAT") {
      if (phase !== "image" || length === 0) fail(path, "contains an invalid IDAT sequence");
      idatCount += 1;
      idatParts.push(bytes.subarray(offset + 8, offset + 8 + length));
    } else {
      if (phase !== "image" || length !== 0 || idatCount < 1) fail(path, "contains an invalid IEND sequence");
      iendCount += 1;
      phase = "ended";
      if (chunkEnd !== bytes.byteLength) fail(path, "contains trailing data after IEND");
    }
    offset = chunkEnd;
  }
  if (ihdrCount !== 1 || idatCount < 1 || iendCount !== 1 || phase !== "ended") {
    fail(path, "does not contain one complete flattened PNG image");
  }
  const inflatedByteCount = height * (1 + width * bytesPerPixel);
  if (!Number.isSafeInteger(inflatedByteCount) || inflatedByteCount > 67_108_864) {
    fail(path, "expands beyond the sanitized raster memory boundary");
  }
  let raster;
  try {
    raster = inflateSync(Buffer.concat(idatParts), { maxOutputLength: inflatedByteCount });
  } catch {
    fail(path, "contains an invalid or oversized compressed raster");
  }
  if (raster.byteLength !== inflatedByteCount) fail(path, "contains an incomplete raster");
  const rowByteCount = 1 + width * bytesPerPixel;
  for (let row = 0; row < height; row += 1) {
    if (raster[row * rowByteCount] > 4) fail(path, "contains an invalid PNG row filter");
  }
  return Object.freeze({ width, height });
}

async function readRegularFileNoFollow(pathname, maximumBytes, label) {
  let handle;
  try {
    handle = await open(pathname, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  } catch (error) {
    throw new Error(`${label} could not be opened without following symbolic links: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) throw new Error(`${label} must be one regular file.`);
    if (before.size < 2n || before.size > BigInt(maximumBytes)) {
      throw new Error(`${label} must be 2 through ${maximumBytes} bytes.`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (BigInt(bytes.byteLength) !== before.size
      || after.size !== before.size
      || after.mtimeNs !== before.mtimeNs
      || after.ino !== before.ino
      || after.dev !== before.dev) {
      throw new Error(`${label} changed while it was being read.`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

function deploymentIndexIdentity(index) {
  return Object.freeze({
    deployed_commit: index.workflow.commit,
    workflow_run_id: index.workflow.runId,
    workflow_run_attempt: index.workflow.runAttempt,
    workflow_run_url: index.workflow.runUrl,
    service_job_id: index.serviceJobId,
    canonical_url: index.canonicalUrl,
    api_worker_deployment_id: index.workers.api.deploymentId,
    api_worker_version: index.workers.api.versionId,
    response_policy_worker_deployment_id: index.workers.responsePolicy.deploymentId,
    response_policy_worker_version: index.workers.responsePolicy.versionId,
    site_artifact_sha256: index.siteArtifactSha256,
    qualified_source_set_sha256: index.qualifiedSourceSetSha256,
    deployed_at: index.deployedAt,
    qualification_expires_at: index.qualificationExpiresAt,
  });
}

async function verifyDeploymentIndexCustody(evidencePath, deployment) {
  const directory = dirname(evidencePath);
  const beforePath = resolve(directory, DEPLOYMENT_EVIDENCE_BEFORE_BASENAME);
  const afterPath = resolve(directory, DEPLOYMENT_EVIDENCE_AFTER_BASENAME);
  const [beforeBytes, afterBytes] = await Promise.all([
    readRegularFileNoFollow(
      beforePath,
      DEPLOYMENT_INDEX_FILE_BYTE_LIMIT,
      "The pre-capture deployment evidence index",
    ),
    readRegularFileNoFollow(
      afterPath,
      DEPLOYMENT_INDEX_FILE_BYTE_LIMIT,
      "The post-capture deployment evidence index",
    ),
  ]);
  const beforeSha256 = browserEvidenceSha256(beforeBytes);
  const afterSha256 = browserEvidenceSha256(afterBytes);
  if (beforeBytes.byteLength !== afterBytes.byteLength || !beforeBytes.equals(afterBytes)
    || beforeSha256 !== afterSha256) {
    throw new Error("The pre-capture and post-capture deployment evidence indexes must be byte-identical and have identical SHA-256 digests.");
  }
  for (const [field, digest] of [
    ["deployment_evidence_index_sha256", beforeSha256],
    ["deployment_evidence_before_captures_sha256", beforeSha256],
    ["deployment_evidence_after_captures_sha256", afterSha256],
  ]) {
    if (deployment[field] !== digest) {
      fail(`$.deployment.${field}`, "does not match the retained deployment evidence index bytes");
    }
  }

  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(beforeBytes);
  } catch {
    throw new Error("The deployment evidence index must be valid UTF-8.");
  }
  let index;
  try {
    index = parseTextToLatticeDeploymentEvidenceIndexText(source);
  } catch (error) {
    throw new Error(`The retained deployment evidence index is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }
  for (const [field, expected] of Object.entries(deploymentIndexIdentity(index))) {
    if (deployment[field] !== expected) {
      fail(`$.deployment.${field}`, "does not match the retained deployment evidence index");
    }
  }
  return Object.freeze({ index, indexSha256: beforeSha256 });
}

/** Verify the canonical JSON and the two fixed sibling sanitized PNG captures. */
export async function verifyBrowserEvidenceBundle(pathname) {
  const evidencePath = resolve(pathname);
  const bytes = await readRegularFileNoFollow(evidencePath, EVIDENCE_FILE_BYTE_LIMIT, "The browser evidence file");
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("The browser evidence file must be valid UTF-8.");
  }
  const evidence = parseBrowserEvidenceText(source);
  const deploymentIndex = await verifyDeploymentIndexCustody(
    evidencePath,
    evidence.deployment,
  );
  for (const [index, engine] of evidence.engines.entries()) {
    const capturePath = resolve(dirname(evidencePath), engine.sanitized_capture.basename);
    const captureBytes = await readRegularFileNoFollow(
      capturePath,
      CAPTURE_FILE_BYTE_LIMIT,
      `The ${engine.engine_id} sanitized capture`,
    );
    if (captureBytes.byteLength !== engine.sanitized_capture.byte_count) {
      fail(`$.engines[${index}].sanitized_capture.byte_count`, "does not match the retained PNG bytes");
    }
    if (browserEvidenceSha256(captureBytes) !== engine.sanitized_capture.sha256) {
      fail(`$.engines[${index}].sanitized_capture.sha256`, "does not match the retained PNG bytes");
    }
    const dimensions = verifySanitizedPngBytes(captureBytes, `$.engines[${index}].sanitized_capture`);
    if (dimensions.width !== engine.sanitized_capture.pixel_width
      || dimensions.height !== engine.sanitized_capture.pixel_height) {
      fail(`$.engines[${index}].sanitized_capture`, "pixel dimensions do not match the retained PNG bytes");
    }
  }
  return Object.freeze({
    evidence,
    sha256: browserEvidenceSha256(bytes),
    byteCount: bytes.byteLength,
    deploymentIndexSha256: deploymentIndex.indexSha256,
    pagesArtifactId: deploymentIndex.index.pagesArtifactId,
    qualifiedSourceSetSha256: deploymentIndex.index.qualifiedSourceSetSha256,
  });
}

async function main() {
  if (process.argv.length !== 3) {
    throw new Error("Usage: node scripts/verify-text-to-lattice-browser-evidence.mjs <sanitized-evidence.json>");
  }
  const {
    evidence,
    sha256,
    byteCount,
    deploymentIndexSha256,
    pagesArtifactId,
    qualifiedSourceSetSha256,
  } = await verifyBrowserEvidenceBundle(process.argv[2]);
  const engines = evidence.engines.map(({ browser_name: browser, engine_name: engine }) => `${browser}/${engine}`).join(", ");
  const { deployment } = evidence;
  const captures = evidence.engines.map(({ engine_id: engineId, sanitized_capture: capture }) => (
    `${engineId}:${capture.byte_count}:${capture.sha256}`
  )).join(",");
  process.stdout.write([
    "Text to Lattice browser evidence verified.",
    `deployed_commit=${deployment.deployed_commit}`,
    `workflow_run=${deployment.workflow_run_id}`,
    `workflow_attempt=${deployment.workflow_run_attempt}`,
    `service_job=${deployment.service_job_id}`,
    `api_worker=${deployment.api_worker_deployment_id}@${deployment.api_worker_version}`,
    `response_policy_worker=${deployment.response_policy_worker_deployment_id}@${deployment.response_policy_worker_version}`,
    `deployment_index=${deploymentIndexSha256}`,
    `qualified_source_set=${qualifiedSourceSetSha256}`,
    `pages_artifact=${pagesArtifactId}:${deployment.site_artifact_sha256}`,
    `engines=${engines}`,
    `captures=${captures}`,
    `evidence_bytes=${byteCount}`,
    `evidence_sha256=${sha256}`,
  ].join(" ") + "\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
