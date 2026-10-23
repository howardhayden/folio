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

function remember(error, batch, analysis, candidate, stage, kind) {
  if (error !== null && typeof error === "object"
    && ["verification", "reverification"].includes(stage)
    && [batch, analysis, candidate].every((value) => value !== null
      && typeof value === "object" && Object.isFrozen(value))
    && !FAILURES.has(error)) {
    FAILURES.set(error, Object.freeze({ batch, analysis, candidate, stage, kind }));
  }
  return error;
}

// Each producer fixes its own kind at the actual rejecting host predicate.
export function rememberLatticeVerificationIssueAlignmentError(error, batch, analysis, candidate, stage) {
  return remember(error, batch, analysis, candidate, stage, "issue-alignment");
}

export function rememberLatticeVerificationDecisionAlignmentError(error, batch, analysis, candidate, stage) {
  return remember(error, batch, analysis, candidate, stage, "decision-alignment");
}

export async function withLatticeVerificationCorrection(request, error, invoke) {
  const origin = FAILURES.get(error);
  let context = null;
  if (origin && matches(request, origin) && !REQUESTS.has(request)) {
    context = { ...origin, active: true };
    // Consume before invocation and prevent either producer from remarking it.
    FAILURES.set(error, null);
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
  return context?.active && matches(request, context) ? context.kind : null;
}
