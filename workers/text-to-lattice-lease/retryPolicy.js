import { LATTICE_USAGE_POLICY } from "./policy.js";

export const LATTICE_MAX_PUBLIC_RETRY_AFTER_SECONDS =
  LATTICE_USAGE_POLICY.visitor.windowSeconds + 60;

export function boundedInternalRetryAfterSeconds(...values) {
  const candidates = values.flatMap((value) => {
    if (Number.isSafeInteger(value) && value > 0) return [value];
    if (typeof value !== "string" || !/^[1-9][0-9]{0,14}$/u.test(value)) return [];
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? [parsed] : [];
  });
  if (candidates.length === 0) return 60;
  return Math.min(
    LATTICE_MAX_PUBLIC_RETRY_AFTER_SECONDS,
    Math.max(...candidates),
  );
}
