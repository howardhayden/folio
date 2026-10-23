// Operational context for one actual host regeneration attempt. This is not
// qualification storage and never authenticates model-authored review fields.
const RETENTION_CONTEXTS = new WeakMap();
const EMPTY = Object.freeze([]);

function data(value, key) {
  if (!value || typeof value !== "object" || !Object.isFrozen(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}

function passages(value) {
  const items = data(value, "passages");
  if (!Array.isArray(items) || !Object.isFrozen(items)) return null;
  const result = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = data(items, index);
    if (!item || typeof item !== "object" || !Object.isFrozen(item)) return null;
    result.push(item);
  }
  return result;
}

function matches(request, context) {
  return context.active && data(request, "regenerationFromReanalysis") === true
    && data(request, "batch") === context.batch
    && data(request, "verification") === context.verification
    && data(request, "analysis") === context.analysis;
}

// Called only at the host's existing regeneration invocation, with the owned
// normalized prior review and committed replacement graph, never raw replies.
export async function withLatticeRegenerationRetentionContext(request, batch, verification, analysis, invoke) {
  const context = { active: true, batch, verification, analysis, positions: EMPTY };
  if (matches(request, context) && !RETENTION_CONTEXTS.has(request)
    && data(verification, "available") === true
    && data(data(verification, "gates"), "languageSupported") === true) {
    const sources = passages(batch);
    const reviews = passages(verification);
    const plans = passages(analysis);
    if (sources && reviews && plans) {
      context.positions = Object.freeze(sources.flatMap((source, position) => {
        const id = data(source, "id");
        const matchingReviews = reviews.filter((review) => data(review, "passageId") === id);
        const matchingPlans = plans.filter((plan) => data(plan, "passageId") === id);
        return typeof id === "string" && sources.filter((item) => data(item, "id") === id).length === 1
          && matchingReviews.length === 1 && matchingPlans.length === 1
          && data(matchingReviews[0], "requiresPositiveConformance") === true
          && data(matchingReviews[0], "conformanceConfirmed") === false
          && data(matchingPlans[0], "disposition") === "rewrite" ? [position] : [];
      }));
      if (context.positions.length > 0) RETENTION_CONTEXTS.set(request, context);
    }
  }
  try {
    return await invoke();
  } finally {
    context.active = false;
    if (RETENTION_CONTEXTS.get(request) === context) RETENTION_CONTEXTS.delete(request);
  }
}

// The remote adapter adds mode-only settings before constructing messages.
// Only that explicit internal copy may share a live context with identical
// batch/review/analysis objects; ordinary request clones remain unauthenticated.
export function carryLatticeRegenerationRetentionContext(source, destination) {
  const context = RETENTION_CONTEXTS.get(source);
  if (context && matches(source, context) && matches(destination, context)
    && !RETENTION_CONTEXTS.has(destination)) RETENTION_CONTEXTS.set(destination, context);
  return destination;
}

export function getLatticeRegenerationRetentionPositions(request) {
  const context = RETENTION_CONTEXTS.get(request);
  return context && matches(request, context) ? context.positions : EMPTY;
}
