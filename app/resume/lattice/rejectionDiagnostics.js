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

function identity(value) {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function closedDiagnostic(diagnostic) {
  if (!identity(diagnostic) || Array.isArray(diagnostic)
    || !Object.isFrozen(diagnostic) || Object.getPrototypeOf(diagnostic) !== Object.prototype
    || Reflect.ownKeys(diagnostic).length !== 2) return null;
  const boundary = Object.getOwnPropertyDescriptor(diagnostic, "boundary");
  const category = Object.getOwnPropertyDescriptor(diagnostic, "category");
  if (!boundary?.enumerable || !category?.enumerable
    || !Object.hasOwn(boundary, "value") || !Object.hasOwn(category, "value")
    || !BOUNDARIES.has(boundary.value) || !CATEGORIES.has(category.value)) return null;
  return Object.freeze({ boundary: boundary.value, category: category.value });
}

export function rememberRejectedResult(result, category) {
  try {
    if (identity(result) && CATEGORIES.has(category)) {
      RESULT_DIAGNOSTICS.set(result, Object.freeze({ boundary: "wire-decoder", category }));
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
