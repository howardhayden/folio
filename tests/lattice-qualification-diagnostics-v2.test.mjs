import assert from "node:assert/strict";
import test from "node:test";

import {
  preflightLatticeInput,
  runTextToLattice,
} from "../app/resume/latticeDemo.js";
import {
  LATTICE_ANALYSIS_DIAGNOSTIC_CONTEXT,
} from "../app/resume/lattice/promptContract.js";
import {
  LATTICE_PROVIDER_MALFORMED_SUBTYPES,
  LatticeProviderError,
  createHuggingFaceLatticeAdapter,
} from "../workers/text-to-lattice-api/huggingFaceAdapter.js";

const SOURCE = "A visitor places a blue notebook on the desk, reads the first page, and closes it.";
const QUALIFICATION_FIELDS = Object.freeze([
  "qualificationStage",
  "qualificationCallOrdinal",
  "qualificationSubtype",
  "qualificationFinishReason",
  "qualificationRequestSize",
  "qualificationResponseSize",
  "qualificationContentSize",
  "qualificationCompletionTokens",
  "qualificationAnalysisOrigin",
  "qualificationAnalysisAttempt",
  "qualificationPriorValidationCategory",
]);

function providerResponse(value, { completionTokens } = {}) {
  return new Response(JSON.stringify({
    choices: [{
      finish_reason: "stop",
      message: { role: "assistant", content: JSON.stringify(value) },
    }],
    ...(completionTokens === undefined ? {} : { usage: { completion_tokens: completionTokens } }),
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function invalidAnalysisResponse() {
  return providerResponse({
    d: "instruction",
    p: [],
    q: [],
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
  assert.equal(error.qualificationAnalysisOrigin, "initial");
  assert.equal(error.qualificationAnalysisAttempt, "2");
  assert.equal(error.qualificationPriorValidationCategory, "passage-coverage");
  assert.equal(calls, 2);
  assertHiddenImmutableDiagnostics(error);

  for (const body of providerBodies) {
    assert.doesNotMatch(
      body,
      /lattice-analysis-diagnostic-context|analysisOrigin|analysisAttempt|priorValidationCategory/u,
    );
  }
  const [firstBody, correctedBody] = providerBodies.map((body) => JSON.parse(body));
  const firstSerialized = JSON.stringify(firstBody);
  const correctedSerialized = JSON.stringify(correctedBody);
  assert.doesNotMatch(firstSerialized, /private-analysis-wire-invalid/u);
  assert.match(correctedSerialized, /private-analysis-wire-invalid/u);
  assert.match(correctedSerialized, /exactly one p tuple for every supplied passage ID|exact tuple widths|covering every source span|valid link targets|Keep q empty/iu);
  assert.doesNotMatch(
    correctedSerialized,
    /Atomization did not cover every passage|matching every named field|Return the analysis schema\./iu,
  );
  for (const body of [firstBody, correctedBody]) {
    const system = body.messages.find(({ role }) => role === "system")?.content ?? "";
    assert.match(system, /private d\/p\/q wire object/u);
    assert.match(system, /Keep q empty/u);
    assert.equal((system.match(/Response contract lattice_analysis_wire_v1/gu) ?? []).length, 1);
    assert.doesNotMatch(system, /Return the analysis schema\.|Return questions empty|affectedAtomIds/iu);
  }
  assert.doesNotMatch(firstBody.messages[0].content, /one bounded correction attempt/u);
  assert.match(correctedBody.messages[0].content, /one bounded correction attempt/u);
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
        return providerResponse({ d: "instruction", p: [["too-short"]], q: [] });
      }
      return jsonProviderEnvelope({
        choices: [{
          finish_reason: "stop",
          message: { role: "assistant", content: "not-json" },
        }],
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
  assert.equal(error.qualificationCallOrdinal, 2);
  assert.equal(error.qualificationSubtype, "content_json");
  assert.equal(error.qualificationAnalysisOrigin, "initial");
  assert.equal(error.qualificationAnalysisAttempt, "2");
  assert.equal(error.qualificationPriorValidationCategory, "response-shape");
  assert.equal(calls, 2);
  assertHiddenImmutableDiagnostics(error);
});

test("a split-child correction keeps split origin when global analysis call four reaches its output limit", async () => {
  let calls = 0;
  const adapter = createHuggingFaceLatticeAdapter({
    token: "server-test-token",
    requestedMode: "operative",
    fetchImpl: async () => {
      calls += 1;
      if (calls < 4) return invalidAnalysisResponse();
      return new Response(JSON.stringify({
        choices: [{
          finish_reason: "length",
          message: { role: "assistant", content: "PRIVATE-TRUNCATED-CONTENT" },
        }],
        usage: { completion_tokens: 3_072 },
      }), {
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
  assert.equal(error.code, "provider_output_limit");
  assert.equal(error.qualificationStage, "analysis");
  assert.equal(error.qualificationCallOrdinal, 4);
  assert.equal(error.qualificationSubtype, "none");
  assert.equal(error.qualificationFinishReason, "length");
  assert.equal(error.qualificationRequestSize, "4097-16384");
  assert.equal(error.qualificationResponseSize, "1-4096");
  assert.equal(error.qualificationContentSize, "1-4096");
  assert.equal(error.qualificationCompletionTokens, "3072-plus");
  assert.equal(error.qualificationAnalysisOrigin, "split");
  assert.equal(error.qualificationAnalysisAttempt, "2");
  assert.equal(error.qualificationPriorValidationCategory, "passage-coverage");
  assert.equal(error.message.includes("PRIVATE-TRUNCATED-CONTENT"), false);
  assert.equal(JSON.stringify(error).includes("PRIVATE-TRUNCATED-CONTENT"), false);
  assert.equal(calls, 4);
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
      return new Response(JSON.stringify({
        choices: [{
          finish_reason: "stop",
          message: { role: "assistant", content: privateContent },
        }],
        usage: { completion_tokens: 512 },
      }), {
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
  assert.equal(error.qualificationSubtype, "content_json");
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
    /lattice-analysis-diagnostic-context|analysisOrigin|analysisAttempt|priorValidationCategory/u,
  );
  assertHiddenImmutableDiagnostics(error);
});

test("every remaining malformed-response branch maps to one fixed content-free subtype", async () => {
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
          message: { role: "assistant", content: privateMarker },
        }],
      }),
    },
    {
      subtype: "message_shape",
      response: () => jsonProviderEnvelope({
        choices: [{ finish_reason: "stop", message: null }],
      }),
    },
    {
      subtype: "message_role",
      response: () => jsonProviderEnvelope({
        choices: [{
          finish_reason: "stop",
          message: { role: "user", content: privateMarker },
        }],
      }),
    },
    {
      subtype: "content_empty",
      response: () => jsonProviderEnvelope({
        choices: [{
          finish_reason: "stop",
          message: { role: "assistant", content: "" },
        }],
      }),
    },
    {
      subtype: "content_shape",
      response: () => jsonProviderEnvelope({
        choices: [{
          finish_reason: "stop",
          message: { role: "assistant", content: "[]" },
        }],
      }),
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
  assert.deepEqual(
    cases.map(({ subtype }) => subtype).sort(),
    LATTICE_PROVIDER_MALFORMED_SUBTYPES
      .filter((subtype) => !["none", "envelope_json", "content_json"].includes(subtype))
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
  const stop = new Error("stop after observing re-analysis correction context");
  let reanalysisCalls = 0;
  const adapter = {
    async analyze(request) {
      requests.push(request);
      contexts.push(request[LATTICE_ANALYSIS_DIAGNOSTIC_CONTEXT]);
      if (!request.reanalysisFeedback) return validRawAnalysis(request);
      reanalysisCalls += 1;
      if (reanalysisCalls === 1) return { ...validRawAnalysis(request), extra: true };
      throw stop;
    },
    async generate(request) {
      return validRawCandidate(request);
    },
    async verify(request) {
      return structuralFailure(request);
    },
    async repair(request) {
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
