// Trusted internal decoder-to-host provenance. Model fields never authenticate
// an origin. This always-on routing fact is separate from optional diagnostics.
const ANALYSIS_PASSAGE_ORIGINS = new WeakMap();
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function rememberLatticeAnalysisPassageOrigins(analysis, origins) {
  if (!object(analysis) || ANALYSIS_PASSAGE_ORIGINS.has(analysis) || !Array.isArray(origins)) return analysis;
  const passages = new WeakMap();
  for (const origin of origins) {
    if (!object(origin) || !object(origin.passage) || !object(origin.source)
      || typeof origin.retentionDowngraded !== "boolean" || passages.has(origin.passage)) return analysis;
    passages.set(origin.passage, Object.freeze({
      source: origin.source,
      retentionDowngraded: origin.retentionDowngraded,
    }));
  }
  ANALYSIS_PASSAGE_ORIGINS.set(analysis, passages);
  return analysis;
}

export function getLatticeAnalysisPassageRetentionDowngrade(analysis, passage, source) {
  const origin = ANALYSIS_PASSAGE_ORIGINS.get(analysis)?.get(passage);
  return origin && origin.source === source ? origin.retentionDowngraded : null;
}
