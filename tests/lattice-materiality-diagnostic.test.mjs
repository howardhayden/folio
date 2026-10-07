import assert from "node:assert/strict";
import test from "node:test";
import {
  deterministicBatchReview,
  getLatticeBatchD14Comparison,
  materiallyDifferent,
} from "../app/resume/lattice/validators.js";
import { deterministicFindingRule } from "../app/resume/lattice/rejectionDiagnostics.js";

function fixture(pairs, disposition = "rewrite") {
  const batch = Object.freeze({ passages: Object.freeze(pairs.map(([text], index) => Object.freeze({
    id: `p${index}`, text, wordCount: text.split(/\s+/u).length,
  }))) });
  const analysis = Object.freeze({ passages: Object.freeze(pairs.map((_, index) => Object.freeze({
    passageId: `p${index}`, disposition, layer: "plain", atoms: Object.freeze([]),
  }))) });
  const candidate = Object.freeze({ passages: Object.freeze(pairs.map(([, text], index) => Object.freeze({
    passageId: `p${index}`, text, layer: "plain", preservedAtomIds: Object.freeze([]),
  }))) });
  return { batch, analysis, candidate };
}

function observed(value) {
  const { batch, analysis, candidate } = value;
  const ordinary = deterministicBatchReview(batch, analysis, candidate);
  const findings = deterministicBatchReview(batch, analysis, candidate, true);
  assert.deepEqual(findings, ordinary, "diagnostic capture preserves every review finding");
  assert.equal(getLatticeBatchD14Comparison(batch, analysis, candidate, ordinary), null,
    "the ordinary path does not capture comparison observations");
  return { findings, comparison: getLatticeBatchD14Comparison(batch, analysis, candidate, findings) };
}

test("D14 comparison preserves exact bytes and the original first-equality order", async (context) => {
  const cases = [
    ["exact-source", "Alpha beta", "Alpha beta"],
    ["material-form-equal", "Alpha beta", "ALPHA BETA"],
    ["material-form-equal", "Alpha beta", "Alpha beta "],
    ["material-form-equal", "Alpha beta", "Ａlpha beta"],
    ["typography-form-equal", "Alpha beta", "A\u0332lpha beta"],
    ["presentation-stripped-equal", "Alpha beta", "Al.pha beta"],
  ];
  for (const [expected, source, output] of cases) await context.test(`${expected}: ${JSON.stringify(output)}`, () => {
    const { findings, comparison } = observed(fixture([[source, output]]));
    assert.equal(materiallyDifferent(source, output), false);
    assert.ok(findings.some((finding) => deterministicFindingRule(finding) === "D14"));
    assert.equal(comparison, expected);
    if (source !== output) assert.equal(observed(fixture([[output, source]])).comparison, expected);
  });
});

test("D14 aggregation ignores non-D14 passages and distinguishes repeated from mixed comparisons", () => {
  assert.equal(observed(fixture([["Alpha beta", "Alpha beta"], ["Gamma delta", "Gamma delta"]])).comparison, "exact-source");
  assert.equal(observed(fixture([["Alpha beta", "Alpha beta"], ["Gamma delta", "GAMMA DELTA"]])).comparison, "mixed");
  assert.equal(observed(fixture([["Alpha beta", "Alpha beta"], ["Gamma delta", "Durable delta"]])).comparison, "exact-source");
  assert.equal(observed(fixture([["Alpha beta", "Durable beta"]])).comparison, "not-applicable");
  assert.equal(observed(fixture([["Alpha beta", "Alpha beta"]], "retain-if-conformant")).comparison, "not-applicable");
  assert.equal(observed(fixture([["Alpha beta", "Changed beta"]], "retain-if-conformant")).comparison, "not-applicable");
});

test("empty, missing and invalid candidate findings are unchanged and are not D14", () => {
  for (const text of ["", null, undefined]) {
    const { findings, comparison } = observed(fixture([["Alpha beta", text]]));
    assert.equal(findings[0].id, "candidate-empty");
    assert.equal(comparison, "not-applicable");
  }
  const value = fixture([["Alpha beta", "Alpha beta"]]);
  value.candidate = Object.freeze({ passages: Object.freeze([]) });
  const { findings, comparison } = observed(value);
  assert.deepEqual(findings.map(({ id }) => id), ["candidate-coverage", "candidate-passage-missing"]);
  assert.equal(comparison, "not-applicable");
});

test("only the authentic immutable batch, analysis, candidate and review identities project", () => {
  const value = fixture([["Alpha beta", "Alpha beta"]]);
  const { batch, analysis, candidate } = value;
  const { findings } = observed(value);
  const clone = (object) => Object.freeze({ ...object });
  for (const [b, a, c, f] of [
    [clone(batch), analysis, candidate, findings],
    [batch, clone(analysis), candidate, findings],
    [batch, analysis, clone(candidate), findings],
    [batch, analysis, candidate, Object.freeze([...findings])],
    [batch, analysis, candidate, Object.freeze(findings.map(clone))],
    [batch, analysis, candidate, Object.freeze([{ id: "candidate-not-material", finalD14Comparison: "exact-source" }])],
    [batch, analysis, candidate, new Proxy(findings, {})],
  ]) assert.equal(getLatticeBatchD14Comparison(b, a, c, f), null);
  const other = fixture([["Alpha beta", "Alpha beta"]]);
  const otherFindings = observed(other).findings;
  assert.equal(getLatticeBatchD14Comparison(batch, analysis, candidate, otherFindings), null,
    "equal text from a different review never authenticates a discarded candidate");
  let reads = 0;
  const accessor = Object.freeze({ get comparison() { reads += 1; return "exact-source"; } });
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  for (const key of [undefined, null, "D14", accessor, proxy]) {
    assert.equal(getLatticeBatchD14Comparison(undefined, undefined, undefined, key), null);
  }
  assert.equal(reads, 0);
});

test("mutable or accessor-backed input identities cannot authenticate an observation", () => {
  for (const key of ["batch", "analysis", "candidate"]) {
    const value = fixture([["Alpha beta", "Alpha beta"]]);
    value[key] = { ...value[key] };
    assert.equal(observed(value).comparison, null);
  }
  const value = fixture([["Alpha beta", "Alpha beta"]]);
  const source = value.batch.passages[0];
  value.batch = Object.freeze({ passages: Object.freeze([Object.freeze({
    ...source, get text() { return source.text; },
  })]) });
  assert.equal(observed(value).comparison, null);
});

test("not-applicable requires own immutable data for every comparison and identity field", async (context) => {
  const fields = [["batch", "id"], ["batch", "text"], ["analysis", "passageId"],
    ["analysis", "disposition"], ["candidate", "passageId"], ["candidate", "text"]];
  for (const kind of ["accessor", "inherited"]) {
    for (const [container, key] of fields) await context.test(`${kind} ${container}.${key}`, () => {
      const value = fixture([["Alpha beta", "Durable beta"]]);
      const original = value[container].passages[0];
      let backing = original[key];
      const replacement = { ...original };
      delete replacement[key];
      if (kind === "accessor") {
        Object.defineProperty(replacement, key, { enumerable: true, get() { return backing; } });
      } else {
        Object.setPrototypeOf(replacement, { [key]: backing });
      }
      value[container] = Object.freeze({ passages: Object.freeze([Object.freeze(replacement)]) });
      const { findings, comparison } = observed(value);
      assert.equal(findings.length, 0, "this is a genuine no-D14 review");
      assert.equal(comparison, null);
      backing = key === "disposition" ? "retain-if-conformant" : "Changed after review";
      if (kind === "inherited") Object.getPrototypeOf(replacement)[key] = backing;
      assert.equal(getLatticeBatchD14Comparison(value.batch, value.analysis, value.candidate, findings), null);
    });
  }
});

test("missing or mismatched authentic D14 binding suppresses the comparison without changing review", () => {
  for (const mode of ["missing", "source", "plan", "candidate"]) {
    const value = fixture([["Alpha beta", "Alpha beta"]]);
    const originalGet = WeakMap.prototype.get;
    let result;
    try {
      WeakMap.prototype.get = function get(key) {
        const origin = originalGet.call(this, key);
        if (origin && Object.hasOwn(origin, "sourcePassage") && Object.hasOwn(origin, "comparison")) {
          if (mode === "missing") return undefined;
          const field = mode === "source" ? "sourcePassage" : mode;
          return { ...origin, [field]: Object.freeze({ ...origin[field] }) };
        }
        return origin;
      };
      result = observed(value);
    } finally {
      WeakMap.prototype.get = originalGet;
    }
    assert.equal(result.comparison, null, mode);
    assert.equal(result.findings.at(-1).id, "candidate-not-material");
  }
});
