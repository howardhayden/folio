import { LATTICE_ANALYSIS_VALIDATION_CATEGORIES } from "./promptContract.js";
import {
  LATTICE_REJECTION_BOUNDARIES, LATTICE_REJECTION_CATEGORIES, LATTICE_REJECTION_RULES,
  LATTICE_DETERMINISTIC_RULES, rejectionRuleIsConsistent,
} from "./rejectionDiagnostics.js";

// Separate from the historical terminal failure trace. These fields describe
// actual post-verification control flow and committed candidate provenance.
export const LATTICE_WITHHELD_PIPELINE_VALUES = Object.freeze({
  retryPath: Object.freeze(["none", "repair", "reanalysis-only", "regeneration", "mixed"]),
  candidateLineage: Object.freeze(["initial", "repair", "regeneration", "mixed"]),
  initialDeterministic: Object.freeze(["clear", "d14-only", "other", "d14-and-other"]),
});
export const LATTICE_WITHHELD_PIPELINE_FIELDS = Object.freeze(Object.keys(LATTICE_WITHHELD_PIPELINE_VALUES));

export function isClosedWithheldPipelineObservation(value) {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)
      || !Object.isFrozen(value) || Object.getPrototypeOf(value) !== Object.prototype
      || Reflect.ownKeys(value).length !== LATTICE_WITHHELD_PIPELINE_FIELDS.length
      || !LATTICE_WITHHELD_PIPELINE_FIELDS.every((field) => {
        const descriptor = Object.getOwnPropertyDescriptor(value, field);
        return descriptor?.enumerable === true && Object.hasOwn(descriptor, "value")
          && LATTICE_WITHHELD_PIPELINE_VALUES[field].includes(descriptor.value);
      })) return false;
    if (["none", "reanalysis-only"].includes(value.retryPath)) return value.candidateLineage === "initial";
    if (value.retryPath === "repair") return value.candidateLineage !== "regeneration";
    if (value.retryPath === "regeneration") return value.candidateLineage !== "repair";
    return true;
  } catch { return false; }
}

// This optional observation is the first verifier rejection retained when its
// correction provider call fails. It is not a verification or decoding result.
export function isClosedPriorVerificationRejection(trace) {
  try {
    const fields = ["boundary", "category", "rule"];
    return trace !== null && typeof trace === "object" && !Array.isArray(trace)
      && Object.isFrozen(trace) && Object.getPrototypeOf(trace) === Object.prototype
      && Reflect.ownKeys(trace).length === fields.length
      && fields.every((field) => {
        const descriptor = Object.getOwnPropertyDescriptor(trace, field);
        return descriptor && descriptor.enumerable === true && Object.hasOwn(descriptor, "value");
      })
      && LATTICE_REJECTION_BOUNDARIES.includes(trace.boundary)
      && LATTICE_REJECTION_CATEGORIES.includes(trace.category)
      && LATTICE_REJECTION_RULES.includes(trace.rule)
      && (trace.rule === "unknown" || trace.rule.startsWith("V"))
      && (trace.boundary !== "host-normalizer"
        || (trace.category === "other" && trace.rule === "unknown"))
      && rejectionRuleIsConsistent(trace.boundary, trace.category, trace.rule);
  } catch {
    return false;
  }
}

// These independent host observations describe a withheld terminal result. They
// do not identify a unique cause or retain any transformation content.
export const LATTICE_WITHHELD_TRACE_VALUES = Object.freeze({
  revision: Object.freeze(["coherent", "incomplete"]),
  deterministic: Object.freeze(["clear", "blocked"]),
  firstDeterministicRule: Object.freeze(["none", ...LATTICE_DETERMINISTIC_RULES]),
  verification: Object.freeze([
    "accepted", "review-only-rejection", "semantic-rejection", "unavailable", "missing", "mixed",
  ]),
  certification: Object.freeze([
    "accepted", "performed-not-accepted", "not-performed", "not-reached", "not-required",
  ]),
  failureCause: Object.freeze([
    "none", "multiple", "host-validation", "context-capacity", "output-limit", "unclassified",
  ]),
  stage: Object.freeze([
    "none", "multiple", "generation", "generation-recovery", "re-atomization", "regeneration",
    "repair", "verification", "reverification", "document-certification",
    "document-window-certification", "document-relation-certification",
  ]),
  attempt: Object.freeze(["none", "multiple", "1", "2"]),
  validationCategory: Object.freeze([...LATTICE_ANALYSIS_VALIDATION_CATEGORIES, "decision-consistency", "multiple"]),
  priorValidationCategory: Object.freeze([...LATTICE_ANALYSIS_VALIDATION_CATEGORIES, "decision-consistency", "multiple"]),
  rejectionBoundary: Object.freeze(["none", "multiple", "unknown", ...LATTICE_REJECTION_BOUNDARIES]),
  rejectionCategory: Object.freeze(["none", "multiple", ...LATTICE_REJECTION_CATEGORIES]),
  rejectionRule: Object.freeze(["none", "multiple", ...LATTICE_REJECTION_RULES]),
  priorRejectionBoundary: Object.freeze(["none", "multiple", "unknown", ...LATTICE_REJECTION_BOUNDARIES]),
  priorRejectionCategory: Object.freeze(["none", "multiple", ...LATTICE_REJECTION_CATEGORIES]),
  priorRejectionRule: Object.freeze(["none", "multiple", ...LATTICE_REJECTION_RULES]),
});
export const LATTICE_WITHHELD_TRACE_FIELDS = Object.freeze(Object.keys(LATTICE_WITHHELD_TRACE_VALUES));
const VALUE_SETS = Object.fromEntries(Object.entries(LATTICE_WITHHELD_TRACE_VALUES)
  .map(([field, values]) => [field, new Set(values)]));
const FAILURE_FIELDS = Object.freeze([
  "failureCause", "stage", "attempt", "validationCategory", "priorValidationCategory",
  "rejectionBoundary", "rejectionCategory", "priorRejectionBoundary", "priorRejectionCategory",
  "rejectionRule", "priorRejectionRule",
]);

export function withheldTraceIsConsistent(trace) {
  if (!LATTICE_WITHHELD_TRACE_FIELDS.every((field) => VALUE_SETS[field].has(trace?.[field]))) return false;
  if ((trace.deterministic === "clear") !== (trace.firstDeterministicRule === "none")) return false;
  if (trace.failureCause === "none" || trace.failureCause === "multiple") {
    return FAILURE_FIELDS.every((field) => trace[field] === trace.failureCause);
  }
  if (["none", "multiple"].includes(trace.stage)
    || !["1", "2"].includes(trace.attempt)
    || ["none", "multiple"].includes(trace.validationCategory)
    || trace.priorValidationCategory === "multiple"
    || (trace.attempt === "1" && trace.priorValidationCategory !== "none")
    || (trace.attempt === "2" && trace.priorValidationCategory === "none")
    || (trace.failureCause === "host-validation" && trace.attempt === "1"
      && !["document-window-certification", "document-relation-certification"].includes(trace.stage))
    || (["context-capacity", "output-limit"].includes(trace.failureCause)
      && trace.validationCategory !== "capacity")) return false;
  for (const [boundary, category, rule] of [
    [trace.rejectionBoundary, trace.rejectionCategory, trace.rejectionRule],
    [trace.priorRejectionBoundary, trace.priorRejectionCategory, trace.priorRejectionRule],
  ]) {
    if (boundary === "multiple" || category === "multiple" || rule === "multiple"
      || (boundary === "none") !== (category === "none")
      || (boundary === "none") !== (rule === "none")
      || (boundary === "unknown" && (category !== "other" || rule !== "unknown"))
      || (boundary !== "none" && !rejectionRuleIsConsistent(boundary, category, rule))) return false;
    if ((rule.startsWith("V") && !["verification", "reverification"].includes(trace.stage))
      || (rule.startsWith("A") && trace.stage !== "re-atomization")
      || (rule.startsWith("C") && !["document-certification", "document-window-certification", "document-relation-certification"].includes(trace.stage))) return false;
  }
  if (["context-capacity", "output-limit"].includes(trace.failureCause)
    && trace.rejectionRule !== "none") return false;
  if (trace.attempt === "1"
    && (trace.priorRejectionBoundary !== "none" || trace.priorRejectionCategory !== "none")) return false;
  return true;
}

export function isClosedWithheldTrace(trace) {
  try {
    return trace !== null && typeof trace === "object" && !Array.isArray(trace)
      && Object.isFrozen(trace) && Object.getPrototypeOf(trace) === Object.prototype
      && Reflect.ownKeys(trace).length === LATTICE_WITHHELD_TRACE_FIELDS.length
      && LATTICE_WITHHELD_TRACE_FIELDS.every((field) => {
        const descriptor = Object.getOwnPropertyDescriptor(trace, field);
        return descriptor && descriptor.enumerable === true && Object.hasOwn(descriptor, "value");
      })
      && withheldTraceIsConsistent(trace);
  } catch {
    return false;
  }
}
