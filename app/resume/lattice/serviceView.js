const OBSERVED_PHASES = Object.freeze({
  validating: Object.freeze({ stepId: "input", phaseNumber: 1, label: "Validating", widthPercent: 10 }),
  submitting: Object.freeze({ stepId: "submit", phaseNumber: 2, label: "Submitting", widthPercent: 20 }),
  processing: Object.freeze({ stepId: "service", phaseNumber: 3, label: "Transforming", widthPercent: 25 }),
  success: Object.freeze({ stepId: "result", phaseNumber: 4, label: "Complete", widthPercent: 100 }),
});

const SERVICE_PHASES = Object.freeze({
  "binding-source-integrity": { stepId: "prepare", label: "Preparing", widthPercent: 30 },
  atomizing: { stepId: "analysis", label: "Analyzing", widthPercent: 40 },
  generating: { stepId: "draft", label: "Drafting", widthPercent: 55 },
  "binding-result-integrity": { stepId: "bind", label: "Binding candidate", widthPercent: 65 },
  verifying: { stepId: "verify", label: "Verifying", widthPercent: 75 },
  reatomizing: { stepId: "analysis", label: "Reanalyzing", widthPercent: 40 },
  regenerating: { stepId: "repair", label: "Regenerating", widthPercent: 55 },
  repairing: { stepId: "repair", label: "Repairing", widthPercent: 55 },
  reverifying: { stepId: "verify", label: "Reverifying", widthPercent: 75 },
  "planning-certification": { stepId: "certify", label: "Planning checks", widthPercent: 85 },
  "certifying-windows": { stepId: "certify", label: "Certifying windows", widthPercent: 90 },
  "certifying-document": { stepId: "certify", label: "Certifying document", widthPercent: 90 },
  "certifying-relations": { stepId: "certify", label: "Certifying relations", widthPercent: 95 },
});

/**
 * Present only phases observed by the browser request client. The service phase
 * uses validated telemetry when supplied; never infer an internal phase from time.
 * Width marks the current phase, not elapsed progress or time remaining. Repair
 * can return to an earlier position; no numeric completion percentage is shown.
 * Clear lastActivePhase when editing input or starting over so an input error
 * cannot inherit the boundary of an earlier canceled request.
 * @param {{phase: string, lastActivePhase?: string | null, hasError?: boolean,
 *   resultStatus?: string | null, servicePhase?: string | null}} input
 */
export function latticeServiceViewState({
  phase,
  lastActivePhase = null,
  hasError = false,
  resultStatus = null,
  servicePhase = null,
}) {
  const observed = Object.hasOwn(OBSERVED_PHASES, phase) ? OBSERVED_PHASES[phase] : null;
  const previous = lastActivePhase && Object.hasOwn(OBSERVED_PHASES, lastActivePhase)
    ? OBSERVED_PHASES[lastActivePhase]
    : null;
  let boundary = observed;
  let label = phase === "idle" ? "Idle" : "Ready";
  let tone = "storm-gray";

  if (phase === "canceling" || phase === "error" || hasError) {
    boundary = previous ?? observed ?? OBSERVED_PHASES.validating;
    label = phase === "canceling" ? "Canceling"
      : (phase === "idle" || phase === "ready") && !previous ? "Check input"
      : "Stopped";
    tone = "red-orange";
  } else if (phase === "success") {
    if (resultStatus === "review-required" || resultStatus === "unable-to-attempt") {
      label = resultStatus === "review-required" ? "Review required" : "Unable to attempt";
      tone = "red-orange";
    } else {
      label = "Complete";
    }
  } else if (observed) {
    label = observed.label;
    tone = "blue-green";
  }

  const phaseNumber = boundary?.phaseNumber ?? 0;
  const service = phaseNumber === 3 && servicePhase && Object.hasOwn(SERVICE_PHASES, servicePhase)
    ? SERVICE_PHASES[servicePhase] : null;
  return {
    label: service ? tone === "blue-green" ? service.label : `${label} · ${service.label}` : label,
    tone,
    stepId: service?.stepId ?? boundary?.stepId ?? null,
    phaseNumber,
    widthPercent: service?.widthPercent ?? boundary?.widthPercent ?? 100,
  };
}
