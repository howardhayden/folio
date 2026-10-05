import assert from "node:assert/strict";
import test from "node:test";
import {
  isClosedWithheldPipelineObservation,
  LATTICE_WITHHELD_PIPELINE_FIELDS,
} from "../app/resume/lattice/qualificationDiagnostics.js";

import {
  preflightLatticeInput,
  runTextToLattice,
} from "../app/resume/latticeDemo.js";
import {
  LATTICE_ANALYSIS_DIAGNOSTIC_CONTEXT,
  LATTICE_STAGE_DIAGNOSTIC_CONTEXT,
} from "../app/resume/lattice/promptContract.js";
import {
  LATTICE_PROVIDER_MALFORMED_SUBTYPES,
  LatticeProviderError,
  createHuggingFaceLatticeAdapter,
} from "../workers/text-to-lattice-api/huggingFaceAdapter.js";

const SOURCE = "A visitor places a blue notebook on the desk, reads the first page, and closes it.";

test("withheld pipeline groups are complete finite metadata with consistent path and lineage", () => {
  const value = { retryPath: "regeneration", candidateLineage: "initial", initialDeterministic: "d14-only", successfulCorrectionStage: "none" };
  assert.deepEqual(LATTICE_WITHHELD_PIPELINE_FIELDS, ["retryPath", "candidateLineage", "initialDeterministic", "successfulCorrectionStage"]);
  for (const item of [value,
    { retryPath: "none", candidateLineage: "initial", initialDeterministic: "clear" },
    { retryPath: "reanalysis-only", candidateLineage: "initial", initialDeterministic: "other" },
    { retryPath: "repair", candidateLineage: "repair", initialDeterministic: "d14-and-other" },
    { retryPath: "mixed", candidateLineage: "mixed", initialDeterministic: "d14-only" },
  ]) assert.equal(isClosedWithheldPipelineObservation(Object.freeze({ successfulCorrectionStage: "none", ...item })), true);
  let reads = 0;
  const getter = { ...value };
  Object.defineProperty(getter, "retryPath", { enumerable: true, get() { reads += 1; return "regeneration"; } });
  const hidden = { ...value };
  Object.defineProperty(hidden, "retryPath", { enumerable: false, value: "regeneration" });
  const { proxy, revoke } = Proxy.revocable({}, {}); revoke();
  for (const item of [null, undefined, [], { ...value }, proxy,
    Object.freeze(getter), Object.freeze(hidden), Object.freeze(Object.assign(Object.create({}), value)),
    ...LATTICE_WITHHELD_PIPELINE_FIELDS.map((field) => Object.freeze(Object.fromEntries(Object.entries(value).filter(([key]) => key !== field)))),
    ...LATTICE_WITHHELD_PIPELINE_FIELDS.map((field) => Object.freeze({ ...value, [field]: "PRIVATE-UNKNOWN" })),
    Object.freeze({ ...value, [Symbol("private")]: true }), Object.freeze({ ...value, detail: "PRIVATE-CONTENT" }),
    Object.freeze({ ...value, retryPath: "none", candidateLineage: "repair" }),
    Object.freeze({ ...value, retryPath: "reanalysis-only", candidateLineage: "regeneration" }),
    Object.freeze({ ...value, retryPath: "repair", candidateLineage: "regeneration" }),
    Object.freeze({ ...value, retryPath: "regeneration", candidateLineage: "repair" }),
  ]) assert.equal(isClosedWithheldPipelineObservation(item), false);
  assert.equal(reads, 0, "field descriptors cannot reflect attacker values");
});

test("successful correction metadata names only possible phases and paths, without implying surviving lineage", () => {
  const paths = ["none", "repair", "reanalysis-only", "regeneration", "mixed"];
  const allowedPaths = {
    none: paths,
    atomization: paths,
    generation: paths,
    "generation-recovery": paths,
    verification: paths,
    "re-atomization": ["reanalysis-only", "regeneration", "mixed"],
    repair: ["repair", "mixed"],
    regeneration: ["regeneration", "mixed"],
    reverification: ["repair", "regeneration", "mixed"],
    "document-certification": paths,
    mixed: paths,
  };
  for (const [successfulCorrectionStage, possiblePaths] of Object.entries(allowedPaths)) {
    for (const retryPath of paths) {
      const observation = Object.freeze({
        retryPath,
        candidateLineage: "initial",
        initialDeterministic: "d14-only",
        successfulCorrectionStage,
      });
      assert.equal(isClosedWithheldPipelineObservation(observation), possiblePaths.includes(retryPath),
        `${successfulCorrectionStage} with ${retryPath}; a normalized correction may later be discarded`);
    }
  }
});

test("successful correction metadata rejects historical, malformed, or accessor-bearing groups without reading values", () => {
  const value = { retryPath: "none", candidateLineage: "initial", initialDeterministic: "clear", successfulCorrectionStage: "generation" };
  for (const successfulCorrectionStage of [
    undefined, null, 2, {}, [], "", "analysis", "candidate", "certification", "unknown",
    "document-window-certification", "document-relation-certification", "generation, generation",
    "Generation", " generation", "generation\n", "generation\r\n", "generation\u2028",
  ]) assert.equal(isClosedWithheldPipelineObservation(Object.freeze({ ...value, successfulCorrectionStage })), false);
  const { successfulCorrectionStage: omitted, ...historicalV15 } = value;
  assert.equal(omitted, "generation");
  assert.equal(isClosedWithheldPipelineObservation(Object.freeze(historicalV15)), false);
  let reads = 0;
  const accessor = { ...value };
  Object.defineProperty(accessor, "successfulCorrectionStage", {
    enumerable: true,
    get() { reads += 1; throw new Error("PRIVATE-CONTENT"); },
  });
  assert.equal(isClosedWithheldPipelineObservation(Object.freeze(accessor)), false);
  assert.equal(reads, 0);
  const hidden = { ...value };
  Object.defineProperty(hidden, "successfulCorrectionStage", { enumerable: false, value: "generation" });
  assert.equal(isClosedWithheldPipelineObservation(Object.freeze(hidden)), false);
});
const ANALYSIS_TOOL_NAME = "lattice_analysis_wire_v2";
const QUALIFICATION_FIELDS = Object.freeze([
  "qualificationStage",
  "qualificationCallOrdinal",
  "qualificationSubtype",
  "qualificationFinishReason",
  "qualificationRequestSize",
  "qualificationResponseSize",
  "qualificationContentSize",
  "qualificationCompletionTokens",
  "qualificationStageAttempt",
  "qualificationAnalysisOrigin",
  "qualificationAnalysisAttempt",
  "qualificationPriorValidationCategory",
]);

function analysisToolCall({
  name = ANALYSIS_TOOL_NAME,
  argumentsText,
  id = "call_lattice_analysis",
  type = "function",
} = {}) {
  return {
    id,
    type,
    function: {
      name,
      arguments: argumentsText,
    },
  };
}

function analysisProviderResponse(value, {
  completionTokens,
  contentText = JSON.stringify(value),
  finishReason = "stop",
  message = {},
} = {}) {
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: finishReason,
      message: {
        role: "assistant",
        content: contentText,
        ...message,
      },
    }],
    ...(completionTokens === undefined ? {} : { usage: { completion_tokens: completionTokens } }),
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function invalidAnalysisResponse() {
  return analysisProviderResponse({
    d: 2,
    p: [],
    l: [],
  });
}

function minimalAnalysisRequest() {
  const preflight = preflightLatticeInput(SOURCE);
  return Object.freeze({
    batch: preflight.batches[0],
    documentLedger: Object.freeze([]),
    context: null,
    signal: new AbortController().signal,
  });
}

function jsonProviderEnvelope(envelope) {
  return new Response(JSON.stringify(envelope), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

async function captureFailure(operation) {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  assert.fail("expected the provider operation to fail");
}

function assertHiddenImmutableDiagnostics(error) {
  for (const field of QUALIFICATION_FIELDS) {
    const descriptor = Object.getOwnPropertyDescriptor(error, field);
    assert.ok(descriptor, `${field} must be attached`);
    assert.equal(descriptor.enumerable, false, `${field} must remain non-enumerable`);
    assert.equal(descriptor.configurable, false, `${field} must remain non-configurable`);
    assert.equal(descriptor.writable, false, `${field} must remain immutable`);
    assert.equal(Object.keys(error).includes(field), false, `${field} must not enter enumerable errors`);
  }
}

test("an initial host-validation correction attributes malformed provider call two without exposing host context", async () => {
  const providerBodies = [];
  let calls = 0;
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-test-token",
    requestedMode: "operative",
    fetchImpl: async (_url, init) => {
      calls += 1;
      providerBodies.push(init.body);
      if (calls === 1) return invalidAnalysisResponse();
      return new Response("not-json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const error = await captureFailure(runTextToLattice(SOURCE, {
    adapter,
    requestedMode: "operative",
    allowClarification: false,
  }));

  assert.ok(error instanceof LatticeProviderError);
  assert.equal(error.code, "provider_malformed_response");
  assert.equal(error.qualificationStage, "analysis");
  assert.equal(error.qualificationCallOrdinal, 2);
  assert.equal(error.qualificationSubtype, "envelope_json");
  assert.equal(error.qualificationFinishReason, "none");
  assert.equal(error.qualificationRequestSize, "4097-16384");
  assert.equal(error.qualificationResponseSize, "1-4096");
  assert.equal(error.qualificationContentSize, "none");
  assert.equal(error.qualificationCompletionTokens, "none");
  assert.equal(error.qualificationStageAttempt, "correction");
  assert.equal(error.qualificationAnalysisOrigin, "initial");
  assert.equal(error.qualificationAnalysisAttempt, "2");
  assert.equal(error.qualificationPriorValidationCategory, "passage-coverage");
  assert.equal(calls, 2);
  assertHiddenImmutableDiagnostics(error);

  for (const body of providerBodies) {
    assert.doesNotMatch(
      body,
      /lattice-(?:analysis|stage)-diagnostic-context|stageAttempt|analysisOrigin|analysisAttempt|priorValidationCategory/u,
    );
  }
  const [firstBody, correctedBody] = providerBodies.map((body) => JSON.parse(body));
  const firstSerialized = JSON.stringify(firstBody);
  const correctedSerialized = JSON.stringify(correctedBody);
  assert.doesNotMatch(firstSerialized, /private-analysis-wire-invalid/u);
  assert.match(correctedSerialized, /private-analysis-wire-invalid/u);
  assert.match(correctedSerialized, /exactly one p tuple for every supplied passage|exact tuple widths|evidence coverage|valid link positions/iu);
  assert.doesNotMatch(
    correctedSerialized,
    /Atomization did not cover every passage|matching every named field|Return the analysis schema\./iu,
  );
  for (const body of [firstBody, correctedBody]) {
    assert.equal(body.response_format.type, "json_schema");
    assert.equal(body.response_format.json_schema.name, ANALYSIS_TOOL_NAME);
    assert.equal(typeof body.response_format.json_schema.description, "string");
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.response_format.json_schema.schema.type, "object");
    assert.deepEqual(body.response_format.json_schema.schema.required, ["d", "p", "l"]);
    assert.equal(Object.hasOwn(body, "parallel_tool_calls"), false);
    assert.equal(Object.hasOwn(body, "tool_choice"), false);
    assert.equal(Object.hasOwn(body, "tools"), false);
    const system = body.messages.find(({ role }) => role === "system")?.content ?? "";
    assert.match(system, /private d\/p\/l index wire/u);
    assert.match(system, /never ask a public question/u);
    assert.equal(
      system.includes(JSON.stringify(body.response_format.json_schema.schema)),
      false,
    );
    assert.doesNotMatch(system, /LATTICE_RESPONSE_SCHEMA/u);
    assert.doesNotMatch(system, /Return the analysis schema\.|Return questions empty|affectedAtomIds/iu);
  }
  assert.deepEqual(
    firstBody.response_format.json_schema.schema,
    correctedBody.response_format.json_schema.schema,
  );
  assert.doesNotMatch(firstBody.messages[0].content, /one bounded correction attempt/u);
  assert.match(correctedBody.messages[0].content, /one bounded correction attempt/u);
  assert.match(correctedBody.messages[0].content, /Closed correction category: passage-coverage/u);
  assert.doesNotMatch(correctedBody.messages[1].content, /one bounded correction attempt/u);
});

test("a malformed compact analysis tuple fails into the bounded host correction path", async () => {
  let calls = 0;
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-test-token",
    requestedMode: "operative",
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return analysisProviderResponse({ d: 2, p: [["too-short"]] });
      }
      return analysisProviderResponse(undefined, { contentText: "not-json" });
    },
  });

  const error = await captureFailure(runTextToLattice(SOURCE, {
    adapter,
    requestedMode: "operative",
    allowClarification: false,
  }));

  assert.ok(error instanceof LatticeProviderError);
  assert.equal(error.code, "provider_malformed_response");
  assert.equal(error.qualificationCallOrdinal, 2);
  assert.equal(error.qualificationSubtype, "content_json");
  assert.equal(error.qualificationStageAttempt, "correction");
  assert.equal(error.qualificationAnalysisOrigin, "initial");
  assert.equal(error.qualificationAnalysisAttempt, "2");
  assert.equal(error.qualificationPriorValidationCategory, "response-shape");
  assert.equal(calls, 2);
  assertHiddenImmutableDiagnostics(error);
});

test("compact analysis decoder failures preserve only their closed correction category", async () => {
  const atom = [1, 0, 1, [0]];
  const wire = ({ atoms = [atom], masks = ["000", "000", "000", "000", "000"], links = [] } = {}) => ({
    d: 2,
    p: [[0, 0, atoms, masks]],
    l: links,
  });
  const cases = [
    ["evidence", wire({ atoms: [[1, 0, 1, [99]]] })],
    ["relation", wire({ links: [[99, 0, 0]] })],
    ["conformance", wire({ masks: ["x00", "000", "000", "000", "000"] })],
    ["capacity", wire({ atoms: Array.from({ length: 25 }, () => atom) })],
    ["ambiguity", wire({
      atoms: Array.from({ length: 9 }, (_value, index) => [18, 0, 1, [index % 3]]),
    })],
  ];

  for (const [category, invalidWire] of cases) {
    const providerBodies = [];
    let calls = 0;
    const adapter = createHuggingFaceLatticeAdapter({
      token: "server-test-token",
      requestedMode: "operative",
      fetchImpl: async (_url, init) => {
        calls += 1;
        providerBodies.push(init.body);
        if (calls === 1) return analysisProviderResponse(invalidWire);
        return analysisProviderResponse(undefined, { contentText: "not-json" });
      },
    });

    const error = await captureFailure(runTextToLattice(SOURCE, {
      adapter,
      requestedMode: "operative",
      allowClarification: false,
    }));

    assert.ok(error instanceof LatticeProviderError, category);
    assert.equal(error.qualificationCallOrdinal, 2, category);
    assert.equal(error.qualificationSubtype, "content_json", category);
    assert.equal(error.qualificationPriorValidationCategory, category, category);
    assert.equal(calls, 2, category);
    assertHiddenImmutableDiagnostics(error);
    const corrected = JSON.parse(providerBodies[1]);
    assert.equal(
      corrected.messages[0].content.includes(`Closed correction category: ${category}.`),
      true,
      category,
    );
    assert.doesNotMatch(
      providerBodies.join("\n"),
      /decoderFailureCategory|analysis-decoder-failure/u,
      category,
    );
    assert.equal(JSON.stringify(error).includes(category), false, category);
  }
});

test("an unsplittable decoder rejection reaches the terminal diagnostic without public detail", async () => {
  const providerBodies = [];
  let calls = 0;
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-test-token",
    requestedMode: "operative",
    fetchImpl: async (_url, init) => {
      calls += 1;
      providerBodies.push(init.body);
      return analysisProviderResponse({
        d: 2,
        p: [[0, 0, [[1, 0, 1, [1]]], ["0", "0", "0", "0", "0"]]],
        l: [],
      });
    },
  });
  const terminalDiagnostics = [];

  const result = await runTextToLattice("A", {
    adapter,
    requestedMode: "operative",
    allowClarification: false,
    onAnalysisTerminalDiagnostic: (diagnostic) => terminalDiagnostics.push(diagnostic),
  });

  assert.equal(calls, 2);
  assert.equal(result.status, "unable-to-attempt");
  assert.deepEqual(terminalDiagnostics, [{
    cause: "host-validation",
    validationCategory: "evidence",
    priorValidationCategory: "evidence",
    origin: "initial",
    attempt: "2",
    atomLimit: "4",
  }]);
  assert.doesNotMatch(
    `${JSON.stringify(result)}\n${providerBodies.join("\n")}`,
    /decoderFailureCategory|analysis-decoder-failure/u,
  );
});

test("a split-child output limit immediately starts a smaller first attempt", async () => {
  let calls = 0;
  const providerBodies = [];
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-test-token",
    requestedMode: "operative",
    fetchImpl: async (_url, init) => {
      calls += 1;
      providerBodies.push(JSON.parse(init.body));
      if (calls < 4) return invalidAnalysisResponse();
      if (calls === 4) {
        return new Response(JSON.stringify({
          choices: [{
            finish_reason: "length",
            message: {
              role: "assistant",
              content: "PRIVATE-TRUNCATED-CONTENT",
            },
          }],
          usage: { completion_tokens: 3_072 },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not-json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const error = await captureFailure(runTextToLattice(SOURCE, {
    adapter,
    requestedMode: "operative",
    allowClarification: false,
  }));

  assert.ok(error instanceof LatticeProviderError);
  assert.equal(error.code, "provider_malformed_response");
  assert.equal(error.qualificationStage, "analysis");
  assert.equal(error.qualificationCallOrdinal, 5);
  assert.equal(error.qualificationSubtype, "envelope_json");
  assert.equal(error.qualificationAnalysisOrigin, "split");
  assert.equal(error.qualificationAnalysisAttempt, "1");
  assert.equal(error.qualificationPriorValidationCategory, "none");
  assert.equal(error.message.includes("PRIVATE-TRUNCATED-CONTENT"), false);
  assert.equal(JSON.stringify(error).includes("PRIVATE-TRUNCATED-CONTENT"), false);
  assert.equal(calls, 5);
  const fourthSystem = providerBodies[3].messages.find(({ role }) => role === "system")?.content ?? "";
  const fifthSystem = providerBodies[4].messages.find(({ role }) => role === "system")?.content ?? "";
  assert.match(fourthSystem, /one bounded correction attempt/u);
  assert.doesNotMatch(fifthSystem, /one bounded correction attempt/u);
  assert.notDeepEqual(providerBodies[4].response_format, providerBodies[3].response_format);
  assertHiddenImmutableDiagnostics(error);
});

test("malformed structured content carries only fixed subtype and coarse size metadata", async () => {
  const privateContent = "PRIVATE-INVALID-STRUCTURED-CONTENT";
  let providerBody = "";
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-test-token",
    requestedMode: "operative",
    fetchImpl: async (_url, init) => {
      providerBody = init.body;
      return analysisProviderResponse(undefined, {
        contentText: privateContent,
        completionTokens: 512,
      });
    },
  });

  const error = await captureFailure(runTextToLattice(SOURCE, {
    adapter,
    requestedMode: "operative",
    allowClarification: false,
  }));

  assert.ok(error instanceof LatticeProviderError);
  assert.equal(error.code, "provider_malformed_response");
  assert.equal(error.qualificationSubtype, "content_json");
  assert.equal(error.qualificationStageAttempt, "initial");
  assert.equal(error.qualificationFinishReason, "stop");
  assert.equal(error.qualificationRequestSize, "4097-16384");
  assert.equal(error.qualificationResponseSize, "1-4096");
  assert.equal(error.qualificationContentSize, "1-4096");
  assert.equal(error.qualificationCompletionTokens, "512-1023");
  assert.equal(error.qualificationAnalysisOrigin, "initial");
  assert.equal(error.qualificationAnalysisAttempt, "1");
  assert.equal(error.qualificationPriorValidationCategory, "none");
  assert.equal(error.message.includes(privateContent), false);
  assert.equal(JSON.stringify(error).includes(privateContent), false);
  assert.doesNotMatch(
    providerBody,
    /lattice-(?:analysis|stage)-diagnostic-context|stageAttempt|analysisOrigin|analysisAttempt|priorValidationCategory/u,
  );
  assertHiddenImmutableDiagnostics(error);
});

test("strict-schema assistant content remains authoritative over auxiliary provider fields", async () => {
  const authoritativeWire = Object.freeze({
    d: 2,
    p: Object.freeze([Object.freeze([
      0,
      0,
      Object.freeze([Object.freeze([1, 0, 1, Object.freeze([0])])]),
      Object.freeze(["0", "0", "0", "0", "0"]),
    ])]),
    l: Object.freeze([]),
  });
  const auxiliaryWire = JSON.stringify({ d: 8, p: [["PRIVATE-AUXILIARY"]] });
  const cases = [
    {
      name: "tool calls",
      message: { tool_calls: [analysisToolCall({ argumentsText: auxiliaryWire })] },
    },
    {
      name: "legacy function call",
      message: {
        function_call: {
          name: "legacy_analysis",
          arguments: auxiliaryWire,
        },
      },
    },
    {
      name: "both auxiliary fields",
      message: {
        tool_calls: [analysisToolCall({ argumentsText: auxiliaryWire })],
        function_call: {
          name: "legacy_analysis",
          arguments: auxiliaryWire,
        },
      },
    },
  ];

  for (const { name, message } of cases) {
    let fetches = 0;
    const adapter = createHuggingFaceLatticeAdapter({
      token: "server-test-token",
      requestedMode: "operative",
      fetchImpl: async () => {
        fetches += 1;
        return analysisProviderResponse(authoritativeWire, {
          finishReason: "stop",
          message,
        });
      },
    });

    const result = await adapter.analyze(minimalAnalysisRequest());
    assert.equal(result.documentKind, "instruction", name);
    assert.equal(result.passages.length, 1, name);
    assert.deepEqual(result.questions, [], name);
    assert.equal(JSON.stringify(result).includes("PRIVATE-AUXILIARY"), false, name);
    assert.equal(fetches, 1, name);
  }
});

test("analysis never substitutes auxiliary tool calls for strict-schema content", async () => {
  const privateMarker = "PRIVATE-NONAUTHORITATIVE-ANALYSIS";
  const cases = [
    {
      name: "non-object content",
      subtype: "content_shape",
      finishReason: "stop",
      contentSize: "1-4096",
      response: () => analysisProviderResponse(undefined, {
        contentText: JSON.stringify([privateMarker]),
        message: {
          tool_calls: [analysisToolCall({
            argumentsText: JSON.stringify({ d: 2, p: [] }),
          })],
        },
      }),
    },
    {
      name: "missing content",
      subtype: "content_empty",
      finishReason: "stop",
      contentSize: "none",
      response: () => analysisProviderResponse(undefined, {
        contentText: undefined,
        message: {
          tool_calls: [analysisToolCall({ argumentsText: privateMarker })],
        },
      }),
    },
  ];

  for (const { name, subtype, finishReason, contentSize, response } of cases) {
    let fetches = 0;
    const adapter = createHuggingFaceLatticeAdapter({
      token: "server-test-token",
      requestedMode: "operative",
      fetchImpl: async () => {
        fetches += 1;
        return response();
      },
    });

    const error = await captureFailure(adapter.analyze(minimalAnalysisRequest()));
    assert.ok(error instanceof LatticeProviderError, name);
    assert.equal(error.code, "provider_malformed_response", name);
    assert.equal(error.qualificationSubtype, subtype, name);
    assert.equal(error.qualificationFinishReason, finishReason, name);
    assert.equal(error.qualificationStage, "analysis", name);
    assert.equal(error.qualificationCallOrdinal, 1, name);
    assert.equal(error.qualificationContentSize, contentSize, name);
    assert.equal(error.message.includes(privateMarker), false, name);
    assert.equal(JSON.stringify(error).includes(privateMarker), false, name);
    assert.equal(fetches, 1, name);
    assertHiddenImmutableDiagnostics(error);
  }
});

test("every remaining shared malformed-response branch maps to one fixed content-free subtype", async () => {
  const privateMarker = "PRIVATE-MALFORMED-SUBTYPE-MARKER";
  const cases = [
    {
      subtype: "response_read",
      response() {
        return new Response(new ReadableStream({
          start(controller) {
            controller.error(new Error(privateMarker));
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
    {
      subtype: "response_type",
      response: () => Object.freeze({ privateMarker }),
    },
    {
      subtype: "media_type",
      response: () => new Response(privateMarker, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    },
    {
      subtype: "choice_count",
      response: () => jsonProviderEnvelope({ choices: [] }),
    },
    {
      subtype: "choice_shape",
      response: () => jsonProviderEnvelope({ choices: [null] }),
    },
    {
      subtype: "finish_reason",
      response: () => jsonProviderEnvelope({
        choices: [{
          finish_reason: "content_filter",
          message: {
            role: "assistant",
            content: privateMarker,
          },
        }],
      }),
    },
    {
      subtype: "message_shape",
      response: () => jsonProviderEnvelope({
        choices: [{
          finish_reason: "stop",
          message: null,
        }],
      }),
    },
    {
      subtype: "message_role",
      response: () => jsonProviderEnvelope({
        choices: [{
          finish_reason: "stop",
          message: {
            role: "user",
            content: privateMarker,
          },
        }],
      }),
    },
    {
      subtype: "content_empty",
      response: () => analysisProviderResponse(undefined, { contentText: "" }),
    },
    {
      subtype: "content_shape",
      response: () => analysisProviderResponse(undefined, { contentText: "[]" }),
    },
    {
      subtype: "response_processing",
      response() {
        const response = jsonProviderEnvelope({ choices: [] });
        Object.defineProperty(response, "ok", {
          configurable: true,
          get() { throw new Error(privateMarker); },
        });
        return response;
      },
    },
  ];
  // These review-stage envelope predicates are exercised individually through
  // production verification/certification in lattice-api-worker.test.mjs. This matrix
  // exercises the shared transport guards through strict-schema analysis.
  const reviewStageEnvelopeSubtypes = [
    "E00", "E01", "E02", "E03", "E04", "E05", "E06", "E07",
    "S01", "S02", "S02N", "S03", "S04", "S05", "S06", "S07", "M01",
  ];
  assert.deepEqual(
    cases.map(({ subtype }) => subtype).sort(),
    LATTICE_PROVIDER_MALFORMED_SUBTYPES
      .filter((subtype) => !["none", "envelope_json", "content_json", ...reviewStageEnvelopeSubtypes].includes(subtype))
      .sort(),
  );

  for (const { subtype, response } of cases) {
    let fetches = 0;
    const adapter = createHuggingFaceLatticeAdapter({
      token: "server-test-token",
      requestedMode: "operative",
      fetchImpl: async () => {
        fetches += 1;
        return response();
      },
    });
    const error = await captureFailure(adapter.analyze(minimalAnalysisRequest()));
    assert.ok(error instanceof LatticeProviderError, subtype);
    assert.equal(error.code, "provider_malformed_response", subtype);
    assert.equal(error.qualificationSubtype, subtype);
    assert.equal(error.qualificationStage, "analysis", subtype);
    assert.equal(error.qualificationCallOrdinal, 1, subtype);
    assert.equal(error.message.includes(privateMarker), false, subtype);
    assert.equal(JSON.stringify(error).includes(privateMarker), false, subtype);
    assert.equal(fetches, 1, subtype);
    assertHiddenImmutableDiagnostics(error);
  }
});

function evidenceSpanIds(spans, atomIndex, atomCount) {
  const assigned = spans.filter((_, spanIndex) => spanIndex % atomCount === atomIndex).slice(0, 3);
  return (assigned.length > 0 ? assigned : spans.slice(0, 1)).map(({ id }) => id);
}

function validRawAnalysis(request) {
  return {
    documentKind: "other",
    passages: request.batch.passages.map((passage, passageIndex) => {
      const group = request.sourceSpans.find(({ passageId }) => passageId === passage.id);
      const spans = [...group.spans, ...(group.literalAnnotations ?? [])];
      const atomCount = passage.wordCount >= 14 ? 3 : passage.wordCount >= 6 ? 2 : 1;
      return {
        passageId: passage.id,
        discourseFunction: "states a bounded action",
        layer: "operative",
        disposition: "rewrite",
        rationale: "make the supported sequence explicit",
        atoms: Array.from({ length: atomCount }, (_, atomIndex) => ({
          id: `a${passageIndex}_${atomIndex}`,
          kind: ["action", "object", "state"][atomIndex % 3],
          value: `supported content ${passageIndex}:${atomIndex}`,
          priority: atomIndex === 0 ? "hard" : "semantic",
          preservation: "equivalent",
          evidenceSpanIds: evidenceSpanIds(spans, atomIndex, atomCount),
          links: [],
        })),
        ambiguityAtomIds: [],
        conformanceCriteria: [],
        conformanceEvidenceSpanIds: [],
        conformanceAssertions: [],
      };
    }),
    questions: [],
  };
}

function validRawCandidate(request) {
  return {
    passages: request.batch.passages.map((passage, index) => ({
      passageId: passage.id,
      layer: request.analysis.passages[index].layer,
      text: passage.text.replaceAll("u", "v"),
      preservedAtomIds: request.analysis.passages[index].atoms.map(({ id }) => id),
    })),
  };
}

function structuralFailure(request) {
  return {
    decision: "repair",
    failedGates: ["sourceCoverage"],
    passages: request.analysis.passages.map((passage) => {
      const group = request.sourceSpans.find(({ passageId }) => passageId === passage.passageId);
      return {
        passageId: passage.passageId,
        checkedAtomIds: passage.atoms.map(({ id }) => id),
        missingAtomIds: [],
        unsupportedClaims: [],
        unmodeledSpanIds: group.spans.map(({ id }) => id),
        failedChecks: [],
        conformanceConfirmed: false,
        conformanceEvidenceSpanIds: [],
        independentLayer: passage.layer,
        layerEvidenceAtomIds: passage.atoms.map(({ id }) => id),
        layerEvidenceSpanIds: [...new Set(passage.atoms.flatMap(({ evidenceSpanIds: ids }) => ids))],
        criterionChecks: [],
      };
    }),
    issues: [],
    questions: [],
  };
}

test("re-analysis correction context remains hidden and preserves its logical origin", async () => {
  const source = Array.from({ length: 8 }, (_, index) => `u${index}`).join(" ");
  const contexts = [];
  const requests = [];
  const stageContexts = [];
  const captureStageContext = (stage, request) => {
    stageContexts.push({ stage, request, context: request[LATTICE_STAGE_DIAGNOSTIC_CONTEXT] });
  };
  const stop = new Error("stop after observing re-analysis correction context");
  let reanalysisCalls = 0;
  const adapter = {
    async analyze(request) {
      requests.push(request);
      contexts.push(request[LATTICE_ANALYSIS_DIAGNOSTIC_CONTEXT]);
      captureStageContext(request.reanalysisFeedback ? "re-atomization" : "atomization", request);
      if (!request.reanalysisFeedback) return validRawAnalysis(request);
      reanalysisCalls += 1;
      if (reanalysisCalls === 1) return { ...validRawAnalysis(request), extra: true };
      throw stop;
    },
    async generate(request) {
      captureStageContext("generation", request);
      return validRawCandidate(request);
    },
    async verify(request) {
      captureStageContext("verification", request);
      return structuralFailure(request);
    },
    async repair(request) {
      captureStageContext("repair", request);
      return validRawCandidate(request);
    },
  };

  const error = await captureFailure(runTextToLattice(source, {
    adapter,
    requestedMode: "operative",
    allowClarification: false,
  }));
  assert.equal(error, stop);
  assert.equal(contexts.length, 3);
  assert.deepEqual(contexts.map((context) => ({ ...context })), [
    { origin: "initial", attempt: 1, priorValidationCategory: "none" },
    { origin: "reanalysis", attempt: 1, priorValidationCategory: "none" },
    { origin: "reanalysis", attempt: 2, priorValidationCategory: "response-shape" },
  ]);
  assert.deepEqual(stageContexts.map(({ stage, context }) => ({ stage, ...context })), [
    { stage: "atomization", attempt: "initial", priorValidationCategory: "none" },
    { stage: "generation", attempt: "initial", priorValidationCategory: "none" },
    { stage: "verification", attempt: "initial", priorValidationCategory: "none" },
    { stage: "re-atomization", attempt: "initial", priorValidationCategory: "none" },
    { stage: "re-atomization", attempt: "correction", priorValidationCategory: "response-shape" },
  ]);

  for (const { request, context } of stageContexts) {
    const descriptor = Object.getOwnPropertyDescriptor(request, LATTICE_STAGE_DIAGNOSTIC_CONTEXT);
    assert.ok(descriptor);
    assert.equal(descriptor.enumerable, false);
    assert.equal(descriptor.configurable, false);
    assert.equal(descriptor.writable, false);
    assert.equal(Object.isFrozen(context), true);
    assert.equal(Object.isFrozen(request), true);
    assert.doesNotMatch(
      JSON.stringify(request),
      /stageAttempt|priorValidationCategory|lattice-stage-diagnostic-context/u,
    );
  }

  for (let index = 0; index < requests.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(
      requests[index],
      LATTICE_ANALYSIS_DIAGNOSTIC_CONTEXT,
    );
    assert.ok(descriptor);
    assert.equal(descriptor.enumerable, false);
    assert.equal(descriptor.configurable, false);
    assert.equal(descriptor.writable, false);
    assert.equal(Object.isFrozen(descriptor.value), true);
    assert.equal(Object.isFrozen(requests[index]), true);
    assert.doesNotMatch(
      JSON.stringify(requests[index]),
      /analysisOrigin|analysisAttempt|priorValidationCategory|lattice-analysis-diagnostic-context/u,
    );
  }
});

test("non-analysis correction diagnostics preserve generator and repair feedback payloads", async () => {
  const generationRequests = [];
  const recoveryRequests = [];
  const stop = new Error("stop after observing generation recovery correction context");
  const adapter = {
    async analyze(request) {
      return validRawAnalysis(request);
    },
    async generate(request) {
      generationRequests.push(request);
      return {};
    },
    async verify() {
      assert.fail("invalid generation must not reach verification");
    },
    async repair(request) {
      recoveryRequests.push(request);
      if (recoveryRequests.length === 1) return {};
      throw stop;
    },
  };

  const error = await captureFailure(runTextToLattice(SOURCE, {
    adapter,
    requestedMode: "operative",
    allowClarification: false,
  }));
  assert.equal(error, stop);
  assert.equal(generationRequests.length, 2);
  assert.equal(recoveryRequests.length, 2);

  for (const [stage, requests] of [
    ["generation", generationRequests],
    ["generation-recovery", recoveryRequests],
  ]) {
    assert.deepEqual(
      requests.map((request) => ({ ...request[LATTICE_STAGE_DIAGNOSTIC_CONTEXT] })),
      [
        { attempt: "initial", priorValidationCategory: "none" },
        { attempt: "correction", priorValidationCategory: "response-shape" },
      ],
      stage,
    );
    const correctionFeedback = requests[1].protocolFeedback;
    assert.deepEqual(
      Object.keys(correctionFeedback).sort(),
      ["attempt", "instruction", "issue", "stage"],
      stage,
    );
    assert.equal(correctionFeedback.stage, stage);
    assert.equal(correctionFeedback.attempt, 2);
    assert.equal(Object.hasOwn(correctionFeedback, "category"), false);
    assert.doesNotMatch(
      JSON.stringify(requests),
      /lattice-stage-diagnostic-context|priorValidationCategory|stageAttempt/u,
    );
  }
});
