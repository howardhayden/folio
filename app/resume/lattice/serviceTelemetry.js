export const LATTICE_SERVICE_EVENTS_MIME = "application/vnd.hah.lattice.events.v1+ndjson";
export const LATTICE_SERVICE_PHASE_LIMIT = 128;
export const LATTICE_SERVICE_ERROR_RESERVE_BYTES = 512;
export const LATTICE_SERVICE_PHASES = Object.freeze([
  "binding-source-integrity",
  "atomizing",
  "generating",
  "binding-result-integrity",
  "verifying",
  "reatomizing",
  "regenerating",
  "repairing",
  "reverifying",
  "planning-certification",
  "certifying-windows",
  "certifying-document",
  "certifying-relations",
]);

export function isLatticeServicePhase(value) {
  return typeof value === "string" && LATTICE_SERVICE_PHASES.includes(value);
}
