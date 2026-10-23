// Operational guidance for the host's existing verifier correction attempt.
// No qualification observation, raw reply or error prose selects this cue.
const FAILURES = new WeakMap();
const REQUESTS = new WeakMap();

function data(value, key) {
  if (!value || typeof value !== "object" || !Object.isFrozen(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function matches(request, context) {
  const feedback = data(request, "protocolFeedback");
  return data(request, "batch") === context.batch
    && data(request, "analysis") === context.analysis
    && data(request, "candidate") === context.candidate
    && data(feedback, "stage") === context.stage
    && data(feedback, "attempt") === 2;
}

// Called only at the actual issue-to-failed-check host predicate, using the
// batch, analysis and candidate currently being normalized.
export function rememberLatticeVerificationIssueAlignmentError(error, batch, analysis, candidate, stage) {
  if (error !== null && typeof error === "object"
    && ["verification", "reverification"].includes(stage)
    && [batch, analysis, candidate].every((value) => value !== null
      && typeof value === "object" && Object.isFrozen(value))
    && !FAILURES.has(error)) {
    FAILURES.set(error, Object.freeze({ batch, analysis, candidate, stage }));
  }
  return error;
}

export async function withLatticeVerificationCorrection(request, error, invoke) {
  const origin = FAILURES.get(error);
  let context = null;
  if (origin && matches(request, origin) && !REQUESTS.has(request)) {
    context = { ...origin, active: true };
    FAILURES.delete(error);
    REQUESTS.set(request, context);
  }
  try {
    return await invoke();
  } finally {
    if (context) {
      context.active = false;
      if (REQUESTS.get(request) === context) REQUESTS.delete(request);
    }
  }
}

// The adapter selects this before its mode-only copy; no alias is authorized.
export function getLatticeVerificationCorrection(request) {
  const context = REQUESTS.get(request);
  return context?.active && matches(request, context) ? "issue-alignment" : null;
}
