export { LatticeTransformationBudget } from "./capacityGate.js";

const HELD_RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
});

const heldApiWorker = Object.freeze({
  async fetch() {
    return new Response(JSON.stringify({ error: "upstream_unavailable" }), {
      status: 503,
      headers: HELD_RESPONSE_HEADERS,
    });
  },
});

export default heldApiWorker;
