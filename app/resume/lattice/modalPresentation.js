import { LatticeRemoteError } from "./remoteRequest.js";

const STORM_GRAY = "storm-gray";
const BLUE_GREEN = "blue-green";
const RED_ORANGE = "red-orange";

export const LATTICE_MODAL_HELD_SETUP_MESSAGE = "The Text to Lattice interactive release is held. Your text was not sent to the configured external service. Submit again only after the release is available.";
export const LATTICE_MODAL_HELD_CONTENT_MESSAGE = "The Text to Lattice interactive release is held. The request may have reached the configured external service. hah.dev does not retain your sample or result. Submit again only after the release is available.";

export const LATTICE_MODAL_MILESTONE_PERCENTAGES = Object.freeze({
  idle: 0,
  ready: 0,
  validating: 20,
  submitting: 45,
  processing: 75,
  success: 100,
});

function template({ label, tone, terminal = false, successful = false }) {
  return Object.freeze({ label, tone, terminal, successful });
}

// Percentages identify client-observable lifecycle milestones. They do not
// estimate elapsed provider work or imply progress within a remote operation.
const LATTICE_MODAL_PHASE_TEMPLATES = Object.freeze({
  idle: template({ label: "Ready", tone: STORM_GRAY }),
  ready: template({ label: "Ready", tone: STORM_GRAY }),
  validating: template({ label: "Validating source", tone: STORM_GRAY }),
  submitting: template({ label: "Submitting to hah.dev", tone: STORM_GRAY }),
  processing: template({ label: "Processing with the external service", tone: STORM_GRAY }),
  success: template({ label: "Complete", tone: BLUE_GREEN, terminal: true, successful: true }),
  canceling: template({ label: "Canceling", tone: STORM_GRAY }),
  error: template({ label: "Could not complete", tone: RED_ORANGE, terminal: true }),
});

// These conditions sit outside the interactive request phase. Keeping them
// explicit prevents held, refused, or unavailable work from inheriting the
// completed request treatment.
const LATTICE_MODAL_DISPOSITION_TEMPLATES = Object.freeze({
  canceled: template({ label: "Canceled", tone: STORM_GRAY, terminal: true }),
  held: template({ label: "Interactive release held", tone: STORM_GRAY, terminal: true }),
  rejected: template({ label: "Request rejected", tone: RED_ORANGE, terminal: true }),
  unavailable: template({ label: "Service unavailable", tone: RED_ORANGE, terminal: true }),
});

const LATTICE_RESULT_TEMPLATES = Object.freeze({
  translated: LATTICE_MODAL_PHASE_TEMPLATES.success,
  "conformant-for-context": LATTICE_MODAL_PHASE_TEMPLATES.success,
  "review-required": template({
    label: "Review required",
    tone: BLUE_GREEN,
    terminal: true,
    successful: true,
  }),
  "unable-to-attempt": template({
    label: "Unable to produce a result",
    tone: RED_ORANGE,
    terminal: true,
  }),
});

function own(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/**
 * Identify the two client-observable forms of the held API's bounded 503.
 *
 * The bodyless visitor-session setup intentionally maps every non-204 response
 * to `visitor_session_required`, while a 503 received after setup retains the
 * API's `upstream_unavailable` code. Status and code are both required so an
 * ordinary 428 cookie rejection or 502 provider failure is never called held.
 *
 * @param {unknown} error
 */
export function latticeHeldResponsePresentation(error) {
  if (!(error instanceof LatticeRemoteError)
    || error.status !== 503
    || !["visitor_session_required", "upstream_unavailable"].includes(error.code)) {
    return null;
  }
  return Object.freeze({
    disposition: "held",
    message: error.code === "visitor_session_required"
      ? LATTICE_MODAL_HELD_SETUP_MESSAGE
      : LATTICE_MODAL_HELD_CONTENT_MESSAGE,
  });
}

function atObservedMilestone(state, lastObservedPhase) {
  if (!own(LATTICE_MODAL_MILESTONE_PERCENTAGES, lastObservedPhase)) {
    throw new RangeError(`Unsupported Text to Lattice milestone phase: ${String(lastObservedPhase)}`);
  }
  return Object.freeze({
    ...state,
    percent: LATTICE_MODAL_MILESTONE_PERCENTAGES[lastObservedPhase],
  });
}

/**
 * Resolve presentation-only state for the Text to Lattice modal.
 *
 * `disposition` is explicit rather than inferred from user-facing copy. A
 * result status is considered only after the request reaches `success`.
 *
 * @param {object} options
 * @param {keyof typeof LATTICE_MODAL_PHASE_TEMPLATES} options.phase
 * @param {keyof typeof LATTICE_MODAL_MILESTONE_PERCENTAGES} [options.lastObservedPhase]
 * @param {keyof typeof LATTICE_RESULT_TEMPLATES | null} [options.resultStatus]
 * @param {keyof typeof LATTICE_MODAL_DISPOSITION_TEMPLATES | null} [options.disposition]
 */
export function latticeModalPresentation({
  phase,
  lastObservedPhase = null,
  resultStatus = null,
  disposition = null,
}) {
  if (!own(LATTICE_MODAL_PHASE_TEMPLATES, phase)) {
    throw new RangeError(`Unsupported Text to Lattice phase: ${String(phase)}`);
  }
  const needsObservedMilestone = phase === "canceling" || phase === "error" || disposition !== null;
  if (needsObservedMilestone && lastObservedPhase === null) {
    throw new RangeError("A terminal or canceling Text to Lattice state requires its last observed milestone phase.");
  }
  if (lastObservedPhase !== null && !own(LATTICE_MODAL_MILESTONE_PERCENTAGES, lastObservedPhase)) {
    throw new RangeError(`Unsupported Text to Lattice milestone phase: ${String(lastObservedPhase)}`);
  }
  if (disposition !== null) {
    if (!own(LATTICE_MODAL_DISPOSITION_TEMPLATES, disposition)) {
      throw new RangeError(`Unsupported Text to Lattice disposition: ${String(disposition)}`);
    }
    return atObservedMilestone(LATTICE_MODAL_DISPOSITION_TEMPLATES[disposition], lastObservedPhase);
  }
  if (resultStatus !== null) {
    if (!own(LATTICE_RESULT_TEMPLATES, resultStatus)) {
      throw new RangeError(`Unsupported Text to Lattice result status: ${String(resultStatus)}`);
    }
    if (phase !== "success") {
      throw new RangeError("A Text to Lattice result status requires the success phase.");
    }
    const resultMilestone = resultStatus === "unable-to-attempt" ? "processing" : "success";
    return atObservedMilestone(LATTICE_RESULT_TEMPLATES[resultStatus], resultMilestone);
  }
  if (phase === "canceling" || phase === "error") {
    return atObservedMilestone(LATTICE_MODAL_PHASE_TEMPLATES[phase], lastObservedPhase);
  }
  return atObservedMilestone(LATTICE_MODAL_PHASE_TEMPLATES[phase], phase);
}
