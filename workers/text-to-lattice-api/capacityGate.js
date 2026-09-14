import { DurableObject } from "cloudflare:workers";

import {
  LATTICE_TRANSFORMATION_CAPACITY_SCHEMA_VERSION,
  claimLatticeTransformation,
  isLatticeCapacityVisitorId,
  latticeTransformationStateExpiresAt,
} from "./capacityPolicy.js";
import {
  LATTICE_TRANSFORMATION_CAPACITY_INTERNAL_URL,
  LATTICE_TRANSFORMATION_VISITOR_HEADER,
} from "./capacityClient.js";

const CAPACITY_STATE_KEY = "transformation-capacity-v1";
const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
});

function jsonResponse(value, status) {
  return new Response(JSON.stringify(value), { status, headers: RESPONSE_HEADERS });
}

export class LatticeTransformationBudget extends DurableObject {
  async fetch(request) {
    const visitorId = request.headers.get(LATTICE_TRANSFORMATION_VISITOR_HEADER);
    if (request.url !== LATTICE_TRANSFORMATION_CAPACITY_INTERNAL_URL
      || request.method !== "POST"
      || request.body !== null
      || !isLatticeCapacityVisitorId(visitorId)) {
      return jsonResponse({
        allowed: false,
        schema_version: LATTICE_TRANSFORMATION_CAPACITY_SCHEMA_VERSION,
      }, 404);
    }

    let outcome;
    await this.ctx.storage.transaction(async (transaction) => {
      outcome = claimLatticeTransformation(
        await transaction.get(CAPACITY_STATE_KEY),
        { now: Date.now(), visitorId },
      );
      if (outcome.stateChanged) {
        await transaction.put(CAPACITY_STATE_KEY, outcome.state);
        await this.ctx.storage.setAlarm(
          latticeTransformationStateExpiresAt(outcome.state),
        );
      }
    });
    if (!outcome) throw new Error("The transformation-capacity transaction did not run.");
    if (outcome.result.allowed) {
      return jsonResponse({
        allowed: true,
        schema_version: LATTICE_TRANSFORMATION_CAPACITY_SCHEMA_VERSION,
      }, 200);
    }
    return jsonResponse({
      allowed: false,
      scope: outcome.result.scope,
      retry_after_seconds: outcome.result.retryAfterSeconds,
      schema_version: LATTICE_TRANSFORMATION_CAPACITY_SCHEMA_VERSION,
    }, 429);
  }

  async alarm() {
    await this.ctx.storage.transaction(async (transaction) => {
      const storedState = await transaction.get(CAPACITY_STATE_KEY);
      const expiresAt = latticeTransformationStateExpiresAt(storedState);
      if (expiresAt === null) {
        await this.ctx.storage.deleteAlarm();
      } else if (expiresAt <= Date.now()) {
        await transaction.delete(CAPACITY_STATE_KEY);
        await this.ctx.storage.deleteAlarm();
      } else {
        await this.ctx.storage.setAlarm(expiresAt);
      }
    });
  }
}
