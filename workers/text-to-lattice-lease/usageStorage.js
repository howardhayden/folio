import { nextUsageExpiry, usageStateIsEmpty } from "./policy.js";

// Expiry cleanup is deliberately coalesced to UTC minute boundaries. Exact
// quota decisions still prune against their millisecond timestamps on every
// request; this only batches retention cleanup so one busy minute cannot
// create scores of separately billed alarm deliveries and retries.
export const LATTICE_USAGE_ALARM_BUCKET_MILLISECONDS = 60_000;

export function coalescedUsageAlarmTime(nextExpiry) {
  if (!Number.isSafeInteger(nextExpiry) || nextExpiry < 0) {
    throw new TypeError("Usage expiry must be a non-negative integer timestamp.");
  }
  const alarmTime = Math.ceil(
    nextExpiry / LATTICE_USAGE_ALARM_BUCKET_MILLISECONDS,
  ) * LATTICE_USAGE_ALARM_BUCKET_MILLISECONDS;
  if (!Number.isSafeInteger(alarmTime)) {
    throw new RangeError("Usage expiry cannot be represented as a coalesced alarm.");
  }
  return alarmTime;
}

export async function commitUsageMutation(storage, stateKey, mutate) {
  let outcome;
  // This gate is declared with `new_sqlite_classes`. For SQLite-backed Durable
  // Objects, Cloudflare includes direct ctx.storage operations in this
  // transaction; that is also how the top-level alarm methods remain atomic
  // with the corresponding state mutation.
  await storage.transaction(async () => {
    const storedState = await storage.get(stateKey);
    outcome = await mutate(storedState);
    if (!outcome || typeof outcome !== "object" || typeof outcome.stateChanged !== "boolean") {
      throw new TypeError("Usage mutation returned an invalid outcome.");
    }
    if (!outcome.stateChanged) return;

    if (usageStateIsEmpty(outcome.state)) await storage.delete(stateKey);
    else await storage.put(stateKey, outcome.state);

    const nextExpiry = nextUsageExpiry(outcome.state);
    if (nextExpiry === null) await storage.deleteAlarm();
    else await storage.setAlarm(coalescedUsageAlarmTime(nextExpiry));
  });
  if (!outcome) throw new Error("Usage mutation did not run.");
  return outcome;
}
