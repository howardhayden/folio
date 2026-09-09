"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type SyntheticEvent,
} from "react";
import {
  LATTICE_CLARIFICATION_SAFETY_LIMIT,
  LATTICE_CLARIFICATION_WORD_LIMIT,
  LATTICE_COMPLETION_CALL_LIMIT,
  LATTICE_INPUT_SAFETY_LIMIT,
  countLatticeWords,
  LATTICE_WORD_LIMIT,
  preflightLatticeInput,
  runTextToLattice,
  validateLatticeClarificationAnswer,
  validateLatticeInput,
} from "./latticeDemo.js";
import {
  createLocalLatticeAdapter,
  discardLocalLatticeModel,
  interruptLocalLatticeModel,
  isLocalLatticeModelCached,
  probeLocalLatticeCapability,
  probeLocalLatticeStorage,
} from "./lattice/localModel.js";
import { LATTICE_USAGE_POLICY } from "./lattice/usagePolicy.js";
import {
  LLAMA_3_2_TERMS_PROVENANCE,
} from "./lattice/modelContract.js";
import {
  LatticeLeaseError,
  acquireLatticeLease,
  releaseLatticeLease,
  renewLatticeLease,
} from "./lattice/usageLease.js";
import {
  isLatticeClarificationTarget,
  mayRevealLatticeOutput,
} from "./lattice/outputProtection.js";
import { isLatticeRetryPending, latticeRetryEta } from "./lattice/retryEta.js";
import { obtainLatticeAttestation } from "./lattice/attestation.js";
import { projects } from "./projects.js";

type ProjectIconName =
  | "airplane-engines"
  | "tree"
  | "diagram-3"
  | "bricks"
  | "backpack4"
  | "pen-fill"
  | "archive";

const LATTICE_USE_CONFIRMATION_ERROR = "Confirm this source's authority and allowed-use boundary before converting.";

function AirplaneEnginesIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      className="bi bi-airplane-engines"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 0c-.787 0-1.292.592-1.572 1.151A4.35 4.35 0 0 0 6 3v3.691l-2 1V7.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.191l-1.17.585A1.5 1.5 0 0 0 0 10.618V12a.5.5 0 0 0 .582.493l1.631-.272.313.937a.5.5 0 0 0 .948 0l.405-1.214 2.21-.369.375 2.253-1.318 1.318A.5.5 0 0 0 5.5 16h5a.5.5 0 0 0 .354-.854l-1.318-1.318.375-2.253 2.21.369.405 1.214a.5.5 0 0 0 .948 0l.313-.937 1.63.272A.5.5 0 0 0 16 12v-1.382a1.5 1.5 0 0 0-.83-1.342L14 8.691V7.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v.191l-2-1V3c0-.568-.14-1.271-.428-1.849C9.292.591 8.787 0 8 0M7 3c0-.432.11-.979.322-1.401C7.542 1.159 7.787 1 8 1s.458.158.678.599C8.889 2.02 9 2.569 9 3v4a.5.5 0 0 0 .276.447l5.448 2.724a.5.5 0 0 1 .276.447v.792l-5.418-.903a.5.5 0 0 0-.575.41l-.5 3a.5.5 0 0 0 .14.437l.646.646H6.707l.647-.646a.5.5 0 0 0 .14-.436l-.5-3a.5.5 0 0 0-.576-.411L1 11.41v-.792a.5.5 0 0 1 .276-.447l5.448-2.724A.5.5 0 0 0 7 7z" />
    </svg>
  );
}

function TreeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      className="bi bi-tree"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8.416.223a.5.5 0 0 0-.832 0l-3 4.5A.5.5 0 0 0 5 5.5h.098L3.076 8.735A.5.5 0 0 0 3.5 9.5h.191l-1.638 3.276a.5.5 0 0 0 .447.724H7V16h2v-2.5h4.5a.5.5 0 0 0 .447-.724L12.31 9.5h.191a.5.5 0 0 0 .424-.765L10.902 5.5H11a.5.5 0 0 0 .416-.777zM6.437 4.758A.5.5 0 0 0 6 4.5h-.066L8 1.401 10.066 4.5H10a.5.5 0 0 0-.424.765L11.598 8.5H11.5a.5.5 0 0 0-.447.724L12.69 12.5H3.309l1.638-3.276A.5.5 0 0 0 4.5 8.5h-.098l2.022-3.235a.5.5 0 0 0 .013-.507" />
    </svg>
  );
}

function Diagram3Icon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      className="bi bi-diagram-3"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fillRule="evenodd"
        d="M6 3.5A1.5 1.5 0 0 1 7.5 2h1A1.5 1.5 0 0 1 10 3.5v1A1.5 1.5 0 0 1 8.5 6v1H14a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0V8h-5v.5a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 2 7h5.5V6A1.5 1.5 0 0 1 6 4.5zM8.5 5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5zM0 11.5A1.5 1.5 0 0 1 1.5 10h1A1.5 1.5 0 0 1 4 11.5v1A1.5 1.5 0 0 1 2.5 14h-1A1.5 1.5 0 0 1 0 12.5zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zm4.5.5A1.5 1.5 0 0 1 7.5 10h1a1.5 1.5 0 0 1 1.5 1.5v1A1.5 1.5 0 0 1 8.5 14h-1A1.5 1.5 0 0 1 6 12.5zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5zm4.5.5a1.5 1.5 0 0 1 1.5-1.5h1a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1-1.5 1.5h-1a1.5 1.5 0 0 1-1.5-1.5zm1.5-.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h1a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5z"
      />
    </svg>
  );
}

function BricksIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      className="bi bi-bricks"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0 .5A.5.5 0 0 1 .5 0h15a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H14v2h1.5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H14v2h1.5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H.5a.5.5 0 0 1-.5-.5v-3a.5.5 0 0 1 .5-.5H2v-2H.5a.5.5 0 0 1-.5-.5v-3A.5.5 0 0 1 .5 6H2V4H.5a.5.5 0 0 1-.5-.5zM3 4v2h4.5V4zm5.5 0v2H13V4zM3 10v2h4.5v-2zm5.5 0v2H13v-2zM1 1v2h3.5V1zm4.5 0v2h5V1zm6 0v2H15V1zM1 7v2h3.5V7zm4.5 0v2h5V7zm6 0v2H15V7zM1 13v2h3.5v-2zm4.5 0v2h5v-2zm6 0v2H15v-2z" />
    </svg>
  );
}

function Backpack4Icon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      className="bi bi-backpack4"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 9.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5zm1 .5v3h6v-3h-1v.5a.5.5 0 0 1-1 0V10z" />
      <path d="M8 0a2 2 0 0 0-2 2H3.5a2 2 0 0 0-2 2v1c0 .52.198.993.523 1.349A.5.5 0 0 0 2 6.5V14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6.5a.5.5 0 0 0-.023-.151c.325-.356.523-.83.523-1.349V4a2 2 0 0 0-2-2H10a2 2 0 0 0-2-2m0 1a1 1 0 0 0-1 1h2a1 1 0 0 0-1-1M3 14V6.937q.24.062.5.063h4v.5a.5.5 0 0 0 1 0V7h4q.26 0 .5-.063V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1m9.5-11a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function PenFillIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      className="bi bi-pen-fill"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m13.498.795.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001" />
    </svg>
  );
}

function ArchiveIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      className="bi bi-archive"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0 2a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1v7.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 1 12.5V5a1 1 0 0 1-1-1zm2 3v7.5A1.5 1.5 0 0 0 3.5 14h9a1.5 1.5 0 0 0 1.5-1.5V5zm13-3H1v2h14zM5 7.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5" />
    </svg>
  );
}

function ProjectIcon({ icon }: { icon: ProjectIconName }) {
  switch (icon) {
    case "airplane-engines":
      return <AirplaneEnginesIcon />;

    case "tree":
      return <TreeIcon />;

    case "diagram-3":
      return <Diagram3Icon />;

    case "bricks":
      return <BricksIcon />;

    case "backpack4":
      return <Backpack4Icon />;

    case "pen-fill":
      return <PenFillIcon />;

    case "archive":
      return <ArchiveIcon />;

    default: {
      const exhaustiveCheck: never = icon;
      return exhaustiveCheck;
    }
  }
}

function projectHeadingId(name: string) {
  return `project-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

type LatticeResult = Awaited<ReturnType<typeof runTextToLattice>>;
type LatticePhase = "idle" | "checking" | "ready" | "reserving" | "loading" | "converting" | "canceling" | "error";
const LATTICE_RENEWAL_RETRY_MARGIN_MS = 5_000;

function latticeOutcomeLabel(result: LatticeResult | null) {
  if (!result) return "";
  if (result.status === "translated") return "Latticed text";
  if (result.status === "conformant-for-context") return "Source fits this context";
  if (result.status === "needs-clarification") return "One question";
  if (result.status === "unable-to-attempt") return "No Latticed result";
  return "Review needed";
}

function latticeResultAnnouncement(result: LatticeResult) {
  const register = result.layerLabel?.trim();
  return `Result ready. ${latticeOutcomeLabel(result)}.${register ? ` Register: ${register}.` : ""}`;
}

function capabilityMessage() {
  return "Text to Lattice is unavailable on this device. Nothing ran.";
}

function isLatticeInputFailure(error: unknown) {
  if (!(error instanceof RangeError)) return false;
  return /^(?:This browser cannot safely segment Text to Lattice input\.|Text to Lattice input |Enter text with at least one word|Text to Lattice accepts up to |Text to Lattice cannot safely split |Text to Lattice supports at most |Text to Lattice cannot safely model |Text to Lattice could not create a safe work unit|Text to Lattice could not fit every exact literal)/u.test(error.message);
}

function latticeInputFailureMessage(error: unknown, clarification = false) {
  const message = error instanceof Error ? error.message : "";
  const subject = clarification ? "answer" : "source";

  if (/at least one word|enter (?:text with|a clarification answer)/iu.test(message)) {
    return clarification ? "Enter an answer before continuing." : "Enter at least one word.";
  }
  if (/accepts up to 700 words|clarification answer to .* words|words or fewer/iu.test(message)) {
    return clarification ? `Keep the answer to ${LATTICE_CLARIFICATION_WORD_LIMIT} words or fewer.` : `Keep the source to ${LATTICE_WORD_LIMIT} words or fewer.`;
  }
  if (/shorten the clarification answer/iu.test(message)) {
    return "Shorten the answer and try again.";
  }
  if (/12,000-character safety limit|clarification answer to .* characters|characters or fewer/iu.test(message)) {
    return clarification
      ? `Keep the answer to ${LATTICE_CLARIFICATION_SAFETY_LIMIT.toLocaleString("en-US")} characters or fewer.`
      : `Keep the source to ${LATTICE_INPUT_SAFETY_LIMIT.toLocaleString("en-US")} characters or fewer.`;
  }
  if (/too many separate exact literals|more than twenty-four separate exact literals/iu.test(message)) {
    return `This ${subject} is too complex for one run. Shorten it and try again.`;
  }
  if (/too many bounded passages|supports at most .*passages/iu.test(message)) {
    return "This source is too complex for one run. Shorten it and try again.";
  }
  if (/bounded work groups|too (?:large|structurally dense)/iu.test(message)) {
    return `This ${subject} is too complex for one run. Shorten it and try again.`;
  }
  if (/control|unicode|noncharacter|direction|grapheme|character sequence|word-like token|invisible formatting|segment/iu.test(message)) {
    return `This ${subject} contains unsupported characters or formatting. Remove them and try again.`;
  }
  return clarification ? "That answer cannot be processed safely." : "This source cannot be processed safely.";
}

function latticeFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (error instanceof LatticeLeaseError && error.limited) {
    return error.code === "visitor-day-limit"
      ? "This browser has reached its Text to Lattice demonstration limit."
      : "Text to Lattice is busy right now.";
  }
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (offline || /(?:failed to fetch|network|download|connection|offline)/iu.test(message)) {
    return "Text to Lattice could not continue. Check the connection and try again. Your text stayed here.";
  }
  if (isLatticeInputFailure(error)) return latticeInputFailureMessage(error);
  return "Text to Lattice could not finish. Try again. Your text stayed here.";
}

function isLatticeQuotaLimit(error: unknown): error is LatticeLeaseError {
  return error instanceof LatticeLeaseError && error.limited === true;
}

function latticeProgressText(report: { phase: string; text?: string; current?: number; total?: number } | null) {
  if (!report) return "";
  const labels: Record<string, string> = {
    "reserving-slot": "Checking availability",
    "loading-model": "Preparing on this device",
    atomizing: "Reading the source",
    generating: "Drafting",
    verifying: "Checking meaning",
    repairing: "Revising",
    reatomizing: "Reading again",
    regenerating: "Revising",
    reverifying: "Checking the revision",
    "certifying-document": "Checking the whole text",
    "certifying-windows": "Checking the whole text",
    "certifying-relations": "Checking relationships",
    clarification: "One question before continuing",
    "lease-renewal-failed": "Run ended",
    "lease-expired": "Run ended",
    complete: "Result ready",
    canceled: "Stopped",
  };
  const label = labels[report.phase] ?? "Working";
  return report.total ? `${label}: ${Math.min((report.current ?? 0) + 1, report.total)} of ${report.total}` : label;
}

function latticeFindingMessage(finding: { id: string }) {
  const id = finding.id.toLowerCase();
  if (/(?:unsupported|addition|added-meaning)/u.test(id)) {
    return "The draft added meaning that was not in the source.";
  }
  if (/(?:language-support|language-unsupported)/u.test(id)) {
    return "This language could not be checked reliably.";
  }
  if (/(?:register|layer|plan-fit|conformance)/u.test(id)) {
    return "The selected register did not fit every passage.";
  }
  if (/(?:literal|boundary|structure|bidi|unicode|control)/u.test(id)) {
    return "Some exact wording or structure was not preserved.";
  }
  if (/(?:not-material|materiality)/u.test(id)) {
    return "A passage did not change enough to count as Latticed.";
  }
  if (/(?:context|capacity|size|expanded|growth|coverage|unavailable|incomplete)/u.test(id)) {
    return "The full text could not be checked in this run.";
  }
  if (/(?:atom|meaning|semantic|missing|omission|fidelity)/u.test(id)) {
    return "Some source meaning was not preserved.";
  }
  return "The result did not clear every meaning check.";
}

function latticeVisibleFindings(result: LatticeResult): string[] {
  const findings = result.findings as ReadonlyArray<{ id: string }>;
  return [...new Set<string>(findings.map(latticeFindingMessage))].slice(0, 5);
}

export default function ResumeProjects() {
  const [latticeOpen, setLatticeOpen] = useState(false);
  const [latticeInput, setLatticeInput] = useState("");
  const [latticeUseConfirmed, setLatticeUseConfirmed] = useState(false);
  const [latticeError, setLatticeError] = useState("");
  const [latticeQuotaError, setLatticeQuotaError] = useState("");
  const [latticeInputInvalid, setLatticeInputInvalid] = useState(false);
  const [latticeResult, setLatticeResult] = useState<LatticeResult | null>(null);
  const [latticePhase, setLatticePhase] = useState<LatticePhase>("idle");
  const [latticeSupported, setLatticeSupported] = useState<boolean | null>(null);
  const [latticeModelCached, setLatticeModelCached] = useState<boolean | null>(null);
  const [latticeStorageWarning, setLatticeStorageWarning] = useState("");
  const [latticeRetryAt, setLatticeRetryAt] = useState<number | null>(null);
  const [latticeRetryClock, setLatticeRetryClock] = useState(0);
  const [latticeRetryMode, setLatticeRetryMode] = useState<"manual" | "automatic">("manual");
  const [latticeRetryAnnouncement, setLatticeRetryAnnouncement] = useState("");
  const [latticeProgress, setLatticeProgress] = useState<{ phase: string; progress: number | null; text?: string; current?: number; total?: number } | null>(null);
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, string>>({});
  const [clarificationErrors, setClarificationErrors] = useState<Record<string, string>>({});
  const [clarificationHistory, setClarificationHistory] = useState<Array<Record<string, string>>>([]);
  const latticeDialogRef = useRef<HTMLDivElement>(null);
  const latticeInputRef = useRef<HTMLTextAreaElement>(null);
  const latticeOutputRef = useRef<HTMLElement>(null);
  const latticeTriggerRef = useRef<HTMLAnchorElement | null>(null);
  const latticeDirectLaunchRef = useRef<HTMLAnchorElement | null>(null);
  const latticeAttestationRef = useRef<HTMLDivElement>(null);
  const latticeCancelButtonRef = useRef<HTMLButtonElement>(null);
  const latticeCloseRef = useRef<() => void>(() => {});
  const latticeAbortRef = useRef<AbortController | null>(null);
  const latticeLeaseRef = useRef<Awaited<ReturnType<typeof acquireLatticeLease>> | null>(null);
  const latticeLeaseExpiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latticeLeaseHeartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latticeLeaseRenewalRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latticeLeaseHeartbeatAbortRef = useRef<AbortController | null>(null);
  const latticeLeaseRenewalTokenRef = useRef<string | null>(null);
  const latticeCompletionBudgetRef = useRef({ used: 0, limit: LATTICE_COMPLETION_CALL_LIMIT });
  const latticeJobRef = useRef(0);
  const latticeMountedRef = useRef(true);
  const wordCount = countLatticeWords(latticeInput);
  const busy = latticePhase === "reserving" || latticePhase === "loading" || latticePhase === "converting" || latticePhase === "canceling";
  const overLimit = wordCount > LATTICE_WORD_LIMIT;
  const progressText = latticeProgressText(latticeProgress);
  const latticeRetryPending = isLatticeRetryPending(latticeRetryAt, latticeRetryClock);
  const primaryUnavailable = busy || latticePhase === "checking" || latticeSupported === false || latticeInputInvalid || wordCount === 0 || overLimit || latticeRetryPending || !latticeUseConfirmed;
  const readyLabel = latticeModelCached === false ? "Download and convert" : "Convert";
  const primaryLabel = latticePhase === "error" && latticeSupported !== false ? "Try again" : readyLabel;

  const clearLatticeLeaseExpiryTimer = useCallback(() => {
    if (latticeLeaseExpiryTimerRef.current !== null) {
      clearTimeout(latticeLeaseExpiryTimerRef.current);
      latticeLeaseExpiryTimerRef.current = null;
    }
  }, []);

  const clearLatticeLeaseHeartbeat = useCallback(() => {
    if (latticeLeaseHeartbeatTimerRef.current !== null) {
      clearInterval(latticeLeaseHeartbeatTimerRef.current);
      latticeLeaseHeartbeatTimerRef.current = null;
    }
    if (latticeLeaseRenewalRetryTimerRef.current !== null) {
      clearTimeout(latticeLeaseRenewalRetryTimerRef.current);
      latticeLeaseRenewalRetryTimerRef.current = null;
    }
    const controller = latticeLeaseHeartbeatAbortRef.current;
    latticeLeaseHeartbeatAbortRef.current = null;
    latticeLeaseRenewalTokenRef.current = null;
    controller?.abort();
  }, []);

  const releaseCurrentLatticeLease = useCallback(() => {
    clearLatticeLeaseExpiryTimer();
    clearLatticeLeaseHeartbeat();
    const lease = latticeLeaseRef.current;
    latticeLeaseRef.current = null;
    if (lease) void releaseLatticeLease(lease.token);
  }, [clearLatticeLeaseExpiryTimer, clearLatticeLeaseHeartbeat]);

  const expireCurrentLatticeLease = useCallback((leaseToken: string, reason: "expired" | "renewal" = "expired") => {
    if (latticeLeaseRef.current?.token !== leaseToken) return;
    latticeJobRef.current += 1;
    const controller = latticeAbortRef.current;
    latticeAbortRef.current = null;
    controller?.abort();
    releaseCurrentLatticeLease();
    interruptLocalLatticeModel();
    discardLocalLatticeModel();
    if (latticeMountedRef.current) {
      setLatticeResult(null);
      setLatticeQuotaError("");
      setLatticeRetryAt(null);
      setLatticeRetryClock(0);
      setLatticeRetryMode("manual");
      setLatticeRetryAnnouncement("");
      setLatticeError(reason === "renewal"
        ? "The run could not continue. Your text remains here."
        : "This run reached its time limit. Your text remains here.");
      setLatticeInputInvalid(false);
      setLatticeProgress({
        phase: reason === "renewal" ? "lease-renewal-failed" : "lease-expired",
        progress: null,
        text: "Run ended.",
      });
      setLatticePhase("error");
    }
  }, [releaseCurrentLatticeLease]);

  const armLatticeLeaseExpiry = useCallback((lease: Awaited<ReturnType<typeof acquireLatticeLease>>) => {
    clearLatticeLeaseExpiryTimer();
    const remaining = Math.max(0, lease.expiresAt - Date.now());
    latticeLeaseExpiryTimerRef.current = setTimeout(() => {
      latticeLeaseExpiryTimerRef.current = null;
      expireCurrentLatticeLease(lease.token);
    }, remaining);
  }, [clearLatticeLeaseExpiryTimer, expireCurrentLatticeLease]);

  const armLatticeLeaseHeartbeat = useCallback((lease: Awaited<ReturnType<typeof acquireLatticeLease>>) => {
    clearLatticeLeaseHeartbeat();
    const controller = new AbortController();
    latticeLeaseHeartbeatAbortRef.current = controller;
    const renewCurrentLease = () => {
      const currentLease = latticeLeaseRef.current;
      if (
        controller.signal.aborted
        || !latticeMountedRef.current
        || !currentLease
        || currentLease.token !== lease.token
        || latticeLeaseRenewalTokenRef.current !== null
        || latticeLeaseRenewalRetryTimerRef.current !== null
      ) return;
      if (currentLease.expiresAt <= Date.now()) {
        expireCurrentLatticeLease(lease.token, "expired");
        return;
      }
      latticeLeaseRenewalTokenRef.current = lease.token;
      void renewLatticeLease(currentLease, controller.signal).then((renewedLease) => {
        if (
          controller.signal.aborted
          || !latticeMountedRef.current
          || latticeLeaseRef.current?.token !== lease.token
        ) return;
        latticeLeaseRef.current = renewedLease;
        armLatticeLeaseExpiry(renewedLease);
        setLatticeQuotaError("");
        setLatticeRetryAt(null);
        setLatticeRetryClock(0);
        setLatticeRetryMode("manual");
        setLatticeRetryAnnouncement("");
      }).catch((error) => {
        if (
          controller.signal.aborted
          || !latticeMountedRef.current
          || latticeLeaseRef.current?.token !== lease.token
          || error instanceof DOMException && error.name === "AbortError"
        ) return;
        if (isLatticeQuotaLimit(error)) {
          const now = Date.now();
          const retryAt = now + error.retryAfterSeconds * 1_000;
          if (retryAt + LATTICE_RENEWAL_RETRY_MARGIN_MS >= currentLease.expiresAt) {
            expireCurrentLatticeLease(lease.token, "renewal");
            setLatticeQuotaError(latticeFailureMessage(error));
            setLatticeRetryAt(retryAt);
            setLatticeRetryClock(now);
            setLatticeRetryMode("manual");
            setLatticeRetryAnnouncement(latticeRetryEta(retryAt, now));
            return;
          }
          setLatticeQuotaError(latticeFailureMessage(error));
          setLatticeRetryAt(retryAt);
          setLatticeRetryClock(now);
          setLatticeRetryMode("automatic");
          setLatticeRetryAnnouncement(latticeRetryEta(retryAt, now, undefined, "automatic"));
          latticeLeaseRenewalRetryTimerRef.current = setTimeout(() => {
            latticeLeaseRenewalRetryTimerRef.current = null;
            renewCurrentLease();
          }, error.retryAfterSeconds * 1_000);
          return;
        }
        const terminal = error instanceof LatticeLeaseError
          && ["lease-not-active", "lease-maximum-lifetime"].includes(error.code);
        if (terminal || (latticeLeaseRef.current?.expiresAt ?? 0) <= Date.now()) {
          expireCurrentLatticeLease(lease.token, terminal ? "renewal" : "expired");
        }
      }).finally(() => {
        if (latticeLeaseRenewalTokenRef.current === lease.token) {
          latticeLeaseRenewalTokenRef.current = null;
        }
      });
    };
    latticeLeaseHeartbeatTimerRef.current = setInterval(
      renewCurrentLease,
      LATTICE_USAGE_POLICY.activeLeases.renewalIntervalSeconds * 1_000,
    );
  }, [armLatticeLeaseExpiry, clearLatticeLeaseHeartbeat, expireCurrentLatticeLease]);

  const cancelLattice = useCallback(() => {
    const controller = latticeAbortRef.current;
    latticeJobRef.current += 1;
    latticeAbortRef.current = null;
    if (controller && latticeMountedRef.current) setLatticePhase("canceling");
    controller?.abort();
    releaseCurrentLatticeLease();
    interruptLocalLatticeModel();
    discardLocalLatticeModel();
    if (controller && latticeMountedRef.current) {
      setLatticeProgress({ phase: "canceled", progress: null, text: "Conversion canceled." });
      setLatticePhase("ready");
    }
    if (latticeRetryMode === "automatic" && latticeMountedRef.current) {
      setLatticeQuotaError("");
      setLatticeRetryAt(null);
      setLatticeRetryClock(0);
      setLatticeRetryMode("manual");
      setLatticeRetryAnnouncement("");
    }
  }, [latticeRetryMode, releaseCurrentLatticeLease]);

  useEffect(() => {
    latticeMountedRef.current = true;
    return () => {
      latticeMountedRef.current = false;
      latticeJobRef.current += 1;
      const controller = latticeAbortRef.current;
      latticeAbortRef.current = null;
      controller?.abort();
      releaseCurrentLatticeLease();
      interruptLocalLatticeModel();
      discardLocalLatticeModel();
      if (latticeInputRef.current) latticeInputRef.current.value = "";
      latticeInputRef.current = null;
      latticeDialogRef.current = null;
      latticeOutputRef.current = null;
      latticeTriggerRef.current = null;
      latticeDirectLaunchRef.current = null;
    };
  }, [releaseCurrentLatticeLease]);

  useEffect(() => {
    if (latticeRetryAt === null) return;
    const tick = () => {
      const now = Date.now();
      setLatticeRetryClock(now);
      if (now >= latticeRetryAt) {
        setLatticeRetryAt(null);
        setLatticeRetryClock(0);
        setLatticeQuotaError("");
        setLatticeRetryAnnouncement(latticeRetryMode === "automatic" ? "The run is retrying now." : "You can try again now.");
        if (latticeRetryMode === "manual") {
          setLatticePhase((current) => current === "error" ? "ready" : current);
        }
      }
    };
    tick();
    const timer = window.setInterval(() => {
      tick();
      if (Date.now() >= latticeRetryAt) window.clearInterval(timer);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [latticeRetryAt, latticeRetryMode]);

  const closeLattice = useCallback(() => {
    cancelLattice();
    setLatticeOpen(false);
    setLatticeInput("");
    setLatticeUseConfirmed(false);
    setLatticeResult(null);
    setClarificationAnswers({});
    setClarificationErrors({});
    setClarificationHistory([]);
    setLatticeError("");
    setLatticeInputInvalid(false);
    setLatticeProgress(null);
    latticeCompletionBudgetRef.current = { used: 0, limit: LATTICE_COMPLETION_CALL_LIMIT };
  }, [cancelLattice]);

  useEffect(() => {
    latticeCloseRef.current = closeLattice;
    return () => { latticeCloseRef.current = () => {}; };
  }, [closeLattice]);

  const checkEnvironment = useCallback(async () => {
    const environmentJobId = latticeJobRef.current;
    setLatticePhase("checking");
    setLatticeError("");
    const capability = await probeLocalLatticeCapability();
    if (!latticeMountedRef.current || latticeJobRef.current !== environmentJobId) return;
    if (!capability.supported) {
      setLatticeSupported(false);
      setLatticeModelCached(false);
      setLatticeStorageWarning("");
      setLatticeError(capabilityMessage());
      setLatticeInputInvalid(false);
      setLatticePhase("error");
      return;
    }
    setLatticeSupported(true);
    const [cached, storage] = await Promise.all([
      isLocalLatticeModelCached().catch(() => false),
      probeLocalLatticeStorage(),
    ]);
    if (!latticeMountedRef.current || latticeJobRef.current !== environmentJobId) return;
    setLatticeModelCached(cached);
    setLatticeStorageWarning(!cached && storage.known && storage.sufficient === false
      ? "This download may need more free space."
      : "");
    setLatticePhase("ready");
  }, []);

  useEffect(() => {
    if (!latticeOpen) return;

    const previousOverflow = document.body.style.overflow;
    const dialog = latticeDialogRef.current;
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "summary",
      "textarea:not([disabled])",
      "iframe:not([tabindex='-1'])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const focusableElements = () => Array.from(
      dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    ).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
    let containmentFrame = 0;
    const containFocus = () => {
      if (!dialog) return;
      const active = document.activeElement;
      const activeIsUsable = active instanceof HTMLElement
        && dialog.contains(active)
        && !active.matches(":disabled, [hidden], [aria-hidden='true'], [tabindex='-1']");
      if (activeIsUsable) return;
      const cancel = latticeCancelButtonRef.current;
      if (cancel?.isConnected && !cancel.disabled) cancel.focus({ preventScroll: true });
      else dialog.focus({ preventScroll: true });
    };
    const scheduleFocusContainment = () => {
      window.cancelAnimationFrame(containmentFrame);
      containmentFrame = window.requestAnimationFrame(containFocus);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        latticeCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const elements = focusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (dialog && !dialog.contains(event.target as Node)) {
        (focusableElements()[0] ?? dialog).focus();
      }
    };

    document.body.classList.add("resume-modal-open");
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    const focusObserver = new MutationObserver(scheduleFocusContainment);
    if (dialog) {
      focusObserver.observe(dialog, {
        attributes: true,
        attributeFilter: ["aria-hidden", "disabled", "hidden", "tabindex"],
        childList: true,
        subtree: true,
      });
    }
    const focusFrame = window.requestAnimationFrame(() => {
      (latticeInputRef.current ?? dialog)?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.cancelAnimationFrame(containmentFrame);
      focusObserver.disconnect();
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.body.classList.remove("resume-modal-open");
      document.body.style.overflow = previousOverflow;
      const trigger = latticeTriggerRef.current;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [latticeOpen]);

  useEffect(() => {
    if (!latticeOpen) return;
    const output = latticeOutputRef.current;
    let revealFrame = 0;
    let printScreenTimer = 0;
    let shieldUntil = 0;
    let printing = false;
    const shield = () => {
      window.cancelAnimationFrame(revealFrame);
      output?.setAttribute("data-shielded", "true");
    };
    const reveal = () => {
      window.cancelAnimationFrame(revealFrame);
      window.clearTimeout(printScreenTimer);
      const remainingShieldTime = Math.max(0, shieldUntil - Date.now());
      if (!mayRevealLatticeOutput({
        documentHidden: document.hidden,
        windowFocused: document.hasFocus(),
        printing,
        now: Date.now(),
        shieldUntil,
      })) {
        shield();
        if (remainingShieldTime > 0) {
          printScreenTimer = window.setTimeout(reveal, remainingShieldTime + 16);
        }
        return;
      }
      revealFrame = window.requestAnimationFrame(() => {
        if (mayRevealLatticeOutput({
          documentHidden: document.hidden,
          windowFocused: document.hasFocus(),
          printing,
          now: Date.now(),
          shieldUntil,
        })) {
          output?.removeAttribute("data-shielded");
        } else {
          shield();
        }
      });
    };
    const handleVisibility = () => {
      if (document.hidden) shield();
      else reveal();
    };
    const handlePrintScreen = (event: KeyboardEvent) => {
      if (event.key !== "PrintScreen") return;
      shieldUntil = Math.max(shieldUntil, Date.now() + 1_500);
      shield();
      window.clearTimeout(printScreenTimer);
      printScreenTimer = window.setTimeout(reveal, 1_516);
    };
    const handleBeforePrint = () => {
      printing = true;
      shield();
    };
    const handleAfterPrint = () => {
      printing = false;
      reveal();
    };

    window.addEventListener("blur", shield);
    window.addEventListener("focus", reveal);
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("keydown", handlePrintScreen, true);
    document.addEventListener("keyup", handlePrintScreen, true);
    handleVisibility();
    return () => {
      window.cancelAnimationFrame(revealFrame);
      window.clearTimeout(printScreenTimer);
      window.removeEventListener("blur", shield);
      window.removeEventListener("focus", reveal);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("keydown", handlePrintScreen, true);
      document.removeEventListener("keyup", handlePrintScreen, true);
      output?.removeAttribute("data-shielded");
    };
  }, [latticeOpen]);

  const openLattice = useCallback((trigger: HTMLAnchorElement) => {
    latticeTriggerRef.current = trigger;
    setLatticeError("");
    setLatticeInputInvalid(false);
    setLatticeUseConfirmed(false);
    setLatticeOpen(true);
    void checkEnvironment();
  }, [checkEnvironment]);

  const launchLattice = useCallback((event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return;
    event.preventDefault();
    openLattice(event.currentTarget);
  }, [openLattice]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("tool") !== "text-to-lattice") return;
    const trigger = latticeDirectLaunchRef.current;
    if (!trigger) return;
    url.searchParams.delete("tool");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    openLattice(trigger);
  }, [openLattice]);

  const updateLatticeInput = (value: string) => {
    setLatticeUseConfirmed(false);
    const endedActiveLease = latticeLeaseRef.current !== null;
    releaseCurrentLatticeLease();
    if (endedActiveLease) {
      setLatticeQuotaError("");
      setLatticeRetryAt(null);
      setLatticeRetryClock(0);
      setLatticeRetryMode("manual");
      setLatticeRetryAnnouncement("");
    }
    latticeCompletionBudgetRef.current = { used: 0, limit: LATTICE_COMPLETION_CALL_LIMIT };
    if (value.length > LATTICE_INPUT_SAFETY_LIMIT) {
      setLatticeResult(null);
      setClarificationAnswers({});
      setClarificationErrors({});
      setClarificationHistory([]);
      setLatticeProgress(null);
      setLatticeError(`Keep the source to ${LATTICE_INPUT_SAFETY_LIMIT.toLocaleString("en-US")} characters or fewer.`);
      setLatticeInputInvalid(true);
      return;
    }
    setLatticeInput(value);
    setLatticeResult(null);
    setClarificationAnswers({});
    setClarificationErrors({});
    setClarificationHistory([]);
    setLatticeProgress(null);
    const nextCount = countLatticeWords(value);
    let validationError = "";
    if (nextCount > 0) {
      try {
        validateLatticeInput(value);
      } catch (error) {
        validationError = latticeInputFailureMessage(error);
      }
    }
    setLatticeError(validationError);
    setLatticeInputInvalid(Boolean(validationError));
  };

  const updateLatticeClarificationInput = (questionId: string, value: string) => {
    if (value.length > LATTICE_CLARIFICATION_SAFETY_LIMIT) {
      setClarificationErrors((current) => ({
        ...current,
        [questionId]: `Keep the answer to ${LATTICE_CLARIFICATION_SAFETY_LIMIT.toLocaleString("en-US")} characters or fewer.`,
      }));
      return;
    }
    setClarificationAnswers((current) => ({ ...current, [questionId]: value }));
    setClarificationErrors((current) => ({ ...current, [questionId]: "" }));
  };

  const executeLattice = async (answers: Array<Record<string, string>> = clarificationHistory) => {
    if (latticeAbortRef.current) return;
    if (!latticeUseConfirmed) {
      setLatticeError(LATTICE_USE_CONFIRMATION_ERROR);
      setLatticeInputInvalid(false);
      return;
    }
    const jobId = latticeJobRef.current + 1;
    latticeJobRef.current = jobId;
    const controller = new AbortController();
    latticeAbortRef.current = controller;
    try {
      preflightLatticeInput(latticeInput);
      if (latticeSupported === false) throw new Error("WebGPU is unavailable in this browser.");
      setLatticeResult(null);
      setLatticeError("");
      setLatticeQuotaError("");
      setLatticeRetryAnnouncement("");
      setClarificationErrors({});
      setLatticeInputInvalid(false);
      if (latticeLeaseRef.current && latticeLeaseRef.current.expiresAt <= Date.now()) {
        releaseCurrentLatticeLease();
      }
      if (!latticeLeaseRef.current) {
        latticeCompletionBudgetRef.current = { used: 0, limit: LATTICE_COMPLETION_CALL_LIMIT };
        setLatticePhase("reserving");
        setLatticeProgress({
          phase: "reserving-slot",
          progress: null,
          text: "Checking availability…",
        });
        const lease = await acquireLatticeLease(
          controller.signal,
          (siteKey: string, signal: AbortSignal) => obtainLatticeAttestation(
            siteKey,
            latticeAttestationRef.current,
            signal,
          ),
        );
        if (!latticeMountedRef.current || latticeJobRef.current !== jobId || controller.signal.aborted) {
          void releaseLatticeLease(lease.token);
          return;
        }
        latticeLeaseRef.current = lease;
        setLatticeRetryAt(null);
        setLatticeRetryClock(0);
        setLatticeRetryMode("manual");
        armLatticeLeaseExpiry(lease);
        armLatticeLeaseHeartbeat(lease);
      }
      setLatticePhase(latticeModelCached ? "converting" : "loading");
      setLatticeProgress({ phase: "loading-model", progress: 0, text: "Preparing on this device…" });
      const onProgress = (report: { phase: string; progress?: number | null; text?: string; current?: number; total?: number }) => {
        if (!latticeMountedRef.current || latticeJobRef.current !== jobId) return;
        const lease = latticeLeaseRef.current;
        if (!lease || lease.expiresAt <= Date.now()) {
          if (lease) expireCurrentLatticeLease(lease.token);
          else controller.abort();
          return;
        }
        setLatticePhase(report.phase === "loading-model" ? "loading" : "converting");
        setLatticeProgress({
          phase: report.phase,
          progress: report.progress ?? null,
          text: report.text,
          current: report.current,
          total: report.total,
        });
      };
      const adapter = createLocalLatticeAdapter(undefined, {
        onProgress,
        completionBudget: latticeCompletionBudgetRef.current,
      });
      const leaseToken = latticeLeaseRef.current?.token;
      if (!leaseToken) {
        controller.abort();
        return;
      }
      const result = await runTextToLattice(latticeInput, {
        adapter,
        signal: controller.signal,
        onProgress,
        clarificationAnswers: answers,
      });
      if (!latticeMountedRef.current || latticeJobRef.current !== jobId || controller.signal.aborted) return;
      const currentLease = latticeLeaseRef.current;
      if (!currentLease || currentLease.token !== leaseToken || currentLease.expiresAt <= Date.now()) {
        if (currentLease?.token === leaseToken) expireCurrentLatticeLease(leaseToken);
        else controller.abort();
        return;
      }
      setLatticeResult(result);
      setClarificationErrors({});
      void isLocalLatticeModelCached().catch(() => false).then((cached) => {
        if (!latticeMountedRef.current || latticeJobRef.current !== jobId) return;
        setLatticeModelCached(cached);
      });
      setLatticeProgress(null);
      if (result.status !== "needs-clarification") {
        releaseCurrentLatticeLease();
        setLatticeQuotaError("");
        setLatticeRetryAt(null);
        setLatticeRetryClock(0);
        setLatticeRetryMode("manual");
        setLatticeRetryAnnouncement("");
      }
      setLatticePhase("ready");
    } catch (error) {
      if (!latticeMountedRef.current || latticeJobRef.current !== jobId || (error instanceof DOMException && error.name === "AbortError")) return;
      setLatticeResult(null);
      setLatticeProgress(null);
      if (isLatticeQuotaLimit(error)) {
        setLatticeError("");
        setLatticeQuotaError(latticeFailureMessage(error));
        setLatticeInputInvalid(false);
        const now = Date.now();
        const retryAt = now + error.retryAfterSeconds * 1_000;
        setLatticeRetryAt(retryAt);
        setLatticeRetryClock(now);
        setLatticeRetryMode("manual");
        setLatticeRetryAnnouncement(latticeRetryEta(retryAt, now));
      } else {
        setLatticeError(latticeFailureMessage(error));
        setLatticeQuotaError("");
        setLatticeRetryAnnouncement("");
        setLatticeInputInvalid(isLatticeInputFailure(error));
        setLatticeRetryAt(null);
        setLatticeRetryClock(0);
        setLatticeRetryMode("manual");
      }
      setLatticePhase("error");
      releaseCurrentLatticeLease();
      discardLocalLatticeModel();
    } finally {
      if (latticeJobRef.current === jobId) latticeAbortRef.current = null;
    }
  };

  const runLattice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void executeLattice(clarificationHistory);
  };

  const startLatticeOver = () => {
    updateLatticeInput("");
    setLatticeUseConfirmed(false);
    setLatticeQuotaError("");
    setLatticeRetryAt(null);
    setLatticeRetryClock(0);
    setLatticeRetryMode("manual");
    setLatticeRetryAnnouncement("");
    setLatticePhase(latticeSupported === false ? "error" : "ready");
    window.requestAnimationFrame(() => latticeInputRef.current?.focus({ preventScroll: true }));
  };

  const continueLattice = () => {
    if (!latticeResult || latticeResult.status !== "needs-clarification") return;
    const nextErrors: Record<string, string> = {};
    latticeResult.questions.forEach((question) => {
      if (!clarificationAnswers[question.id]?.trim()) nextErrors[question.id] = "Choose or enter an answer.";
    });
    if (Object.keys(nextErrors).length) {
      setClarificationErrors(nextErrors);
      return;
    }
    let answers;
    try {
      answers = latticeResult.questions.map((question) => {
        const answer = clarificationAnswers[question.id];
        const option = question.options.find((item: { id: string; label: string }) => item.id === answer);
        const answerText = option?.label ?? answer;
        try {
          validateLatticeClarificationAnswer(answerText);
        } catch (error) {
          nextErrors[question.id] = latticeInputFailureMessage(error, true);
        }
        return {
          questionId: question.id,
          questionFingerprint: question.fingerprint,
          sourceFingerprint: question.sourceFingerprint,
          analysisRevisionId: question.analysisRevisionId,
          questionStage: question.questionStage,
          ...(question.candidateFingerprint
            ? { candidateFingerprint: question.candidateFingerprint }
            : {}),
          passageId: question.passageId,
          answer: option?.label ?? answer,
        };
      });
      if (Object.keys(nextErrors).length) {
        setClarificationErrors(nextErrors);
        return;
      }
    } catch {
      setClarificationErrors(Object.fromEntries(latticeResult.questions.map((question) => [question.id, "That answer cannot be processed safely."])));
      return;
    }
    setClarificationErrors({});
    const cumulativeAnswers = [...clarificationHistory, ...answers];
    setClarificationHistory(cumulativeAnswers);
    setClarificationAnswers({});
    void executeLattice(cumulativeAnswers);
  };

  const blockLatticeOutputTransfer = (event: SyntheticEvent<HTMLElement>) => {
    if (isLatticeClarificationTarget(event.target)) return;
    event.preventDefault();
    const nativeEvent = event.nativeEvent as Event & {
      clipboardData?: DataTransfer | null;
      dataTransfer?: DataTransfer | null;
    };
    nativeEvent.clipboardData?.clearData();
    nativeEvent.dataTransfer?.clearData();
  };

  return (
    <>
      <section className="container" aria-labelledby="projects-title">
        <h2 className="text-center skill-stack-heading" id="projects-title">
          Projects
        </h2>

        <div className="folio-card-grid">
          {projects.map((project) => {
            const headingId = projectHeadingId(project.name);
            const firstParagraph = project.summary[0];
            const remainingParagraphs = project.summary.slice(1);

            return (
              <article
                className="card"
                key={project.name}
                aria-labelledby={headingId}
              >
                <div className="card-body">
                  <div className="row justify-content-center">
                    {"interaction" in project && project.interaction === "lattice-demo" ? (
                      <a
                        ref={latticeDirectLaunchRef}
                        className="tool-icon project-modal-trigger signal-fuzz"
                        data-lattice-launch="text-to-lattice"
                        href="/projects/lattice/text-to-lattice/"
                        aria-label="Use Text to Lattice"
                        aria-haspopup="dialog"
                        aria-controls="lattice-demo-dialog"
                        onClick={launchLattice}
                      >
                        <ProjectIcon icon={project.icon as ProjectIconName} />
                      </a>
                    ) : (
                      <span className="tool-icon signal-fuzz" aria-hidden="true">
                        <ProjectIcon icon={project.icon as ProjectIconName} />
                      </span>
                    )}
                  </div>

                  <h3
                    className="card-title tools-card-title row justify-content-center"
                    id={headingId}
                  >
                    <a className="signal-fuzz" href={project.canonicalPath}>{project.name}</a>
                  </h3>

                  {"readmeAfterFirstParagraph" in project && project.readmeAfterFirstParagraph ? (
                    <>
                      <p className="card-text">{firstParagraph}</p>
                      <details className="project-readme">
                        <summary>Read me</summary>
                        <div className="project-readme-copy">
                          {remainingParagraphs.map((paragraph, index) => (
                            <p
                              className="card-text"
                              key={`${project.name}-summary-${index + 1}`}
                            >
                              {paragraph}
                            </p>
                          ))}
                        </div>
                      </details>
                    </>
                  ) : project.summary.map((paragraph, index) => (
                    <p
                      className="card-text"
                      key={`${project.name}-summary-${index}`}
                    >
                      {paragraph}
                    </p>
                  ))}

                  {project.resources?.length ? (
                    <nav
                      className="project-resources"
                      aria-label={`${project.name} supporting materials`}
                    >
                      <ul className="list-unstyled">
                        {project.resources.map((resource) => {
                          const opensInNewTab = resource.opensInNewTab === true;

                          return (
                            <li key={`${resource.label}-${resource.url}`}>
                              <a
                                className="signal-fuzz"
                                href={resource.url}
                                target={opensInNewTab ? "_blank" : undefined}
                                rel={opensInNewTab ? "noopener noreferrer" : undefined}
                                aria-label={
                                  opensInNewTab
                                    ? `${resource.label}, opens in a new tab`
                                    : resource.label
                                }
                              >
                                <span aria-hidden="true">
                                  <ProjectIcon icon={resource.icon as ProjectIconName} />
                                </span>{" "}
                                <span>{resource.label}</span>
                                {opensInNewTab ? <span aria-hidden="true"> ↗</span> : null}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </nav>
                  ) : null}

                  <p className="card-text">
                    <small>{project.publication.label}</small>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
        <p className="project-record-link"><a href="/projects/">All canonical project records</a></p>
        <noscript>
          <p className="lattice-noscript-note">
            Text to Lattice is unavailable here. <a href="/projects/lattice/text-to-lattice/">Read the tool details</a>.
          </p>
        </noscript>
      </section>

      <div
        className="modal resume-modal"
        role="presentation"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeLattice();
        }}
        hidden={!latticeOpen}
      >
        <div
          ref={latticeDialogRef}
          className="modal-content"
          id="lattice-demo-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lattice-demo-title"
          aria-describedby="lattice-demo-description lattice-local-privacy lattice-model-disclosure lattice-usage-policy"
          aria-keyshortcuts="Escape"
          tabIndex={-1}
        >
          <h3 id="lattice-demo-title">Text to Lattice</h3>

          <p id="lattice-demo-description" className="lattice-modal-description">
            Enter up to {LATTICE_WORD_LIMIT} words. Meaning remains binding; register may change.
          </p>
          <p id="lattice-local-privacy" className="lattice-local-note">
            Your text stays in this tab. Use only text you are authorized to process, and avoid sensitive text. <a href="/projects/lattice/text-to-lattice/#text-to-lattice-privacy">Privacy details</a>.
          </p>
          <p id="lattice-model-disclosure" className="lattice-local-note">
            Model-assisted result: Qwen drafts locally and Llama 3.2 checks locally. Known limits: the models and automated checks can alter or omit meaning, introduce bias, or fail to catch unsafe content. Review every result before relying on it. <a href={LLAMA_3_2_TERMS_PROVENANCE.licenseUrl}>Built with Llama</a>.
          </p>
          <p className="lattice-usage-note" id="lattice-usage-policy">
            Demonstration only. Up to {LATTICE_USAGE_POLICY.visitor.limit} conversions per browser in any 24 hours.
          </p>
          {latticeSupported === false ? (
            <aside className="lattice-availability" aria-label="Availability">
              <p>{latticeError || "This device cannot run the tool."} <a href="/projects/lattice/text-to-lattice/#text-to-lattice-availability">View requirements</a>.</p>
            </aside>
          ) : null}

          <form onSubmit={runLattice} noValidate>
            <label className="lattice-input-label" htmlFor="lattice-demo-input">
              Source text
            </label>
            <textarea
              ref={latticeInputRef}
              className="form-control shelf-search-entry lattice-input"
              id="lattice-demo-input"
              value={latticeInput}
              rows={9}
              dir="auto"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              autoComplete="off"
              disabled={busy || latticeSupported === false}
              aria-describedby={`lattice-word-count${latticeInputInvalid && latticeError ? " lattice-input-error" : ""}`}
              aria-errormessage={latticeInputInvalid ? "lattice-input-error" : undefined}
              aria-invalid={latticeInputInvalid ? "true" : undefined}
              onChange={(event) => updateLatticeInput(event.currentTarget.value)}
            />
            <div className="lattice-input-meta">
              <small id="lattice-word-count" className={overLimit ? "text-red" : undefined}>{wordCount} of {LATTICE_WORD_LIMIT} words</small>
            </div>
            {latticeSupported !== false && latticeModelCached === false ? (
              <p className="lattice-output-note">First use downloads about 4.10 GB of public model assets and can use up to about 3.5 GB of working memory.</p>
            ) : null}
            <label className="lattice-local-note" htmlFor="lattice-use-confirmation">
              <input
                id="lattice-use-confirmation"
                type="checkbox"
                checked={latticeUseConfirmed}
                required
                disabled={busy || latticeSupported === false || wordCount === 0 || overLimit || latticeInputInvalid}
                aria-describedby="lattice-use-confirmation-detail"
                onChange={(event) => {
                  const confirmed = event.currentTarget.checked;
                  setLatticeUseConfirmed(confirmed);
                  if (confirmed && latticeError === LATTICE_USE_CONFIRMATION_ERROR) setLatticeError("");
                }}
              />{" "}
              I confirm that this source is in one of the supported languages, I am authorized to process it, and this conversion has a lawful purpose and will not materially further conduct prohibited by the Llama 3.2 Acceptable Use Policy.
            </label>
            <small id="lattice-use-confirmation-detail" className="lattice-output-note">
              Supported languages: English, German, French, Italian, Portuguese, Hindi, Spanish, and Thai. See the <a href={LLAMA_3_2_TERMS_PROVENANCE.acceptableUseUrl}>Llama 3.2 Acceptable Use Policy</a>.
            </small>
            {latticeStorageWarning ? <p className="lattice-output-note">{latticeStorageWarning}</p> : null}
            {latticeError && latticeSupported !== false ? (
              <p className="lattice-input-error" id="lattice-input-error" role="alert">
                {latticeError}{!latticeInputInvalid ? <> <a href="/projects/lattice/text-to-lattice/#text-to-lattice-availability">Tool details</a>.</> : null}
              </p>
            ) : null}
            {latticeQuotaError ? (
              <p className="lattice-input-error" role="alert">{latticeQuotaError}</p>
            ) : null}
            {latticeRetryAt !== null ? (
              <p className="lattice-retry-eta" aria-hidden="true">
                <time dateTime={new Date(latticeRetryAt).toISOString()}>{latticeRetryEta(latticeRetryAt, latticeRetryClock, undefined, latticeRetryMode)}</time>
              </p>
            ) : null}
            <p className="lattice-retry-announcement" role="status" aria-live="polite">
              {latticeRetryAnnouncement}
            </p>
            {progressText ? (
              <div className="lattice-progress">
                <span aria-live="polite" role="status">{progressText}</span>
                {typeof latticeProgress?.progress === "number" ? (
                  <progress max={1} value={latticeProgress.progress} aria-label={progressText} />
                ) : null}
              </div>
            ) : null}
            <div className="lattice-actions">
              <button className="lattice-run-button" type="submit" disabled={primaryUnavailable}>
                {latticePhase === "checking" ? "Checking availability…" : primaryLabel}
              </button>
              {latticeResult ? (
                <button className="lattice-cancel-button" type="button" onClick={startLatticeOver} disabled={busy}>
                  Start over
                </button>
              ) : null}
              {busy ? (
                <button ref={latticeCancelButtonRef} className="lattice-cancel-button" type="button" onClick={cancelLattice} disabled={latticePhase === "canceling"}>
                  {latticePhase === "canceling" ? "Canceling…" : "Cancel"}
                </button>
              ) : null}
            </div>
            <div ref={latticeAttestationRef} className="lattice-attestation" aria-live="polite" />
          </form>

          <section
            ref={latticeOutputRef}
            className="lattice-output"
            aria-labelledby="lattice-output-title"
            onCopy={blockLatticeOutputTransfer}
            onCut={blockLatticeOutputTransfer}
            onDragStart={blockLatticeOutputTransfer}
            onContextMenu={blockLatticeOutputTransfer}
          >
            <h4 id="lattice-output-title">Result</h4>
            <p className="lattice-output-register">
              {latticeResult
                ? latticeResult.layerLabel
                : ""}
            </p>
            <p className="lattice-result-announcement" role="status" aria-live="polite">
              {latticeResult ? latticeResultAnnouncement(latticeResult) : ""}
            </p>
            {latticeResult ? (
              <>
                <h5 className="lattice-output-outcome">{latticeOutcomeLabel(latticeResult)}</h5>
                {latticeResult.status === "review-required" ? (
                  <p className="lattice-output-note">This draft did not clear every meaning check. Review it before relying on it.</p>
                ) : null}
                {latticeResult.status === "unable-to-attempt" ? (
                  <p className="lattice-output-note">Nothing was changed.</p>
                ) : null}
                {latticeResult.status === "conformant-for-context" ? (
                  <p className="lattice-output-note">The source already fit the selected register.</p>
                ) : null}
                {latticeResult.text ? (
                  <div className="lattice-output-protection">
                    <pre
                      className="lattice-output-text"
                      dir="auto"
                      data-nosnippet=""
                      draggable={false}
                    >{latticeResult.text}</pre>
                    <span className="lattice-output-veil" aria-hidden="true" />
                  </div>
                ) : null}
                {latticeResult.status === "needs-clarification" && latticeResult.questions.length ? (
                  <div className="lattice-clarifications">
                    {latticeResult.questions.map((question) => (
                      <fieldset key={question.id} aria-describedby={clarificationErrors[question.id] ? `lattice-question-error-${question.id}` : undefined}>
                        <legend>{question.prompt}</legend>
                        {question.options.length ? question.options.map((option: { id: string; label: string }) => (
                          <label key={option.id}>
                            <input
                              type="radio"
                              name={`lattice-question-${question.id}`}
                              value={option.id}
                              checked={clarificationAnswers[question.id] === option.id}
                              onChange={(event) => {
                                setClarificationAnswers((current) => ({ ...current, [question.id]: event.currentTarget.value }));
                                setClarificationErrors((current) => ({ ...current, [question.id]: "" }));
                              }}
                            />{" "}{option.label}
                          </label>
                        )) : null}
                        <label className="lattice-clarification-input-label" htmlFor={`lattice-question-custom-${question.id}`}>Something else</label>
                        <input
                          id={`lattice-question-custom-${question.id}`}
                          className="form-control lattice-clarification-input"
                          value={question.options.some(({ id }: { id: string }) => id === clarificationAnswers[question.id]) ? "" : (clarificationAnswers[question.id] ?? "")}
                          spellCheck={false}
                          autoCorrect="off"
                          autoCapitalize="off"
                          autoComplete="off"
                          aria-invalid={clarificationErrors[question.id] ? "true" : undefined}
                          aria-errormessage={clarificationErrors[question.id] ? `lattice-question-error-${question.id}` : undefined}
                          onChange={(event) => updateLatticeClarificationInput(question.id, event.currentTarget.value)}
                        />
                        {clarificationErrors[question.id] ? (
                          <p className="lattice-input-error" id={`lattice-question-error-${question.id}`} role="alert">{clarificationErrors[question.id]}</p>
                        ) : null}
                      </fieldset>
                    ))}
                    <button className="lattice-run-button" type="button" onClick={continueLattice} disabled={busy}>Continue</button>
                  </div>
                ) : null}
                {latticeVisibleFindings(latticeResult).length ? (
                  <details className="lattice-output-findings">
                    <summary>Why this result</summary>
                    <ul>
                      {latticeVisibleFindings(latticeResult).map((message, index) => (
                        <li key={`${message}-${index}`}>{message}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </>
            ) : (
              <p className="lattice-output-placeholder">Your result will appear here.</p>
            )}
            <p className="lattice-output-privacy-curtain" aria-hidden="true">Return to this window to view the result.</p>
          </section>
        </div>
      </div>
    </>
  );
}
