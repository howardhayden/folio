import { LATTICE_ANALYSIS_VALIDATION_CATEGORIES } from "./promptContract.js";

// These independent host observations describe a withheld terminal result. They
// do not identify a unique cause or retain any transformation content.
export const LATTICE_WITHHELD_TRACE_VALUES = Object.freeze({
  revision: Object.freeze(["coherent", "incomplete"]),
  deterministic: Object.freeze(["clear", "blocked"]),
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
});
export const LATTICE_WITHHELD_TRACE_FIELDS = Object.freeze(Object.keys(LATTICE_WITHHELD_TRACE_VALUES));
const VALUE_SETS = Object.fromEntries(Object.entries(LATTICE_WITHHELD_TRACE_VALUES)
  .map(([field, values]) => [field, new Set(values)]));
const FAILURE_FIELDS = Object.freeze([
  "failureCause", "stage", "attempt", "validationCategory", "priorValidationCategory",
]);

export function withheldTraceIsConsistent(trace) {
  if (!LATTICE_WITHHELD_TRACE_FIELDS.every((field) => VALUE_SETS[field].has(trace?.[field]))) return false;
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
