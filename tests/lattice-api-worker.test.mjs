import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getLatticeVerificationPriorRejection, preflightLatticeInput, runTextToLattice } from "../app/resume/latticeDemo.js";
import {
  LATTICE_RESULT_VERSION,
  LATTICE_VISITOR_SESSION_ACCEPT,
  isLatticeApiError,
} from "../app/resume/lattice/remoteProtocol.js";
import {
  DOCUMENT_CERTIFICATION_SCHEMA,
  LATTICE_ANALYSIS_DIAGNOSTIC_CONTEXT,
  LATTICE_CONFORMANCE_CRITERIA,
  LATTICE_FITTED_ANALYSIS_CONTEXT,
  LATTICE_STAGE_DIAGNOSTIC_CONTEXT,
  REANALYSIS_SCHEMA,
  VERIFICATION_SCHEMA,
  analysisMessages,
  candidateMessages,
  documentCertificationMessages,
  repairMessages,
  verificationMessages,
} from "../app/resume/lattice/promptContract.js";
import { isClosedPriorVerificationRejection, getLatticeAnalysisRetentionDowngrade } from "../app/resume/lattice/qualificationDiagnostics.js";
import { getLatticeAnalysisPassageRetentionDowngrade } from "../app/resume/lattice/analysisProvenance.js";
import { hasInvalidLatticeBidiIsolates } from "../app/resume/lattice/inputPolicy.js";
import { deterministicBatchReview } from "../app/resume/lattice/validators.js";
import {
  LATTICE_REJECTION_CATEGORIES,
  rejectedErrorDiagnostic,
  rejectedResultDiagnostic,
  rememberRejectedError,
  rememberRejectedResult,
  rememberStageCorrectionRequest,
} from "../app/resume/lattice/rejectionDiagnostics.js";
import {
  latticeSourceSpansForBatch,
  splitLatticePassage,
} from "../app/resume/lattice/segments.js";
import {
  HUGGING_FACE_CHAT_COMPLETIONS_URL,
  LATTICE_CERTIFICATION_WIRE_CHARACTER_LIMIT,
  LATTICE_PROVIDER_CALL_TIMEOUT_MS,
  LATTICE_PROVIDER_CALL_LIMIT,
  LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT,
  LATTICE_PROVIDER_FAILURE_CLASSES,
  LATTICE_PROVIDER_MAX_CALL_TIMEOUT_MS,
  LATTICE_PROVIDER_MAX_OUTPUT_TOKENS_PER_ADMITTED_REQUEST,
  LATTICE_PROVIDER_MAX_OUTPUT_TOKENS_PER_CALL,
  LATTICE_PROVIDER_OUTPUT_TOKEN_LIMITS,
  LATTICE_PROVIDER_REQUEST_BYTE_LIMIT,
  LATTICE_REMOTE_MODELS,
  LATTICE_PROVIDER_STAGE_CALL_TIMEOUTS_MS,
  LATTICE_PROVIDER_STAGES,
  LatticeProviderError,
  createHuggingFaceLatticeAdapter,
  isClosedProviderHttpHeaders,
  isClosedProviderEnvelopeShape,
  isClosedProviderStrictMessageShape,
  getLatticeProviderStrictMessageShape,
  getLatticeQualificationUsage,
  LATTICE_PROVIDER_ENVELOPE_SHAPE_FIELDS,
  LATTICE_PROVIDER_STRICT_MESSAGE_SHAPE_FIELDS,
  requestHuggingFaceJson,
} from "../workers/text-to-lattice-api/huggingFaceAdapter.js";
import {
  LATTICE_TRANSFORMATION_CAPACITY_INTERNAL_URL,
  LATTICE_TRANSFORMATION_CAPACITY_OBJECT_NAME,
  LATTICE_TRANSFORMATION_VISITOR_HEADER,
  claimGlobalLatticeTransformation,
} from "../workers/text-to-lattice-api/capacityClient.js";
import {
  LATTICE_TRANSFORMATIONS_PER_UTC_DAY,
  LATTICE_TRANSFORMATIONS_PER_VISITOR_UTC_DAY,
  claimLatticeTransformation,
  latticeTransformationStateExpiresAt,
} from "../workers/text-to-lattice-api/capacityPolicy.js";
import {
  LATTICE_API_ORIGIN,
  LATTICE_API_PATH,
  LATTICE_API_RATE_LIMIT_KEY,
  LATTICE_API_REQUEST_BYTE_LIMIT,
  LATTICE_API_REQUEST_TIMEOUT_MS,
  LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER,
  LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_ADMISSION_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_PRIOR_VERIFICATION_REJECTION_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_HTTP_DIAGNOSTIC_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_ENVELOPE_SHAPE_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_STRICT_MESSAGE_SHAPE_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_TERMINAL_ANALYSIS_DIAGNOSTIC_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_WITHHELD_DIAGNOSTIC_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_PIPELINE_DIAGNOSTIC_RESPONSE_HEADERS,
  LATTICE_QUALIFICATION_EXPIRES_AT_BINDING,
  createLatticeApiWorker as createProductionLatticeApiWorker,
  qualificationWindowAllowsRequests,
} from "../workers/text-to-lattice-api/worker.js";
import {
  LATTICE_PRODUCTION_CANARY_REQUEST,
  LATTICE_PRODUCTION_CANARY_TEXT,
} from "../scripts/text-to-lattice-production-canary.mjs";
import {
  LATTICE_API_VISITOR_COOKIE_NAME,
  LATTICE_API_VISITOR_COOKIE_PATH,
  LatticeApiVisitorCookieError,
  establishLatticeApiVisitor,
  latticeApiVisitorCookieMaxAge,
  resolveLatticeApiVisitor,
  withLatticeApiVisitorCookie,
} from "../workers/text-to-lattice-api/visitorCookie.js";

const validPayload = Object.freeze({
  text: "Open the document, review it, and save the approved revision.",
  requested_mode: "operative",
  schema_version: 1,
});
const TEST_VISITOR_ID = "A".repeat(24);
const TEST_VISITOR_COOKIE_VALUE = `v1.${TEST_VISITOR_ID}.${"B".repeat(43)}`;
const TEST_VISITOR_SECRET = "test-only-independent-api-visitor-secret-value";
const ANALYSIS_TOOL_NAME = "lattice_analysis_wire_v2";
const VERIFICATION_TOOL_NAME = "lattice_verification_wire_v2";
const CERTIFICATION_TOOL_NAME = "lattice_certification_wire_v2";
const EXPECTED_ISSUE_CHECK_BINDINGS = [
  [0, "languageSupported", 0, null], [1, "safety", 1, 1],
  [2, "semanticFidelity", 2, 0], [3, "sourceCoverage", 3, null],
  [4, "atomCoverage", 4, null], [5, "accessibility", 5, 2],
  [6, "clarity", 6, 3], [7, "domainCorrectness", 7, 4],
  [8, "registerFit", 8, 5], [9, "ornament", 9, null],
  [10, "documentConsistency", 10, null], [11, "planFit", null, 6],
  [12, "materiality", null, 7], [13, "boundaryFidelity", null, 8],
].map(([index, check, gatePosition, passageCheckPosition]) => ({
  index, check, gatePosition, passageCheckPosition,
}));
const allowTransformation = async () => Object.freeze({
  allowed: true,
  retryAfterSeconds: null,
});
const resolveTestVisitor = async () => Object.freeze({
  visitorId: TEST_VISITOR_ID,
  cookieValue: TEST_VISITOR_COOKIE_VALUE,
});

function analysisRequestWithDiagnostic(
  origin = "initial",
  attempt = 1,
  priorValidationCategory = "none",
) {
  const request = { ...minimalAnalysisRequest() };
  Object.defineProperty(request, LATTICE_ANALYSIS_DIAGNOSTIC_CONTEXT, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({ origin, attempt, priorValidationCategory }),
  });
  Object.defineProperty(request, LATTICE_STAGE_DIAGNOSTIC_CONTEXT, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      attempt: attempt === 1 ? "initial" : "correction",
      priorValidationCategory,
    }),
  });
  return Object.freeze(request);
}

function capacityVisitor(index) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  return alphabet[index].repeat(24);
}

function createLatticeApiWorker(options = {}) {
  return createProductionLatticeApiWorker({
    enforceRateLimit: async () => {},
    admitTransformation: allowTransformation,
    resolveVisitor: resolveTestVisitor,
    ...options,
  });
}

function validLatticeResult(text = "Review the document, then save the approved revision.") {
  return Object.freeze({
    version: LATTICE_RESULT_VERSION,
    status: "translated",
    text,
    wordCount: text.trim().split(/\s+/u).length,
    primaryLayer: "operative",
    layerId: "operative",
    layerLabel: "Operative layer",
    layersUsed: Object.freeze(["operative"]),
    passageCount: 1,
    revisedPassageCount: 1,
    retainedPassageCount: 0,
    batchCount: 1,
    verificationPasses: 1,
    findings: Object.freeze([]),
    questions: Object.freeze([]),
  });
}

function unableLatticeResult(
  findingId = "atomization-unavailable",
  message = "The passage could not be atomized safely.",
) {
  return Object.freeze({
    ...validLatticeResult(),
    status: "unable-to-attempt",
    text: null,
    primaryLayer: null,
    layerId: null,
    layerLabel: "Undetermined",
    layersUsed: Object.freeze([]),
    revisedPassageCount: 0,
    retainedPassageCount: 0,
    batchCount: 0,
    verificationPasses: 0,
    findings: Object.freeze([
      Object.freeze({
        id: findingId,
        passageId: "p001",
        atomIds: Object.freeze([]),
        message,
      }),
    ]),
  });
}

function apiRequest(body = validPayload, {
  url = `${LATTICE_API_ORIGIN}${LATTICE_API_PATH}`,
  method = "POST",
  origin = LATTICE_API_ORIGIN,
  accept = "application/json",
  contentType = "application/json",
  headers = {},
  visitorCookie = TEST_VISITOR_COOKIE_VALUE,
  raw = false,
} = {}) {
  const requestHeaders = new Headers(headers);
  if (visitorCookie !== null && !requestHeaders.has("Cookie")) {
    requestHeaders.set("Cookie", `${LATTICE_API_VISITOR_COOKIE_NAME}=${visitorCookie}`);
  }
  if (origin !== null) requestHeaders.set("Origin", origin);
  if (accept !== null && !requestHeaders.has("Accept")) requestHeaders.set("Accept", accept);
  if (contentType !== null) requestHeaders.set("Content-Type", contentType);
  const init = { method, headers: requestHeaders };
  if (method !== "GET" && method !== "HEAD") {
    init.body = raw ? body : JSON.stringify(body);
    if (body instanceof ReadableStream) init.duplex = "half";
  }
  return new Request(url, init);
}

function visitorSessionRequest({
  headers = {},
  origin = LATTICE_API_ORIGIN,
  visitorCookie = null,
  body,
} = {}) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", LATTICE_VISITOR_SESSION_ACCEPT);
  if (origin !== null) requestHeaders.set("Origin", origin);
  if (visitorCookie !== null && !requestHeaders.has("Cookie")) {
    requestHeaders.set("Cookie", `${LATTICE_API_VISITOR_COOKIE_NAME}=${visitorCookie}`);
  }
  const init = {
    method: "POST",
    headers: requestHeaders,
  };
  if (body !== undefined) {
    init.body = body;
    if (body instanceof ReadableStream) init.duplex = "half";
  }
  return new Request(`${LATTICE_API_ORIGIN}${LATTICE_API_PATH}`, init);
}

async function json(response) {
  return JSON.parse(await response.text());
}

function successfulProviderResponse(value = { accepted: true }) {
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: "stop",
      message: { role: "assistant", content: JSON.stringify(value) },
    }],
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function providerChoiceResponse(choice) {
  return new Response(JSON.stringify({ choices: [choice] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function successfulProviderToolResponse(value = { d: "instruction", p: [], q: [] }, {
  finishReason = "tool_calls",
  toolName = ANALYSIS_TOOL_NAME,
  toolCallId = "call_lattice_analysis",
  content,
  functionCall,
} = {}) {
  return providerChoiceResponse({
    finish_reason: finishReason,
    message: {
      role: "assistant",
      ...(content === undefined ? {} : { content }),
      ...(functionCall === undefined ? {} : { function_call: functionCall }),
      tool_calls: [{
        id: toolCallId,
        type: "function",
        function: {
          name: toolName,
          arguments: JSON.stringify(value),
        },
      }],
    },
  });
}

function providerToolCall({
  id = "call_lattice_analysis",
  type = "function",
  name = ANALYSIS_TOOL_NAME,
  argumentsValue = JSON.stringify({ accepted: true }),
} = {}) {
  return {
    id,
    type,
    function: { name, arguments: argumentsValue },
  };
}

function fittedStringLength(schema) {
  const explicitLength = schema.maxLength ?? schema.minLength;
  if (Number.isSafeInteger(explicitLength) && explicitLength >= 0) return explicitLength;
  const fixed = typeof schema.pattern === "string" ? /^\^\[01(?:2)?\]\{([1-9]\d*)\}\$$/u.exec(schema.pattern) : null;
  if (fixed) return Number(fixed[1]);
  if (schema.pattern?.startsWith("^(?:0{0}1[01]{")) {
    const branches = schema.pattern.slice(4, -2).split("|");
    const width = branches.length;
    for (const [index, branch] of branches.entries()) {
      assert.equal(branch, `0{${index}}1[01]{${width - index - 1}}`);
    }
    return width;
  }
  return 1;
}

function maximalJsonSchemaValue(schema, stringValue = (length) => "x".repeat(length)) {
  if (Object.hasOwn(schema, "const")) return schema.const;
  if (Array.isArray(schema.enum)) {
    return [...schema.enum].sort((left, right) => (
      JSON.stringify(right).length - JSON.stringify(left).length
    ))[0];
  }
  if (schema.type === "string") return stringValue(fittedStringLength(schema), schema);
  if (schema.type === "integer") return schema.maximum ?? schema.minimum ?? 0;
  if (schema.type === "array") {
    if (Array.isArray(schema.prefixItems)) {
      const prefix = schema.prefixItems.map((item) => maximalJsonSchemaValue(item, stringValue));
      const maximumLength = schema.maxItems ?? schema.minItems ?? prefix.length;
      if (maximumLength <= prefix.length || !schema.items) return prefix;
      return [
        ...prefix,
        ...Array.from(
          { length: maximumLength - prefix.length },
          () => maximalJsonSchemaValue(schema.items, stringValue),
        ),
      ];
    }
    return Array.from(
      { length: schema.maxItems ?? schema.minItems ?? 0 },
      () => maximalJsonSchemaValue(schema.items, stringValue),
    );
  }
  if (schema.type === "object") {
    return Object.fromEntries(schema.required.map((key) => (
      [key, maximalJsonSchemaValue(schema.properties[key], stringValue)]
    )));
  }
  if (schema.type === "boolean") return false;
  throw new TypeError("The test received an unsupported JSON Schema shape.");
}

function minimalAnalysisRequest(text = validPayload.text) {
  const preflight = preflightLatticeInput(text);
  return Object.freeze({
    batch: preflight.batches[0],
    documentLedger: Object.freeze([]),
    context: null,
    signal: new AbortController().signal,
  });
}

function minimalVerificationRequest(text = validPayload.text) {
  const base = minimalAnalysisRequest(text);
  const sourceSpans = latticeSourceSpansForBatch(base.batch);
  const passageId = base.batch.passages[0].id;
  const evidenceSpanIds = [
    ...sourceSpans[0].spans,
    ...(sourceSpans[0].literalAnnotations ?? []),
  ].map(({ id }) => id);
  const atom = Object.freeze({
    id: "a1",
    kind: "action",
    value: "perform the supported action",
    priority: "hard",
    preservation: "equivalent",
    evidenceSpanIds: Object.freeze(evidenceSpanIds),
    links: Object.freeze([]),
  });
  const analysis = Object.freeze({
    documentKind: "instruction",
    passages: Object.freeze([Object.freeze({
      passageId,
      discourseFunction: "directs one bounded action",
      layer: "operative",
      disposition: "rewrite",
      rationale: "make the supported action explicit",
      atoms: Object.freeze([atom]),
      ambiguityAtomIds: Object.freeze([]),
      conformanceCriteria: Object.freeze([]),
      conformanceEvidenceSpanIds: Object.freeze([]),
      conformanceAssertions: Object.freeze([]),
    })]),
    questions: Object.freeze([]),
  });
  const candidate = Object.freeze({
    passages: Object.freeze([Object.freeze({
      passageId,
      layer: "operative",
      text: "Review the document, then save the approved revision.",
      preservedAtomIds: Object.freeze([atom.id]),
    })]),
  });
  return Object.freeze({ ...base, sourceSpans, analysis, candidate });
}

function acceptingVerificationWire(request) {
  const evidenceCount = request.sourceSpans[0].spans.length
    + (request.sourceSpans[0].literalAnnotations?.length ?? 0);
  const evidenceMask = "1".repeat(evidenceCount);
  const plan = request.analysis.passages[0];
  const atomCount = plan.atoms.length;
  const retained = plan.disposition === "retain-if-conformant";
  return Object.freeze({
    d: 0,
    g: "0".repeat(11),
    p: Object.freeze({
      0: Object.freeze({
        a: "1".repeat(atomCount),
        u: false,
        s: "0".repeat(evidenceCount),
        f: "0".repeat(9),
        l: 0,
        x: "1".repeat(atomCount),
        y: evidenceMask,
        c: Object.freeze({
          v: retained,
          s: retained ? evidenceMask : "0".repeat(evidenceCount),
          k: Object.freeze(retained
            ? plan.conformanceCriteria.map(() => Object.freeze({ v: true, s: evidenceMask }))
            : []),
        }),
      }),
    }),
    i: Object.freeze([]),
  });
}

function acceptingCertificationWire(certificateId, obligationIds) {
  return Object.freeze({
    c: certificateId,
    o: Object.freeze([...obligationIds]),
    d: 0,
    k: Object.freeze(Array.from({ length: 10 }, () => true)),
    i: Object.freeze([]),
  });
}

function canaryAnalysisWire(body, { retain = false } = {}) {
  const payload = inertModelPayload(body);
  assert.equal(payload.requestedMode, "operative");
  assert.equal(Object.hasOwn(payload, "clarificationAnswers"), false);
  assert.match(body.messages[0].content, /never ask a public question/u);
  assert.equal(payload.passages.length, 1);
  const evidenceIds = [
    ...payload.passages[0][1],
    ...payload.passages[0][2],
  ].map(([id]) => id);
  const conformanceMasks = retain
    ? ["100", "010", "001", "111", "101"]
    : Array(5).fill("0".repeat(evidenceIds.length));
  if (retain) assert.equal(evidenceIds.length, 3);
  return {
    d: 2,
    p: [[
      0,
      retain ? 1 : 0,
      [[1, 0, 1, evidenceIds.map((_id, index) => index)]],
      conformanceMasks,
    ]],
    l: [],
  };
}

function canaryCandidateFromProviderBody(body, text) {
  const payload = inertModelPayload(body);
  const [analysisPassage] = payload.analysis[1];
  return {
    passages: [{
      passageId: analysisPassage[0],
      layer: "operative",
      text,
      preservedAtomIds: analysisPassage[5].map(([atomId]) => atomId),
    }],
  };
}

function canaryVerificationWire(body, { retain = false } = {}) {
  const payload = inertModelPayload(body);
  const atomCount = payload.analysisClaims[1][0][5].length;
  const evidenceCount = payload.sourcePassages[0][1].length
    + payload.sourcePassages[0][2].length;
  const evidenceMask = "1".repeat(evidenceCount);
  const conformance = retain
    ? {
      v: true,
      s: evidenceMask,
      k: payload.analysisClaims[1][0][7].map(() => ({ v: true, s: evidenceMask })),
    }
    : { v: false, s: "0".repeat(evidenceCount), k: [] };
  return {
    d: 0,
    g: "0".repeat(11),
    p: {
      0: {
        a: "1".repeat(atomCount),
        u: false,
        s: "0".repeat(evidenceCount),
        f: "0".repeat(9),
        l: 0,
        x: "1".repeat(atomCount),
        y: evidenceMask,
        c: conformance,
      },
    },
    i: [],
  };
}

function forcedToolSchema(body, expectedName) {
  assert.equal(Object.hasOwn(body, "response_format"), false);
  assert.equal(Object.hasOwn(body, "parallel_tool_calls"), false);
  assert.deepEqual(body.tool_choice, {
    type: "function",
    function: { name: expectedName },
  });
  assert.equal(body.tools.length, 1);
  assert.equal(body.tools[0].type, "function");
  assert.equal(body.tools[0].function.name, expectedName);
  assert.equal(Object.hasOwn(body.tools[0].function, "strict"), false);
  return body.tools[0].function.parameters;
}

function isAnalysisBody(body) {
  return body.model === LATTICE_REMOTE_MODELS.generator
    && body.response_format?.type === "json_schema"
    && body.response_format.json_schema.name === ANALYSIS_TOOL_NAME;
}

function isCandidateBody(body) {
  return body.model === LATTICE_REMOTE_MODELS.generator
    && body.response_format?.type === "json_object";
}

const TEST_REVIEW_URL = "https://router.huggingface.co/v1/chat/completions";
const TEST_REVIEW_MODEL = "meta-llama/Llama-3.1-8B-Instruct:nscale";

function isVerificationBody(body) {
  return body.model === TEST_REVIEW_MODEL
    && body.response_format?.type === "json_schema"
    && body.response_format.json_schema.name === VERIFICATION_TOOL_NAME;
}

function strictReviewSchema(body, expectedName) {
  assert.equal(body.model, TEST_REVIEW_MODEL);
  assert.equal(body.response_format.type, "json_schema");
  assert.equal(body.response_format.json_schema.name, expectedName);
  assert.equal(body.response_format.json_schema.strict, true);
  for (const key of ["tools", "tool_choice", "parallel_tool_calls"]) {
    assert.equal(Object.hasOwn(body, key), false);
  }
  assert.doesNotMatch(body.messages.map(({ content }) => content).join("\n"), /LATTICE_RESPONSE_SCHEMA/u);
  return body.response_format.json_schema.schema;
}

function fittedVerificationSchemaForBody(body) {
  assert.equal(isVerificationBody(body), true);
  const schema = strictReviewSchema(body, VERIFICATION_TOOL_NAME);
  assert.deepEqual(schema.required, ["d", "g", "p", "i"]);
  assert.equal(schema.additionalProperties, false);
  return schema;
}

test("Nscale review schema projection preserves exhaustive legal binary masks without mutating fitted constraints", async () => {
  for (const width of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const mask = (requireSelection) => ({ type: "string", minLength: width, maxLength: width,
      pattern: requireSelection ? "^[01]*1[01]*$" : `^[01]{${width}}$` });
    const schema = { type: "object", additionalProperties: false,
      properties: { g: mask(false), x: mask(true), y: mask(true) }, required: ["g", "x", "y"] };
    const before = structuredClone(schema);
    let captured;
    await requestHuggingFaceJson(providerRequestOptions(async (_url, init) => {
      captured = JSON.parse(init.body);
      return successfulProviderResponse({ g: "0".repeat(width), x: "1".repeat(width), y: "1".repeat(width) });
    }, { role: "verifier", schemaName: VERIFICATION_TOOL_NAME, schema,
      responseFormat: "json_schema", requireMinimalVerificationContent: true }));
    assert.deepEqual(schema, before, "projection must not alter fitted internal constraints");
    const projected = strictReviewSchema(captured, VERIFICATION_TOOL_NAME);
    for (const [field, requireSelection] of [["g", false], ["x", true], ["y", true]]) {
      assert.equal(Object.hasOwn(projected.properties[field], "minLength"), false);
      assert.equal(Object.hasOwn(projected.properties[field], "maxLength"), false);
      const pattern = new RegExp(projected.properties[field].pattern, "u");
      for (let length = 0; length <= width + 1; length += 1) {
        for (let value = 0; value < 2 ** length; value += 1) {
          const bits = length === 0 ? "" : value.toString(2).padStart(length, "0");
          assert.equal(pattern.test(bits), length === width && (!requireSelection || bits.includes("1")),
            `${field}: width ${width}, ${bits}`);
        }
      }
      assert.equal(pattern.test("2".repeat(width)), false);
    }
  }
});

test("projected strict schemas retain decoder rejection of nonbinary and wrong-width review masks", async () => {
  const request = minimalVerificationRequest();
  for (const [field, suffix, rule] of [["g", "\n", "V06L"], ["x", "\n", "V16L"], ["y", "\n", "V17L"],
    ["x", "2", "V16A"], ["y", "2", "V17A"]]) {
    const wire = structuredClone(acceptingVerificationWire(request));
    const target = field === "g" ? wire : wire.p["0"];
    target[field] = suffix === "2" ? "2".repeat(target[field].length) : target[field] + suffix;
    const adapter = createHuggingFaceLatticeAdapter({ token: "test-only", fetchImpl: async (_url, init) => {
      fittedVerificationSchemaForBody(JSON.parse(init.body));
      return successfulProviderResponse(wire);
    } });
    const result = await adapter.verify(request);
    assert.deepEqual(result, {});
    assert.equal(rejectedResultDiagnostic(result).rule, rule);
    assert.equal(adapter.completionCapacity().used, 1);
  }
});

test("Nscale review stages use closed strict-schema content on the fixed unified route", async (context) => {
  for (const [method, request, name, wire, limit] of [
    ["verify", minimalVerificationRequest(), VERIFICATION_TOOL_NAME, acceptingVerificationWire(minimalVerificationRequest()), 2_048],
    ["certify", minimalCertificationRequest(), CERTIFICATION_TOOL_NAME,
      acceptingCertificationWire("certificate:envelope-test", ["document:whole"]), 520],
  ]) for (const corrected of [false, true]) await context.test(`${method}: ${corrected ? "correction" : "initial"}`, async () => {
    let calls = 0;
    const adapter = createHuggingFaceLatticeAdapter({ token: "server-token", fetchImpl: async (url, init) => {
      calls += 1;
      const body = JSON.parse(init.body);
      assert.equal(url, HUGGING_FACE_CHAT_COMPLETIONS_URL);
      assert.equal(body.model, "meta-llama/Llama-3.1-8B-Instruct:nscale");
      assert.equal(body.response_format.type, "json_schema");
      assert.equal(body.response_format.json_schema.name, name);
      assert.equal(body.response_format.json_schema.strict, true);
      assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
      assert.equal(body.max_tokens, limit);
      for (const field of ["tools", "tool_choice", "parallel_tool_calls"]) assert.equal(Object.hasOwn(body, field), false);
      assert.doesNotMatch(JSON.stringify(body), /deepinfra|Meta-Llama-3.1|LATTICE_RESPONSE_SCHEMA/u);
      return successfulProviderResponse(wire);
    } });
    await adapter[method]({ ...request, ...(corrected ? { protocolFeedback: {
      stage: method === "verify" ? "verification" : "certification", attempt: 2, category: "response-shape",
      issue: "PRIVATE-CORRECTION", instruction: "PRIVATE-CORRECTION",
    } } : {}) });
    assert.equal(calls, 1);
  });
});

test("production verifier uses its fixed Nscale route and fitted strict schema on initial and correction calls", async (t) => {
  for (const corrected of [false, true]) {
    await t.test(corrected ? "correction" : "initial", async () => {
      const calls = [];
      const request = {
        ...minimalVerificationRequest(),
        ...(corrected ? { protocolFeedback: {
          stage: "verification", attempt: 2, category: "response-shape",
          issue: "PRIVATE-VERIFIER-FEEDBACK", instruction: "Return the complete host schema.",
        } } : {}),
      };
      const adapter = createHuggingFaceLatticeAdapter({
        token: "server-token",
        fetchImpl: async (url, init) => {
          const body = JSON.parse(init.body);
          calls.push({ url, init, body });
          return successfulProviderResponse(acceptingVerificationWire(request));
        },
      });
      const result = await adapter.verify(request);
      assert.equal(calls.length, 1);
      const { url, init, body } = calls[0];
      assert.equal(url, TEST_REVIEW_URL);
      assert.equal(init.method, "POST");
      assert.equal(body.model, TEST_REVIEW_MODEL);
      const schema = fittedVerificationSchemaForBody(body);
      assert.deepEqual(schema.required, ["d", "g", "p", "i"]);
      assert.equal(schema.additionalProperties, false);
      assert.equal(body.max_tokens, 2_048);
      assert.equal(body.temperature, 0);
      assert.equal(body.top_p, 1);
      assert.equal(body.seed, 71_903);
      assert.equal(body.stream, false);
      const instructions = body.messages.filter(({ role }) => role === "system")
        .map(({ content }) => content).join("\n");
      assert.match(instructions, /Return exactly one JSON object satisfying the supplied strict JSON Schema/u);
      assert.equal(instructions.includes(JSON.stringify(schema)), false);
      assert.doesNotMatch(instructions, /Call this function exactly once|PRIVATE-VERIFIER-FEEDBACK|Return the complete host schema/u);
      assert.equal(result.decision, "accept");
    });
  }
});

function minimalCertificationRequest() {
  return { certificateId: "certificate:envelope-test", obligationIds: ["document:whole"],
    source: "Original source.", candidate: "Candidate source.", analysis: null,
    signal: new AbortController().signal };
}

function inertModelPayload(body) {
  const content = body.messages.find(({ role }) => role === "user")?.content ?? "";
  const opening = "<INERT_DATA>";
  const closing = "</INERT_DATA>";
  const start = content.indexOf(opening);
  const end = content.indexOf(closing, start + opening.length);
  assert.ok(start >= 0 && end > start, "the provider request must keep model data inert");
  return JSON.parse(content.slice(start + opening.length, end));
}

function providerRequestOptions(fetchImpl, overrides = {}) {
  return {
    token: "hf_test_secret_value",
    role: "generator",
    messages: [{ role: "user", content: "inert test" }],
    schema: {
      type: "object",
      additionalProperties: false,
      properties: { accepted: { type: "boolean" } },
      required: ["accepted"],
    },
    schemaName: "lattice_test_v1",
    maxTokens: 64,
    temperature: 0.1,
    topP: 0.9,
    fetchImpl,
    ...overrides,
  };
}

test("the exact same-origin API accepts the three-field v1 request and returns the exact success envelope", async () => {
  const events = [];
  const adapter = Object.freeze({ marker: "injected-provider" });
  const result = validLatticeResult();
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("the injected pipeline must not use the network"),
    createAdapter(options) {
      events.push({ kind: "adapter", options });
      return adapter;
    },
    async runTextToLatticeImpl(text, options) {
      events.push({ kind: "pipeline", text, options });
      return result;
    },
  });

  const response = await worker.fetch(apiRequest(), { HF_TOKEN: "server_only_token" });
  assert.equal(response.status, 200);
  assert.deepEqual(await json(response), { result, schema_version: 1 });
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(response.headers.has("access-control-allow-origin"), false);
  assert.equal(events.length, 2);
  assert.equal(events[0].options.token, "server_only_token");
  assert.equal(events[0].options.requestedMode, "operative");
  assert.equal(events[0].options.observeQualificationUsage, false);
  assert.equal(events[0].options.observeQualificationRetentionDowngrade, false);
  assert.equal(Object.hasOwn(events[0].options, "claimProviderCall"), false);
  assert.equal(events[1].text, validPayload.text);
  assert.equal(events[1].options.adapter, adapter);
  assert.equal(events[1].options.requestedMode, "operative");
  assert.equal(events[1].options.allowClarification, false);
  assert.deepEqual(events[1].options.clarificationAnswers, []);
});

test("path, query, method, origin, and media type are rejected before conversion", async () => {
  let executions = 0;
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("rejected requests must not use the network"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => {
      executions += 1;
      return { status: "translated" };
    },
  });
  const cases = [
    [apiRequest(validPayload, { url: "https://hah.dev/api/lattice/" }), 404, null],
    [apiRequest(validPayload, { url: "https://hah.dev/api/lattice?debug=1" }), 404, null],
    [apiRequest(validPayload, { url: "https://www.hah.dev/api/lattice", origin: "https://www.hah.dev" }), 404, null],
    [apiRequest(validPayload, { method: "GET" }), 405, "POST"],
    [apiRequest(validPayload, { origin: null }), 403, null],
    [apiRequest(validPayload, { origin: "https://attacker.invalid" }), 403, null],
    [apiRequest("{", { accept: null, raw: true }), 400, null],
    [apiRequest("{", { accept: "*/*", raw: true }), 400, null],
    [apiRequest("{", { accept: "application/json, text/plain", raw: true }), 400, null],
    [apiRequest(validPayload, { contentType: "text/plain" }), 415, null],
    [apiRequest(validPayload, { contentType: "application/problem+json" }), 415, null],
  ];

  for (const [request, expectedStatus, allow] of cases) {
    const response = await worker.fetch(request, { HF_TOKEN: "unused" });
    assert.equal(response.status, expectedStatus);
    assert.deepEqual(await json(response), {
      error: expectedStatus === 415 ? "unsupported_media_type" : "invalid_request",
    });
    assert.equal(response.headers.get("allow"), allow);
    assert.equal(response.headers.has("access-control-allow-origin"), false);
  }
  assert.equal(executions, 0);
});

test("the qualification API fails closed at its absolute evidence expiry", async () => {
  const expiresAt = "2026-09-14T17:30:00.000Z";
  const expiryMilliseconds = new Date(expiresAt).valueOf();
  assert.equal(qualificationWindowAllowsRequests(undefined, expiryMilliseconds), true);
  assert.equal(qualificationWindowAllowsRequests(expiresAt, expiryMilliseconds - 1), true);
  assert.equal(qualificationWindowAllowsRequests(expiresAt, expiryMilliseconds), false);
  assert.equal(qualificationWindowAllowsRequests("malformed", expiryMilliseconds - 1), false);
  assert.equal(
    qualificationWindowAllowsRequests("2026-02-31T17:30:00.000Z", expiryMilliseconds - 1),
    false,
  );

  let downstreamCalls = 0;
  const worker = createProductionLatticeApiWorker({
    now: () => expiryMilliseconds,
    enforceRateLimit: async () => { downstreamCalls += 1; },
    admitTransformation: async () => { downstreamCalls += 1; },
    resolveVisitor: async () => { downstreamCalls += 1; },
    createAdapter: () => { downstreamCalls += 1; },
    runTextToLatticeImpl: async () => { downstreamCalls += 1; },
  });
  const response = await worker.fetch(apiRequest(), {
    HF_TOKEN: "server_only_token",
    [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: expiresAt,
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await json(response), { error: "upstream_unavailable" });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(response.headers.has("access-control-allow-origin"), false);
  assert.equal(downstreamCalls, 0);
});

test("an admitted stalled pipeline is cut off at qualification expiry without output or cookie leakage", async () => {
  const requestStartedAt = Date.UTC(2026, 8, 14, 17, 29, 58, 750);
  const expiresAt = new Date(requestStartedAt + 1_250).toISOString();
  const lateResult = validLatticeResult("This late result must never reach the caller.");
  let bindingReads = 0;
  let nowCalls = 0;
  let admissions = 0;
  let pipelineSignal;
  let startPipeline;
  let finishPipeline;
  let scheduledDeadline;
  const pipelineStarted = new Promise((resolve) => { startPipeline = resolve; });
  const latePipeline = new Promise((resolve) => { finishPipeline = resolve; });
  const env = { HF_TOKEN: "server_only_token" };
  Object.defineProperty(env, LATTICE_QUALIFICATION_EXPIRES_AT_BINDING, {
    enumerable: true,
    get() {
      bindingReads += 1;
      return expiresAt;
    },
  });

  const worker = createLatticeApiWorker({
    now() {
      nowCalls += 1;
      return requestStartedAt;
    },
    requestTimeoutMs: 9_000,
    scheduleTimeout(callback, milliseconds) {
      assert.equal(scheduledDeadline, undefined);
      scheduledDeadline = { callback, milliseconds, canceled: false };
      return scheduledDeadline;
    },
    cancelTimeout(deadline) {
      assert.equal(deadline, scheduledDeadline);
      deadline.canceled = true;
    },
    admitTransformation: async () => {
      admissions += 1;
      return { allowed: true, retryAfterSeconds: null };
    },
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async (_text, { signal }) => {
      pipelineSignal = signal;
      startPipeline();
      return latePipeline;
    },
  });

  const pendingResponse = worker.fetch(apiRequest(), env);
  await pipelineStarted;
  assert.equal(bindingReads, 1);
  assert.equal(nowCalls, 7);
  assert.equal(admissions, 1);
  assert.equal(scheduledDeadline.milliseconds, 1_250);
  assert.equal(pipelineSignal.aborted, false);

  scheduledDeadline.callback();
  finishPipeline(lateResult);
  const response = await pendingResponse;
  assert.equal(pipelineSignal.aborted, true);
  assert.equal(scheduledDeadline.canceled, true);
  assert.equal(admissions, 1);
  assert.equal(response.status, 503);
  assert.deepEqual(await json(response), { error: "upstream_unavailable" });
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(response.headers.has("access-control-allow-origin"), false);
});

test("visitor setup completed at the absolute cutoff cannot return a cookie before its timer callback runs", async () => {
  const requestStartedAt = Date.UTC(2026, 8, 14, 17, 29, 59, 900);
  const expiresAt = new Date(requestStartedAt + 100).toISOString();
  let wallClock = requestStartedAt;
  let bindingReads = 0;
  let nowCalls = 0;
  let startSetup;
  let finishSetup;
  let scheduledDeadline;
  const setupStarted = new Promise((resolve) => { startSetup = resolve; });
  const delayedSetup = new Promise((resolve) => { finishSetup = resolve; });
  const env = {};
  Object.defineProperty(env, LATTICE_QUALIFICATION_EXPIRES_AT_BINDING, {
    enumerable: true,
    get() {
      bindingReads += 1;
      return expiresAt;
    },
  });
  const worker = createProductionLatticeApiWorker({
    now() {
      nowCalls += 1;
      return wallClock;
    },
    scheduleTimeout(callback, milliseconds) {
      scheduledDeadline = { callback, milliseconds, canceled: false };
      return scheduledDeadline;
    },
    cancelTimeout(deadline) {
      deadline.canceled = true;
    },
    establishVisitor: async () => {
      startSetup();
      return delayedSetup;
    },
  });

  const pendingResponse = worker.fetch(visitorSessionRequest(), env);
  await setupStarted;
  assert.equal(bindingReads, 1);
  assert.equal(nowCalls, 2);
  assert.equal(scheduledDeadline.milliseconds, 100);
  wallClock = requestStartedAt + 100;
  finishSetup(await resolveTestVisitor());
  const response = await pendingResponse;

  assert.equal(bindingReads, 1);
  assert.equal(nowCalls, 3);
  assert.equal(scheduledDeadline.canceled, true);
  assert.equal(response.status, 503);
  assert.deepEqual(await json(response), { error: "upstream_unavailable" });
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
});

test("delayed visitor setup bases cookie expiry on its final response-time snapshot", async () => {
  const requestStartedAt = Date.UTC(2026, 8, 14, 23, 59, 0, 0);
  const responseTime = requestStartedAt + 30_500;
  let wallClock = requestStartedAt;
  let nowCalls = 0;
  const worker = createProductionLatticeApiWorker({
    now() {
      nowCalls += 1;
      return wallClock;
    },
    establishVisitor: async () => {
      wallClock = responseTime;
      return resolveTestVisitor();
    },
  });

  const response = await worker.fetch(visitorSessionRequest());
  assert.equal(response.status, 204);
  assert.equal(nowCalls, 3);
  assert.equal(
    response.headers.get("set-cookie"),
    `${LATTICE_API_VISITOR_COOKIE_NAME}=${TEST_VISITOR_COOKIE_VALUE}; Max-Age=30; Path=${LATTICE_API_VISITOR_COOKIE_PATH}; Secure; HttpOnly; SameSite=Strict`,
  );
});

test("content completed at the absolute cutoff cannot return output before its timer callback runs", async () => {
  const requestStartedAt = Date.UTC(2026, 8, 14, 17, 29, 59, 900);
  const expiresAt = new Date(requestStartedAt + 100).toISOString();
  let wallClock = requestStartedAt;
  let bindingReads = 0;
  let nowCalls = 0;
  let admissions = 0;
  let startPipeline;
  let finishPipeline;
  let scheduledDeadline;
  const pipelineStarted = new Promise((resolve) => { startPipeline = resolve; });
  const delayedPipeline = new Promise((resolve) => { finishPipeline = resolve; });
  const env = { HF_TOKEN: "server_only_token" };
  Object.defineProperty(env, LATTICE_QUALIFICATION_EXPIRES_AT_BINDING, {
    enumerable: true,
    get() {
      bindingReads += 1;
      return expiresAt;
    },
  });
  const worker = createLatticeApiWorker({
    now() {
      nowCalls += 1;
      return wallClock;
    },
    scheduleTimeout(callback, milliseconds) {
      scheduledDeadline = { callback, milliseconds, canceled: false };
      return scheduledDeadline;
    },
    cancelTimeout(deadline) {
      deadline.canceled = true;
    },
    admitTransformation: async () => {
      admissions += 1;
      return { allowed: true, retryAfterSeconds: null };
    },
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => {
      startPipeline();
      return delayedPipeline;
    },
  });

  const pendingResponse = worker.fetch(apiRequest(), env);
  await pipelineStarted;
  assert.equal(bindingReads, 1);
  assert.equal(nowCalls, 7);
  assert.equal(admissions, 1);
  assert.equal(scheduledDeadline.milliseconds, 100);
  wallClock = requestStartedAt + 100;
  finishPipeline(validLatticeResult("This cutoff result must not reach the caller."));
  const response = await pendingResponse;

  assert.equal(bindingReads, 1);
  assert.equal(nowCalls, 8);
  assert.equal(scheduledDeadline.canceled, true);
  assert.equal(response.status, 503);
  assert.deepEqual(await json(response), { error: "upstream_unavailable" });
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'");
});

test("an expired qualification cannot eagerly start visitor setup before its timer callback runs", async () => {
  const requestStartedAt = Date.UTC(2026, 8, 14, 17, 29, 59, 900);
  const expiresAt = new Date(requestStartedAt + 100).toISOString();
  let nowCalls = 0;
  let setupCalls = 0;
  let scheduledDeadline;
  const worker = createProductionLatticeApiWorker({
    now() {
      nowCalls += 1;
      return nowCalls === 1 ? requestStartedAt : requestStartedAt + 100;
    },
    scheduleTimeout(callback, milliseconds) {
      scheduledDeadline = { callback, milliseconds, canceled: false };
      return scheduledDeadline;
    },
    cancelTimeout(deadline) {
      deadline.canceled = true;
    },
    establishVisitor: async () => {
      setupCalls += 1;
      return resolveTestVisitor();
    },
  });

  const response = await worker.fetch(visitorSessionRequest(), {
    [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: expiresAt,
  });
  assert.equal(nowCalls, 2);
  assert.equal(setupCalls, 0);
  assert.equal(scheduledDeadline.canceled, true);
  assert.equal(response.status, 503);
  assert.deepEqual(await json(response), { error: "upstream_unavailable" });
  assert.equal(response.headers.has("set-cookie"), false);
});

test("qualification phase guards stop the next limiter, quota, adapter, or provider side effect", async () => {
  const phaseOrder = ["visitor", "limiter", "admission", "adapter"];
  for (const cutoffAfter of phaseOrder) {
    const requestStartedAt = Date.UTC(2026, 8, 14, 17, 29, 59, 900);
    const expiryMilliseconds = requestStartedAt + 100;
    const expiresAt = new Date(expiryMilliseconds).toISOString();
    let wallClock = requestStartedAt;
    const events = [];
    const markPhase = (phase) => {
      events.push(phase);
      if (phase === cutoffAfter) wallClock = expiryMilliseconds;
    };
    const worker = createProductionLatticeApiWorker({
      now: () => wallClock,
      scheduleTimeout: () => Object.freeze({}),
      cancelTimeout: () => {},
      resolveVisitor: async () => {
        markPhase("visitor");
        return resolveTestVisitor();
      },
      enforceRateLimit: async () => { markPhase("limiter"); },
      admitTransformation: async () => {
        markPhase("admission");
        return { allowed: true, retryAfterSeconds: null };
      },
      createAdapter: () => {
        markPhase("adapter");
        return Object.freeze({});
      },
      runTextToLatticeImpl: async () => {
        markPhase("pipeline");
        return validLatticeResult();
      },
    });

    const response = await worker.fetch(apiRequest(), {
      HF_TOKEN: "server_only_token",
      [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: expiresAt,
    });
    assert.equal(response.status, 503, cutoffAfter);
    assert.deepEqual(await json(response), { error: "upstream_unavailable" }, cutoffAfter);
    assert.deepEqual(
      events,
      phaseOrder.slice(0, phaseOrder.indexOf(cutoffAfter) + 1),
      cutoffAfter,
    );
  }
});

test("explicit caller credential headers fail closed before body parsing, admission, or provider work", async () => {
  let limiterCalls = 0;
  let adapterCreations = 0;
  let executions = 0;
  const worker = createProductionLatticeApiWorker({
    fetchImpl: async () => assert.fail("credential-bearing requests must not use the network"),
    enforceRateLimit: async () => {
      limiterCalls += 1;
    },
    createAdapter: () => {
      adapterCreations += 1;
      return Object.freeze({});
    },
    runTextToLatticeImpl: async () => {
      executions += 1;
      return validLatticeResult();
    },
  });

  for (const name of [
    "Authorization",
    "Proxy-Authorization",
    "X-Api-Key",
    "X-Auth-Token",
    "X-CSRF-Token",
    "CF-Access-Jwt-Assertion",
    "Signature-Input",
  ]) {
    const response = await worker.fetch(apiRequest("{", {
      headers: { [name]: "synthetic-credential" },
      raw: true,
    }), {
      HF_TOKEN: "unused",
      LATTICE_API_RATE_LIMITER: { limit: async () => ({ success: true }) },
    });
    assert.equal(response.status, 403, name);
    assert.deepEqual(await json(response), { error: "invalid_request" }, name);
    assert.equal(response.headers.get("cache-control"), "no-store", name);
  }

  assert.equal(limiterCalls, 0);
  assert.equal(adapterCreations, 0);
  assert.equal(executions, 0);
});

test("the dedicated API cookie is opaque, signed, day-expiring, and the only permitted cookie", async () => {
  const dayStart = Date.UTC(2026, 8, 14);
  assert.equal(await resolveLatticeApiVisitor(new Headers(), TEST_VISITOR_SECRET), null);
  const first = await establishLatticeApiVisitor(new Headers(), TEST_VISITOR_SECRET);
  assert.match(first.visitorId, /^[A-Za-z0-9_-]{24}$/u);
  assert.match(first.cookieValue, /^v1\.[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{43}$/u);

  const returning = await resolveLatticeApiVisitor(new Headers({
    Cookie: `${LATTICE_API_VISITOR_COOKIE_NAME}=${first.cookieValue}`,
  }), TEST_VISITOR_SECRET);
  assert.equal(returning.visitorId, first.visitorId);
  assert.equal(returning.cookieValue, first.cookieValue);

  for (const cookie of [
    "ambient=1",
    `${LATTICE_API_VISITOR_COOKIE_NAME}=${first.cookieValue}; ambient=1`,
    `${LATTICE_API_VISITOR_COOKIE_NAME}=${first.cookieValue.slice(0, -1)}${first.cookieValue.endsWith("A") ? "B" : "A"}`,
  ]) {
    await assert.rejects(
      resolveLatticeApiVisitor(new Headers({ Cookie: cookie }), TEST_VISITOR_SECRET),
      LatticeApiVisitorCookieError,
    );
  }

  assert.equal(latticeApiVisitorCookieMaxAge(dayStart), 86_400);
  assert.equal(latticeApiVisitorCookieMaxAge(dayStart + 86_399_500), 1);
  const response = withLatticeApiVisitorCookie(
    new Response("{}"),
    first.cookieValue,
    dayStart + 12 * 60 * 60_000,
  );
  assert.equal(
    response.headers.get("set-cookie"),
    `${LATTICE_API_VISITOR_COOKIE_NAME}=${first.cookieValue}; Max-Age=43200; Path=${LATTICE_API_VISITOR_COOKIE_PATH}; Secure; HttpOnly; SameSite=Strict`,
  );
  assert.doesNotMatch(response.headers.get("set-cookie"), /Domain=/iu);
});

test("the bodyless visitor-session setup creates only the API cookie and touches no quota or provider", async () => {
  const calls = [];
  let hfTokenReads = 0;
  const worker = createProductionLatticeApiWorker({
    enforceRateLimit: async () => { calls.push("rate-limiter"); },
    admitTransformation: async () => {
      calls.push("admission");
      return { allowed: true, retryAfterSeconds: null };
    },
    createAdapter: () => {
      calls.push("adapter");
      return Object.freeze({});
    },
    runTextToLatticeImpl: async () => {
      calls.push("pipeline");
      return validLatticeResult();
    },
  });
  const env = { VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET };
  Object.defineProperty(env, "HF_TOKEN", {
    get() {
      hfTokenReads += 1;
      return "must-not-be-read";
    },
  });

  const response = await worker.fetch(visitorSessionRequest(), env);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.has("content-type"), false);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(
    response.headers.get("set-cookie"),
    new RegExp(`^${LATTICE_API_VISITOR_COOKIE_NAME}=v1\\.[A-Za-z0-9_-]{24}\\.[A-Za-z0-9_-]{43}; Max-Age=[1-9][0-9]{0,5}; Path=${LATTICE_API_VISITOR_COOKIE_PATH}; Secure; HttpOnly; SameSite=Strict$`, "u"),
  );
  assert.deepEqual(calls, []);
  assert.equal(hfTokenReads, 0);
});

test("visitor-session setup accepts a non-null stream only after proving it contains zero bytes", async () => {
  const calls = [];
  let hfTokenReads = 0;
  const worker = createProductionLatticeApiWorker({
    establishVisitor: async () => {
      calls.push("visitor");
      return resolveTestVisitor();
    },
    enforceRateLimit: async () => { calls.push("rate-limiter"); },
    admitTransformation: async () => {
      calls.push("admission");
      return { allowed: true, retryAfterSeconds: null };
    },
    createAdapter: () => {
      calls.push("adapter");
      return Object.freeze({});
    },
    runTextToLatticeImpl: async () => {
      calls.push("pipeline");
      return validLatticeResult();
    },
  });
  const env = { VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET };
  Object.defineProperty(env, "HF_TOKEN", {
    get() {
      hfTokenReads += 1;
      return "must-not-be-read";
    },
  });
  const request = visitorSessionRequest({
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(0));
        controller.close();
      },
    }),
  });
  assert.notEqual(request.body, null);
  assert.equal(request.headers.has("content-type"), false);

  const response = await worker.fetch(request, env);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.match(
    response.headers.get("set-cookie"),
    new RegExp(`^${LATTICE_API_VISITOR_COOKIE_NAME}=`, "u"),
  );
  assert.deepEqual(calls, ["visitor"]);
  assert.equal(hfTokenReads, 0);
});

test("visitor-session setup rejects a real body byte or Content-Type before visitor or downstream work", async () => {
  const calls = [];
  let hfTokenReads = 0;
  const worker = createProductionLatticeApiWorker({
    establishVisitor: async () => {
      calls.push("visitor");
      return resolveTestVisitor();
    },
    enforceRateLimit: async () => { calls.push("rate-limiter"); },
    admitTransformation: async () => {
      calls.push("admission");
      return { allowed: true, retryAfterSeconds: null };
    },
    createAdapter: () => {
      calls.push("adapter");
      return Object.freeze({});
    },
    runTextToLatticeImpl: async () => {
      calls.push("pipeline");
      return validLatticeResult();
    },
  });
  const env = { VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET };
  Object.defineProperty(env, "HF_TOKEN", {
    get() {
      hfTokenReads += 1;
      return "must-not-be-read";
    },
  });
  let bodyCanceled = false;
  const requests = [
    visitorSessionRequest({
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1]));
        },
        cancel() {
          bodyCanceled = true;
        },
      }),
    }),
    visitorSessionRequest({ headers: { "Content-Type": "application/json" } }),
  ];

  for (const request of requests) {
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 400);
    assert.deepEqual(await json(response), { error: "invalid_request" });
    assert.equal(response.headers.has("set-cookie"), false);
  }
  assert.equal(bodyCanceled, true);
  assert.deepEqual(calls, []);
  assert.equal(hfTokenReads, 0);
});

test("visitor-session setup preserves and reissues a valid identity without rotating it", async () => {
  const worker = createProductionLatticeApiWorker();
  const env = { VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET };
  const first = await worker.fetch(visitorSessionRequest(), env);
  const firstValue = first.headers.get("set-cookie").split(";", 1)[0].split("=", 2)[1];
  const returning = await worker.fetch(visitorSessionRequest({ visitorCookie: firstValue }), env);
  const returningValue = returning.headers.get("set-cookie").split(";", 1)[0].split("=", 2)[1];

  assert.equal(first.status, 204);
  assert.equal(returning.status, 204);
  assert.equal(returningValue, firstValue);
});

test("a cookie-less transformation requires setup before any limiter, quota, token, or provider work", async () => {
  const calls = [];
  let hfTokenReads = 0;
  const worker = createProductionLatticeApiWorker({
    enforceRateLimit: async () => { calls.push("rate-limiter"); },
    admitTransformation: async () => {
      calls.push("admission");
      return { allowed: true, retryAfterSeconds: null };
    },
    resolveVisitor: async () => {
      calls.push("visitor-resolution");
      return resolveTestVisitor();
    },
    createAdapter: () => {
      calls.push("adapter");
      return Object.freeze({});
    },
    runTextToLatticeImpl: async () => {
      calls.push("pipeline");
      return validLatticeResult();
    },
  });
  const env = {};
  Object.defineProperty(env, "HF_TOKEN", {
    get() {
      hfTokenReads += 1;
      return "must-not-be-read";
    },
  });

  const response = await worker.fetch(apiRequest(validPayload, { visitorCookie: null }), env);
  assert.equal(response.status, 428);
  assert.deepEqual(await json(response), { error: "visitor_session_required" });
  assert.equal(response.headers.has("set-cookie"), false);
  assert.deepEqual(calls, []);
  assert.equal(hfTokenReads, 0);
});

test("visitor-session setup rejects an invalid cookie without rotating it or touching downstream work", async () => {
  let downstreamCalls = 0;
  const worker = createProductionLatticeApiWorker({
    enforceRateLimit: async () => { downstreamCalls += 1; },
    admitTransformation: async () => { downstreamCalls += 1; },
    createAdapter: () => { downstreamCalls += 1; },
    runTextToLatticeImpl: async () => { downstreamCalls += 1; },
  });
  const response = await worker.fetch(visitorSessionRequest({
    visitorCookie: `v1.${TEST_VISITOR_ID}.${"B".repeat(43)}`,
  }), { VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET });

  assert.equal(response.status, 403);
  assert.deepEqual(await json(response), { error: "invalid_request" });
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(downstreamCalls, 0);
});

test("a transformation succeeds with the valid cookie from setup and never reissues it", async () => {
  const calls = [];
  const worker = createProductionLatticeApiWorker({
    enforceRateLimit: async () => { calls.push("rate-limiter"); },
    admitTransformation: async (_namespace, visitorId) => {
      calls.push(["admission", visitorId]);
      return { allowed: true, retryAfterSeconds: null };
    },
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => {
      calls.push("pipeline");
      return validLatticeResult();
    },
  });
  const env = {
    HF_TOKEN: "server_only_token",
    VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
  };
  const setup = await worker.fetch(visitorSessionRequest(), env);
  const cookieValue = setup.headers.get("set-cookie").split(";", 1)[0].split("=", 2)[1];
  const response = await worker.fetch(apiRequest(validPayload, { visitorCookie: cookieValue }), env);

  assert.equal(response.status, 200);
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(calls[0], "rate-limiter");
  assert.match(calls[1][1], /^[A-Za-z0-9_-]{24}$/u);
  assert.equal(calls[2], "pipeline");
});

test("tampered or unrelated cookies fail before transformation admission or provider work", async () => {
  let admissions = 0;
  let executions = 0;
  const worker = createProductionLatticeApiWorker({
    enforceRateLimit: async () => {},
    admitTransformation: async () => {
      admissions += 1;
      return { allowed: true, retryAfterSeconds: null };
    },
    fetchImpl: async () => assert.fail("an invalid cookie must not reach the provider"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => {
      executions += 1;
      return validLatticeResult();
    },
  });
  for (const cookie of [
    "ambient=1",
    `${LATTICE_API_VISITOR_COOKIE_NAME}=v1.${TEST_VISITOR_ID}.${"B".repeat(43)}`,
  ]) {
    const response = await worker.fetch(apiRequest(validPayload, {
      headers: { Cookie: cookie },
    }), {
      HF_TOKEN: "server_only_token",
      VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
    });
    assert.equal(response.status, 403);
    assert.deepEqual(await json(response), { error: "invalid_request" });
    assert.equal(response.headers.has("set-cookie"), false);
  }
  assert.equal(admissions, 0);
  assert.equal(executions, 0);
});

test("a missing dedicated visitor-cookie secret fails before admission", async () => {
  let admissions = 0;
  const worker = createProductionLatticeApiWorker({
    enforceRateLimit: async () => {},
    admitTransformation: async () => {
      admissions += 1;
      return { allowed: true, retryAfterSeconds: null };
    },
    fetchImpl: async () => assert.fail("a missing cookie secret must not reach the provider"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => assert.fail("a missing cookie secret must not run the pipeline"),
  });
  const response = await worker.fetch(apiRequest(), { HF_TOKEN: "server_only_token" });
  assert.equal(response.status, 500);
  assert.deepEqual(await json(response), { error: "internal_error" });
  assert.equal(response.headers.has("set-cookie"), false);
  assert.equal(admissions, 0);
});

test("invalid JSON and every non-exact request schema fail closed", async () => {
  let executions = 0;
  let limiterCalls = 0;
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("invalid requests must not use the network"),
    createAdapter: () => Object.freeze({}),
    enforceRateLimit: async () => {
      limiterCalls += 1;
    },
    runTextToLatticeImpl: async () => {
      executions += 1;
      return { status: "translated" };
    },
  });
  const invalidBodies = [
    ["{", true],
    [null, false],
    [[], false],
    [{ text: "valid words", requested_mode: "auto" }, false],
    [{ ...validPayload, extra: true }, false],
    [{ ...validPayload, schema_version: 2 }, false],
    [{ ...validPayload, schema_version: "1" }, false],
    [{ ...validPayload, requested_mode: "interpretive" }, false],
    [{ ...validPayload, requested_mode: "AUTO" }, false],
    [{ ...validPayload, text: 42 }, false],
    [{ ...validPayload, text: "" }, false],
  ];
  for (const [body, raw] of invalidBodies) {
    const response = await worker.fetch(apiRequest(body, { raw }), { HF_TOKEN: "unused" });
    assert.equal(response.status, 400);
    assert.deepEqual(await json(response), { error: "invalid_request" });
  }
  assert.equal(executions, 0);
  assert.equal(limiterCalls, 0, "invalid payloads cannot consume the shared rate token");
});

test("the content-free rate limiter allows, denies, and fails closed before provider work", async () => {
  let adapterCreations = 0;
  let executions = 0;
  const worker = createProductionLatticeApiWorker({
    admitTransformation: allowTransformation,
    resolveVisitor: resolveTestVisitor,
    fetchImpl: async () => assert.fail("the injected pipeline must not use the provider network"),
    createAdapter: () => {
      adapterCreations += 1;
      return Object.freeze({});
    },
    runTextToLatticeImpl: async () => {
      executions += 1;
      return validLatticeResult();
    },
  });

  const keys = [];
  const allowed = await worker.fetch(apiRequest(), {
    HF_TOKEN: "unused",
    LATTICE_API_RATE_LIMITER: {
      async limit(options) {
        keys.push(options);
        return { success: true };
      },
    },
  });
  assert.equal(allowed.status, 200);
  assert.deepEqual(keys, [{ key: LATTICE_API_RATE_LIMIT_KEY }]);
  assert.equal(JSON.stringify(keys).includes(validPayload.text), false);
  assert.equal(adapterCreations, 1);
  assert.equal(executions, 1);

  const denied = await worker.fetch(apiRequest(), {
    HF_TOKEN: "unused",
    LATTICE_API_RATE_LIMITER: { limit: async () => ({ success: false }) },
  });
  assert.equal(denied.status, 429);
  assert.deepEqual(await json(denied), { error: "rate_limited", retry_after_seconds: 60 });

  for (const malformedBinding of [
    undefined,
    {},
    { limit: async () => null },
    { limit: async () => ({ success: "yes" }) },
    { limit: async () => { throw new Error("private limiter failure"); } },
  ]) {
    const response = await worker.fetch(apiRequest(), {
      HF_TOKEN: "unused",
      LATTICE_API_RATE_LIMITER: malformedBinding,
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await json(response), { error: "internal_error" });
  }
  assert.equal(adapterCreations, 1);
  assert.equal(executions, 1);
});

test("the 700-word boundary is accepted and 701 words is input_too_large", async () => {
  const acceptedText = Array.from({ length: 700 }, (_value, index) => `word${index}`).join(" ");
  const rejectedText = `${acceptedText} overflow`;
  const seen = [];
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("the injected pipeline must not use the network"),
    createAdapter: () => Object.freeze({}),
    async runTextToLatticeImpl(text) {
      seen.push(text);
      return validLatticeResult("bounded");
    },
  });

  const accepted = await worker.fetch(apiRequest({
    ...validPayload,
    text: acceptedText,
  }), { HF_TOKEN: "unused" });
  assert.equal(accepted.status, 200);
  assert.equal((await json(accepted)).schema_version, 1);

  const rejected = await worker.fetch(apiRequest({
    ...validPayload,
    text: rejectedText,
  }), { HF_TOKEN: "unused" });
  assert.equal(rejected.status, 413);
  assert.deepEqual(await json(rejected), { error: "input_too_large" });
  assert.deepEqual(seen, [acceptedText]);
});

test("the API rejects non-exact or internally inconsistent result envelopes", async () => {
  const valid = validLatticeResult();
  const invalidResults = [
    { ...valid, debug: true },
    { ...valid, version: "text-to-lattice.remote.v1" },
    { ...valid, questions: ["Send more source text."] },
    { ...valid, status: "translated", text: null },
    {
      ...valid,
      findings: [{ id: "finding:1", passageId: "passage:1", atomIds: ["atom:1"], message: "private detail" }],
    },
  ];

  for (const invalidResult of invalidResults) {
    const worker = createLatticeApiWorker({
      fetchImpl: async () => assert.fail("the injected pipeline must not use the network"),
      createAdapter: () => Object.freeze({}),
      runTextToLatticeImpl: async () => invalidResult,
    });
    const response = await worker.fetch(apiRequest(), { HF_TOKEN: "unused" });
    assert.equal(response.status, 502);
    assert.deepEqual(await json(response), { error: "malformed_upstream_response" });
  }
});

test("the shared error protocol rejects unknown fields and invalid retry hints", () => {
  assert.equal(isLatticeApiError({ error: "invalid_request" }), true);
  assert.equal(isLatticeApiError({ error: "rate_limited", retry_after_seconds: 60 }), true);
  for (const value of [
    { error: "unknown" },
    { error: "invalid_request", details: "must not cross the boundary" },
    { error: "rate_limited", retry_after_seconds: 0 },
    { error: "rate_limited", retry_after_seconds: 301 },
    { error: "upstream_timeout", retry_after_seconds: 60 },
  ]) {
    assert.equal(isLatticeApiError(value), false);
  }
});

test("the request-body byte ceiling fails before JSON allocation or conversion", async () => {
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("oversized requests must not use the network"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => assert.fail("oversized requests must not run the pipeline"),
    requestByteLimit: 32,
  });
  const response = await worker.fetch(apiRequest(validPayload), { HF_TOKEN: "unused" });
  assert.equal(response.status, 413);
  assert.deepEqual(await json(response), { error: "input_too_large" });
});

test("the API accepts exactly 65,536 request bytes for parsing and rejects byte 65,537", async () => {
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("boundary requests must not use the network"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => assert.fail("invalid boundary requests must not run the pipeline"),
  });
  const exact = await worker.fetch(apiRequest("x".repeat(LATTICE_API_REQUEST_BYTE_LIMIT), {
    raw: true,
  }), { HF_TOKEN: "unused" });
  assert.equal(exact.status, 400);
  assert.deepEqual(await json(exact), { error: "invalid_request" });

  const plusOne = await worker.fetch(apiRequest("x".repeat(LATTICE_API_REQUEST_BYTE_LIMIT + 1), {
    raw: true,
  }), { HF_TOKEN: "unused" });
  assert.equal(plusOne.status, 413);
  assert.deepEqual(await json(plusOne), { error: "input_too_large" });
});

test("malformed and oversized Content-Length reject without awaiting body cancellation", async () => {
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("header-rejected requests must not use the network"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => assert.fail("header-rejected requests must not run the pipeline"),
  });

  for (const [claimedLength, expectedStatus, expectedError] of [
    ["invalid", 400, "invalid_request"],
    [`${LATTICE_API_REQUEST_BYTE_LIMIT + 1}`, 413, "input_too_large"],
  ]) {
    let cancellations = 0;
    const request = apiRequest(new ReadableStream({
      pull() {},
      cancel() {
        cancellations += 1;
        return new Promise(() => {});
      },
    }), {
      headers: { "Content-Length": claimedLength },
      raw: true,
    });
    const outcome = await Promise.race([
      worker.fetch(request, { HF_TOKEN: "unused" }),
      new Promise((resolve) => setTimeout(() => resolve(null), 250)),
    ]);
    assert.ok(outcome instanceof Response);
    assert.equal(outcome.status, expectedStatus);
    assert.deepEqual(await json(outcome), { error: expectedError });
    assert.equal(cancellations, 1);
  }
});

test("verifier corrections keep negative results complete and preserve both rejection guards", async (context) => {
  for (const firstFailure of ["V16M", "V17M", "V01F", "V14LE", "V14LS", "V14LG", "V19", "V24O"]) {
    for (const recover of [true, false]) {
      await context.test(`${firstFailure}: ${recover ? "corrected" : "exhausted"}`, async () => {
        const calls = [];
        let verifierCalls = 0;
        const worker = createLatticeApiWorker({
          fetchImpl: async (_url, init) => {
            const body = JSON.parse(init.body);
            calls.push(body);
            if (isAnalysisBody(body)) {
              return successfulProviderResponse(canaryAnalysisWire(body));
            }
            if (isCandidateBody(body)) {
              return successfulProviderResponse(canaryCandidateFromProviderBody(
                body, "A guest sets a blue notebook on the desk, reviews the first page, then shuts it.",
              ));
            }
            const toolName = isVerificationBody(body) ? VERIFICATION_TOOL_NAME : body.response_format?.json_schema?.name ?? body.tool_choice.function.name;
            if (toolName === VERIFICATION_TOOL_NAME) {
              verifierCalls += 1;
              const wire = structuredClone(canaryVerificationWire(body));
              if (verifierCalls === 1 || !recover) {
                if (firstFailure === "V16M") wire.p["0"].x = "0".repeat(wire.p["0"].x.length);
                else if (firstFailure === "V17M") wire.p["0"].y = "0".repeat(wire.p["0"].y.length);
                else if (firstFailure === "V14LE") wire.p["0"].f = "";
                else if (firstFailure === "V14LS") wire.p["0"].f = wire.p["0"].f.slice(0, -1);
                else if (firstFailure === "V14LG") wire.p["0"].f += "0";
                else if (firstFailure === "V19") wire.p["0"].c.v = true;
                else if (firstFailure === "V24O") wire.i = [null];
                else delete wire.i;
              }
              return successfulProviderResponse(wire);
            }
            assert.equal(recover, true, "invalid verification cannot reach certification");
            assert.equal(toolName, CERTIFICATION_TOOL_NAME);
            const payload = inertModelPayload(body);
            return successfulProviderResponse(acceptingCertificationWire(
              payload.certificateId, payload.obligationIds,
            ));
          },
        });
        const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST), { HF_TOKEN: "server-token" });
        const envelope = await json(response);
        assert.equal(response.status, 200);
        assert.equal(verifierCalls, 2);
        assert.equal(calls.length, recover ? 5 : 4);
        assert.equal(envelope.result.status === "translated", recover);
        assert.equal(envelope.result.verificationPasses, recover ? 1 : 0);
        const verifies = calls.filter(isVerificationBody);
        assert.deepEqual(fittedVerificationSchemaForBody(verifies[0]), fittedVerificationSchemaForBody(verifies[1]));
        for (const body of verifies) {
          assert.equal(body.model, TEST_REVIEW_MODEL);
          assert.equal(body.max_tokens, 2_048);
          assert.match(body.messages[0].content, /exactly the four root fields d, g, p, and i/u);
          assert.match(body.messages[0].content, /x and y.*at least one 1.*repair or reject/u);
          assert.match(body.messages[0].content, /emptiness applies only to c, never to x or y/u);
          assert.doesNotMatch(JSON.stringify(body), /V16M|V17M|V01F|V14L|V19|V24O|D14|PRIVATE-HOST/u);
        }
        assert.equal(Object.hasOwn(inertModelPayload(verifies[0]), "retry"), false);
        assert.equal(inertModelPayload(verifies[1]).retry, "private-verification-wire-invalid");
        const widthHint = /Rebuild every bit or digit string by enumerating all supplied ordered positions/u;
        const fieldHint = /Construct a complete result instance with every required field/u;
        const supportHint = /Rebuild layer support from the source/u;
        const conformanceHint = /Rebuild retained-source conformance separately/u;
        const issueHint = /Rebuild issue entries as complete closed c\/p objects/u;
        assert.doesNotMatch(verifies[0].messages[0].content, issueHint);
        if (firstFailure === "V24O") assert.match(verifies[1].messages[0].content, issueHint);
        else assert.doesNotMatch(verifies[1].messages[0].content, issueHint);
        assert.doesNotMatch(verifies[0].messages[0].content, conformanceHint);
        if (firstFailure === "V19") assert.match(verifies[1].messages[0].content, conformanceHint);
        else assert.doesNotMatch(verifies[1].messages[0].content, conformanceHint);
        assert.doesNotMatch(verifies[0].messages[0].content, widthHint);
        assert.doesNotMatch(verifies[0].messages[0].content, fieldHint);
        assert.doesNotMatch(verifies[0].messages[0].content, supportHint);
        if (["V14LE", "V14LS", "V14LG"].includes(firstFailure)) assert.match(verifies[1].messages[0].content, widthHint);
        else assert.doesNotMatch(verifies[1].messages[0].content, widthHint);
        if (firstFailure === "V01F") assert.match(verifies[1].messages[0].content, fieldHint);
        else assert.doesNotMatch(verifies[1].messages[0].content, fieldHint);
        if (["V16M", "V17M"].includes(firstFailure)) {
          assert.match(verifies[1].messages[0].content, supportHint);
          assert.match(verifies[1].messages[0].content, /Never select an unsupported atom or span merely to satisfy the minimum/u);
          assert.match(verifies[1].messages[0].content, /Replace the complete d\/g\/p\/i result/u);
        } else assert.doesNotMatch(verifies[1].messages[0].content, supportHint);
      });
    }
  }
});

test("actual layer, conformance and issue corrections precede material repair without bypassing guards", async (context) => {
  const checks = VERIFICATION_SCHEMA.properties.passages.items.properties.failedChecks.items.enum;
  const repairText = "A guest sets a blue notebook on the desk, reviews the first page, then shuts it.";
  for (const [firstFailure, correctionFailure] of [
    ["V17M", null], ["V17M", "V01F"], ["V17M", "V19"],
    ["V19", null], ["V19", "V01F"], ["V19", "V19"],
    ["V24O", null], ["V24O", "V24O"], ["V01F", "V24O"],
    ["V24O", "issue-mask-index"], ["V24O", "issue-global-scope"],
  ]) {
    const correctionInvalid = correctionFailure !== null;
    await context.test(`${firstFailure} then ${correctionFailure ?? "grounded material repair"}`, async () => {
      const calls = [];
      let drafts = 0;
      let verifies = 0;
      const worker = createLatticeApiWorker({ fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body); calls.push(body);
        if (isAnalysisBody(body)) {
          const wire = canaryAnalysisWire(body);
          wire.p[0][2] = [[1, 0, 1, [0]], [1, 0, 1, [1, 2]]];
          return successfulProviderResponse(wire);
        }
        if (isCandidateBody(body)) {
          drafts += 1;
          return successfulProviderResponse(canaryCandidateFromProviderBody(body,
            drafts === 1 ? LATTICE_PRODUCTION_CANARY_TEXT.slice(0, -1) : repairText));
        }
        let wire;
        if (isVerificationBody(body)) {
          verifies += 1;
          wire = canaryVerificationWire(body);
          wire.p["0"].x = "10";
          wire.p["0"].y = verifies === 1 && firstFailure === "V17M" ? "000" : "100";
          if (verifies === 1 && firstFailure === "V19") wire.p["0"].c.v = true;
          if (verifies === 1 && firstFailure === "V24O") wire.i = [null];
          if (verifies === 1 && firstFailure === "V01F") delete wire.i;
          assert.deepEqual(inertModelPayload(body).wireLayout.passages["0"].conformance.fixedProtocolValue,
            { v: false, s: "000", k: [] });
          assert.deepEqual(inertModelPayload(body).wireLayout.issueCheckBindings, EXPECTED_ISSUE_CHECK_BINDINGS);
          assert.match(body.messages[0].content, /not candidate quality, layer support, or an acceptance decision/u);
          if (verifies <= 2) {
            wire.d = 1;
            wire.p["0"].f = checks.map((check) => check === "materiality" ? "1" : "0").join("");
          }
          if (verifies === 2) {
            const hints = { V17M: /Rebuild layer support from the source/u,
              V19: /Rebuild retained-source conformance separately/u,
              V24O: /Rebuild issue entries as complete closed c\/p objects/u,
              V01F: /Construct a complete result instance with every required field/u };
            assert.match(body.messages[0].content, hints[firstFailure]);
            if (firstFailure !== "V01F") assert.match(body.messages[0].content, /Replace the complete d\/g\/p\/i result/u);
            if (correctionFailure === "V01F") delete wire.i;
            if (correctionFailure === "V19") wire.p["0"].c.s = "100";
            if (correctionFailure === "V24O") wire.i = [0];
            if (correctionFailure === "issue-mask-index") wire.i = [{ c: 7, p: 0 }];
            if (correctionFailure === "issue-global-scope") wire.i = [{ c: 12, p: -1 }];
            if (!correctionInvalid) wire.i = [{
              c: VERIFICATION_SCHEMA.properties.issues.items.properties.check.enum.indexOf("materiality"), p: 0,
            }];
          } else assert.doesNotMatch(body.messages[0].content, /Rebuild layer support from the source/u);
        } else {
          assert.equal(correctionInvalid, false, "invalid correction cannot certify");
          const payload = inertModelPayload(body);
          wire = acceptingCertificationWire(payload.certificateId, payload.obligationIds);
        }
        return providerChoiceResponse({ finish_reason: "stop", message: {
          role: "assistant", content: JSON.stringify(wire),
        } });
      } });
      const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST, { headers: {
        [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
      } }), { HF_TOKEN: "server-token", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-10-04T14:00:00.000Z" });
      const envelope = await json(response);
      assert.equal(response.status, 200);
      assert.equal(drafts, correctionInvalid ? 1 : 2);
      assert.equal(verifies, correctionInvalid ? 2 : 3);
      assert.equal(calls.length, correctionInvalid ? 4 : 7);
      assert.equal(envelope.result.text, correctionInvalid ? null : `${repairText}\n`);
      assert.equal(envelope.result.verificationPasses, correctionInvalid ? 0 : 2);
      if (["issue-mask-index", "issue-global-scope"].includes(correctionFailure)) {
        const expected = { stage: "verification", attempt: "2", firstDeterministicRule: "D14",
          validationCategory: "decision-consistency", priorValidationCategory: "response-shape",
          rejectionBoundary: "host-normalizer", rejectionRule: "unknown",
          priorRejectionBoundary: "wire-decoder", priorRejectionCategory: "object-type",
          priorRejectionRule: "V24O", callsUsed: "4" };
        for (const [field, value] of Object.entries(expected)) {
          assert.equal(response.headers.get(LATTICE_QUALIFICATION_WITHHELD_DIAGNOSTIC_RESPONSE_HEADERS[field]), value, field);
        }
      }
      const bodies = calls.filter(isVerificationBody);
      assert.deepEqual(fittedVerificationSchemaForBody(bodies[0]), fittedVerificationSchemaForBody(bodies[1]));
      for (const body of bodies.slice(0, 2)) {
        assert.deepEqual(inertModelPayload(body).deterministicFindings.map(({ id }) => id), ["candidate-not-material"]);
        assert.doesNotMatch(JSON.stringify(body), /V17M|V19|V01F|V24O|D14/u);
      }
      if (!correctionInvalid) {
        assert.equal(Boolean(inertModelPayload(bodies[2]).deterministicFindings?.length), false);
        assert.equal(calls.at(-1).max_tokens, 520);
      }
    });
  }
});

test("closed strict verification carries sparse grounded masks through material repair and certification", async (context) => {
  const checks = VERIFICATION_SCHEMA.properties.passages.items.properties.failedChecks.items.enum;
  const repairText = "A guest sets a blue notebook on the desk, reviews the first page, then shuts it.";
  for (const repairCopiesSource of [false, true]) {
    await context.test(repairCopiesSource ? "copied repair remains withheld" : "material repair passes", async () => {
      const calls = [];
      let drafts = 0;
      let verifies = 0;
      const worker = createLatticeApiWorker({ fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body); calls.push(body);
        if (isAnalysisBody(body)) {
          const wire = canaryAnalysisWire(body);
          wire.p[0][2] = [[1, 0, 1, [0]], [1, 0, 1, [1, 2]]];
          return successfulProviderResponse(wire);
        }
        if (isCandidateBody(body)) {
          drafts += 1;
          return successfulProviderResponse(canaryCandidateFromProviderBody(body,
            drafts === 1 || repairCopiesSource ? LATTICE_PRODUCTION_CANARY_TEXT.slice(0, -1) : repairText));
        }
        let wire;
        if (isVerificationBody(body)) {
          verifies += 1;
          wire = canaryVerificationWire(body);
          assert.equal(wire.p["0"].a, "11");
          assert.equal(wire.p["0"].s, "000");
          wire.p["0"].x = "10";
          wire.p["0"].y = "100";
          if (verifies === 1) {
            wire.d = 1;
            wire.p["0"].f = checks.map((check) => check === "materiality" ? "1" : "0").join("");
          }
        } else {
          assert.equal(repairCopiesSource, false, "copied repair cannot reach certification");
          assert.equal(body.response_format?.json_schema?.name ?? body.tool_choice.function.name, CERTIFICATION_TOOL_NAME);
          const payload = inertModelPayload(body);
          wire = acceptingCertificationWire(payload.certificateId, payload.obligationIds);
        }
        return providerChoiceResponse({ finish_reason: "stop", message: {
          role: "assistant", content: JSON.stringify(wire),
        } });
      } });
      const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST), { HF_TOKEN: "server-token" });
      const envelope = await json(response);
      assert.equal(response.status, 200);
      assert.equal(drafts, 2);
      assert.equal(verifies, 2);
      assert.equal(calls.length, repairCopiesSource ? 5 : 6);
      assert.equal(envelope.result.status === "translated", !repairCopiesSource);
      assert.equal(envelope.result.text, repairCopiesSource ? null : `${repairText}\n`);
      assert.equal(envelope.result.verificationPasses, repairCopiesSource ? 0 : 2);
      const verifyBodies = calls.filter(isVerificationBody);
      assert.deepEqual(inertModelPayload(verifyBodies[0]).deterministicFindings.map(({ id }) => id), ["candidate-not-material"]);
      assert.equal(Boolean(inertModelPayload(verifyBodies[1]).deterministicFindings?.length), repairCopiesSource);
      for (const body of verifyBodies) {
        assert.equal(body.max_tokens, 2_048);
        const schema = fittedVerificationSchemaForBody(body).properties.p.properties["0"].properties;
        assert.equal(fittedStringLength(schema.x), 2);
        assert.equal(fittedStringLength(schema.y), 3);
        assert.equal(fittedStringLength(schema.f), checks.length);
        assert.match(body.messages[0].content, /Never select unsupported evidence merely to make a mask nonempty/u);
      }
      for (const body of calls.filter(isCandidateBody)) {
        assert.match(body.messages[0].content, /Host-derived atom values are bounded source excerpts/u);
        assert.match(body.messages[0].content, /Preserve every distinct commitment, including commitments sharing one excerpt/u);
        assert.match(body.messages[0].content, /designated exact literals and annotations remain verbatim/u);
      }
      if (!repairCopiesSource) assert.equal(calls.at(-1).max_tokens, 520);
    });
  }
});

test("closed strict verification never repairs truncated masks or invents grounding", async (context) => {
  const repairText = "A guest sets a blue notebook on the desk, reviews the first page, then shuts it.";
  for (const failure of ["truncated-mask", "ungrounded-span"]) {
    await context.test(failure, async () => {
      const calls = [];
      const worker = createLatticeApiWorker({ fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body); calls.push(body);
        if (isAnalysisBody(body)) {
          const wire = canaryAnalysisWire(body);
          wire.p[0][2] = [[1, 0, 1, [0]], [1, 0, 1, [1, 2]]];
          return successfulProviderResponse(wire);
        }
        if (isCandidateBody(body)) return successfulProviderResponse(canaryCandidateFromProviderBody(body, repairText));
        assert.ok(isVerificationBody(body), "invalid masks cannot certify");
        const wire = canaryVerificationWire(body);
        wire.p["0"].x = "10";
        wire.p["0"].y = failure === "ungrounded-span" ? "010" : "100";
        if (failure === "truncated-mask") wire.p["0"].f = wire.p["0"].f.slice(0, -1);
        return providerChoiceResponse({ finish_reason: "stop", message: {
          role: "assistant", content: JSON.stringify(wire),
        } });
      } });
      const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST), { HF_TOKEN: "server-token" });
      const envelope = await json(response);
      assert.equal(response.status, 200);
      assert.notEqual(envelope.result.status, "translated");
      assert.equal(envelope.result.text, null);
      assert.equal(envelope.result.verificationPasses, 0);
      assert.equal(calls.length, failure === "truncated-mask" ? 4 : 6);
      assert.equal(calls.filter(isVerificationBody).length, 2);
      assert.equal(calls.filter(isAnalysisBody).length, failure === "truncated-mask" ? 1 : 2);
    });
  }
});

test("reverification corrections preserve fixed strict-schema transport, decision consistency and original candidate provenance", async (context) => {
  const checks = VERIFICATION_SCHEMA.properties.passages.items.properties.failedChecks.items.enum;
  const issueChecks = VERIFICATION_SCHEMA.properties.issues.items.properties.check.enum;
  const gates = VERIFICATION_SCHEMA.properties.failedGates.items.enum;
  const repairText = "A guest sets a blue notebook on the desk, reviews the first page, then shuts it.";
  for (const inconsistency of ["negative-positive", "issue-passed", "document-issue-local-only"]) {
    for (const recover of [true, false]) {
      await context.test(`${inconsistency}: ${recover ? "corrected" : "exhausted"}`, async () => {
        const calls = [];
        let drafts = 0;
        let verifies = 0;
        const worker = createLatticeApiWorker({
          fetchImpl: async (url, init) => {
            const body = JSON.parse(init.body); calls.push(body);
            if (isAnalysisBody(body)) return successfulProviderResponse(canaryAnalysisWire(body));
            if (isCandidateBody(body)) {
              drafts += 1;
              return successfulProviderResponse(canaryCandidateFromProviderBody(
                body, drafts === 1 ? LATTICE_PRODUCTION_CANARY_TEXT.slice(0, -1) : repairText,
              ));
            }
            const toolName = isVerificationBody(body) ? VERIFICATION_TOOL_NAME : body.response_format?.json_schema?.name ?? body.tool_choice.function.name;
            if (toolName === VERIFICATION_TOOL_NAME) {
              verifies += 1;
              assert.equal(url, TEST_REVIEW_URL);
              fittedVerificationSchemaForBody(body);
              const wire = structuredClone(canaryVerificationWire(body));
              if (verifies === 1) {
                wire.d = 1;
                wire.g = gates.map((name) => name === "clarity" ? "1" : "0").join("");
              }
              if (verifies === 2 && inconsistency === "document-issue-local-only") {
                wire.d = 1;
                wire.p["0"].f = checks.map((name) => name === "clarity" ? "1" : "0").join("");
              }
              if (verifies === 2) {
                wire.d = 1;
                if (inconsistency !== "negative-positive") {
                  wire.i = [{ c: issueChecks.indexOf("clarity"), p: inconsistency === "issue-passed" ? 0 : -1 }];
                }
              }
              if (verifies === 3 && !recover) delete wire.i;
              return successfulProviderResponse(wire);
            }
            assert.equal(recover, true, "exhausted reverification must not certify the discarded repair");
            assert.equal(url, HUGGING_FACE_CHAT_COMPLETIONS_URL);
            assert.equal(body.model, LATTICE_REMOTE_MODELS.verifier);
            assert.equal(body.max_tokens, 520);
            assert.equal(toolName, CERTIFICATION_TOOL_NAME);
            const payload = inertModelPayload(body);
            return successfulProviderResponse(acceptingCertificationWire(
              payload.certificateId, payload.obligationIds,
            ));
          },
        });
        const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST, { headers: {
          [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
        } }), { HF_TOKEN: "server-token", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z" });
        const envelope = await json(response);
        assert.equal(response.status, 200);
        assert.equal(drafts, 2);
        assert.equal(verifies, 3);
        assert.equal(calls.length, recover ? 7 : 6);
        assert.equal(envelope.result.status === "translated", recover);
        const verifyBodies = calls.filter(isVerificationBody);
        assert.deepEqual(fittedVerificationSchemaForBody(verifyBodies[1]), fittedVerificationSchemaForBody(verifyBodies[2]));
        for (const body of verifyBodies) {
          assert.equal(body.model, TEST_REVIEW_MODEL);
          assert.equal(body.max_tokens, 2_048);
          assert.match(body.messages[0].content, /Repair or reject requires at least one actual failed condition/u);
          assert.match(body.messages[0].content, /Never use i alone to establish a failed check/u);
          assert.doesNotMatch(JSON.stringify(body), /V01F|D14|decision-consistency|A verifier issue must identify/u);
        }
        assert.equal(Object.hasOwn(inertModelPayload(verifyBodies[1]), "retry"), false);
        assert.equal(inertModelPayload(verifyBodies[2]).retry, "private-verification-wire-invalid");
        if (recover) {
          assert.equal(envelope.result.text, `${repairText}\n`);
          assert.equal(envelope.result.verificationPasses, 2);
        } else {
          assert.equal(envelope.result.text, null);
          assert.equal(envelope.result.verificationPasses, 0);
          const expected = {
            // Failed reverification restores the original host-proved nonmaterial candidate.
            verification: "semantic-rejection", firstDeterministicRule: "D14", stage: "reverification",
            attempt: "2", validationCategory: "response-shape", priorValidationCategory: "decision-consistency",
            rejectionBoundary: "wire-decoder", rejectionRule: "V01F",
            priorRejectionBoundary: "host-normalizer", priorRejectionRule: "unknown", callsUsed: "6",
          };
          for (const [field, value] of Object.entries(expected)) {
            assert.equal(response.headers.get(LATTICE_QUALIFICATION_WITHHELD_DIAGNOSTIC_RESPONSE_HEADERS[field]), value, field);
          }
        }
      });
    }
  }
});

test("repair and reject wire records still require grounded layer support and every root field", async () => {
  const request = minimalVerificationRequest();
  for (const decision of [1, 2]) {
    const wire = structuredClone(acceptingVerificationWire(request));
    wire.d = decision;
    wire.p["0"].f = "000000010";
    const variants = [
      [wire, null],
      [{ ...wire, i: [{ c: VERIFICATION_SCHEMA.properties.issues.items.properties.check.enum.indexOf("materiality"), p: 0 }] }, null],
      [{ ...wire, p: { 0: { ...wire.p["0"], x: "0".repeat(wire.p["0"].x.length) } } }, "V16M"],
      [{ ...wire, p: { 0: { ...wire.p["0"], y: "0".repeat(wire.p["0"].y.length) } } }, "V17M"],
      ...[{ ...wire.p["0"].c, v: true },
        { ...wire.p["0"].c, s: "1".repeat(wire.p["0"].c.s.length) },
        { ...wire.p["0"].c, k: [{ v: false, s: wire.p["0"].c.s }] },
      ].map((c) => [{ ...wire, p: { 0: { ...wire.p["0"], c } } }, "V19"]),
      ...["d", "g", "p", "i"].map((field) => {
        const missing = { ...wire }; delete missing[field]; return [missing, "V01F"];
      }),
      [{ ...wire, extra: false }, "V01F"],
    ];
    for (const [value, rule] of variants) {
      const adapter = createHuggingFaceLatticeAdapter({
        token: "server-token", fetchImpl: async () => successfulProviderResponse(value),
      });
      const result = await adapter.verify(request);
      assert.equal(adapter.completionCapacity().used, 1);
      if (rule) {
        assert.deepEqual(result, {});
        assert.equal(rejectedResultDiagnostic(result).rule, rule);
      } else {
        assert.equal(result.decision, decision === 1 ? "repair" : "reject");
        assert.deepEqual(result.passages[0].failedChecks, ["materiality"]);
        assert.equal(result.passages[0].conformanceConfirmed, false);
        assert.equal(result.issues.length, value.i.length);
        if (value.i.length) {
          assert.equal(result.issues[0].check, "materiality");
          assert.equal(result.issues[0].passageId, request.analysis.passages[0].passageId);
        }
        assert.ok(result.passages[0].layerEvidenceAtomIds.length > 0);
        assert.ok(result.passages[0].layerEvidenceSpanIds.length > 0);
      }
    }
  }
});

test("compact drafting and repair derive concrete plans from source rather than generic layer labels", async () => {
  const base = minimalAnalysisRequest("A visitor places a blue notebook on the desk, reads the first page, and closes it.");
  const request = { ...base, sourceSpans: latticeSourceSpansForBatch(base.batch), analysisAtomLimit: 12 };
  const calls = [];
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token", fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body); calls.push(body);
      return successfulProviderResponse(calls.length === 1
        ? { d: 2, p: [[0, 0, [[1, 0, 1, [0, 1, 2]]], ["000", "000", "000", "000", "000"]]], l: [] }
        : { passages: [] });
    },
  });
  const analysis = await adapter.analyze(request);
  const draft = { ...request, analysis };
  for (const correction of [false, true]) {
    const current = { ...draft, ...(correction ? { protocolFeedback: { attempt: 2, category: "response-shape" } } : {}) };
    await adapter.generate(current);
    await adapter.repair({ ...current, candidate: { passages: [] }, verification: {
      decision: "repair", gates: {}, passages: [], issues: [], questions: [],
    } });
  }
  assert.equal(calls.length, 5);
  assert.equal(adapter.completionCapacity().used, 5);
  assert.match(calls[0].messages[0].content, /discourse function and rationale provide generic guidance for the selected layer/u);
  for (const body of calls.slice(1)) {
    const system = body.messages[0].content;
    assert.match(system, /Discourse function and rationale provide generic layer guidance/u);
    assert.match(system, /Derive this passage's concrete realization from its complete supplied source, document kind, validated disposition and layer, typed atoms, evidence, and relation links/u);
    assert.doesNotMatch(system, /source-specific.*(?:realization|repair) plan/u);
    assert.match(system, /normalized word|normalized wording/u);
    assert.match(system, /speech act/u);
    const payload = inertModelPayload(body);
    assert.equal(payload.analysis[0], analysis.documentKind);
    assert.equal(payload.analysis[1][0][1], analysis.passages[0].discourseFunction);
    assert.equal(payload.analysis[1][0][3], "rewrite");
    assert.equal(payload.analysis[1][0][4], analysis.passages[0].rationale);
    assert.deepEqual(payload.analysis[1][0][5][0][5], payload.sourcePassages ? [] : analysis.passages[0].atoms[0].evidenceSpanIds);
    assert.deepEqual(payload.analysis[1][0][5][0][6], []);
    assert.ok(body.messages[1].content.includes(base.batch.passages[0].text));
    assert.equal(body.max_tokens, 800);
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.equal(Object.hasOwn(body, "tools"), false);
  }
});

test("host-schema drafting and repair preserve detailed plans by default and explicit selection", () => {
  const request = { ...minimalVerificationRequest(), verification: { decision: "repair", gates: {}, passages: [], issues: [], questions: [] } };
  for (const factory of [candidateMessages, repairMessages]) {
    assert.deepEqual(factory(request), factory(request, { analysisPlanDialect: "host-schema" }));
    assert.match(factory(request)[0].content, /source-specific.*plan/u);
    assert.throws(() => factory(request, { analysisPlanDialect: "untrusted" }), /invalid analysis plan dialect/u);
  }
});

test("regeneration preserves authentic prior nonmaterial findings without stale plan or candidate data", async () => {
  const request = minimalVerificationRequest("The visitor closes the notebook.");
  const copied = { passages: [{ ...request.candidate.passages[0], text: request.batch.passages[0].text }] };
  const findings = deterministicBatchReview(request.batch, request.analysis, copied);
  assert.equal(findings.some(({ id }) => id === "candidate-not-material"), true);
  const calls = [];
  const adapter = createHuggingFaceLatticeAdapter({ token: "server-token", fetchImpl: async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return successfulProviderResponse({ passages: [] });
  } });
  const prior = { ...request, deterministicFindings: findings,
    candidate: { passages: [{ ...copied.passages[0], text: "PRIVATE-OLD-DRAFT" }] },
    verification: { issues: [{ message: "PRIVATE-OLD-REVIEW" }] } };
  await adapter.generate(prior);
  await adapter.generate({ ...prior, regenerationFromReanalysis: true });
  assert.equal(Object.hasOwn(inertModelPayload(calls[0]), "regenerationFeedback"), false);
  assert.doesNotMatch(calls[0].messages[0].content, /nonmaterialPassagePositions/u);
  assert.deepEqual(inertModelPayload(calls[1]).regenerationFeedback, { nonmaterialPassagePositions: [0] });
  assert.match(calls[1].messages[0].content, /previous draft/u);
  assert.match(calls[1].messages[0].content, /nonmaterialPassagePositions/u);
  assert.doesNotMatch(JSON.stringify(calls), /PRIVATE-OLD-DRAFT|PRIVATE-OLD-REVIEW/u);
  assert.equal(calls[1].max_tokens, 800);
  assert.deepEqual(calls[1].response_format, { type: "json_object" });
  assert.equal(adapter.completionCapacity().used, 2);

  for (const current of [
    { ...prior, regenerationFromReanalysis: "true" },
    { ...prior, regenerationFromReanalysis: true, deterministicFindings: findings.map((item) => ({ ...item })) },
    { ...prior, regenerationFromReanalysis: true, deterministicFindings: [] },
    { ...prior, regenerationFromReanalysis: true, analysis: { ...request.analysis,
      passages: request.analysis.passages.map((item) => ({ ...item, disposition: "retain-if-conformant" })) } },
    { ...prior, regenerationFromReanalysis: true, batch: { ...request.batch,
      passages: request.batch.passages.map((item) => ({ ...item, id: "different-passage" })) } },
  ]) {
    const messages = candidateMessages(current, { analysisPlanDialect: "compact-wire-v2" });
    assert.equal(Object.hasOwn(inertModelPayload({ messages }), "regenerationFeedback"), false);
    assert.doesNotMatch(messages[0].content, /nonmaterialPassagePositions/u);
  }
  const repeated = candidateMessages({ ...prior, regenerationFromReanalysis: true,
    deterministicFindings: [...findings, ...findings] });
  assert.deepEqual(inertModelPayload({ messages: repeated }).regenerationFeedback, { nonmaterialPassagePositions: [0] });
});

test("compact draft and repair preserve distinct typed atoms sharing one source excerpt", async () => {
  const source = "A guest closes the notebook.";
  const base = minimalAnalysisRequest(source);
  const request = { ...base, sourceSpans: latticeSourceSpansForBatch(base.batch), analysisAtomLimit: 12 };
  const calls = [];
  const adapter = createHuggingFaceLatticeAdapter({ token: "server-token", fetchImpl: async (_url, init) => {
    const body = JSON.parse(init.body); calls.push(body);
    if (calls.length === 1) {
      const payload = inertModelPayload(body);
      const positions = [...payload.passages[0][1], ...payload.passages[0][2]].map((_span, index) => index);
      return successfulProviderResponse({ d: 2, p: [[0, 0,
        [[0, 0, 1, positions], [1, 0, 1, positions]], Array(5).fill("0".repeat(positions.length)),
      ]], l: [] });
    }
    return successfulProviderResponse(canaryCandidateFromProviderBody(body, "A guest shuts the notebook."));
  } });
  const analysis = await adapter.analyze(request);
  const atoms = analysis.passages[0].atoms;
  assert.deepEqual(atoms.map(({ kind }) => kind), ["actor", "action"]);
  assert.deepEqual(atoms.map(({ value }) => value), [source, source]);
  assert.notEqual(atoms[0].id, atoms[1].id);
  await adapter.generate({ ...request, analysis });
  await adapter.repair({ ...request, analysis, candidate: { passages: [] }, verification: {
    decision: "repair", gates: {}, passages: [], issues: [], questions: [],
  } });
  for (const body of calls.slice(1)) {
    const payload = inertModelPayload(body);
    assert.deepEqual(payload.analysis[1][0][5].map(([id, kind, value]) => [id, kind, value]),
      atoms.map(({ id, kind, value }) => [id, kind, value]));
    assert.ok(body.messages[1].content.includes(source));
    assert.match(body.messages[0].content, /Interpret each excerpt by that atom's kind, evidence, and links/u);
    assert.match(body.messages[0].content, /Preserve every distinct commitment, including commitments sharing one excerpt/u);
    assert.match(body.messages[0].content, /designated exact literals and annotations remain verbatim/u);
  }
  assert.equal(adapter.completionCapacity().used, 3);
});

test("draft and repair instructions distinguish result instances and meaning-preserving rewrite from retention", async () => {
  const base = minimalAnalysisRequest("A visitor places a blue notebook on the desk, reads the first page, and closes it.");
  const sourceSpans = latticeSourceSpansForBatch(base.batch);
  const request = { ...base, sourceSpans, analysisAtomLimit: 12 };
  for (const [disposition, masks, expected] of [
    [0, ["000", "000", "000", "000", "000"], "rewrite"],
    [1, ["100", "010", "001", "111", "101"], "retain-if-conformant"],
    [1, ["000", "000", "000", "000", "000"], "rewrite"],
  ]) {
    const calls = [];
    const adapter = createHuggingFaceLatticeAdapter({
      token: "server-token", fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body); calls.push(body);
        return successfulProviderResponse(calls.length === 1
          ? { d: 2, p: [[0, disposition, [[1, 0, 1, [0, 1, 2]]], masks]], l: [] }
          : { passages: [] });
      },
    });
    const analysis = await adapter.analyze(request);
    assert.equal(analysis.passages[0].disposition, expected);
    const draft = { ...request, analysis };
    await adapter.generate(draft);
    await adapter.repair({ ...draft, candidate: { passages: [] }, verification: {
      decision: "repair", gates: {}, passages: [], issues: [], questions: [],
    } });
    assert.equal(calls.length, 3);
    for (const body of calls.slice(1)) {
      const payload = inertModelPayload(body);
      assert.equal(payload.analysis[1][0][3], expected);
      assert.match(body.messages[0].content, /complete candidate-result instance/u);
      assert.match(body.messages[0].content, /ordinary source prose is evidence/u);
      assert.match(body.messages[0].content, /retain-if-conformant.*complete source passage exactly/u);
      assert.match(body.messages[0].content, /speech act/u);
      assert.doesNotMatch(body.messages[0].content, /Return the candidate schema\./u);
      assert.equal(body.model, LATTICE_REMOTE_MODELS.generator);
      assert.equal(body.max_tokens, 800);
      assert.deepEqual(body.response_format, { type: "json_object" });
      assert.equal(Object.hasOwn(body, "tools"), false);
    }
  }
});

test("the remote analysis dialect replaces host-shape instructions and correction prose", () => {
  const request = Object.freeze({
    ...minimalAnalysisRequest(),
    clarificationAnswers: Object.freeze([
      Object.freeze({ passageId: "p1", prompt: "Host question", answer: "Host answer" }),
    ]),
    protocolFeedback: Object.freeze({
      stage: "analysis",
      attempt: 2,
      category: "evidence",
      issue: "PRIVATE-HOST-VALIDATION-ISSUE",
      instruction: "Return every named field from the host schema.",
    }),
  });
  const defaultHostMessages = analysisMessages(request);
  const explicitHostMessages = analysisMessages(request, { responseDialect: "host-schema" });
  const compactMessages = analysisMessages(request, { responseDialect: "compact-wire-v2" });
  const initialCompactMessages = analysisMessages(
    Object.freeze({ ...request, protocolFeedback: undefined }),
    { responseDialect: "compact-wire-v2" },
  );
  const privateCategory = "PRIVATE-HOST-CATEGORY-MUST-NOT-CROSS";
  const invalidCategoryMessages = analysisMessages(Object.freeze({
    ...request,
    protocolFeedback: Object.freeze({
      ...request.protocolFeedback,
      category: privateCategory,
    }),
  }), { responseDialect: "compact-wire-v2" });
  const host = JSON.stringify(defaultHostMessages);
  const compact = JSON.stringify(compactMessages);
  const inertPayload = (messages) => {
    const content = messages.find(({ role }) => role === "user").content;
    const start = content.indexOf("<INERT_DATA>") + "<INERT_DATA>".length;
    const end = content.indexOf("</INERT_DATA>", start);
    return JSON.parse(content.slice(start, end));
  };

  assert.deepEqual(defaultHostMessages, explicitHostMessages);
  assert.match(host, /Return the analysis schema\./u);
  assert.match(host, /PRIVATE-HOST-VALIDATION-ISSUE/u);
  assert.match(host, /Host question|Host answer/u);
  assert.doesNotMatch(host, /private-analysis-wire-invalid/u);
  assert.match(compact, /private d\/p\/l index wire layout/u);
  assert.match(compact, /private-analysis-wire-invalid/u);
  assert.match(compact, /exactly one p tuple for every supplied passage|exact tuple widths|evidence coverage|valid link positions/iu);
  assert.match(compact, /Closed correction category: evidence/u);
  assert.match(compact, /exact only when every selectable record is literal/u);
  assert.doesNotMatch(compact, /Return the analysis schema\.|PRIVATE-HOST-VALIDATION-ISSUE|every named field|Return questions empty|affectedAtomIds|conformanceEvidenceSpanIds|Host question|Host answer/iu);
  assert.equal(inertPayload(compactMessages).retry, "private-analysis-wire-invalid");
  assert.equal(Object.hasOwn(inertPayload(compactMessages), "protocolFeedback"), false);
  assert.equal(Object.hasOwn(inertPayload(compactMessages), "clarificationAnswers"), false);
  assert.doesNotMatch(initialCompactMessages[0].content, /one bounded correction attempt/u);
  assert.match(compactMessages[0].content, /one bounded correction attempt/u);
  assert.doesNotMatch(compactMessages[1].content, /one bounded correction attempt/u);
  assert.match(invalidCategoryMessages[0].content, /Closed correction category: other/u);
  assert.doesNotMatch(JSON.stringify(invalidCategoryMessages), new RegExp(privateCategory, "u"));
  assert.deepEqual(inertPayload(invalidCategoryMessages), inertPayload(compactMessages));
  assert.throws(
    () => analysisMessages(request, { responseDialect: "unknown" }),
    /invalid analysis response dialect/u,
  );
});

test("compact requested modes never demand a rationale outside the fitted analysis wire", async (t) => {
  for (const requestedMode of ["operative", "experiential"]) {
    for (const correction of [false, true]) {
      await t.test(`${requestedMode} ${correction ? "correction" : "initial"}`, async () => {
        const request = Object.freeze({
          ...minimalAnalysisRequest("A visitor closes the notebook."),
          requestedMode,
          ...(correction ? { protocolFeedback: Object.freeze({
            stage: "analysis", attempt: 2, category: "evidence",
            issue: "PRIVATE-HOST-MODE-FEEDBACK", instruction: "Explain a mode deviation in prose.",
          }) } : {}),
        });
        const selectedLayer = requestedMode === "operative" ? "experiential" : "operative";
        const calls = [];
        const adapter = createHuggingFaceLatticeAdapter({
          token: "server-token",
          requestedMode,
          fetchImpl: async (_url, init) => {
            const body = JSON.parse(init.body);
            calls.push(body);
            return successfulProviderResponse({
              d: 2, p: [[selectedLayer === "operative" ? 0 : 1, 0,
                [[1, 0, 1, [0]]], ["0", "0", "0", "0", "0"]]], l: [],
            });
          },
        });
        const result = await adapter.analyze(request);
        assert.equal(calls.length, 1);
        const body = calls[0];
        const instructions = body.messages.filter(({ role }) => role === "system")
          .map(({ content }) => content).join("\n");
        assert.equal(inertModelPayload(body).requestedMode, requestedMode);
        assert.match(instructions, new RegExp(`Requested mode: ${requestedMode}`, "u"));
        assert.match(instructions, /Semantic fidelity, safety, accessibility, and supported mixed functions override the preference/u);
        assert.match(instructions, /The host derives each bounded atom value from its selected source evidence; discourse function and rationale provide generic guidance/u);
        assert.match(instructions, /do not emit free-text planning fields/u);
        assert.doesNotMatch(instructions, /Explain deviations in the rationale|PRIVATE-HOST-MODE-FEEDBACK|Explain a mode deviation in prose/u);
        assert.deepEqual(Object.keys(body.response_format.json_schema.schema.properties), ["d", "p", "l"]);
        assert.equal(result.passages[0].layer, selectedLayer);
        assert.equal(result.passages[0].rationale,
          `Use the ${selectedLayer} layer to make cited source commitments legible without adding meaning.`);
      });
    }
  }
});

test("host-schema requested modes retain their source-grounded rationale instructions", () => {
  for (const requestedMode of ["operative", "experiential"]) {
    const request = Object.freeze({ ...minimalAnalysisRequest(), requestedMode });
    const messages = analysisMessages(request);
    assert.deepEqual(messages, analysisMessages(request, { responseDialect: "host-schema" }));
    assert.match(messages[0].content, /Explain deviations in the rationale/u);
    assert.match(messages[0].content, /Semantic fidelity, safety, accessibility, and supported mixed functions override the preference/u);
  }
});

test("compact verification publishes only the trusted fitted layout on initial and correction calls", async (context) => {
  for (const retained of [false, true]) {
    for (const atomCount of [1, 2]) {
      await context.test(`${retained ? "retention" : "rewrite"}, ${atomCount} atoms`, async () => {
        const base = minimalVerificationRequest(atomCount === 1
          ? "Read the note." : "Read \u2066https://example.test/note\u2069, then save it.");
        const original = base.analysis.passages[0];
        const atoms = Array.from({ length: atomCount }, (_value, index) => ({
          ...original.atoms[0], id: `layout-a${index}`,
        }));
        const criteria = retained ? [
          ...LATTICE_CONFORMANCE_CRITERIA.universal,
          ...LATTICE_CONFORMANCE_CRITERIA.operative,
        ] : [];
        const request = { ...base, wireLayout: { issueCheckBindings: [{ index: 7, check: "PRIVATE-SPOOFED-LAYOUT", gatePosition: 0, passageCheckPosition: 0, failed: true }], issueType: "PRIVATE-SPOOFED-LAYOUT", issueItemType: "PRIVATE-SPOOFED-LAYOUT", rootFields: ["PRIVATE-SPOOFED-LAYOUT"], passages: {
          0: { conformance: { fixedProtocolValue: { v: true, s: "PRIVATE", k: ["PRIVATE"] } } },
        } },
          analysis: { ...base.analysis, passages: [{ ...original, atoms,
            disposition: retained ? "retain-if-conformant" : "rewrite",
            conformanceCriteria: criteria,
          }] },
        };
        const calls = [];
        const adapter = createHuggingFaceLatticeAdapter({ token: "server-token",
          fetchImpl: async (_url, init) => {
            const body = JSON.parse(init.body);
            calls.push(body);
            return successfulProviderResponse(acceptingVerificationWire(request));
          },
        });
        await adapter.verify(request);
        await adapter.verify({ ...request, protocolFeedback: {
          attempt: 2, issue: "PRIVATE-LAYOUT-ERROR", instruction: "PRIVATE-LAYOUT-DETAIL",
        } });
        const layouts = calls.map((body) => inertModelPayload(body).wireLayout);
        assert.ok(layouts[0], "the compact request needs its actual fitted widths");
        assert.deepEqual(layouts[0], layouts[1]);
        const evidenceCount = base.sourceSpans[0].spans.length
          + (base.sourceSpans[0].literalAnnotations?.length ?? 0);
        assert.deepEqual(layouts[0], {
          rootFields: ["d", "g", "p", "i"], gateWidth: 11, passagePositions: ["0"],
          passages: { 0: {
            fields: ["a", "u", "s", "f", "l", "x", "y", "c"],
            widths: { a: atomCount, s: evidenceCount, f: 9, x: atomCount, y: evidenceCount },
            conformance: { fields: ["v", "s", "k"], spanWidth: evidenceCount,
              criterionCount: criteria.length, criterionFields: ["v", "s"],
              criterionSpanWidth: evidenceCount,
              ...(retained ? {} : { fixedProtocolValue: { v: false, s: "0".repeat(evidenceCount), k: [] } }) },
          } }, issueType: "array", issueItemType: "object", issueFields: ["c", "p"],
          issueCheckBindings: EXPECTED_ISSUE_CHECK_BINDINGS,
        });
        for (const body of calls) {
          const schema = fittedVerificationSchemaForBody(body);
          const layout = inertModelPayload(body).wireLayout;
          assert.deepEqual(layout.rootFields, schema.required);
          assert.equal(layout.issueType, schema.properties.i.type);
          assert.equal(layout.issueItemType, schema.properties.i.items.type);
          assert.deepEqual(layout.issueFields, schema.properties.i.items.required);
          assert.deepEqual(layout.issueCheckBindings, EXPECTED_ISSUE_CHECK_BINDINGS);
          assert.match(body.messages[0].content, /issueCheckBindings/u);
          assert.match(body.messages[0].content, /Never use a gate or passage-check bit position as the issue index/u);
          assert.match(body.messages[0].content, /null position means the check has no slot in that mask/u);
          assert.equal(Object.hasOwn(layout, "issueDefault"), false);
          assert.deepEqual(layout.passagePositions, schema.properties.p.required);
          const passage = schema.properties.p.properties["0"].properties;
          for (const [key, width] of Object.entries(layout.passages["0"].widths)) {
            assert.equal(fittedStringLength(passage[key]), width);
            assert.equal(fittedStringLength(passage[key]), width);
          }
          assert.equal(passage.c.properties.k.minItems, criteria.length);
          const conformanceLayout = layout.passages["0"].conformance;
          assert.equal(Object.hasOwn(conformanceLayout, "fixedProtocolValue"), !retained);
          if (!retained) {
            assert.equal(conformanceLayout.fixedProtocolValue.v, passage.c.properties.v.enum[0]);
            assert.equal(conformanceLayout.fixedProtocolValue.s, passage.c.properties.s.enum[0]);
            assert.equal(passage.c.properties.k.maxItems, 0);
            assert.deepEqual(conformanceLayout.fixedProtocolValue.k, []);
          }
          assert.match(body.messages[0].content, /copy that schema-fixed object only into the corresponding passage c/u);
          assert.match(body.messages[0].content, /must never populate x, y, d, g or f/u);
          assert.match(body.messages[0].content, /wireLayout.*exact required fields and widths/u);
          assert.doesNotMatch(JSON.stringify(body), /PRIVATE-SPOOFED-LAYOUT|PRIVATE-LAYOUT-|V01F|V14L/u);
        }
        assert.equal(Object.hasOwn(inertModelPayload({ messages: verificationMessages(request) }), "wireLayout"), false);
        assert.deepEqual(verificationMessages(request), verificationMessages(request, { responseDialect: "host-schema" }));
        assert.equal(adapter.completionCapacity().used, 2);
      });
    }
  }
});

test("the complete fitted verifier request enforces its exact UTF-8 byte boundary", async () => {
  const request = minimalVerificationRequest("Read \u2066https://example.test/note\u2069 and write café.");
  let measuredBytes;
  const response = () => successfulProviderResponse(acceptingVerificationWire(request));
  await createHuggingFaceLatticeAdapter({ token: "server-token", fetchImpl: async (_url, init) => {
    measuredBytes = Buffer.byteLength(init.body, "utf8");
    assert.ok(inertModelPayload(JSON.parse(init.body)).wireLayout);
    return response();
  } }).verify(request);
  let allowedFetches = 0;
  await createHuggingFaceLatticeAdapter({ token: "server-token", maximumRequestBytes: measuredBytes,
    fetchImpl: async () => { allowedFetches += 1; return response(); },
  }).verify(request);
  assert.equal(allowedFetches, 1);
  let rejectedFetches = 0;
  const rejected = createHuggingFaceLatticeAdapter({ token: "server-token",
    maximumRequestBytes: measuredBytes - 1,
    fetchImpl: async () => { rejectedFetches += 1; return response(); },
  });
  await assert.rejects(rejected.verify(request), (error) => error instanceof LatticeProviderError
    && error.code === "provider_request_too_large" && error.qualificationStage === "verification");
  assert.equal(rejectedFetches, 0);
});

test("compact verification binds complete mask positions on initial and correction calls", async (context) => {
  const base = minimalVerificationRequest("Read \u2066https://example.test/note\u2069, then save the note.");
  const plan = base.analysis.passages[0];
  const atoms = [plan.atoms[0], { ...plan.atoms[0], id: "a2" }];
  const evidence = [...base.sourceSpans[0].spans, ...base.sourceSpans[0].literalAnnotations];
  assert.ok(base.sourceSpans[0].literalAnnotations.length > 0);
  assert.notEqual(atoms.length, evidence.length);
  const request = {
    ...base,
    analysis: { ...base.analysis, passages: [{ ...plan, atoms }] },
  };
  for (const correction of [false, true]) {
    await context.test(correction ? "bounded correction" : "initial", async () => {
      const current = { ...request, ...(correction ? { protocolFeedback: {
        attempt: 2, issue: "PRIVATE-MASK-HOST-ERROR", instruction: "PRIVATE-MASK-HOST-DETAIL",
      } } : {}) };
      let calls = 0;
      const wire = acceptingVerificationWire(current);
      const passage = { ...wire.p["0"], x: "01", y: "0".repeat(evidence.length - 1) + "1" };
      const adapter = createHuggingFaceLatticeAdapter({
        token: "server-token",
        fetchImpl: async (_url, init) => {
          calls += 1;
          const body = JSON.parse(init.body);
          const instructions = body.messages[0].content;
          for (const guide of [instructions]) {
            assert.match(guide, /a and x have one character for every supplied atom, in supplied atom order/u);
            assert.match(guide, /Keep zero positions for unselected atoms; x must be exactly as long as a/u);
            assert.match(guide, /lossless spans first, then nested literal annotations, each in supplied order/u);
            assert.match(guide, /y must be exactly as long as s/u);
            assert.match(guide, /complete widths apply to every decision/u);
          }
          assert.doesNotMatch(JSON.stringify(body), /PRIVATE-MASK-HOST|V16L|V17M/u);
          const schema = fittedVerificationSchemaForBody(body).properties.p.properties["0"].properties;
          assert.equal(fittedStringLength(schema.a), atoms.length);
          assert.equal(fittedStringLength(schema.x), atoms.length);
          assert.equal(fittedStringLength(schema.s), evidence.length);
          assert.equal(fittedStringLength(schema.y), evidence.length);
          assert.equal(body.max_tokens, 2_048);
          assert.equal(body.response_format.type, "json_schema");
          return successfulProviderResponse({ ...wire, p: { 0: passage } });
        },
      });
      const result = await adapter.verify(current);
      assert.equal(result.decision, "accept");
      assert.deepEqual(result.passages[0].layerEvidenceAtomIds, ["a2"]);
      assert.deepEqual(result.passages[0].layerEvidenceSpanIds, [evidence.at(-1).id]);
      assert.equal(calls, 1);
      assert.equal(adapter.completionCapacity().used, 1);
    });
  }
});

test("compact verifier and certifier dialects replace host-shape output and private correction prose", () => {
  const privateFeedback = Object.freeze({
    stage: "verification",
    attempt: 2,
    issue: "PRIVATE-HOST-VERIFICATION-ISSUE",
    instruction: "Return every verbose host field.",
  });
  const verificationRequest = Object.freeze({
    ...minimalVerificationRequest(),
    protocolFeedback: privateFeedback,
  });
  const defaultVerification = verificationMessages(verificationRequest);
  const compactVerification = verificationMessages(
    verificationRequest,
    { responseDialect: "compact-wire-v2" },
  );
  const certificationRequest = Object.freeze({
    certificateId: "certificate:prompt-dialect",
    obligationIds: Object.freeze(["document:whole"]),
    source: "Original source.",
    candidate: "Candidate source.",
    protocolFeedback: privateFeedback,
  });
  const defaultCertification = documentCertificationMessages(certificationRequest);
  const compactCertification = documentCertificationMessages(
    certificationRequest,
    { responseDialect: "compact-wire-v2" },
  );
  const inertPayload = (messages) => {
    const content = messages.find(({ role }) => role === "user").content;
    const start = content.indexOf("<INERT_DATA>") + "<INERT_DATA>".length;
    const end = content.indexOf("</INERT_DATA>", start);
    return JSON.parse(content.slice(start, end));
  };

  assert.match(JSON.stringify(defaultVerification), /Return the verification schema/u);
  assert.match(JSON.stringify(defaultVerification), /PRIVATE-HOST-VERIFICATION-ISSUE/u);
  assert.match(JSON.stringify(compactVerification), /private fitted d\/g\/p\/i index-and-mask wire layout/u);
  assert.match(JSON.stringify(compactVerification), /private-verification-wire-invalid/u);
  assert.doesNotMatch(
    JSON.stringify(compactVerification),
    /passage tuple already|Each i tuple|fitted conformance tuple|negative empty conformance tuple/u,
  );
  assert.doesNotMatch(
    JSON.stringify(compactVerification),
    /Return the verification schema|PRIVATE-HOST-VERIFICATION-ISSUE|every verbose host field/u,
  );
  assert.deepEqual(inertPayload(compactVerification).retry, "private-verification-wire-invalid");
  assert.equal(Object.hasOwn(inertPayload(compactVerification), "protocolFeedback"), false);

  assert.match(JSON.stringify(defaultCertification), /Return the document-certification schema/u);
  assert.match(JSON.stringify(defaultCertification), /PRIVATE-HOST-VERIFICATION-ISSUE/u);
  assert.match(JSON.stringify(compactCertification), /private c\/o\/d\/k\/i wire layout/u);
  assert.match(JSON.stringify(compactCertification), /private-certification-wire-invalid/u);
  assert.doesNotMatch(
    JSON.stringify(compactCertification),
    /fixed boolean tuple|check tuple|index, tuple/u,
  );
  assert.doesNotMatch(
    JSON.stringify(compactCertification),
    /Return the document-certification schema|PRIVATE-HOST-VERIFICATION-ISSUE|every verbose host field/u,
  );
  assert.deepEqual(inertPayload(compactCertification).retry, "private-certification-wire-invalid");
  assert.equal(Object.hasOwn(inertPayload(compactCertification), "protocolFeedback"), false);
  assert.throws(
    () => verificationMessages(verificationRequest, { responseDialect: "unknown" }),
    /invalid verification response dialect/u,
  );
  assert.throws(
    () => documentCertificationMessages(certificationRequest, { responseDialect: "unknown" }),
    /invalid certification response dialect/u,
  );
});

test("the adapter uses strict JSON Schema analysis and certification", async () => {
  assert.equal(LATTICE_PROVIDER_CALL_TIMEOUT_MS, 120_000);
  assert.deepEqual(LATTICE_PROVIDER_STAGE_CALL_TIMEOUTS_MS, {
    analysis: 120_000,
    candidate: 120_000,
    verification: 180_000,
    certification: 120_000,
    repair: 120_000,
  });
  assert.equal(Object.isFrozen(LATTICE_PROVIDER_STAGE_CALL_TIMEOUTS_MS), true);
  assert.equal(LATTICE_PROVIDER_MAX_CALL_TIMEOUT_MS, 180_000);
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return calls.length === 1
      ? successfulProviderResponse({ d: "instruction", p: [], q: [] })
      : successfulProviderResponse(acceptingCertificationWire(
        "certificate:test",
        ["document:whole"],
      ));
  };
  const adapter = createHuggingFaceLatticeAdapter({
    token: "hf_server_only_token",
    requestedMode: "experiential",
    fetchImpl,
    callTimeoutMs: 1_000,
  });
  const analysisRequest = Object.freeze({
    ...minimalAnalysisRequest(),
    analysisAtomLimit: 4,
  });
  await adapter.analyze(analysisRequest);
  await adapter.certify({
    certificateId: "certificate:test",
    obligationIds: Object.freeze(["document:whole"]),
    source: "Original source.",
    candidate: "Candidate source.",
    analysis: null,
    signal: new AbortController().signal,
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(new Set(calls.map(({ url }) => url)), new Set([HUGGING_FACE_CHAT_COMPLETIONS_URL]));
  assert.deepEqual(calls.map(({ body }) => body.model), [
    LATTICE_REMOTE_MODELS.generator,
    LATTICE_REMOTE_MODELS.verifier,
  ]);
  assert.equal(
    LATTICE_REMOTE_MODELS.generator,
    "Qwen/Qwen3-Next-80B-A3B-Instruct:deepinfra",
  );
  assert.equal(
    LATTICE_REMOTE_MODELS.verifier,
    "meta-llama/Llama-3.1-8B-Instruct:nscale",
  );
  assert.deepEqual(calls.map(({ body }) => body.max_tokens), [768, 520]);
  assert.deepEqual(calls.map(({ body }) => body.temperature), [0.7, 0]);
  assert.deepEqual(calls.map(({ body }) => body.top_p), [0.8, 1]);
  assert.deepEqual(calls.map(({ body }) => body.seed), [71_903, 71_903]);
  for (const { init, body } of calls) {
    const expectedKeys = [
      "max_tokens",
      "messages",
      "model",
      "seed",
      "stream",
      "temperature",
      "top_p",
    ];
    expectedKeys.push("response_format");
    assert.deepEqual(Object.keys(body).sort(), expectedKeys.sort());
    assert.equal(init.method, "POST");
    assert.equal(init.cache, "no-store");
    assert.equal(init.credentials, "omit");
    assert.equal(init.redirect, "manual");
    assert.equal(init.referrerPolicy, "no-referrer");
    assert.equal(init.headers.Authorization, "Bearer hf_server_only_token");
    assert.equal(body.stream, false);
  }
  const analysisBody = calls[0].body;
  const analysisContract = analysisBody.response_format.json_schema;
  const analysisParameters = analysisContract.schema;
  assert.equal(analysisBody.response_format.type, "json_schema");
  assert.equal(analysisContract.name, ANALYSIS_TOOL_NAME);
  assert.equal(analysisContract.strict, true);
  assert.deepEqual(
    Object.keys(analysisContract).sort(),
    ["description", "name", "schema", "strict"],
  );
  assert.equal(Object.hasOwn(analysisBody, "parallel_tool_calls"), false);
  assert.equal(Object.hasOwn(analysisBody, "tool_choice"), false);
  assert.equal(Object.hasOwn(analysisBody, "tools"), false);
  assert.match(
    analysisContract.description,
    /Return one complete private fitted d\/p\/l analysis result/u,
  );
  assert.equal(analysisParameters.type, "object");
  assert.equal(analysisParameters.additionalProperties, false);
  assert.deepEqual(analysisParameters.required, ["d", "p", "l"]);
  assert.deepEqual(Object.keys(analysisParameters.properties).sort(), ["d", "l", "p"]);
  assert.deepEqual(
    [analysisParameters.properties.d.minimum, analysisParameters.properties.d.maximum],
    [0, 8],
  );
  assert.equal(analysisParameters.properties.p.type, "array");
  assert.equal(analysisParameters.properties.p.minItems, 1);
  assert.equal(analysisParameters.properties.p.maxItems, 1);
  assert.equal(Object.hasOwn(analysisParameters.properties.p, "items"), false);
  assert.equal(analysisParameters.properties.p.prefixItems.length, 1);
  assert.equal(analysisParameters.properties.p.prefixItems[0].type, "array");
  assert.equal(analysisParameters.properties.p.prefixItems[0].prefixItems.length, 4);
  const passageTuple = analysisParameters.properties.p.prefixItems[0].prefixItems;
  assert.deepEqual([passageTuple[0].minimum, passageTuple[0].maximum], [0, 4]);
  assert.deepEqual([passageTuple[1].minimum, passageTuple[1].maximum], [0, 1]);
  assert.equal(passageTuple[2].maxItems, 4);
  const atomTuple = passageTuple[2].items.prefixItems;
  assert.equal(atomTuple.length, 4);
  assert.deepEqual([atomTuple[0].minimum, atomTuple[0].maximum], [0, 19]);
  assert.deepEqual([atomTuple[1].minimum, atomTuple[1].maximum], [0, 2]);
  assert.deepEqual([atomTuple[2].minimum, atomTuple[2].maximum], [1, 2]);
  assert.deepEqual(
    [atomTuple[3].minItems, atomTuple[3].maxItems, atomTuple[3].items.minimum, atomTuple[3].items.maximum],
    [1, 3, 0, 0],
  );
  assert.equal(passageTuple[3].prefixItems.length, 5);
  assert.deepEqual(passageTuple[3].prefixItems.map(({ pattern }) => pattern), Array(5).fill("^[01]{1}$"));
  assert.equal(passageTuple[3].prefixItems.every((schema) => (
    !Object.hasOwn(schema, "minLength") && !Object.hasOwn(schema, "maxLength")
  )), true);
  assert.equal(analysisParameters.properties.l.maxItems, 4);
  const linkTuple = analysisParameters.properties.l.items.prefixItems;
  assert.deepEqual([linkTuple[0].minimum, linkTuple[0].maximum], [0, 3]);
  assert.deepEqual([linkTuple[1].minimum, linkTuple[1].maximum], [0, 23]);
  assert.deepEqual([linkTuple[2].minimum, linkTuple[2].maximum], [0, 3]);
  const certificationSchema = strictReviewSchema(calls[1].body, CERTIFICATION_TOOL_NAME);
  assert.equal(Object.hasOwn(calls[0].body, "chat_template_kwargs"), false);
  assert.equal(Object.hasOwn(calls[0].body, "top_k"), false);
  assert.equal(Object.hasOwn(calls[0].body, "min_p"), false);
  assert.equal(Object.hasOwn(calls[0].body, "presence_penalty"), false);
  assert.equal(Object.hasOwn(calls[1].body, "chat_template_kwargs"), false);
  assert.equal(Object.hasOwn(calls[1].body, "top_k"), false);
  assert.equal(Object.hasOwn(calls[1].body, "min_p"), false);
  assert.equal(Object.hasOwn(calls[1].body, "presence_penalty"), false);
  assert.match(calls[0].body.messages[0].content, /Response contract lattice_analysis_wire_v2/u);
  assert.doesNotMatch(calls[0].body.messages[0].content, /Call this function exactly once/u);
  assert.match(calls[0].body.messages[0].content, /Return exactly one JSON object satisfying the supplied strict JSON Schema/u);
  assert.match(calls[0].body.messages[0].content, /private d\/p\/l index wire layout/u);
  assert.doesNotMatch(calls[0].body.messages[0].content, /Return the analysis schema\./u);
  assert.equal(analysisContract.description, "Return one complete private fitted d/p/l analysis result.");
  assert.match(calls[0].body.messages[0].content, /smallest complete atom graph allowed by the fitted cap/u);
  assert.doesNotMatch(
    calls[0].body.messages[0].content,
    /documentKind|passageId|discourseFunction|ambiguityAtomIds|conformanceCriteria|conformanceEvidenceSpanIds|conformanceAssertions|evidenceSpanIds|targetAtomId/u,
  );
  assert.doesNotMatch(JSON.stringify(calls[0].body.messages), /LATTICE_RESPONSE_SCHEMA/u);
  assert.doesNotMatch(
    JSON.stringify(calls[0].body.messages),
    /Return one (?:complete )?d\/p analysis-result instance/u,
  );
  assert.equal(
    calls[0].body.messages[0].content.includes(analysisContract.description),
    false,
  );
  assert.equal(
    JSON.stringify(calls[0].body.messages).includes(JSON.stringify(analysisParameters)),
    false,
  );
  assert.equal(calls[0].body.messages[0].content.includes(JSON.stringify(REANALYSIS_SCHEMA)), false);
  assert.match(calls[1].body.messages[0].content, /Response contract lattice_certification_wire_v2/u);
  assert.match(calls[1].body.messages[0].content, /document-certification result/u);
  assert.match(calls[1].body.messages[0].content, /private c\/o\/d\/k\/i wire layout/u);
  assert.doesNotMatch(calls[1].body.messages[0].content, /Return the document-certification schema/u);
  assert.doesNotMatch(calls[1].body.messages[0].content, /Call this function exactly once/u);
  assert.equal(calls[1].body.messages[0].content.includes(JSON.stringify(DOCUMENT_CERTIFICATION_SCHEMA)), false);
  assert.deepEqual(certificationSchema.required, ["c", "o", "d", "k", "i"]);
  assert.deepEqual(certificationSchema.properties.c.enum, ["certificate:test"]);
  assert.deepEqual(certificationSchema.properties.o.items.enum, ["document:whole"]);
  assert.equal(certificationSchema.properties.k.items.type, "boolean");
  assert.equal(certificationSchema.properties.k.maxItems, 10);
  assert.equal(JSON.stringify(certificationSchema).includes("prefixItems"), false);
  assert.equal(JSON.stringify(calls[1].body.messages).includes(JSON.stringify(certificationSchema)), false);
  for (const { body } of calls) {
    assert.equal(body.messages.slice(1).some(({ content }) => (
      typeof content === "string" && content.includes("LATTICE_RESPONSE_SCHEMA")
    )), false);
  }
  assert.equal(calls[0].body.messages[0].content.includes(validPayload.text), false);
  assert.equal(calls[0].body.messages.slice(1).some(({ content }) => (
    typeof content === "string" && content.includes(validPayload.text)
  )), true);
  assert.match(calls[0].body.messages[0].content, /Requested mode: experiential/u);
  assert.doesNotMatch(calls[0].body.messages[0].content, /\/no_think/u);
  assert.doesNotMatch(calls[1].body.messages[0].content, /\/no_think/u);
});

test("analysis schemas fit canary, one-word, and multipassage atom and evidence budgets", async () => {
  const bodies = [];
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return successfulProviderResponse({ d: "instruction", p: [], q: [] });
    },
  });
  const canaryText = "A visitor places a blue notebook on the desk, reads the first page, and closes it.";
  const canaryBase = minimalAnalysisRequest(canaryText);
  const canary = Object.freeze({
    ...canaryBase,
    analysisAtomLimit: 12,
    sourceSpans: latticeSourceSpansForBatch(canaryBase.batch),
  });
  const [leftCanaryPassage] = splitLatticePassage(canaryBase.batch.passages[0]);
  const leftCanaryBatch = Object.freeze({
    id: `${canaryBase.batch.id}a`,
    passages: Object.freeze([leftCanaryPassage]),
    wordCount: leftCanaryPassage.wordCount,
    characterCount: leftCanaryPassage.text.length,
  });
  const splitCanaryChild = Object.freeze({
    ...canary,
    batch: leftCanaryBatch,
    analysisAtomLimit: 6,
    sourceSpans: latticeSourceSpansForBatch(leftCanaryBatch),
  });
  const oneWordBase = minimalAnalysisRequest("A");
  const oneWord = Object.freeze({
    ...oneWordBase,
    analysisAtomLimit: 4,
    sourceSpans: latticeSourceSpansForBatch(oneWordBase.batch),
  });
  const terminalOneWord = Object.freeze({
    ...oneWord,
    analysisAtomLimit: 1,
  });
  const multipassageBase = minimalAnalysisRequest("One.\n\nTwo three four.");
  const [firstPassage, secondPassage] = multipassageBase.batch.passages;
  const evidenceRecord = (id, text) => Object.freeze({ id, kind: "source", text });
  const multipassage = Object.freeze({
    ...multipassageBase,
    analysisAtomLimit: 3,
    sourceSpans: Object.freeze([
      Object.freeze({
        passageId: firstPassage.id,
        spans: Object.freeze([evidenceRecord(`${firstPassage.id}:s01`, firstPassage.text)]),
        literalAnnotations: Object.freeze([]),
      }),
      Object.freeze({
        passageId: secondPassage.id,
        spans: Object.freeze([
          evidenceRecord(`${secondPassage.id}:s01`, "Two"),
          evidenceRecord(`${secondPassage.id}:s02`, "three"),
        ]),
        literalAnnotations: Object.freeze([
          Object.freeze({ id: `${secondPassage.id}:l01`, literalType: "quoted", text: "four" }),
          Object.freeze({ id: `${secondPassage.id}:l02`, literalType: "quoted", text: "." }),
        ]),
      }),
    ]),
  });
  const skewedBase = minimalAnalysisRequest(
    "One two three four five six seven eight nine ten eleven twelve.\n\nLast.",
  );
  const skewed = Object.freeze({
    ...skewedBase,
    analysisAtomLimit: 4,
  });
  const allLiteralBase = minimalAnalysisRequest("https://example.com");
  const allLiteral = Object.freeze({
    ...allLiteralBase,
    analysisAtomLimit: 4,
    sourceSpans: latticeSourceSpansForBatch(allLiteralBase.batch),
  });

  await adapter.analyze(canary);
  await adapter.analyze(splitCanaryChild);
  await adapter.analyze(oneWord);
  await adapter.analyze(multipassage);
  await adapter.analyze(skewed);
  await adapter.analyze(allLiteral);
  await adapter.analyze(terminalOneWord);

  assert.deepEqual(
    bodies.map(({ max_tokens: maxTokens }) => maxTokens),
    [1_024, 768, 768, 768, 768, 768, 768],
  );
  const schemas = bodies.map(({ response_format: responseFormat }) => (
    responseFormat.json_schema.schema
  ));
  const passageTuples = schemas.map((schema) => (
    schema.properties.p.prefixItems.map(({ prefixItems }) => prefixItems)
  ));
  assert.deepEqual(passageTuples.slice(0, 3).map(([tuple]) => tuple[2].maxItems), [12, 6, 4]);
  assert.deepEqual(
    passageTuples.slice(0, 3).map(([tuple]) => tuple[2].items.prefixItems[3].items.maximum),
    [2, 1, 0],
  );
  assert.deepEqual(
    passageTuples.slice(0, 3).map(([tuple]) => tuple[3].prefixItems[0].pattern),
    [
      "^[01]{3}$",
      "^[01]{2}$",
      "^[01]{1}$",
    ],
  );
  assert.deepEqual(
    passageTuples.slice(0, 3).map(([tuple]) => (
      [tuple[2].items.prefixItems[2].minimum, tuple[2].items.prefixItems[2].maximum]
    )),
    [
      [1, 2],
      [1, 2],
      [1, 2],
    ],
  );
  assert.deepEqual(schemas.slice(0, 3).map((schema) => schema.properties.l.maxItems), [12, 6, 4]);
  assert.deepEqual(
    schemas.slice(0, 3).map((schema) => schema.properties.l.items.prefixItems[0].maximum),
    [11, 5, 3],
  );
  let denseState = 0x51f15e;
  const denseHex = (length) => Array.from({ length }, () => {
    denseState = (Math.imul(denseState, 1_664_525) + 1_013_904_223) >>> 0;
    return (denseState >>> 28).toString(16);
  }).join("");
  const maximalCanaryWire = JSON.stringify(maximalJsonSchemaValue(
    schemas[0],
    (length, schema) => schema.pattern?.includes("[01]") ? "1".repeat(length) : denseHex(length),
  ));
  assert.ok(maximalCanaryWire.length < 500, maximalCanaryWire.length);
  assert.equal(Object.hasOwn(schemas[0].properties.p, "items"), false);
  assert.equal(Object.hasOwn(schemas[1].properties.p, "items"), false);

  const multiTuples = passageTuples[3];
  assert.deepEqual(multiTuples.map((tuple) => tuple[2].maxItems), [1, 2]);
  assert.deepEqual(multiTuples.map((tuple) => tuple[2].minItems), [1, 2]);
  assert.deepEqual(
    multiTuples.map((tuple) => [
      tuple[2].items.prefixItems[2].minimum,
      tuple[2].items.prefixItems[2].maximum,
    ]),
    [[1, 2], [1, 2]],
  );
  assert.equal(multiTuples.reduce((sum, tuple) => sum + tuple[2].maxItems, 0), 3);
  assert.equal(schemas[3].properties.l.maxItems, 3);
  const secondEvidence = [
    `${secondPassage.id}:s01`,
    `${secondPassage.id}:s02`,
    `${secondPassage.id}:l01`,
    `${secondPassage.id}:l02`,
  ];
  assert.equal(multiTuples[1][2].items.prefixItems[3].items.maximum, secondEvidence.length - 1);
  assert.equal(multiTuples[1][3].prefixItems.length, 5);
  assert.deepEqual(multiTuples[1][3].prefixItems.map(({ pattern }) => pattern), Array(5).fill(
    `^[01]{${secondEvidence.length}}$`,
  ));
  assert.deepEqual(passageTuples[4].map((tuple) => tuple[2].maxItems), [2, 2]);
  assert.deepEqual(
    [
      passageTuples[5][0][2].items.prefixItems[2].minimum,
      passageTuples[5][0][2].items.prefixItems[2].maximum,
    ],
    [0, 2],
  );
  const terminalSchema = schemas.at(-1);
  const terminalAtoms = terminalSchema.properties.p.prefixItems[0].prefixItems[2];
  assert.equal(terminalAtoms.minItems, 1);
  assert.equal(terminalAtoms.maxItems, 1);
  assert.deepEqual(
    terminalAtoms.prefixItems[0].prefixItems[3].prefixItems,
    [{ const: 0 }],
  );
  assert.equal(terminalSchema.properties.l.maxItems, 0);
  assert.doesNotMatch(JSON.stringify(schemas[2]), /"maxItems":(?:24|60)/u);
});

test("all five production stages use their exact provider response transport", async () => {
  const calls = [];
  const scheduledProviderDeadlines = [];
  const originalSetTimeout = globalThis.setTimeout;
  const base = minimalVerificationRequest();
  const { analysis, candidate } = base;
  const responses = [
    successfulProviderResponse({ d: "instruction", p: [], q: [] }),
    successfulProviderResponse({ passages: [] }),
    successfulProviderResponse(acceptingVerificationWire(base)),
    successfulProviderResponse(acceptingCertificationWire(
      "certificate:transport-matrix",
      ["document:whole"],
    )),
    successfulProviderResponse({ passages: [] }),
  ];
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body));
      return responses[calls.length - 1];
    },
  });
  const verification = Object.freeze({
    decision: "revise",
    gates: Object.freeze({}),
    passages: Object.freeze([]),
    issues: Object.freeze([]),
  });

  globalThis.setTimeout = (callback, milliseconds, ...args) => {
    scheduledProviderDeadlines.push(milliseconds);
    return originalSetTimeout(callback, milliseconds, ...args);
  };
  try {
    await adapter.analyze(base);
    await adapter.generate(Object.freeze({ ...base, analysis }));
    await adapter.verify(Object.freeze({ ...base, analysis, candidate }));
    await adapter.certify({
      certificateId: "certificate:transport-matrix",
      obligationIds: Object.freeze(["document:whole"]),
      source: "Original source.",
      candidate: "Candidate source.",
      analysis,
      signal: base.signal,
    });
    await adapter.repair(Object.freeze({ ...base, analysis, candidate, verification }));
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }

  assert.deepEqual(calls.map(({ model }) => model), [
    LATTICE_REMOTE_MODELS.generator,
    LATTICE_REMOTE_MODELS.generator,
    TEST_REVIEW_MODEL,
    LATTICE_REMOTE_MODELS.verifier,
    LATTICE_REMOTE_MODELS.generator,
  ]);
  assert.deepEqual(scheduledProviderDeadlines, [
    LATTICE_PROVIDER_STAGE_CALL_TIMEOUTS_MS.analysis,
    LATTICE_PROVIDER_STAGE_CALL_TIMEOUTS_MS.candidate,
    LATTICE_PROVIDER_STAGE_CALL_TIMEOUTS_MS.verification,
    LATTICE_PROVIDER_STAGE_CALL_TIMEOUTS_MS.certification,
    LATTICE_PROVIDER_STAGE_CALL_TIMEOUTS_MS.repair,
  ]);
  assert.deepEqual(calls.map(({ max_tokens }) => max_tokens), [768, 800, 2_048, 520, 800]);
  assert.equal(calls[0].response_format.type, "json_schema");
  assert.equal(calls[0].response_format.json_schema.strict, true);
  assert.equal(calls[0].response_format.json_schema.name, ANALYSIS_TOOL_NAME);
  for (const index of [1, 4]) {
    assert.deepEqual(calls[index].response_format, { type: "json_object" });
    assert.equal(Object.hasOwn(calls[index], "tools"), false);
    assert.equal(Object.hasOwn(calls[index], "tool_choice"), false);
  }
  const verificationSchema = fittedVerificationSchemaForBody(calls[2]);
  const certificationSchema = strictReviewSchema(calls[3], CERTIFICATION_TOOL_NAME);
  assert.match(calls[2].messages[0].content, /Response contract lattice_verification_wire_v2/u);
  assert.match(calls[3].messages[0].content, /Response contract lattice_certification_wire_v2/u);
  assert.equal(calls[2].messages[0].content.includes(JSON.stringify(VERIFICATION_SCHEMA)), false);
  assert.doesNotMatch(
    calls[2].messages[0].content,
    /passage tuple already|Each i tuple|fitted conformance tuple|negative empty conformance tuple/u,
  );
  assert.equal(calls[3].messages[0].content.includes(JSON.stringify(DOCUMENT_CERTIFICATION_SCHEMA)), false);
  assert.doesNotMatch(calls[3].messages[0].content, /fixed boolean tuple|check tuple/u);
  assert.deepEqual(verificationSchema.required, ["d", "g", "p", "i"]);
  assert.deepEqual(certificationSchema.required, ["c", "o", "d", "k", "i"]);
  for (const body of calls) assert.equal(Object.hasOwn(body, "parallel_tool_calls"), false);
});

test("compact verifier and certifier wires expand to the unchanged host schemas", async () => {
  const verificationRequest = minimalVerificationRequest();
  const evidenceIds = [
    ...verificationRequest.sourceSpans[0].spans,
    ...(verificationRequest.sourceSpans[0].literalAnnotations ?? []),
  ].map(({ id }) => id);
  const certificateId = "certificate:compact-round-trip";
  const obligationIds = Object.freeze(["document:whole", "boundary:0"]);
  const calls = [];
  const responses = [
    acceptingVerificationWire(verificationRequest),
    acceptingCertificationWire(certificateId, obligationIds),
  ];
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body));
      return calls.length === 1 ? successfulProviderResponse(responses[0])
        : successfulProviderResponse(responses[1]);
    },
  });

  const verification = await adapter.verify(verificationRequest);
  const certification = await adapter.certify({
    certificateId,
    obligationIds,
    source: validPayload.text,
    candidate: "Review the document, then save the approved revision.",
    analysis: verificationRequest.analysis,
    signal: verificationRequest.signal,
  });

  assert.deepEqual(verification, {
    decision: "accept",
    failedGates: [],
    passages: [{
      passageId: verificationRequest.batch.passages[0].id,
      checkedAtomIds: ["a1"],
      missingAtomIds: [],
      unsupportedClaims: [],
      unmodeledSpanIds: [],
      failedChecks: [],
      conformanceConfirmed: false,
      conformanceEvidenceSpanIds: [],
      independentLayer: "operative",
      layerEvidenceAtomIds: ["a1"],
      layerEvidenceSpanIds: evidenceIds,
      criterionChecks: [],
    }],
    issues: [],
    questions: [],
  });
  assert.deepEqual(certification, {
    certificateId,
    obligationIds: [...obligationIds],
    decision: "accept",
    checks: {
      semanticFidelity: true,
      identityRolesAttribution: true,
      chronology: true,
      causality: true,
      modalityPolarity: true,
      ambiguityPreservation: true,
      noUnsupportedMeaning: true,
      registerConformance: true,
      boundaryFidelity: true,
      documentConsistency: true,
    },
    issues: [],
  });

  const verificationSchema = fittedVerificationSchemaForBody(calls[0]);
  const verificationPassage = verificationSchema.properties.p.properties["0"];
  assert.deepEqual(verificationSchema.required, ["d", "g", "p", "i"]);
  assert.deepEqual(verificationSchema.properties.p.required, ["0"]);
  assert.deepEqual(verificationPassage.required, ["a", "u", "s", "f", "l", "x", "y", "c"]);
  assert.equal(fittedStringLength(verificationPassage.properties.a), 1);
  assert.equal(fittedStringLength(verificationPassage.properties.s), evidenceIds.length);
  assert.equal(fittedStringLength(verificationPassage.properties.f), 9);
  assert.equal(verificationPassage.properties.x.pattern, "^(?:0{0}1[01]{0})$");
  assert.equal(fittedStringLength(verificationPassage.properties.x), 1);
  assert.equal(fittedStringLength(verificationPassage.properties.x), 1);
  assert.equal(fittedStringLength(verificationPassage.properties.y), evidenceIds.length);
  assert.deepEqual(verificationPassage.properties.c.properties.v.enum, [false]);
  assert.deepEqual(
    verificationPassage.properties.c.properties.s.enum,
    ["0".repeat(evidenceIds.length)],
  );
  assert.equal(JSON.stringify(verificationSchema).includes("prefixItems"), false);
  assert.equal(calls[0].max_tokens, 2_048);
  assert.equal(calls[0].messages[0].content.includes(JSON.stringify(VERIFICATION_SCHEMA)), false);

  const certificationSchema = strictReviewSchema(calls[1], CERTIFICATION_TOOL_NAME);
  assert.deepEqual(certificationSchema.properties.c.enum, [certificateId]);
  assert.deepEqual(certificationSchema.properties.o.items.enum, [...obligationIds]);
  assert.equal(certificationSchema.properties.k.items.type, "boolean");
  assert.equal(certificationSchema.properties.k.maxItems, 10);
  assert.equal(JSON.stringify(certificationSchema).includes("prefixItems"), false);
  assert.equal(calls[1].max_tokens, 520);
  assert.equal(calls[1].messages[0].content.includes(JSON.stringify(DOCUMENT_CERTIFICATION_SCHEMA)), false);
});

test("the production canary completes through the compact verifier wire", async () => {
  const source = validPayload.text;
  const { batch, sourceSpans } = minimalVerificationRequest(source);
  const passageId = batch.passages[0].id;
  const evidenceIds = [
    ...sourceSpans[0].spans,
    ...(sourceSpans[0].literalAnnotations ?? []),
  ].map(({ id }) => id);
  const transformed = "First, open and review the document; then save the approved revision.";
  const calls = [];
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    requestedMode: "operative",
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      if (calls.length === 1) {
        return successfulProviderResponse({
          d: 2,
          p: [[
            0,
            0,
            [[
              1,
              0,
              1,
              evidenceIds.map((_id, index) => index),
            ]],
            Array(5).fill("0".repeat(evidenceIds.length)),
          ]],
          l: [],
        });
      }
      if (calls.length === 2) {
        const analysisAtomId = inertModelPayload(body).analysis[1][0][5][0][0];
        return successfulProviderResponse({
          passages: [{
            passageId,
            layer: "operative",
            text: transformed,
            preservedAtomIds: [analysisAtomId],
          }],
        });
      }
      if (calls.length === 3) {
        return successfulProviderResponse({
          d: 0,
          g: "0".repeat(11),
          p: {
            0: {
              a: "1",
              u: false,
              s: "0".repeat(evidenceIds.length),
              f: "0".repeat(9),
              l: 0,
              x: "1",
              y: "1".repeat(evidenceIds.length),
              c: { v: false, s: "0".repeat(evidenceIds.length), k: [] },
            },
          },
          i: [],
        });
      }
      return assert.fail("the single-passage canary must not require document certification");
    },
  });

  const result = await runTextToLattice(source, {
    adapter,
    requestedMode: "operative",
    allowClarification: false,
    signal: new AbortController().signal,
  });

  assert.equal(result.status, "translated");
  assert.equal(result.text, transformed);
  assert.equal(result.verificationPasses, 1);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map(({ max_tokens: maxTokens }) => maxTokens), [768, 800, 2_048]);
  fittedVerificationSchemaForBody(calls[2]);
});

test("the API Worker completes strict-schema verification and certification", async () => {
  const source = LATTICE_PRODUCTION_CANARY_TEXT;
  const preflight = preflightLatticeInput(source);
  assert.equal(preflight.batches.length, 1);
  assert.equal(preflight.batches[0].passages.length, 1);
  assert.equal(preflight.batches[0].passages[0].separatorAfter, "\n");
  const { batch, sourceSpans } = minimalVerificationRequest(source);
  const passageId = batch.passages[0].id;
  const evidenceIds = [
    ...sourceSpans[0].spans,
    ...(sourceSpans[0].literalAnnotations ?? []),
  ].map(({ id }) => id);
  const transformed = "First, open and review the document; then save the approved revision.";
  const calls = [];
  const worker = createLatticeApiWorker({
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      if (calls.length === 1) {
        return successfulProviderResponse({
          d: 2,
          p: [[
            0,
            0,
            [[
              1,
              0,
              1,
              evidenceIds.map((_id, index) => index),
            ]],
            Array(5).fill("0".repeat(evidenceIds.length)),
          ]],
          l: [],
        });
      }
      if (calls.length === 2) {
        const analysisAtomId = inertModelPayload(body).analysis[1][0][5][0][0];
        return successfulProviderResponse({
          passages: [{
            passageId,
            layer: "operative",
            text: transformed,
            preservedAtomIds: [analysisAtomId],
          }],
        });
      }
      if (calls.length === 3) {
        return successfulProviderResponse({
          d: 0,
          g: "0".repeat(11),
          p: {
            0: {
              a: "1",
              u: false,
              s: "0".repeat(evidenceIds.length),
              f: "0".repeat(9),
              l: 0,
              x: "1",
              y: "1".repeat(evidenceIds.length),
              c: { v: false, s: "0".repeat(evidenceIds.length), k: [] },
            },
          },
          i: [],
        });
      }
      if (calls.length === 4) {
        return successfulProviderResponse(acceptingCertificationWire(
          "certificate:document",
          ["document:whole"],
        ));
      }
      return assert.fail("the one-passage certification canary exceeded its four expected provider calls");
    },
  });

  const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST), {
    HF_TOKEN: "server-token",
  });
  const envelope = await json(response);

  assert.equal(response.status, 200);
  assert.equal(envelope.schema_version, 1);
  assert.equal(envelope.result.status, "translated");
  assert.equal(envelope.result.text, `${transformed}\n`);
  assert.equal(envelope.result.verificationPasses, 1);
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.map(({ model }) => model), [
    LATTICE_REMOTE_MODELS.generator,
    LATTICE_REMOTE_MODELS.generator,
    TEST_REVIEW_MODEL,
    LATTICE_REMOTE_MODELS.verifier,
  ]);
  assert.deepEqual(calls.map(({ max_tokens: maxTokens }) => maxTokens), [1_024, 800, 2_048, 520]);
  assert.equal(inertModelPayload(calls[0]).requestedMode, "operative");
  assert.match(calls[0].messages[0].content, /never ask a public question/u);
  fittedVerificationSchemaForBody(calls[2]);
  const certificationSchema = strictReviewSchema(calls[3], CERTIFICATION_TOOL_NAME);
  assert.deepEqual(certificationSchema.properties.c.enum, ["certificate:document"]);
  assert.deepEqual(certificationSchema.properties.o.items.enum, ["document:whole"]);
  assert.deepEqual(inertModelPayload(calls[3]), {
    version: "public-lattice-registers.v2",
    certificateId: "certificate:document",
    obligationIds: ["document:whole"],
    source,
    candidate: `${transformed}\n`,
    analysisClaims: inertModelPayload(calls[3]).analysisClaims,
  });
  assert.equal(inertModelPayload(calls[3]).analysisClaims[1].length, 1);
  assert.equal(inertModelPayload(calls[3]).analysisClaims[1][0][0], passageId);
});

test("the API Worker adaptively splits a production-canary output limit and still certifies", async () => {
  const calls = [];
  let analysisCalls = 0;
  const transformedByPassage = new Map([
    ["p0001a", "A guest sets a blue notebook on the"],
    ["p0001b", "desk, reviews the first page, then shuts it."],
  ]);
  const worker = createLatticeApiWorker({
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      if (isAnalysisBody(body)) {
        analysisCalls += 1;
        if (analysisCalls === 1) {
          return providerChoiceResponse({
            finish_reason: "length",
            message: { role: "assistant", content: "{" },
          });
        }
        return successfulProviderResponse(canaryAnalysisWire(body));
      }
      if (isCandidateBody(body)) {
        const passageId = inertModelPayload(body).analysis[1][0][0];
        assert.equal(transformedByPassage.has(passageId), true);
        return successfulProviderResponse(canaryCandidateFromProviderBody(
          body,
          transformedByPassage.get(passageId),
        ));
      }
      const toolName = isVerificationBody(body) ? VERIFICATION_TOOL_NAME : body.response_format?.json_schema?.name ?? body.tool_choice?.function?.name;
      if (toolName === VERIFICATION_TOOL_NAME) {
        return successfulProviderResponse(canaryVerificationWire(body));
      }
      if (toolName === CERTIFICATION_TOOL_NAME) {
        const payload = inertModelPayload(body);
        return successfulProviderResponse(acceptingCertificationWire(
          payload.certificateId,
          payload.obligationIds,
        ));
      }
      return assert.fail("the adaptive canary used an undeclared provider stage");
    },
  });

  const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST), {
    HF_TOKEN: "server-token",
  });
  const envelope = await json(response);

  assert.equal(response.status, 200);
  assert.equal(envelope.result.status, "translated");
  assert.equal(envelope.result.text,
    "A guest sets a blue notebook on the desk, reviews the first page, then shuts it.\n");
  assert.equal(envelope.result.wordCount, 16);
  assert.equal(envelope.result.passageCount, 2);
  assert.equal(envelope.result.batchCount, 2);
  assert.equal(envelope.result.revisedPassageCount, 2);
  assert.equal(envelope.result.retainedPassageCount, 0);
  assert.equal(envelope.result.verificationPasses, 1);
  assert.deepEqual(envelope.result.findings, []);
  assert.equal(calls.length, 8);
  assert.deepEqual(calls.map((body) => (
    body.model === TEST_REVIEW_MODEL ? body.response_format.json_schema.name : body.response_format.type
  )), [
    "json_schema",
    "json_schema",
    "json_schema",
    "json_object",
    "json_object",
    VERIFICATION_TOOL_NAME,
    VERIFICATION_TOOL_NAME,
    CERTIFICATION_TOOL_NAME,
  ]);
  const certificationPayload = inertModelPayload(calls[7]);
  assert.equal(certificationPayload.certificateId, "certificate:document");
  assert.deepEqual(certificationPayload.obligationIds, ["document:whole"]);
  assert.equal(certificationPayload.source, LATTICE_PRODUCTION_CANARY_TEXT);
  assert.equal(certificationPayload.candidate, envelope.result.text);
  assert.deepEqual(
    certificationPayload.analysisClaims[1].map(([passageId]) => passageId),
    ["p0001a", "p0001b"],
  );
  const candidatePayloads = calls.slice(3, 5).map(inertModelPayload);
  assert.deepEqual(certificationPayload.analysisClaims, [
    candidatePayloads[0].analysis[0],
    candidatePayloads.map(({ analysis }) => analysis[1][0]),
  ]);
  assert.equal(Object.hasOwn(certificationPayload, "retainConformanceRequired"), false);
});

test("the API Worker certifies the exact production canary before conformant success", async () => {
  const calls = [];
  const worker = createLatticeApiWorker({
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body);
      if (isAnalysisBody(body)) {
        return successfulProviderResponse(canaryAnalysisWire(body, { retain: true }));
      }
      if (isCandidateBody(body)) {
        return successfulProviderResponse(canaryCandidateFromProviderBody(
          body,
          LATTICE_PRODUCTION_CANARY_TEXT.slice(0, -1),
        ));
      }
      const toolName = isVerificationBody(body) ? VERIFICATION_TOOL_NAME : body.response_format?.json_schema?.name ?? body.tool_choice?.function?.name;
      if (toolName === VERIFICATION_TOOL_NAME) {
        return successfulProviderResponse(canaryVerificationWire(body, { retain: true }));
      }
      if (toolName === CERTIFICATION_TOOL_NAME) {
        const payload = inertModelPayload(body);
        return successfulProviderResponse(acceptingCertificationWire(
          payload.certificateId,
          payload.obligationIds,
        ));
      }
      return assert.fail("the conformant canary used an undeclared provider stage");
    },
  });

  const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST), {
    HF_TOKEN: "server-token",
  });
  const envelope = await json(response);

  assert.equal(response.status, 200);
  assert.equal(envelope.result.status, "conformant-for-context");
  assert.equal(envelope.result.text, LATTICE_PRODUCTION_CANARY_TEXT);
  assert.equal(envelope.result.wordCount, 16);
  assert.equal(envelope.result.passageCount, 1);
  assert.equal(envelope.result.batchCount, 1);
  assert.equal(envelope.result.revisedPassageCount, 0);
  assert.equal(envelope.result.retainedPassageCount, 1);
  assert.equal(envelope.result.verificationPasses, 1);
  assert.deepEqual(envelope.result.findings, []);
  assert.equal(calls.length, 4);
  const certificationPayload = inertModelPayload(calls[3]);
  assert.equal(certificationPayload.certificateId, "certificate:document");
  assert.deepEqual(certificationPayload.obligationIds, ["document:whole"]);
  assert.equal(certificationPayload.source, LATTICE_PRODUCTION_CANARY_TEXT);
  assert.equal(certificationPayload.candidate, LATTICE_PRODUCTION_CANARY_TEXT);
  assert.equal(certificationPayload.analysisClaims[1].length, 1);
  assert.equal(certificationPayload.analysisClaims[1][0][0], "p0001");
  assert.equal(certificationPayload.analysisClaims[1][0][3], "retain-if-conformant");
  assert.deepEqual(certificationPayload.analysisClaims, inertModelPayload(calls[1]).analysis);
  assert.equal(certificationPayload.retainConformanceRequired, true);
});

test("the compact verifier preserves retained-conformance evidence and every independent layer", async () => {
  const base = minimalVerificationRequest();
  const evidenceIds = [
    ...base.sourceSpans[0].spans,
    ...(base.sourceSpans[0].literalAnnotations ?? []),
  ].map(({ id }) => id);
  const criteria = Object.freeze([
    ...LATTICE_CONFORMANCE_CRITERIA.universal,
    ...LATTICE_CONFORMANCE_CRITERIA.operative,
  ]);
  const retainedPlan = Object.freeze({
    ...base.analysis.passages[0],
    disposition: "retain-if-conformant",
    conformanceCriteria: criteria,
    conformanceEvidenceSpanIds: Object.freeze(evidenceIds),
    conformanceAssertions: Object.freeze(criteria.map((criterion) => Object.freeze({
      criterion,
      evidenceSpanIds: Object.freeze(evidenceIds),
    }))),
  });
  const request = Object.freeze({
    ...base,
    analysis: Object.freeze({
      ...base.analysis,
      passages: Object.freeze([retainedPlan]),
    }),
  });
  const evidenceMask = "1".repeat(evidenceIds.length);
  const wire = Object.freeze({
    d: 1,
    g: "0".repeat(11),
    p: Object.freeze({
      0: Object.freeze({
        a: "1",
        u: false,
        s: "0".repeat(evidenceIds.length),
        f: "000001000",
        l: 1,
        x: "1",
        y: evidenceMask,
        c: Object.freeze({
          v: true,
          s: evidenceMask,
          k: Object.freeze(criteria.map(() => Object.freeze({
            v: true,
            s: evidenceMask,
          }))),
        }),
      }),
    }),
    i: Object.freeze([]),
  });
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => successfulProviderResponse(wire),
  });

  const result = await adapter.verify(request);

  assert.equal(result.decision, "repair");
  assert.equal(result.passages[0].independentLayer, "experiential");
  assert.deepEqual(result.passages[0].failedChecks, ["registerFit"]);
  assert.equal(result.passages[0].conformanceConfirmed, true);
  assert.deepEqual(result.passages[0].conformanceEvidenceSpanIds, evidenceIds);
  assert.deepEqual(result.passages[0].criterionChecks, criteria.map((criterion) => ({
    criterion,
    passed: true,
    evidenceSpanIds: evidenceIds,
  })));
});

test("private rejection observations stay finite, detached, and exception isolated", () => {
  const result = Object.freeze({});
  assert.equal(rememberRejectedResult(result, "field-set"), result);
  const diagnostic = rejectedResultDiagnostic(result);
  assert.deepEqual(diagnostic, { boundary: "wire-decoder", category: "field-set", rule: "unknown" });
  assert.equal(Object.isFrozen(diagnostic), true);
  assert.deepEqual(Reflect.ownKeys(result), []);
  assert.equal(JSON.stringify(result), "{}");
  assert.equal(rejectedResultDiagnostic({}), null);
  assert.equal(rejectedResultDiagnostic(null), null);
  assert.equal(rememberRejectedResult("unchanged", "field-set"), "unchanged");
  assert.equal(rejectedResultDiagnostic(rememberRejectedResult({}, "untrusted-source-fragment")), null);

  const error = new Error("host-owned validation condition");
  assert.equal(rememberRejectedError(error, diagnostic), error);
  assert.deepEqual(rejectedErrorDiagnostic(error), diagnostic);
  assert.notEqual(rejectedErrorDiagnostic(error), diagnostic);
  assert.deepEqual(Reflect.ownKeys(error), ["stack", "message"]);
  const hostError = new Error("host-owned validation condition");
  rememberRejectedError(hostError, Object.freeze({ boundary: "host-normalizer", category: "consistency", rule: "unknown" }));
  assert.deepEqual(rejectedErrorDiagnostic(hostError), { boundary: "host-normalizer", category: "consistency", rule: "unknown" });

  let getterReads = 0;
  const getterDiagnostic = Object.freeze({
    boundary: "wire-decoder",
    get category() { getterReads += 1; return "field-set"; },
  });
  const hostile = [
    { boundary: "wire-decoder", category: "field-set", rule: "unknown" },
    Object.freeze({ boundary: "wire-decoder", category: "unknown" }),
    Object.freeze({ boundary: "unknown", category: "field-set" }),
    Object.freeze({ boundary: "wire-decoder", category: "field-set", extra: "unretained" }),
    Object.freeze({ boundary: "wire-decoder", category: "field-set", [Symbol("extra")]: true }),
    Object.freeze(Object.assign(Object.create(null), { boundary: "wire-decoder", category: "field-set", rule: "unknown" })),
    getterDiagnostic,
    new Proxy({}, { isExtensible() { throw new Error("unretained trap"); } }),
  ];
  for (const candidate of hostile) {
    const original = new Error("original outcome");
    assert.equal(rememberRejectedError(original, candidate), original);
    assert.equal(rejectedErrorDiagnostic(original), null);
  }
  assert.equal(getterReads, 0);
  assert.equal(rejectedErrorDiagnostic(null), null);
  assert.equal(rememberRejectedError(null, diagnostic), null);
  const originalSet = WeakMap.prototype.set;
  const unstoredResult = {};
  const unstoredError = new Error("original outcome");
  try {
    WeakMap.prototype.set = () => { throw new Error("unretained observer failure"); };
    assert.equal(rememberRejectedResult(unstoredResult, "field-set"), unstoredResult);
    assert.equal(rememberRejectedError(unstoredError, diagnostic), unstoredError);
  } finally {
    WeakMap.prototype.set = originalSet;
  }
  assert.equal(rejectedResultDiagnostic(unstoredResult), null);
  assert.equal(rejectedErrorDiagnostic(unstoredError), null);
  assert.deepEqual(LATTICE_REJECTION_CATEGORIES, [
    "object-type", "field-set", "value-type", "value-domain", "collection-bound",
    "coverage", "reference", "duplicate", "consistency", "other",
  ]);
});

test("private verifier rejection observations identify the first failed structural condition without changing calls", async () => {
  const request = minimalVerificationRequest();
  const accepted = acceptingVerificationWire(request);
  const passage = accepted.p["0"];
  const withPassage = (replacement) => ({ ...accepted, p: { 0: replacement } });
  const cases = [
    [{ ...accepted, extra: "unretained" }, "field-set", "V01F"],
    [{ ...accepted, p: [] }, "object-type", "V02O"],
    [{ ...accepted, p: {} }, "field-set", "V02F"],
    [{ ...accepted, i: false }, "value-type", "V03"],
    [{ ...accepted, i: Array(25).fill({ c: 0, p: -1 }) }, "collection-bound", "V04"],
    [{ ...accepted, d: false }, "value-type", "V05T"],
    [{ ...accepted, d: 3 }, "value-domain", "V05R"],
    [{ ...accepted, d: 3, g: false }, "value-domain", "V05R"],
    [{ ...accepted, g: false }, "value-type", "V06T"],
    [{ ...accepted, g: "x".repeat(11) }, "value-domain", "V06A"],
    [withPassage([]), "object-type", "V07O"],
    [withPassage({ ...passage, u: 0 }), "value-type", "V08"],
    [withPassage({ ...passage, c: [] }), "object-type", "V09O"],
    [withPassage({ ...passage, c: { ...passage.c, v: 0 } }), "value-type", "V10"],
    [withPassage({ ...passage, c: { ...passage.c, k: false } }), "value-type", "V11"],
    [withPassage({ ...passage, a: false }), "value-type", "V12T"],
    [withPassage({ ...passage, a: "3".repeat(passage.a.length) }), "value-domain", "V12A"],
    [withPassage({ ...passage, s: false }), "value-type", "V13T"],
    [withPassage({ ...passage, f: "x".repeat(9) }), "value-domain", "V14A"],
    [withPassage({ ...passage, l: 5 }), "value-domain", "V15R"],
    [withPassage({ ...passage, x: "0".repeat(passage.x.length) }), "coverage", "V16M"],
    [withPassage({ ...passage, y: "0".repeat(passage.y.length) }), "coverage", "V17M"],
    [withPassage({ ...passage, c: { ...passage.c, s: false } }), "value-type", "V18T"],
    [withPassage({ ...passage, c: { ...passage.c, v: true } }), "consistency", "V19"],
    ...[null, [], [0, 0], "PRIVATE-ISSUE", false, 0].map((issue) => [
      { ...accepted, i: [issue] }, "object-type", "V24O",
    ]),
    [{ ...accepted, i: [{ c: 0 }] }, "field-set", "V24F"],
    [{ ...accepted, i: [{ c: 0, p: false }] }, "value-type", "V25T"],
    [{ ...accepted, i: [{ c: 0, p: 1 }] }, "reference", "V26"],
    [{ ...accepted, i: [{ c: false, p: -1 }] }, "value-type", "V27T"],
    [{ ...accepted, i: [{ c: 0, p: -1 }, { c: 0, p: -1 }] }, "duplicate", "V28"],

  ];
  for (const [wire, category, rule] of cases) {
    let fetches = 0;
    const adapter = createHuggingFaceLatticeAdapter({
      token: "server-token",
      fetchImpl: async () => { fetches += 1; return successfulProviderResponse(wire); },
    });
    const result = await adapter.verify(request);
    assert.deepEqual(result, {});
    assert.deepEqual(Reflect.ownKeys(result), []);
    assert.deepEqual(rejectedResultDiagnostic(result), { boundary: "wire-decoder", category, rule });
    assert.equal(fetches, 1);
    assert.equal(adapter.completionCapacity().used, 1);
  }
  const successful = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => successfulProviderResponse(accepted),
  });
  const result = await successful.verify(request);
  assert.equal(result.decision, "accept");
  assert.equal(rejectedResultDiagnostic(result), null);
  assert.equal(successful.completionCapacity().used, 1);
});

test("private retained-conformance rejection observations preserve evidence obligations", async () => {
  const base = minimalVerificationRequest();
  const plan = base.analysis.passages[0];
  const criteria = [
    ...LATTICE_CONFORMANCE_CRITERIA.universal,
    ...LATTICE_CONFORMANCE_CRITERIA.operative,
  ];
  const request = {
    ...base,
    analysis: {
      ...base.analysis,
      passages: [{ ...plan, disposition: "retain-if-conformant", conformanceCriteria: criteria }],
    },
  };
  const accepted = acceptingVerificationWire(request);
  const passage = accepted.p["0"];
  const [first, ...remaining] = passage.c.k;
  const withChecks = (k) => ({ ...accepted, p: { 0: { ...passage, c: { ...passage.c, k } } } });
  const cases = [
    [withChecks(remaining), "coverage", "V20"],
    [withChecks([null, ...remaining]), "object-type", "V21O"],
    [withChecks([{ ...first, extra: false }, ...remaining]), "field-set", "V21F"],
    [withChecks([{ ...first, v: 1 }, ...remaining]), "value-type", "V22"],
    [withChecks([{ ...first, s: false }, ...remaining]), "value-type", "V23T"],
    [withChecks([{ ...first, s: "x".repeat(first.s.length) }, ...remaining]), "value-domain", "V23A"],
    [withChecks([{ ...first, s: "0".repeat(first.s.length) }, ...remaining]), "coverage", "V23M"],

  ];
  for (const [wire, category, rule] of cases) {
    const adapter = createHuggingFaceLatticeAdapter({
      token: "server-token", fetchImpl: async () => successfulProviderResponse(wire),
    });
    const result = await adapter.verify(request);
    assert.deepEqual(result, {});
    assert.deepEqual(rejectedResultDiagnostic(result), { boundary: "wire-decoder", category, rule });
    assert.equal(adapter.completionCapacity().used, 1);
  }
  const rejectingCriterion = withChecks([{ ...first, v: false, s: "0".repeat(first.s.length) }, ...remaining]);
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token", fetchImpl: async () => successfulProviderResponse(rejectingCriterion),
  });
  const result = await adapter.verify(request);
  assert.equal(result.passages[0].criterionChecks[0].passed, false);
  assert.equal(rejectedResultDiagnostic(result), null);
});

test("private verifier rule observations distinguish rejected primitives without retaining magnitudes", async (context) => {
  const request = minimalVerificationRequest();
  const accepted = acceptingVerificationWire(request);
  const passage = accepted.p["0"];
  const withPassage = (replacement) => ({ ...accepted, p: { 0: replacement } });
  const cases = [
    ["decision integer", { ...accepted, d: 0.5 }, "value-domain", "V05I"],
    ["gate length before alphabet", { ...accepted, g: "x" }, "value-domain", "V06L"],
    ["status length", withPassage({ ...passage, a: passage.a + "0" }), "value-domain", "V12L"],
    ["unmodeled length", withPassage({ ...passage, s: passage.s + "0" }), "value-domain", "V13L"],
    ["unmodeled alphabet", withPassage({ ...passage, s: "x".repeat(passage.s.length) }), "value-domain", "V13A"],
    ["passage check empty", withPassage({ ...passage, f: "" }), "value-domain", "V14LE"],
    ["passage check short", withPassage({ ...passage, f: passage.f.slice(0, -1) }), "value-domain", "V14LS"],
    ["passage check long", withPassage({ ...passage, f: passage.f + "0" }), "value-domain", "V14LG"],
    ["passage check short before alphabet", withPassage({ ...passage, f: "x" }), "value-domain", "V14LS"],
    ["passage check long before alphabet", withPassage({ ...passage, f: "x".repeat(passage.f.length + 1) }), "value-domain", "V14LG"],
    ["passage check exact width wrong alphabet", withPassage({ ...passage, f: "x".repeat(passage.f.length) }), "value-domain", "V14A"],
    ["passage check nonstring null", withPassage({ ...passage, f: null }), "value-type", "V14T"],
    ["passage check nonstring array", withPassage({ ...passage, f: [] }), "value-type", "V14T"],
    ["layer integer", withPassage({ ...passage, l: 0.5 }), "value-domain", "V15I"],
    ["atom support length", withPassage({ ...passage, x: passage.x + "0" }), "value-domain", "V16L"],
    ["atom support alphabet", withPassage({ ...passage, x: "x".repeat(passage.x.length) }), "value-domain", "V16A"],
    ["evidence support length", withPassage({ ...passage, y: passage.y + "0" }), "value-domain", "V17L"],
    ["evidence support alphabet", withPassage({ ...passage, y: "x".repeat(passage.y.length) }), "value-domain", "V17A"],
    ["conformance length", withPassage({ ...passage, c: { ...passage.c, s: passage.c.s + "0" } }), "value-domain", "V18L"],
    ["conformance alphabet", withPassage({ ...passage, c: { ...passage.c, s: "x".repeat(passage.c.s.length) } }), "value-domain", "V18A"],
    ["issue passage integer", { ...accepted, i: [{ c: 0, p: 0.5 }] }, "value-domain", "V25I"],
    ["issue check integer", { ...accepted, i: [{ c: 0.5, p: -1 }] }, "value-domain", "V27I"],
  ];
  for (const [name, wire, category, rule] of cases) {
    await context.test(name, async () => {
      let calls = 0;
      const adapter = createHuggingFaceLatticeAdapter({ token: "server-token", fetchImpl: async () => {
        calls += 1;
        return successfulProviderResponse(wire);
      } });
      const result = await adapter.verify(request);
      assert.deepEqual(result, {});
      assert.deepEqual(rejectedResultDiagnostic(result), { boundary: "wire-decoder", category, rule });
      assert.equal(rejectedResultDiagnostic({ ...result }), null);
      assert.equal(calls, 1);
      assert.equal(adapter.completionCapacity().used, 1);
    });
  }
});

test("rejection rule metadata rejects forged predicates and inconsistent categories", () => {
  const impossible = ["V06M", "V13M", "V14M", "V18M", "V06X", "V14X", "V16X", "V17X", "V18X", "V23X"];
  for (const [category, rule] of [["coverage", "V12L"], ["value-domain", "PRIVATE-RULE"], ["field-set", "D14"],
    ...impossible.map((code) => [code.endsWith("M") ? "coverage" : "collection-bound", code])]) {
    const result = {};
    assert.equal(rememberRejectedResult(result, category, rule), result);
    assert.equal(rejectedResultDiagnostic(result), null);
  }
  const error = new Error("unchanged host error");
  rememberRejectedError(error, Object.freeze({ boundary: "host-normalizer", category: "value-domain", rule: "V12L" }));
  assert.equal(rejectedErrorDiagnostic(error), null);
});

test("private certifier rejection observations identify the first failed structural condition without changing calls", async () => {
  const request = Object.freeze({
    certificateId: "certificate:private-observation",
    obligationIds: Object.freeze(["document:whole", "boundary:0"]),
    source: "Original source.", candidate: "Candidate source.",
    signal: new AbortController().signal,
  });
  const accepted = acceptingCertificationWire(request.certificateId, request.obligationIds);
  const cases = [
    [{ ...accepted, extra: "unretained" }, "field-set", "C01F"],
    [{ ...accepted, c: "certificate:other" }, "reference", "C02"],
    [{ ...accepted, o: false }, "value-type", "C03"],
    [{ ...accepted, o: [] }, "coverage", "C04"],
    [{ ...accepted, o: [...accepted.o].reverse() }, "reference", "C05"],
    [{ ...accepted, k: false }, "value-type", "C06"],
    [{ ...accepted, k: accepted.k.slice(1) }, "collection-bound", "C07"],
    [{ ...accepted, k: [0, ...accepted.k.slice(1)] }, "value-type", "C08"],
    [{ ...accepted, i: false }, "value-type", "C09"],
    [{ ...accepted, i: Array(11).fill(0) }, "collection-bound", "C10"],
    [{ ...accepted, d: false }, "value-type", "C11T"],
    [{ ...accepted, d: 2 }, "value-domain", "C11R"],
    [{ ...accepted, i: [false] }, "value-type", "C12T"],
    [{ ...accepted, i: [10] }, "value-domain", "C12R"],
    [{ ...accepted, i: [0, 0] }, "duplicate", "C13"],

  ];
  for (const [wire, category, rule] of cases) {
    let fetches = 0;
    const adapter = createHuggingFaceLatticeAdapter({
      token: "server-token",
      fetchImpl: async () => { fetches += 1; return successfulProviderResponse(wire); },
    });
    const result = await adapter.certify(request);
    assert.deepEqual(result, {});
    assert.deepEqual(Reflect.ownKeys(result), []);
    assert.deepEqual(rejectedResultDiagnostic(result), { boundary: "wire-decoder", category, rule });
    assert.equal(fetches, 1);
    assert.equal(adapter.completionCapacity().used, 1);
  }
  const successful = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => successfulProviderResponse(accepted),
  });
  const result = await successful.certify(request);
  assert.equal(result.decision, "accept");
  assert.equal(rejectedResultDiagnostic(result), null);
  assert.equal(successful.completionCapacity().used, 1);
});

test("malformed compact verifier and certifier wires fail closed after one provider call", async () => {
  const verificationRequest = minimalVerificationRequest();
  const calls = [];
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body));
      return successfulProviderResponse(calls.length === 1
        ? { ...acceptingVerificationWire(verificationRequest), g: "0000000000x" }
        : {
          ...acceptingCertificationWire("certificate:malformed-wire", ["document:whole"]),
          i: [10],
        });
    },
  });

  assert.deepEqual(await adapter.verify(verificationRequest), {});
  assert.deepEqual(await adapter.certify({
    certificateId: "certificate:malformed-wire",
    obligationIds: Object.freeze(["document:whole"]),
    source: "Original source.",
    candidate: "Candidate source.",
    signal: verificationRequest.signal,
  }), {});
  assert.equal(calls.length, 2);

  const coerciveVerifier = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => successfulProviderResponse({
      ...acceptingVerificationWire(verificationRequest),
      i: [{ c: { toString: null }, p: -1 }],
    }),
  });
  assert.deepEqual(await coerciveVerifier.verify(verificationRequest), {});

  const without = (record, removedKey) => Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== removedKey),
  );
  const acceptedVerification = acceptingVerificationWire(verificationRequest);
  const acceptedPassage = acceptedVerification.p["0"];
  const verifierShapeCases = [
    { ...acceptedVerification, p: {} },
    { ...acceptedVerification, p: { ...acceptedVerification.p, 1: acceptedPassage } },
    {
      ...acceptedVerification,
      p: { 0: without(acceptedPassage, "a") },
    },
    {
      ...acceptedVerification,
      p: { 0: { ...acceptedPassage, z: false } },
    },
    {
      ...acceptedVerification,
      p: { 0: { ...acceptedPassage, c: without(acceptedPassage.c, "v") } },
    },
    {
      ...acceptedVerification,
      p: { 0: { ...acceptedPassage, c: { ...acceptedPassage.c, z: false } } },
    },
    { ...acceptedVerification, i: [{ c: 0 }] },
    { ...acceptedVerification, i: [{ c: 0, p: -1, z: false }] },
    { ...acceptedVerification, i: [{ c: 0, p: -1 }, { c: 0, p: -1 }] },
  ];
  for (const wire of verifierShapeCases) {
    let shapeFetches = 0;
    const shapeVerifier = createHuggingFaceLatticeAdapter({
      token: "server-token",
      fetchImpl: async () => {
        shapeFetches += 1;
        return successfulProviderResponse(wire);
      },
    });
    assert.deepEqual(await shapeVerifier.verify(verificationRequest), {});
    assert.equal(shapeFetches, 1);
  }

  const evidenceIds = [
    ...verificationRequest.sourceSpans[0].spans,
    ...(verificationRequest.sourceSpans[0].literalAnnotations ?? []),
  ].map(({ id }) => id);
  const retainedCriteria = Object.freeze([
    ...LATTICE_CONFORMANCE_CRITERIA.universal,
    ...LATTICE_CONFORMANCE_CRITERIA.operative,
  ]);
  const retainedRequest = Object.freeze({
    ...verificationRequest,
    analysis: Object.freeze({
      ...verificationRequest.analysis,
      passages: Object.freeze([Object.freeze({
        ...verificationRequest.analysis.passages[0],
        disposition: "retain-if-conformant",
        conformanceCriteria: retainedCriteria,
        conformanceEvidenceSpanIds: Object.freeze(evidenceIds),
        conformanceAssertions: Object.freeze(retainedCriteria.map((criterion) => Object.freeze({
          criterion,
          evidenceSpanIds: Object.freeze(evidenceIds),
        }))),
      })]),
    }),
  });
  const acceptedRetained = acceptingVerificationWire(retainedRequest);
  const retainedPassage = acceptedRetained.p["0"];
  const [firstCriterion, ...remainingCriteria] = retainedPassage.c.k;
  const retainedShapeCases = [
    {
      ...acceptedRetained,
      p: { 0: { ...retainedPassage, c: { ...retainedPassage.c, k: remainingCriteria } } },
    },
    {
      ...acceptedRetained,
      p: {
        0: {
          ...retainedPassage,
          c: {
            ...retainedPassage.c,
            k: [without(firstCriterion, "v"), ...remainingCriteria],
          },
        },
      },
    },
    {
      ...acceptedRetained,
      p: {
        0: {
          ...retainedPassage,
          c: {
            ...retainedPassage.c,
            k: [{ ...firstCriterion, z: false }, ...remainingCriteria],
          },
        },
      },
    },
  ];
  for (const wire of retainedShapeCases) {
    const shapeVerifier = createHuggingFaceLatticeAdapter({
      token: "server-token",
      fetchImpl: async () => successfulProviderResponse(wire),
    });
    assert.deepEqual(await shapeVerifier.verify(retainedRequest), {});
  }

  const certificationRequest = Object.freeze({
    certificateId: "certificate:malformed-order",
    obligationIds: Object.freeze(["document:whole", "boundary:0"]),
    source: "Original source.",
    candidate: "Candidate source.",
    signal: verificationRequest.signal,
  });
  const acceptedCertification = acceptingCertificationWire(
    certificationRequest.certificateId,
    certificationRequest.obligationIds,
  );
  const certificationShapeCases = [
    { ...acceptedCertification, o: [...acceptedCertification.o].reverse() },
    { ...acceptedCertification, o: [acceptedCertification.o[0], acceptedCertification.o[0]] },
    { ...acceptedCertification, k: acceptedCertification.k.slice(1) },
    { ...acceptedCertification, k: [...acceptedCertification.k, true] },
  ];
  for (const wire of certificationShapeCases) {
    const shapeCertifier = createHuggingFaceLatticeAdapter({
      token: "server-token",
      fetchImpl: async () => successfulProviderResponse(wire),
    });
    assert.deepEqual(await shapeCertifier.certify(certificationRequest), {});
  }

  for (const selectedField of ["x", "y"]) {
    const accepted = acceptingVerificationWire(verificationRequest);
    const zeroSelectionVerifier = createHuggingFaceLatticeAdapter({
      token: "server-token",
      fetchImpl: async () => successfulProviderResponse({
        ...accepted,
        p: {
          ...accepted.p,
          0: {
            ...accepted.p["0"],
            [selectedField]: "0".repeat(accepted.p["0"][selectedField].length),
          },
        },
      }),
    });
    assert.deepEqual(await zeroSelectionVerifier.verify(verificationRequest), {});
  }
});

test("oversized fitted verifier and certifier records fail before provider work", async () => {
  let fetches = 0;
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => {
      fetches += 1;
      return successfulProviderResponse({});
    },
  });
  const multipassageBase = minimalAnalysisRequest("One.\n\nTwo.");
  const sourceSpans = latticeSourceSpansForBatch(multipassageBase.batch);
  assert.equal(multipassageBase.batch.passages.length, 2);
  const analysisPassages = multipassageBase.batch.passages.map((passage, passageIndex) => {
    const evidenceSpanIds = [
      ...sourceSpans[passageIndex].spans,
      ...(sourceSpans[passageIndex].literalAnnotations ?? []),
    ].map(({ id }) => id);
    return Object.freeze({
      passageId: passage.id,
      discourseFunction: "states one fact",
      layer: "operative",
      disposition: "rewrite",
      rationale: "make the fact explicit",
      atoms: Object.freeze(Array.from({ length: 13 }, (_value, atomIndex) => Object.freeze({
        id: `p${passageIndex + 1}a${atomIndex + 1}`,
        kind: "state",
        value: "supported fact",
        priority: "semantic",
        preservation: "equivalent",
        evidenceSpanIds: Object.freeze(evidenceSpanIds),
        links: Object.freeze([]),
      }))),
      ambiguityAtomIds: Object.freeze([]),
      conformanceCriteria: Object.freeze([]),
      conformanceEvidenceSpanIds: Object.freeze([]),
      conformanceAssertions: Object.freeze([]),
    });
  });
  await assert.rejects(
    adapter.verify(Object.freeze({
      ...multipassageBase,
      sourceSpans,
      analysis: Object.freeze({
        documentKind: "informational",
        passages: Object.freeze(analysisPassages),
        questions: Object.freeze([]),
      }),
      candidate: Object.freeze({
        passages: Object.freeze(multipassageBase.batch.passages.map((passage) => Object.freeze({
          passageId: passage.id,
          layer: "operative",
          text: passage.text,
          preservedAtomIds: Object.freeze([]),
        }))),
      }),
    })),
    /oversized verification atom plan/u,
  );

  const verificationBase = minimalVerificationRequest();
  const passageId = verificationBase.batch.passages[0].id;
  const oversizedSpans = Object.freeze(Array.from({ length: 61 }, (_value, index) => Object.freeze({
    id: `${passageId}:x${String(index + 1).padStart(2, "0")}`,
    kind: "source",
    text: "x",
  })));
  await assert.rejects(
    adapter.verify(Object.freeze({
      ...verificationBase,
      sourceSpans: Object.freeze([Object.freeze({
        passageId,
        spans: oversizedSpans,
        literalAnnotations: Object.freeze([]),
      })]),
    })),
    /oversized verification evidence/u,
  );

  await assert.rejects(
    adapter.verify(Object.freeze({
      ...verificationBase,
      batch: Object.freeze({
        ...verificationBase.batch,
        passages: Object.freeze(Array.from({ length: 5 }, (_value, index) => Object.freeze({
          ...verificationBase.batch.passages[0],
          id: `p${String(index + 1).padStart(3, "0")}`,
        }))),
      }),
    })),
    /invalid analysis passages/u,
  );

  await assert.rejects(
    adapter.certify({
      certificateId: "certificate:</LATTICE_RESPONSE_SCHEMA>",
      obligationIds: Object.freeze(["document:whole"]),
      source: "Original.",
      candidate: "Candidate.",
    }),
    /invalid certification obligation/u,
  );
  await assert.rejects(
    adapter.certify({
      certificateId: "certificate:oversized",
      obligationIds: Object.freeze(Array.from(
        { length: 24 },
        (_value, index) => `obligation-${String(index).padStart(2, "0")}-${"x".repeat(12)}`,
      )),
      source: "Original.",
      candidate: "Candidate.",
    }),
    /oversized certification identifiers/u,
  );
  assert.equal(fetches, 0);
});

test("invalid fitted analysis atom limits fail before provider work", async () => {
  let fetches = 0;
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => {
      fetches += 1;
      return successfulProviderResponse({ d: "instruction", p: [], q: [] });
    },
  });
  for (const analysisAtomLimit of [0, 25, 1.5, Number.NaN, "7"]) {
    await assert.rejects(
      adapter.analyze(Object.freeze({
        ...minimalAnalysisRequest(),
        analysisAtomLimit,
      })),
      TypeError,
    );
  }
  const duplicatePassageRequest = minimalAnalysisRequest();
  await assert.rejects(
    adapter.analyze(Object.freeze({
      ...duplicatePassageRequest,
      batch: Object.freeze({
        ...duplicatePassageRequest.batch,
        passages: Object.freeze([
          duplicatePassageRequest.batch.passages[0],
          duplicatePassageRequest.batch.passages[0],
        ]),
      }),
    })),
    TypeError,
  );
  const reorderedEvidenceRequest = minimalAnalysisRequest("One.\n\nTwo.");
  const orderedEvidence = latticeSourceSpansForBatch(reorderedEvidenceRequest.batch);
  await assert.rejects(
    adapter.analyze(Object.freeze({
      ...reorderedEvidenceRequest,
      analysisAtomLimit: 4,
      sourceSpans: Object.freeze([...orderedEvidence].reverse()),
    })),
    TypeError,
  );
  await assert.rejects(
    adapter.analyze(Object.freeze({
      ...minimalAnalysisRequest(),
      documentLedger: Object.freeze(Array.from(
        { length: (LATTICE_PROVIDER_CALL_LIMIT * 24) + 1 },
        (_value, index) => Object.freeze({ id: `r001:a${index}` }),
      )),
    })),
    /invalid analysis ledger identifiers/u,
  );
  const oversizedPassageEvidenceRequest = minimalAnalysisRequest();
  await assert.rejects(
    adapter.analyze(Object.freeze({
      ...oversizedPassageEvidenceRequest,
      sourceSpans: Object.freeze([Object.freeze({
        passageId: oversizedPassageEvidenceRequest.batch.passages[0].id,
        spans: Object.freeze(Array.from({ length: 61 }, (_value, index) => Object.freeze({
          id: `oversized:s${index}`,
          kind: "source",
          text: `evidence ${index}`,
        }))),
        literalAnnotations: Object.freeze([]),
      })]),
    })),
    /oversized analysis evidence/u,
  );
  const oversizedTotalEvidenceRequest = minimalAnalysisRequest("One.\n\nTwo.");
  assert.equal(oversizedTotalEvidenceRequest.batch.passages.length, 2);
  await assert.rejects(
    adapter.analyze(Object.freeze({
      ...oversizedTotalEvidenceRequest,
      sourceSpans: Object.freeze(oversizedTotalEvidenceRequest.batch.passages.map(
        ({ id: passageId }, passageIndex) => Object.freeze({
          passageId,
          spans: Object.freeze(Array.from({ length: 37 }, (_value, index) => Object.freeze({
            id: `${passageId}:oversized-${passageIndex}-${index}`,
            kind: "source",
            text: `evidence ${passageIndex}-${index}`,
          }))),
          literalAnnotations: Object.freeze([]),
        }),
      )),
    })),
    /oversized analysis evidence/u,
  );
  const overAtomCapacityRequest = minimalAnalysisRequest(
    "One.\n\nTwo.\n\nThree.\n\nFour.",
  );
  assert.equal(overAtomCapacityRequest.batch.passages.length, 4);
  await assert.rejects(
    adapter.analyze(Object.freeze({
      ...overAtomCapacityRequest,
      analysisAtomLimit: 24,
      sourceSpans: Object.freeze(overAtomCapacityRequest.batch.passages.map(
        ({ id: passageId }, passageIndex) => Object.freeze({
          passageId,
          spans: Object.freeze(Array.from(
            { length: passageIndex === 0 ? 19 : 18 },
            (_value, index) => Object.freeze({
              id: `${passageId}:capacity-${index}`,
              kind: "source",
              text: `evidence ${passageIndex}-${index}`,
            }),
          )),
          literalAnnotations: Object.freeze([]),
        }),
      )),
    })),
    /analysis atom limit outside evidence capacity/u,
  );
  assert.equal(fetches, 0);
});

test("the private compact analysis wire format expands to the unchanged host schema", async () => {
  const request = minimalAnalysisRequest();
  const passageId = request.batch.passages[0].id;
  const wire = {
    d: 2,
    p: [[
      0,
      0,
      [
        [1, 0, 1, [0]],
        [2, 1, 1, [0]],
      ],
      ["0", "0", "0", "0", "0"],
    ]],
    l: [[0, 1, 1]],
  };
  let providerBody;
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async (_url, init) => {
      providerBody = JSON.parse(init.body);
      return successfulProviderResponse(wire);
    },
  });

  const result = await adapter.analyze(request);
  const expected = {
    documentKind: "instruction",
    passages: [{
      passageId,
      discourseFunction: "Preserve the passage's evidence-grounded operative function.",
      layer: "operative",
      disposition: "rewrite",
      rationale: "Use the operative layer to make cited source commitments legible without adding meaning.",
      atoms: [{
        id: "a0",
        kind: "action",
        value: validPayload.text,
        priority: "hard",
        preservation: "equivalent",
        evidenceSpanIds: [`${passageId}:s01`],
        links: [{ relation: "patient", targetAtomId: "a1" }],
      }, {
        id: "a1",
        kind: "object",
        value: validPayload.text,
        priority: "semantic",
        preservation: "equivalent",
        evidenceSpanIds: [`${passageId}:s01`],
        links: [],
      }],
      ambiguityAtomIds: [],
      conformanceCriteria: [],
      conformanceEvidenceSpanIds: [],
      conformanceAssertions: [],
    }],
    questions: [],
  };
  assert.deepEqual(result, expected);
  assert.deepEqual(result[LATTICE_FITTED_ANALYSIS_CONTEXT], {
    analysisAtomLimit: 4,
    documentLedgerAtomIds: [],
  });
  assert.equal(Object.keys(result).includes(String(LATTICE_FITTED_ANALYSIS_CONTEXT)), false);
  assert.ok(JSON.stringify(wire).length < JSON.stringify(expected).length);
  assert.match(providerBody.response_format.json_schema.description, /private fitted d\/p\/l analysis/u);
  assert.match(providerBody.messages[0].content, /mandatory d\/p\/l index layout/u);
  assert.match(providerBody.messages[0].content, /Use at most 4 atoms total/u);
  assert.equal(
    providerBody.response_format.json_schema.schema.properties.p.prefixItems[0]
      .prefixItems[2].maxItems,
    result[LATTICE_FITTED_ANALYSIS_CONTEXT].analysisAtomLimit,
  );
  assert.deepEqual(providerBody.response_format.json_schema.schema.required, ["d", "p", "l"]);
  assert.equal(providerBody.response_format.json_schema.name, ANALYSIS_TOOL_NAME);
  assert.equal(providerBody.response_format.json_schema.strict, true);
  assert.equal(Object.hasOwn(providerBody, "tools"), false);
  assert.equal(Object.hasOwn(providerBody, "tool_choice"), false);
  assert.equal(
    providerBody.messages[0].content.includes(providerBody.response_format.json_schema.description),
    false,
  );
  assert.equal(providerBody.messages[0].content.includes('"required":["d","p","l"]'), false);
  assert.equal(providerBody.messages[0].content.includes(
    '"required":["documentKind","passages","questions"]',
  ), false);
});

test("analysis evidence rejection codes bind only to the actual fitted rejecting predicate", async () => {
  const base = minimalAnalysisRequest(LATTICE_PRODUCTION_CANARY_TEXT);
  const request = Object.freeze({ ...base, sourceSpans: latticeSourceSpansForBatch(base.batch), analysisAtomLimit: 12 });
  const atom = (positions) => [1, 0, 1, positions];
  const wire = (atoms) => ({ d: 2, p: [[0, 0, atoms, Array(5).fill("000")]], l: [] });
  const cases = [
    [wire([]), "coverage", "A01"],
    [wire([atom(null)]), "value-type", "A02T"],
    [wire([atom([])]), "coverage", "A02M"],
    [wire([atom([0, 1, 2, 2])]), "collection-bound", "A02X"],
    [wire([atom(["PRIVATE-INDEX"])]), "value-domain", "A02I"],
    [wire([atom([0.5])]), "value-domain", "A02I"],
    [wire([atom([-1])]), "reference", "A02R"],
    [wire([atom([3])]), "reference", "A02R"],
    [wire([atom([0, 1])]), "coverage", "A03"],
    [wire([atom([0, 0])]), "coverage", "A03"],
  ];
  for (const [value, category, rule] of cases) {
    const result = await createHuggingFaceLatticeAdapter({ token: "server-token",
      fetchImpl: async () => successfulProviderResponse(value),
    }).analyze(request);
    assert.deepEqual(result, {});
    assert.deepEqual(rejectedResultDiagnostic(result), { boundary: "wire-decoder", category, rule });
    assert.equal(result[LATTICE_FITTED_ANALYSIS_CONTEXT].decoderFailureCategory, "evidence");
    assert.equal(JSON.stringify(result), "{}");
    assert.equal(rejectedResultDiagnostic({ ...result }), null, "cloning cannot copy trusted observations");
  }
  const valid = await createHuggingFaceLatticeAdapter({ token: "server-token",
    fetchImpl: async () => successfulProviderResponse(wire([atom([0, 0, 1]), atom([2])])),
  }).analyze(request);
  assert.equal(rejectedResultDiagnostic(valid), null);
  assert.equal(valid.passages[0].atoms.length, 2);
  assert.equal(valid.passages[0].atoms[0].evidenceSpanIds.length, 2, "valid duplicate positions still deduplicate");
  const malformed = await createHuggingFaceLatticeAdapter({ token: "server-token",
    fetchImpl: async () => successfulProviderResponse({ ...wire([atom([0, 1, 2])]), arbitrary: "PRIVATE-INDEX" }),
  }).analyze(request);
  assert.deepEqual(rejectedResultDiagnostic(malformed), { boundary: "wire-decoder", category: "other", rule: "unknown" });
  assert.equal(malformed[LATTICE_FITTED_ANALYSIS_CONTEXT].decoderFailureCategory, "response-shape");
});

test("reanalysis evidence diagnostics preserve bounded correction, structural withholding and marked privacy", async (context) => {
  const gates = VERIFICATION_SCHEMA.properties.failedGates.items.enum;
  const repairText = "A guest sets a blue notebook on the desk, reviews the first page, then shuts it.";
  for (const recover of [false, true]) {
    for (const marked of [false, true]) {
      await context.test(`${recover ? "valid replacement" : "exhausted replacement"}; ${marked ? "marked" : "ordinary"}`, async () => {
        const calls = [];
        let analyzes = 0;
        let drafts = 0;
        let verifies = 0;
        const worker = createLatticeApiWorker({ fetchImpl: async (_url, init) => {
          const body = JSON.parse(init.body); calls.push(body);
          assert.doesNotMatch(JSON.stringify(body), /A01|A02[TMXIR]|A03|rejectionRule|rejectionCategory/u);
          if (isAnalysisBody(body)) {
            analyzes += 1;
            const wire = canaryAnalysisWire(body);
            if (analyzes === 2) wire.p[0][2][0][3] = [0, 1];
            if (analyzes === 3) {
              assert.equal(inertModelPayload(body).retry, "private-analysis-wire-invalid");
              assert.match(body.messages[0].content, /Closed correction category: evidence/u);
              if (!recover) wire.p[0][2][0][3] = [3];
            }
            return successfulProviderResponse(wire);
          }
          if (isCandidateBody(body)) {
            drafts += 1;
            return successfulProviderResponse(canaryCandidateFromProviderBody(body,
              drafts === 1 ? LATTICE_PRODUCTION_CANARY_TEXT.slice(0, -1) : repairText));
          }
          if (isVerificationBody(body)) {
            verifies += 1;
            const wire = canaryVerificationWire(body);
            if (verifies === 1) {
              wire.d = 1;
              wire.g = gates.map((gate) => gate === "sourceCoverage" ? "1" : "0").join("");
            }
            return successfulProviderResponse(wire);
          }
          assert.equal(recover, true, "failed graph replacement cannot certify");
          const payload = inertModelPayload(body);
          return successfulProviderResponse(acceptingCertificationWire(payload.certificateId, payload.obligationIds));
        } });
        const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST, {
          headers: marked ? { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE } : {},
        }), { HF_TOKEN: "server-token", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z" });
        const envelope = await json(response);
        assert.equal(response.status, 200);
        assert.equal(analyzes, 3);
        assert.equal(drafts, recover ? 2 : 1);
        assert.equal(verifies, recover ? 2 : 1);
        assert.equal(calls.length, recover ? 8 : 5);
        assert.equal(envelope.result.text, recover ? `${repairText}\n` : null);
        if (marked && !recover) {
          const expected = { verification: "semantic-rejection", firstDeterministicRule: "D14", stage: "re-atomization",
            attempt: "2", validationCategory: "evidence", priorValidationCategory: "evidence",
            rejectionBoundary: "wire-decoder", rejectionCategory: "reference", rejectionRule: "A02R",
            priorRejectionBoundary: "wire-decoder", priorRejectionCategory: "coverage", priorRejectionRule: "A03", callsUsed: "5" };
          for (const [field, value] of Object.entries(expected)) {
            assert.equal(response.headers.get(LATTICE_QUALIFICATION_WITHHELD_DIAGNOSTIC_RESPONSE_HEADERS[field]), value, field);
          }
        } else {
          for (const header of Object.values(LATTICE_QUALIFICATION_WITHHELD_DIAGNOSTIC_RESPONSE_HEADERS)) {
            assert.equal(response.headers.has(header), false, header);
          }
        }
        assert.doesNotMatch(JSON.stringify(envelope), /A02R|A03|rejectionBoundary|rejectionRule/u);
      });
    }
  }
});

test("the private compact analysis decoder weakens safe overclaims and rejects invalid fitted data", async () => {
  const base = minimalAnalysisRequest(
    "A visitor places a blue notebook on the desk, reads the first page, and closes it.",
  );
  const sourceSpans = latticeSourceSpansForBatch(base.batch);
  const evidenceCount = sourceSpans[0].spans.length
    + (sourceSpans[0].literalAnnotations?.length ?? 0);
  assert.equal(evidenceCount, 3);
  const request = Object.freeze({
    ...base,
    sourceSpans,
    analysisAtomLimit: 12,
  });
  const zeroMasks = () => Array(5).fill("0".repeat(evidenceCount));
  const atom = (kind = 1, evidence = [0, 1, 2], preservation = 1) => (
    [kind, 0, preservation, evidence]
  );
  const wire = (
    atoms = [atom()],
    links = [],
    masks = zeroMasks(),
    { layer = 0, disposition = 0 } = {},
  ) => ({
    d: 2,
    p: [[layer, disposition, atoms, masks]],
    l: links,
  });
  const analyzeWire = async (value) => createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => successfulProviderResponse(value),
  }).analyze(request);

  const valid = await analyzeWire(wire());
  assert.equal(valid.documentKind, "instruction");
  assert.equal(valid.passages[0].atoms[0].value, request.batch.passages[0].text);
  assert.deepEqual(valid.passages[0].atoms[0].evidenceSpanIds, [
    ...sourceSpans[0].spans.map(({ id }) => id),
    ...(sourceSpans[0].literalAnnotations ?? []).map(({ id }) => id),
  ]);
  const reordered = await analyzeWire(wire([atom(1, [2, 0, 1])]));
  assert.equal(reordered.passages[0].atoms[0].value, valid.passages[0].atoms[0].value);
  assert.deepEqual(
    reordered.passages[0].atoms[0].evidenceSpanIds,
    valid.passages[0].atoms[0].evidenceSpanIds,
  );

  const retainMasks = ["100", "010", "001", "111", "101"];
  const retained = await analyzeWire(wire(
    [atom()],
    [],
    retainMasks,
    { disposition: 1 },
  ));
  assert.deepEqual(retained.passages[0].conformanceCriteria, [
    ...LATTICE_CONFORMANCE_CRITERIA.universal,
    ...LATTICE_CONFORMANCE_CRITERIA.operative,
  ]);
  assert.deepEqual(
    retained.passages[0].conformanceEvidenceSpanIds,
    valid.passages[0].atoms[0].evidenceSpanIds,
  );
  assert.deepEqual(
    retained.passages[0].conformanceAssertions.map(({ evidenceSpanIds }) => evidenceSpanIds),
    retainMasks.map((mask) => valid.passages[0].atoms[0].evidenceSpanIds
      .filter((_id, index) => mask[index] === "1")),
  );

  const mixedEvidenceRequest = Object.freeze({
    ...base,
    sourceSpans: Object.freeze([Object.freeze({
      passageId: base.batch.passages[0].id,
      spans: Object.freeze([Object.freeze({
        id: `${base.batch.passages[0].id}:source`,
        kind: "source",
        text: "ordinary source",
      })]),
      literalAnnotations: Object.freeze([Object.freeze({
        id: `${base.batch.passages[0].id}:literal`,
        kind: "literal",
        text: "`literal`",
      })]),
    })]),
    analysisAtomLimit: 2,
  });
  const mixedExact = await createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => successfulProviderResponse({
      d: 2,
      p: [[
        0,
        0,
        [[1, 0, 1, [0]], [2, 0, 0, [1]]],
        ["00", "00", "00", "00", "00"],
      ]],
      l: [],
    }),
  }).analyze(mixedEvidenceRequest);
  assert.deepEqual(
    mixedExact.passages[0].atoms.map(({ preservation }) => preservation),
    ["equivalent", "exact"],
    "ordinary evidence is conservatively downgraded while literal evidence remains exact",
  );

  const literalOnlyRequest = Object.freeze({
    ...base,
    sourceSpans: Object.freeze([Object.freeze({
      passageId: base.batch.passages[0].id,
      spans: Object.freeze([]),
      literalAnnotations: Object.freeze([Object.freeze({
        id: `${base.batch.passages[0].id}:literal-only`,
        kind: "literal",
        text: "`literal-only`",
      })]),
    })]),
    analysisAtomLimit: 1,
  });
  const literalExact = await createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => successfulProviderResponse({
      d: 2,
      p: [[0, 0, [[2, 0, 0, [0]]], ["0", "0", "0", "0", "0"]]],
      l: [],
    }),
  }).analyze(literalOnlyRequest);
  assert.equal(literalExact.passages[0].atoms[0].preservation, "exact");
  assert.equal(literalExact.passages[0].atoms[0].value, "`literal-only`");

  const ordinaryExact = await analyzeWire(wire([atom(1, [0, 1, 2], 0)]));
  assert.equal(ordinaryExact.passages[0].atoms[0].preservation, "equivalent");

  const rewriteClaim = await analyzeWire(wire(
    [atom()],
    [],
    ["100", "000", "000", "000", "000"],
  ));
  assert.equal(rewriteClaim.passages[0].disposition, "rewrite");
  assert.deepEqual(rewriteClaim.passages[0].conformanceAssertions, []);

  for (const masks of [
    ["000", ...retainMasks.slice(1)],
    ["100", "010", "100", "010", "110"],
  ]) {
    const weakenedRetain = await analyzeWire(wire(
      [atom()],
      [],
      masks,
      { disposition: 1 },
    ));
    assert.equal(weakenedRetain.passages[0].disposition, "rewrite");
    assert.deepEqual(weakenedRetain.passages[0].conformanceAssertions, []);
  }

  const withoutSelfLink = await analyzeWire(wire([atom()], [[0, 1, 0]]));
  assert.deepEqual(withoutSelfLink.passages[0].atoms[0].links, []);

  const withoutDuplicateLink = await analyzeWire(wire(
    [atom(), atom()],
    [[0, 1, 1], [0, 1, 1]],
  ));
  assert.deepEqual(withoutDuplicateLink.passages[0].atoms[0].links, [
    { relation: "patient", targetAtomId: "a1" },
  ]);

  const tenAtoms = Array.from({ length: 10 }, (_value, index) => atom(1, [index % evidenceCount]));
  const cases = [
    ["coercive evidence position", wire([atom(1, [{ toString: null }, { toString: null }])])],
    ["duplicate evidence position", wire([atom(1, [0, 0])])],
    ["unknown evidence position", wire([atom(1, [0, 1, 3])])],
    ["incomplete evidence coverage", wire([atom(1, [0, 1])])],
    [
      "retained conformance mask has the wrong width",
      wire([atom()], [], ["10", ...retainMasks.slice(1)], { disposition: 1 }),
    ],
    [
      "retained conformance mask is not binary",
      wire([atom()], [], ["1x0", ...retainMasks.slice(1)], { disposition: 1 }),
    ],
    ["unknown link source", wire([atom()], [[1, 1, 0]])],
    ["unknown link target", wire([atom()], [[0, 1, 11]])],
    ["unknown ledger link target", wire([atom()], [[0, 1, -1]])],
    ["malformed link tuple", wire([atom(), atom()], [[0, 1]])],
    ["noninteger link relation", wire([atom(), atom()], [[0, 1.5, 1]])],
    ["unknown link relation", wire([atom(), atom()], [[0, 24, 1]])],
    [
      "more than eight links on one atom",
      wire(tenAtoms, Array.from({ length: 9 }, (_value, index) => [0, index, index + 1])),
    ],
    [
      "more than eight derived ambiguity atoms",
      wire(Array.from({ length: 9 }, (_value, index) => atom(7, [index % evidenceCount]))),
    ],
  ];
  for (const [name, invalidWire] of cases) {
    assert.deepEqual(await analyzeWire(invalidWire), {}, name);
  }

  const denseEvidence = Array.from({ length: 6 }, (_value, index) => Object.freeze({
    id: `${base.batch.passages[0].id}:dense-${index}`,
    kind: "source",
    text: `evidence ${index}`,
  }));
  const denseRequest = Object.freeze({
    ...base,
    sourceSpans: Object.freeze([Object.freeze({
      passageId: base.batch.passages[0].id,
      spans: Object.freeze(denseEvidence),
      literalAnnotations: Object.freeze([]),
    })]),
    analysisAtomLimit: 24,
  });
  const denseAtoms = Array.from(
    { length: 13 },
    (_value, index) => [1, 0, 1, [index % denseEvidence.length]],
  );
  const denseLinks = [
    ...Array.from({ length: 8 }, (_value, index) => [0, 0, index + 1]),
    ...Array.from({ length: 8 }, (_value, index) => [1, 1, index + 2]),
    ...Array.from({ length: 8 }, (_value, index) => [2, 2, index + 3]),
    [3, 3, 4],
  ];
  const analyzeDenseWire = async (links) => createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => successfulProviderResponse({
      d: 2,
      p: [[0, 0, denseAtoms, Array(5).fill("000000")]],
      l: links,
    }),
  }).analyze(denseRequest);
  const denseValid = await analyzeDenseWire(denseLinks.slice(0, 24));
  assert.equal(
    denseValid.passages[0].atoms.reduce((sum, { links }) => sum + links.length, 0),
    24,
  );
  const redundantAfterCapacity = await analyzeDenseWire([
    ...denseLinks.slice(0, 8),
    denseLinks[0],
    [0, 0, 0],
  ]);
  assert.equal(redundantAfterCapacity.passages[0].atoms[0].links.length, 8);
  assert.deepEqual(await analyzeDenseWire(denseLinks), {}, "more than twenty-four total links");
});

test("the terminal one-atom wire closes the run 147 schema and decoder seam", async () => {
  const base = minimalAnalysisRequest("A");
  const request = Object.freeze({
    ...base,
    sourceSpans: latticeSourceSpansForBatch(base.batch),
    analysisAtomLimit: 1,
  });
  const wire = ({ evidence = [0], disposition = 0, masks = ["0", "0", "0", "0", "0"], links = [] } = {}) => ({
    d: 2,
    p: [[0, disposition, [[1, 0, 1, evidence]], masks]],
    l: links,
  });
  let providerBody;
  const analyze = async (value) => createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async (_url, init) => {
      providerBody = JSON.parse(init.body);
      return successfulProviderResponse(value);
    },
  }).analyze(request);

  const cases = [
    wire(),
    wire({ evidence: [0, 0] }),
    wire({ links: [[0, 0, 0]] }),
    wire({ masks: ["1", "0", "0", "0", "0"] }),
    wire({ disposition: 1 }),
  ];
  for (const value of cases) {
    const analysis = await analyze(value);
    assert.equal(analysis.documentKind, "instruction");
    assert.equal(analysis.passages[0].disposition, "rewrite");
    assert.deepEqual(analysis.passages[0].atoms[0].evidenceSpanIds, [
      request.sourceSpans[0].spans[0].id,
    ]);
    assert.deepEqual(analysis.passages[0].atoms[0].links, []);
  }

  const schema = providerBody.response_format.json_schema.schema;
  const atoms = schema.properties.p.prefixItems[0].prefixItems[2];
  assert.equal(atoms.minItems, 1);
  assert.equal(atoms.maxItems, 1);
  assert.deepEqual(atoms.prefixItems[0].prefixItems[3].prefixItems, [{ const: 0 }]);
  assert.equal(schema.properties.l.maxItems, 0);
});

test("the compact analysis host derivation truncates only at a grapheme boundary", async () => {
  const base = minimalAnalysisRequest("A bounded source passage.");
  const passageId = base.batch.passages[0].id;
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => successfulProviderResponse({
      d: 2,
      p: [[0, 0, [[1, 0, 1, [0]]], ["0", "0", "0", "0", "0"]]],
      l: [],
    }),
  });
  const derive = async (text) => adapter.analyze(Object.freeze({
    ...base,
    analysisAtomLimit: 1,
    sourceSpans: Object.freeze([Object.freeze({
      passageId,
      spans: Object.freeze([Object.freeze({
        id: `${passageId}:s01`,
        kind: "source",
        text,
      })]),
      literalAnnotations: Object.freeze([]),
    })]),
  }));
  const combining = await derive(`${"x".repeat(179)}e\u0301tail`);
  assert.equal(combining.passages[0].atoms[0].value, "x".repeat(179));
  assert.doesNotMatch(combining.passages[0].atoms[0].value, /\p{M}$/u);

  const joinedEmoji = await derive(`${"x".repeat(178)}👨‍👩‍👧‍👦tail`);
  assert.equal(joinedEmoji.passages[0].atoms[0].value, "x".repeat(178));
  assert.doesNotMatch(joinedEmoji.passages[0].atoms[0].value, /\u200d$/u);

  const isolated = await derive(`\u2066${"a".repeat(200)}\u2069 suffix.`);
  assert.equal(hasInvalidLatticeBidiIsolates(isolated.passages[0].atoms[0].value), false);
  assert.equal(isolated.passages[0].atoms[0].value.startsWith("\u2066"), true);
  assert.equal(isolated.passages[0].atoms[0].value.endsWith("\u2069"), true);
});

test("compact analysis ledger positions preserve their exact negative-index boundary", async () => {
  const request = Object.freeze({
    ...minimalAnalysisRequest(),
    analysisAtomLimit: 2,
    documentLedger: Object.freeze(["r0", "r1"].map((id) => Object.freeze({
      id,
      passageId: "prior",
      kind: "state",
      value: "prior grounded state",
      priority: "semantic",
      links: Object.freeze([]),
    }))),
  });
  const responseWire = (targetPositions) => ({
    d: 2,
    p: [[
      0,
      0,
      [[1, 0, 1, [0]], [2, 0, 1, [0]]],
      ["0", "0", "0", "0", "0"],
    ]],
    l: targetPositions.map((target, index) => [0, index, target]),
  });
  let providerBody;
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async (_url, init) => {
      providerBody = JSON.parse(init.body);
      return successfulProviderResponse(responseWire([-1, -2]));
    },
  });
  const result = await adapter.analyze(request);
  assert.deepEqual(result.passages[0].atoms[0].links, [
    { relation: "agent", targetAtomId: "r0" },
    { relation: "patient", targetAtomId: "r1" },
  ]);
  assert.equal(
    providerBody.response_format.json_schema.schema.properties.l.items.prefixItems[2].minimum,
    -2,
  );

  const outsideLedger = await createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => successfulProviderResponse(responseWire([-3])),
  }).analyze(request);
  assert.deepEqual(outsideLedger, {});

  const singletonRequest = Object.freeze({
    ...minimalAnalysisRequest("A"),
    analysisAtomLimit: 1,
    documentLedger: request.documentLedger,
  });
  let singletonProviderBody;
  const singleton = await createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async (_url, init) => {
      singletonProviderBody = JSON.parse(init.body);
      return successfulProviderResponse({
        d: 2,
        p: [[0, 0, [[1, 0, 1, [0]]], ["0", "0", "0", "0", "0"]]],
        l: [[0, 0, -1]],
      });
    },
  }).analyze(singletonRequest);
  assert.deepEqual(singleton.passages[0].atoms[0].links, [
    { relation: "agent", targetAtomId: "r0" },
  ]);
  assert.deepEqual(
    singletonProviderBody.response_format.json_schema.schema
      .properties.l.items.prefixItems[2].enum,
    [-1, -2],
  );

  for (const invalidIds of [["r0", "r0"], ["a0"]]) {
    let calls = 0;
    const invalidLedger = Object.freeze(invalidIds.map((id) => Object.freeze({
      id,
      passageId: "prior",
      kind: "state",
      value: "prior grounded state",
      priority: "semantic",
      links: Object.freeze([]),
    })));
    await assert.rejects(
      createHuggingFaceLatticeAdapter({
        token: "server-token",
        fetchImpl: async () => {
          calls += 1;
          return successfulProviderResponse({});
        },
      }).analyze(Object.freeze({ ...singletonRequest, documentLedger: invalidLedger })),
      /invalid analysis ledger identifiers/u,
    );
    assert.equal(calls, 0);
  }
});

test("provider failures carry only an immutable allowlisted stage and bounded call ordinal", async () => {
  const privateBody = "PRIVATE-PROVIDER-BODY-MUST-NOT-CROSS";
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => new Response(privateBody, {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    }),
  });
  await assert.rejects(
    adapter.analyze(minimalAnalysisRequest()),
    (error) => {
      assert.ok(error instanceof LatticeProviderError);
      assert.equal(error.code, "provider_http_error");
      assert.equal(error.status, 503);
      assert.equal(error.qualificationStage, "analysis");
      assert.equal(error.qualificationCallOrdinal, 1);
      assert.equal(LATTICE_PROVIDER_FAILURE_CLASSES.includes(error.code), true);
      assert.equal(LATTICE_PROVIDER_STAGES.includes(error.qualificationStage), true);
      assert.equal(Object.keys(error).includes("qualificationStage"), false);
      assert.equal(Object.keys(error).includes("qualificationCallOrdinal"), false);
      assert.equal(error.message.includes(privateBody), false);
      return true;
    },
  );
});

test("provider diagnostics attribute a later verifier-stage failure to its exact call ordinal", async () => {
  const calls = [];
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body));
      if (calls.length === 1) {
        return successfulProviderResponse({ d: "instruction", p: [], q: [] });
      }
      return new Response("PRIVATE-LATER-STAGE-BODY", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      });
    },
  });
  await adapter.analyze(minimalAnalysisRequest());
  await assert.rejects(
    adapter.certify({
      certificateId: "certificate:diagnostic-stage",
      obligationIds: Object.freeze(["document:whole"]),
      source: "Original source.",
      candidate: "Candidate source.",
      analysis: null,
      signal: new AbortController().signal,
    }),
    (error) => {
      assert.ok(error instanceof LatticeProviderError);
      assert.equal(error.code, "provider_http_error");
      assert.equal(error.status, 503);
      assert.equal(error.qualificationStage, "certification");
      assert.equal(error.qualificationCallOrdinal, 2);
      return true;
    },
  );
  assert.deepEqual(calls.map(({ model }) => model), [
    LATTICE_REMOTE_MODELS.generator,
    LATTICE_REMOTE_MODELS.verifier,
  ]);
});

test("a direct JSON-object request prepends the trusted closed schema without changing user data", async () => {
  let body;
  const options = providerRequestOptions(async (_url, init) => {
    body = JSON.parse(init.body);
    return successfulProviderResponse({ accepted: true });
  });
  await requestHuggingFaceJson(options);

  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal(Object.hasOwn(body, "chat_template_kwargs"), false);
  assert.equal(body.messages[0].role, "system");
  assert.match(body.messages[0].content, /Response contract lattice_test_v1/u);
  assert.ok(body.messages[0].content.includes(JSON.stringify(options.schema)));
  assert.doesNotMatch(body.messages[0].content, /\/no_think/u);
  assert.deepEqual(body.messages[1], options.messages[0]);
});

test("an explicitly enabled stopped-content verifier envelope is normalized narrowly", async () => {
  let body;
  let fetches = 0;
  const responseGuide = "Return one complete verification record as the JSON object.";
  const options = providerRequestOptions(async (_url, init) => {
    fetches += 1;
    body = JSON.parse(init.body);
    return new Response(JSON.stringify({
      choices: [{
        finish_reason: "stop",
        message: {
          role: "assistant",
          content: JSON.stringify({ accepted: true }),
        },
      }],
      usage: { completion_tokens: 320 },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }, {
    role: "verifier",
    toolName: VERIFICATION_TOOL_NAME,
    toolChoice: "named",
    allowStoppedToolContent: true,
    responseGuide,
  });

  const result = await requestHuggingFaceJson(options);

  assert.deepEqual(result, { accepted: true });
  assert.equal(fetches, 1);
  assert.deepEqual(forcedToolSchema(body, VERIFICATION_TOOL_NAME), options.schema);
  assert.match(body.messages[0].content, /Response channel lattice_verification_wire_v2/u);
  assert.match(body.messages[0].content, /Call this function exactly once/u);
  assert.equal(body.messages[0].content.includes(JSON.stringify(options.schema)), false);
});

test("stopped-content normalization is disabled by default", async () => {
  let fetches = 0;
  await assert.rejects(
    requestHuggingFaceJson(providerRequestOptions(async () => {
      fetches += 1;
      return providerChoiceResponse({
        finish_reason: "stop",
        message: { role: "assistant", content: JSON.stringify({ accepted: true }) },
      });
    }, {
      role: "verifier",
      toolName: VERIFICATION_TOOL_NAME,
      toolChoice: "named",
    })),
    (error) => error instanceof LatticeProviderError
      && error.code === "provider_malformed_response",
  );
  assert.equal(fetches, 1);
});

test("forced-tool content normalization rejects ambiguous and nonterminal envelopes", async () => {
  const privateMarker = "PRIVATE-FORCED-TOOL-CONTENT-MUST-NOT-CROSS";
  const accepted = JSON.stringify({ accepted: true });
  const cases = [
    {
      name: "output limit",
      finishReason: "length",
      message: { role: "assistant", content: accepted },
      code: "provider_output_limit",
    },
    {
      name: "null tool calls",
      finishReason: "stop",
      message: { role: "assistant", content: accepted, tool_calls: null },
      code: "provider_malformed_response",
    },
    {
      name: "empty tool calls",
      finishReason: "stop",
      message: { role: "assistant", content: accepted, tool_calls: [] },
      code: "provider_malformed_response",
    },
    {
      name: "tool finish without a call",
      finishReason: "tool_calls",
      message: { role: "assistant", content: accepted },
      code: "provider_malformed_response",
    },
    {
      name: "legacy function call",
      finishReason: "stop",
      message: {
        role: "assistant",
        content: accepted,
        function_call: { name: VERIFICATION_TOOL_NAME, arguments: accepted },
      },
      code: "provider_malformed_response",
    },
    {
      name: "null legacy function call",
      finishReason: "stop",
      message: { role: "assistant", content: accepted, function_call: null },
      code: "provider_malformed_response",
    },
    {
      name: "wrong named call",
      finishReason: "stop",
      message: {
        role: "assistant",
        content: accepted,
        tool_calls: [providerToolCall({ name: "other_tool" })],
      },
      code: "provider_malformed_response",
    },
    {
      name: "multiple tool calls",
      finishReason: "stop",
      message: {
        role: "assistant",
        content: accepted,
        tool_calls: [providerToolCall(), providerToolCall({ id: "call_extra" })],
      },
      code: "provider_malformed_response",
    },
    {
      name: "invalid content JSON",
      finishReason: "stop",
      message: { role: "assistant", content: `${privateMarker} {`, tool_calls: [] },
      code: "provider_malformed_response",
    },
    {
      name: "non-object content",
      finishReason: "stop",
      message: { role: "assistant", content: JSON.stringify([privateMarker]) },
      code: "provider_malformed_response",
    },
    {
      name: "empty content",
      finishReason: "stop",
      message: { role: "assistant", content: "" },
      code: "provider_malformed_response",
    },
    {
      name: "missing content",
      finishReason: "stop",
      message: { role: "assistant" },
      code: "provider_malformed_response",
    },
    {
      name: "wrong role",
      finishReason: "stop",
      message: { role: "user", content: accepted },
      code: "provider_malformed_response",
    },
    {
      name: "extra message field",
      finishReason: "stop",
      message: { role: "assistant", content: accepted, refusal: null },
      code: "provider_malformed_response",
    },
    {
      name: "oversized content",
      finishReason: "stop",
      message: {
        role: "assistant",
        content: `${privateMarker}${"x".repeat(LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT)}`,
      },
      code: "provider_response_too_large",
    },
  ];

  for (const { name, finishReason, message, code } of cases) {
    let fetches = 0;
    await assert.rejects(
      requestHuggingFaceJson(providerRequestOptions(async () => {
        fetches += 1;
        return providerChoiceResponse({ finish_reason: finishReason, message });
      }, {
        role: "verifier",
        toolName: VERIFICATION_TOOL_NAME,
        toolChoice: "named",
        allowStoppedToolContent: true,
      })),
      (error) => {
        assert.ok(error instanceof LatticeProviderError, name);
        assert.equal(error.code, code, name);
        assert.equal(error.message.includes(privateMarker), false, name);
        assert.equal(JSON.stringify(error).includes(privateMarker), false, name);
        return true;
      },
    );
    assert.equal(fetches, 1, name);
  }
});

test("verifier JSON-object envelopes remain bounded and fail closed", async () => {
  const privateMarker = "PRIVATE-VERIFIER-CONTENT-MUST-NOT-CROSS";
  const cases = [
    {
      name: "output limit",
      finishReason: "length",
      message: { role: "assistant", content: privateMarker },
      code: "provider_output_limit",
    },
    {
      name: "tool finish reason",
      finishReason: "tool_calls",
      message: { role: "assistant", content: JSON.stringify({ accepted: true }) },
      code: "provider_malformed_response",
    },
    {
      name: "missing content",
      finishReason: "stop",
      message: { role: "assistant" },
      code: "provider_malformed_response",
    },
    {
      name: "invalid content JSON",
      finishReason: "stop",
      message: { role: "assistant", content: `${privateMarker} {` },
      code: "provider_malformed_response",
    },
    {
      name: "non-object content",
      finishReason: "stop",
      message: { role: "assistant", content: JSON.stringify([privateMarker]) },
      code: "provider_malformed_response",
    },
    {
      name: "wrong message role",
      finishReason: "stop",
      message: { role: "user", content: privateMarker },
      code: "provider_malformed_response",
    },
  ];

  for (const { name, finishReason, message, code } of cases) {
    let fetches = 0;
    await assert.rejects(
      requestHuggingFaceJson(providerRequestOptions(async () => {
        fetches += 1;
        return providerChoiceResponse({ finish_reason: finishReason, message });
      }, { role: "verifier", responseFormat: "json_object" })),
      (error) => {
        assert.ok(error instanceof LatticeProviderError, name);
        assert.equal(error.code, code, name);
        assert.equal(error.message.includes(privateMarker), false, name);
        assert.equal(JSON.stringify(error).includes(privateMarker), false, name);
        return true;
      },
    );
    assert.equal(fetches, 1, name);
  }
});

test("a direct strict JSON Schema request sends one authoritative schema without tool fields", async () => {
  let body;
  const responseGuide = "Populate the accepted decision without additional prose.";
  const options = providerRequestOptions(async (_url, init) => {
    body = JSON.parse(init.body);
    return successfulProviderResponse({ accepted: true });
  }, {
    responseFormat: "json_schema",
    responseGuide,
  });
  const result = await requestHuggingFaceJson(options);

  assert.deepEqual(result, { accepted: true });
  assert.deepEqual(body.response_format, {
    type: "json_schema",
    json_schema: {
      name: options.schemaName,
      description: responseGuide,
      schema: options.schema,
      strict: true,
    },
  });
  assert.equal(Object.hasOwn(body, "tools"), false);
  assert.equal(Object.hasOwn(body, "tool_choice"), false);
  assert.equal(Object.hasOwn(body, "parallel_tool_calls"), false);
  assert.match(body.messages[0].content, /Response contract lattice_test_v1/u);
  assert.match(body.messages[0].content, /Populate the accepted decision without additional prose/u);
  assert.equal(body.messages[0].content.includes(JSON.stringify(options.schema)), false);
  assert.deepEqual(body.messages[1], options.messages[0]);
});

test("a named verifier-tool request accepts only its exact returned tool call", async () => {
  const variants = [
    { name: "absent content", finishReason: "tool_calls" },
    { name: "null content", finishReason: "stop", content: null },
    { name: "empty content", finishReason: "tool_calls", content: "" },
    { name: "whitespace content", finishReason: "stop", content: " \n\t" },
    {
      name: "nonempty content",
      finishReason: "stop",
      content: "PRIVATE-AUXILIARY-CONTENT-IS-NOT-PARSED {not-json",
    },
    {
      name: "legacy function call",
      finishReason: "stop",
      functionCall: {
        name: "PRIVATE-WRONG-LEGACY-NAME",
        arguments: "PRIVATE-MALFORMED-LEGACY-ARGUMENTS {",
      },
    },
  ];
  for (const { name, ...responseOptions } of variants) {
    let body;
    const result = await requestHuggingFaceJson(providerRequestOptions(async (_url, init) => {
      body = JSON.parse(init.body);
      return successfulProviderToolResponse(
        { accepted: true },
        responseOptions,
      );
    }, {
      role: "verifier",
      toolName: ANALYSIS_TOOL_NAME,
      responseGuide: "Return the accepted decision through the named function.",
    }));

    assert.deepEqual(result, { accepted: true }, name);
    assert.equal(Object.hasOwn(body, "response_format"), false);
    assert.equal(Object.hasOwn(body, "parallel_tool_calls"), false);
    assert.deepEqual(body.tool_choice, {
      type: "function",
      function: { name: ANALYSIS_TOOL_NAME },
    });
    assert.equal(body.tools.length, 1);
    assert.equal(body.tools[0].type, "function");
    assert.equal(body.tools[0].function.name, ANALYSIS_TOOL_NAME);
    assert.deepEqual(body.tools[0].function.parameters, providerRequestOptions(() => {}).schema);
    assert.equal(Object.hasOwn(body.tools[0].function, "strict"), false);
    assert.equal(JSON.stringify(body.messages).includes(JSON.stringify(body.tools[0].function.parameters)), false);
  }
});

test("a named-tool envelope accepts the exact 256-code-unit call-id boundary", async () => {
  const toolCallId = "x".repeat(256);
  const result = await requestHuggingFaceJson(providerRequestOptions(async () => (
    successfulProviderToolResponse(
      { accepted: true },
      { toolCallId },
    )
  ), {
    role: "verifier",
    toolName: ANALYSIS_TOOL_NAME,
    responseGuide: "Return the accepted decision through the named function.",
  }));

  assert.equal(toolCallId.length, 256);
  assert.deepEqual(result, { accepted: true });
});

test("named-tool envelopes fail closed for missing, extra, or malformed calls", async () => {
  const validToolCall = providerToolCall();
  const cases = [
    ["missing tool calls", { role: "assistant" }],
    ["empty tool calls", { role: "assistant", tool_calls: [] }],
    [
      "extra tool calls",
      { role: "assistant", tool_calls: [validToolCall, providerToolCall({ id: "call_extra" })] },
    ],
    [
      "wrong tool type",
      { role: "assistant", tool_calls: [providerToolCall({ type: "computer" })] },
    ],
    [
      "wrong tool name",
      { role: "assistant", tool_calls: [providerToolCall({ name: "other_tool" })] },
    ],
    [
      "missing call id",
      {
        role: "assistant",
        tool_calls: [{
          type: "function",
          function: { name: ANALYSIS_TOOL_NAME, arguments: JSON.stringify({ accepted: true }) },
        }],
      },
    ],
    [
      "empty call id",
      { role: "assistant", tool_calls: [providerToolCall({ id: "" })] },
    ],
    [
      "non-string call id",
      { role: "assistant", tool_calls: [providerToolCall({ id: 7 })] },
    ],
    [
      "overlong call id",
      { role: "assistant", tool_calls: [providerToolCall({ id: "x".repeat(257) })] },
    ],
    [
      "missing function",
      { role: "assistant", tool_calls: [{ id: "call_lattice_analysis", type: "function" }] },
    ],
    [
      "missing arguments",
      {
        role: "assistant",
        tool_calls: [{
          id: "call_lattice_analysis",
          type: "function",
          function: { name: ANALYSIS_TOOL_NAME },
        }],
      },
    ],
    [
      "non-string arguments",
      { role: "assistant", tool_calls: [providerToolCall({ argumentsValue: { accepted: true } })] },
    ],
    [
      "empty arguments",
      { role: "assistant", tool_calls: [providerToolCall({ argumentsValue: "" })] },
    ],
    [
      "invalid arguments JSON",
      { role: "assistant", tool_calls: [providerToolCall({ argumentsValue: "{" })] },
    ],
    [
      "non-object arguments JSON",
      { role: "assistant", tool_calls: [providerToolCall({ argumentsValue: "[]" })] },
    ],
  ];

  for (const [name, message] of cases) {
    let fetches = 0;
    await assert.rejects(
      requestHuggingFaceJson(providerRequestOptions(async () => {
        fetches += 1;
        return providerChoiceResponse({ finish_reason: "tool_calls", message });
      }, { role: "verifier", toolName: ANALYSIS_TOOL_NAME })),
      (error) => {
        assert.ok(error instanceof LatticeProviderError, name);
        assert.equal(error.code, "provider_malformed_response", name);
        return true;
      },
    );
    assert.equal(fetches, 1, name);
  }
});

test("legacy named-tool helper rejects malformed envelopes without leaking private fields", async (context) => {
  const privateMarker = "PRIVATE-ENVELOPE-MUST-NOT-CROSS";
  const call = providerToolCall({ name: CERTIFICATION_TOOL_NAME });
  const native = (tool) => ({ role: "assistant", tool_calls: [tool] });
  const stopped = { role: "assistant", content: JSON.stringify({ accepted: true }) };
  const cases = [
    ["call record", native(null), "E00"],
    ["id type before other invalid fields", native({ ...call, id: 7, type: privateMarker }), "E01"],
    ["blank id", native({ ...call, id: " \t" }), "E02"],
    ["id bound before type", native({ ...call, id: "x".repeat(257), type: privateMarker }), "E03"],
    ["call discriminator", native({ ...call, type: privateMarker }), "E04"],
    ["function record", native({ ...call, function: null }), "E05"],
    ["name before arguments", native({ ...call, function: { name: privateMarker, arguments: 7 } }), "E06"],
    ["arguments type", native({ ...call, function: { ...call.function, arguments: {} } }), "E07"],
    ["finish before collection", { ...stopped, tool_calls: null }, "S01", { finishReason: "tool_calls" }],
    ["collection type before legacy", { ...stopped, tool_calls: null, function_call: null }, "S02N"],
    ["multiple collection", { ...stopped, tool_calls: [call, call] }, "S04"],
    ["legacy field before extra fields", { ...stopped, function_call: null, [privateMarker]: true }, "S05"],
    ["nonminimal field set before content type", { ...stopped, content: 7, [privateMarker]: true }, "S06"],
    ["content type", { role: "assistant", content: null }, "S07"],
    ["empty collection with legacy field", { ...stopped, tool_calls: [], function_call: null }, "S05"],
    ["empty collection with extra field", { ...stopped, tool_calls: [], [privateMarker]: true }, "S06"],
    ["empty collection with invalid content type", { ...stopped, tool_calls: [], content: null }, "S07"],
  ];
  for (const [name, message, , overrides = {}] of cases) {
    await context.test(name, async () => {
      let calls = 0;
      const options = providerRequestOptions(async () => {
        calls += 1;
        return providerChoiceResponse({ finish_reason: overrides.finishReason ?? "stop", message });
      }, { role: "verifier", toolName: CERTIFICATION_TOOL_NAME, toolChoice: "named",
        allowStoppedToolContent: true, allowEmptyStoppedToolCalls: true });
      await assert.rejects(requestHuggingFaceJson(options), (error) => {
        assert.ok(error instanceof LatticeProviderError);
        assert.equal(error.code, "provider_malformed_response");
        assert.equal(error.qualificationSubtype, undefined, "low-level helpers cannot publish stage diagnostics");
        assert.equal(JSON.stringify(error).includes(privateMarker), false);
        assert.equal(error.message.includes(privateMarker), false);
        return true;
      });
      assert.equal(calls, 1);
    });
  }
});

test("empty stopped-tool normalization remains an explicit two-tool opt-in", async () => {
  const message = { role: "assistant", content: JSON.stringify({ accepted: true }), tool_calls: [] };
  for (const toolName of [VERIFICATION_TOOL_NAME, CERTIFICATION_TOOL_NAME]) {
    for (const allowEmptyStoppedToolCalls of [false, true]) {
      let calls = 0;
      const options = providerRequestOptions(async (_url, init) => {
        calls += 1;
        assert.equal(Object.hasOwn(JSON.parse(init.body), "allowEmptyStoppedToolCalls"), false);
        return providerChoiceResponse({ finish_reason: "stop", message });
      }, { role: "verifier", toolName, toolChoice: "named", allowStoppedToolContent: true, allowEmptyStoppedToolCalls });
      if (allowEmptyStoppedToolCalls) assert.deepEqual(await requestHuggingFaceJson(options), { accepted: true });
      else await assert.rejects(requestHuggingFaceJson(options), (error) => error instanceof LatticeProviderError
        && error.code === "provider_malformed_response");
      assert.equal(calls, 1);
    }
  }
});

test("observed null stopped verification metadata is an explicit verification-only opt-in", async () => {
  for (const extras of [{}, { name: null }, { reasoning_content: null }, { name: null, reasoning_content: null }]) {
    for (const emptyCalls of [false, true]) {
      for (const enabled of [false, true]) {
        let calls = 0;
        const options = providerRequestOptions(async (_url, init) => {
          calls += 1;
          assert.doesNotMatch(init.body, /allowNullStoppedVerificationMetadata/u);
          return providerChoiceResponse({ finish_reason: "stop", message: {
            role: "assistant", content: JSON.stringify({ accepted: true }), ...extras,
            ...(emptyCalls ? { tool_calls: [] } : {}),
          } });
        }, { role: "verifier", toolName: VERIFICATION_TOOL_NAME, toolChoice: "named",
          allowStoppedToolContent: true, allowEmptyStoppedToolCalls: true,
          ...(enabled ? { allowNullStoppedVerificationMetadata: true } : {}),
        });
        if (enabled || Object.keys(extras).length === 0) assert.deepEqual(await requestHuggingFaceJson(options), { accepted: true });
        else await assert.rejects(requestHuggingFaceJson(options), (error) => error instanceof LatticeProviderError
          && error.code === "provider_malformed_response");
        assert.equal(calls, 1);
      }
    }
  }
  const adapter = createHuggingFaceLatticeAdapter({ token: "server-token", fetchImpl: async () =>
    providerChoiceResponse({ finish_reason: "stop", message: {
      role: "assistant", content: "{}", name: null, reasoning_content: null,
    } }) });
  await assert.rejects(adapter.certify(minimalCertificationRequest()), (error) => error.qualificationSubtype === "S06");
  assert.equal(adapter.completionCapacity().used, 1);
});

test("strict Nscale verification rejects legacy null metadata before content parsing", async (context) => {
  const request = minimalVerificationRequest();
  const content = JSON.stringify(acceptingVerificationWire(request));
  const stopped = { role: "assistant", content, name: null, reasoning_content: null };
  const tool = providerToolCall({ name: VERIFICATION_TOOL_NAME, argumentsValue: content });
  const cases = [
    ["observed pair", stopped, "S06"],
    ["observed pair with empty calls", { ...stopped, tool_calls: [] }, "S06"],
    ["observed pair with literal-null calls", { ...stopped, tool_calls: null }, "S02N"],
    ["legacy field remains rejected with a native call", { ...stopped, content: "PRIVATE", name: "PRIVATE", reasoning_content: "PRIVATE", function_call: null, tool_calls: [tool] }, "S05"],
    ["one valid native call supplies no verification fallback", { ...stopped, tool_calls: [tool] }, "S06"],
    ["nonempty native calls supply no verification fallback", { ...stopped, tool_calls: [{ ...tool, type: "PRIVATE" }] }, "S06"],
    ["extra before competing native call", { ...stopped, tool_calls: [tool], unknown: null }, "S06"],
    ["content type before competing native call", { ...stopped, tool_calls: [tool], content: null }, "S06"],
    ["finish before collection", { ...stopped, tool_calls: null }, "finish_reason", "tool_calls"],
    ["literal-null calls do not excuse nonnull metadata", { ...stopped, tool_calls: null, name: "PRIVATE" }, "S02N"],
    ["multiple calls before metadata", { ...stopped, tool_calls: [tool, tool] }, "S04"],
    ["legacy before metadata", { ...stopped, function_call: null, name: "PRIVATE" }, "S05"],
    ["extra before content type", { ...stopped, unknown: null, content: null }, "S06"],
    ["content type", { ...stopped, content: null }, "S06"],
    ["empty content", { ...stopped, content: "" }, "S06"],
    ["invalid JSON", { ...stopped, content: "{" }, "S06"],
  ];
  for (const key of ["name", "reasoning_content"]) {
    for (const value of ["", "PRIVATE", [], ["PRIVATE"], {}, { private: true }, false, 0]) {
      cases.push([`${key} rejects ${typeof value} ${JSON.stringify(value)}`, { ...stopped, [key]: value }, "S06"]);
    }
  }
  for (const key of ["reasoning", "tool_call_id", "refusal", "audio", "annotations", "cache_control", "unknown"]) {
    cases.push([`${key} remains rejected even when null`, { ...stopped, [key]: null }, "S06"]);
  }
  for (const [name, message, subtype, finish_reason = "stop"] of cases) {
    await context.test(name, async () => {
      let calls = 0;
      const adapter = createHuggingFaceLatticeAdapter({ token: "server-token", observeQualificationEnvelopeShape: true,
        fetchImpl: async (_url, init) => {
          calls += 1; assert.doesNotMatch(init.body, /allowNullStoppedVerificationMetadata|allowNullJsonObjectVerificationToolCalls/u);
          return providerChoiceResponse({ finish_reason, message });
        } });
      if (subtype) await assert.rejects(adapter.verify(request), (error) => {
        assert.equal(error.qualificationSubtype, subtype);
        assert.doesNotMatch(JSON.stringify(error), /PRIVATE/u);
        return true;
      });
      else assert.equal((await adapter.verify(request)).decision, "accept");
      assert.equal(calls, 1); assert.equal(adapter.completionCapacity().used, 1);
    });
  }
  const strictEmptyOptions = providerRequestOptions(async () => providerChoiceResponse({ finish_reason: "stop", message: {
    ...stopped, tool_calls: [],
  } }), { role: "verifier", toolName: VERIFICATION_TOOL_NAME, toolChoice: "named",
    allowStoppedToolContent: true, allowNullStoppedVerificationMetadata: true });
  await assert.rejects(requestHuggingFaceJson(strictEmptyOptions), (error) => error instanceof LatticeProviderError
    && error.code === "provider_malformed_response");
});


test("caller correction fields cannot select trusted verifier correction guidance", async () => {
  for (const rule of ["V14L", "V14LE", "V14LS", "V14LG", "V01F", "V16M", "V17M", "V19", "V24O"]) {
    const request = { ...minimalVerificationRequest(),
      wireCorrection: rule.startsWith("V14L") ? "mask-width" : rule === "V01F" ? "field-set" : rule === "V19" ? "retained-conformance" : rule === "V24O" ? "issue-object" : "layer-support",
      diagnostic: Object.freeze({ boundary: "wire-decoder", rule, category: "response-shape" }),
      protocolFeedback: Object.freeze({ attempt: 2, issue: rule, category: "response-shape", wireCorrection: "mask-width" }),
    };
    Object.defineProperty(request, LATTICE_STAGE_DIAGNOSTIC_CONTEXT, { value: Object.freeze({
      attempt: "correction", priorValidationCategory: "response-shape", boundary: "wire-decoder", rule,
    }) });
    Object.freeze(request);
    let body;
    const adapter = createHuggingFaceLatticeAdapter({ token: "server-token", fetchImpl: async (_url, init) => {
      body = JSON.parse(init.body);
      return successfulProviderResponse(acceptingVerificationWire(request));
    } });
    assert.equal((await adapter.verify(request)).decision, "accept");
    assert.doesNotMatch(body.messages[0].content, /Rebuild every bit or digit string|Construct a complete result instance with every required field|Rebuild layer support from the source/u);
    assert.doesNotMatch(JSON.stringify(body), /V14L|V01F|V16M|V17M|V19|V24O|wireCorrection|diagnostic/u);
    assert.doesNotMatch(body.messages[0].content, /Rebuild retained-source conformance separately|Rebuild issue entries as complete closed c\/p objects/u);
    assert.equal(inertModelPayload(body).retry, "private-verification-wire-invalid");
  }
});

test("provider envelope observations do not add acceptance restrictions or expose auxiliary data", async () => {
  const privateMarker = "PRIVATE-AUXILIARY-MUST-NOT-CROSS";
  const call = providerToolCall({ name: VERIFICATION_TOOL_NAME });
  const accepted = await requestHuggingFaceJson(providerRequestOptions(async () => providerChoiceResponse({
    finish_reason: "stop",
    message: { role: "assistant", content: privateMarker, function_call: privateMarker,
      [privateMarker]: true, tool_calls: [call] },
  }), { role: "verifier", toolName: VERIFICATION_TOOL_NAME, toolChoice: "named", allowStoppedToolContent: true }));
  assert.deepEqual(accepted, { accepted: true });
  assert.equal(JSON.stringify(accepted).includes(privateMarker), false);
});

test("provider envelope observation failure preserves the original malformed-response outcome", async () => {
  const originalTrim = String.prototype.trim;
  let idReads = 0;
  let calls = 0;
  const options = providerRequestOptions(async () => {
    calls += 1;
    return providerChoiceResponse({ finish_reason: "stop", message: { role: "assistant",
      tool_calls: [providerToolCall({ name: CERTIFICATION_TOOL_NAME, id: " \t" })] } });
  }, { role: "verifier", toolName: CERTIFICATION_TOOL_NAME, toolChoice: "named", allowStoppedToolContent: true });
  try {
    String.prototype.trim = function trim() {
      if (String(this) === " \t" && ++idReads > 1) throw new Error("PRIVATE-OBSERVER-ERROR");
      return originalTrim.call(this);
    };
    await assert.rejects(requestHuggingFaceJson(options), (error) => {
      assert.ok(error instanceof LatticeProviderError);
      assert.equal(error.code, "provider_malformed_response");
      assert.equal(error.qualificationSubtype, undefined);
      assert.equal(error.message.includes("PRIVATE-OBSERVER-ERROR"), false);
      return true;
    });
  } finally { String.prototype.trim = originalTrim; }
  assert.equal(idReads, 2);
  assert.equal(calls, 1);
});

test("strict Nscale review stages reject literal-null and malformed collections", async (context) => {
  const privateMarker = "PRIVATE-COLLECTION-MUST-NOT-CROSS";
  for (const stage of ["verification", "certification"]) {
    const request = stage === "verification" ? minimalVerificationRequest() : minimalCertificationRequest();
    const method = stage === "verification" ? "verify" : "certify";
    const content = JSON.stringify(stage === "verification"
      ? acceptingVerificationWire(request)
      : acceptingCertificationWire(request.certificateId, request.obligationIds));
    const stopped = { role: "assistant", content };
    const cases = [
      ["literal-null collection", { ...stopped, tool_calls: null }, "S02N", "stop"],
      ...[{}, { secret: privateMarker }, "", privateMarker, false, true, 0, 7].map((value) => [
        `${typeof value}:${JSON.stringify(value)}`, { ...stopped, tool_calls: value }, "S02", "stop",
      ]),
      ["null with legacy", { ...stopped, tool_calls: null, function_call: null }, "S02N", "stop"],
      ["null with extras", { ...stopped, tool_calls: null, [privateMarker]: true }, "S02N", "stop"],
      ["null with nonstring content", { ...stopped, tool_calls: null, content: null }, "S02N", "stop"],
      ["null with empty content", { ...stopped, tool_calls: null, content: "" }, "S02N", "stop"],
      ["null with invalid JSON", { ...stopped, tool_calls: null, content: "{" }, "S02N", "stop"],
      ["null with array JSON", { ...stopped, tool_calls: null, content: "[]" }, "S02N", "stop"],
      ["role precedes null", { ...stopped, role: "user", tool_calls: null }, "message_role", "stop"],
      ["finish precedes null", { ...stopped, tool_calls: null }, "finish_reason", "tool_calls"],
    ];
    for (const [name, message, subtype, finish_reason] of cases) {
      await context.test(`${stage}: ${name}`, async () => {
        let calls = 0;
        const adapter = createHuggingFaceLatticeAdapter({ token: "server-test-token",
          observeQualificationEnvelopeShape: true, fetchImpl: async (_url, init) => {
            calls += 1;
            assert.doesNotMatch(init.body, /allowNullJsonObjectVerificationToolCalls/u);
            return providerChoiceResponse({ finish_reason, message });
          } });
        if (subtype === null) assert.equal((await adapter[method](request)).decision, "accept");
        else await assert.rejects(adapter[method](request), (error) => {
          assert.equal(error.code, "provider_malformed_response");
          assert.equal(error.qualificationSubtype, subtype);
          assert.equal(error.qualificationStage, stage);
          assert.equal(error.qualificationEnvelopeShape, null);
          assert.equal(Object.getOwnPropertyDescriptor(error, "qualificationSubtype").enumerable, false);
          assert.doesNotMatch(error.message + JSON.stringify(error), /PRIVATE-COLLECTION/u);
          return true;
        });
        assert.equal(calls, 1); assert.equal(adapter.completionCapacity().used, 1);
      });
    }
  }
});


test("coded envelope observations remain confined to marked expiring qualification errors", async () => {
  const privateMarker = "PRIVATE-ENVELOPE-CONTENT-MUST-NOT-CROSS";
  const certificationRequest = { ...minimalCertificationRequest() };
  Object.defineProperty(certificationRequest, LATTICE_STAGE_DIAGNOSTIC_CONTEXT, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({ attempt: "initial", priorValidationCategory: "none" }),
  });
  Object.freeze(certificationRequest);
  const makeWorker = () => createLatticeApiWorker({
    fetchImpl: async () => providerChoiceResponse({ finish_reason: "stop",
      message: { role: "assistant", content: privateMarker, tool_calls: null } }),
    runTextToLatticeImpl: async (_text, { adapter }) => adapter.certify(certificationRequest),
  });
  const headers = { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE };
  const active = { HF_TOKEN: "server_only_token", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z" };
  const ordinary = await makeWorker().fetch(apiRequest(validPayload, { headers }), { HF_TOKEN: "server_only_token" });
  const marked = await makeWorker().fetch(apiRequest(validPayload, { headers }), active);
  assert.equal(ordinary.status, 502);
  assert.equal(marked.status, 502);
  assert.deepEqual(await json(ordinary), { error: "malformed_upstream_response" });
  assert.deepEqual(await json(marked), { error: "malformed_upstream_response" });
  for (const header of Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)) assert.equal(ordinary.headers.has(header), false);
  assert.equal(marked.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.subtype), "S02N");
  assert.equal(marked.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.stage), "certification");
  assert.equal(marked.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.stageAttempt), "initial");
  assert.equal(JSON.stringify([...marked.headers]).includes(privateMarker), false);
});

test("the Worker suppresses impossible coded envelope provenance", async (contextTest) => {
  const base = {
    qualificationStage: "verification", qualificationCallOrdinal: 4,
    qualificationSubtype: "E06", qualificationFinishReason: "stop",
    qualificationRequestSize: "4097-16384", qualificationResponseSize: "1-4096",
    qualificationContentSize: "1-4096", qualificationCompletionTokens: "1-255",
    qualificationStageAttempt: "initial", qualificationAnalysisOrigin: "none",
    qualificationAnalysisAttempt: "none", qualificationPriorValidationCategory: "none",
  };
  const cases = [
    ["native predicate", {}, "E06"],
    ["stopped predicate", { qualificationSubtype: "S02" }, "S02"],
    ["literal null predicate", { qualificationSubtype: "S02N" }, "S02N"],
    ["null wrong stage", { qualificationSubtype: "S02N", qualificationStage: "analysis",
      qualificationAnalysisOrigin: "initial", qualificationAnalysisAttempt: "1" }, null],
    ["null wrong finish", { qualificationSubtype: "S02N", qualificationFinishReason: "tool_calls" }, null],
    ["wrong stage", { qualificationStage: "analysis", qualificationAnalysisOrigin: "initial",
      qualificationAnalysisAttempt: "1" }, null],
    ["wrong stopped finish", { qualificationSubtype: "S01" }, null],
    ["wrong collection finish", { qualificationSubtype: "S02", qualificationFinishReason: "tool_calls" }, null],
    ["absent native finish", { qualificationFinishReason: "none" }, null],
  ];
  for (const [name, overrides, expected] of cases) {
    await contextTest.test(name, async () => {
      const failure = Object.assign(new LatticeProviderError("provider_malformed_response", "PRIVATE-ERROR"), base, overrides);
      const worker = createLatticeApiWorker({
        createAdapter: () => Object.freeze({}),
        runTextToLatticeImpl: async () => { throw failure; },
      });
      const response = await worker.fetch(apiRequest(validPayload, { headers: {
        [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
      } }), { HF_TOKEN: "server_only_token", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z" });
      assert.equal(response.status, 502);
      assert.deepEqual(await json(response), { error: "malformed_upstream_response" });
      assert.equal(response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.subtype), expected);
      if (expected === null) {
        for (const header of Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)) {
          assert.equal(response.headers.has(header), false);
        }
      }
      assert.equal(JSON.stringify([...response.headers]).includes("PRIVATE-ERROR"), false);
    });
  }
});

test("strict-schema analysis treats assistant content as authoritative and never falls back to tool fields", async () => {
  const privateMarker = "PRIVATE-AUXILIARY-TOOL-DATA-MUST-NOT-CROSS";
  const cases = [
    [
      "tool finish reason",
      {
        role: "assistant",
        content: JSON.stringify({ d: "instruction", p: [], q: [] }),
        tool_calls: [providerToolCall({ argumentsValue: privateMarker })],
      },
      "finish_reason",
      "tool_calls",
    ],
    [
      "missing content",
      { role: "assistant", tool_calls: [providerToolCall({ argumentsValue: privateMarker })] },
      "content_empty",
      "stop",
    ],
    [
      "invalid content JSON",
      {
        role: "assistant",
        content: `${privateMarker} {`,
        tool_calls: [providerToolCall({ argumentsValue: JSON.stringify({ d: "instruction", p: [], q: [] }) })],
      },
      "content_json",
      "stop",
    ],
    [
      "non-object content",
      {
        role: "assistant",
        content: "[]",
        function_call: {
          name: ANALYSIS_TOOL_NAME,
          arguments: JSON.stringify({ d: "instruction", p: [], q: [] }),
        },
      },
      "content_shape",
      "stop",
    ],
  ];

  for (const [name, message, subtype, finishReason] of cases) {
    let fetches = 0;
    const adapter = createHuggingFaceLatticeAdapter({
      token: "server-token",
      fetchImpl: async () => {
        fetches += 1;
        return providerChoiceResponse({ finish_reason: finishReason, message });
      },
    });
    await assert.rejects(
      adapter.analyze(minimalAnalysisRequest()),
      (error) => {
        assert.ok(error instanceof LatticeProviderError, name);
        assert.equal(error.code, "provider_malformed_response", name);
        assert.equal(error.qualificationSubtype, subtype, name);
        assert.equal(error.qualificationStage, "analysis", name);
        assert.equal(error.qualificationCallOrdinal, 1, name);
        assert.equal(error.message.includes(privateMarker), false, name);
        return true;
      },
    );
    assert.equal(fetches, 1, name);
  }
});

test("a named-tool completion that reaches the output limit fails after one fetch", async () => {
  let fetches = 0;
  await assert.rejects(
    requestHuggingFaceJson(providerRequestOptions(async () => {
      fetches += 1;
      return providerChoiceResponse({
        finish_reason: "length",
        message: {
          role: "assistant",
          tool_calls: [providerToolCall({ argumentsValue: '{"accepted":' })],
        },
      });
    }, { role: "verifier", toolName: ANALYSIS_TOOL_NAME })),
    (error) => error instanceof LatticeProviderError
      && error.code === "provider_output_limit"
      && !error.message.includes("accepted"),
  );
  assert.equal(fetches, 1);
});

test("production strict verification accepts only its closed stopped-content envelope", async (context) => {
  const request = minimalVerificationRequest();
  const wire = acceptingVerificationWire(request);
  const content = JSON.stringify(wire);
  const tool = providerToolCall({ name: VERIFICATION_TOOL_NAME, argumentsValue: content });
  const cases = [
    ["valid minimal content", "stop", { role: "assistant", content }, null],
    ["native tool with auxiliary content is rejected", "stop", { role: "assistant", content: "PRIVATE-AUXILIARY", tool_calls: [tool] }, "provider_malformed_response"],
    ["valid observed-rejected null stopped tool field", "stop", { role: "assistant", content, tool_calls: null }, "provider_malformed_response"],
    ["null collection with legacy field", "stop", { role: "assistant", content, tool_calls: null, function_call: null }, "provider_malformed_response"],
    ["null collection with auxiliary field", "stop", { role: "assistant", content, tool_calls: null, private: "PRIVATE-AUXILIARY" }, "provider_malformed_response"],
    ["null collection with empty content", "stop", { role: "assistant", content: "", tool_calls: null }, "provider_malformed_response"],
    ["null collection with invalid JSON", "stop", { role: "assistant", content: "{", tool_calls: null }, "provider_malformed_response"],
    ["null collection with array JSON", "stop", { role: "assistant", content: "[]", tool_calls: null }, "provider_malformed_response"],
    ["null collection with oversized content", "stop", { role: "assistant", content: "x".repeat(LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT + 1), tool_calls: null }, "provider_malformed_response"],
    ["null collection with truncated finish", "length", { role: "assistant", content, tool_calls: null }, "provider_output_limit"],
    ["empty collection with legacy field", "stop", { role: "assistant", content, tool_calls: [], function_call: null }, "provider_malformed_response"],
    ["empty collection with auxiliary field", "stop", { role: "assistant", content, tool_calls: [], private: "PRIVATE-AUXILIARY" }, "provider_malformed_response"],
    ["empty collection with wrong role", "stop", { role: "user", content, tool_calls: [] }, "provider_malformed_response"],
    ["empty collection with tool finish", "tool_calls", { role: "assistant", content, tool_calls: [] }, "provider_malformed_response"],
    ["empty collection with empty content", "stop", { role: "assistant", content: "", tool_calls: [] }, "provider_malformed_response"],
    ["empty collection with invalid JSON", "stop", { role: "assistant", content: "{", tool_calls: [] }, "provider_malformed_response"],
    ["empty collection with array JSON", "stop", { role: "assistant", content: "[]", tool_calls: [] }, "provider_malformed_response"],
    ["empty collection with oversized content", "stop", { role: "assistant", content: "x".repeat(LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT + 1), tool_calls: [] }, "provider_response_too_large"],
    ["empty collection with truncated finish", "length", { role: "assistant", content, tool_calls: [] }, "provider_output_limit"],
    ["legacy field", "stop", { role: "assistant", content, function_call: null }, "provider_malformed_response"],
    ["auxiliary field", "stop", { role: "assistant", content, private: "PRIVATE-AUXILIARY" }, "provider_malformed_response"],
    ["tool finish with valid content", "tool_calls", { role: "assistant", content }, "provider_malformed_response"],
    ["only tool arguments are rejected", "stop", { role: "assistant", tool_calls: [tool] }, "provider_malformed_response"],
    ["wrong role", "stop", { role: "user", content }, "provider_malformed_response"],
    ["empty content", "stop", { role: "assistant", content: "" }, "provider_malformed_response"],
    ["invalid JSON", "stop", { role: "assistant", content: "{" }, "provider_malformed_response"],
    ["array JSON", "stop", { role: "assistant", content: "[]" }, "provider_malformed_response"],
    ["content bound", "stop", { role: "assistant", content: "x".repeat(LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT + 1) }, "provider_response_too_large"],
    ["truncated result", "length", { role: "assistant", content }, "provider_output_limit"],
  ];
  for (const [name, finish_reason, message, code] of cases) {
    await context.test(name, async () => {
      let fetches = 0;
      const adapter = createHuggingFaceLatticeAdapter({ token: "server-token", fetchImpl: async (_url, init) => {
        fetches += 1;
        const body = JSON.parse(init.body);
        const schema = fittedVerificationSchemaForBody(body);
        assert.deepEqual(schema.required, ["d", "g", "p", "i"]);
        assert.equal(schema.additionalProperties, false);
        assert.equal(body.model, TEST_REVIEW_MODEL);
        assert.equal(body.max_tokens, 2_048);
        assert.equal(body.temperature, 0);
        assert.equal(body.top_p, 1);
        assert.equal(body.seed, 71_903);
        assert.equal(body.stream, false);
        assert.equal(Object.hasOwn(body, "requireMinimalVerificationContent"), false);
        assert.equal(Object.hasOwn(body, "allowNullJsonObjectVerificationToolCalls"), false);
        return providerChoiceResponse({ finish_reason, message });
      } });
      if (code) {
        await assert.rejects(adapter.verify(request), (error) => error instanceof LatticeProviderError
          && error.code === code && !JSON.stringify(error).includes("PRIVATE-AUXILIARY"));
      } else {
        const result = await adapter.verify(request);
        assert.equal(result.decision, "accept");
        assert.deepEqual(result.failedGates, []);
      }
      assert.equal(fetches, 1);
      assert.equal(adapter.completionCapacity().used, 1);
    });
  }
});

test("the configured verification cap still fails closed on a length finish without retry", async () => {
  let fetches = 0;
  let body;
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async (_url, init) => {
      fetches += 1;
      body = JSON.parse(init.body);
      return providerChoiceResponse({
        finish_reason: "length",
        message: {
          role: "assistant",
          content: '{"private":"truncated"',
        },
      });
    },
  });

  await assert.rejects(
    adapter.verify(minimalVerificationRequest()),
    (error) => error instanceof LatticeProviderError
      && error.code === "provider_output_limit"
      && !error.message.includes("private")
      && !JSON.stringify(error).includes("truncated"),
  );
  assert.equal(body.max_tokens, 2_048);
  assert.equal(fetches, 1);
});

test("every supported correction history preserves the verifier cap and sanitized terminal length at global call four", async (t) => {
  const base = minimalVerificationRequest();
  const correctionFeedback = Object.freeze({
    stage: "test-correction",
    attempt: 2,
    issue: "PRIVATE-HOST-CORRECTION-MUST-NOT-CROSS",
    instruction: "Return the closed fitted response.",
  });
  const analysisRequest = minimalAnalysisRequest();
  const candidateRequest = Object.freeze({ ...base, analysis: base.analysis });
  const correctedAnalysisRequest = Object.freeze({
    ...analysisRequest,
    protocolFeedback: correctionFeedback,
  });
  const correctedCandidateRequest = Object.freeze({
    ...candidateRequest,
    protocolFeedback: correctionFeedback,
  });
  const correctedVerificationRequest = Object.freeze({
    ...base,
    protocolFeedback: correctionFeedback,
  });
  const histories = [
    ["analysis correction", async (adapter) => {
      await adapter.analyze(analysisRequest);
      await adapter.analyze(correctedAnalysisRequest);
      await adapter.generate(candidateRequest);
    }],
    ["candidate correction", async (adapter) => {
      await adapter.analyze(analysisRequest);
      await adapter.generate(candidateRequest);
      await adapter.generate(correctedCandidateRequest);
    }],
    ["verifier host-normalization correction", async (adapter) => {
      await adapter.analyze(analysisRequest);
      await adapter.generate(candidateRequest);
      assert.deepEqual(await adapter.verify(base), {});
    }],
  ];

  for (const [name, arrange] of histories) {
    await t.test(name, async () => {
      const privatePrefix = `PRIVATE-TRUNCATED-${name}`;
      const calls = [];
      const adapter = createHuggingFaceLatticeAdapter({
        token: "server-token",
        fetchImpl: async (_url, init) => {
          const body = JSON.parse(init.body);
          calls.push(body);
          if (calls.length === 4) {
            return providerChoiceResponse({
              finish_reason: "length",
              message: {
                role: "assistant",
                content: `{"partial":"${privatePrefix}"`,
              },
            });
          }
          if (isAnalysisBody(body)) {
            return successfulProviderResponse({ d: "instruction", p: [], q: [] });
          }
          if (isCandidateBody(body)) {
            return successfulProviderResponse({ passages: [] });
          }
          return successfulProviderResponse({});
        },
      });

      await arrange(adapter);
      await assert.rejects(
        adapter.verify(correctedVerificationRequest),
        (error) => {
          assert.ok(error instanceof LatticeProviderError);
          assert.equal(error.code, "provider_output_limit");
          assert.equal(error.qualificationStage, "verification");
          assert.equal(error.qualificationCallOrdinal, 4);
          assert.equal(error.message.includes(privatePrefix), false);
          assert.equal(JSON.stringify(error).includes(privatePrefix), false);
          return true;
        },
      );
      assert.equal(calls.length, 4, "a terminal length finish must not retry");
      assert.equal(calls[3].max_tokens, 2_048);
      fittedVerificationSchemaForBody(calls[3]);
    });
  }
});

test("observed-null verification is an independent explicit permission with identical provider request bytes", async (context) => {
  const content = JSON.stringify({ accepted: true });
  let referenceBody;
  for (const nullPermission of [undefined, false, true]) {
    for (const emptyPermission of [false, true]) {
      for (const field of ["absent", "null", "empty"]) {
        await context.test(`null=${nullPermission ?? "default"}, empty=${emptyPermission}, field=${field}`, async () => {
          let calls = 0;
          const options = providerRequestOptions(async (_url, init) => {
            calls += 1;
            referenceBody ??= init.body;
            assert.equal(init.body, referenceBody, "all compatibility permissions remain host-only");
            assert.doesNotMatch(init.body, /allowNullJsonObjectVerificationToolCalls|allowEmptyStoppedToolCalls|requireMinimalVerificationContent/u);
            const body = JSON.parse(init.body);
            assert.equal(_url, TEST_REVIEW_URL);
            assert.equal(body.model, TEST_REVIEW_MODEL);
            assert.deepEqual(body.response_format, { type: "json_object" });
            assert.equal(Object.hasOwn(body, "tools"), false);
            assert.equal(Object.hasOwn(body, "tool_choice"), false);
            const extras = field === "absent" ? {} : { tool_calls: field === "null" ? null : [] };
            return providerChoiceResponse({ finish_reason: "stop", message: { role: "assistant", content, ...extras } });
          }, { role: "verifier", schemaName: VERIFICATION_TOOL_NAME, responseFormat: "json_object",
            requireMinimalVerificationContent: true, allowEmptyStoppedToolCalls: emptyPermission,
            ...(nullPermission === undefined ? {} : { allowNullJsonObjectVerificationToolCalls: nullPermission }),
          });
          const accepted = field === "absent" || (field === "null" ? nullPermission === true : emptyPermission);
          if (accepted) assert.deepEqual(await requestHuggingFaceJson(options), { accepted: true });
          else await assert.rejects(requestHuggingFaceJson(options), (error) => error instanceof LatticeProviderError
            && error.code === "provider_malformed_response");
          assert.equal(calls, 1);
        });
      }
    }
  }
});

test("observed-null verification permission admits explicit strict schema and rejects other transport scopes before fetch", async (context) => {
  for (const [label, overrides, allowed = false] of [
    ["generator role", { role: "generator" }],
    ["certification schema", { schemaName: CERTIFICATION_TOOL_NAME }],
    ["analysis schema", { schemaName: ANALYSIS_TOOL_NAME }],
    ["implicit JSON-object default", { responseFormat: undefined }],
    ["explicit strict schema", { responseFormat: "json_schema" }, true],
    ["minimal guard disabled", { requireMinimalVerificationContent: false }],
    ["named verification", { responseFormat: undefined, requireMinimalVerificationContent: false,
      toolName: VERIFICATION_TOOL_NAME, toolChoice: "named", allowStoppedToolContent: true }],
    ["named certification", { responseFormat: undefined, requireMinimalVerificationContent: false,
      schemaName: CERTIFICATION_TOOL_NAME, toolName: CERTIFICATION_TOOL_NAME, toolChoice: "named", allowStoppedToolContent: true }],
    ["stopped-tool mode", { allowStoppedToolContent: true }],
    ["string permission", { allowNullJsonObjectVerificationToolCalls: "true" }],
    ["numeric permission", { allowNullJsonObjectVerificationToolCalls: 1 }],
    ["null permission", { allowNullJsonObjectVerificationToolCalls: null }],
  ]) {
    await context.test(label, async () => {
      let calls = 0;
      const options = providerRequestOptions(async () => {
        calls += 1;
        return providerChoiceResponse({ finish_reason: "stop", message: {
          role: "assistant", content: JSON.stringify({ accepted: true }), tool_calls: null,
        } });
      }, {
        role: "verifier", schemaName: VERIFICATION_TOOL_NAME, responseFormat: "json_object",
        requireMinimalVerificationContent: true, allowNullJsonObjectVerificationToolCalls: true, ...overrides,
      });
      if (allowed) assert.deepEqual(await requestHuggingFaceJson(options), { accepted: true });
      else await assert.rejects(requestHuggingFaceJson(options), TypeError);
      assert.equal(calls, allowed ? 1 : 0);
    });
  }
});

test("named stopped-content compatibility retains literal-null rejection with verification opt-in absent", async () => {
  for (const toolName of [VERIFICATION_TOOL_NAME, CERTIFICATION_TOOL_NAME]) {
    for (const allowStoppedToolContent of [false, true]) {
      let calls = 0;
      const options = providerRequestOptions(async (_url, init) => {
        calls += 1;
        const body = JSON.parse(init.body);
        forcedToolSchema(body, toolName);
        return providerChoiceResponse({ finish_reason: "stop", message: {
          role: "assistant", content: JSON.stringify({ accepted: true }), tool_calls: null,
        } });
      }, { role: "verifier", toolName, toolChoice: "named", allowStoppedToolContent,
        allowEmptyStoppedToolCalls: allowStoppedToolContent });
      await assert.rejects(requestHuggingFaceJson(options), (error) => error instanceof LatticeProviderError
        && error.code === "provider_malformed_response");
      assert.equal(calls, 1);
    }
  }
});

test("dedicated verifier envelope permissions preserve strict defaults and explicit strict-schema opt-ins", async (t) => {
  const accepted = JSON.stringify({ accepted: true });
  for (const [label, extras, allowed] of [
    ["minimal", {}, true],
    ["empty calls", { tool_calls: [] }, false],
    ["literal-null calls", { tool_calls: null }, false],
    ["null name", { name: null }, false],
    ["null reasoning", { reasoning_content: null }, false],
    ["both nullable fields", { name: null, reasoning_content: null }, false],
  ]) {
    await t.test(`legacy schema: ${label}`, async () => {
      let calls = 0;
      const options = providerRequestOptions(async (_url, init) => {
        calls += 1;
        const body = JSON.parse(init.body);
        assert.equal(body.response_format.type, "json_schema");
        assert.equal(body.response_format.json_schema.strict, true);
        assert.equal(Object.hasOwn(body, "tools"), false);
        return providerChoiceResponse({ finish_reason: "stop", message: { role: "assistant", content: accepted, ...extras } });
      }, { role: "verifier", schemaName: VERIFICATION_TOOL_NAME,
        responseFormat: "json_schema", requireMinimalVerificationContent: true });
      if (allowed) assert.deepEqual(await requestHuggingFaceJson(options), { accepted: true });
      else await assert.rejects(requestHuggingFaceJson(options), (error) => error instanceof LatticeProviderError
        && error.code === "provider_malformed_response");
      assert.equal(calls, 1);
    });
  }
  for (const [label, patch, acceptedExtras] of [
    ["generator role", { role: "generator" }],
    ["certification schema", { schemaName: CERTIFICATION_TOOL_NAME }],
    ["implicit JSON-object default", { responseFormat: undefined }],
    ["named tool", { toolName: VERIFICATION_TOOL_NAME, toolChoice: "named" }],
    ["stopped-tool flag", { allowStoppedToolContent: true }],
    ["schema empty-call opt-in", { responseFormat: "json_schema", allowEmptyStoppedToolCalls: true }, { tool_calls: [] }],
    ["schema null-metadata opt-in", { responseFormat: "json_schema", allowNullStoppedVerificationMetadata: true }, { name: null, reasoning_content: null }],
  ]) {
    await t.test(`configuration: ${label}`, async () => {
      let calls = 0;
      const options = providerRequestOptions(async () => {
        calls += 1;
        return providerChoiceResponse({ finish_reason: "stop", message: {
          role: "assistant", content: accepted, ...(acceptedExtras ?? {}),
        } });
      }, {
        role: "verifier", schemaName: VERIFICATION_TOOL_NAME, responseFormat: "json_object",
        requireMinimalVerificationContent: true, ...patch,
      });
      if (acceptedExtras) assert.deepEqual(await requestHuggingFaceJson(options), { accepted: true });
      else await assert.rejects(requestHuggingFaceJson(options), TypeError);
      assert.equal(calls, acceptedExtras ? 1 : 0);
    });
  }
});

test("unsupported provider request extensions fail closed before external fetch", async () => {
  let fetches = 0;
  const fetchImpl = async () => {
    fetches += 1;
    return successfulProviderResponse();
  };
  for (const overrides of [
    { topK: 20 },
    { topK: 0 },
    { topK: 1.5 },
    { minP: 0 },
    { minP: -0.1 },
    { minP: 1.1 },
    { minP: Number.NaN },
    { presencePenalty: -0.1 },
    { presencePenalty: 2.1 },
    { presencePenalty: Number.NaN },
    { toolName: "" },
    { toolName: "contains spaces" },
    { toolName: "x".repeat(65) },
    { responseFormat: null },
    { responseFormat: "yaml" },
    { responseFormat: "json_schema", toolName: ANALYSIS_TOOL_NAME },
    { role: "verifier", responseFormat: "json_schema" },
    { requireMinimalVerificationContent: true },
    { requireMinimalVerificationContent: "true" },
    { role: "verifier", responseFormat: "json_schema", requireMinimalVerificationContent: true },
    { role: "verifier", schemaName: VERIFICATION_TOOL_NAME, requireMinimalVerificationContent: true },
    { role: "verifier", schemaName: VERIFICATION_TOOL_NAME, responseFormat: "json_schema", requireMinimalVerificationContent: true, toolName: VERIFICATION_TOOL_NAME },
    { role: "verifier", schemaName: VERIFICATION_TOOL_NAME, responseFormat: "json_schema", requireMinimalVerificationContent: true, allowStoppedToolContent: true },
    { role: "verifier" },
    { toolChoice: "auto" },
    { toolName: ANALYSIS_TOOL_NAME, toolChoice: "named" },
    { toolName: ANALYSIS_TOOL_NAME, toolChoice: "none" },
    { toolName: ANALYSIS_TOOL_NAME, toolChoice: "required" },
    { role: "verifier", toolName: ANALYSIS_TOOL_NAME, toolChoice: "auto" },
    { allowStoppedToolContent: true },
    { allowEmptyStoppedToolCalls: true },
    { allowEmptyStoppedToolCalls: "true" },
    { allowNullStoppedVerificationMetadata: true },
    { allowNullStoppedVerificationMetadata: "true" },
    { allowNullJsonObjectVerificationToolCalls: true },
    { allowNullJsonObjectVerificationToolCalls: "true" },
    { role: "verifier", toolName: VERIFICATION_TOOL_NAME, toolChoice: "named", allowNullStoppedVerificationMetadata: true },
    { role: "verifier", toolName: CERTIFICATION_TOOL_NAME, toolChoice: "named", allowStoppedToolContent: true, allowNullStoppedVerificationMetadata: true },
    { role: "verifier", toolName: VERIFICATION_TOOL_NAME, toolChoice: "named", allowEmptyStoppedToolCalls: true },
    { role: "verifier", toolName: VERIFICATION_TOOL_NAME, toolChoice: "auto", allowStoppedToolContent: true, allowEmptyStoppedToolCalls: true },
    { role: "generator", toolName: VERIFICATION_TOOL_NAME, toolChoice: "named", allowStoppedToolContent: true, allowEmptyStoppedToolCalls: true },
    {
      role: "verifier",
      toolName: ANALYSIS_TOOL_NAME,
      toolChoice: "named",
      allowStoppedToolContent: true,
    },
  ]) {
    await assert.rejects(
      requestHuggingFaceJson(providerRequestOptions(fetchImpl, overrides)),
      TypeError,
    );
  }
  assert.equal(fetches, 0);
});

test("a provider output limit fails after one fetch without retry", async () => {
  let fetches = 0;
  await assert.rejects(
    requestHuggingFaceJson(providerRequestOptions(async () => {
      fetches += 1;
      return new Response(JSON.stringify({
        choices: [{
          finish_reason: "length",
          message: { role: "assistant", content: "private truncated output" },
        }],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    })),
    (error) => error instanceof LatticeProviderError
      && error.code === "provider_output_limit"
      && !error.message.includes("private truncated output"),
  );
  assert.equal(fetches, 1);
});

test("provider output-token exposure stays explicit and bounded by admission", () => {
  assert.deepEqual(LATTICE_PROVIDER_OUTPUT_TOKEN_LIMITS, {
    analysis: 2_048,
    candidate: 800,
    verification: 2_048,
    certification: 520,
    repair: 800,
  });
  assert.equal(Object.isFrozen(LATTICE_PROVIDER_OUTPUT_TOKEN_LIMITS), true);
  assert.equal(LATTICE_PROVIDER_MAX_OUTPUT_TOKENS_PER_CALL, 2_048);
  assert.equal(LATTICE_CERTIFICATION_WIRE_CHARACTER_LIMIT, 440);
  assert.equal(LATTICE_PROVIDER_MAX_OUTPUT_TOKENS_PER_ADMITTED_REQUEST, 65_536);
  assert.equal(
    LATTICE_TRANSFORMATIONS_PER_UTC_DAY
      * LATTICE_PROVIDER_MAX_OUTPUT_TOKENS_PER_ADMITTED_REQUEST,
    1_966_080,
  );
});

test("the immutable 32-call adapter budget blocks a 33rd provider fetch", async () => {
  let fetches = 0;
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    fetchImpl: async () => {
      fetches += 1;
      return successfulProviderResponse({ d: "instruction", p: [], q: [] });
    },
  });
  const initial = adapter.completionCapacity();
  assert.deepEqual(initial, {
    used: 0,
    limit: LATTICE_PROVIDER_CALL_LIMIT,
    remaining: LATTICE_PROVIDER_CALL_LIMIT,
  });
  assert.equal(Object.isFrozen(initial), true);

  const request = minimalAnalysisRequest();
  for (let index = 0; index < LATTICE_PROVIDER_CALL_LIMIT; index += 1) {
    await adapter.analyze(request);
  }
  assert.deepEqual(adapter.completionCapacity(), {
    used: LATTICE_PROVIDER_CALL_LIMIT,
    limit: LATTICE_PROVIDER_CALL_LIMIT,
    remaining: 0,
  });
  await assert.rejects(
    adapter.analyze(request),
    (error) => {
      assert.ok(error instanceof LatticeProviderError);
      assert.equal(error.code, "provider_call_limit");
      assert.equal(error.qualificationStage, undefined);
      assert.equal(error.qualificationCallOrdinal, undefined);
      assert.equal(LATTICE_PROVIDER_FAILURE_CLASSES.includes(error.code), false);
      return true;
    },
  );
  assert.equal(fetches, LATTICE_PROVIDER_CALL_LIMIT);
});

test("provider timeout is typed, bounded, and makes only one request", async () => {
  let calls = 0;
  let observedAbort = false;
  const fetchImpl = async (_url, init) => {
    calls += 1;
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        observedAbort = true;
        reject(init.signal.reason);
      }, { once: true });
    });
  };
  await assert.rejects(
    requestHuggingFaceJson(providerRequestOptions(fetchImpl, { callTimeoutMs: 10 })),
    (error) => error instanceof LatticeProviderError && error.code === "provider_timeout",
  );
  assert.equal(calls, 1);
  assert.equal(observedAbort, true);
});

test("a provider response that resolves after timeout has its unread body canceled", async () => {
  let bodyCanceled = false;
  let resolveFetch;
  const fetchImpl = () => new Promise((resolve) => {
    resolveFetch = resolve;
  });
  const operation = requestHuggingFaceJson(providerRequestOptions(fetchImpl, { callTimeoutMs: 10 }));

  await assert.rejects(
    operation,
    (error) => error instanceof LatticeProviderError && error.code === "provider_timeout",
  );
  resolveFetch(new Response(new ReadableStream({
    cancel() {
      bodyCanceled = true;
    },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(bodyCanceled, true);
});

test("a verifier-local timeout keeps sanitized verification metadata and discards a late body without retry", async () => {
  const base = minimalVerificationRequest();
  let fetches = 0;
  let resolveVerification;
  let bodyCanceled = false;
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    callTimeoutMs: 10,
    fetchImpl: async () => {
      fetches += 1;
      if (fetches === 1) {
        return successfulProviderResponse({ d: "instruction", p: [], q: [] });
      }
      if (fetches === 2) return successfulProviderResponse({ passages: [] });
      return new Promise((resolve) => { resolveVerification = resolve; });
    },
  });

  await adapter.analyze(base);
  await adapter.generate(Object.freeze({ ...base, analysis: base.analysis }));
  await assert.rejects(
    adapter.verify(base),
    (error) => {
      assert.ok(error instanceof LatticeProviderError);
      assert.equal(error.code, "provider_timeout");
      assert.equal(error.qualificationStage, "verification");
      assert.equal(error.qualificationCallOrdinal, 3);
      assert.equal(Object.keys(error).includes("qualificationStage"), false);
      assert.equal(Object.keys(error).includes("qualificationCallOrdinal"), false);
      return true;
    },
  );
  assert.equal(fetches, 3);

  resolveVerification(new Response(new ReadableStream({
    cancel() {
      bodyCanceled = true;
    },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(bodyCanceled, true);
  assert.equal(fetches, 3);
});

test("provider timeout is not extended by a response stream whose cancel never settles", async () => {
  const never = () => new Promise(() => {});
  const responseStream = new ReadableStream({
    pull: never,
    cancel: never,
  });
  const operation = requestHuggingFaceJson(providerRequestOptions(async () => new Response(responseStream, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }), { callTimeoutMs: 10 }));

  const outcome = await Promise.race([
    operation.then(
      () => ({ resolved: true }),
      (error) => ({ error }),
    ),
    new Promise((resolve) => setTimeout(() => resolve({ expired: true }), 250)),
  ]);
  assert.equal(outcome.expired, undefined);
  assert.ok(outcome.error instanceof LatticeProviderError);
  assert.equal(outcome.error.code, "provider_timeout");
});

test("upstream 500, malformed envelopes, empty content, and response overflow fail without retry", async () => {
  const cases = [
    [
      () => new Response("secret upstream diagnostics must-not-reflect", { status: 500 }),
      "provider_http_error",
    ],
    [
      () => new Response("not-json", { status: 200 }),
      "provider_malformed_response",
    ],
    [
      () => new Response(JSON.stringify({
        choices: [{ finish_reason: "stop", message: { content: "{\"accepted\":true}" } }],
      }), { status: 200, headers: { "Content-Type": "text/plain" } }),
      "provider_malformed_response",
    ],
    [
      () => successfulProviderResponse({ accepted: true }),
      "provider_redirect",
      { markRedirected: true },
    ],
    [
      () => new Response("redirect body", {
        status: 302,
        headers: { Location: "https://unreviewed.invalid/provider" },
      }),
      "provider_redirect",
    ],
    [
      () => new Response(JSON.stringify({
        choices: [{ finish_reason: "stop", message: { role: "user", content: "{\"accepted\":true}" } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
      "provider_malformed_response",
    ],
    [
      () => new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: "" } }] }), { status: 200 }),
      "provider_malformed_response",
    ],
    ...[
      "```json\n{\"accepted\":true}\n```",
      "{\"accepted\":true} trailing",
      "[]",
      "true",
    ].map((content) => [
      () => new Response(JSON.stringify({
        choices: [{ finish_reason: "stop", message: { role: "assistant", content } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
      "provider_malformed_response",
    ]),
    [
      () => successfulProviderResponse({ accepted: true }),
      "provider_response_too_large",
      { maximumResponseBytes: 16 },
    ],
  ];
  for (const [responseFactory, expectedCode, options = {}] of cases) {
    let calls = 0;
    const { markRedirected = false, ...overrides } = options;
    await assert.rejects(
      requestHuggingFaceJson(providerRequestOptions(async () => {
        calls += 1;
        const response = responseFactory();
        if (markRedirected) Object.defineProperty(response, "redirected", { value: true });
        return response;
      }, overrides)),
      (error) => {
        assert.ok(error instanceof LatticeProviderError);
        assert.equal(error.code, expectedCode);
        assert.doesNotMatch(error.message, /must-not-reflect|hf_test_secret_value/u);
        return true;
      },
    );
    assert.equal(calls, 1);
  }
});

test("a provider HTTP 400 body is discarded without retry, logging, or reflection", async () => {
  let calls = 0;
  let bodyCanceled = false;
  await assert.rejects(
    requestHuggingFaceJson(providerRequestOptions(async () => {
      calls += 1;
      return new Response(new ReadableStream({
        cancel() {
          bodyCanceled = true;
        },
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    })),
    (error) => error instanceof LatticeProviderError
      && error.code === "provider_http_error"
      && error.status === 400
      && !error.message.includes("private-provider-body"),
  );
  assert.equal(calls, 1);
  assert.equal(bodyCanceled, true);
});

test("provider HTTP 402 at analysis call four remains private and qualification-only", async () => {
  const privateBody = "PRIVATE-PAYMENT-DIAGNOSTIC-MUST-NOT-CROSS";
  const privateCookie = "provider-private-cookie-must-not-cross";
  const diagnosticHeaders = {
    [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]:
      LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  };
  const activeQualification = {
    HF_TOKEN: "server_only_token",
    [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z",
  };
  const cases = [
    ["ordinary runtime", { HF_TOKEN: "server_only_token" }, {}, false],
    ["active qualification", activeQualification, diagnosticHeaders, true],
  ];

  for (const [name, env, headers, diagnosticExpected] of cases) {
    let providerCalls = 0;
    let rejectedBodyCanceled = 0;
    const worker = createLatticeApiWorker({
      fetchImpl: async () => {
        providerCalls += 1;
        if (providerCalls < 4) {
          return successfulProviderResponse({ d: "instruction", p: [], q: [] });
        }
        return new Response(new ReadableStream({
          cancel() {
            rejectedBodyCanceled += 1;
          },
        }), {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "120",
            "Set-Cookie": privateCookie,
            "X-Private-Provider-Diagnostic": privateBody,
          },
        });
      },
      runTextToLatticeImpl: async (_text, { adapter }) => {
        for (let call = 0; call < 4; call += 1) {
          await adapter.analyze(call === 3
            ? analysisRequestWithDiagnostic("reanalysis", 1)
            : analysisRequestWithDiagnostic());
        }
        return validLatticeResult();
      },
    });

    const response = await worker.fetch(
      apiRequest(validPayload, { headers }),
      env,
    );
    const responseBody = await response.text();
    assert.equal(providerCalls, 4, name);
    assert.equal(rejectedBodyCanceled, 1, name);
    assert.equal(response.status, 502, name);
    assert.deepEqual(JSON.parse(responseBody), { error: "upstream_unavailable" }, name);
    assert.equal(responseBody.includes(privateBody), false, name);
    assert.equal(responseBody.includes("retry_after_seconds"), false, name);
    assert.equal(response.headers.has("retry-after"), false, name);
    assert.equal(response.headers.has("set-cookie"), false, name);
    assert.equal(JSON.stringify([...response.headers]).includes(privateBody), false, name);
    assert.equal(JSON.stringify([...response.headers]).includes(privateCookie), false, name);

    const expectedDiagnostic = diagnosticExpected
      ? {
        failureClass: "provider_http_error",
        upstreamStatus: "402",
        stage: "analysis",
        callOrdinal: "4",
        subtype: "none",
        finishReason: "none",
        requestSize: "4097-16384",
        responseSize: "none",
        contentSize: "none",
        completionTokens: "none",
        stageAttempt: "initial",
        analysisOrigin: "reanalysis",
        analysisAttempt: "1",
        priorValidationCategory: "none",
      }
      : Object.fromEntries(Object.keys(
        LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS,
      ).map((key) => [key, null]));
    for (const [key, header] of Object.entries(
      LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS,
    )) {
      assert.equal(response.headers.get(header), expectedDiagnostic[key], `${name}: ${key}`);
    }
  }
});

test("typed provider failures map to exact flat public errors with a bounded 429 hint", async () => {
  const cases = [
    [new LatticeProviderError("provider_timeout", "private timeout"), 504, { error: "upstream_timeout" }],
    [new LatticeProviderError("provider_unavailable", "private network error"), 502, { error: "upstream_unavailable" }],
    [new LatticeProviderError("provider_call_limit", "private budget"), 502, { error: "upstream_unavailable" }],
    [new LatticeProviderError("provider_request_too_large", "private request"), 502, { error: "upstream_unavailable" }],
    [new LatticeProviderError("provider_redirect", "private redirect"), 502, { error: "upstream_unavailable" }],
    [new LatticeProviderError("provider_http_error", "private 500", { status: 500 }), 502, { error: "upstream_unavailable" }],
    [new LatticeProviderError("provider_malformed_response", "private body"), 502, { error: "malformed_upstream_response" }],
    [new LatticeProviderError("provider_output_limit", "private body"), 502, { error: "malformed_upstream_response" }],
    [new LatticeProviderError("provider_http_error", "private 429", {
      status: 429,
      retryAfterSeconds: 300,
    }), 429, { error: "rate_limited", retry_after_seconds: 300 }],
  ];
  for (const [failure, expectedStatus, expectedBody] of cases) {
    const worker = createLatticeApiWorker({
      fetchImpl: async () => assert.fail("the injected failure does not use the network"),
      createAdapter: () => Object.freeze({}),
      runTextToLatticeImpl: async () => { throw failure; },
    });
    const response = await worker.fetch(apiRequest(), { HF_TOKEN: "must-not-reflect-token" });
    assert.equal(response.status, expectedStatus);
    assert.deepEqual(await json(response), expectedBody);
    assert.equal(
      response.headers.has("set-cookie"),
      false,
    );
    for (const header of Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)) {
      assert.equal(response.headers.has(header), false);
    }
  }
});

test("the terminal analysis diagnostic is all-or-none, bounded, and qualification-only", async (contextTest) => {
  assert.equal(LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE, "v18");
  const diagnosticHeaders = {
    [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]:
      LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  };
  const activeQualification = {
    HF_TOKEN: "server_only_token",
    [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z",
  };
  const terminalTrace = Object.freeze({
    cause: "host-validation",
    validationCategory: "evidence",
    priorValidationCategory: "passage-coverage",
    origin: "split",
    attempt: "2",
    atomLimit: "6",
  });
  const expectedDiagnostic = {
    ...terminalTrace,
    callOrdinal: "4",
  };
  const makeWorker = ({
    result = unableLatticeResult(),
    trace = terminalTrace,
    used = 4,
    callbackCount = 1,
    throwAfterDiagnostic = false,
  } = {}) => createLatticeApiWorker({
    createAdapter: () => Object.freeze({
      completionCapacity: () => Object.freeze({
        used,
        limit: LATTICE_PROVIDER_CALL_LIMIT,
        remaining: LATTICE_PROVIDER_CALL_LIMIT - used,
      }),
    }),
    runTextToLatticeImpl: async (_text, options) => {
      for (let index = 0; index < callbackCount; index += 1) {
        options.onAnalysisTerminalDiagnostic?.(trace);
      }
      if (throwAfterDiagnostic) {
        throw new LatticeProviderError("provider_timeout", "private timeout", {
          qualificationStage: "analysis",
          qualificationCallOrdinal: 4,
          qualificationAnalysisOrigin: "split",
          qualificationAnalysisAttempt: "2",
          qualificationPriorValidationCategory: "passage-coverage",
        });
      }
      return result;
    },
  });

  const response = await makeWorker().fetch(
    apiRequest(validPayload, { headers: diagnosticHeaders }),
    activeQualification,
  );
  assert.equal(response.status, 200);
  const body = await json(response);
  assert.deepEqual(body, { result: unableLatticeResult(), schema_version: 1 });
  for (const [field, header] of Object.entries(
    LATTICE_QUALIFICATION_TERMINAL_ANALYSIS_DIAGNOSTIC_RESPONSE_HEADERS,
  )) {
    assert.equal(response.headers.get(header), expectedDiagnostic[field], field);
  }
  for (const header of Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)) {
    assert.equal(response.headers.has(header), false, header);
  }
  assert.equal(JSON.stringify(body).includes("host-validation"), false);
  assert.equal(JSON.stringify(body).includes("passage-coverage"), false);

  const planningTrace = Object.freeze({
    cause: "planning",
    validationCategory: "none",
    priorValidationCategory: "none",
    origin: "none",
    attempt: "none",
    atomLimit: "none",
  });
  const planningResponse = await makeWorker({ trace: planningTrace, used: 0 }).fetch(
    apiRequest(validPayload, { headers: diagnosticHeaders }),
    activeQualification,
  );
  assert.equal(planningResponse.status, 200);
  for (const [field, header] of Object.entries(
    LATTICE_QUALIFICATION_TERMINAL_ANALYSIS_DIAGNOSTIC_RESPONSE_HEADERS,
  )) {
    assert.equal(planningResponse.headers.get(header), {
      ...planningTrace,
      callOrdinal: "0",
    }[field], `planning: ${field}`);
  }

  const privateMarker = "PRIVATE-TERMINAL-TRACE-MUST-NOT-CROSS";
  const invalidTraceCases = [
    ["planning validation", { ...planningTrace, validationCategory: "evidence" }],
    ["planning prior validation", { ...planningTrace, priorValidationCategory: "evidence" }],
    ["planning origin", { ...planningTrace, origin: "split" }],
    ["planning attempt", { ...planningTrace, attempt: "1" }],
    ["non-planning validation", { ...terminalTrace, validationCategory: "none" }],
    ["non-planning origin", { ...terminalTrace, origin: "none" }],
    ["non-planning attempt", { ...terminalTrace, attempt: "none" }],
    ["non-planning atom limit", { ...terminalTrace, atomLimit: "none" }],
    ["first-attempt prior validation", {
      ...terminalTrace,
      cause: "output-limit",
      validationCategory: "capacity",
      attempt: "1",
    }],
    ["second-attempt missing prior validation", {
      ...terminalTrace,
      priorValidationCategory: "none",
    }],
    ["first-attempt host validation", {
      ...terminalTrace,
      attempt: "1",
      priorValidationCategory: "none",
    }],
    ["output-limit validation", { ...terminalTrace, cause: "output-limit" }],
    ["context-capacity validation", { ...terminalTrace, cause: "context-capacity" }],
  ];
  const cases = [
    [
      "qualified runtime",
      makeWorker(),
      { HF_TOKEN: "server_only_token" },
      diagnosticHeaders,
      200,
    ],
    ["unmarked qualification", makeWorker(), activeQualification, {}, 200],
    [
      "wrong version",
      makeWorker(),
      activeQualification,
      { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v2" },
      200,
    ],
    [
      "non-analysis unable result",
      makeWorker({ result: unableLatticeResult("generation-unavailable") }),
      activeQualification,
      diagnosticHeaders,
      200,
    ],
    [
      "translated result",
      makeWorker({ result: validLatticeResult() }),
      activeQualification,
      diagnosticHeaders,
      200,
    ],
    [
      "hostile trace",
      makeWorker({
        trace: Object.freeze({
          ...terminalTrace,
          validationCategory: privateMarker,
        }),
      }),
      activeQualification,
      diagnosticHeaders,
      200,
    ],
    [
      "out-of-range ordinal",
      makeWorker({ used: LATTICE_PROVIDER_CALL_LIMIT + 1 }),
      activeQualification,
      diagnosticHeaders,
      200,
    ],
    [
      "repeated callback",
      makeWorker({ callbackCount: 2 }),
      activeQualification,
      diagnosticHeaders,
      200,
    ],
    [
      "provider error",
      makeWorker({ throwAfterDiagnostic: true }),
      activeQualification,
      diagnosticHeaders,
      504,
    ],
    ...invalidTraceCases.map(([name, trace]) => [
      name,
      makeWorker({ trace: Object.freeze(trace) }),
      activeQualification,
      diagnosticHeaders,
      200,
    ]),
  ];
  for (const [name, worker, env, headers, status] of cases) {
    await contextTest.test(name, async () => {
      const caseResponse = await worker.fetch(apiRequest(validPayload, { headers }), env);
      assert.equal(caseResponse.status, status);
      const serializedBody = await caseResponse.text();
      for (const header of Object.values(
        LATTICE_QUALIFICATION_TERMINAL_ANALYSIS_DIAGNOSTIC_RESPONSE_HEADERS,
      )) {
        assert.equal(caseResponse.headers.has(header), false, `${name}: ${header}`);
      }
      assert.equal(JSON.stringify([...caseResponse.headers]).includes(privateMarker), false);
      assert.equal(serializedBody.includes(privateMarker), false);
    });
  }
});

test("the v18 provider diagnostic is opt-in and confined to an active qualification window", async () => {
  const privateBody = "PRIVATE-UPSTREAM-BODY-MUST-NOT-CROSS";
  const createFailureWorker = (overrides = {}) => createLatticeApiWorker({
    fetchImpl: async () => new Response(privateBody, {
      status: 503,
      headers: { "Content-Type": "text/plain" },
    }),
    runTextToLatticeImpl: async (_text, { adapter }) => {
      await adapter.analyze(analysisRequestWithDiagnostic());
      return validLatticeResult();
    },
    ...overrides,
  });
  const diagnosticHeaders = {
    [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]:
      LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  };
  const activeQualification = {
    HF_TOKEN: "server_only_token",
    [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z",
  };
  const cases = [
    ["qualified runtime", createFailureWorker(), { HF_TOKEN: "server_only_token" }, diagnosticHeaders],
    ["unmarked qualification request", createFailureWorker(), activeQualification, {}],
    [
      "wrong diagnostic version",
      createFailureWorker(),
      activeQualification,
      { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v2" },
    ],
  ];
  for (const [name, worker, env, headers] of cases) {
    const response = await worker.fetch(apiRequest(validPayload, { headers }), env);
    assert.equal(response.status, 502, name);
    assert.deepEqual(await json(response), { error: "upstream_unavailable" }, name);
    for (const header of Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)) {
      assert.equal(response.headers.has(header), false, `${name}: ${header}`);
    }
  }

  const response = await createFailureWorker().fetch(
    apiRequest(validPayload, { headers: diagnosticHeaders }),
    activeQualification,
  );
  assert.equal(response.status, 502);
  assert.deepEqual(await json(response), { error: "upstream_unavailable" });
  assert.equal(
    response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.failureClass),
    "provider_http_error",
  );
  assert.equal(
    response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.upstreamStatus),
    "503",
  );
  assert.equal(
    response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.stage),
    "analysis",
  );
  assert.equal(
    response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.callOrdinal),
    "1",
  );
  const diagnosticFields = {
    subtype: "none",
    finishReason: "none",
    requestSize: "4097-16384",
    responseSize: "none",
    contentSize: "none",
    completionTokens: "none",
    stageAttempt: "initial",
    analysisOrigin: "initial",
    analysisAttempt: "1",
    priorValidationCategory: "none",
  };
  for (const [field, value] of Object.entries(diagnosticFields)) {
    assert.equal(
      response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS[field]),
      value,
      field,
    );
  }
  assert.equal(JSON.stringify([...response.headers]).includes(privateBody), false);

  const successfulQualification = await createLatticeApiWorker({
    runTextToLatticeImpl: async () => validLatticeResult(),
  }).fetch(
    apiRequest(validPayload, { headers: diagnosticHeaders }),
    activeQualification,
  );
  assert.equal(successfulQualification.status, 200);
  for (const header of Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)) {
    assert.equal(successfulQualification.headers.has(header), false);
  }

  const qualificationCutoff = Date.parse(activeQualification[LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]);
  let diagnosticClock = qualificationCutoff - 1;
  let cutoffDeadline;
  const cutoffWorker = createFailureWorker({
    fetchImpl: async () => {
      diagnosticClock = qualificationCutoff;
      return new Response(null, { status: 503 });
    },
    now: () => diagnosticClock,
    scheduleTimeout(callback, milliseconds) {
      assert.equal(cutoffDeadline, undefined);
      const deadline = { milliseconds, canceled: false, fired: false };
      deadline.callback = () => {
        deadline.fired = true;
        callback();
      };
      cutoffDeadline = deadline;
      return cutoffDeadline;
    },
    cancelTimeout(deadline) {
      assert.equal(deadline, cutoffDeadline);
      deadline.canceled = true;
    },
  });
  const cutoff = await cutoffWorker.fetch(
    apiRequest(validPayload, { headers: diagnosticHeaders }),
    activeQualification,
  );
  assert.equal(cutoff.status, 502);
  assert.deepEqual(await json(cutoff), { error: "upstream_unavailable" });
  assert.equal(cutoffDeadline.milliseconds, 1);
  assert.equal(cutoffDeadline.fired, false);
  assert.equal(cutoffDeadline.canceled, true);
  for (const header of Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)) {
    assert.equal(cutoff.headers.has(header), false);
  }

  let expiredProviderCalls = 0;
  const expiredWorker = createFailureWorker({
    fetchImpl: async () => {
      expiredProviderCalls += 1;
      return new Response(null, { status: 503 });
    },
    now: () => Date.parse("2100-01-01T00:00:00.000Z"),
  });
  const expired = await expiredWorker.fetch(
    apiRequest(validPayload, { headers: diagnosticHeaders }),
    activeQualification,
  );
  assert.equal(expired.status, 503);
  assert.deepEqual(await json(expired), { error: "upstream_unavailable" });
  assert.equal(expiredProviderCalls, 0);
  for (const header of Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)) {
    assert.equal(expired.headers.has(header), false);
  }
});

test("a provider failure after setup does not rotate or reissue the quota cookie", async () => {
  let admissions = 0;
  const worker = createProductionLatticeApiWorker({
    enforceRateLimit: async () => {},
    admitTransformation: async (_namespace, visitorId) => {
      admissions += 1;
      assert.match(visitorId, /^[A-Za-z0-9_-]{24}$/u);
      return { allowed: true, retryAfterSeconds: null };
    },
    fetchImpl: async () => assert.fail("the injected provider failure does not use the network"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => {
      throw new LatticeProviderError("provider_timeout", "private timeout");
    },
  });
  const env = {
    HF_TOKEN: "server_only_token",
    VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
  };
  const setup = await worker.fetch(visitorSessionRequest(), env);
  const cookieValue = setup.headers.get("set-cookie").split(";", 1)[0].split("=", 2)[1];
  const response = await worker.fetch(apiRequest(validPayload, { visitorCookie: cookieValue }), env);
  assert.equal(response.status, 504);
  assert.deepEqual(await json(response), { error: "upstream_timeout" });
  assert.equal(admissions, 1);
  assert.equal(response.headers.has("set-cookie"), false);
});

test("the exact UTC-day policy admits 30 transformations globally and 3 per cooperating cookie jar", () => {
  const dayStart = Date.UTC(2026, 8, 14);
  let state;
  for (let visitorIndex = 0; visitorIndex < 10; visitorIndex += 1) {
    const visitorId = capacityVisitor(visitorIndex);
    for (let requestIndex = 0; requestIndex < LATTICE_TRANSFORMATIONS_PER_VISITOR_UTC_DAY; requestIndex += 1) {
      const outcome = claimLatticeTransformation(state, {
        now: dayStart + visitorIndex * 1_000 + requestIndex,
        visitorId,
      });
      assert.deepEqual(outcome.result, {
        allowed: true,
        scope: null,
        retryAfterSeconds: null,
      });
      assert.equal(outcome.stateChanged, true);
      state = outcome.state;
    }
    if (visitorIndex === 0) {
      const denied = claimLatticeTransformation(state, {
        now: dayStart + 10_000,
        visitorId,
      });
      assert.equal(denied.result.allowed, false);
      assert.equal(denied.result.scope, "visitor-day");
      assert.equal(denied.stateChanged, false);
    }
  }
  assert.equal(state.acceptedTransformations, LATTICE_TRANSFORMATIONS_PER_UTC_DAY);
  assert.equal(Object.keys(state.visitorTransformations).length, 10);
  assert.equal(latticeTransformationStateExpiresAt(state), dayStart + 24 * 60 * 60_000);

  const globalDenial = claimLatticeTransformation(state, {
    now: dayStart + 20_000,
    visitorId: capacityVisitor(10),
  });
  assert.equal(globalDenial.result.allowed, false);
  assert.equal(globalDenial.result.scope, "global-day");
  assert.equal(globalDenial.result.retryAfterSeconds, 86_380);
  assert.equal(globalDenial.stateChanged, false);

  const nextDay = claimLatticeTransformation(state, {
    now: dayStart + 24 * 60 * 60_000,
    visitorId: capacityVisitor(0),
  });
  assert.equal(nextDay.result.allowed, true);
  assert.equal(nextDay.state.acceptedTransformations, 1);
  assert.deepEqual(nextDay.state.visitorTransformations, { [capacityVisitor(0)]: 1 });
});

test("the transformation policy fails closed for malformed state, identity, totals, and clock regression", () => {
  const now = Date.UTC(2026, 8, 14);
  const valid = claimLatticeTransformation(undefined, {
    now,
    visitorId: capacityVisitor(0),
  }).state;
  for (const malformed of [
    null,
    {},
    { ...valid, source: validPayload.text },
    { ...valid, version: 2 },
    { ...valid, acceptedTransformations: -1 },
    { ...valid, acceptedTransformations: LATTICE_TRANSFORMATIONS_PER_UTC_DAY + 1 },
    { ...valid, acceptedTransformations: 2 },
    { ...valid, visitorTransformations: { invalid: 1 } },
    { ...valid, visitorTransformations: { [capacityVisitor(0)]: 0 } },
    { ...valid, visitorTransformations: { [capacityVisitor(0)]: 4 } },
    { ...valid, dayStartedAt: valid.dayStartedAt + 1 },
  ]) {
    assert.throws(() => claimLatticeTransformation(malformed, {
      now,
      visitorId: capacityVisitor(1),
    }), TypeError);
  }
  assert.throws(() => claimLatticeTransformation(valid, {
    now: now - 60_000,
    visitorId: capacityVisitor(1),
  }), /clock moved backwards/u);
  assert.throws(() => claimLatticeTransformation(valid, {
    now,
    visitorId: "invalid",
  }), TypeError);
});

test("the capacity client sends one bodyless pseudonymous claim to one global object", async () => {
  const events = [];
  const namespace = {
    getByName(name) {
      events.push({ name });
      return {
        async fetch(request) {
          events.push({ request });
          return new Response(JSON.stringify({ allowed: true, schema_version: 1 }), {
            status: 200,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          });
        },
      };
    },
  };
  assert.deepEqual(await claimGlobalLatticeTransformation(namespace, TEST_VISITOR_ID), {
    allowed: true,
    retryAfterSeconds: null,
  });
  assert.equal(events[0].name, LATTICE_TRANSFORMATION_CAPACITY_OBJECT_NAME);
  const request = events[1].request;
  assert.equal(request.url, LATTICE_TRANSFORMATION_CAPACITY_INTERNAL_URL);
  assert.equal(request.method, "POST");
  assert.equal(request.body, null);
  assert.equal(request.headers.get(LATTICE_TRANSFORMATION_VISITOR_HEADER), TEST_VISITOR_ID);
  assert.equal(request.credentials, "omit");
  assert.equal(request.cache, "no-store");
  assert.equal(request.redirect, "manual");
  assert.equal(request.referrer, "");
  assert.equal(request.headers.has("origin"), false);
  assert.equal(request.headers.has("referer"), false);
  assert.equal(request.headers.has("cookie"), false);
  assert.equal(request.headers.has("authorization"), false);
  assert.equal(JSON.stringify(events[0]).includes(validPayload.text), false);
});

test("global and visitor daily denials are closed and malformed capacity responses fail", async () => {
  const namespaceFor = (value, status = 429, contentType = "application/json") => ({
    getByName: () => ({
      fetch: async () => new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": contentType },
      }),
    }),
  });
  assert.deepEqual(await claimGlobalLatticeTransformation(namespaceFor({
    allowed: false,
    scope: "visitor-day",
    retry_after_seconds: 27,
    schema_version: 1,
  }), TEST_VISITOR_ID), { allowed: false, retryAfterSeconds: 27 });
  assert.deepEqual(await claimGlobalLatticeTransformation(namespaceFor({
    allowed: false,
    scope: "global-day",
    retry_after_seconds: 40_000,
    schema_version: 1,
  }), TEST_VISITOR_ID), { allowed: false, retryAfterSeconds: null });

  for (const malformed of [
    undefined,
    {},
    { getByName: () => ({}) },
    namespaceFor({ allowed: true, schema_version: 1, extra: true }, 200),
    namespaceFor({ allowed: false, scope: "global-day", retry_after_seconds: 0, schema_version: 1 }),
    namespaceFor({ allowed: false, scope: "thirty-day", retry_after_seconds: 20, schema_version: 1 }),
    namespaceFor({ allowed: true, schema_version: 1 }, 200, "text/plain"),
  ]) {
    await assert.rejects(
      () => claimGlobalLatticeTransformation(malformed, TEST_VISITOR_ID),
      /capacity gate is unavailable/u,
    );
  }
  await assert.rejects(
    () => claimGlobalLatticeTransformation(namespaceFor({ allowed: true, schema_version: 1 }, 200), "invalid"),
    /capacity gate is unavailable/u,
  );
});

test("one admitted transformation can complete multiple provider stages without another quota claim", async () => {
  const events = [];
  const worker = createLatticeApiWorker({
    async admitTransformation(namespace, visitorId) {
      assert.equal(namespace, "transformation-budget-binding");
      assert.equal(visitorId, TEST_VISITOR_ID);
      events.push("admission");
      return { allowed: true, retryAfterSeconds: null };
    },
    fetchImpl: async () => {
      events.push("provider-fetch");
      return successfulProviderResponse({ d: "instruction", p: [], q: [] });
    },
    async runTextToLatticeImpl(_text, { adapter }) {
      await adapter.analyze(minimalAnalysisRequest());
      await adapter.analyze(minimalAnalysisRequest());
      return validLatticeResult();
    },
  });
  const response = await worker.fetch(apiRequest(), {
    HF_TOKEN: "server_only_token",
    LATTICE_TRANSFORMATION_BUDGET: "transformation-budget-binding",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(events, ["admission", "provider-fetch", "provider-fetch"]);
});

test("the production request admission fails closed on a missing or exhausted Durable Object binding", async () => {
  const rateLimiter = { limit: async () => ({ success: true }) };
  const runOneProviderCall = async (_text, { adapter }) => {
    await adapter.analyze(minimalAnalysisRequest());
    return validLatticeResult();
  };

  const allowedEvents = [];
  const allowedWorker = createProductionLatticeApiWorker({
    async fetchImpl() {
      allowedEvents.push("provider-fetch");
      return successfulProviderResponse({ d: "instruction", p: [], q: [] });
    },
    runTextToLatticeImpl: runOneProviderCall,
  });
  const allowedCapacity = {
    getByName(name) {
      assert.equal(name, LATTICE_TRANSFORMATION_CAPACITY_OBJECT_NAME);
      return {
        async fetch(request) {
          allowedEvents.push("transformation-admission");
          assert.equal(request.body, null);
          assert.match(
            request.headers.get(LATTICE_TRANSFORMATION_VISITOR_HEADER),
            /^[A-Za-z0-9_-]{24}$/u,
          );
          return new Response(JSON.stringify({ allowed: true, schema_version: 1 }), {
            status: 200,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          });
        },
      };
    },
  };
  const productionVisitor = await establishLatticeApiVisitor(new Headers(), TEST_VISITOR_SECRET);
  const allowedResponse = await allowedWorker.fetch(apiRequest(validPayload, {
    visitorCookie: productionVisitor.cookieValue,
  }), {
    HF_TOKEN: "server_only_token",
    VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
    LATTICE_API_RATE_LIMITER: rateLimiter,
    LATTICE_TRANSFORMATION_BUDGET: allowedCapacity,
  });
  assert.equal(allowedResponse.status, 200);
  assert.deepEqual(allowedEvents, ["transformation-admission", "provider-fetch"]);
  assert.equal(allowedResponse.headers.has("set-cookie"), false);

  let deniedFetches = 0;
  const deniedWorker = createProductionLatticeApiWorker({
    async fetchImpl() {
      deniedFetches += 1;
      return successfulProviderResponse({ d: "instruction", p: [], q: [] });
    },
    runTextToLatticeImpl: runOneProviderCall,
  });
  const deniedCapacity = {
    getByName: () => ({
      fetch: async () => new Response(JSON.stringify({
        allowed: false,
        scope: "global-day",
        retry_after_seconds: 60_000,
        schema_version: 1,
      }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    }),
  };
  const deniedResponse = await deniedWorker.fetch(apiRequest(validPayload, {
    visitorCookie: productionVisitor.cookieValue,
  }), {
    HF_TOKEN: "server_only_token",
    VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
    LATTICE_API_RATE_LIMITER: rateLimiter,
    LATTICE_TRANSFORMATION_BUDGET: deniedCapacity,
  });
  assert.equal(deniedResponse.status, 429);
  assert.deepEqual(await json(deniedResponse), { error: "rate_limited" });
  assert.equal(deniedFetches, 0);

  const missingResponse = await deniedWorker.fetch(apiRequest(validPayload, {
    visitorCookie: productionVisitor.cookieValue,
  }), {
    HF_TOKEN: "server_only_token",
    VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
    LATTICE_API_RATE_LIMITER: rateLimiter,
  });
  assert.equal(missingResponse.status, 500);
  assert.deepEqual(await json(missingResponse), { error: "internal_error" });
  assert.equal(deniedFetches, 0);
});

test("the serialized provider request is byte-bounded before external fetch", async () => {
  let fetches = 0;
  const baseOptions = providerRequestOptions(async () => {
    fetches += 1;
    return successfulProviderResponse();
  }, { presencePenalty: 1.5 });
  const preContractBody = JSON.stringify({
    model: LATTICE_REMOTE_MODELS.generator,
    messages: baseOptions.messages,
    response_format: { type: "json_object" },
    max_tokens: baseOptions.maxTokens,
    temperature: baseOptions.temperature,
    top_p: baseOptions.topP,
    presence_penalty: baseOptions.presencePenalty,
    seed: 71_903,
    stream: false,
  });
  await assert.rejects(
    requestHuggingFaceJson({
      ...baseOptions,
      maximumRequestBytes: new TextEncoder().encode(preContractBody).byteLength,
    }),
    (error) => error instanceof LatticeProviderError
      && error.code === "provider_request_too_large",
  );
  assert.equal(fetches, 0);
  assert.equal(LATTICE_PROVIDER_REQUEST_BYTE_LIMIT, 1_048_576);
});

test("the fitted strict-schema analysis request is byte-bounded before external fetch", async () => {
  let fetches = 0;
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-token",
    maximumRequestBytes: 256,
    fetchImpl: async () => {
      fetches += 1;
      return successfulProviderResponse({ d: "instruction", p: [], q: [] });
    },
  });

  await assert.rejects(
    adapter.analyze(minimalAnalysisRequest()),
    (error) => error instanceof LatticeProviderError
      && error.code === "provider_request_too_large"
      && error.qualificationStage === "analysis"
      && error.qualificationCallOrdinal === 1,
  );
  assert.equal(fetches, 0);
});

test("the whole-request deadline bounds a pipeline that ignores abort", async () => {
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("the injected pipeline does not use the network"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => new Promise(() => {}),
    requestTimeoutMs: 10,
  });
  const response = await worker.fetch(apiRequest(), { HF_TOKEN: "unused" });
  assert.equal(response.status, 504);
  assert.deepEqual(await json(response), { error: "upstream_timeout" });
});

test("the whole-request deadline preempts the verifier's longer default deadline", async () => {
  let scheduledOuterDeadline;
  let providerCalls = 0;
  let providerSignal;
  let providerStartedResolve;
  const providerStarted = new Promise((resolve) => { providerStartedResolve = resolve; });
  const providerDeadlines = [];
  const originalSetTimeout = globalThis.setTimeout;
  const worker = createLatticeApiWorker({
    requestTimeoutMs: 25,
    scheduleTimeout(callback, milliseconds) {
      scheduledOuterDeadline = { callback, milliseconds, canceled: false };
      return scheduledOuterDeadline;
    },
    cancelTimeout(deadline) {
      assert.equal(deadline, scheduledOuterDeadline);
      deadline.canceled = true;
    },
    fetchImpl: async (_url, init) => {
      providerCalls += 1;
      providerSignal = init.signal;
      providerStartedResolve();
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
      });
    },
    runTextToLatticeImpl: async (_text, { adapter, signal }) => adapter.verify(Object.freeze({
      ...minimalVerificationRequest(),
      signal,
    })),
  });

  globalThis.setTimeout = (callback, milliseconds, ...args) => {
    providerDeadlines.push(milliseconds);
    return originalSetTimeout(callback, milliseconds, ...args);
  };
  let response;
  try {
    const pendingResponse = worker.fetch(apiRequest(), { HF_TOKEN: "server-token" });
    await providerStarted;
    assert.equal(scheduledOuterDeadline.milliseconds, 25);
    assert.equal(providerSignal.aborted, false);
    scheduledOuterDeadline.callback();
    response = await pendingResponse;
  } finally {
    globalThis.setTimeout = originalSetTimeout;
  }

  assert.equal(response.status, 504);
  assert.deepEqual(await json(response), { error: "upstream_timeout" });
  assert.deepEqual(providerDeadlines, [LATTICE_PROVIDER_STAGE_CALL_TIMEOUTS_MS.verification]);
  assert.equal(providerSignal.aborted, true);
  assert.equal(providerCalls, 1);
  assert.equal(scheduledOuterDeadline.canceled, true);
});

test("the live canary deadline remains outside the bounded request and provider deadlines", async () => {
  const verifierSource = await readFile(
    new URL("../scripts/verify-text-to-lattice-api-production.mjs", import.meta.url),
    "utf8",
  );
  const canaryTimeoutMatch = verifierSource.match(/const CANARY_TIMEOUT_MS = ([\d_]+);/u);
  assert.ok(canaryTimeoutMatch);
  const canaryTimeoutMs = Number(canaryTimeoutMatch[1].replaceAll("_", ""));

  assert.equal(LATTICE_PROVIDER_MAX_CALL_TIMEOUT_MS, 180_000);
  assert.equal(LATTICE_API_REQUEST_TIMEOUT_MS, 240_000);
  assert.equal(canaryTimeoutMs, 255_000);
  assert.ok(LATTICE_PROVIDER_MAX_CALL_TIMEOUT_MS < LATTICE_API_REQUEST_TIMEOUT_MS);
  assert.ok(LATTICE_API_REQUEST_TIMEOUT_MS < canaryTimeoutMs);
});

test("the whole-request deadline is not extended by request-body cancellation", async () => {
  const never = () => new Promise(() => {});
  const requestBody = new ReadableStream({
    pull: never,
    cancel: never,
  });
  const request = new Request(`${LATTICE_API_ORIGIN}${LATTICE_API_PATH}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Cookie: `${LATTICE_API_VISITOR_COOKIE_NAME}=${TEST_VISITOR_COOKIE_VALUE}`,
      Origin: LATTICE_API_ORIGIN,
      "Content-Type": "application/json",
    },
    body: requestBody,
    duplex: "half",
  });
  const worker = createLatticeApiWorker({
    fetchImpl: async () => assert.fail("an incomplete request must not use the network"),
    createAdapter: () => Object.freeze({}),
    runTextToLatticeImpl: async () => assert.fail("an incomplete request must not run the pipeline"),
    requestTimeoutMs: 10,
  });

  const outcome = await Promise.race([
    worker.fetch(request, { HF_TOKEN: "unused" }),
    new Promise((resolve) => setTimeout(() => resolve(null), 250)),
  ]);
  assert.ok(outcome instanceof Response);
  assert.equal(outcome.status, 504);
  assert.deepEqual(await json(outcome), { error: "upstream_timeout" });
});

test("server sources store only aggregate capacity, with no content logging, fallback, or embedded token", async () => {
  const workerSource = await readFile(new URL("../workers/text-to-lattice-api/worker.js", import.meta.url), "utf8");
  const adapterSource = await readFile(new URL("../workers/text-to-lattice-api/huggingFaceAdapter.js", import.meta.url), "utf8");
  const capacityClientSource = await readFile(new URL("../workers/text-to-lattice-api/capacityClient.js", import.meta.url), "utf8");
  const capacityGateSource = await readFile(new URL("../workers/text-to-lattice-api/capacityGate.js", import.meta.url), "utf8");
  const capacityPolicySource = await readFile(new URL("../workers/text-to-lattice-api/capacityPolicy.js", import.meta.url), "utf8");
  const visitorCookieSource = await readFile(new URL("../workers/text-to-lattice-api/visitorCookie.js", import.meta.url), "utf8");
  const entrySource = await readFile(new URL("../workers/text-to-lattice-api/entry.js", import.meta.url), "utf8");
  const wrangler = JSON.parse(await readFile(
    new URL("../workers/text-to-lattice-api/wrangler.jsonc", import.meta.url),
    "utf8",
  ));
  const sources = [
    workerSource,
    adapterSource,
    capacityClientSource,
    capacityGateSource,
    capacityPolicySource,
    visitorCookieSource,
    entrySource,
  ].join("\n");

  assert.doesNotMatch(sources, /\bconsole\s*\./u);
  assert.doesNotMatch(sources, /\b(?:localStorage|sessionStorage|indexedDB|caches\.(?:open|default)|env\.(?:KV|DB|D1|R2))\b/u);
  assert.doesNotMatch(sources, /hf_[A-Za-z0-9]{8,}/u);
  assert.equal(sources.split(HUGGING_FACE_CHAT_COMPLETIONS_URL).length - 1, 1);
  assert.match(workerSource, /env\.HF_TOKEN/u);
  assert.equal(wrangler.send_metrics, false);
  assert.deepEqual(wrangler.compatibility_flags, ["enable_request_signal"]);
  assert.deepEqual(wrangler.observability, { enabled: false });
  assert.deepEqual(wrangler.routes, [{ pattern: "hah.dev/api/lattice", zone_name: "hah.dev" }]);
  assert.equal(wrangler.main, "entry.js");
  assert.deepEqual(wrangler.durable_objects, { bindings: [{
    name: "LATTICE_TRANSFORMATION_BUDGET",
    class_name: "LatticeTransformationBudget",
  }] });
  assert.deepEqual(wrangler.migrations, [{
    tag: "v1",
    new_sqlite_classes: ["LatticeTransformationBudget"],
  }]);
  assert.match(entrySource, /export \{ LatticeTransformationBudget \} from "\.\/capacityGate\.js";/u);
  assert.match(entrySource, /export \{ default \} from "\.\/worker\.js";/u);
  assert.deepEqual(wrangler.ratelimits, [{
    name: "LATTICE_API_RATE_LIMITER",
    namespace_id: "857321",
    simple: { limit: 30, period: 60 },
  }]);
  assert.equal(JSON.stringify(wrangler).includes("HF_TOKEN"), false);
  assert.equal(JSON.stringify(wrangler).includes("VISITOR_COOKIE_SECRET"), false);
  assert.doesNotMatch(capacityGateSource, /\b(?:text|prompt|message|source|candidate|output|user|ip)\b/iu);
  assert.doesNotMatch(capacityClientSource, /CF-Connecting-IP|\bCookie\b|Authorization/u);
  assert.match(capacityGateSource, /transaction\(/u);
  assert.match(capacityGateSource, /this\.ctx\.storage\.setAlarm\(/u);
  assert.doesNotMatch(capacityGateSource, /\btransaction\.(?:setAlarm|deleteAlarm)\b/u);
  assert.match(capacityGateSource, /async alarm\(\)/u);
  assert.match(capacityPolicySource, /LATTICE_TRANSFORMATIONS_PER_UTC_DAY\s*=\s*30/u);
  assert.match(capacityPolicySource, /LATTICE_TRANSFORMATIONS_PER_VISITOR_UTC_DAY\s*=\s*3/u);
  assert.doesNotMatch(adapterSource, /claimProviderCall|capacityGate|capacityClient/u);
  assert.match(visitorCookieSource, /__Secure-hah-lattice-api-visitor/u);
  assert.match(visitorCookieSource, /Path=\$\{LATTICE_API_VISITOR_COOKIE_PATH\}; Secure; HttpOnly; SameSite=Strict/u);
  assert.doesNotMatch(visitorCookieSource, /Domain=/u);
  assert.match(adapterSource, /LATTICE_PROVIDER_REQUEST_BYTE_LIMIT\s*=\s*1_048_576/u);
});

test("withheld diagnostics are immutable closed observations confined to marked qualification results", async (contextTest) => {
  const privateMarker = "PRIVATE-WITHHELD-TRACE-MUST-NOT-CROSS";
  const baseTrace = {
    revision: "coherent", deterministic: "clear", firstDeterministicRule: "none", verification: "unavailable", certification: "not-reached",
    failureCause: "host-validation", stage: "verification", attempt: "2",
    validationCategory: "response-shape", priorValidationCategory: "evidence",
    rejectionBoundary: "wire-decoder", rejectionCategory: "field-set", rejectionRule: "V01F",
    priorRejectionBoundary: "host-normalizer", priorRejectionCategory: "other", priorRejectionRule: "unknown",
  };
  const trace = Object.freeze(baseTrace);
  const headers = { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE };
  const env = { HF_TOKEN: "server_only_token", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z" };
  const result = unableLatticeResult("candidate-withheld");
  const makeWorker = ({ value = trace, resultValue = result, count = 1, capacity = { used: 4 }, fail = false } = {}) => createLatticeApiWorker({
    createAdapter: () => ({ completionCapacity: () => capacity }),
    runTextToLatticeImpl: async (_text, options) => {
      for (let index = 0; index < count; index += 1) options.onCandidateWithheldDiagnostic?.(value);
      if (fail) throw new Error(privateMarker);
      return resultValue;
    },
  });
  const response = await makeWorker().fetch(apiRequest(validPayload, { headers }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await json(response), { result, schema_version: 1 });
  for (const [field, header] of Object.entries(LATTICE_QUALIFICATION_WITHHELD_DIAGNOSTIC_RESPONSE_HEADERS)) {
    assert.equal(response.headers.get(header), { ...trace, callsUsed: "4" }[field], field);
  }
  for (const header of [...Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS),
    ...Object.values(LATTICE_QUALIFICATION_TERMINAL_ANALYSIS_DIAGNOSTIC_RESPONSE_HEADERS)]) {
    assert.equal(response.headers.has(header), false, header);
  }
  let getterReads = 0;
  const getterTrace = { ...baseTrace };
  Object.defineProperty(getterTrace, "validationCategory", { enumerable: true,
    get() { getterReads += 1; return getterReads === 1 ? "evidence" : privateMarker; } });
  Object.freeze(getterTrace);
  const hiddenTrace = { ...baseTrace };
  Object.defineProperty(hiddenTrace, "stage", { enumerable: false, value: "verification" });
  Object.freeze(hiddenTrace);
  const { proxy, revoke } = Proxy.revocable(trace, {});
  revoke();
  const hostileTraceCases = [
    ["unfrozen", { ...baseTrace }],
    ["getter", getterTrace],
    ["non-enumerable", hiddenTrace],
    ["symbol", Object.freeze({ ...baseTrace, [Symbol("private")]: privateMarker })],
    ["extra field", Object.freeze({ ...baseTrace, detail: privateMarker })],
    ["foreign prototype", Object.freeze(Object.assign(Object.create({}), baseTrace))],
    ["revoked proxy", proxy],
    ["hostile enum", Object.freeze({ ...baseTrace, validationCategory: privateMarker })],
    ["hostile rejection", Object.freeze({ ...baseTrace, rejectionCategory: privateMarker })],
    ["hostile rule", Object.freeze({ ...baseTrace, rejectionRule: privateMarker })],
    ["impossible predicate", Object.freeze({ ...baseTrace, rejectionCategory: "coverage", rejectionRule: "V06M" })],
    ["wrong decoder stage", Object.freeze({ ...baseTrace, stage: "repair" })],
    ["wrong decoder family", Object.freeze({ ...baseTrace, rejectionRule: "C01F" })],
    ["analysis decoder wrong stage", Object.freeze({ ...baseTrace, rejectionCategory: "coverage", rejectionRule: "A03" })],
    ["analysis decoder wrong category", Object.freeze({ ...baseTrace, stage: "re-atomization", rejectionRule: "A03" })],
    ["clear with deterministic finding", Object.freeze({ ...baseTrace, firstDeterministicRule: "D14" })],
    ["blocked without deterministic finding", Object.freeze({ ...baseTrace, deterministic: "blocked" })],
    ["partial rejection", Object.freeze(Object.fromEntries(Object.entries(baseTrace).filter(([field]) => field !== "rejectionBoundary")))],
    ["unknown specific rejection", Object.freeze({ ...baseTrace, rejectionBoundary: "unknown" })],
    ["absent rejection mismatch", Object.freeze({ ...baseTrace, rejectionBoundary: "none" })],
    ["none provenance mismatch", Object.freeze({ ...baseTrace, failureCause: "none" })],
    ["multiple provenance mismatch", Object.freeze({ ...baseTrace, failureCause: "multiple" })],
    ["first attempt prior", Object.freeze({ ...baseTrace, failureCause: "context-capacity", attempt: "1", validationCategory: "capacity" })],
    ["second attempt absent prior", Object.freeze({ ...baseTrace, priorValidationCategory: "none" })],
    ["initial exhausted verifier validation", Object.freeze({ ...baseTrace, attempt: "1", priorValidationCategory: "none" })],
    ["capacity category mismatch", Object.freeze({ ...baseTrace, failureCause: "context-capacity" })],
  ];
  const cases = [
    ...hostileTraceCases.map(([name, value]) => [name, makeWorker({ value }), env, headers, 200]),
    ["duplicate observer", makeWorker({ count: 2 }), env, headers, 200],
    ["ordinary runtime", makeWorker(), { HF_TOKEN: "server_only_token" }, headers, 200],
    ["unmarked", makeWorker(), env, {}, 200],
    ["old diagnostic version", makeWorker(), env, { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v4" }, 200],
    ["translated", makeWorker({ resultValue: validLatticeResult() }), env, headers, 200],
    ["analysis unable", makeWorker({ resultValue: unableLatticeResult() }), env, headers, 200],
    ["zero capacity", makeWorker({ capacity: { used: 0 } }), env, headers, 200],
    ["excess capacity", makeWorker({ capacity: { used: LATTICE_PROVIDER_CALL_LIMIT + 1 } }), env, headers, 200],
    ["array capacity", makeWorker({ capacity: Object.assign([], { used: 4 }) }), env, headers, 200],
    ["function capacity", makeWorker({ capacity: Object.assign(() => {}, { used: 4 }) }), env, headers, 200],
    ["error after observation", makeWorker({ fail: true }), env, headers, 500],
    ["expired qualification", makeWorker(), { ...env, [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2020-09-17T12:00:00.000Z" }, headers, 503],
  ];
  for (const [name, worker, caseEnv, caseHeaders, status] of cases) {
    await contextTest.test(name, async () => {
      const actual = await worker.fetch(apiRequest(validPayload, { headers: caseHeaders }), caseEnv);
      assert.equal(actual.status, status);
      for (const header of Object.values(LATTICE_QUALIFICATION_WITHHELD_DIAGNOSTIC_RESPONSE_HEADERS)) {
        assert.equal(actual.headers.has(header), false, header);
      }
      const body = await actual.text();
      assert.equal(JSON.stringify([...actual.headers]).includes(privateMarker), false);
      assert.equal(body.includes(privateMarker), false);
      if (status === 200) assert.equal(body.includes("validationCategory"), false);
    });
  }
  assert.equal(getterReads, 0);
});


test("qualification HTTP header observations are finite, bounded, exception-isolated, and bodyless", async (t) => {
  const absent = { mediaType: "absent", allow: "absent", routerRoute: "absent", routerModel: "absent", inferenceProvider: "absent" };
  const cases = [
    ["absent headers", {}, {}],
    ["empty Allow", { allow: "" }, { allow: "empty" }],
    ["POST with list whitespace and empty members", { allow: " GET, ,POST, " }, { allow: "includes-POST" }],
    ["lowercase method", { allow: "post" }, { allow: "excludes-POST" }],
    ["method prefix", { allow: "POSTER" }, { allow: "excludes-POST" }],
    ["no methods", { allow: ", ," }, { allow: "empty" }],
    ["malformed method", { allow: "GET;POST" }, { allow: "invalid" }],
    ["32 list members", { allow: Array(32).fill("G").join(",") }, { allow: "excludes-POST" }],
    ["33 list members", { allow: Array(33).fill("G").join(",") }, { allow: "invalid" }],
    ["JSON type", { "content-type": "Application/JSON; charset=utf-8" }, { mediaType: "json" }],
    ["plain type", { "content-type": "text/plain" }, { mediaType: "text" }],
    ["HTML type", { "content-type": "text/html" }, { mediaType: "html" }],
    ["other type", { "content-type": "application/problem+json" }, { mediaType: "other" }],
    ["malformed type", { "content-type": "PRIVATE HEADER CONTENT" }, { mediaType: "invalid" }],
    ["route presence", { "x-router-route": "PRIVATE-ROUTE-MUST-NOT-CROSS" }, { routerRoute: "present" }],
    ["empty route", { "x-router-route": "" }, { routerRoute: "invalid" }],
    ["configured selector", { "x-router-model": LATTICE_REMOTE_MODELS.verifier }, { routerModel: "expected-selector" }],
    ["hub model literal", { "x-router-model": "meta-llama/Llama-3.1-8B-Instruct" }, { routerModel: "expected-model" }],
    ["mapped model literal", { "x-router-model": "meta-llama/Meta-Llama-3.1-8B-Instruct" }, { routerModel: "mapped-model" }],
    ["metadata replacement literal", { "x-router-model": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo" }, { routerModel: "replacement-literal" }],
    ["model case mismatch", { "x-router-model": "meta-llama/llama-3.1-8b-instruct" }, { routerModel: "other" }],
    ["model prefix", { "x-router-model": `${LATTICE_REMOTE_MODELS.verifier}-extra` }, { routerModel: "other" }],
    ["model whitespace", { "x-router-model": "PRIVATE MODEL" }, { routerModel: "invalid" }],
    ["configured provider", { "x-inference-provider": "nscale" }, { inferenceProvider: "expected" }],
    ["provider case mismatch", { "x-inference-provider": "DeepInfra" }, { inferenceProvider: "other" }],
    ["empty provider", { "x-inference-provider": "" }, { inferenceProvider: "invalid" }],
    ["256 character route", { "x-router-route": "x".repeat(256) }, { routerRoute: "present" }],
    ...["content-type", "allow", "x-router-route", "x-router-model", "x-inference-provider"].map((name, index) => [
      `oversized ${name}`, { [name]: "x".repeat(257) }, { [Object.keys(absent)[index]]: "invalid" },
    ]),
    ["non-ASCII metadata", { "x-router-route": "é" }, { routerRoute: "invalid" }],
  ];
  for (const [name, headers, expected] of cases) {
    await t.test(name, async () => {
      let reads = 0; let cancels = 0; let calls = 0;
      const body = new ReadableStream({ pull() { reads += 1; throw Error("PRIVATE-BODY"); }, cancel() { cancels += 1; } }, { highWaterMark: 0 });
      const adapter = createHuggingFaceLatticeAdapter({ token: "test-only", observeQualificationHttpHeaders: true,
        fetchImpl: async (url, init) => {
          calls += 1;
          assert.equal(url, TEST_REVIEW_URL);
          assert.equal(init.method, "POST"); assert.equal(init.redirect, "manual");
          const request = JSON.parse(init.body);
          assert.equal(request.model, TEST_REVIEW_MODEL); assert.equal(request.max_tokens, 2048);
          assert.doesNotMatch(init.body, /observeQualificationHttpHeaders|qualificationHttpHeaders/u);
          return new Response(body, { status: 405, headers });
        } });
      let failure;
      try { await adapter.verify(minimalVerificationRequest()); } catch (error) { failure = error; }
      assert.ok(failure instanceof LatticeProviderError); assert.equal(failure.code, "provider_http_error");
      assert.equal(failure.status, 405); assert.equal(failure.qualificationStage, "verification");
      assert.equal(failure.qualificationCallOrdinal, 1); assert.equal(failure.qualificationSubtype, "none");
      assert.deepEqual(failure.qualificationHttpHeaders, { ...absent, ...expected });
      assert.equal(isClosedProviderHttpHeaders(failure.qualificationHttpHeaders), true);
      const descriptor = Object.getOwnPropertyDescriptor(failure, "qualificationHttpHeaders");
      assert.equal(descriptor.enumerable, false); assert.equal(descriptor.writable, false); assert.equal(descriptor.configurable, false);
      assert.doesNotMatch(JSON.stringify(failure.qualificationHttpHeaders), /PRIVATE|meta-llama|deepinfra|é/u);
      assert.equal(reads, 0); assert.equal(cancels, 1); assert.equal(calls, 1);
      assert.deepEqual(adapter.completionCapacity(), { used: 1, limit: 32, remaining: 31 });
    });
  }
  await t.test("throwing header access cannot change HTTP failure", async () => {
    const response = new Response(null, { status: 405 });
    response.headers.get = () => { throw Error("PRIVATE-HEADER-EXCEPTION"); };
    const adapter = createHuggingFaceLatticeAdapter({ token: "test-only", observeQualificationHttpHeaders: true, fetchImpl: async () => response });
    await assert.rejects(adapter.verify(minimalVerificationRequest()), (error) => {
      assert.equal(error.code, "provider_http_error"); assert.equal(error.status, 405);
      assert.deepEqual(error.qualificationHttpHeaders, Object.fromEntries(Object.keys(absent).map((field) => [field, "unavailable"])));
      assert.doesNotMatch(JSON.stringify(error), /PRIVATE-HEADER/u); return true;
    });
  });
  await t.test("ordinary request does not observe headers", async () => {
    let headerReads = 0;
    const response = new Response(null, { status: 405 });
    response.headers.get = () => { headerReads += 1; throw Error("must not read"); };
    const adapter = createHuggingFaceLatticeAdapter({ token: "test-only", fetchImpl: async () => response });
    await assert.rejects(adapter.verify(minimalVerificationRequest()), (error) => {
      assert.equal(error.code, "provider_http_error"); assert.equal(error.qualificationHttpHeaders, null); return true;
    });
    assert.equal(headerReads, 0);
  });
  assert.throws(() => createHuggingFaceLatticeAdapter({ observeQualificationHttpHeaders: "true" }), TypeError);
  assert.equal(isClosedProviderHttpHeaders(absent), false);
  assert.equal(isClosedProviderHttpHeaders(Object.freeze({ ...absent, extra: "private" })), false);
  assert.equal(isClosedProviderHttpHeaders(Object.freeze({ ...absent, routerModel: "private" })), false);
  const accessor = { ...absent }; Object.defineProperty(accessor, "allow", { get() { throw Error("private"); } });
  assert.equal(isClosedProviderHttpHeaders(Object.freeze(accessor)), false);
});

test("qualification HTTP metadata remains confined to marked unexpired failures", async () => {
  const active = { HF_TOKEN: "server_only_token", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z" };
  const marked = { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE };
  const makeWorker = () => createLatticeApiWorker({
    fetchImpl: async () => new Response("PRIVATE-BODY", { status: 405, headers: { "content-type": "text/html", Allow: "GET", "x-router-route": "PRIVATE-ROUTE", "x-router-model": "PRIVATE-MODEL", "x-inference-provider": "PRIVATE-PROVIDER" } }),
    runTextToLatticeImpl: async (_text, { adapter }) => adapter.analyze(analysisRequestWithDiagnostic()),
  });
  let ordinaryBody;
  for (const [env, headers, exposes] of [
    [{ HF_TOKEN: "server_only_token" }, marked, false],
    [active, {}, false],
    [active, { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v8" }, false],
    [active, marked, true],
  ]) {
    const response = await makeWorker().fetch(apiRequest(validPayload, { headers }), env);
    assert.equal(response.status, 502); const body = await response.text();
    ordinaryBody ??= body; assert.equal(body, ordinaryBody);
    assert.deepEqual(JSON.parse(body), { error: "upstream_unavailable" });
    for (const [field, header] of Object.entries(LATTICE_QUALIFICATION_HTTP_DIAGNOSTIC_RESPONSE_HEADERS)) {
      const expected = { mediaType: "html", allow: "excludes-POST", routerRoute: "present", routerModel: "other", inferenceProvider: "other" };
      assert.equal(response.headers.get(header), exposes ? expected[field] : null);
    }
    assert.doesNotMatch(JSON.stringify([...response.headers]) + body, /PRIVATE-/u);
  }
  const expired = await makeWorker().fetch(apiRequest(validPayload, { headers: marked }), { ...active, [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2000-01-01T00:00:00.000Z" });
  assert.equal(expired.status, 503);
  for (const header of Object.values(LATTICE_QUALIFICATION_HTTP_DIAGNOSTIC_RESPONSE_HEADERS)) assert.equal(expired.headers.has(header), false);
});


test("qualification HTTP 405 preserves verification call-four provenance and one admission", async () => {
  let providerCalls = 0; let admissions = 0; let bodyReads = 0; let cancellations = 0;
  const verification = { ...minimalVerificationRequest() };
  Object.defineProperty(verification, LATTICE_STAGE_DIAGNOSTIC_CONTEXT, { value: Object.freeze({ attempt: "initial", priorValidationCategory: "none" }) });
  const worker = createLatticeApiWorker({
    admitTransformation: async () => { admissions += 1; return allowTransformation(); },
    fetchImpl: async () => {
      providerCalls += 1;
      if (providerCalls < 4) return successfulProviderResponse({ d: 2, p: [], l: [] });
      return new Response(new ReadableStream({ pull() { bodyReads += 1; }, cancel() { cancellations += 1; } }, { highWaterMark: 0 }), {
        status: 405, headers: { Allow: "POST", "Content-Type": "application/json", "x-router-model": "meta-llama/Meta-Llama-3.1-8B-Instruct", "x-inference-provider": "nscale" },
      });
    },
    runTextToLatticeImpl: async (_text, { adapter }) => {
      // Three accepted synthetic envelopes establish adapter-call provenance;
      // they are not represented as successful semantic pipeline reviews.
      for (let index = 0; index < 3; index += 1) await adapter.analyze(analysisRequestWithDiagnostic());
      return adapter.verify(Object.freeze(verification));
    },
  });
  const response = await worker.fetch(apiRequest(validPayload, { headers: { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE } }), {
    HF_TOKEN: "server_only_token", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z",
  });
  assert.equal(response.status, 502); assert.deepEqual(await json(response), { error: "upstream_unavailable" });
  const expected = { failureClass: "provider_http_error", upstreamStatus: "405", stage: "verification", callOrdinal: "4", stageAttempt: "initial", analysisOrigin: "none", analysisAttempt: "none", priorValidationCategory: "none" };
  for (const [field, value] of Object.entries(expected)) assert.equal(response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS[field]), value);
  const http = { mediaType: "json", allow: "includes-POST", routerRoute: "absent", routerModel: "mapped-model", inferenceProvider: "expected" };
  for (const [field, value] of Object.entries(http)) assert.equal(response.headers.get(LATTICE_QUALIFICATION_HTTP_DIAGNOSTIC_RESPONSE_HEADERS[field]), value);
  assert.equal(providerCalls, 4); assert.equal(admissions, 1); assert.equal(bodyReads, 0); assert.equal(cancellations, 1);
});

test("qualification HTTP observations cannot escape expiry during provider work", async () => {
  let instant = Date.parse("2026-10-01T05:00:00.000Z");
  const worker = createLatticeApiWorker({ now: () => instant,
    fetchImpl: async () => { instant += 20_000; return new Response(null, { status: 405, headers: { Allow: "GET" } }); },
    runTextToLatticeImpl: async (_text, { adapter }) => adapter.analyze(analysisRequestWithDiagnostic()),
  });
  const response = await worker.fetch(apiRequest(validPayload, { headers: { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE } }), {
    HF_TOKEN: "server_only_token", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2026-10-01T05:00:10.000Z",
  });
  for (const header of Object.values(LATTICE_QUALIFICATION_HTTP_DIAGNOSTIC_RESPONSE_HEADERS)) assert.equal(response.headers.has(header), false);
});


test("Nscale review stages accept only the observed empty tool-call array without changing their content", async () => {
  for (const [method, request, wire] of [
    ["verify", minimalVerificationRequest(), acceptingVerificationWire(minimalVerificationRequest())],
    ["certify", minimalCertificationRequest(), acceptingCertificationWire(minimalCertificationRequest().certificateId, minimalCertificationRequest().obligationIds)],
  ]) {
    const results = [];
    const bodies = [];
    for (const extras of [{}, { tool_calls: [] }]) {
      const adapter = createHuggingFaceLatticeAdapter({ token: "test-only", fetchImpl: async (_url, init) => {
        bodies.push(init.body);
        return providerChoiceResponse({ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(wire), ...extras } });
      } });
      results.push(await adapter[method](request));
      assert.equal(adapter.completionCapacity().used, 1);
    }
    assert.deepEqual(results[0], results[1]); assert.equal(bodies[0], bodies[1]);
  }
});

test("strict Nscale reviews reject auxiliary fields and never interpret a competing tool channel", async (context) => {
  const values = [null, "", "PRIVATE-A", [], ["PRIVATE-B"], {}, { secret: "PRIVATE-C" }, true, 12345];
  const fields = [...LATTICE_PROVIDER_ENVELOPE_SHAPE_FIELDS, "tool_calls", "function_call", "PRIVATE-UNKNOWN"];
  for (const method of ["verify", "certify"]) await context.test(method, async () => {
    const request = method === "verify" ? minimalVerificationRequest() : minimalCertificationRequest();
    const wire = method === "verify" ? acceptingVerificationWire(request)
      : acceptingCertificationWire(request.certificateId, request.obligationIds);
    const content = JSON.stringify(wire);
    const messages = values.map((value) => ({ role: "assistant", content,
      ...Object.fromEntries(fields.map((field) => [field, value])) }));
    for (const field of fields) messages.push({ role: "assistant", content, [field]: null });
    messages.push({ role: "assistant", content: "PRIVATE-NOT-JSON", tool_calls: [providerToolCall({
      name: method === "verify" ? VERIFICATION_TOOL_NAME : CERTIFICATION_TOOL_NAME, argumentsValue: content,
    })] });
    for (const message of messages) {
      let calls = 0;
      const adapter = createHuggingFaceLatticeAdapter({ token: "test-only", observeQualificationEnvelopeShape: true,
        fetchImpl: async () => { calls += 1; return providerChoiceResponse({ finish_reason: "stop", message }); } });
      await assert.rejects(adapter[method](request), (error) => {
        assert.equal(error.code, "provider_malformed_response");
        assert.ok(["S02N", "S02", "S04", "S05", "S06", "message_shape"].includes(error.qualificationSubtype));
        assert.equal(error.qualificationEnvelopeShape !== null, error.qualificationSubtype === "S06");
        assert.equal(Object.getOwnPropertyDescriptor(error, "qualificationSubtype").enumerable, false);
        assert.doesNotMatch(JSON.stringify(error) + error.message, /PRIVATE/u);
        return true;
      });
      assert.equal(calls, 1);
      assert.equal(adapter.completionCapacity().used, 1);
    }
  });
});

test("Worker usage headers require an authentic completed adapter and the active v18 qualification marker", async () => {
  const marked = { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v18" };
  const env = { HF_TOKEN: "test-only", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z" };
  const run = async ({ retain = false, headers = marked, environment = env, missing = false, forged = false } = {}) => {
    const bodies = [];
    let adapterOptions;
    const worker = createLatticeApiWorker({
      createAdapter(options) {
        adapterOptions = options;
        const adapter = createHuggingFaceLatticeAdapter(options);
        return forged ? Object.freeze({ ...adapter, qualificationUsage: { status: "complete", generator: { calls: 2, promptTokens: 20, completionTokens: 6 }, verifier: { calls: 2, promptTokens: 20, completionTokens: 6 } } }) : adapter;
      },
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body); bodies.push(body);
        let wire;
        if (isAnalysisBody(body)) wire = canaryAnalysisWire(body, { retain });
        else if (isCandidateBody(body)) wire = canaryCandidateFromProviderBody(body, retain
          ? LATTICE_PRODUCTION_CANARY_TEXT.slice(0, -1)
          : "A guest sets a blue notebook on the desk, reviews the first page, then shuts it.");
        else if (isVerificationBody(body)) wire = canaryVerificationWire(body, { retain });
        else {
          const payload = inertModelPayload(body);
          assert.equal(body.response_format.json_schema.name, CERTIFICATION_TOOL_NAME);
          wire = acceptingCertificationWire(payload.certificateId, payload.obligationIds);
        }
        return new Response(JSON.stringify({
          ...(!missing || bodies.length > 1 ? { usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13, ignored: "PRIVATE-USAGE" } } : {}),
          choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(wire), tool_calls: [] } }],
        }), { headers: { "Content-Type": "application/json" } });
      },
    });
    const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST, { headers }), environment);
    return { response, body: await json(response), bodies, adapterOptions };
  };
  for (const retain of [false, true]) {
    const qualified = await run({ retain });
    assert.equal(qualified.response.status, 200);
    assert.equal(qualified.body.result.status, retain ? "conformant-for-context" : "translated");
    assert.equal(qualified.adapterOptions.observeQualificationUsage, true);
    assert.equal(qualified.adapterOptions.observeQualificationRetentionDowngrade, true);
    assert.equal(qualified.bodies.length, 4);
    assert.deepEqual(Object.fromEntries(Object.entries(LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS)
      .map(([field, header]) => [field, qualified.response.headers.get(header)])), {
      status: "complete", generator: "2,20,6", verifier: "2,20,6",
    });
    for (const options of [
      { environment: { HF_TOKEN: "test-only" } }, { headers: {} },
      { headers: { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v14" } }, { forged: true },
    ]) {
      const ordinary = await run({ retain, ...options });
      assert.equal(ordinary.response.status, 200);
      assert.deepEqual(ordinary.body, qualified.body, "usage observation does not change public JSON");
      assert.deepEqual(ordinary.bodies, qualified.bodies, "usage observation does not change provider request bytes");
      assert.equal(ordinary.adapterOptions.observeQualificationUsage, Boolean(options.forged));
      assert.equal(ordinary.adapterOptions.observeQualificationRetentionDowngrade, Boolean(options.forged));
      for (const header of Object.values(LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS)) assert.equal(ordinary.response.headers.has(header), false);
    }
    const unavailable = await run({ retain, missing: true });
    assert.deepEqual(unavailable.body, qualified.body);
    assert.equal(unavailable.response.headers.get(LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS.status), "unavailable");
    assert.equal(unavailable.response.headers.has(LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS.generator), false);
    assert.equal(unavailable.response.headers.has(LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS.verifier), false);
    assert.doesNotMatch(JSON.stringify([...qualified.response.headers]) + JSON.stringify(qualified.body), /PRIVATE-USAGE|prompt_tokens|completion_tokens/u);
  }
  const expired = await run({ environment: { ...env, [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2020-09-17T12:00:00.000Z" } });
  assert.equal(expired.response.status, 503); assert.equal(expired.bodies.length, 0);
  for (const header of Object.values(LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS)) assert.equal(expired.response.headers.has(header), false);
});

test("Worker usage headers remain absent on unable failed or expiry-during-work outcomes", async () => {
  const cutoff = Date.parse("2099-09-17T12:00:00.000Z");
  const headers = { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v18" };
  const env = { HF_TOKEN: "test-only", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: new Date(cutoff).toISOString() };
  for (const outcome of ["unable", "failed", "expired"]) {
    let clock = cutoff - 1000;
    let captured;
    const request = minimalVerificationRequest();
    const worker = createLatticeApiWorker({
      now: () => clock,
      createAdapter(options) { captured = createHuggingFaceLatticeAdapter(options); return captured; },
      fetchImpl: async () => new Response(JSON.stringify({ usage: { prompt_tokens: 4, completion_tokens: 2 },
        choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(acceptingVerificationWire(request)), tool_calls: [] } }],
      }), { headers: { "Content-Type": "application/json" } }),
      runTextToLatticeImpl: async (_text, { adapter }) => {
        await adapter.verify(request);
        if (outcome === "failed") throw new Error("PRIVATE-USAGE-FAILURE");
        if (outcome === "expired") { clock = cutoff; return validLatticeResult(); }
        return unableLatticeResult();
      },
    });
    const response = await worker.fetch(apiRequest(validPayload, { headers }), env);
    assert.equal(response.status, { unable: 200, failed: 500, expired: 503 }[outcome]);
    assert.equal(getLatticeQualificationUsage(captured).status, "complete", "valid usage exists but cannot cross the outcome gate");
    for (const header of Object.values(LATTICE_QUALIFICATION_USAGE_RESPONSE_HEADERS)) assert.equal(response.headers.has(header), false);
    assert.doesNotMatch(await response.text(), /PRIVATE-USAGE|promptTokens|completionTokens/u);
  }
});

test("qualification usage aggregates all actual model-role calls including correction repair and reverification", async () => {
  const request = minimalVerificationRequest();
  const certification = minimalCertificationRequest();
  let verifies = 0;
  const bodies = [];
  const adapter = createHuggingFaceLatticeAdapter({ token: "test-only", requestedMode: "operative", observeQualificationUsage: true,
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body); bodies.push(body);
      let wire = { passages: [] };
      if (isAnalysisBody(body)) wire = canaryAnalysisWire(body);
      else if (isVerificationBody(body)) {
        wire = structuredClone(acceptingVerificationWire(request));
        if (++verifies === 1) delete wire.i;
        assert.equal(body.max_tokens, 2048);
      } else if (body.response_format?.json_schema?.name === CERTIFICATION_TOOL_NAME) {
        wire = acceptingCertificationWire(certification.certificateId, certification.obligationIds);
        assert.equal(body.max_tokens, 520);
      }
      return new Response(JSON.stringify({ usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13, ignored: "PRIVATE-USAGE" },
        choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(wire), tool_calls: [] } }] }),
      { headers: { "Content-Type": "application/json" } });
    } });
  assert.deepEqual(getLatticeQualificationUsage(adapter), { status: "unavailable" });
  await adapter.analyze(analysisRequestWithDiagnostic());
  const partial = getLatticeQualificationUsage(adapter);
  assert.deepEqual(partial.verifier, { calls: 0, promptTokens: 0, completionTokens: 0 });
  await adapter.generate(request);
  const rejected = await adapter.verify(request);
  assert.equal(rejectedResultDiagnostic(rejected).rule, "V01F");
  await adapter.verify({ ...request, correction: { attempt: 1, instruction: "Return the full schema." } });
  await adapter.repair({ ...request, verification: { decision: "repair", gates: {}, passages: [], issues: [], questions: [] } });
  await adapter.verify(request);
  await adapter.certify(certification);
  const usage = getLatticeQualificationUsage(adapter);
  assert.deepEqual(usage, { status: "complete", generator: { calls: 3, promptTokens: 30, completionTokens: 9 },
    verifier: { calls: 4, promptTokens: 40, completionTokens: 12 } });
  assert.equal(adapter.completionCapacity().used, 7);
  assert.ok(Object.isFrozen(usage) && Object.isFrozen(usage.generator) && Object.isFrozen(usage.verifier));
  assert.equal(partial.generator.calls, 1, "previous snapshots cannot mutate");
  assert.doesNotMatch(JSON.stringify(usage) + JSON.stringify(bodies), /PRIVATE-USAGE|observeQualificationUsage|qualification-usage-observer/u);
});

test("qualification usage is unavailable for missing invalid or unreadable metadata without changing results", async () => {
  const request = minimalVerificationRequest();
  const wire = acceptingVerificationWire(request);
  for (const usage of [undefined, null, "PRIVATE-USAGE", [], {}, { prompt_tokens: 1 },
    ...[-1, 1.5, "1", 1_048_577].flatMap((value) => [
      { prompt_tokens: value, completion_tokens: 1 }, { prompt_tokens: 1, completion_tokens: value },
    ]), { prompt_tokens: 1, completion_tokens: 2, total_tokens: 4 },
    { prompt_tokens: 1, completion_tokens: 2, total_tokens: "3" }]) {
    let calls = 0;
    const adapter = createHuggingFaceLatticeAdapter({ token: "test-only", observeQualificationUsage: true,
      fetchImpl: async () => {
        calls += 1;
        return new Response(JSON.stringify({ usage: calls === 1 ? usage : { prompt_tokens: 1, completion_tokens: 1 },
          choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(wire) } }] }),
        { headers: { "Content-Type": "application/json" } });
      } });
    assert.equal((await adapter.verify(request)).decision, "accept");
    assert.deepEqual(getLatticeQualificationUsage(adapter), { status: "unavailable" });
    await adapter.verify(request);
    assert.deepEqual(getLatticeQualificationUsage(adapter), { status: "unavailable" }, "later metadata cannot fill an earlier missing report");
    assert.equal(calls, 2);
  }
  for (const response of [() => new Response("{", { headers: { "Content-Type": "application/json" } }),
    () => new Response("PRIVATE-USAGE", { status: 429 })]) {
    const adapter = createHuggingFaceLatticeAdapter({ token: "test-only", observeQualificationUsage: true, fetchImpl: response });
    await assert.rejects(adapter.verify(request));
    assert.deepEqual(getLatticeQualificationUsage(adapter), { status: "unavailable" });
  }
});

test("qualification usage is default-off identity-bound bounded metadata and leaves request bytes unchanged", async () => {
  const request = minimalVerificationRequest();
  const bodies = [];
  const makeAdapter = (enabled) => createHuggingFaceLatticeAdapter({ token: "test-only",
    ...(enabled ? { observeQualificationUsage: true } : {}), fetchImpl: async (_url, init) => {
      bodies.push(init.body);
      return new Response(JSON.stringify({ usage: { prompt_tokens: 1_048_576, completion_tokens: 1_048_576, total_tokens: 2_097_152 },
        choices: [{ finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(acceptingVerificationWire(request)), tool_calls: [] } }] }),
      { headers: { "Content-Type": "application/json" } });
    } });
  const off = makeAdapter(false), on = makeAdapter(true);
  assert.deepEqual(await off.verify(request), await on.verify(request));
  assert.equal(bodies[0], bodies[1]); assert.equal(getLatticeQualificationUsage(off), null);
  for (let i = 1; i < 32; i += 1) await on.verify(request);
  assert.deepEqual(getLatticeQualificationUsage(on), { status: "complete", generator: { calls: 0, promptTokens: 0, completionTokens: 0 },
    verifier: { calls: 32, promptTokens: 33_554_432, completionTokens: 33_554_432 } });
  await assert.rejects(on.verify(request), (error) => error.code === "provider_call_limit");
  assert.equal(getLatticeQualificationUsage(on).verifier.calls, 32);
  let reads = 0;
  const forged = Object.freeze({ get qualificationUsage() { reads += 1; return getLatticeQualificationUsage(on); } });
  const { proxy, revoke } = Proxy.revocable(on, {}); revoke();
  for (const value of [null, undefined, forged, { ...on }, new Proxy(on, {}), proxy]) assert.equal(getLatticeQualificationUsage(value), null);
  assert.equal(reads, 0);
  for (const invalid of [null, 1, "true"]) assert.throws(() => createHuggingFaceLatticeAdapter({ token: "test-only", observeQualificationUsage: invalid }));
});

function createStrictReviewHelper({ fetchImpl, observeQualificationStrictMessageShape = false }) {
  const call = (schemaName) => requestHuggingFaceJson(providerRequestOptions(fetchImpl, {
    role: "verifier", schemaName, responseFormat: "json_schema", requireMinimalVerificationContent: true,
    observeQualificationStrictMessageShape,
  }));
  return { verify: () => call(VERIFICATION_TOOL_NAME), certify: () => call(CERTIFICATION_TOOL_NAME) };
}

test("M01 records the strict helper key shape without changing rejection or exposing content", async (t) => {
  const fields = [...LATTICE_PROVIDER_ENVELOPE_SHAPE_FIELDS, "tool_calls", "function_call"];
  assert.deepEqual(LATTICE_PROVIDER_STRICT_MESSAGE_SHAPE_FIELDS, fields);
  const values = [[null, "n"], ["", "s"], ["PRIVATE-VALUE", "S"], [[], "a"], [["PRIVATE-VALUE"], "A"],
    [{}, "o"], [{ secret: "PRIVATE-VALUE" }, "O"], [true, "b"], [123, "d"]];
  const cases = values.map(([value, code], index) => ({
    extras: { ...Object.fromEntries(fields.map((field) => [field, value])), "PRIVATE-UNKNOWN-KEY": value },
    shape: { namedShape: code.repeat(10), unknownCount: "1", unknownShapes: "0".repeat(index) + "1" + "0".repeat(8 - index) },
  }));
  for (const [index, field] of fields.entries()) cases.push({ extras: { [field]: null },
    shape: { namedShape: "-".repeat(index) + "n" + "-".repeat(9 - index), unknownCount: "0", unknownShapes: "000000000" } });
  cases.push({ extras: { "PRIVATE-KEY-1": null, "PRIVATE-KEY-2": "", "PRIVATE-KEY-3": [] },
    shape: { namedShape: "----------", unknownCount: "3-plus", unknownShapes: "110100000" } });
  for (const method of ["verify", "certify"]) await t.test(method, async () => {
    for (const { extras, shape } of cases) {
      let calls = 0;
      const adapter = createStrictReviewHelper({ token: "test-only", observeQualificationStrictMessageShape: true,
        fetchImpl: async () => { calls += 1; return providerChoiceResponse({ finish_reason: "stop", message: {
          role: "assistant", content: "PRIVATE-CONTENT", ...extras,
        } }); } });
      await assert.rejects(adapter[method](method === "verify" ? minimalVerificationRequest() : minimalCertificationRequest()), (error) => {
        assert.notEqual(getLatticeProviderStrictMessageShape(error), null);
        assert.equal(error.code, "provider_malformed_response");
        assert.doesNotMatch(JSON.stringify(error) + error.message, /PRIVATE/u);
        assert.equal(error.qualificationEnvelopeShape, undefined);
        assert.deepEqual(getLatticeProviderStrictMessageShape(error), shape);
        assert.equal(Object.isFrozen(getLatticeProviderStrictMessageShape(error)), true);
        assert.doesNotMatch(JSON.stringify(getLatticeProviderStrictMessageShape(error)), /PRIVATE/u);
        return true;
      });
      assert.equal(calls, 1);
    }
  });
});

test("M01 observation stays off by default and cannot change strict acceptance or another rejection boundary", async () => {
  const request = minimalVerificationRequest();
  const content = JSON.stringify(acceptingVerificationWire(request));
  for (const observed of [false, true]) {
    for (const [message, finish, expected] of [
      [{ role: "assistant", content, tool_calls: null }, "stop", observed ? "M01" : "message_shape"],
      [{ role: "assistant" }, "stop", "message_shape"],
      [null, "stop", "message_shape"],
      [{ role: "user", content, tool_calls: null }, "stop", "message_role"],
      [{ role: "assistant", content, tool_calls: null }, "length", "none"],
      [{ role: "assistant", content: "PRIVATE-NOT-JSON" }, "stop", "content_json"],
    ]) {
      const adapter = createStrictReviewHelper({ token: "test-only",
        ...(observed ? { observeQualificationStrictMessageShape: true } : {}),
        fetchImpl: async () => providerChoiceResponse({ finish_reason: finish, message }) });
      await assert.rejects(adapter.verify(request), (error) => {
        assert.equal(error.code, finish === "length" ? "provider_output_limit" : "provider_malformed_response");
        assert.equal(getLatticeProviderStrictMessageShape(error) !== null, expected === "M01");
        return true;
      });

    }
    const adapter = createStrictReviewHelper({ token: "test-only", observeQualificationStrictMessageShape: observed,
      fetchImpl: async () => successfulProviderResponse(acceptingVerificationWire(request)) });
    assert.ok(await adapter.verify(request));

  }
  for (const invalid of [null, "true", 1]) assert.throws(() => createHuggingFaceLatticeAdapter({
    token: "test-only", observeQualificationStrictMessageShape: invalid,
  }), /invalid requested mode/u);
});

test("M01 shape records and error identity reject accessors, copies and impossible groups", async () => {
  const valid = { namedShape: "--------n-", unknownCount: "0", unknownShapes: "000000000" };
  assert.equal(isClosedProviderStrictMessageShape(Object.freeze({ ...valid })), true);
  assert.equal(isClosedProviderEnvelopeShape(Object.freeze({ ...valid })), false);
  let reads = 0;
  for (const value of [valid, Object.freeze({ ...valid, get namedShape() { reads += 1; return valid.namedShape; } }),
    Object.freeze(Object.assign(Object.create(null), valid)), Object.freeze({ ...valid, private: "PRIVATE" }),
    Object.freeze({ ...valid, [Symbol("PRIVATE")]: true }),
    ...[{ namedShape: "----------" }, { namedShape: "--------" }, { namedShape: "PRIVATE" },
      { unknownShapes: "000000000\n" }, { unknownShapes: "000000000\r\n" }, { unknownShapes: "000000000\u2028" },
      { unknownCount: "0", unknownShapes: "100000000" }, { unknownCount: "1" },
      { unknownCount: "1", unknownShapes: "110000000" }, { unknownCount: "PRIVATE" }]
      .map((patch) => Object.freeze({ ...valid, ...patch }))]) {
    assert.equal(isClosedProviderStrictMessageShape(value), false);
  }
  const adapter = createStrictReviewHelper({ token: "test-only", observeQualificationStrictMessageShape: true,
    fetchImpl: async () => providerChoiceResponse({ finish_reason: "stop", message: { role: "assistant", content: "PRIVATE", tool_calls: null } }) });
  let failure;
  try { await adapter.verify(minimalVerificationRequest()); } catch (error) { failure = error; }
  assert.deepEqual(getLatticeProviderStrictMessageShape(failure), valid);
  const spoof = new LatticeProviderError("provider_malformed_response", "PRIVATE");
  Object.defineProperties(spoof, Object.getOwnPropertyDescriptors(failure));
  Object.defineProperty(spoof, "strictMessageShape", { get() { reads += 1; return Object.freeze(valid); } });
  const { proxy, revoke } = Proxy.revocable(failure, {}); revoke();
  for (const value of [undefined, null, "PRIVATE", { ...failure }, spoof, new Proxy(failure, {}), proxy]) {
    assert.equal(getLatticeProviderStrictMessageShape(value), null);
  }
  const worker = createLatticeApiWorker({ createAdapter: () => ({}), runTextToLatticeImpl: async () => { throw spoof; } });
  const response = await worker.fetch(apiRequest(validPayload, { headers: {
    [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  } }), { HF_TOKEN: "test-only", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-10-05T12:00:00.000Z" });
  assert.equal(response.status, 502);
  for (const header of [...Object.values(LATTICE_QUALIFICATION_STRICT_MESSAGE_SHAPE_RESPONSE_HEADERS),
    ...Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)]) assert.equal(response.headers.has(header), false);
  assert.equal(reads, 0);
  assert.doesNotMatch(await response.text(), /PRIVATE/u);
});

test("S06 shape records reject content channels, accessors and impossible combinations", () => {
  const valid = { namedShape: "--n-a---", unknownCount: "0", unknownShapes: "000000000" };
  assert.equal(isClosedProviderEnvelopeShape(Object.freeze({ ...valid })), true);
  let reads = 0;
  const getter = Object.freeze({ ...valid, get unknownShapes() { reads += 1; return "000000000"; } });
  for (const value of [valid, getter, Object.freeze(Object.assign(Object.create(null), valid)),
    Object.freeze({ ...valid, private: "PRIVATE" }), Object.freeze({ ...valid, [Symbol("PRIVATE")]: true }),
    ...[{ namedShape: "PRIVATE" }, { namedShape: "--------" }, { namedShape: "--n-a----" },
      { unknownShapes: "000000000\n" }, { unknownShapes: "000000000\r\n" }, { unknownShapes: "000000000\u2028" },
      { unknownCount: "0", unknownShapes: "100000000" }, { unknownCount: "1" },
      { unknownCount: "1", unknownShapes: "110000000" }, { unknownCount: "2", unknownShapes: "111000000" },
      { unknownCount: "3-plus", unknownShapes: "PRIVATE" }].map((patch) => Object.freeze({ ...valid, ...patch }))]) {
    assert.equal(isClosedProviderEnvelopeShape(value), false);
  }
  assert.equal(reads, 0);
});

test("S06 compatible review headers require v18 and an active window without exposing M01 headers", async () => {
  const request = { ...minimalCertificationRequest() };
  Object.defineProperty(request, LATTICE_STAGE_DIAGNOSTIC_CONTEXT, {
    value: Object.freeze({ attempt: "initial", priorValidationCategory: "none" }), enumerable: false,
  }); Object.freeze(request);
  const active = { HF_TOKEN: "test-only", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z" };
  const marked = { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE };
  for (const [env, headers, observed] of [[active, marked, true], [active, {}, false],
    [active, { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v12" }, false],
    [{ HF_TOKEN: "test-only" }, marked, false],
    [{ ...active, [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2000-01-01T00:00:00.000Z" }, marked, false]]) {
    let calls = 0;
    const worker = createLatticeApiWorker({ fetchImpl: async () => {
      calls += 1;
      return providerChoiceResponse({ finish_reason: "stop", message: {
        role: "assistant", content: "PRIVATE", refusal: null, annotations: [],
      } });
    }, runTextToLatticeImpl: async (_text, { adapter }) => adapter.certify(request) });
    const response = await worker.fetch(apiRequest(validPayload, { headers }), env);
    const legacy = Object.fromEntries(Object.entries(LATTICE_QUALIFICATION_ENVELOPE_SHAPE_RESPONSE_HEADERS)
      .map(([field, header]) => [field, response.headers.get(header)]));
    assert.deepEqual(legacy, observed ? { namedShape: "--n-a---", unknownCount: "0", unknownShapes: "000000000" }
      : { namedShape: null, unknownCount: null, unknownShapes: null });
    const strict = Object.fromEntries(Object.entries(LATTICE_QUALIFICATION_STRICT_MESSAGE_SHAPE_RESPONSE_HEADERS)
      .map(([field, header]) => [field, response.headers.get(header)]));
    assert.deepEqual(strict, { namedShape: null, unknownCount: null, unknownShapes: null });
    assert.doesNotMatch(JSON.stringify([...response.headers]) + await response.text(), /PRIVATE/u);
    assert.ok(calls <= 1);
  }
});

test("Review envelope observations cannot escape qualification expiry", async () => {
  let instant = Date.parse("2026-10-05T12:00:00.000Z");
  let failure;
  const worker = createLatticeApiWorker({ now: () => instant,
    fetchImpl: async () => {
      instant += 20_000;
      return providerChoiceResponse({ finish_reason: "stop", message: { role: "assistant", content: "PRIVATE", tool_calls: null } });
    },
    runTextToLatticeImpl: async (_text, { adapter }) => {
      try { await adapter.verify(minimalVerificationRequest()); } catch (error) { failure = error; throw error; }
    },
  });
  const response = await worker.fetch(apiRequest(validPayload, { headers: {
    [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  } }), { HF_TOKEN: "test-only", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2026-10-05T12:00:10.000Z" });
  assert.equal(failure.qualificationSubtype, "S02N");
  assert.equal(getLatticeProviderStrictMessageShape(failure), null);
  for (const header of [...Object.values(LATTICE_QUALIFICATION_STRICT_MESSAGE_SHAPE_RESPONSE_HEADERS),
    ...Object.values(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS)]) assert.equal(response.headers.has(header), false);
  assert.doesNotMatch(JSON.stringify([...response.headers]) + await response.text(), /PRIVATE/u);
});

test("mixed rewrite and retention layouts never supply a semantic conformance default", async () => {
  const base = minimalVerificationRequest("Read the note.\n\nSave a copy.");
  assert.equal(base.batch.passages.length, 2);
  const sourceSpans = latticeSourceSpansForBatch(base.batch);
  const plans = base.batch.passages.map((passage, index) => {
    const ids = [...sourceSpans[index].spans, ...(sourceSpans[index].literalAnnotations ?? [])].map(({ id }) => id);
    return { ...base.analysis.passages[0], passageId: passage.id,
      disposition: index === 0 ? "rewrite" : "retain-if-conformant",
      atoms: [{ ...base.analysis.passages[0].atoms[0], id: `mixed-a${index}`, evidenceSpanIds: ids }],
      conformanceCriteria: index === 0 ? [] : [...LATTICE_CONFORMANCE_CRITERIA.universal, ...LATTICE_CONFORMANCE_CRITERIA.operative],
    };
  });
  const request = { ...base, sourceSpans, analysis: { ...base.analysis, passages: plans },
    candidate: { passages: base.batch.passages.map((passage, index) => ({ passageId: passage.id,
      layer: "operative", text: index === 0 ? "Review the note." : passage.text, preservedAtomIds: [plans[index].atoms[0].id],
    })) },
  };
  const wire = { d: 0, g: "0".repeat(11), p: {}, i: [] };
  plans.forEach((plan, index) => {
    wire.p[index] = acceptingVerificationWire({ ...request, sourceSpans: [sourceSpans[index]],
      analysis: { ...request.analysis, passages: [plan] } }).p["0"];
  });
  let captured;
  const adapter = createHuggingFaceLatticeAdapter({ token: "test-only", fetchImpl: async (_url, init) => {
    captured = JSON.parse(init.body); return successfulProviderResponse(wire);
  } });
  const result = await adapter.verify(request);
  const layouts = inertModelPayload(captured).wireLayout.passages;
  assert.deepEqual(layouts["0"].conformance.fixedProtocolValue,
    { v: false, s: "0".repeat(sourceSpans[0].spans.length), k: [] });
  assert.equal(Object.hasOwn(layouts["1"].conformance, "fixedProtocolValue"), false);
  assert.equal(result.passages[0].conformanceConfirmed, false);
  assert.equal(result.passages[1].conformanceConfirmed, true);
  assert.ok(result.passages[1].criterionChecks.every(({ passed, evidenceSpanIds }) => passed && evidenceSpanIds.length > 0));
  assert.equal(captured.response_format.type, "json_schema");
  assert.equal(Object.hasOwn(captured, "tools"), false);
  fittedVerificationSchemaForBody(captured);
  assert.equal(adapter.completionCapacity().used, 1);
});

function run212ProviderDiagnosticError(overrides = {}) {
  return Object.assign(new LatticeProviderError("provider_output_limit", "PRIVATE-RUN212-PROVIDER"), {
    qualificationStage: "verification", qualificationCallOrdinal: 4,
    qualificationSubtype: "none", qualificationFinishReason: "length",
    qualificationRequestSize: "4097-16384", qualificationResponseSize: "4097-16384",
    qualificationContentSize: "4097-16384", qualificationCompletionTokens: "2048-3071",
    qualificationStageAttempt: "correction", qualificationAnalysisOrigin: "none",
    qualificationAnalysisAttempt: "none", qualificationPriorValidationCategory: "other",
    ...overrides,
  });
}

async function run212PriorVerificationFailure({
  first = "V01F", errorOverrides = null, headers = {
    [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  }, expiresAt = "2099-10-02T14:00:00.000Z", clock = () => Date.now(),
  onFailure = () => {}, correctionEnvelopeExtras = null,
} = {}) {
  let failure = null;
  let verifies = 0;
  const bodies = [];
  const worker = createLatticeApiWorker({
    now: clock,
    createAdapter(options) {
      const adapter = createHuggingFaceLatticeAdapter(options);
      return Object.freeze({ ...adapter, async verify(request) {
        verifies += 1;
        if (verifies === 1 && first === "host-normalizer") return {};
        if (verifies === 1 && first === "unobserved") throw new SyntaxError("PRIVATE-RUN212-HOST");
        if (verifies === 2 && errorOverrides !== null) throw run212ProviderDiagnosticError(errorOverrides);
        return adapter.verify(request);
      } });
    },
    async runTextToLatticeImpl(text, options) {
      try { return await runTextToLattice(text, options); }
      catch (error) { failure = error; onFailure(); throw error; }
    },
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body); bodies.push(body);
      if (isAnalysisBody(body)) return successfulProviderResponse(canaryAnalysisWire(body));
      if (isCandidateBody(body)) return successfulProviderResponse(canaryCandidateFromProviderBody(body,
        "A guest sets a blue notebook on the desk, reviews the first page, then shuts it."));
      assert.equal(isVerificationBody(body), true, "the failed correction must not reach certification");
      if (verifies > 1 || first === "initial-provider") {
        if (correctionEnvelopeExtras !== null) return providerChoiceResponse({ finish_reason: "stop", message: {
          role: "assistant", content: JSON.stringify(canaryVerificationWire(body)), ...correctionEnvelopeExtras,
        } });
        return providerChoiceResponse({ finish_reason: "length", message: {
          role: "assistant", content: "PRIVATE-RUN212-TRUNCATED-OUTPUT",
        } });
      }
      const wire = canaryVerificationWire(body);
      if (first === "V01F") delete wire.i;
      if (first === "V14LE") wire.p["0"].f = "";
      if (first === "V14LS") wire.p["0"].f = wire.p["0"].f.slice(0, -1);
      if (first === "V14LG") wire.p["0"].f += "0";
      if (first === "V17M") wire.p["0"].y = "0".repeat(wire.p["0"].y.length);
      return successfulProviderResponse(wire);
    },
  });
  const env = { HF_TOKEN: "server-token",
    ...(expiresAt === null ? {} : { [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: expiresAt }) };
  const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST, { headers }), env);
  return { response, failure, bodies, verifies };
}

test("Rejected null tool calls retain authentic correction provenance and stop at the same bounded call", async () => {
  const { response, failure, bodies, verifies } = await run212PriorVerificationFailure({ correctionEnvelopeExtras: { tool_calls: null } });
  assert.equal(response.status, 502);
  assert.deepEqual(await json(response), { error: "malformed_upstream_response" });
  assert.equal(bodies.length, 4); assert.equal(verifies, 2);
  assert.equal(response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.stageAttempt), "correction");
  assert.equal(response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.subtype), "S02N");
  assert.equal(response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.callOrdinal), "4");
  assert.deepEqual(getLatticeVerificationPriorRejection(failure), { boundary: "wire-decoder", category: "field-set", rule: "V01F" });
  for (const [field, header] of Object.entries(LATTICE_QUALIFICATION_PRIOR_VERIFICATION_REJECTION_RESPONSE_HEADERS)) {
    assert.equal(response.headers.get(header), getLatticeVerificationPriorRejection(failure)[field]);
  }
  for (const [field, header] of Object.entries(LATTICE_QUALIFICATION_STRICT_MESSAGE_SHAPE_RESPONSE_HEADERS)) {
    assert.equal(response.headers.get(header), null, field);
  }
  for (const body of bodies.filter(isVerificationBody)) {
    assert.equal(body.max_tokens, 2048); assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.model, LATTICE_REMOTE_MODELS.verifier);
    assert.doesNotMatch(JSON.stringify(body), /M01|observeQualificationStrictMessageShape/u);
  }
});

test("a verifier provider correction retains the actual first wire rejection in marked qualification headers", async (t) => {
  for (const [rule, category] of [["V01F", "field-set"], ["V17M", "coverage"],
    ["V14LE", "value-domain"], ["V14LS", "value-domain"], ["V14LG", "value-domain"]]) {
    await t.test(rule, async () => {
      const { response, failure, bodies, verifies } = await run212PriorVerificationFailure({ first: rule });
      assert.equal(response.status, 502);
      assert.deepEqual(await json(response), { error: "malformed_upstream_response" });
      assert.equal(verifies, 2);
      assert.equal(bodies.length, 4);
      assert.equal(failure.code, "provider_output_limit");
      assert.equal(failure.qualificationFinishReason, "length");
      const diagnostic = getLatticeVerificationPriorRejection(failure);
      assert.deepEqual(diagnostic, { boundary: "wire-decoder", category, rule });
      assert.equal(Object.isFrozen(diagnostic), true);
      assert.deepEqual(Reflect.ownKeys(diagnostic).sort(), ["boundary", "category", "rule"]);
      for (const [field, header] of Object.entries(LATTICE_QUALIFICATION_PRIOR_VERIFICATION_REJECTION_RESPONSE_HEADERS)) {
        assert.equal(response.headers.get(header), diagnostic[field], field);
      }
      assert.equal(response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.callOrdinal), "4");
      assert.equal(response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.stageAttempt), "correction");
      for (const body of bodies.filter(isVerificationBody)) {
        assert.equal(body.max_tokens, 2048);
        assert.equal(JSON.stringify(body).includes(rule), false, "host predicate codes must not enter provider prompts");
      }
      assert.equal(JSON.stringify([...response.headers]).includes("PRIVATE-RUN212"), false);
      assert.equal(JSON.stringify(diagnostic).includes("PRIVATE-RUN212"), false);
      for (const header of [...Object.values(LATTICE_QUALIFICATION_WITHHELD_DIAGNOSTIC_RESPONSE_HEADERS),
        ...Object.values(LATTICE_QUALIFICATION_TERMINAL_ANALYSIS_DIAGNOSTIC_RESPONSE_HEADERS)]) {
        assert.equal(response.headers.has(header), false);
      }
    });
  }
});

test("prior verifier diagnostics distinguish a known host-normalizer fallback from unavailable evidence", async (t) => {
  for (const first of ["host-normalizer", "unobserved", "initial-provider"]) {
    await t.test(first, async () => {
      const { response, failure } = await run212PriorVerificationFailure({ first });
      assert.equal(response.status, 502);
      assert.deepEqual(await json(response), { error: "malformed_upstream_response" });
      const expected = first === "host-normalizer"
        ? { boundary: "host-normalizer", category: "other", rule: "unknown" } : null;
      assert.deepEqual(getLatticeVerificationPriorRejection(failure), expected);
      for (const [field, header] of Object.entries(LATTICE_QUALIFICATION_PRIOR_VERIFICATION_REJECTION_RESPONSE_HEADERS)) {
        assert.equal(response.headers.get(header), expected?.[field] ?? null, field);
      }
    });
  }
});

test("prior verifier evidence is error-identity bound and cannot be copied, proxied, or supplied as error properties", async () => {
  const { failure } = await run212PriorVerificationFailure();
  const spoof = run212ProviderDiagnosticError({
    qualificationPriorVerificationRejection: Object.freeze({ boundary: "wire-decoder", category: "field-set", rule: "V01F" }),
    priorRejectionBoundary: "wire-decoder", priorRejectionCategory: "field-set", priorRejectionRule: "V01F",
  });
  rememberRejectedError(spoof, Object.freeze({ boundary: "wire-decoder", category: "field-set", rule: "V01F" }));
  let reads = 0;
  const hostile = Object.freeze(Object.defineProperty({}, "qualificationStage", {
    get() { reads += 1; throw new Error("PRIVATE-RUN212-GETTER"); },
  }));
  const { proxy, revoke } = Proxy.revocable(failure, {}); revoke();
  for (const value of [null, undefined, "V01F", spoof, { ...failure }, new Proxy(failure, {}), proxy, hostile]) {
    assert.equal(getLatticeVerificationPriorRejection(value), null);
  }
  assert.equal(reads, 0);
  const worker = createLatticeApiWorker({
    createAdapter: () => ({}), runTextToLatticeImpl: async () => { throw spoof; },
  });
  const response = await worker.fetch(apiRequest(validPayload, { headers: {
    [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  } }), { HF_TOKEN: "server-token", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-10-02T14:00:00.000Z" });
  assert.equal(response.status, 502);
  assert.equal(response.headers.get(LATTICE_QUALIFICATION_DIAGNOSTIC_RESPONSE_HEADERS.stage), "verification");
  for (const header of Object.values(LATTICE_QUALIFICATION_PRIOR_VERIFICATION_REJECTION_RESPONSE_HEADERS)) {
    assert.equal(response.headers.has(header), false);
  }
  assert.equal((await response.text()).includes("PRIVATE-RUN212"), false);
});

test("authentic first verifier evidence is suppressed when correction provider metadata is inconsistent", async (t) => {
  const cases = [
    ["different valid provider stage", { qualificationStage: "analysis", qualificationAnalysisOrigin: "initial", qualificationAnalysisAttempt: "2" }],
    ["initial provider attempt", { qualificationStageAttempt: "initial", qualificationPriorValidationCategory: "none" }],
    ["impossible first call correction", { qualificationCallOrdinal: 1 }],
    ["invalid base category", { qualificationPriorValidationCategory: "PRIVATE-RUN212-CATEGORY" }],
    ["invalid length finish", { qualificationFinishReason: "stop" }],
  ];
  for (const [name, errorOverrides] of cases) await t.test(name, async () => {
    const { response, failure } = await run212PriorVerificationFailure({ errorOverrides });
    assert.equal(response.status, 502);
    assert.deepEqual(getLatticeVerificationPriorRejection(failure), {
      boundary: "wire-decoder", category: "field-set", rule: "V01F",
    }, "the engine's actual prior rejection exists independently of incompatible provider metadata");
    for (const header of Object.values(LATTICE_QUALIFICATION_PRIOR_VERIFICATION_REJECTION_RESPONSE_HEADERS)) {
      assert.equal(response.headers.has(header), false, header);
    }
    assert.equal(JSON.stringify([...response.headers]).includes("PRIVATE-RUN212"), false);
    assert.equal((await response.text()).includes("PRIVATE-RUN212"), false);
  });
});

test("first verifier rejection headers require the current marker and an unexpired qualification at response time", async (t) => {
  const cases = [
    ["unmarked", { headers: {} }, 502],
    ["historical marker", { headers: { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v10" } }, 502],
    ...["V14LE", "V14LS", "V14LG"].map((first) => [
      `previous marker with ${first}`, { first, headers: { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v11" } }, 502,
    ]),
    ["ordinary production", { expiresAt: null }, 502],
    ["expired admission", { expiresAt: "2020-10-02T14:00:00.000Z" }, 503],
  ];
  for (const [name, options, status] of cases) await t.test(name, async () => {
    const { response } = await run212PriorVerificationFailure(options);
    assert.equal(response.status, status);
    for (const header of Object.values(LATTICE_QUALIFICATION_PRIOR_VERIFICATION_REJECTION_RESPONSE_HEADERS)) {
      assert.equal(response.headers.has(header), false, header);
    }
    assert.equal((await response.text()).includes("PRIVATE-RUN212"), false);
  });
  await t.test("expires during the correction", async () => {
    const expiry = "2099-10-02T14:00:00.000Z";
    let time = Date.parse(expiry) - 1000;
    const { response } = await run212PriorVerificationFailure({ expiresAt: expiry, clock: () => time,
      onFailure: () => { time = Date.parse(expiry); } });
    assert.equal(response.status, 502);
    for (const header of Object.values(LATTICE_QUALIFICATION_PRIOR_VERIFICATION_REJECTION_RESPONSE_HEADERS)) {
      assert.equal(response.headers.has(header), false, header);
    }
  });
});

test("the prior verifier rejection validator rejects malformed, inconsistent, and executable evidence without reading accessors", () => {
  const base = { boundary: "wire-decoder", category: "field-set", rule: "V01F" };
  assert.equal(isClosedPriorVerificationRejection(Object.freeze(base)), true);
  assert.equal(isClosedPriorVerificationRejection(Object.freeze({ boundary: "host-normalizer", category: "other", rule: "unknown" })), true);
  let getterReads = 0;
  const accessor = { ...base };
  Object.defineProperty(accessor, "rule", { enumerable: true, get() { getterReads += 1; return "V01F"; } });
  Object.freeze(accessor);
  const hidden = { ...base };
  Object.defineProperty(hidden, "rule", { enumerable: false });
  Object.freeze(hidden);
  const { proxy, revoke } = Proxy.revocable(base, {}); revoke();
  const invalid = [
    null, undefined, [], { ...base }, Object.freeze({ ...base, detail: "PRIVATE-RUN212" }),
    Object.freeze({ ...base, [Symbol("private")]: "PRIVATE-RUN212" }),
    Object.freeze(Object.assign(Object.create({}), base)), accessor, hidden, proxy,
    Object.freeze({ boundary: "wire-decoder", category: "field-set" }),
    Object.freeze({ ...base, rule: "PRIVATE-RUN212" }),
    Object.freeze({ ...base, rule: "C01F" }),
    Object.freeze({ ...base, category: "coverage", rule: "A03" }),
    Object.freeze({ ...base, category: "coverage" }),
    Object.freeze({ ...base, boundary: "host-normalizer" }),
    Object.freeze({ boundary: "host-normalizer", category: "field-set", rule: "unknown" }),
    Object.freeze({ boundary: "unknown", category: "other", rule: "unknown" }),
  ];
  for (const value of invalid) assert.equal(isClosedPriorVerificationRejection(value), false);
  assert.equal(getterReads, 0);
});


test("authentic D14 reconciles a complete corrected verifier before bounded material repair", async (context) => {
  const repairText = "A guest sets a blue notebook on the desk, reviews the first page, then shuts it.";
  const rejectedDraft = LATTICE_PRODUCTION_CANARY_TEXT.slice(0, -1).toUpperCase();
  const issueChecks = VERIFICATION_SCHEMA.properties.issues.items.properties.check.enum;
  for (const [name, decision, localIssue] of [
    ["accept", 0, false], ["repair", 1, false], ["reject", 2, false], ["local materiality issue", 1, true],
  ]) for (const copiedRepair of [false, true]) {
    await context.test(`${name}, ${copiedRepair ? "copied repair withheld" : "real repair certified"}`, async () => {
      const calls = []; let drafts = 0; let verifies = 0; let certificates = 0; let repairFeedback = null;
      const worker = createLatticeApiWorker({ fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body); calls.push(body);
        if (isAnalysisBody(body)) {
          const wire = canaryAnalysisWire(body);
          wire.p[0][2] = [[1, 0, 1, [0]], [1, 0, 1, [1, 2]]];
          return successfulProviderResponse(wire);
        }
        if (isCandidateBody(body)) {
          drafts += 1;
          if (drafts === 2) {
            const payload = inertModelPayload(body);
            repairFeedback = payload.verification;
            assert.equal(Object.hasOwn(payload, "rejectedCandidate"), false);
            assert.equal(payload.sourcePassages[0][1], LATTICE_PRODUCTION_CANARY_TEXT.slice(0, -1));
            assert.equal(JSON.stringify(body).includes(rejectedDraft), false,
              "the presentation-only rejected draft must not anchor the repair request");
            assert.deepEqual(payload.deterministicFindings.map(({ id }) => id), ["candidate-not-material"]);
            assert.equal(body.model, LATTICE_REMOTE_MODELS.generator);
            assert.equal(body.max_tokens, LATTICE_PROVIDER_OUTPUT_TOKEN_LIMITS.repair);
          }
          return successfulProviderResponse(canaryCandidateFromProviderBody(body,
            drafts === 1 ? rejectedDraft : copiedRepair ? LATTICE_PRODUCTION_CANARY_TEXT.slice(0, -1) : repairText));
        }
        if (isVerificationBody(body)) {
          verifies += 1;
          const wire = canaryVerificationWire(body);
          wire.p["0"].x = "10";
          wire.p["0"].y = verifies === 1 ? "000" : "100";
          assert.equal(wire.p["0"].f, "000000000", "model never echoes materiality failure in its mask");
          if (verifies <= 2) wire.d = verifies === 1 ? 1 : decision;
          if (verifies === 2 && localIssue) wire.i = [{ c: issueChecks.indexOf("materiality"), p: 0 }];
          if (verifies === 2) {
            assert.equal(inertModelPayload(body).retry, "private-verification-wire-invalid");
            assert.match(body.messages[0].content, /Rebuild layer support from the source/u);
          }
          assert.equal(body.max_tokens, 2048);
          return successfulProviderResponse(wire);
        }
        certificates += 1;
        assert.equal(copiedRepair, false, "a copied repair must not certify");
        const payload = inertModelPayload(body);
        return successfulProviderResponse(acceptingCertificationWire(payload.certificateId, payload.obligationIds));
      } });
      const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST), { HF_TOKEN: "server-token" });
      const envelope = await json(response);
      assert.equal(response.status, 200);
      assert.equal(drafts, 2, "the valid corrected review must reach exactly one material repair");
      assert.equal(verifies, 3);
      assert.equal(repairFeedback[0], decision === 2 ? "reject" : "repair");
      assert.deepEqual(repairFeedback[2][0][4], ["materiality"], "host-proved failure must reach repair feedback");
      assert.equal(certificates, copiedRepair ? 0 : 1);
      assert.equal(calls.filter(isAnalysisBody).length, 1, "pure D14 must not require structural reanalysis");
      assert.equal(calls.length, copiedRepair ? 6 : 7);
      assert.equal(envelope.result.status === "translated", !copiedRepair);
      assert.equal(envelope.result.text, copiedRepair ? null : `${repairText}\n`);
      assert.equal(envelope.result.verificationPasses, copiedRepair ? 0 : 2);
      const verifyBodies = calls.filter(isVerificationBody);
      assert.deepEqual(fittedVerificationSchemaForBody(verifyBodies[0]), fittedVerificationSchemaForBody(verifyBodies[1]));
      for (const body of verifyBodies.slice(0, 2)) {
        assert.deepEqual(inertModelPayload(body).deterministicFindings.map(({ id }) => id), ["candidate-not-material"]);
        assert.doesNotMatch(JSON.stringify(body), /V17M|D14|decision-consistency/u);
      }
    });
  }
});

test("D14 reconciliation cannot validate unsupported issues, absent host failures, or invalid masks", async (context) => {
  const repairText = "A guest sets a blue notebook on the desk, reviews the first page, then shuts it.";
  const issueChecks = VERIFICATION_SCHEMA.properties.issues.items.properties.check.enum;
  for (const failure of ["no D14", "global materiality issue", "unrelated local issue", "truncated support mask"]) {
    await context.test(failure, async () => {
      let drafts = 0; let verifies = 0; const calls = [];
      const worker = createLatticeApiWorker({ fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body); calls.push(body);
        if (isAnalysisBody(body)) return successfulProviderResponse(canaryAnalysisWire(body));
        if (isCandidateBody(body)) {
          drafts += 1;
          assert.equal(drafts, 1, "invalid corrected reviews cannot start repair");
          return successfulProviderResponse(canaryCandidateFromProviderBody(body,
            failure === "no D14" ? repairText : LATTICE_PRODUCTION_CANARY_TEXT.slice(0, -1)));
        }
        assert.equal(isVerificationBody(body), true, "invalid corrected reviews cannot certify");
        verifies += 1;
        const wire = canaryVerificationWire(body); wire.d = 1;
        if (verifies === 1) wire.p["0"].y = "000";
        else if (failure === "truncated support mask") wire.p["0"].y = "1";
        if (verifies === 2 && failure === "global materiality issue") wire.i = [{ c: issueChecks.indexOf("materiality"), p: -1 }];
        if (verifies === 2 && failure === "unrelated local issue") wire.i = [{ c: issueChecks.indexOf("clarity"), p: 0 }];
        return successfulProviderResponse(wire);
      } });
      const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST), { HF_TOKEN: "server-token" });
      const envelope = await json(response);
      assert.equal(response.status, 200);
      assert.equal(envelope.result.text, null);
      assert.notEqual(envelope.result.status, "translated");
      assert.equal(envelope.result.verificationPasses, 0);
      assert.equal(drafts, 1); assert.equal(verifies, 2); assert.equal(calls.length, 4);
    });
  }
});


function applyEmptySupportRegressionFailure(wire, failure) {
  if (failure === "V16M") wire.p["0"].x = "0".repeat(wire.p["0"].x.length);
  else if (failure === "V17M") wire.p["0"].y = "0".repeat(wire.p["0"].y.length);
  else if (failure === "V01F") delete wire.i;
  else if (failure === "V17L") wire.p["0"].y = "1";
  else if (failure === "V14LE") wire.p["0"].f = "";
  else if (failure === "V14LS") wire.p["0"].f = wire.p["0"].f.slice(0, -1);
  else if (failure === "V14LG") wire.p["0"].f += "0";
  else if (failure === "V19") wire.p["0"].c.v = true;
  else if (failure === "V24O") wire.i = [null];
  else if (failure === "host issue") {
    wire.d = 1;
    wire.i = [{ c: VERIFICATION_SCHEMA.properties.issues.items.properties.check.enum.indexOf("clarity"), p: 0 }];
  } else if (failure === "structural") {
    // The selected atom has evidence span 0 only. Span 1 exists but does not ground it.
    wire.p["0"].x = "10";
    wire.p["0"].y = "010";
  } else assert.equal(failure, null, `unexpected regression failure ${failure}`);
}

async function runEmptySupportMaterialRepair({
  first = "V16M", second = "V17M", hasD14 = true, copiedRepair = false,
  freshFailure = null, brokenRepair = false,
} = {}) {
  const repairText = "A guest sets a blue notebook on the desk, reviews the first page, then shuts it.";
  const calls = []; const verifyResults = []; const repairRequests = [];
  let drafts = 0; let verifies = 0; let certificates = 0;
  const worker = createLatticeApiWorker({
    createAdapter(options) {
      const adapter = createHuggingFaceLatticeAdapter(options);
      return Object.freeze({ ...adapter,
        async verify(request) {
          const result = await adapter.verify(request);
          verifyResults.push(result);
          return result;
        },
        async repair(request) { repairRequests.push(request); return adapter.repair(request); },
      });
    },
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body); calls.push(body);
      if (isAnalysisBody(body)) {
        const wire = canaryAnalysisWire(body);
        wire.p[0][2] = [[1, 0, 1, [0]], [1, 0, 1, [1, 2]]];
        return successfulProviderResponse(wire);
      }
      if (isCandidateBody(body)) {
        drafts += 1;
        if (drafts > 1) {
          assert.equal(inertModelPayload(body).verification, null,
            "unavailable independent review must not become invented semantic feedback");
          if (brokenRepair) return successfulProviderResponse({ passages: [] });
        }
        return successfulProviderResponse(canaryCandidateFromProviderBody(body,
          hasD14 && (drafts === 1 || copiedRepair) ? LATTICE_PRODUCTION_CANARY_TEXT.slice(0, -1) : repairText));
      }
      if (isVerificationBody(body)) {
        verifies += 1;
        const wire = canaryVerificationWire(body);
        wire.p["0"].x = "10";
        wire.p["0"].y = "100";
        applyEmptySupportRegressionFailure(wire, verifies === 1 ? first : verifies === 2 ? second : freshFailure);
        assert.equal(body.max_tokens, 2048);
        assert.equal(body.response_format.type, "json_schema");
        fittedVerificationSchemaForBody(body);
        return successfulProviderResponse(wire);
      }
      certificates += 1;
      assert.equal(copiedRepair || brokenRepair || freshFailure !== null, false,
        "unproved or nonmaterial repairs cannot enter certification");
      assert.equal(body.response_format?.json_schema?.name ?? body.tool_choice.function.name, CERTIFICATION_TOOL_NAME);
      assert.equal(body.max_tokens, 520);
      const payload = inertModelPayload(body);
      return successfulProviderResponse(acceptingCertificationWire(payload.certificateId, payload.obligationIds));
    },
  });
  const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST, { headers: {
    [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  } }), { HF_TOKEN: "server-token", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-10-03T14:00:00.000Z" });
  const envelope = await json(response);
  return { response, envelope, calls, drafts, verifies, certificates, repairRequests, verifyResults, repairText };
}

function assertRetainedEmptySupportPair(result, first, second) {
  // The adapter returns identity-tagged rejected results; normalization in
  // the engine creates the later errors. Keep the original result evidence.
  assert.deepEqual(rejectedResultDiagnostic(result.verifyResults[0]),
    { boundary: "wire-decoder", category: "coverage", rule: first });
  assert.deepEqual(rejectedResultDiagnostic(result.verifyResults[1]),
    { boundary: "wire-decoder", category: "coverage", rule: second });
  for (const value of result.verifyResults.slice(0, 2)) {
    assert.equal(rejectedResultDiagnostic({ ...value }), null,
      "copied properties must not become original rejection evidence");
  }
}

const EMPTY_SUPPORT_REGRESSION_PAIRS = [
  ["V16M", "V16M"], ["V16M", "V17M"], ["V17M", "V16M"], ["V17M", "V17M"],
];

test("two genuine empty-support rejections may spend the existing D14 repair only with fresh verification", async (context) => {
  for (const [first, second] of EMPTY_SUPPORT_REGRESSION_PAIRS) for (const copiedRepair of [false, true]) {
    await context.test(`${first}/${second}: ${copiedRepair ? "copied repair withheld" : "real repair certified"}`, async () => {
      const result = await runEmptySupportMaterialRepair({ first, second, copiedRepair });
      const { response, envelope, calls, drafts, verifies, certificates, repairRequests, repairText } = result;
      assert.equal(response.status, 200);
      assert.equal(drafts, 2, "one existing material repair, no added candidate cycle");
      assert.equal(repairRequests.length, 1);
      assert.equal(repairRequests[0].verification, null);
      assert.equal(Object.isFrozen(repairRequests[0]), true);
      assert.deepEqual(repairRequests[0].deterministicFindings.map(({ id }) => id), ["candidate-not-material"]);
      assert.equal(verifies, 3, "the repaired candidate requires a fresh complete review");
      assert.equal(certificates, copiedRepair ? 0 : 1);
      assert.equal(calls.filter(isAnalysisBody).length, 1, "pure host D14 does not re-atomize");
      assert.equal(calls.length, copiedRepair ? 6 : 7);
      assert.equal(envelope.result.status === "translated", !copiedRepair);
      assert.equal(envelope.result.text, copiedRepair ? null : `${repairText}\n`);
      assert.equal(envelope.result.verificationPasses, copiedRepair ? 0 : 2);
      const verifyBodies = calls.filter(isVerificationBody);
      for (const body of verifyBodies) {
        const schema = fittedVerificationSchemaForBody(body).properties.p.properties["0"].properties;
        assert.equal(fittedStringLength(schema.x), 2);
        assert.equal(fittedStringLength(schema.x), 2);
        assert.equal(fittedStringLength(schema.y), 3);
        assert.equal(fittedStringLength(schema.y), 3);
        assert.equal(schema.x.pattern, "^(?:0{0}1[01]{1}|0{1}1[01]{0})$");
        assert.equal(schema.y.pattern, "^(?:0{0}1[01]{2}|0{1}1[01]{1}|0{2}1[01]{0})$");
        assert.doesNotMatch(JSON.stringify(body), /V16M|V17M|D14|decision-consistency/u);
      }
      assert.deepEqual(fittedVerificationSchemaForBody(verifyBodies[0]), fittedVerificationSchemaForBody(verifyBodies[1]));
      assert.deepEqual(fittedVerificationSchemaForBody(verifyBodies[0]), fittedVerificationSchemaForBody(verifyBodies[2]));
      assert.equal(inertModelPayload(verifyBodies[1]).retry, "private-verification-wire-invalid");
      assert.equal(Object.hasOwn(inertModelPayload(verifyBodies[2]), "retry"), false,
        "a new candidate must not inherit the old candidate's correction attempt");
      assert.equal(Boolean(inertModelPayload(verifyBodies[2]).deterministicFindings?.length), copiedRepair);
      assertRetainedEmptySupportPair(result, first, second);
    });
  }
});

test("empty-support recovery never accepts invalid fresh masks or a structural fresh rejection", async (context) => {
  for (const freshFailure of ["V16M", "V17M", "V17L", "host issue", "structural"]) {
    await context.test(freshFailure, async () => {
      const result = await runEmptySupportMaterialRepair({ freshFailure });
      assert.equal(result.response.status, 200);
      assert.notEqual(result.envelope.result.status, "translated");
      assert.equal(result.envelope.result.text, null);
      assert.equal(result.envelope.result.verificationPasses, 0);
      assert.equal(result.drafts, 2, "no second repair after the single recovery");
      assert.equal(result.repairRequests.length, 1);
      assert.equal(result.calls.filter(isAnalysisBody).length, 1, "no new reanalysis loop after this repair");
      assert.equal(result.verifies, freshFailure === "structural" ? 3 : 4);
      assert.equal(result.calls.length, freshFailure === "structural" ? 6 : 7);
      assert.equal(result.certificates, 0);
      assertRetainedEmptySupportPair(result, "V16M", "V17M");
      if (freshFailure !== "structural") {
        assert.equal(result.response.headers.get(LATTICE_QUALIFICATION_WITHHELD_DIAGNOSTIC_RESPONSE_HEADERS.failureCause), "multiple",
          "original verification and failed reverification are distinct retained failures");
        assert.equal(result.response.headers.get(LATTICE_QUALIFICATION_WITHHELD_DIAGNOSTIC_RESPONSE_HEADERS.firstDeterministicRule), "D14",
          "failed fresh verification restores the original candidate lineage");
      }
    });
  }
});

test("failed material recovery preserves the first empty-support rejection and does not invent a verifier result", async (context) => {
  for (const [first, second] of EMPTY_SUPPORT_REGRESSION_PAIRS) {
    await context.test(`${first}/${second}`, async () => {
      const result = await runEmptySupportMaterialRepair({ first, second, brokenRepair: true });
      assert.equal(result.response.status, 200);
      assert.notEqual(result.envelope.result.status, "translated");
      assert.equal(result.envelope.result.text, null);
      assert.equal(result.envelope.result.verificationPasses, 0);
      assert.equal(result.drafts, 3, "one initial candidate and two existing bounded normalization attempts within one repair");
      assert.equal(result.repairRequests.length, 2);
      assert.ok(result.repairRequests.every(({ verification }) => verification === null));
      assert.equal(result.verifies, 2, "no candidate was produced for independent reverification");
      assert.equal(result.certificates, 0);
      assert.equal(result.calls.length, 6);
      assert.equal(result.calls.filter(isAnalysisBody).length, 1);
      assertRetainedEmptySupportPair(result, first, second);
      for (const [field, value] of Object.entries({
        verification: "unavailable", firstDeterministicRule: "D14", failureCause: "multiple", stage: "multiple",
      })) assert.equal(result.response.headers.get(LATTICE_QUALIFICATION_WITHHELD_DIAGNOSTIC_RESPONSE_HEADERS[field]), value, field);
    });
  }
});

test("empty-support recovery requires an actual host D14 and two failures from the eligible decoder family", async (context) => {
  for (const [first, second] of EMPTY_SUPPORT_REGRESSION_PAIRS) {
    await context.test(`no host D14: ${first}/${second}`, async () => {
      const result = await runEmptySupportMaterialRepair({ first, second, hasD14: false });
      assert.equal(result.response.status, 200);
      assert.equal(result.envelope.result.text, null);
      assert.equal(result.envelope.result.verificationPasses, 0);
      assert.equal(result.drafts, 1);
      assert.equal(result.verifies, 2);
      assert.equal(result.certificates, 0);
      assert.equal(result.repairRequests.length, 0);
      assert.equal(result.calls.length, 4);
    });
  }
  for (const support of ["V16M", "V17M"]) {
    for (const other of ["V01F", "V17L", "V14LE", "V14LS", "V14LG", "V19", "V24O", "host issue"]) {
      for (const [first, second] of [[support, other], [other, support]]) {
        await context.test(`ineligible pair: ${first}/${second}`, async () => {
          const result = await runEmptySupportMaterialRepair({ first, second });
          assert.equal(result.response.status, 200);
          assert.equal(result.envelope.result.text, null);
          assert.equal(result.envelope.result.verificationPasses, 0);
          assert.equal(result.drafts, 1);
          assert.equal(result.verifies, 2);
          assert.equal(result.certificates, 0);
          assert.equal(result.repairRequests.length, 0);
          assert.equal(result.calls.length, 4);
        });
      }
    }
  }
});


test("finite passage-check width observations preserve legacy correction request bytes", async () => {
  const base = minimalVerificationRequest();
  const bodies = [];
  for (const rule of ["V14L", "V14LE", "V14LS", "V14LG"]) {
    const request = Object.freeze({ ...base, protocolFeedback: Object.freeze({ attempt: 2 }) });
    const error = new Error("The verifier returned an invalid decision.");
    rememberRejectedError(error, Object.freeze({ boundary: "wire-decoder", category: "value-domain", rule }));
    rememberStageCorrectionRequest(request, error);
    const adapter = createHuggingFaceLatticeAdapter({ token: "server-token", fetchImpl: async (_url, init) => {
      bodies.push(init.body);
      return successfulProviderResponse(acceptingVerificationWire(request));
    } });
    assert.equal((await adapter.verify(request)).decision, "accept");
    assert.equal(adapter.completionCapacity().used, 1);
  }
  assert.equal(new Set(bodies).size, 1, "the retained legacy rule and all refinements produce exactly the same serialized request");
  const body = JSON.parse(bodies[0]);
  assert.equal(body.max_tokens, 2048);
  assert.match(body.messages[0].content, /Rebuild every bit or digit string by enumerating all supplied ordered positions/u);
  assert.equal(inertModelPayload(body).retry, "private-verification-wire-invalid");
  assert.doesNotMatch(bodies[0], /V14L|value-domain|diagnostic/u);
  fittedVerificationSchemaForBody(body);
});


test("fixed provider transport is selected by actual stage and cannot be changed by request fields", async (context) => {
  const verification = minimalVerificationRequest();
  const hostile = {
    endpoint: "https://attacker.invalid/collect", providerEndpoint: "https://attacker.invalid/collect",
    providerUrl: "https://attacker.invalid/collect", url: "https://attacker.invalid/collect",
    model: "PRIVATE-CALLER-MODEL", providerModel: "PRIVATE-CALLER-MODEL", provider: "PRIVATE-CALLER-PROVIDER",
    stage: "verification", role: "verifier", transport: "PRIVATE-CALLER-TRANSPORT",
    token: "PRIVATE-CALLER-TOKEN", headers: { Authorization: "PRIVATE-CALLER-AUTH" },
  };
  const cases = [
    ["analysis", "analyze", minimalAnalysisRequest(), HUGGING_FACE_CHAT_COMPLETIONS_URL, LATTICE_REMOTE_MODELS.generator, "json_schema"],
    ["candidate", "generate", verification, HUGGING_FACE_CHAT_COMPLETIONS_URL, LATTICE_REMOTE_MODELS.generator, "json_object"],
    ["verification", "verify", verification, TEST_REVIEW_URL, TEST_REVIEW_MODEL, "json_schema"],
    ["certification", "certify", minimalCertificationRequest(), HUGGING_FACE_CHAT_COMPLETIONS_URL, LATTICE_REMOTE_MODELS.verifier, "json_schema"],
    ["repair", "repair", { ...verification, verification: null }, HUGGING_FACE_CHAT_COMPLETIONS_URL, LATTICE_REMOTE_MODELS.generator, "json_object"],
  ];
  for (const [stage, method, request, endpoint, model, format] of cases) await context.test(stage, async () => {
    let calls = 0;
    const adapter = createHuggingFaceLatticeAdapter({ token: "trusted-server-token", fetchImpl: async (url, init) => {
      calls += 1;
      assert.equal(url, endpoint);
      assert.equal(init.headers.Authorization, "Bearer trusted-server-token");
      assert.equal(init.method, "POST");
      assert.equal(init.redirect, "manual");
      assert.equal(init.credentials, "omit");
      assert.equal(init.cache, "no-store");
      assert.equal(init.referrerPolicy, "no-referrer");
      const body = JSON.parse(init.body);
      assert.equal(body.model, model);
      assert.doesNotMatch(init.body, /PRIVATE-CALLER|attacker\.invalid/u);
      if (stage === "certification") {
        strictReviewSchema(body, CERTIFICATION_TOOL_NAME);
        assert.equal(body.max_tokens, 520);
        return successfulProviderResponse(acceptingCertificationWire(request.certificateId, request.obligationIds));
      }
      assert.equal(body.response_format.type, format);
      if (stage === "verification") {
        fittedVerificationSchemaForBody(body);
        assert.equal(body.max_tokens, 2048);
        return successfulProviderResponse(acceptingVerificationWire(request));
      }
      return successfulProviderResponse({});
    } });
    await adapter[method]({ ...request, ...hostile });
    assert.equal(calls, 1);
    assert.deepEqual(adapter.completionCapacity(), { used: 1, limit: 32, remaining: 31 });
  });
});

test("legacy content helper options cannot select a route or model outside fixed role selectors", async (context) => {
  for (const [label, overrides, url, model, format] of [
    ["generic generator JSON", {}, HUGGING_FACE_CHAT_COMPLETIONS_URL, LATTICE_REMOTE_MODELS.generator, "json_object"],
    ["generic generator strict", { responseFormat: "json_schema" }, HUGGING_FACE_CHAT_COMPLETIONS_URL, LATTICE_REMOTE_MODELS.generator, "json_schema"],
    ["verifier without opt-in", { role: "verifier", schemaName: VERIFICATION_TOOL_NAME, responseFormat: "json_object" }, HUGGING_FACE_CHAT_COMPLETIONS_URL, LATTICE_REMOTE_MODELS.verifier, "json_object"],
    ["verifier false opt-in", { role: "verifier", schemaName: VERIFICATION_TOOL_NAME, responseFormat: "json_object", requireMinimalVerificationContent: false }, HUGGING_FACE_CHAT_COMPLETIONS_URL, LATTICE_REMOTE_MODELS.verifier, "json_object"],
    ...["json_object", "json_schema"].map((responseFormat) => [
      `dedicated ${responseFormat}`, { role: "verifier", schemaName: VERIFICATION_TOOL_NAME,
        responseFormat, requireMinimalVerificationContent: true },
      TEST_REVIEW_URL, TEST_REVIEW_MODEL, responseFormat,
    ]),
  ]) await context.test(label, async () => {
    let calls = 0;
    const options = providerRequestOptions(async (actualUrl, init) => {
      calls += 1;
      assert.equal(actualUrl, url);
      const body = JSON.parse(init.body);
      assert.equal(body.model, model);
      assert.equal(body.response_format.type, format);
      if (format === "json_schema") {
        assert.equal(body.response_format.json_schema.strict, true);
        assert.deepEqual(body.response_format.json_schema.schema, options.schema);
        assert.doesNotMatch(body.messages.map(({ content }) => content).join("\n"), /LATTICE_RESPONSE_SCHEMA/u);
      } else {
        assert.deepEqual(body.response_format, { type: "json_object" });
      }
      return successfulProviderResponse({ accepted: true });
    }, overrides);
    assert.deepEqual(await requestHuggingFaceJson(options), { accepted: true });
    assert.equal(calls, 1);
  });
});

test("a provider response must match the unified URL and rejects the retired DeepInfra route", async (context) => {
  const verification = minimalVerificationRequest();
  const certification = minimalCertificationRequest();
  for (const [stage, request, selected, alternate] of [
    ["verify", verification, TEST_REVIEW_URL, "https://router.huggingface.co/deepinfra/v1/openai/chat/completions"],
    ["certify", certification, HUGGING_FACE_CHAT_COMPLETIONS_URL, "https://router.huggingface.co/deepinfra/v1/openai/chat/completions"],
  ]) for (const [name, responseUrl, accepted] of [
    ["exact", selected, true],
    ["retired DeepInfra route", alternate, false],
    ["query suffix", `${selected}?route=other`, false],
    ["foreign host", "https://attacker.invalid/collect", false],
  ]) await context.test(`${stage}: ${name}`, async () => {
    let calls = 0;
    const adapter = createHuggingFaceLatticeAdapter({ token: "server-token", fetchImpl: async (url) => {
      calls += 1;
      assert.equal(url, selected);
      const response = stage === "verify"
        ? successfulProviderResponse(acceptingVerificationWire(request))
        : successfulProviderResponse(acceptingCertificationWire(request.certificateId, request.obligationIds));
      Object.defineProperty(response, "url", { value: responseUrl });
      return response;
    } });
    if (accepted) await adapter[stage](request);
    else await assert.rejects(adapter[stage](request), (error) => error instanceof LatticeProviderError
      && error.code === "provider_redirect");
    assert.equal(calls, 1, "a route mismatch must not redirect, retry, or fall back");
  });
});

test("strict verification preserves safe explicit content-envelope opt-ins and strict generic defaults", async (context) => {
  for (const compatibility of [false, true]) for (const [name, extras] of [
    ["minimal", {}], ["empty calls", { tool_calls: [] }], ["null calls", { tool_calls: null }],
    ["null metadata", { name: null, reasoning_content: null }],
  ]) await context.test(`${compatibility ? "explicit compatibility" : "strict default"}: ${name}`, async () => {
    let calls = 0;
    const options = providerRequestOptions(async () => {
      calls += 1;
      return providerChoiceResponse({ finish_reason: "stop", message: {
        role: "assistant", content: JSON.stringify({ accepted: true }), ...extras,
      } });
    }, { role: "verifier", schemaName: VERIFICATION_TOOL_NAME, responseFormat: "json_schema",
      requireMinimalVerificationContent: true,
      ...(compatibility ? { allowEmptyStoppedToolCalls: true, allowNullStoppedVerificationMetadata: true,
        allowNullJsonObjectVerificationToolCalls: true } : {}),
    });
    if (compatibility || name === "minimal") assert.deepEqual(await requestHuggingFaceJson(options), { accepted: true });
    else await assert.rejects(requestHuggingFaceJson(options), (error) => error instanceof LatticeProviderError
      && error.code === "provider_malformed_response");
    assert.equal(calls, 1);
  });
});

test("pipeline headers bind actual withheld lineage and cannot be forged or outlive qualification", async () => {
  const active = { HF_TOKEN: "test-only", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z" };
  const marked = { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v18" };
  const run = async ({ regeneration = false, repairCorrection = false, retentionDowngrade = false, headers = marked, env = active, clone = false, duplicate = false, expiresDuring = false } = {}) => {
    const bodies = [];
    let verifies = 0;
    let drafts = 0;
    let instant = Date.parse("2026-10-05T12:00:00.000Z");
    const worker = createLatticeApiWorker({ now: () => instant,
      runTextToLatticeImpl: (source, options) => runTextToLattice(source, { ...options,
        onCandidateWithheldDiagnostic: (trace) => {
          if (expiresDuring) instant += 20_000;
          options.onCandidateWithheldDiagnostic?.(clone ? Object.freeze({ ...trace }) : trace);
          if (duplicate) options.onCandidateWithheldDiagnostic?.(trace);
        },
      }),
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(init.body); bodies.push(body);
        if (isAnalysisBody(body)) {
          const wire = canaryAnalysisWire(body);
          if (retentionDowngrade) wire.p[0][1] = 1;
          return successfulProviderResponse(wire);
        }
        if (isCandidateBody(body)) {
          drafts += 1;
          if (repairCorrection && drafts === 2) return successfulProviderResponse({});
          return successfulProviderResponse(canaryCandidateFromProviderBody(body,
            LATTICE_PRODUCTION_CANARY_TEXT.slice(0, -1)));
        }
        assert.equal(isVerificationBody(body), true, "withheld copies cannot reach certification");
        const wire = canaryVerificationWire(body);
        if (regeneration && ++verifies === 1) { wire.d = 1; wire.g = "00010000000"; }
        return successfulProviderResponse(wire);
      },
    });
    const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST, { headers }), env);
    return { response, json: await json(response), bodies };
  };
  const downgraded = await run({ retentionDowngrade: true });
  assert.equal(downgraded.response.headers.get("X-Lattice-Qualification-Pipeline-Initial-Retention-Downgrade"), "present");
  assert.equal(downgraded.bodies.length, 6);
  assert.equal(downgraded.response.headers.get(LATTICE_QUALIFICATION_PIPELINE_DIAGNOSTIC_RESPONSE_HEADERS.retryPath), "regeneration");
  assert.equal(downgraded.response.headers.get(LATTICE_QUALIFICATION_PIPELINE_DIAGNOSTIC_RESPONSE_HEADERS.candidateLineage), "regeneration");
  const unmarkedDowngrade = await run({ retentionDowngrade: true, headers: {} });
  assert.deepEqual(unmarkedDowngrade.bodies, downgraded.bodies);
  assert.deepEqual(unmarkedDowngrade.json, downgraded.json);
  assert.equal(downgraded.json.result.text, null);
  const corrected = await run({ repairCorrection: true });
  assert.equal(corrected.response.headers.get(LATTICE_QUALIFICATION_PIPELINE_DIAGNOSTIC_RESPONSE_HEADERS.successfulCorrectionStage), "repair");
  assert.equal(corrected.bodies.length, 6);
  const correctedDraft = inertModelPayload(corrected.bodies.filter(isCandidateBody).at(-1));
  assert.equal(correctedDraft.retry, 2);
  assert.equal(Object.hasOwn(correctedDraft, "protocolFeedback"), false, "D12 leaves source-based correction feedback unchanged");
  for (const regeneration of [false, true]) {
    const qualified = await run({ regeneration });
    assert.equal(qualified.response.status, 200);
    assert.equal(qualified.json.result.status, "unable-to-attempt");
    assert.equal(qualified.json.result.text, null);
    const expected = { retryPath: regeneration ? "regeneration" : "repair",
      candidateLineage: regeneration ? "regeneration" : "repair", initialDeterministic: "d14-only", successfulCorrectionStage: "none", initialRetentionDowngrade: "none" };
    for (const [field, header] of Object.entries(LATTICE_QUALIFICATION_PIPELINE_DIAGNOSTIC_RESPONSE_HEADERS)) {
      assert.equal(qualified.response.headers.get(header), expected[field]);
    }
    assert.equal(qualified.bodies.length, regeneration ? 6 : 5);
    for (const body of qualified.bodies) {
      const system = body.messages.find(({ role }) => role === "system").content;
      assert.match(system, /Designated exact literals and annotations, direction controls, line, paragraph, stanza, isolate nesting are immutable/u);
      assert.doesNotMatch(system, /Exact text, direction controls/u);
    }
    const drafts = qualified.bodies.filter(isCandidateBody);
    assert.equal(Object.hasOwn(inertModelPayload(drafts[0]), "regenerationFeedback"), false);
    assert.deepEqual(inertModelPayload(drafts[1]).regenerationFeedback,
      regeneration ? { nonmaterialPassagePositions: [0] } : undefined);
    assert.equal(Object.hasOwn(inertModelPayload(drafts[1]), "rejectedCandidate"), false);
    if (!regeneration) {
      assert.deepEqual(inertModelPayload(drafts[1]).deterministicFindings.map(({ id }) => id), ["candidate-not-material"]);
      assert.equal(inertModelPayload(drafts[1]).verification[0], "repair");
    }
    for (const options of [{ clone: true }, { duplicate: true }, { headers: {} },
      { headers: { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v14" } },
      { headers: { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v15" } },
      { headers: { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v16" } },
      { env: { HF_TOKEN: "test-only" } },
      { expiresDuring: true, env: { ...active, [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2026-10-05T12:00:10.000Z" } }]) {
      const other = await run({ regeneration, ...options });
      if (options.expiresDuring) {
        assert.equal(other.response.status, 503);
        assert.deepEqual(other.json, { error: "upstream_unavailable" });
      } else assert.deepEqual(other.json, qualified.json);
      assert.deepEqual(other.bodies, qualified.bodies);
      for (const header of Object.values(LATTICE_QUALIFICATION_PIPELINE_DIAGNOSTIC_RESPONSE_HEADERS)) {
        assert.equal(other.response.headers.has(header), false);
      }
    }
    assert.doesNotMatch(JSON.stringify(qualified.json), /retryPath|candidateLineage|initialDeterministic|successfulCorrectionStage|regenerationFeedback/u);
  }
});


test("analysis retention observations require explicit enablement and a complete authenticated decode", async (context) => {
  const base = minimalAnalysisRequest(LATTICE_PRODUCTION_CANARY_TEXT);
  const request = { ...base, sourceSpans: latticeSourceSpansForBatch(base.batch) };
  const bytes = [];
  const run = async (enabled, alter = () => {}) => {
    const adapter = createHuggingFaceLatticeAdapter({ token: "test-only", requestedMode: "operative",
      ...(enabled === undefined ? {} : { observeQualificationRetentionDowngrade: enabled }),
      fetchImpl: async (_url, init) => {
        bytes.push(init.body);
        const wire = canaryAnalysisWire(JSON.parse(init.body)); alter(wire);
        return successfulProviderResponse(wire);
      },
    });
    return adapter.analyze(request);
  };
  const ordinary = await run(undefined);
  const disabled = await run(false);
  const observed = await run(true);
  assert.equal(getLatticeAnalysisRetentionDowngrade(ordinary), null);
  assert.equal(getLatticeAnalysisRetentionDowngrade(disabled), null);
  assert.equal(getLatticeAnalysisRetentionDowngrade(observed), "none");
  for (const value of [ordinary, disabled, observed]) {
    assert.equal(getLatticeAnalysisPassageRetentionDowngrade(value, value.passages[0], request.batch.passages[0]), false);
  }
  assert.deepEqual(observed, ordinary); assert.deepEqual(observed, disabled);
  assert.equal(new Set(bytes).size, 1, "observation changes no provider request bytes");
  for (const [name, masks, expected, disposition] of [
    ["empty criterion", ["000", "111", "111", "111", "111"], "present", "rewrite"],
    ["incomplete union", ["100", "100", "100", "100", "100"], "present", "rewrite"],
    ["complete retention", ["100", "010", "001", "111", "101"], "none", "retain-if-conformant"],
  ]) await context.test(name, async () => {
    const value = await run(true, (wire) => { wire.p[0][1] = 1; wire.p[0][3] = masks; });
    assert.equal(value.passages[0].disposition, disposition);
    assert.equal(getLatticeAnalysisRetentionDowngrade(value), expected);
    assert.equal(getLatticeAnalysisRetentionDowngrade({ ...value }), null);
    assert.equal(getLatticeAnalysisRetentionDowngrade(new Proxy(value, {})), null);
    assert.equal(Object.hasOwn(value, "initialRetentionDowngrade"), false);
    assert.equal(getLatticeAnalysisPassageRetentionDowngrade(value, value.passages[0], request.batch.passages[0]), expected === "present");
    const unobserved = await run(false, (wire) => { wire.p[0][1] = 1; wire.p[0][3] = masks; });
    assert.equal(getLatticeAnalysisRetentionDowngrade(unobserved), null);
    assert.equal(getLatticeAnalysisPassageRetentionDowngrade(unobserved, unobserved.passages[0], request.batch.passages[0]), expected === "present");
    assert.deepEqual(unobserved, value);
  });
  const rejected = await run(true, (wire) => { wire.p[0][1] = 1; wire.p[0][3][0] = "PRIVATE"; });
  assert.deepEqual(rejected, {});
  assert.equal(getLatticeAnalysisRetentionDowngrade(rejected), null);
  assert.equal(getLatticeAnalysisPassageRetentionDowngrade(rejected, observed.passages[0], request.batch.passages[0]), null);
  for (const invalid of [null, 0, 1, "true"]) {
    assert.throws(() => createHuggingFaceLatticeAdapter({ observeQualificationRetentionDowngrade: invalid }));
  }
});

test("always-on downgraded-retention recovery preserves fixed stages and fresh acceptance with diagnostics off", async (context) => {
  for (const retain of [false, true]) await context.test(retain ? "fresh complete conformance" : "material regeneration", async () => {
    const run = async (marked) => {
      const bodies = [];let analyses = 0,drafts = 0,reviews = 0;
      const worker = createLatticeApiWorker({ fetchImpl: async (url, init) => {
        assert.equal(url, HUGGING_FACE_CHAT_COMPLETIONS_URL);
        const body = JSON.parse(init.body);bodies.push(body);let wire;
        assert.ok(body.max_tokens <= 2048);assert.equal(Object.hasOwn(body, "tools"), false);
        if (isAnalysisBody(body)) {
          analyses += 1;assert.equal(body.model, LATTICE_REMOTE_MODELS.generator);
          wire = canaryAnalysisWire(body, { retain: retain && analyses === 2 });
          if (analyses === 1) wire.p[0][1] = 1;
          else {
            const feedback = inertModelPayload(body).reanalysisFeedback;
            assert.ok(feedback);assert.ok(JSON.stringify(feedback).includes("repair"));
          }
        } else if (isCandidateBody(body)) {
          drafts += 1;assert.equal(body.model, LATTICE_REMOTE_MODELS.generator);assert.equal(body.max_tokens, 800);
          const payload = inertModelPayload(body);
          assert.equal(Object.hasOwn(payload, "rejectedCandidate"), false);
          assert.deepEqual(payload.regenerationFeedback, drafts === 2 && !retain ? { nonmaterialPassagePositions: [0] } : undefined);
          wire = canaryCandidateFromProviderBody(body, drafts === 1 || retain ? LATTICE_PRODUCTION_CANARY_TEXT.slice(0, -1)
            : "A guest sets a blue notebook on the desk, reviews the first page, then shuts it.");
        } else if (isVerificationBody(body)) {
          reviews += 1;assert.equal(body.model, LATTICE_REMOTE_MODELS.verifier);assert.equal(body.max_tokens, 2048);
          assert.equal(body.response_format.json_schema.strict, true);
          wire = canaryVerificationWire(body, { retain: retain && reviews === 2 });
        } else {
          assert.equal(body.response_format.json_schema.name, CERTIFICATION_TOOL_NAME);
          assert.equal(body.response_format.json_schema.strict, true);
          assert.equal(body.model, LATTICE_REMOTE_MODELS.verifier);assert.equal(body.max_tokens, 520);
          const payload = inertModelPayload(body);wire = acceptingCertificationWire(payload.certificateId, payload.obligationIds);
        }
        return successfulProviderResponse(wire);
      } });
      const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST, { headers: marked
        ? { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: "v18" } : {} }),
      { HF_TOKEN: "test-only", [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: "2099-09-17T12:00:00.000Z" });
      assert.equal(response.status, 200);assert.equal(analyses, 2);assert.equal(drafts, 2);assert.equal(reviews, 2);
      return { json: await json(response), bodies };
    };
    const ordinary = await run(false), observed = await run(true);
    assert.equal(ordinary.json.result.status, retain ? "conformant-for-context" : "translated");
    assert.equal(ordinary.bodies.length, 7);assert.deepEqual(observed.bodies, ordinary.bodies);assert.deepEqual(observed.json, ordinary.json);
  });
});

test("qualification admission observations prove zero dispatch on the covered bodyless setup", async () => {
  const instant = Date.parse("2026-10-05T12:00:00.000Z");
  const worker = createProductionLatticeApiWorker({ now: () => instant });
  const response = await worker.fetch(new Request(`${LATTICE_API_ORIGIN}${LATTICE_API_PATH}`, {
    method: "POST", headers: { Origin: LATTICE_API_ORIGIN, Accept: LATTICE_VISITOR_SESSION_ACCEPT,
      [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE },
  }), { VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
    [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: new Date(instant + 60_000).toISOString() });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("x-lattice-qualification-admission-status"), "complete");
  assert.equal(response.headers.get("x-lattice-qualification-admission-claim"), "not-called");
  assert.equal(response.headers.get("x-lattice-qualification-admission-order"), "not-called");
  assert.equal(response.headers.get("x-lattice-qualification-admission-provider"), "not-started");
});


function admissionHeaders(response) {
  return Object.fromEntries(Object.entries(LATTICE_QUALIFICATION_ADMISSION_RESPONSE_HEADERS)
    .map(([field, header]) => [field, response.headers.get(header)]));
}

const admissionUnavailable = Object.freeze({ status: "unavailable", claim: "unavailable", order: "unavailable", provider: "unavailable" });
const admissionNotCalled = Object.freeze({ status: "complete", claim: "not-called", order: "not-called", provider: "not-started" });

test("qualification admission observes the default full pipeline once without changing request bytes or public results", async () => {
  const run = async (marked) => {
    const instant = Date.parse("2026-10-05T12:00:00.000Z");const events = [], bodies = [];
    const visitor = await establishLatticeApiVisitor(new Headers(), TEST_VISITOR_SECRET);
    const worker = createProductionLatticeApiWorker({ now: () => instant,
      fetchImpl: async (_url, init) => {
        events.push("provider");const body = JSON.parse(init.body);bodies.push(body);let wire;
        if (isAnalysisBody(body)) wire = canaryAnalysisWire(body);
        else if (isCandidateBody(body)) wire = canaryCandidateFromProviderBody(body,
          "A guest sets a blue notebook on the desk, reviews the first page, then shuts it.");
        else if (isVerificationBody(body)) wire = canaryVerificationWire(body);
        else { const data = inertModelPayload(body);wire = acceptingCertificationWire(data.certificateId, data.obligationIds); }
        return successfulProviderResponse(wire);
      },
    });
    const response = await worker.fetch(apiRequest(LATTICE_PRODUCTION_CANARY_REQUEST, { headers: {
      Cookie: `${LATTICE_API_VISITOR_COOKIE_NAME}=${visitor.cookieValue}`,
      ...(marked ? { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE } : {}),
    } }), { HF_TOKEN: "test-only", VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
      LATTICE_API_RATE_LIMITER: { async limit() { events.push("edge");return { success: true }; } },
      LATTICE_TRANSFORMATION_BUDGET: { getByName(name) { assert.equal(name, LATTICE_TRANSFORMATION_CAPACITY_OBJECT_NAME);return {
        async fetch(request) { events.push("claim");assert.equal(request.url, LATTICE_TRANSFORMATION_CAPACITY_INTERNAL_URL);
          return Response.json({ allowed: true, schema_version: 1 }); },
      }; } },
      [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: new Date(instant + 60_000).toISOString(),
    });
    assert.equal(response.status, 200);const result = await json(response);assert.equal(result.result.status, "translated");
    assert.deepEqual(events, ["edge", "claim", "provider", "provider", "provider", "provider"]);
    return { result, bodies, headers: admissionHeaders(response) };
  };
  const ordinary = await run(false), marked = await run(true);
  assert.deepEqual(marked.result, ordinary.result);assert.deepEqual(marked.bodies, ordinary.bodies);
  assert.deepEqual(ordinary.headers, { status: null, claim: null, order: null, provider: null });
  assert.deepEqual(marked.headers, { status: "complete", claim: "allowed-once", order: "after-validation", provider: "after-admission" });
});

test("qualification admission covers missing and tampered cookies while earlier validation stays unobserved", async () => {
  const instant = Date.parse("2026-10-05T12:00:00.000Z");const worker = createProductionLatticeApiWorker({ now: () => instant });
  const env = { HF_TOKEN: "test-only", VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
    [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: new Date(instant + 60_000).toISOString() };
  const headers = { Origin: LATTICE_API_ORIGIN, Accept: "application/json", "Content-Type": "application/json",
    [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE };
  for (const [patch, status, observed] of [[{}, 428, true], [{ Cookie: `${LATTICE_API_VISITOR_COOKIE_NAME}=${TEST_VISITOR_COOKIE_VALUE}` }, 403, true],
    [{ Cookie: "undeclared=value" }, 403, true], [{ Origin: "https://invalid.example" }, 403, false]]) {
    const response = await worker.fetch(new Request(`${LATTICE_API_ORIGIN}${LATTICE_API_PATH}`, {
      method: "POST", headers: { ...headers, ...patch }, body: "{",
    }), env);
    assert.equal(response.status, status);
    assert.deepEqual(admissionHeaders(response), observed ? admissionNotCalled : { status: null, claim: null, order: null, provider: null });
  }
});

test("qualification admission is absent when unmarked inactive old-marked or expired", async () => {
  const instant = Date.parse("2026-10-05T12:00:00.000Z");const worker = createProductionLatticeApiWorker({ now: () => instant });
  for (const [marker, expiry] of [[undefined, instant + 60_000], ["v17", instant + 60_000],
    [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE, undefined], [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE, instant - 1]]) {
    const response = await worker.fetch(new Request(`${LATTICE_API_ORIGIN}${LATTICE_API_PATH}`, {
      method: "POST", headers: { Origin: LATTICE_API_ORIGIN, Accept: LATTICE_VISITOR_SESSION_ACCEPT,
        ...(marker ? { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: marker } : {}) },
    }), { VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
      ...(expiry === undefined ? {} : { [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: new Date(expiry).toISOString() }) });
    assert.equal(response.status, expiry === instant - 1 ? 503 : 204);
    assert.deepEqual(admissionHeaders(response), { status: null, claim: null, order: null, provider: null });
  }
  for (const marked of [false, true]) {
    let reads = 0;
    const expiringWorker = createProductionLatticeApiWorker({ now: () => {
      reads += 1;return reads <= 2 ? instant : instant + 60_001;
    } });
    const response = await expiringWorker.fetch(new Request(`${LATTICE_API_ORIGIN}${LATTICE_API_PATH}`, {
      method: "POST", headers: { Origin: LATTICE_API_ORIGIN, Accept: LATTICE_VISITOR_SESSION_ACCEPT,
        ...(marked ? { [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE } : {}) },
    }), { VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
      [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: new Date(instant + 60_000).toISOString() });
    assert.equal(response.status, 503);
    assert.deepEqual(admissionHeaders(response), { status: null, claim: null, order: null, provider: null });
    assert.deepEqual(await json(response), { error: "upstream_unavailable" });
  }
});

test("qualification admission cannot inherit native authority from injected engine or admission shortcuts", async () => {
  const instant = Date.parse("2026-10-05T12:00:00.000Z");
  const visitor = await establishLatticeApiVisitor(new Headers(), TEST_VISITOR_SECRET);
  for (const overrides of [{}, { admitTransformation: async () => ({ allowed: true, retryAfterSeconds: null }) },
    { createAdapter: () => ({}) }]) {
    const worker = createProductionLatticeApiWorker({ now: () => instant, runTextToLatticeImpl: async () => validLatticeResult(), ...overrides });
    const response = await worker.fetch(apiRequest(validPayload, { headers: {
      Cookie: `${LATTICE_API_VISITOR_COOKIE_NAME}=${visitor.cookieValue}`,
      [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
    } }), { HF_TOKEN: "test-only", VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
      LATTICE_API_RATE_LIMITER: { async limit() { return { success: true }; } },
      LATTICE_TRANSFORMATION_BUDGET: { getByName: () => ({ fetch: async () => Response.json({ allowed: true, schema_version: 1 }) }) },
      [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: new Date(instant + 60_000).toISOString(),
    });
    assert.equal(response.status, 200);assert.deepEqual(admissionHeaders(response), admissionUnavailable);
  }
});

test("qualification admission stays unavailable when the Worker abort race beats the DO response body", async () => {
  const instant = Date.parse("2026-10-05T12:00:00.000Z");let release, providerCalls = 0;
  const visitor = await establishLatticeApiVisitor(new Headers(), TEST_VISITOR_SECRET);
  const worker = createProductionLatticeApiWorker({ now: () => instant, requestTimeoutMs: 10,
    fetchImpl: async () => { providerCalls += 1;throw new Error("No provider expected"); } });
  const response = await worker.fetch(apiRequest(validPayload, { headers: {
    Cookie: `${LATTICE_API_VISITOR_COOKIE_NAME}=${visitor.cookieValue}`,
    [LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_HEADER]: LATTICE_QUALIFICATION_DIAGNOSTIC_REQUEST_VALUE,
  } }), { HF_TOKEN: "test-only", VISITOR_COOKIE_SECRET: TEST_VISITOR_SECRET,
    LATTICE_API_RATE_LIMITER: { async limit() { return { success: true }; } },
    LATTICE_TRANSFORMATION_BUDGET: { getByName: () => ({ fetch: async () => new Response(new ReadableStream({ start(controller) {
      release = () => { controller.enqueue(new TextEncoder().encode('{"allowed":true,"schema_version":1}'));controller.close(); };
    } }), { headers: { "Content-Type": "application/json" } }) }) },
    [LATTICE_QUALIFICATION_EXPIRES_AT_BINDING]: new Date(instant + 60_000).toISOString(),
  });
  assert.equal(response.status, 504);assert.deepEqual(admissionHeaders(response), admissionUnavailable);
  assert.equal(providerCalls, 0);release();await Promise.resolve();await Promise.resolve();
  assert.deepEqual(admissionHeaders(response), admissionUnavailable);assert.equal(providerCalls, 0);
});
