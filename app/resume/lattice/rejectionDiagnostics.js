// Host-created observations remain outside JSON, prompts, and model responses.
export const LATTICE_REJECTION_CATEGORIES = Object.freeze([
  "object-type", "field-set", "value-type", "value-domain", "collection-bound",
  "coverage", "reference", "duplicate", "consistency", "other",
]);
export const LATTICE_REJECTION_BOUNDARIES = Object.freeze([
  "wire-decoder", "host-normalizer",
]);
const CATEGORIES = new Set(LATTICE_REJECTION_CATEGORIES);
const BOUNDARIES = new Set(LATTICE_REJECTION_BOUNDARIES);
const RESULT_DIAGNOSTICS = new WeakMap();
const ERROR_DIAGNOSTICS = new WeakMap();
const DETERMINISTIC_DIAGNOSTICS = new WeakMap();

// Closed, source-defined predicate codes. No runtime magnitude or loop ordinal
// contributes to these names. Codes permit bounded predicate inference.
const RULE_CATEGORIES = Object.create(null);
function rules(bases, suffixes) {
  for (const base of bases) {
    for (const [suffix, category] of Object.entries(suffixes)) RULE_CATEGORIES[base + suffix] = category;
  }
}
rules(["V00", "C00"], { "": "other" });
rules(["V01", "V02", "V07", "V09", "V21", "V24", "C01"], { O: "object-type", F: "field-set" });
rules(["V03", "V08", "V10", "V11", "V22", "C03", "C06", "C08", "C09"], { "": "value-type" });
rules(["V04", "C07", "C10"], { "": "collection-bound" });
rules(["V05", "V15", "V27", "C11", "C12"], { T: "value-type", I: "value-domain", R: "value-domain" });
rules(["V06", "V13", "V14", "V16", "V17", "V18", "V23"], {
  T: "value-type", L: "value-domain", A: "value-domain",
});
rules(["V16", "V17", "V23"], { M: "coverage" });
rules(["V13"], { X: "collection-bound" });
rules(["V12"], { T: "value-type", L: "value-domain", A: "value-domain" });
rules(["V19"], { "": "consistency" });
rules(["V20", "C04"], { "": "coverage" });
rules(["V25"], { T: "value-type", I: "value-domain" });
rules(["V26", "C02", "C05"], { "": "reference" });
rules(["V28", "C13"], { "": "duplicate" });
Object.freeze(RULE_CATEGORIES);
export const LATTICE_REJECTION_RULES = Object.freeze(["unknown", ...Object.keys(RULE_CATEGORIES)]);
export const LATTICE_DETERMINISTIC_RULES = Object.freeze([
  "unknown", ...Array.from({ length: 47 }, (_value, index) => `D${String(index).padStart(2, "0")}`),
]);
const DETERMINISTIC_RULES = new Set(LATTICE_DETERMINISTIC_RULES);

export function rejectionRuleIsConsistent(boundary, category, rule) {
  return rule === "unknown" || (boundary === "wire-decoder" && RULE_CATEGORIES[rule] === category);
}

function identity(value) {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function closedDiagnostic(diagnostic) {
  if (!identity(diagnostic) || Array.isArray(diagnostic)
    || !Object.isFrozen(diagnostic) || Object.getPrototypeOf(diagnostic) !== Object.prototype
    || Reflect.ownKeys(diagnostic).length !== 3) return null;
  const boundary = Object.getOwnPropertyDescriptor(diagnostic, "boundary");
  const category = Object.getOwnPropertyDescriptor(diagnostic, "category");
  const rule = Object.getOwnPropertyDescriptor(diagnostic, "rule");
  if (!boundary?.enumerable || !category?.enumerable || !rule?.enumerable
    || !Object.hasOwn(boundary, "value") || !Object.hasOwn(category, "value") || !Object.hasOwn(rule, "value")
    || !BOUNDARIES.has(boundary.value) || !CATEGORIES.has(category.value)
    || !LATTICE_REJECTION_RULES.includes(rule.value)
    || !rejectionRuleIsConsistent(boundary.value, category.value, rule.value)) return null;
  return Object.freeze({ boundary: boundary.value, category: category.value, rule: rule.value });
}

export function rememberRejectedResult(result, category, rule = "unknown") {
  try {
    if (identity(result) && CATEGORIES.has(category) && LATTICE_REJECTION_RULES.includes(rule)
      && rejectionRuleIsConsistent("wire-decoder", category, rule)) {
      RESULT_DIAGNOSTICS.set(result, Object.freeze({ boundary: "wire-decoder", category, rule }));
    }
  } catch {
    // Observing a rejection must never change the stage outcome.
  }
  return result;
}

export function rejectedResultDiagnostic(result) {
  try {
    return identity(result) ? RESULT_DIAGNOSTICS.get(result) ?? null : null;
  } catch {
    return null;
  }
}

export function rememberRejectedError(error, diagnostic) {
  try {
    const closed = closedDiagnostic(diagnostic);
    if (identity(error) && closed !== null) ERROR_DIAGNOSTICS.set(error, closed);
  } catch {
    // Observing a rejection must never replace the original error.
  }
  return error;
}

export function rejectedErrorDiagnostic(error) {
  try {
    return identity(error) ? ERROR_DIAGNOSTICS.get(error) ?? null : null;
  } catch {
    return null;
  }
}

export function rememberDeterministicFinding(finding, rule) {
  try {
    if (identity(finding) && DETERMINISTIC_RULES.has(rule)) DETERMINISTIC_DIAGNOSTICS.set(finding, rule);
  } catch {
    // Retain the original finding if observation fails.
  }
  return finding;
}

export function deterministicFindingRule(finding) {
  try {
    return identity(finding) ? DETERMINISTIC_DIAGNOSTICS.get(finding) ?? "unknown" : "unknown";
  } catch {
    return "unknown";
  }
}
