import {
  ANALYSIS_SCHEMA,
  CANDIDATE_SCHEMA,
  DOCUMENT_CERTIFICATION_SCHEMA,
  LATTICE_ANALYSIS_DIAGNOSTIC_CONTEXT,
  LATTICE_ANALYSIS_DIAGNOSTIC_ORIGINS,
  LATTICE_ANALYSIS_VALIDATION_CATEGORIES,
  LATTICE_BATCH_ATOM_LIMIT,
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
} from "../../app/resume/lattice/promptContract.js";
import {
  LITERAL_BATCH_SPAN_LIMIT,
  MODEL_SOURCE_SPAN_LIMIT,
  SOURCE_SPAN_LIMIT,
  graphemeExcerpt,
} from "../../app/resume/lattice/segments.js";
import { LATTICE_PROVIDER_CALL_LIMIT } from "../../app/resume/lattice/remoteProtocol.js";
import { rememberRejectedResult } from "../../app/resume/lattice/rejectionDiagnostics.js";

export { LATTICE_PROVIDER_CALL_LIMIT };

export const HUGGING_FACE_CHAT_COMPLETIONS_URL =
  "https://router.huggingface.co/v1/chat/completions";

export const LATTICE_REMOTE_MODELS = Object.freeze({
  generator: "Qwen/Qwen3-4B-Instruct-2507:nscale",
  verifier: "meta-llama/Llama-3.1-8B-Instruct:deepinfra",
});

export const LATTICE_PROVIDER_FAILURE_CLASSES = Object.freeze([
  "provider_not_configured",
  "provider_timeout",
  "provider_unavailable",
  "provider_request_too_large",
  "provider_redirect",
  "provider_http_error",
  "provider_response_too_large",
  "provider_output_limit",
  "provider_malformed_response",
]);

const TOOL_ENVELOPE_SUBTYPES = Object.freeze([
  "E00", "E01", "E02", "E03", "E04", "E05", "E06", "E07",
  "S01", "S02", "S03", "S04", "S05", "S06", "S07",
]);
export const LATTICE_PROVIDER_MALFORMED_SUBTYPES = Object.freeze([
  "none",
  "response_read",
  "response_type",
  "media_type",
  "envelope_json",
  "choice_count",
  "choice_shape",
  "finish_reason",
  "message_shape",
  // Fixed host predicates on already rejected transport envelopes. These
  // permit bounded shape inference without retaining values or field names.
  ...TOOL_ENVELOPE_SUBTYPES,
  "message_role",
  "content_empty",
  "content_json",
  "content_shape",
  "response_processing",
]);

export const LATTICE_PROVIDER_FINISH_REASONS = Object.freeze([
  "none",
  "stop",
  "tool_calls",
  "length",
  "other",
]);

export const LATTICE_PROVIDER_SIZE_BUCKETS = Object.freeze([
  "none",
  "0",
  "1-4096",
  "4097-16384",
  "16385-65536",
  "65537-262144",
  "262145-1048576",
  "1048577-plus",
]);

export const LATTICE_PROVIDER_COMPLETION_TOKEN_BUCKETS = Object.freeze([
  "none",
  "0",
  "1-255",
  "256-511",
  "512-1023",
  "1024-2047",
  "2048-3071",
  "3072-plus",
]);

export const LATTICE_PROVIDER_ANALYSIS_ORIGINS = Object.freeze([
  "none",
  ...LATTICE_ANALYSIS_DIAGNOSTIC_ORIGINS,
]);

export const LATTICE_PROVIDER_ANALYSIS_ATTEMPTS = Object.freeze([
  "none",
  "1",
  "2",
]);

// Qualification-only observations of an already rejected HTTP response. These
// are advertised metadata, never proof of the internal serving target or hop.
export const LATTICE_PROVIDER_HTTP_HEADER_VALUES = Object.freeze({
  mediaType: Object.freeze(["absent", "json", "text", "html", "other", "invalid", "unavailable"]),
  allow: Object.freeze(["absent", "empty", "includes-POST", "excludes-POST", "invalid", "unavailable"]),
  routerRoute: Object.freeze(["absent", "present", "invalid", "unavailable"]),
  routerModel: Object.freeze([
    "absent", "expected-selector", "expected-model", "mapped-model",
    "replacement-literal", "other", "invalid", "unavailable",
  ]),
  inferenceProvider: Object.freeze(["absent", "expected", "other", "invalid", "unavailable"]),
});
const HTTP_HEADER_VALUE_SETS = Object.freeze(Object.fromEntries(
  Object.entries(LATTICE_PROVIDER_HTTP_HEADER_VALUES).map(([field, values]) => [field, new Set(values)]),
));
const HTTP_HEADER_CHARACTER_LIMIT = 256;
const HTTP_TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;
const VERIFIER_MAPPED_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct";
const VERIFIER_ADVERTISED_REPLACEMENT = "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo";

export function isClosedProviderHttpHeaders(value) {
  try {
    return record(value)
      && Object.isFrozen(value)
      && Object.getPrototypeOf(value) === Object.prototype
      && Reflect.ownKeys(value).length === Object.keys(HTTP_HEADER_VALUE_SETS).length
      && Object.entries(HTTP_HEADER_VALUE_SETS).every(([field, values]) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, field);
        return descriptor !== undefined && "value" in descriptor && values.has(descriptor.value);
      });
  } catch {
    return false;
  }
}

function qualificationHttpHeaders(response, role) {
  const observe = (name, classify) => {
    try {
      const raw = response.headers.get(name);
      if (raw === null) return "absent";
      if (typeof raw !== "string" || raw.length > HTTP_HEADER_CHARACTER_LIMIT
        || /[^\t\x20-\x7e]/u.test(raw)) return "invalid";
      return classify(raw.replace(/^[\t ]+|[\t ]+$/gu, ""));
    } catch {
      return "unavailable";
    }
  };
  const selector = LATTICE_REMOTE_MODELS[role];
  // Derive only the trusted configured literal; never normalize an observed ID.
  const separator = selector.lastIndexOf(":");
  const expectedModel = selector.slice(0, separator);
  const expectedProvider = selector.slice(separator + 1);
  return Object.freeze({
    mediaType: observe("content-type", (value) => {
      const match = /^([^/;\t ]+)\/([^/;\t ]+)(?:[\t ]*;[\t\x20-\x7e]*)?$/u.exec(value);
      if (match === null || !HTTP_TOKEN.test(match[1]) || !HTTP_TOKEN.test(match[2])) return "invalid";
      const media = `${match[1]}/${match[2]}`.toLowerCase();
      if (media === "application/json") return "json";
      if (media === "text/plain") return "text";
      if (media === "text/html") return "html";
      return "other";
    }),
    allow: observe("allow", (value) => {
      if (value === "") return "empty";
      const methods = value.split(",").map((method) => method.replace(/^[\t ]+|[\t ]+$/gu, ""));
      // Empty list members are permitted by HTTP list syntax. A bounded list
      // still distinguishes the case-sensitive POST token from arbitrary text.
      if (methods.length > 32 || methods.some((method) => method !== "" && !HTTP_TOKEN.test(method))) {
        return "invalid";
      }
      if (methods.every((method) => method === "")) return "empty";
      return methods.includes("POST") ? "includes-POST" : "excludes-POST";
    }),
    routerRoute: observe("x-router-route", (value) => value ? "present" : "invalid"),
    routerModel: observe("x-router-model", (value) => {
      if (!value || /[\t ]/u.test(value)) return "invalid";
      if (value === selector) return "expected-selector";
      if (value === expectedModel) return "expected-model";
      if (role === "verifier" && value === VERIFIER_MAPPED_MODEL) return "mapped-model";
      if (role === "verifier" && value === VERIFIER_ADVERTISED_REPLACEMENT) return "replacement-literal";
      return "other";
    }),
    inferenceProvider: observe("x-inference-provider", (value) => {
      if (!value || /[\t ]/u.test(value)) return "invalid";
      return value === expectedProvider ? "expected" : "other";
    }),
  });
}

export const LATTICE_PROVIDER_CALL_TIMEOUT_MS = 120_000;
const LATTICE_PROVIDER_VERIFICATION_CALL_TIMEOUT_MS = 180_000;
export const LATTICE_PROVIDER_REQUEST_BYTE_LIMIT = 1_048_576;
export const LATTICE_PROVIDER_RESPONSE_BYTE_LIMIT = 262_144;
export const LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT = 128_000;

const REMOTE_ROLES = new Set(Object.keys(LATTICE_REMOTE_MODELS));
const REQUESTED_MODES = new Set(["auto", "operative", "experiential"]);
const RESPONSE_FORMATS = new Set(["json_object", "json_schema"]);
const MALFORMED_SUBTYPE_SET = new Set(LATTICE_PROVIDER_MALFORMED_SUBTYPES);
const FINISH_REASON_SET = new Set(LATTICE_PROVIDER_FINISH_REASONS);
const SIZE_BUCKET_SET = new Set(LATTICE_PROVIDER_SIZE_BUCKETS);
const COMPLETION_TOKEN_BUCKET_SET = new Set(LATTICE_PROVIDER_COMPLETION_TOKEN_BUCKETS);
const ANALYSIS_ORIGIN_SET = new Set(LATTICE_ANALYSIS_DIAGNOSTIC_ORIGINS);
const ANALYSIS_VALIDATION_CATEGORY_SET = new Set(LATTICE_ANALYSIS_VALIDATION_CATEGORIES);
const PROVIDER_DIAGNOSTICS = new WeakMap();
const ANALYSIS_DECODER_FAILURE_CATEGORY_SET = new Set([
  "response-shape",
  "passage-coverage",
  "capacity",
  "evidence",
  "relation",
  "ambiguity",
  "conformance",
]);
const ANALYSIS_DECODER_FAILURES = new WeakMap();
const JSON_HEADERS = Object.freeze({
  Accept: "application/json",
  "Content-Type": "application/json",
});
const PROVIDER_JSON_CONTENT_TYPE = /^application\/json(?:\s*;.*)?$/iu;
const ANALYSIS_CONFORMANCE_ITEM_LIMIT = 5;
const ANALYSIS_LINK_ITEM_LIMIT = LATTICE_BATCH_ATOM_LIMIT;
const ANALYSIS_MAX_OUTPUT_TOKENS = 2_048;
const ANALYSIS_MIN_OUTPUT_TOKENS = 768;
const ANALYSIS_OUTPUT_TOKEN_STEP = 256;
const CANDIDATE_MAX_OUTPUT_TOKENS = 800;
// Exhaustive allocation of the supported 4-passage, 24-atom, 72-evidence,
// 5-conformance-check, 24-issue production contract measures at most 729
// reviewed-tokenizer tokens minified, 742 in compact native-tool form, 1,313
// with conventional two-space formatting, and 1,326 in pretty native-tool form.
// The 2,048-token limit is the smallest 256-token step retaining at least a
// 50-percent margin over that complete legal maximum:
// ceil((1.5 * 1,326) / 256) * 256. It leaves 722 repository-tokenizer tokens
// (54.45 percent) above the legal maximum. A retained predecessor-wire live run
// at 2,048 tokens ended with finish_reason=length without a complete legal
// arguments object, so it does not size this wire. A broader decoder-valid but
// nonproduction sensitivity fixture measures 1,386 pretty native-tool tokens.
const VERIFICATION_MAX_OUTPUT_TOKENS = 2_048;
const CERTIFICATION_MAX_OUTPUT_TOKENS = 520;
const REPAIR_MAX_OUTPUT_TOKENS = 800;
export const LATTICE_PROVIDER_OUTPUT_TOKEN_LIMITS = Object.freeze({
  analysis: ANALYSIS_MAX_OUTPUT_TOKENS,
  candidate: CANDIDATE_MAX_OUTPUT_TOKENS,
  verification: VERIFICATION_MAX_OUTPUT_TOKENS,
  certification: CERTIFICATION_MAX_OUTPUT_TOKENS,
  repair: REPAIR_MAX_OUTPUT_TOKENS,
});
export const LATTICE_PROVIDER_MAX_OUTPUT_TOKENS_PER_CALL = Math.max(
  ...Object.values(LATTICE_PROVIDER_OUTPUT_TOKEN_LIMITS),
);
export const LATTICE_PROVIDER_MAX_OUTPUT_TOKENS_PER_ADMITTED_REQUEST =
  LATTICE_PROVIDER_CALL_LIMIT * LATTICE_PROVIDER_MAX_OUTPUT_TOKENS_PER_CALL;
// Certification identifiers are host-generated ASCII. This conservative
// adapter-boundary guard also covers valid fitted requests that the production
// orchestrator does not generate, without consuming the full 520-token budget.
export const LATTICE_CERTIFICATION_WIRE_CHARACTER_LIMIT = 440;
const CERTIFICATION_WIRE_ID_PATTERN = /^[A-Za-z0-9:._-]+$/u;

function fixedTuple(...items) {
  return Object.freeze({
    type: "array",
    minItems: items.length,
    maxItems: items.length,
    prefixItems: Object.freeze(items),
  });
}

const INTERNAL_ANALYSIS_PASSAGE_SCHEMA = REANALYSIS_SCHEMA.properties.passages.items;
const INTERNAL_ANALYSIS_ATOM_SCHEMA = INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.atoms.items;
const INTERNAL_ANALYSIS_LINK_SCHEMA = INTERNAL_ANALYSIS_ATOM_SCHEMA.properties.links.items;
const INTERNAL_ANALYSIS_ASSERTION_SCHEMA =
  INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.conformanceAssertions.items;
const ANALYSIS_DOCUMENT_KINDS = Object.freeze([
  ...REANALYSIS_SCHEMA.properties.documentKind.enum,
]);
const ANALYSIS_LAYERS = Object.freeze([
  ...INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.layer.enum,
]);
const ANALYSIS_DISPOSITIONS = Object.freeze([
  ...INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.disposition.enum,
]);
const ANALYSIS_ATOM_KINDS = Object.freeze([
  ...INTERNAL_ANALYSIS_ATOM_SCHEMA.properties.kind.enum,
]);
const ANALYSIS_PRIORITIES = Object.freeze([
  ...INTERNAL_ANALYSIS_ATOM_SCHEMA.properties.priority.enum,
]);
const ANALYSIS_PRESERVATIONS = Object.freeze([
  ...INTERNAL_ANALYSIS_ATOM_SCHEMA.properties.preservation.enum,
]);
const ANALYSIS_RELATIONS = Object.freeze([
  ...INTERNAL_ANALYSIS_LINK_SCHEMA.properties.relation.enum,
]);
function wireEnumIndexSchema(values) {
  return Object.freeze({ type: "integer", minimum: 0, maximum: values.length - 1 });
}
const ANALYSIS_WIRE_LINK_SCHEMA = fixedTuple(
  Object.freeze({ type: "integer", minimum: 0 }),
  wireEnumIndexSchema(ANALYSIS_RELATIONS),
  Object.freeze({ type: "integer" }),
);
const ANALYSIS_WIRE_ATOM_SCHEMA = fixedTuple(
  wireEnumIndexSchema(ANALYSIS_ATOM_KINDS),
  wireEnumIndexSchema(ANALYSIS_PRIORITIES),
  wireEnumIndexSchema(ANALYSIS_PRESERVATIONS),
  Object.freeze({
    type: "array",
    minItems: 1,
    maxItems: 3,
    items: Object.freeze({ type: "integer", minimum: 0 }),
  }),
);
const ANALYSIS_WIRE_PASSAGE_SCHEMA = fixedTuple(
  wireEnumIndexSchema(ANALYSIS_LAYERS),
  wireEnumIndexSchema(ANALYSIS_DISPOSITIONS),
  Object.freeze({
    ...INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.atoms,
    items: ANALYSIS_WIRE_ATOM_SCHEMA,
  }),
  Object.freeze({
    type: "array",
    minItems: ANALYSIS_CONFORMANCE_ITEM_LIMIT,
    maxItems: ANALYSIS_CONFORMANCE_ITEM_LIMIT,
    items: Object.freeze({ type: "string", minLength: 1 }),
  }),
);
const ANALYSIS_WIRE_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: Object.freeze({
    d: wireEnumIndexSchema(ANALYSIS_DOCUMENT_KINDS),
    p: Object.freeze({
      ...REANALYSIS_SCHEMA.properties.passages,
      items: ANALYSIS_WIRE_PASSAGE_SCHEMA,
    }),
    l: Object.freeze({
      type: "array",
      maxItems: ANALYSIS_LINK_ITEM_LIMIT,
      items: ANALYSIS_WIRE_LINK_SCHEMA,
    }),
  }),
  required: Object.freeze(["d", "p", "l"]),
});
const ANALYSIS_WIRE_GUIDE = [
  "Return one minified private analysis instance using only the mandatory d/p/l index layout; never echo the schema.",
  `Root d is the zero-based document-kind index [${ANALYSIS_DOCUMENT_KINDS.join(",")}]. Root p contains one passage tuple per supplied passage in supplied order. Root l contains the document link tuples. Passage and atom IDs are host-generated and must not be emitted.`,
  `Passage tuple positions 0-3: [layer index,disposition index,atom tuples,criterion evidence masks]. Layer indices are [${ANALYSIS_LAYERS.join(",")}]; disposition indices are [${ANALYSIS_DISPOSITIONS.join(",")}]. The host derives bounded discourse and rationale text from the selected layer and evidence.`,
  `Atom tuple positions 0-3: [kind index,priority index,preservation index,evidence positions]. Kind indices are [${ANALYSIS_ATOM_KINDS.join(",")}]; priority indices are [${ANALYSIS_PRIORITIES.join(",")}]; preservation indices are [${ANALYSIS_PRESERVATIONS.join(",")}]. The host derives each atom value from its selected source evidence.`,
  `Each l tuple is [source atom position,relation index,target position]. Atom positions use global passage/atom order. Relation indices are [${ANALYSIS_RELATIONS.join(",")}]. Nonnegative targets select emitted atoms; -1 selects the first supplied ledger atom, -2 the second, and so on. Select only existing non-self positions and never repeat a typed link.`,
  "Evidence positions are zero-based in exact supplied evidence order. List each atom's one to three unique positions in ascending order, and cover every supplied evidence position across the passage's atoms.",
  "The five criterion masks use this order: the four universal criteria followed by the selected layer criterion. Each mask is a fitted binary string in evidence order. A rewrite uses five all-zero masks. A retain-if-conformant plan gives every criterion a nonempty selection and the five masks jointly cover every evidence position.",
  "Ordinary evidence uses equivalent or implicit preservation; exact is available only when every selectable evidence record is literal. Ambiguity membership is derived from emitted ambiguity or uncertainty kinds.",
  "Use the smallest complete atom graph allowed by the fitted cap. Carry source meaning through evidence positions. Emit no identifiers, free text, long field names, Markdown, explanations, schema text, or prose outside the object.",
].join("\n");

function analysisWireMessages(request) {
  return analysisMessages(request, { responseDialect: "compact-wire-v2" });
}

const INTERNAL_VERIFICATION_PASSAGE_SCHEMA = VERIFICATION_SCHEMA.properties.passages.items;
const INTERNAL_VERIFICATION_CRITERION_SCHEMA =
  INTERNAL_VERIFICATION_PASSAGE_SCHEMA.properties.criterionChecks.items;
const INTERNAL_VERIFICATION_ISSUE_SCHEMA = VERIFICATION_SCHEMA.properties.issues.items;
const VERIFICATION_DECISIONS = Object.freeze([...VERIFICATION_SCHEMA.properties.decision.enum]);
const VERIFICATION_GATES = Object.freeze([...VERIFICATION_SCHEMA.properties.failedGates.items.enum]);
const VERIFICATION_PASSAGE_CHECKS = Object.freeze([
  ...INTERNAL_VERIFICATION_PASSAGE_SCHEMA.properties.failedChecks.items.enum,
]);
const VERIFICATION_LAYERS = Object.freeze([
  ...INTERNAL_VERIFICATION_PASSAGE_SCHEMA.properties.independentLayer.enum,
]);
const VERIFICATION_ISSUE_CHECKS = Object.freeze([
  ...INTERNAL_VERIFICATION_ISSUE_SCHEMA.properties.check.enum,
]);
const WIRE_MASK_PLACEHOLDER_SCHEMA = Object.freeze({ type: "string", minLength: 1 });
function wireBitMaskSchema(width, { requireSelection = false } = {}) {
  if (!Number.isSafeInteger(width) || width < 1) {
    throw new TypeError("The Lattice provider received an invalid wire-mask width.");
  }
  return Object.freeze({
    type: "string",
    minLength: width,
    maxLength: width,
    pattern: requireSelection ? "^[01]*1[01]*$" : `^[01]{${width}}$`,
  });
}

function closedWireObject(properties) {
  const frozenProperties = Object.freeze(properties);
  return Object.freeze({
    type: "object",
    additionalProperties: false,
    properties: frozenProperties,
    required: Object.freeze(Object.keys(frozenProperties)),
  });
}

function analysisWireBitMaskSchema(width) {
  if (!Number.isSafeInteger(width) || width < 1) {
    throw new TypeError("The Lattice provider received an invalid analysis wire-mask width.");
  }
  // Nscale's structured-output backend may route strict schemas through
  // XGrammar. Keep the provider-facing analysis mask to the exact-width
  // pattern alone: some XGrammar versions reject a pattern combined with
  // minLength/maxLength. decodeAnalysisWire independently enforces the same
  // width and binary alphabet before the value can reach the host schema.
  return Object.freeze({
    type: "string",
    pattern: `^[01]{${width}}$`,
  });
}
const VERIFICATION_WIRE_CRITERION_SCHEMA = closedWireObject({
  v: INTERNAL_VERIFICATION_CRITERION_SCHEMA.properties.passed,
  s: WIRE_MASK_PLACEHOLDER_SCHEMA,
});
const VERIFICATION_WIRE_CONFORMANCE_SCHEMA = closedWireObject({
  v: INTERNAL_VERIFICATION_PASSAGE_SCHEMA.properties.conformanceConfirmed,
  s: WIRE_MASK_PLACEHOLDER_SCHEMA,
  k: Object.freeze({ type: "array", items: VERIFICATION_WIRE_CRITERION_SCHEMA }),
});
const VERIFICATION_WIRE_PASSAGE_SCHEMA = closedWireObject({
  a: WIRE_MASK_PLACEHOLDER_SCHEMA,
  u: Object.freeze({ type: "boolean" }),
  s: WIRE_MASK_PLACEHOLDER_SCHEMA,
  f: wireBitMaskSchema(VERIFICATION_PASSAGE_CHECKS.length),
  l: Object.freeze({ type: "integer", minimum: 0, maximum: VERIFICATION_LAYERS.length - 1 }),
  x: WIRE_MASK_PLACEHOLDER_SCHEMA,
  y: WIRE_MASK_PLACEHOLDER_SCHEMA,
  c: VERIFICATION_WIRE_CONFORMANCE_SCHEMA,
});
const VERIFICATION_WIRE_ISSUE_SCHEMA = closedWireObject({
  c: Object.freeze({ type: "integer", minimum: 0, maximum: VERIFICATION_ISSUE_CHECKS.length - 1 }),
  p: Object.freeze({
    type: "integer",
    minimum: -1,
    maximum: VERIFICATION_SCHEMA.properties.passages.maxItems - 1,
  }),
});
const VERIFICATION_WIRE_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: Object.freeze({
    d: Object.freeze({ type: "integer", minimum: 0, maximum: VERIFICATION_DECISIONS.length - 1 }),
    g: wireBitMaskSchema(VERIFICATION_GATES.length),
    p: closedWireObject({}),
    i: Object.freeze({
      ...VERIFICATION_SCHEMA.properties.issues,
      items: VERIFICATION_WIRE_ISSUE_SCHEMA,
    }),
  }),
  required: Object.freeze(["d", "g", "p", "i"]),
});
const VERIFICATION_WIRE_GUIDE = [
  "Return one minified private verification instance with exactly the four root fields d, g, p, and i; never echo the schema. Keep i as [] when no additional issue is needed, never omit it. Return every fitted passage record completely for every decision, including repair and reject.",
  `Root d is the zero-based decision index [${VERIFICATION_DECISIONS.join(",")}]. Root g is the ${VERIFICATION_GATES.length}-character failed-gate bit string in this order: [${VERIFICATION_GATES.join(",")}].`,
  "Set d to accept only when every reported gate and passage condition passes. Repair or reject requires at least one actual failed condition represented by g or a passage record; never invent a failure to justify a negative decision. Each i entry must name a check already failed in g, or in the referenced passage; a document-wide entry cannot rely on an unrelated local failure. Never use i alone to establish a failed check.",
  "Root p is the fitted object whose numeric keys are supplied passage positions. Each passage is {a,u,s,f,l,x,y,c}: atom-status digits, unsupported-meaning boolean, unmodeled-span bit string, failed-check bit string, independent-layer index, layer-evidence atom bit string, layer-evidence span bit string, and conformance object.",
  `Atom-status digits use supplied atom order: 1 checked, 2 missing, 0 unaccounted. Failed-check mask order: [${VERIFICATION_PASSAGE_CHECKS.join(",")}]. Layer indices are zero-based in this order: [${VERIFICATION_LAYERS.join(",")}].`,
  "Every bit string uses supplied order and exact fitted width; 1 selects an item. Layer-support masks x and y each contain at least one 1, even for repair or reject. x selects supplied atoms supporting the independent layer; y selects source spans grounded by those atoms. Never select unsupported evidence merely to make a mask nonempty. Conformance c is {v,s,k}: confirmed, conformance-span bit string, and criterion checks in fitted order. Each criterion check is {v,s}: passed and evidence-span bit string. Rewrites use {v:false,s:all-zero,k:[]}. This emptiness applies only to c, never to x or y.",
  "The unmodeled-span mask selects at most 12 positions. Every passed criterion selects at least one evidence bit. Root i contains only necessary {c,p} objects: c is the zero-based failed-check index and p is the zero-based passage position, or -1 for document-wide. Root i contains no duplicate {c,p} pair.",
  `Issue check index order: [${VERIFICATION_ISSUE_CHECKS.join(",")}]. Keep i empty when g or a passage record already records the failure. Emit no source identifiers, long-form host field names, explanations, schema text, or whitespace after the closing brace.`,
].join("\n");

function verificationWireMessages(request) {
  return verificationMessages(request, { responseDialect: "compact-wire-v2" });
}

const CERTIFICATION_CHECK_NAMES = Object.freeze([
  ...DOCUMENT_CERTIFICATION_SCHEMA.properties.checks.required,
]);
const CERTIFICATION_DECISIONS = Object.freeze([
  ...DOCUMENT_CERTIFICATION_SCHEMA.properties.decision.enum,
]);
const CERTIFICATION_WIRE_CHECKS_SCHEMA = Object.freeze({
  type: "array",
  minItems: CERTIFICATION_CHECK_NAMES.length,
  maxItems: CERTIFICATION_CHECK_NAMES.length,
  items: Object.freeze({ type: "boolean" }),
});
const CERTIFICATION_WIRE_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: Object.freeze({
    c: DOCUMENT_CERTIFICATION_SCHEMA.properties.certificateId,
    o: DOCUMENT_CERTIFICATION_SCHEMA.properties.obligationIds,
    d: Object.freeze({ type: "integer", minimum: 0, maximum: CERTIFICATION_DECISIONS.length - 1 }),
    k: CERTIFICATION_WIRE_CHECKS_SCHEMA,
    i: Object.freeze({
      type: "array",
      maxItems: DOCUMENT_CERTIFICATION_SCHEMA.properties.issues.maxItems,
      items: Object.freeze({ type: "integer", minimum: 0, maximum: CERTIFICATION_CHECK_NAMES.length - 1 }),
    }),
  }),
  required: Object.freeze(["c", "o", "d", "k", "i"]),
});
const CERTIFICATION_WIRE_GUIDE = [
  "Return one minified private document-certification instance using only the mandatory c/o/d/k/i layout; never echo the schema.",
  `Root c is the exact certificate ID, o contains every exact obligation ID once in supplied order, d is the zero-based decision index [${CERTIFICATION_DECISIONS.join(",")}], k is the fixed-length boolean check array, and i lists only zero-based failed-check indices.`,
  `Check array order: [${CERTIFICATION_CHECK_NAMES.join(",")}].`,
  "Root i contains no duplicate index, and every listed index points to false in k. Keep i empty on acceptance. Emit no long-form host field names, explanations, issue prose, schema text, or whitespace after the closing brace.",
].join("\n");

function certificationWireMessages(request) {
  return documentCertificationMessages(request, { responseDialect: "compact-wire-v2" });
}

const VERIFICATION_TOOL_NAME = "lattice_verification_wire_v2";
const CERTIFICATION_TOOL_NAME = "lattice_certification_wire_v2";
const STOPPED_TOOL_CONTENT_NAMES = new Set([
  VERIFICATION_TOOL_NAME,
  CERTIFICATION_TOOL_NAME,
]);

const STAGES = Object.freeze({
  analysis: Object.freeze({
    role: "generator",
    schema: ANALYSIS_WIRE_SCHEMA,
    schemaName: "lattice_analysis_wire_v2",
    responseFormat: "json_schema",
    responseGuide: ANALYSIS_WIRE_GUIDE,
    schemaDescription: "Return one complete private fitted d/p/l analysis result.",
    messages: analysisWireMessages,
    maxTokens: ANALYSIS_MAX_OUTPUT_TOKENS,
    callTimeoutMs: LATTICE_PROVIDER_CALL_TIMEOUT_MS,
    temperature: 0.7,
    topP: 0.8,
  }),
  candidate: Object.freeze({
    role: "generator",
    schema: CANDIDATE_SCHEMA,
    schemaName: "lattice_candidate_v1",
    messages: candidateMessages,
    maxTokens: CANDIDATE_MAX_OUTPUT_TOKENS,
    callTimeoutMs: LATTICE_PROVIDER_CALL_TIMEOUT_MS,
    temperature: 0.45,
    topP: 0.9,
  }),
  verification: Object.freeze({
    role: "verifier",
    schema: VERIFICATION_WIRE_SCHEMA,
    schemaName: "lattice_verification_wire_v2",
    toolName: VERIFICATION_TOOL_NAME,
    toolChoice: "named",
    allowStoppedToolContent: true,
    responseGuide: VERIFICATION_WIRE_GUIDE,
    messages: verificationWireMessages,
    maxTokens: VERIFICATION_MAX_OUTPUT_TOKENS,
    callTimeoutMs: LATTICE_PROVIDER_VERIFICATION_CALL_TIMEOUT_MS,
    temperature: 0,
    topP: 1,
  }),
  certification: Object.freeze({
    role: "verifier",
    schema: CERTIFICATION_WIRE_SCHEMA,
    schemaName: "lattice_certification_wire_v2",
    toolName: CERTIFICATION_TOOL_NAME,
    toolChoice: "named",
    allowStoppedToolContent: true,
    responseGuide: CERTIFICATION_WIRE_GUIDE,
    messages: certificationWireMessages,
    maxTokens: CERTIFICATION_MAX_OUTPUT_TOKENS,
    callTimeoutMs: LATTICE_PROVIDER_CALL_TIMEOUT_MS,
    temperature: 0,
    topP: 1,
  }),
  repair: Object.freeze({
    role: "generator",
    schema: CANDIDATE_SCHEMA,
    schemaName: "lattice_repair_v1",
    messages: repairMessages,
    maxTokens: REPAIR_MAX_OUTPUT_TOKENS,
    callTimeoutMs: LATTICE_PROVIDER_CALL_TIMEOUT_MS,
    temperature: 0.45,
    topP: 0.9,
  }),
});

export const LATTICE_PROVIDER_STAGES = Object.freeze(Object.keys(STAGES));
export const LATTICE_PROVIDER_STAGE_CALL_TIMEOUTS_MS = Object.freeze(
  Object.fromEntries(
    Object.entries(STAGES).map(([stageName, stage]) => [stageName, stage.callTimeoutMs]),
  ),
);
export const LATTICE_PROVIDER_MAX_CALL_TIMEOUT_MS = Math.max(
  ...Object.values(LATTICE_PROVIDER_STAGE_CALL_TIMEOUTS_MS),
);

export class LatticeProviderError extends Error {
  constructor(code, message, { status = null, retryAfterSeconds = null, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "LatticeProviderError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function sizeBucket(value) {
  if (!Number.isSafeInteger(value) || value < 0) return "none";
  if (value === 0) return "0";
  if (value <= 4_096) return "1-4096";
  if (value <= 16_384) return "4097-16384";
  if (value <= 65_536) return "16385-65536";
  if (value <= 262_144) return "65537-262144";
  if (value <= 1_048_576) return "262145-1048576";
  return "1048577-plus";
}

function completionTokenBucket(value) {
  if (!Number.isSafeInteger(value) || value < 0) return "none";
  if (value === 0) return "0";
  if (value <= 255) return "1-255";
  if (value <= 511) return "256-511";
  if (value <= 1_023) return "512-1023";
  if (value <= 2_047) return "1024-2047";
  if (value <= 3_071) return "2048-3071";
  return "3072-plus";
}

function finishReason(value) {
  if (value === "stop" || value === "tool_calls" || value === "length") return value;
  return value === undefined || value === null ? "none" : "other";
}

function withProviderDiagnostic(error, patch) {
  if (!(error instanceof LatticeProviderError) || !record(patch)) return error;
  const current = PROVIDER_DIAGNOSTICS.get(error) ?? Object.freeze({
    subtype: "none",
    finishReason: "none",
    requestSize: "none",
    responseSize: "none",
    contentSize: "none",
    completionTokens: "none",
  });
  const next = { ...current };
  if (MALFORMED_SUBTYPE_SET.has(patch.subtype)) next.subtype = patch.subtype;
  if (FINISH_REASON_SET.has(patch.finishReason)) next.finishReason = patch.finishReason;
  if (SIZE_BUCKET_SET.has(patch.requestSize)) next.requestSize = patch.requestSize;
  if (SIZE_BUCKET_SET.has(patch.responseSize)) next.responseSize = patch.responseSize;
  if (SIZE_BUCKET_SET.has(patch.contentSize)) next.contentSize = patch.contentSize;
  if (COMPLETION_TOKEN_BUCKET_SET.has(patch.completionTokens)) {
    next.completionTokens = patch.completionTokens;
  }
  if (error.code === "provider_http_error" && isClosedProviderHttpHeaders(patch.httpHeaders)) {
    next.httpHeaders = patch.httpHeaders;
  }
  if (error.code !== "provider_malformed_response") next.subtype = "none";
  PROVIDER_DIAGNOSTICS.set(error, Object.freeze(next));
  return error;
}

function providerError(code, message, options) {
  return new LatticeProviderError(code, message, options);
}

function analysisQualificationDiagnostic(stage, context) {
  if (stage !== "analysis" || !record(context) || !Object.isFrozen(context)
    || !ANALYSIS_ORIGIN_SET.has(context.origin)
    || ![1, 2].includes(context.attempt)
    || !ANALYSIS_VALIDATION_CATEGORY_SET.has(context.priorValidationCategory)
    || (context.attempt === 1 && context.priorValidationCategory !== "none")
    || (context.attempt === 2 && context.priorValidationCategory === "none")) {
    return Object.freeze({
      origin: "none",
      attempt: "none",
      priorValidationCategory: "none",
    });
  }
  return Object.freeze({
    origin: context.origin,
    attempt: `${context.attempt}`,
    priorValidationCategory: context.priorValidationCategory,
  });
}

function stageQualificationDiagnostic(context) {
  if (!record(context)
    || !Object.isFrozen(context)
    || Object.getPrototypeOf(context) !== Object.prototype
    || Reflect.ownKeys(context).length !== 2
    || !Object.prototype.hasOwnProperty.call(context, "attempt")
    || !Object.prototype.hasOwnProperty.call(context, "priorValidationCategory")
    || !["initial", "correction"].includes(context.attempt)
    || !ANALYSIS_VALIDATION_CATEGORY_SET.has(context.priorValidationCategory)
    || (context.attempt === "initial" && context.priorValidationCategory !== "none")
    || (context.attempt === "correction" && context.priorValidationCategory === "none")) {
    return Object.freeze({ attempt: "none", priorValidationCategory: "none" });
  }
  return Object.freeze({
    attempt: context.attempt,
    priorValidationCategory: context.priorValidationCategory,
  });
}

function withQualificationDiagnostic(
  error,
  stage,
  callOrdinal,
  stageContext,
  analysisContext,
) {
  if (!(error instanceof LatticeProviderError)
    || !LATTICE_PROVIDER_STAGES.includes(stage)
    || !Number.isSafeInteger(callOrdinal)
    || callOrdinal < 1
    || callOrdinal > LATTICE_PROVIDER_CALL_LIMIT) {
    return error;
  }
  const providerDiagnostic = PROVIDER_DIAGNOSTICS.get(error) ?? Object.freeze({
    subtype: "none",
    finishReason: "none",
    requestSize: "none",
    responseSize: "none",
    contentSize: "none",
    completionTokens: "none",
  });
  const stageDiagnostic = stageQualificationDiagnostic(stageContext);
  const analysisDiagnostic = analysisQualificationDiagnostic(stage, analysisContext);
  Object.defineProperties(error, {
    qualificationStage: {
      configurable: false,
      enumerable: false,
      value: stage,
      writable: false,
    },
    qualificationCallOrdinal: {
      configurable: false,
      enumerable: false,
      value: callOrdinal,
      writable: false,
    },
    qualificationSubtype: {
      configurable: false,
      enumerable: false,
      value: providerDiagnostic.subtype,
      writable: false,
    },
    qualificationFinishReason: {
      configurable: false,
      enumerable: false,
      value: providerDiagnostic.finishReason,
      writable: false,
    },
    qualificationRequestSize: {
      configurable: false,
      enumerable: false,
      value: providerDiagnostic.requestSize,
      writable: false,
    },
    qualificationResponseSize: {
      configurable: false,
      enumerable: false,
      value: providerDiagnostic.responseSize,
      writable: false,
    },
    qualificationContentSize: {
      configurable: false,
      enumerable: false,
      value: providerDiagnostic.contentSize,
      writable: false,
    },
    qualificationCompletionTokens: {
      configurable: false,
      enumerable: false,
      value: providerDiagnostic.completionTokens,
      writable: false,
    },
    qualificationStageAttempt: {
      configurable: false,
      enumerable: false,
      value: stageDiagnostic.attempt,
      writable: false,
    },
    qualificationAnalysisOrigin: {
      configurable: false,
      enumerable: false,
      value: analysisDiagnostic.origin,
      writable: false,
    },
    qualificationAnalysisAttempt: {
      configurable: false,
      enumerable: false,
      value: analysisDiagnostic.attempt,
      writable: false,
    },
    qualificationPriorValidationCategory: {
      configurable: false,
      enumerable: false,
      value: stageDiagnostic.priorValidationCategory,
      writable: false,
    },
    qualificationHttpHeaders: {
      configurable: false,
      enumerable: false,
      value: error.code === "provider_http_error" ? providerDiagnostic.httpHeaders ?? null : null,
      writable: false,
    },
  });
  return error;
}

function abortError(message = "The Lattice provider request was canceled.") {
  return new DOMException(message, "AbortError");
}

function validPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function analysisAtomLimitForRequest(request) {
  const value = request?.analysisAtomLimit ?? LATTICE_BATCH_ATOM_LIMIT;
  if (!validPositiveInteger(value) || value > LATTICE_BATCH_ATOM_LIMIT) {
    throw new TypeError("The Lattice provider received an invalid analysis atom limit.");
  }
  return value;
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonObjectMessages(messages, schemaName, schema, responseGuide) {
  const contract = [
    `Response contract ${schemaName}: Return exactly one minified JSON object matching the following closed JSON Schema.`,
    "Do not wrap the JSON object in Markdown or add text before or after it.",
    ...(responseGuide ? [responseGuide] : []),
    `<LATTICE_RESPONSE_SCHEMA>${JSON.stringify(schema)}</LATTICE_RESPONSE_SCHEMA>`,
  ].join("\n");
  const content = contract;
  const systemIndex = messages.findIndex((message) => (
    record(message) && message.role === "system" && typeof message.content === "string"
  ));
  if (systemIndex === -1) {
    return Object.freeze([
      Object.freeze({ role: "system", content }),
      ...messages.map((message) => Object.freeze({ ...message })),
    ]);
  }
  return Object.freeze(messages.map((message, index) => Object.freeze(index === systemIndex
    ? { ...message, content: `${message.content}\n${content}` }
    : { ...message })));
}

function jsonSchemaMessages(messages, schemaName, responseGuide) {
  const contract = [
    `Response contract ${schemaName}: Return exactly one JSON object satisfying the supplied strict JSON Schema.`,
    "Do not wrap the JSON object in Markdown or add text before or after it.",
    ...(responseGuide ? [responseGuide] : []),
  ].join("\n");
  const systemIndex = messages.findIndex((message) => (
    record(message) && message.role === "system" && typeof message.content === "string"
  ));
  if (systemIndex === -1) {
    return Object.freeze([
      Object.freeze({ role: "system", content: contract }),
      ...messages.map((message) => Object.freeze({ ...message })),
    ]);
  }
  return Object.freeze(messages.map((message, index) => Object.freeze(index === systemIndex
    ? { ...message, content: `${message.content}\n${contract}` }
    : { ...message })));
}

function forcedToolMessages(messages, toolName) {
  const contract = [
    `Response channel ${toolName}: Call this function exactly once with the complete structured result as its arguments.`,
    "Do not return a normal assistant response or call any other function.",
  ].join("\n");
  const content = contract;
  const systemIndex = messages.findIndex((message) => (
    record(message) && message.role === "system" && typeof message.content === "string"
  ));
  if (systemIndex === -1) {
    return Object.freeze([
      Object.freeze({ role: "system", content }),
      ...messages.map((message) => Object.freeze({ ...message })),
    ]);
  }
  return Object.freeze(messages.map((message, index) => Object.freeze(index === systemIndex
    ? { ...message, content: `${message.content}\n${content}` }
    : { ...message })));
}

function analysisPassagesForRequest(request) {
  const passages = request?.batch?.passages;
  if (!Array.isArray(passages) || passages.length === 0
    || passages.length > REANALYSIS_SCHEMA.properties.passages.maxItems
    || passages.some((passage) => (
    !record(passage) || typeof passage.id !== "string" || !passage.id || passage.id.length > 120
    || typeof passage.text !== "string" || passage.text.length === 0
  )) || new Set(passages.map((passage) => passage.id)).size !== passages.length) {
    throw new TypeError("The Lattice provider received invalid analysis passages.");
  }
  return passages;
}

function analysisEvidenceIdsForRequest(request, passages) {
  // Keep this fallback identical to sourcePassagesForModel so direct adapter
  // callers receive one fitted schema and prompt view of the same evidence.
  if (request?.sourceSpans === undefined) {
    return passages.map(({ id, text }) => Object.freeze({
      records: Object.freeze([Object.freeze({ id: `${id}:s01`, kind: "source", text })]),
      ids: Object.freeze([`${id}:s01`]),
      literalIds: Object.freeze([]),
    }));
  }
  if (!Array.isArray(request.sourceSpans)) {
    throw new TypeError("The Lattice provider received invalid analysis evidence.");
  }
  const groups = new Map();
  for (const group of request.sourceSpans) {
    if (!record(group) || typeof group.passageId !== "string"
      || groups.has(group.passageId) || !Array.isArray(group.spans)
      || (group.literalAnnotations !== undefined && !Array.isArray(group.literalAnnotations))) {
      throw new TypeError("The Lattice provider received invalid analysis evidence.");
    }
    const records = [...group.spans, ...(group.literalAnnotations ?? [])];
    const ids = records.map((span) => span?.id);
    if (ids.length === 0 || ids.some((id) => (
      typeof id !== "string" || !id || id.length > 160
    )) || new Set(ids).size !== ids.length) {
      throw new TypeError("The Lattice provider received invalid analysis evidence.");
    }
    groups.set(group.passageId, Object.freeze({
      records: Object.freeze(records.map((span) => Object.freeze({ ...span }))),
      ids: Object.freeze(ids),
      literalIds: Object.freeze(records
        .filter((span) => span?.kind === "literal")
        .map((span) => span.id)),
    }));
  }
  if (groups.size !== passages.length
    || passages.some(({ id }, index) => (
      !groups.has(id) || request.sourceSpans[index]?.passageId !== id
    ))) {
    throw new TypeError("The Lattice provider received invalid analysis evidence coverage.");
  }
  return passages.map(({ id }) => groups.get(id));
}

function analysisAtomAllocations(passages, evidenceIdsByPassage, atomLimit) {
  const minimums = evidenceIdsByPassage.map((ids) => Math.max(1, Math.ceil(ids.length / 3)));
  const maximums = evidenceIdsByPassage.map((ids, index) => (
    Math.max(minimums[index], Math.min(LATTICE_BATCH_ATOM_LIMIT, 4 * ids.length))
  ));
  const allocations = [...minimums];
  const required = minimums.reduce((sum, count) => sum + count, 0);
  const available = maximums.reduce((sum, count) => sum + count, 0);
  const analysisAtomLimit = Math.min(atomLimit, available);
  if (required > analysisAtomLimit) {
    throw new TypeError("The Lattice provider received an analysis atom limit outside evidence capacity.");
  }
  let remaining = analysisAtomLimit - required;
  while (remaining > 0) {
    for (let index = 0; index < passages.length && remaining > 0; index += 1) {
      if (allocations[index] >= maximums[index]) continue;
      allocations[index] += 1;
      remaining -= 1;
    }
  }
  return Object.freeze({
    analysisAtomLimit,
    minimumAllocations: Object.freeze(minimums),
    allocations: Object.freeze(allocations),
  });
}

function fitAnalysisRequest(request) {
  const passages = analysisPassagesForRequest(request);
  const evidenceByPassage = analysisEvidenceIdsForRequest(request, passages);
  const evidenceIdsByPassage = Object.freeze(evidenceByPassage.map(({ ids }) => ids));
  const literalEvidenceIdsByPassage = Object.freeze(
    evidenceByPassage.map(({ literalIds }) => literalIds),
  );
  const evidenceRecordsByPassage = Object.freeze(
    evidenceByPassage.map(({ records }) => records),
  );
  const maximumEvidence = (SOURCE_SPAN_LIMIT * passages.length) + (2 * LITERAL_BATCH_SPAN_LIMIT);
  if (evidenceIdsByPassage.some((ids) => ids.length > MODEL_SOURCE_SPAN_LIMIT)
    || evidenceIdsByPassage.reduce((sum, ids) => sum + ids.length, 0) > maximumEvidence) {
    throw new TypeError("The Lattice provider received oversized analysis evidence.");
  }
  const requestedAtomLimit = analysisAtomLimitForRequest(request);
  const atomPlan = analysisAtomAllocations(
    passages,
    evidenceIdsByPassage,
    requestedAtomLimit,
  );
  return Object.freeze({
    request: Object.freeze({ ...request, analysisAtomLimit: atomPlan.analysisAtomLimit }),
    passages,
    evidenceIdsByPassage,
    literalEvidenceIdsByPassage,
    evidenceRecordsByPassage,
    analysisAtomLimit: atomPlan.analysisAtomLimit,
    minimumAtomAllocations: atomPlan.minimumAllocations,
    atomAllocations: atomPlan.allocations,
  });
}

function analysisWireSchemaForFit(fit) {
  const {
    request, passages, evidenceIdsByPassage, literalEvidenceIdsByPassage,
    analysisAtomLimit, minimumAtomAllocations, atomAllocations,
  } = fit;
  const visibleLedgerIds = (request.documentLedger ?? []).map(({ id }) => id);
  const reservedWireAtomIds = new Set(Array.from(
    { length: analysisAtomLimit },
    (_value, index) => `a${index.toString(36)}`,
  ));
  if (visibleLedgerIds.length > LATTICE_PROVIDER_CALL_LIMIT * LATTICE_BATCH_ATOM_LIMIT
    || visibleLedgerIds.some((id) => typeof id !== "string" || !id || id.length > 180)
    || new Set(visibleLedgerIds).size !== visibleLedgerIds.length
    || visibleLedgerIds.some((id) => reservedWireAtomIds.has(id))) {
    throw new TypeError("The Lattice provider received invalid analysis ledger identifiers.");
  }
  const passageSchemas = passages.map((_passage, index) => {
    const evidenceIds = evidenceIdsByPassage[index];
    const literalEvidenceIds = literalEvidenceIdsByPassage[index];
    const atomLimit = atomAllocations[index];
    const evidenceSchema = Object.freeze({
      ...ANALYSIS_WIRE_ATOM_SCHEMA.prefixItems[3],
      items: Object.freeze({
        ...ANALYSIS_WIRE_ATOM_SCHEMA.prefixItems[3].items,
        maximum: evidenceIds.length - 1,
      }),
    });
    const preservationSchema = literalEvidenceIds.length === evidenceIds.length
      ? ANALYSIS_WIRE_ATOM_SCHEMA.prefixItems[2]
      : Object.freeze({
        ...ANALYSIS_WIRE_ATOM_SCHEMA.prefixItems[2],
        minimum: ANALYSIS_PRESERVATIONS.indexOf("equivalent"),
      });
    const atomSchema = fixedTuple(
      ANALYSIS_WIRE_ATOM_SCHEMA.prefixItems[0],
      ANALYSIS_WIRE_ATOM_SCHEMA.prefixItems[1],
      preservationSchema,
      evidenceSchema,
    );
    const requiredAtomSchemas = atomLimit === 1
      ? Object.freeze([fixedTuple(
        ANALYSIS_WIRE_ATOM_SCHEMA.prefixItems[0],
        ANALYSIS_WIRE_ATOM_SCHEMA.prefixItems[1],
        preservationSchema,
        fixedTuple(...evidenceIds.map((_id, position) => Object.freeze({ const: position }))),
      )])
      : Object.freeze([]);
    const atomsSchema = Object.freeze({
      ...ANALYSIS_WIRE_PASSAGE_SCHEMA.prefixItems[2],
      minItems: minimumAtomAllocations[index],
      maxItems: atomLimit,
      ...(requiredAtomSchemas.length === 0 ? {} : { prefixItems: requiredAtomSchemas }),
      items: atomSchema,
    });
    const conformanceMaskSchema = analysisWireBitMaskSchema(evidenceIds.length);
    const conformanceMasksSchema = Object.freeze({
      type: "array",
      minItems: ANALYSIS_CONFORMANCE_ITEM_LIMIT,
      maxItems: ANALYSIS_CONFORMANCE_ITEM_LIMIT,
      prefixItems: Object.freeze(Array.from(
        { length: ANALYSIS_CONFORMANCE_ITEM_LIMIT },
        () => conformanceMaskSchema,
      )),
    });
    return fixedTuple(
      ANALYSIS_WIRE_PASSAGE_SCHEMA.prefixItems[0],
      ANALYSIS_WIRE_PASSAGE_SCHEMA.prefixItems[1],
      atomsSchema,
      conformanceMasksSchema,
    );
  });
  const singletonLedgerTargets = analysisAtomLimit === 1 && visibleLedgerIds.length > 0
    ? Object.freeze({
      type: "integer",
      enum: Object.freeze(visibleLedgerIds.map((_id, index) => -index - 1)),
    })
    : null;
  const linkSchema = fixedTuple(
    Object.freeze({
      ...ANALYSIS_WIRE_LINK_SCHEMA.prefixItems[0],
      maximum: analysisAtomLimit - 1,
    }),
    ANALYSIS_WIRE_LINK_SCHEMA.prefixItems[1],
    singletonLedgerTargets ?? Object.freeze({
      ...ANALYSIS_WIRE_LINK_SCHEMA.prefixItems[2],
      minimum: visibleLedgerIds.length > 0 ? -visibleLedgerIds.length : 0,
      maximum: analysisAtomLimit - 1,
    }),
  );
  return Object.freeze({
    ...ANALYSIS_WIRE_SCHEMA,
    properties: Object.freeze({
      ...ANALYSIS_WIRE_SCHEMA.properties,
      p: Object.freeze({
        type: "array",
        minItems: passageSchemas.length,
        maxItems: passageSchemas.length,
        prefixItems: Object.freeze(passageSchemas),
      }),
      l: Object.freeze({
        ...ANALYSIS_WIRE_SCHEMA.properties.l,
        maxItems: analysisAtomLimit === 1 && visibleLedgerIds.length === 0
          ? 0
          : Math.min(ANALYSIS_LINK_ITEM_LIMIT, analysisAtomLimit),
        items: linkSchema,
      }),
    }),
  });
}

function verificationPlansForRequest(request, passages, evidenceByPassage) {
  const plans = request?.analysis?.passages;
  if (!Array.isArray(plans) || plans.length !== passages.length) {
    throw new TypeError("The Lattice provider received invalid verification plans.");
  }
  const fitted = Object.freeze(plans.map((plan, index) => {
    const atoms = plan?.atoms;
    const atomIds = atoms?.map((atom) => atom?.id);
    const evidenceIds = new Set(evidenceByPassage[index].ids);
    const expectedCriteria = plan?.disposition === "retain-if-conformant"
      ? [
        ...LATTICE_CONFORMANCE_CRITERIA.universal,
        ...(LATTICE_CONFORMANCE_CRITERIA[plan?.layer] ?? []),
      ]
      : [];
    if (!record(plan) || plan.passageId !== passages[index].id
      || !INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.layer.enum.includes(plan.layer)
      || !INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.disposition.enum.includes(plan.disposition)
      || !Array.isArray(atomIds) || atomIds.length === 0
      || atomIds.length > INTERNAL_ANALYSIS_PASSAGE_SCHEMA.properties.atoms.maxItems
      || atomIds.some((id) => typeof id !== "string" || !id || id.length > 160)
      || new Set(atomIds).size !== atomIds.length
      || atoms.some((atom) => !record(atom)
        || !Array.isArray(atom.evidenceSpanIds)
        || atom.evidenceSpanIds.length === 0
        || atom.evidenceSpanIds.some((id) => !evidenceIds.has(id)))
      || !Array.isArray(plan.conformanceCriteria)
      || new Set(plan.conformanceCriteria).size !== plan.conformanceCriteria.length
      || plan.conformanceCriteria.some((criterion) => (
        !INTERNAL_VERIFICATION_CRITERION_SCHEMA.properties.criterion.enum.includes(criterion)
      ))
      || plan.conformanceCriteria.length !== expectedCriteria.length
      || expectedCriteria.some((criterion) => !plan.conformanceCriteria.includes(criterion))) {
      throw new TypeError("The Lattice provider received an invalid verification plan.");
    }
    return Object.freeze({
      passageId: plan.passageId,
      layer: plan.layer,
      disposition: plan.disposition,
      atomIds: Object.freeze(atomIds),
      conformanceCriteria: Object.freeze([...plan.conformanceCriteria]),
    });
  }));
  if (fitted.reduce((sum, plan) => sum + plan.atomIds.length, 0) > LATTICE_BATCH_ATOM_LIMIT) {
    throw new TypeError("The Lattice provider received an oversized verification atom plan.");
  }
  return fitted;
}

function fitVerificationRequest(request) {
  const passages = analysisPassagesForRequest(request);
  const evidenceByPassage = analysisEvidenceIdsForRequest(request, passages);
  const maximumEvidence = (SOURCE_SPAN_LIMIT * passages.length) + (2 * LITERAL_BATCH_SPAN_LIMIT);
  if (evidenceByPassage.some(({ ids }) => ids.length > MODEL_SOURCE_SPAN_LIMIT)
    || evidenceByPassage.reduce((sum, { ids }) => sum + ids.length, 0) > maximumEvidence) {
    throw new TypeError("The Lattice provider received oversized verification evidence.");
  }
  const plans = verificationPlansForRequest(request, passages, evidenceByPassage);
  return Object.freeze({ passages, evidenceByPassage, plans });
}

function verificationWireSchemaForFit(fit) {
  const passageSchemas = fit.passages.map((_passage, index) => {
    const plan = fit.plans[index];
    const atomCount = plan.atomIds.length;
    const evidenceCount = fit.evidenceByPassage[index].ids.length;
    const rewrite = plan.disposition === "rewrite";
    const criteria = rewrite ? Object.freeze([]) : plan.conformanceCriteria;
    const evidenceMask = wireBitMaskSchema(evidenceCount);
    const criterionSchema = closedWireObject({
      v: VERIFICATION_WIRE_CRITERION_SCHEMA.properties.v,
      s: evidenceMask,
    });
    const conformanceSchema = closedWireObject({
      v: rewrite
        ? Object.freeze({ type: "boolean", enum: Object.freeze([false]) })
        : VERIFICATION_WIRE_CONFORMANCE_SCHEMA.properties.v,
      s: rewrite
        ? Object.freeze({ ...evidenceMask, enum: Object.freeze(["0".repeat(evidenceCount)]) })
        : evidenceMask,
      k: Object.freeze({
        type: "array",
        minItems: criteria.length,
        maxItems: criteria.length,
        items: criterionSchema,
      }),
    });
    return closedWireObject({
      a: Object.freeze({
        type: "string",
        minLength: atomCount,
        maxLength: atomCount,
        pattern: `^[012]{${atomCount}}$`,
      }),
      u: VERIFICATION_WIRE_PASSAGE_SCHEMA.properties.u,
      s: evidenceMask,
      f: VERIFICATION_WIRE_PASSAGE_SCHEMA.properties.f,
      l: VERIFICATION_WIRE_PASSAGE_SCHEMA.properties.l,
      x: wireBitMaskSchema(atomCount, { requireSelection: true }),
      y: wireBitMaskSchema(evidenceCount, { requireSelection: true }),
      c: conformanceSchema,
    });
  });
  const issueSchema = closedWireObject({
    c: VERIFICATION_WIRE_ISSUE_SCHEMA.properties.c,
    p: Object.freeze({
      ...VERIFICATION_WIRE_ISSUE_SCHEMA.properties.p,
      maximum: fit.passages.length - 1,
    }),
  });
  const passageProperties = Object.fromEntries(
    passageSchemas.map((schema, index) => [String(index), schema]),
  );
  return Object.freeze({
    ...VERIFICATION_WIRE_SCHEMA,
    properties: Object.freeze({
      ...VERIFICATION_WIRE_SCHEMA.properties,
      p: closedWireObject(passageProperties),
      i: Object.freeze({
        ...VERIFICATION_WIRE_SCHEMA.properties.i,
        items: issueSchema,
      }),
    }),
  });
}

function fitCertificationRequest(request) {
  const certificateId = request?.certificateId;
  const obligationIds = request?.obligationIds;
  if (typeof certificateId !== "string" || !certificateId
    || certificateId.length > DOCUMENT_CERTIFICATION_SCHEMA.properties.certificateId.maxLength
    || !CERTIFICATION_WIRE_ID_PATTERN.test(certificateId)
    || !Array.isArray(obligationIds)
    || obligationIds.length < DOCUMENT_CERTIFICATION_SCHEMA.properties.obligationIds.minItems
    || obligationIds.length > DOCUMENT_CERTIFICATION_SCHEMA.properties.obligationIds.maxItems
    || obligationIds.some((id) => typeof id !== "string" || !id || id.length > 160
      || !CERTIFICATION_WIRE_ID_PATTERN.test(id))
    || new Set(obligationIds).size !== obligationIds.length) {
    throw new TypeError("The Lattice provider received an invalid certification obligation.");
  }
  const maximalWire = JSON.stringify({
    c: certificateId,
    o: obligationIds,
    d: CERTIFICATION_DECISIONS.length - 1,
    k: CERTIFICATION_CHECK_NAMES.map(() => false),
    i: Array.from(
      { length: DOCUMENT_CERTIFICATION_SCHEMA.properties.issues.maxItems },
      (_value, index) => CERTIFICATION_CHECK_NAMES.length - 1 - index,
    ),
  });
  if (maximalWire.length > LATTICE_CERTIFICATION_WIRE_CHARACTER_LIMIT) {
    throw new TypeError("The Lattice provider received oversized certification identifiers.");
  }
  return Object.freeze({ certificateId, obligationIds: Object.freeze([...obligationIds]) });
}

function certificationWireSchemaForFit(fit) {
  return Object.freeze({
    ...CERTIFICATION_WIRE_SCHEMA,
    properties: Object.freeze({
      ...CERTIFICATION_WIRE_SCHEMA.properties,
      c: Object.freeze({
        ...CERTIFICATION_WIRE_SCHEMA.properties.c,
        enum: Object.freeze([fit.certificateId]),
      }),
      o: Object.freeze({
        type: "array",
        minItems: fit.obligationIds.length,
        maxItems: fit.obligationIds.length,
        items: Object.freeze({
          ...CERTIFICATION_WIRE_SCHEMA.properties.o.items,
          enum: fit.obligationIds,
        }),
      }),
    }),
  });
}

function exactKeys(value, keys) {
  if (!record(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function fittedStringLength(schema) {
  const explicitLength = schema.maxLength ?? schema.minLength;
  if (Number.isSafeInteger(explicitLength) && explicitLength >= 0) return explicitLength;
  const binaryWidth = typeof schema.pattern === "string"
    ? /^\^\[01\]\{([1-9]\d*)\}\$$/u.exec(schema.pattern)
    : null;
  const parsedWidth = binaryWidth ? Number(binaryWidth[1]) : null;
  if (Number.isSafeInteger(parsedWidth)) return parsedWidth;
  return 1;
}

function maximalFittedSchemaValue(schema) {
  if (!record(schema)) throw new TypeError("The Lattice provider received an invalid fitted schema.");
  if (Object.hasOwn(schema, "const")) return schema.const;
  if (Array.isArray(schema.enum)) {
    return [...schema.enum].sort((left, right) => (
      JSON.stringify(right).length - JSON.stringify(left).length
    ))[0];
  }
  if (schema.type === "string") return "1".repeat(fittedStringLength(schema));
  if (schema.type === "integer") {
    const candidates = [schema.minimum, schema.maximum].filter(Number.isSafeInteger);
    if (candidates.length === 0) return 0;
    return candidates.sort((left, right) => (
      JSON.stringify(right).length - JSON.stringify(left).length
    ))[0];
  }
  if (schema.type === "array") {
    if (Array.isArray(schema.prefixItems)) {
      const prefix = schema.prefixItems.map(maximalFittedSchemaValue);
      const maximumLength = schema.maxItems ?? schema.minItems ?? prefix.length;
      if (maximumLength <= prefix.length || !record(schema.items)) return prefix;
      return [
        ...prefix,
        ...Array.from(
          { length: maximumLength - prefix.length },
          () => maximalFittedSchemaValue(schema.items),
        ),
      ];
    }
    if (!record(schema.items)) return [];
    return Array.from(
      { length: schema.maxItems ?? schema.minItems ?? 0 },
      () => maximalFittedSchemaValue(schema.items),
    );
  }
  if (schema.type === "object" && Array.isArray(schema.required)) {
    return Object.fromEntries(schema.required.map((key) => (
      [key, maximalFittedSchemaValue(schema.properties[key])]
    )));
  }
  if (schema.type === "boolean") return false;
  throw new TypeError("The Lattice provider received an unsupported fitted schema.");
}

function analysisOutputTokenLimitForSchema(schema) {
  const canonicalCharacters = JSON.stringify(maximalFittedSchemaValue(schema)).length;
  if (canonicalCharacters > ANALYSIS_MAX_OUTPUT_TOKENS) {
    throw new TypeError("The Lattice provider received an oversized fitted analysis wire.");
  }
  const fitted = Math.max(ANALYSIS_MIN_OUTPUT_TOKENS, 2 * canonicalCharacters);
  const rounded = Math.ceil(fitted / ANALYSIS_OUTPUT_TOKEN_STEP) * ANALYSIS_OUTPUT_TOKEN_STEP;
  return Math.min(ANALYSIS_MAX_OUTPUT_TOKENS, rounded);
}

function wireEnumValue(index, values) {
  return Number.isSafeInteger(index) && index >= 0 && index < values.length
    ? values[index]
    : null;
}

function wireMaskSelections(mask, values, { minimum = 0, maximum = values.length } = {}) {
  if (typeof mask !== "string" || mask.length !== values.length || !/^[01]+$/u.test(mask)
    || !Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)
    || minimum < 0 || maximum < minimum) return null;
  const selected = values.filter((_value, index) => mask[index] === "1");
  return selected.length >= minimum && selected.length <= maximum ? selected : null;
}

function wireIndexPositions(indices, valueCount, { minimum = 0, maximum = valueCount } = {}) {
  if (!Array.isArray(indices) || !Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)
    || minimum < 0 || maximum < minimum || indices.length < minimum || indices.length > maximum
    || indices.some((index) => (
      !Number.isSafeInteger(index) || index < 0 || index >= valueCount
    ))) return null;
  const positions = [...new Set(indices)].sort((left, right) => left - right);
  return positions.length >= minimum && positions.length <= maximum ? positions : null;
}

function derivedAnalysisAtomValue(records, kind) {
  const sourceText = records.map((record) => (
    typeof record?.text === "string" ? record.text : ""
  )).join(" ").replace(/\s+/gu, " ").trim();
  const excerpt = graphemeExcerpt(sourceText, "start", 180).trim();
  let isolateDepth = 0;
  for (const character of excerpt) {
    const codePoint = character.codePointAt(0);
    if (codePoint >= 0x2066 && codePoint <= 0x2068) isolateDepth += 1;
    else if (codePoint === 0x2069) isolateDepth -= 1;
    if (isolateDepth < 0 || isolateDepth > 8) return `Evidence-grounded ${kind}`;
  }
  const balancedExcerpt = isolateDepth > 0
    ? `${excerpt}${"\u2069".repeat(isolateDepth)}`
    : excerpt;
  return balancedExcerpt || `Evidence-grounded ${kind}`;
}

function derivedAnalysisDiscourse(layer) {
  return `Preserve the passage's evidence-grounded ${layer} function.`;
}

function derivedAnalysisRationale(layer) {
  return `Use the ${layer} layer to make cited source commitments legible without adding meaning.`;
}

function rejectedAnalysisWire(category) {
  const result = {};
  ANALYSIS_DECODER_FAILURES.set(
    result,
    ANALYSIS_DECODER_FAILURE_CATEGORY_SET.has(category) ? category : "response-shape",
  );
  return result;
}

function decodeAnalysisWire(value, fit) {
  const ledgerIds = (fit?.request?.documentLedger ?? []).map(({ id }) => id);
  if (!fit || !exactKeys(value, ["d", "p", "l"])
    || !Array.isArray(value.p) || !Array.isArray(value.l)) {
    return rejectedAnalysisWire("response-shape");
  }
  if (value.p.length !== fit.passages.length) {
    return rejectedAnalysisWire("passage-coverage");
  }
  if (value.l.length > Math.min(ANALYSIS_LINK_ITEM_LIMIT, fit.analysisAtomLimit)) {
    return rejectedAnalysisWire("relation");
  }
  const documentKind = wireEnumValue(value.d, ANALYSIS_DOCUMENT_KINDS);
  if (documentKind === null) return rejectedAnalysisWire("response-shape");
  const rawPassages = [];
  const flatAtoms = [];
  for (let passageIndex = 0; passageIndex < value.p.length; passageIndex += 1) {
    const passage = value.p[passageIndex];
    const evidenceIds = fit.evidenceIdsByPassage[passageIndex];
    const evidenceRecords = fit.evidenceRecordsByPassage[passageIndex];
    if (!Array.isArray(passage) || passage.length !== 4
      || !Array.isArray(passage[2]) || !Array.isArray(passage[3])) {
      return rejectedAnalysisWire("response-shape");
    }
    if (passage[2].length < fit.minimumAtomAllocations[passageIndex]) {
      return rejectedAnalysisWire("evidence");
    }
    if (passage[2].length > fit.atomAllocations[passageIndex]) {
      return rejectedAnalysisWire("capacity");
    }
    if (passage[3].length !== ANALYSIS_CONFORMANCE_ITEM_LIMIT) {
      return rejectedAnalysisWire("conformance");
    }
    const layer = wireEnumValue(passage[0], ANALYSIS_LAYERS);
    const disposition = wireEnumValue(passage[1], ANALYSIS_DISPOSITIONS);
    if (layer === null || disposition === null) {
      return rejectedAnalysisWire("response-shape");
    }
    const conformanceSelections = passage[3].map((mask) => (
      wireMaskSelections(mask, evidenceIds)
    ));
    if (conformanceSelections.some((selection) => selection === null)) {
      return rejectedAnalysisWire("conformance");
    }
    const atoms = [];
    for (const rawAtom of passage[2]) {
      if (!Array.isArray(rawAtom) || rawAtom.length !== 4) {
        return rejectedAnalysisWire("response-shape");
      }
      const kind = wireEnumValue(rawAtom[0], ANALYSIS_ATOM_KINDS);
      const priority = wireEnumValue(rawAtom[1], ANALYSIS_PRIORITIES);
      const rawPreservation = wireEnumValue(rawAtom[2], ANALYSIS_PRESERVATIONS);
      const evidencePositions = wireIndexPositions(rawAtom[3], evidenceIds.length, {
        minimum: 1,
        maximum: 3,
      });
      if (kind === null || priority === null || rawPreservation === null) {
        return rejectedAnalysisWire("response-shape");
      }
      if (evidencePositions === null) return rejectedAnalysisWire("evidence");
      const evidenceSpanIds = evidencePositions.map((evidenceIndex) => evidenceIds[evidenceIndex]);
      const selectedEvidenceRecords = evidencePositions.map((evidenceIndex) => (
        evidenceRecords[evidenceIndex]
      ));
      const preservation = rawPreservation === "exact"
        && !selectedEvidenceRecords.every(({ kind: evidenceKind }) => evidenceKind === "literal")
        ? "equivalent"
        : rawPreservation;
      const atom = {
        id: `a${flatAtoms.length.toString(36)}`,
        kind,
        value: derivedAnalysisAtomValue(selectedEvidenceRecords, kind),
        priority,
        preservation,
        evidenceSpanIds,
        links: [],
      };
      atoms.push(atom);
      flatAtoms.push(atom);
    }
    rawPassages.push({
      passageId: fit.passages[passageIndex].id,
      discourseFunction: derivedAnalysisDiscourse(layer),
      layer,
      disposition,
      rationale: derivedAnalysisRationale(layer),
      atoms,
      conformanceSelections,
      evidenceIds,
    });
  }
  if (flatAtoms.length > fit.analysisAtomLimit) return rejectedAnalysisWire("capacity");
  const linkKeys = new Set();
  for (const rawLink of value.l) {
    if (!Array.isArray(rawLink) || rawLink.length !== 3
      || !Number.isSafeInteger(rawLink[0]) || !Number.isSafeInteger(rawLink[2])) {
      return rejectedAnalysisWire("relation");
    }
    const sourceAtom = flatAtoms[rawLink[0]];
    const relation = wireEnumValue(rawLink[1], ANALYSIS_RELATIONS);
    const targetAtomId = rawLink[2] >= 0
      ? flatAtoms[rawLink[2]]?.id
      : ledgerIds[-rawLink[2] - 1];
    const key = `${rawLink[0]}\u241f${relation}\u241f${targetAtomId}`;
    if (relation === null || !sourceAtom || typeof targetAtomId !== "string") {
      return rejectedAnalysisWire("relation");
    }
    if (targetAtomId === sourceAtom.id || linkKeys.has(key)) continue;
    if (sourceAtom.links.length >= INTERNAL_ANALYSIS_ATOM_SCHEMA.properties.links.maxItems) {
      return rejectedAnalysisWire("relation");
    }
    linkKeys.add(key);
    sourceAtom.links.push({ relation, targetAtomId });
  }
  const passages = [];
  for (const rawPassage of rawPassages) {
    const coveredEvidence = new Set(rawPassage.atoms.flatMap(({ evidenceSpanIds }) => evidenceSpanIds));
    if (coveredEvidence.size !== rawPassage.evidenceIds.length
      || rawPassage.evidenceIds.some((id) => !coveredEvidence.has(id))) {
      return rejectedAnalysisWire("evidence");
    }
    const ambiguityAtomIds = rawPassage.atoms
      .filter(({ kind }) => kind === "ambiguity" || kind === "uncertainty")
      .map(({ id }) => id);
    if (ambiguityAtomIds.length > INTERNAL_ANALYSIS_PASSAGE_SCHEMA
      .properties.ambiguityAtomIds.maxItems) return rejectedAnalysisWire("ambiguity");
    let conformanceCriteria = [];
    let conformanceEvidenceSpanIds = [];
    let conformanceAssertions = [];
    let disposition = rawPassage.disposition;
    if (disposition === "retain-if-conformant") {
      conformanceCriteria = [
        ...LATTICE_CONFORMANCE_CRITERIA.universal,
        ...LATTICE_CONFORMANCE_CRITERIA[rawPassage.layer],
      ];
      if (conformanceCriteria.length !== ANALYSIS_CONFORMANCE_ITEM_LIMIT) {
        return rejectedAnalysisWire("conformance");
      }
      conformanceAssertions = rawPassage.conformanceSelections.map((evidenceSpanIds, index) => (
        evidenceSpanIds.length === 0 ? null : {
          criterion: conformanceCriteria[index],
          evidenceSpanIds,
        }
      ));
      const assertedEvidence = new Set(
        conformanceAssertions.flatMap((assertion) => assertion?.evidenceSpanIds ?? []),
      );
      if (conformanceAssertions.some((assertion) => assertion === null)
        || assertedEvidence.size !== rawPassage.evidenceIds.length
        || rawPassage.evidenceIds.some((id) => !assertedEvidence.has(id))) {
        disposition = "rewrite";
        conformanceCriteria = [];
        conformanceAssertions = [];
      } else {
        conformanceEvidenceSpanIds = [...rawPassage.evidenceIds];
      }
    }
    passages.push({
      passageId: rawPassage.passageId,
      discourseFunction: rawPassage.discourseFunction,
      layer: rawPassage.layer,
      disposition,
      rationale: rawPassage.rationale,
      atoms: rawPassage.atoms,
      ambiguityAtomIds,
      conformanceCriteria,
      conformanceEvidenceSpanIds,
      conformanceAssertions,
    });
  }
  return { documentKind, passages, questions: [] };
}

function wireAtomStatuses(statuses, atomIds) {
  if (typeof statuses !== "string" || statuses.length !== atomIds.length
    || !/^[012]+$/u.test(statuses)) return null;
  return Object.freeze({
    checked: atomIds.filter((_id, index) => statuses[index] === "1"),
    missing: atomIds.filter((_id, index) => statuses[index] === "2"),
  });
}

function rejectedPrivateWire(category, rule = "unknown") {
  return rememberRejectedResult({}, category, rule);
}

function rejectedFieldSetCategory(value) {
  return record(value) ? "field-set" : "object-type";
}

function rejectedEnumCategory(value) {
  return typeof value === "number" ? "value-domain" : "value-type";
}

function rejectedMaskCategory(mask, values, { minimum = 0, maximum = values.length } = {}) {
  try {
    if (typeof mask !== "string") return "value-type";
    if (mask.length !== values.length || !/^[01]+$/u.test(mask)) return "value-domain";
    const selectedCount = values.filter((_value, index) => mask[index] === "1").length;
    if (selectedCount < minimum) return "coverage";
    if (selectedCount > maximum) return "collection-bound";
    return "other";
  } catch {
    return "other";
  }
}

// Classify only an already rejected guard with a source-defined base code.
function rejectedFieldSetRule(value, base) {
  try { return base + (record(value) ? "F" : "O"); } catch { return "unknown"; }
}

function rejectedEnumRule(value, base) {
  try { return base + (typeof value !== "number" ? "T" : !Number.isSafeInteger(value) ? "I" : "R"); }
  catch { return "unknown"; }
}

function rejectedStringRule(value, values, base, { alphabet = /^[01]+$/u, minimum = 0, maximum = values.length } = {}) {
  try {
    if (typeof value !== "string") return base + "T";
    if (value.length !== values.length) return base + "L";
    if (!alphabet.test(value)) return base + "A";
    const selected = values.filter((_item, index) => value[index] === "1").length;
    if (selected < minimum) return base + "M";
    if (selected > maximum) return base + "X";
  } catch { /* Observation must preserve rejection. */ }
  return "unknown";
}

function decodeVerificationWire(value, fit) {
  const passageKeys = fit?.passages?.map((_passage, index) => String(index));
  if (!fit) return rejectedPrivateWire("other", "V00");
  if (!exactKeys(value, ["d", "g", "p", "i"])) return rejectedPrivateWire(rejectedFieldSetCategory(value), rejectedFieldSetRule(value, "V01"));
  if (!exactKeys(value.p, passageKeys)) return rejectedPrivateWire(rejectedFieldSetCategory(value.p), rejectedFieldSetRule(value.p, "V02"));
  if (!Array.isArray(value.i)) return rejectedPrivateWire("value-type", "V03");
  if (value.i.length > VERIFICATION_SCHEMA.properties.issues.maxItems) return rejectedPrivateWire("collection-bound", "V04");
  const decision = wireEnumValue(value.d, VERIFICATION_DECISIONS);
  const failedGates = wireMaskSelections(value.g, VERIFICATION_GATES);
  if (decision === null) return rejectedPrivateWire(rejectedEnumCategory(value.d), rejectedEnumRule(value.d, "V05"));
  if (failedGates === null) return rejectedPrivateWire(rejectedMaskCategory(value.g, VERIFICATION_GATES), rejectedStringRule(value.g, VERIFICATION_GATES, "V06"));
  const passages = [];
  for (let index = 0; index < fit.passages.length; index += 1) {
    const passage = value.p[String(index)];
    const plan = fit.plans[index];
    const evidenceIds = fit.evidenceByPassage[index].ids;
    if (!exactKeys(passage, ["a", "u", "s", "f", "l", "x", "y", "c"])) return rejectedPrivateWire(rejectedFieldSetCategory(passage), rejectedFieldSetRule(passage, "V07"));
    if (typeof passage.u !== "boolean") return rejectedPrivateWire("value-type", "V08");
    if (!exactKeys(passage.c, ["v", "s", "k"])) return rejectedPrivateWire(rejectedFieldSetCategory(passage.c), rejectedFieldSetRule(passage.c, "V09"));
    if (typeof passage.c.v !== "boolean") return rejectedPrivateWire("value-type", "V10");
    if (!Array.isArray(passage.c.k)) return rejectedPrivateWire("value-type", "V11");
    const atomStatuses = wireAtomStatuses(passage.a, plan.atomIds);
    const unmodeledSpanIds = wireMaskSelections(passage.s, evidenceIds, { maximum: 12 });
    const failedChecks = wireMaskSelections(passage.f, VERIFICATION_PASSAGE_CHECKS);
    const independentLayer = wireEnumValue(passage.l, VERIFICATION_LAYERS);
    const layerEvidenceAtomIds = wireMaskSelections(passage.x, plan.atomIds, { minimum: 1 });
    const layerEvidenceSpanIds = wireMaskSelections(passage.y, evidenceIds, { minimum: 1 });
    const conformanceEvidenceSpanIds = wireMaskSelections(passage.c.s, evidenceIds);
    if (atomStatuses === null) return rejectedPrivateWire(typeof passage.a === "string" ? "value-domain" : "value-type", rejectedStringRule(passage.a, plan.atomIds, "V12", { alphabet: /^[012]+$/u }));
    if (unmodeledSpanIds === null) return rejectedPrivateWire(rejectedMaskCategory(passage.s, evidenceIds, { maximum: 12 }), rejectedStringRule(passage.s, evidenceIds, "V13", { maximum: 12 }));
    if (failedChecks === null) return rejectedPrivateWire(rejectedMaskCategory(passage.f, VERIFICATION_PASSAGE_CHECKS), rejectedStringRule(passage.f, VERIFICATION_PASSAGE_CHECKS, "V14"));
    if (independentLayer === null) return rejectedPrivateWire(rejectedEnumCategory(passage.l), rejectedEnumRule(passage.l, "V15"));
    if (layerEvidenceAtomIds === null) return rejectedPrivateWire(rejectedMaskCategory(passage.x, plan.atomIds, { minimum: 1 }), rejectedStringRule(passage.x, plan.atomIds, "V16", { minimum: 1 }));
    if (layerEvidenceSpanIds === null) return rejectedPrivateWire(rejectedMaskCategory(passage.y, evidenceIds, { minimum: 1 }), rejectedStringRule(passage.y, evidenceIds, "V17", { minimum: 1 }));
    if (conformanceEvidenceSpanIds === null) return rejectedPrivateWire(rejectedMaskCategory(passage.c.s, evidenceIds), rejectedStringRule(passage.c.s, evidenceIds, "V18"));
    const rewrite = plan.disposition === "rewrite";
    const rawCriterionChecks = passage.c.k;
    if (rewrite) {
      if (passage.c.v !== false || conformanceEvidenceSpanIds.length !== 0
        || rawCriterionChecks.length !== 0) return rejectedPrivateWire("consistency", "V19");
    } else if (rawCriterionChecks.length !== plan.conformanceCriteria.length) {
      return rejectedPrivateWire("coverage", "V20");
    }
    const criterionChecks = [];
    for (let criterionIndex = 0; criterionIndex < rawCriterionChecks.length; criterionIndex += 1) {
      const check = rawCriterionChecks[criterionIndex];
      if (!exactKeys(check, ["v", "s"])) return rejectedPrivateWire(rejectedFieldSetCategory(check), rejectedFieldSetRule(check, "V21"));
      if (typeof check.v !== "boolean") return rejectedPrivateWire("value-type", "V22");
      const evidenceSpanIds = wireMaskSelections(check.s, evidenceIds, {
        minimum: check.v ? 1 : 0,
      });
      if (evidenceSpanIds === null) return rejectedPrivateWire(rejectedMaskCategory(check.s, evidenceIds, { minimum: check.v ? 1 : 0 }), rejectedStringRule(check.s, evidenceIds, "V23", { minimum: check.v ? 1 : 0 }));
      criterionChecks.push({
        criterion: plan.conformanceCriteria[criterionIndex],
        passed: check.v,
        evidenceSpanIds,
      });
    }
    passages.push({
      passageId: plan.passageId,
      checkedAtomIds: atomStatuses.checked,
      missingAtomIds: atomStatuses.missing,
      unsupportedClaims: passage.u
        ? [{ claim: "The candidate contains unsupported meaning.", evidence: "" }]
        : [],
      unmodeledSpanIds,
      failedChecks,
      conformanceConfirmed: passage.c.v,
      conformanceEvidenceSpanIds,
      independentLayer,
      layerEvidenceAtomIds,
      layerEvidenceSpanIds,
      criterionChecks,
    });
  }
  const issues = [];
  const issueKeys = new Set();
  for (let index = 0; index < value.i.length; index += 1) {
    const issue = value.i[index];
    if (!exactKeys(issue, ["c", "p"])) return rejectedPrivateWire(rejectedFieldSetCategory(issue), rejectedFieldSetRule(issue, "V24"));
    if (!Number.isSafeInteger(issue.p)) return rejectedPrivateWire(rejectedEnumCategory(issue.p), rejectedEnumRule(issue.p, "V25"));
    if (issue.p < -1 || issue.p >= fit.passages.length) return rejectedPrivateWire("reference", "V26");
    const checkIndex = issue.c;
    const check = wireEnumValue(checkIndex, VERIFICATION_ISSUE_CHECKS);
    if (check === null) return rejectedPrivateWire(rejectedEnumCategory(checkIndex), rejectedEnumRule(checkIndex, "V27"));
    const issueKey = `${checkIndex}:${issue.p}`;
    if (issueKeys.has(issueKey)) return rejectedPrivateWire("duplicate", "V28");
    issueKeys.add(issueKey);
    issues.push({
      id: `wire-issue-${index + 1}`,
      check,
      passageId: issue.p === -1 ? "" : fit.passages[issue.p].id,
      atomIds: [],
      message: "The independent check did not clear a required condition.",
    });
  }
  return {
    decision,
    failedGates,
    passages,
    issues,
    questions: [],
  };
}

function decodeCertificationWire(value, fit) {
  if (!fit) return rejectedPrivateWire("other", "C00");
  if (!exactKeys(value, ["c", "o", "d", "k", "i"])) return rejectedPrivateWire(rejectedFieldSetCategory(value), rejectedFieldSetRule(value, "C01"));
  if (value.c !== fit.certificateId) return rejectedPrivateWire("reference", "C02");
  if (!Array.isArray(value.o)) return rejectedPrivateWire("value-type", "C03");
  if (value.o.length !== fit.obligationIds.length) return rejectedPrivateWire("coverage", "C04");
  if (value.o.some((id, index) => id !== fit.obligationIds[index])) return rejectedPrivateWire("reference", "C05");
  if (!Array.isArray(value.k)) return rejectedPrivateWire("value-type", "C06");
  if (value.k.length !== CERTIFICATION_CHECK_NAMES.length) return rejectedPrivateWire("collection-bound", "C07");
  if (value.k.some((check) => typeof check !== "boolean")) return rejectedPrivateWire("value-type", "C08");
  if (!Array.isArray(value.i)) return rejectedPrivateWire("value-type", "C09");
  if (value.i.length > DOCUMENT_CERTIFICATION_SCHEMA.properties.issues.maxItems) return rejectedPrivateWire("collection-bound", "C10");
  const decision = wireEnumValue(value.d, CERTIFICATION_DECISIONS);
  if (decision === null) return rejectedPrivateWire(rejectedEnumCategory(value.d), rejectedEnumRule(value.d, "C11"));
  const issueIndices = new Set();
  const issues = [];
  for (let index = 0; index < value.i.length; index += 1) {
    const checkIndex = value.i[index];
    const check = wireEnumValue(checkIndex, CERTIFICATION_CHECK_NAMES);
    if (check === null) return rejectedPrivateWire(rejectedEnumCategory(checkIndex), rejectedEnumRule(checkIndex, "C12"));
    if (issueIndices.has(checkIndex)) return rejectedPrivateWire("duplicate", "C13");
    issueIndices.add(checkIndex);
    issues.push({
      id: `wire-issue-${index + 1}`,
      check,
      message: "The independent document check did not clear a required condition.",
    });
  }
  return {
    certificateId: value.c,
    obligationIds: [...value.o],
    decision,
    checks: Object.fromEntries(CERTIFICATION_CHECK_NAMES.map((name, index) => (
      [name, value.k[index]]
    ))),
    issues,
  };
}

function raceAbort(operation, signal) {
  if (!signal) return Promise.resolve(operation);
  if (signal.aborted) return Promise.reject(signal.reason ?? abortError());
  return new Promise((resolve, reject) => {
    const cancel = () => reject(signal.reason ?? abortError());
    signal.addEventListener("abort", cancel, { once: true });
    Promise.resolve(operation).then(
      (value) => {
        signal.removeEventListener("abort", cancel);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", cancel);
        reject(error);
      },
    );
  });
}

function ignoreCancellation(cancellation) {
  if (cancellation && typeof cancellation.catch === "function") {
    cancellation.catch(() => {});
  }
}

function cancelReader(reader, reason) {
  try {
    ignoreCancellation(reader.cancel(reason));
  } catch {
    // Cancellation is best-effort and must not extend the provider deadline.
  }
}

function discardResponseBody(response, reason) {
  if (!response?.body) return;
  try {
    ignoreCancellation(response.body.cancel(reason));
  } catch {
    // A rejected provider response is never read, logged, or reflected.
  }
}

function linkedDeadline(parentSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const abortFromParent = () => controller.abort(parentSignal.reason ?? abortError());
  if (parentSignal?.aborted) abortFromParent();
  else parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(abortError("The Lattice provider request timed out."));
  }, timeoutMs);
  return Object.freeze({
    signal: controller.signal,
    didTimeOut: () => timedOut,
    dispose() {
      clearTimeout(timeout);
      parentSignal?.removeEventListener("abort", abortFromParent);
    },
  });
}

async function boundedResponseText(response, maximumBytes, signal) {
  const claimedLength = response.headers.get("content-length");
  if (claimedLength !== null) {
    if (!/^\d+$/u.test(claimedLength) || Number(claimedLength) > maximumBytes) {
      discardResponseBody(response);
      throw withProviderDiagnostic(
        providerError("provider_response_too_large", "The Lattice provider response exceeded its limit."),
        { responseSize: /^\d+$/u.test(claimedLength) ? sizeBucket(Number(claimedLength)) : "none" },
      );
    }
  }

  if (!response.body) return Object.freeze({ text: "", responseSize: "0" });
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let total = 0;
  let result = "";
  try {
    while (true) {
      const part = await raceAbort(reader.read(), signal);
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maximumBytes) {
        cancelReader(reader);
        throw withProviderDiagnostic(
          providerError("provider_response_too_large", "The Lattice provider response exceeded its limit."),
          { responseSize: sizeBucket(total) },
        );
      }
      result += decoder.decode(part.value, { stream: true });
    }
    result += decoder.decode();
    return Object.freeze({ text: result, responseSize: sizeBucket(total) });
  } catch (error) {
    if (error instanceof LatticeProviderError || signal?.aborted) throw error;
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned an unreadable response.", {
        cause: error,
      }),
      { subtype: "response_read", responseSize: sizeBucket(total) },
    );
  } finally {
    if (signal?.aborted) {
      cancelReader(reader, signal.reason);
    }
    try {
      reader.releaseLock();
    } catch {
      // A pending platform read remains governed by the same abort signal.
    }
  }
}

export function providerEnvelopeSubtypeIsConsistent(subtype, stage, providerFinishReason) {
  if (!MALFORMED_SUBTYPE_SET.has(subtype)) return false;
  if (!TOOL_ENVELOPE_SUBTYPES.includes(subtype)) return true;
  if (!["verification", "certification"].includes(stage)) return false;
  if (subtype === "S01") return providerFinishReason === "tool_calls";
  return subtype.startsWith("S") ? providerFinishReason === "stop"
    : ["stop", "tool_calls"].includes(providerFinishReason);
}

function rejectedNamedToolSubtype(toolCall, toolName) {
  try {
    if (!record(toolCall)) return "E00";
    if (typeof toolCall.id !== "string") return "E01";
    if (!toolCall.id.trim()) return "E02";
    if (toolCall.id.length > 256) return "E03";
    if (toolCall.type !== "function") return "E04";
    if (!record(toolCall.function)) return "E05";
    if (toolCall.function.name !== toolName) return "E06";
    if (typeof toolCall.function.arguments !== "string") return "E07";
  } catch { /* Observation must preserve the rejected envelope outcome. */ }
  return "message_shape";
}

function rejectedStoppedToolSubtype(message, providerFinishReason, allowStoppedToolContent) {
  try {
    if (!allowStoppedToolContent) return "message_shape";
    if (providerFinishReason !== "stop") return "S01";
    if (Object.hasOwn(message, "tool_calls")) {
      if (!Array.isArray(message.tool_calls)) return "S02";
      if (message.tool_calls.length === 0) return "S03";
      if (message.tool_calls.length > 1) return "S04";
    }
    if (Object.hasOwn(message, "function_call")) return "S05";
    if (!Object.keys(message).every((key) => key === "role" || key === "content")) return "S06";
    if (typeof message.content !== "string") return "S07";
  } catch { /* Observation must preserve the rejected envelope outcome. */ }
  return "message_shape";
}

function parsedProviderContent(body, responseSize, toolName, allowStoppedToolContent, requireMinimalVerificationContent) {
  let envelope;
  try {
    envelope = JSON.parse(body);
  } catch (error) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned invalid JSON.", { cause: error }),
      { subtype: "envelope_json", responseSize },
    );
  }
  const completionTokens = completionTokenBucket(envelope?.usage?.completion_tokens);
  if (!Array.isArray(envelope?.choices) || envelope.choices.length !== 1) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned an invalid completion envelope."),
      { subtype: "choice_count", responseSize, completionTokens },
    );
  }
  const choice = envelope.choices[0];
  if (!record(choice)) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned an invalid completion envelope."),
      { subtype: "choice_shape", responseSize, completionTokens },
    );
  }
  const providerFinishReason = finishReason(choice.finish_reason);
  const provisionalToolArguments = toolName !== undefined
    && record(choice.message)
    && Array.isArray(choice.message.tool_calls)
    && typeof choice.message.tool_calls[0]?.function?.arguments === "string"
    ? choice.message.tool_calls[0].function.arguments
    : null;
  const providerContentSize = sizeBucket(
    provisionalToolArguments !== null
      ? provisionalToolArguments.length
      : record(choice.message) && typeof choice.message.content === "string"
      ? choice.message.content.length
      : null,
  );
  const validFinishReason = toolName === undefined
    ? choice.finish_reason === "stop"
    : choice.finish_reason === "stop" || choice.finish_reason === "tool_calls";
  if (!validFinishReason) {
    const code = choice.finish_reason === "length"
      ? "provider_output_limit"
      : "provider_malformed_response";
    throw withProviderDiagnostic(
      providerError(code, code === "provider_output_limit"
        ? "The Lattice provider reached its output limit."
        : "The Lattice provider returned an invalid completion envelope."),
      {
        subtype: code === "provider_malformed_response" ? "finish_reason" : "none",
        finishReason: providerFinishReason,
        responseSize,
        contentSize: providerContentSize,
        completionTokens,
      },
    );
  }
  if (!record(choice.message)) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned an invalid completion envelope."),
      {
        subtype: "message_shape",
        finishReason: providerFinishReason,
        responseSize,
        completionTokens,
      },
    );
  }
  if (choice.message.role !== "assistant") {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned an invalid completion envelope."),
      {
        subtype: "message_role",
        finishReason: providerFinishReason,
        responseSize,
        completionTokens,
      },
    );
  }
  if (requireMinimalVerificationContent && !exactKeys(choice.message, ["role", "content"])) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned an invalid completion envelope."),
      {
        subtype: "message_shape",
        finishReason: providerFinishReason,
        responseSize,
        contentSize: providerContentSize,
        completionTokens,
      },
    );
  }
  if (toolName !== undefined) {
    const toolCalls = choice.message.tool_calls;
    let content;
    if (Array.isArray(toolCalls) && toolCalls.length === 1) {
      // A single exact named call is authoritative. Auxiliary assistant content
      // and a legacy function_call are ignored and never interpreted.
      const toolCall = toolCalls[0];
      if (!record(toolCall)
        || typeof toolCall.id !== "string"
        || !toolCall.id.trim()
        || toolCall.id.length > 256
        || toolCall.type !== "function"
        || !record(toolCall.function)
        || toolCall.function.name !== toolName
        || typeof toolCall.function.arguments !== "string") {
        throw withProviderDiagnostic(
          providerError("provider_malformed_response", "The Lattice provider returned an invalid completion envelope."),
          {
            subtype: rejectedNamedToolSubtype(toolCall, toolName),
            finishReason: providerFinishReason,
            responseSize,
            contentSize: providerContentSize,
            completionTokens,
          },
        );
      }
      content = toolCall.function.arguments;
    } else if (allowStoppedToolContent
      && choice.finish_reason === "stop"
      && !Object.hasOwn(choice.message, "tool_calls")
      && !Object.hasOwn(choice.message, "function_call")
      && Object.keys(choice.message).every((key) => key === "role" || key === "content")
      && typeof choice.message.content === "string") {
      // Normalize only the explicitly enabled, minimal stopped-content
      // compatibility envelope. Parsing and the production stage's closed wire
      // decoder remain mandatory; null/empty tool fields, legacy calls, extra
      // message fields, and length-limited content never enter this path.
      content = choice.message.content;
    } else {
      throw withProviderDiagnostic(
        providerError("provider_malformed_response", "The Lattice provider returned an invalid completion envelope."),
        {
          subtype: rejectedStoppedToolSubtype(choice.message, choice.finish_reason, allowStoppedToolContent),
          finishReason: providerFinishReason,
          responseSize,
          contentSize: providerContentSize,
          completionTokens,
        },
      );
    }
    const contentSize = sizeBucket(content.length);
    if (!content.trim()) {
      throw withProviderDiagnostic(
        providerError("provider_malformed_response", "The Lattice provider returned no structured content."),
        {
          subtype: "content_empty",
          finishReason: providerFinishReason,
          responseSize,
          contentSize,
          completionTokens,
        },
      );
    }
    if (content.length > LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT) {
      throw withProviderDiagnostic(
        providerError("provider_response_too_large", "The Lattice provider content exceeded its limit."),
        {
          finishReason: providerFinishReason,
          responseSize,
          contentSize,
          completionTokens,
        },
      );
    }
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw withProviderDiagnostic(
        providerError("provider_malformed_response", "The Lattice provider returned invalid structured content.", {
          cause: error,
        }),
        {
          subtype: "content_json",
          finishReason: providerFinishReason,
          responseSize,
          contentSize,
          completionTokens,
        },
      );
    }
    if (!record(parsed)) {
      throw withProviderDiagnostic(
        providerError("provider_malformed_response", "The Lattice provider returned invalid structured content.", {
          cause: new TypeError("Structured content was not an object."),
        }),
        {
          subtype: "content_shape",
          finishReason: providerFinishReason,
          responseSize,
          contentSize,
          completionTokens,
        },
      );
    }
    return parsed;
  }
  const content = choice.message.content;
  const contentSize = providerContentSize;
  if (typeof content !== "string" || !content.trim()) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned no structured content."),
      {
        subtype: "content_empty",
        finishReason: providerFinishReason,
        responseSize,
        contentSize,
        completionTokens,
      },
    );
  }
  if (content.length > LATTICE_PROVIDER_CONTENT_CHARACTER_LIMIT) {
    throw withProviderDiagnostic(
      providerError("provider_response_too_large", "The Lattice provider content exceeded its limit."),
      {
        finishReason: providerFinishReason,
        responseSize,
        contentSize,
        completionTokens,
      },
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned invalid structured content.", {
        cause: error,
      }),
      {
        subtype: "content_json",
        finishReason: providerFinishReason,
        responseSize,
        contentSize,
        completionTokens,
      },
    );
  }
  if (!record(parsed)) {
    throw withProviderDiagnostic(
      providerError("provider_malformed_response", "The Lattice provider returned invalid structured content.", {
        cause: new TypeError("Structured content was not an object."),
      }),
      {
        subtype: "content_shape",
        finishReason: providerFinishReason,
        responseSize,
        contentSize,
        completionTokens,
      },
    );
  }
  return parsed;
}

export async function requestHuggingFaceJson({
  token,
  role,
  messages,
  schema,
  schemaName,
  responseGuide,
  schemaDescription,
  responseFormat,
  toolName,
  maxTokens,
  temperature,
  topP,
  topK: unsupportedTopK,
  minP: unsupportedMinP,
  toolChoice,
  allowStoppedToolContent = false,
  requireMinimalVerificationContent = false,
  observeQualificationHttpHeaders = false,
  presencePenalty,
  signal,
  fetchImpl = globalThis.fetch,
  callTimeoutMs = LATTICE_PROVIDER_CALL_TIMEOUT_MS,
  maximumRequestBytes = LATTICE_PROVIDER_REQUEST_BYTE_LIMIT,
  maximumResponseBytes = LATTICE_PROVIDER_RESPONSE_BYTE_LIMIT,
}) {
  const resolvedResponseFormat = toolName === undefined
    ? responseFormat ?? "json_object"
    : undefined;
  if (typeof token !== "string" || !token.trim()) {
    throw providerError("provider_not_configured", "The Lattice provider is not configured.");
  }
  if (!REMOTE_ROLES.has(role) || !Array.isArray(messages) || !record(schema)
    || typeof schemaName !== "string" || !/^[A-Za-z0-9_-]{1,64}$/u.test(schemaName)
    || !validPositiveInteger(maxTokens) || !validPositiveInteger(callTimeoutMs)
    || !validPositiveInteger(maximumRequestBytes)
    || !validPositiveInteger(maximumResponseBytes) || typeof fetchImpl !== "function"
    || !Number.isFinite(temperature) || temperature < 0 || temperature > 2
    || !Number.isFinite(topP) || topP <= 0 || topP > 1
    || unsupportedTopK !== undefined
    || unsupportedMinP !== undefined
    || (presencePenalty !== undefined
      && (!Number.isFinite(presencePenalty) || presencePenalty < 0 || presencePenalty > 2))
    || (responseGuide !== undefined
      && (typeof responseGuide !== "string" || !responseGuide.trim() || responseGuide.length > 4_096))
    || (schemaDescription !== undefined
      && (typeof schemaDescription !== "string" || !schemaDescription.trim()
        || schemaDescription.length > 256))
    || (schemaDescription !== undefined && resolvedResponseFormat !== "json_schema")
    || (responseFormat !== undefined && !RESPONSE_FORMATS.has(responseFormat))
    || (responseFormat !== undefined && toolName !== undefined)
    || (resolvedResponseFormat === "json_schema" && role !== "generator" && !requireMinimalVerificationContent)
    || (toolName !== undefined
      && (typeof toolName !== "string" || !/^[A-Za-z0-9_-]{1,64}$/u.test(toolName)))
    || (toolChoice !== undefined && toolChoice !== "named")
    || (toolChoice !== undefined && toolName === undefined)
    || typeof allowStoppedToolContent !== "boolean"
    || typeof requireMinimalVerificationContent !== "boolean"
    || typeof observeQualificationHttpHeaders !== "boolean"
    || (requireMinimalVerificationContent
      && (role !== "verifier"
        || schemaName !== VERIFICATION_TOOL_NAME
        || resolvedResponseFormat !== "json_schema"
        || toolName !== undefined
        || toolChoice !== undefined
        || allowStoppedToolContent))
    || (allowStoppedToolContent
      && (role !== "verifier"
        || toolChoice !== "named"
        || !STOPPED_TOOL_CONTENT_NAMES.has(toolName)))
    || (toolName !== undefined && role !== "verifier")
    || (toolName === undefined && role === "verifier"
      && responseFormat !== "json_object" && !requireMinimalVerificationContent)) {
    throw new TypeError("The Lattice provider received an invalid server configuration.");
  }

  // Nscale analysis uses strict JSON Schema. Candidate and repair generation use
  // one JSON-object assistant channel with the closed schema in trusted
  // instructions. The exact DeepInfra model's current Router metadata advertises
  // tools, not structured output. Verification and certification use the retained
  // named-tool path with its explicit minimal stopped-content compatibility.
  // Both private paths still require the exact wire decoder and host validation.
  const providerRequestBody = JSON.stringify({
    model: LATTICE_REMOTE_MODELS[role],
    messages: toolName === undefined
      ? resolvedResponseFormat === "json_schema"
        ? jsonSchemaMessages(messages, schemaName, responseGuide)
        : jsonObjectMessages(messages, schemaName, schema, responseGuide)
      : forcedToolMessages(messages, toolName),
    ...(toolName === undefined
      ? {
        response_format: resolvedResponseFormat === "json_schema"
          ? {
            type: "json_schema",
            json_schema: {
              name: schemaName,
              description: schemaDescription
                ?? responseGuide
                ?? "Supply one complete structured response.",
              schema,
              strict: true,
            },
          }
          : { type: "json_object" },
      }
      : {
        tools: [{
          type: "function",
          function: {
            name: toolName,
            description: responseGuide ?? "Supply one complete structured response.",
            parameters: schema,
          },
        }],
        tool_choice: {
          type: "function",
          function: { name: toolName },
        },
      }),
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
    ...(presencePenalty === undefined ? {} : { presence_penalty: presencePenalty }),
    seed: 71_903,
    stream: false,
  });
  const requestByteLength = new TextEncoder().encode(providerRequestBody).byteLength;
  const requestSize = sizeBucket(requestByteLength);
  if (requestByteLength > maximumRequestBytes) {
    throw withProviderDiagnostic(
      providerError(
        "provider_request_too_large",
        "The Lattice provider request exceeded its byte limit.",
      ),
      { requestSize },
    );
  }

  const deadline = linkedDeadline(signal, callTimeoutMs);
  try {
    let response;
    try {
      const responsePromise = Promise.resolve(fetchImpl(HUGGING_FACE_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          ...JSON_HEADERS,
          Authorization: `Bearer ${token}`,
        },
        body: providerRequestBody,
        cache: "no-store",
        credentials: "omit",
        // Workerd does not implement Fetch's `error` redirect mode. Manual
        // mode exposes a 3xx response for the explicit rejection below.
        redirect: "manual",
        referrerPolicy: "no-referrer",
        signal: deadline.signal,
      }));
      void responsePromise.then((lateResponse) => {
        if (deadline.signal.aborted) discardResponseBody(lateResponse, deadline.signal.reason);
      }, () => {});
      response = await raceAbort(responsePromise, deadline.signal);
    } catch (error) {
      if (deadline.didTimeOut()) {
        throw providerError("provider_timeout", "The Lattice provider timed out.", { cause: error });
      }
      if (signal?.aborted) throw signal.reason ?? abortError();
      throw providerError("provider_unavailable", "The Lattice provider could not be reached.", { cause: error });
    }

    try {
      if (!(response instanceof Response)) {
        throw withProviderDiagnostic(
          providerError("provider_malformed_response", "The Lattice provider returned an invalid response."),
          { subtype: "response_type" },
        );
      }
      if (response.redirected
        || response.type === "opaqueredirect"
        || (response.status >= 300 && response.status < 400)
        || response.url && response.url !== HUGGING_FACE_CHAT_COMPLETIONS_URL) {
        discardResponseBody(response);
        throw providerError("provider_redirect", "The Lattice provider attempted an unexpected redirect.");
      }
      if (!response.ok) {
        const httpHeaders = observeQualificationHttpHeaders
          ? qualificationHttpHeaders(response, role)
          : null;
        discardResponseBody(response);
        throw withProviderDiagnostic(providerError("provider_http_error", "The Lattice provider rejected the request.", {
          status: response.status,
          retryAfterSeconds: response.status === 429
            ? parseRetryAfterSeconds(response.headers.get("retry-after"))
            : null,
        }), { httpHeaders });
      }
      if (!PROVIDER_JSON_CONTENT_TYPE.test(response.headers.get("content-type") ?? "")) {
        discardResponseBody(response);
        throw withProviderDiagnostic(
          providerError("provider_malformed_response", "The Lattice provider returned an invalid media type."),
          { subtype: "media_type" },
        );
      }
      const boundedBody = await boundedResponseText(response, maximumResponseBytes, deadline.signal);
      return parsedProviderContent(
        boundedBody.text,
        boundedBody.responseSize,
        toolName,
        allowStoppedToolContent,
        requireMinimalVerificationContent,
      );
    } catch (error) {
      if (deadline.didTimeOut()) {
        throw providerError("provider_timeout", "The Lattice provider timed out.", { cause: error });
      }
      if (signal?.aborted) throw signal.reason ?? abortError();
      if (error instanceof LatticeProviderError) throw error;
      throw withProviderDiagnostic(
        providerError("provider_malformed_response", "The Lattice provider returned an invalid response.", {
          cause: error,
        }),
        { subtype: "response_processing" },
      );
    }
  } catch (error) {
    if (error instanceof LatticeProviderError) {
      throw withProviderDiagnostic(error, { requestSize });
    }
    throw error;
  } finally {
    deadline.dispose();
  }
}

function parseRetryAfterSeconds(value) {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,8})$/u.test(value)) return null;
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds < 1) return null;
  return Math.min(seconds, 300);
}

function messagesWithMode(factory, request, requestedMode) {
  const messages = factory(Object.freeze({
    ...request,
    requestedMode,
    allowClarification: false,
    clarificationAnswers: Object.freeze([]),
  }));
  return Object.freeze(messages.map((message) => Object.freeze({ ...message })));
}

export function createHuggingFaceLatticeAdapter({
  token,
  requestedMode = "auto",
  fetchImpl = globalThis.fetch,
  callTimeoutMs,
  maximumRequestBytes = LATTICE_PROVIDER_REQUEST_BYTE_LIMIT,
  maximumResponseBytes = LATTICE_PROVIDER_RESPONSE_BYTE_LIMIT,
  observeQualificationHttpHeaders = false,
} = {}) {
  if (!REQUESTED_MODES.has(requestedMode) || typeof observeQualificationHttpHeaders !== "boolean") {
    throw new TypeError("The Lattice provider received an invalid requested mode.");
  }

  const budget = { used: 0 };

  const complete = async (stageName, request) => {
    if (budget.used >= LATTICE_PROVIDER_CALL_LIMIT) {
      throw providerError("provider_call_limit", "The Lattice provider call budget was exhausted.");
    }
    budget.used += 1;
    const callOrdinal = budget.used;
    const stage = STAGES[stageName];
    const stageContext = request?.[LATTICE_STAGE_DIAGNOSTIC_CONTEXT];
    const analysisContext = stageName === "analysis"
      ? request?.[LATTICE_ANALYSIS_DIAGNOSTIC_CONTEXT]
      : null;
    let analysisFit = null;
    let verificationFit = null;
    let certificationFit = null;
    let result;
    try {
      analysisFit = stageName === "analysis" ? fitAnalysisRequest(request) : null;
      verificationFit = stageName === "verification" ? fitVerificationRequest(request) : null;
      certificationFit = stageName === "certification" ? fitCertificationRequest(request) : null;
      const fittedRequest = analysisFit?.request ?? request;
      const fittedSchema = analysisFit
        ? analysisWireSchemaForFit(analysisFit)
        : verificationFit
        ? verificationWireSchemaForFit(verificationFit)
        : certificationFit
        ? certificationWireSchemaForFit(certificationFit)
        : stage.schema;
      result = await requestHuggingFaceJson({
        token,
        role: stage.role,
        messages: messagesWithMode(stage.messages, fittedRequest, requestedMode),
        schema: fittedSchema,
        schemaName: stage.schemaName,
        responseGuide: stage.responseGuide,
        schemaDescription: stage.schemaDescription,
        responseFormat: stage.responseFormat,
        toolName: stage.toolName,
        toolChoice: stage.toolChoice,
        allowStoppedToolContent: stage.allowStoppedToolContent,
        requireMinimalVerificationContent: stage.requireMinimalVerificationContent,
        observeQualificationHttpHeaders,
        maxTokens: analysisFit
          ? analysisOutputTokenLimitForSchema(fittedSchema)
          : stage.maxTokens,
        temperature: stage.temperature,
        topP: stage.topP,
        presencePenalty: stage.presencePenalty,
        signal: fittedRequest.signal,
        fetchImpl,
        callTimeoutMs: callTimeoutMs === undefined ? stage.callTimeoutMs : callTimeoutMs,
        maximumRequestBytes,
        maximumResponseBytes,
      });
    } catch (error) {
      throw withQualificationDiagnostic(
        error,
        stageName,
        callOrdinal,
        stageContext,
        analysisContext,
      );
    }
    if (stageName === "analysis") {
      result = decodeAnalysisWire(result, analysisFit);
      const decoderFailureCategory = ANALYSIS_DECODER_FAILURES.get(result);
      Object.defineProperty(result, LATTICE_FITTED_ANALYSIS_CONTEXT, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: Object.freeze({
          analysisAtomLimit: analysisFit.analysisAtomLimit,
          documentLedgerAtomIds: Object.freeze((request.documentLedger ?? []).map(({ id }) => id)),
          ...(decoderFailureCategory === undefined ? {} : { decoderFailureCategory }),
        }),
      });
    } else if (stageName === "verification") {
      result = decodeVerificationWire(result, verificationFit);
    } else if (stageName === "certification") {
      result = decodeCertificationWire(result, certificationFit);
    }
    return result;
  };

  return Object.freeze({
    completionCapacity() {
      return Object.freeze({
        used: budget.used,
        limit: LATTICE_PROVIDER_CALL_LIMIT,
        remaining: LATTICE_PROVIDER_CALL_LIMIT - budget.used,
      });
    },
    analyze: (request) => complete("analysis", request),
    generate: (request) => complete("candidate", request),
    verify: (request) => complete("verification", request),
    certify: (request) => complete("certification", request),
    repair: (request) => complete("repair", request),
  });
}

// Keep the public analysis schema imported alongside the closed schema. This
// assertion fails during module evaluation if the prompt contract stops
// distinguishing public clarification from closed server execution.
if (ANALYSIS_SCHEMA === REANALYSIS_SCHEMA || REANALYSIS_SCHEMA.properties.questions.maxItems !== 0) {
  throw new Error("The closed Lattice analysis schema is unavailable.");
}

function exactRequiredFields(schema, fields) {
  return Array.isArray(schema?.required)
    && schema.required.length === fields.length
    && [...schema.required].sort().every((field, index) => field === [...fields].sort()[index]);
}

if (!exactRequiredFields(REANALYSIS_SCHEMA, ["documentKind", "passages", "questions"])
  || !exactRequiredFields(INTERNAL_ANALYSIS_PASSAGE_SCHEMA, [
    "passageId", "discourseFunction", "layer", "disposition", "rationale", "atoms",
    "ambiguityAtomIds", "conformanceCriteria", "conformanceEvidenceSpanIds",
    "conformanceAssertions",
  ])
  || !exactRequiredFields(INTERNAL_ANALYSIS_ATOM_SCHEMA, [
    "id", "kind", "value", "priority", "preservation", "evidenceSpanIds", "links",
  ])
  || !exactRequiredFields(INTERNAL_ANALYSIS_LINK_SCHEMA, ["relation", "targetAtomId"])
  || !exactRequiredFields(INTERNAL_ANALYSIS_ASSERTION_SCHEMA, ["criterion", "evidenceSpanIds"])) {
  throw new Error("The private analysis wire schema has drifted from the closed host schema.");
}

if (!exactRequiredFields(VERIFICATION_SCHEMA, [
  "decision", "failedGates", "passages", "issues", "questions",
])
  || !exactRequiredFields(INTERNAL_VERIFICATION_PASSAGE_SCHEMA, [
    "passageId", "checkedAtomIds", "missingAtomIds", "unsupportedClaims",
    "unmodeledSpanIds", "failedChecks", "conformanceConfirmed",
    "conformanceEvidenceSpanIds", "independentLayer", "layerEvidenceAtomIds",
    "layerEvidenceSpanIds", "criterionChecks",
  ])
  || !exactRequiredFields(INTERNAL_VERIFICATION_CRITERION_SCHEMA, [
    "criterion", "passed", "evidenceSpanIds",
  ])
  || !exactRequiredFields(INTERNAL_VERIFICATION_ISSUE_SCHEMA, [
    "id", "check", "passageId", "atomIds", "message",
  ])
  || !exactRequiredFields(DOCUMENT_CERTIFICATION_SCHEMA, [
    "certificateId", "obligationIds", "decision", "checks", "issues",
  ])
  || !exactRequiredFields(DOCUMENT_CERTIFICATION_SCHEMA.properties.checks, CERTIFICATION_CHECK_NAMES)
  || !exactRequiredFields(DOCUMENT_CERTIFICATION_SCHEMA.properties.issues.items, [
    "id", "check", "message",
  ])) {
  throw new Error("A private verifier wire schema has drifted from its closed host schema.");
}
