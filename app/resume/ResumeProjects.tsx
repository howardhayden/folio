"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type Ref,
  type SyntheticEvent,
} from "react";
import {
  LATTICE_INPUT_SAFETY_LIMIT,
  countLatticeWords,
  LATTICE_WORD_LIMIT,
  validateLatticeInput,
} from "./lattice/inputPolicy.js";
import {
  LLAMA_3_2_PUBLIC_TERMS,
} from "./lattice/publicTerms.js";
import {
  LatticeRemoteError,
  requestRemoteLattice,
} from "./lattice/remoteRequest.js";
import { mayRevealLatticeOutput } from "./lattice/outputProtection.js";
import { projects } from "./projects.js";
import ProjectDescriptionDisclosure from "./ProjectDescriptionDisclosure";
import ProjectResources from "./ProjectResources";

type ProjectIconName =
  | "airplane-engines"
  | "tree"
  | "diagram-3"
  | "bricks"
  | "backpack4"
  | "pen-fill"
  | "archive";

const LATTICE_USE_CONFIRMATION_ERROR = "Confirm that you are authorized to send this source to the external service.";

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

function projectHeadingId(name: string, prefix = "project") {
  return `${prefix}-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

type ResumeProject = (typeof projects)[number];

type ResumeProjectCardProps = Readonly<{
  project: ResumeProject;
  headingPrefix?: string;
  disclosureId?: string;
  latticeLaunchRef?: Ref<HTMLAnchorElement>;
  onLatticeLaunch?: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
  onNavigate?: (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => void;
}>;

/** The canonical Resume project card, shared verbatim with Resume Search. */
export function ResumeProjectCard({
  project,
  headingPrefix = "project",
  disclosureId = project.id,
  latticeLaunchRef,
  onLatticeLaunch,
  onNavigate,
}: ResumeProjectCardProps) {
  const headingId = projectHeadingId(project.name, headingPrefix);
  const latticeProject = "interaction" in project && project.interaction === "lattice-demo";
  const linksToAuthoritativeSource = "resumeCardLink" in project
    && project.resumeCardLink === "authoritative-source";
  const cardHref = linksToAuthoritativeSource ? project.url : project.canonicalPath;

  return (
    <article className="card" aria-labelledby={headingId}>
      <div className="card-body">
        <div className="row justify-content-center">
          {latticeProject && onLatticeLaunch ? (
            <a
              ref={latticeLaunchRef}
              className="tool-icon project-modal-trigger signal-fuzz"
              data-lattice-launch="text-to-lattice"
              href="/projects/lattice/text-to-lattice/"
              aria-label="Use Text to Lattice"
              aria-haspopup="dialog"
              aria-controls="lattice-demo-dialog"
              onClick={onLatticeLaunch}
            >
              <ProjectIcon icon={project.icon as ProjectIconName} />
            </a>
          ) : latticeProject ? (
            <a
              className="tool-icon project-modal-trigger signal-fuzz"
              href="/projects/lattice/text-to-lattice/"
              aria-label="Open Text to Lattice"
              onClick={(event) => onNavigate?.(event, "/projects/lattice/text-to-lattice/")}
            >
              <ProjectIcon icon={project.icon as ProjectIconName} />
            </a>
          ) : linksToAuthoritativeSource ? (
            <a
              className="tool-icon signal-fuzz"
              href={cardHref}
              aria-label={`Open ${project.name} authoritative source`}
              onClick={(event) => onNavigate?.(event, cardHref)}
            >
              <ProjectIcon icon={project.icon as ProjectIconName} />
            </a>
          ) : (
            <span className="tool-icon signal-fuzz" aria-hidden="true">
              <ProjectIcon icon={project.icon as ProjectIconName} />
            </span>
          )}
        </div>

        <h3 className="card-title tools-card-title project-card-title row justify-content-center" id={headingId}>
          <a
            className="signal-fuzz"
            href={cardHref}
            onClick={(event) => onNavigate?.(event, cardHref)}
          >
            {project.name}
          </a>
        </h3>

        <ProjectDescriptionDisclosure
          hook={project.summary[0]}
          paragraph={project.summary[1]}
          projectId={disclosureId}
          projectName={project.name}
          projectSlug={project.slug}
          technologies={project.technologies}
        />

        <ProjectResources projectName={project.name} resources={project.resources ?? []} />

        <p className="card-text">
          <small>{project.publication.label}</small>
        </p>
      </div>
    </article>
  );
}

type LatticeResult = Awaited<ReturnType<typeof requestRemoteLattice>>;
type LatticePhase = "idle" | "ready" | "validating" | "submitting" | "processing" | "success" | "canceling" | "error";

function latticeOutcomeLabel(result: LatticeResult | null) {
  if (!result) return "";
  if (result.status === "translated") return "Latticed text";
  if (result.status === "conformant-for-context") return "Source fits this context";
  if (result.status === "unable-to-attempt") return "No Latticed result";
  return "Review needed";
}

function latticeResultAnnouncement(result: LatticeResult) {
  const register = result.layerLabel?.trim();
  return `Result ready. ${latticeOutcomeLabel(result)}.${register ? ` Register: ${register}.` : ""}`;
}

function isLatticeInputFailure(error: unknown) {
  if (!(error instanceof RangeError)) return false;
  return /^(?:This browser cannot safely segment Text to Lattice input\.|Text to Lattice input |Enter text with at least one word|Text to Lattice accepts up to |Text to Lattice cannot safely split |Text to Lattice supports at most |Text to Lattice cannot safely model |Text to Lattice could not create a safe work unit|Text to Lattice could not fit every exact literal)/u.test(error.message);
}

function latticeInputFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (/at least one word/iu.test(message)) {
    return "Enter at least one word.";
  }
  if (/accepts up to 700 words|words or fewer/iu.test(message)) {
    return `Keep the source to ${LATTICE_WORD_LIMIT} words or fewer.`;
  }
  if (/12,000-character safety limit|characters or fewer/iu.test(message)) {
    return `Keep the source to ${LATTICE_INPUT_SAFETY_LIMIT.toLocaleString("en-US")} characters or fewer.`;
  }
  if (/too many separate exact literals|more than twenty-four separate exact literals/iu.test(message)) {
    return "This source is too complex for one run. Shorten it and try again.";
  }
  if (/too many bounded passages|supports at most .*passages/iu.test(message)) {
    return "This source is too complex for one run. Shorten it and try again.";
  }
  if (/bounded work groups|too (?:large|structurally dense)/iu.test(message)) {
    return "This source is too complex for one run. Shorten it and try again.";
  }
  if (/control|unicode|noncharacter|direction|grapheme|character sequence|word-like token|invisible formatting|segment/iu.test(message)) {
    return "This source contains unsupported characters or formatting. Remove them and try again.";
  }
  return "This source cannot be processed safely.";
}

function latticeFailureMessage(error: unknown) {
  if (isLatticeInputFailure(error)) return latticeInputFailureMessage(error);
  if (error instanceof LatticeRemoteError) {
    if (error.code === "visitor_session_required") {
      return "The external provider did not receive your text because hah.dev could not establish its private daily-limit cookie. Allow site cookies for hah.dev, then submit again only if you choose.";
    }
    if (error.code === "invalid_request" || error.code === "input_too_large") {
      return "The service rejected this source. Review the limits and submit again only if you choose.";
    }
    if (error.code === "rate_limited") {
      const retry = error.retryAfterSeconds === null ? "later" : `in ${error.retryAfterSeconds} seconds`;
      return `Text to Lattice is at capacity. You can make a new submission ${retry}.`;
    }
    if (error.code === "client_timeout" || error.code === "upstream_timeout") {
      return "The external transformation timed out. hah.dev does not retain your sample or a partial result. Submit again only if you choose.";
    }
    if (error.code === "network_failure" || error.code === "upstream_unavailable") {
      return "The request could not complete and may have reached the configured external service. hah.dev does not retain your sample or result. Submit again only if you choose.";
    }
    if (error.code === "malformed_upstream_response" || error.code === "invalid_response") {
      return "The external service returned a result that hah.dev could not safely display. hah.dev does not retain your sample or result.";
    }
  }
  return "Text to Lattice could not finish. The request may have reached the configured external service; hah.dev does not retain your sample or result.";
}

function latticeProgressText(phase: LatticePhase) {
  const labels: Record<LatticePhase, string> = {
    idle: "",
    ready: "",
    validating: "Validating source",
    submitting: "Submitting to hah.dev",
    processing: "Processing with the external service",
    success: "",
    canceling: "Canceling",
    error: "",
  };
  return labels[phase];
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
  const [latticeInputInvalid, setLatticeInputInvalid] = useState(false);
  const [latticeResult, setLatticeResult] = useState<LatticeResult | null>(null);
  const [latticePhase, setLatticePhase] = useState<LatticePhase>("idle");
  const latticeDialogRef = useRef<HTMLDivElement>(null);
  const latticeInputRef = useRef<HTMLTextAreaElement>(null);
  const latticeOutputRef = useRef<HTMLElement>(null);
  const latticeOutputRefreshRef = useRef<(() => void) | null>(null);
  const latticeTriggerRef = useRef<HTMLAnchorElement | null>(null);
  const latticeDirectLaunchRef = useRef<HTMLAnchorElement | null>(null);
  const latticeCancelButtonRef = useRef<HTMLButtonElement>(null);
  const latticeCloseRef = useRef<() => void>(() => {});
  const latticeAbortRef = useRef<AbortController | null>(null);
  const latticeJobRef = useRef(0);
  const latticeMountedRef = useRef(true);
  const latticePhaseRef = useRef<LatticePhase>(latticePhase);
  const latticeResultRef = useRef<LatticeResult | null>(latticeResult);
  const wordCount = countLatticeWords(latticeInput);
  const busy = ["validating", "submitting", "processing", "canceling"].includes(latticePhase);
  const taskContinuesWhileClosed = busy;
  const overLimit = wordCount > LATTICE_WORD_LIMIT;
  const progressText = latticeProgressText(latticePhase);
  const primaryUnavailable = busy || latticeInputInvalid || wordCount === 0 || overLimit || !latticeUseConfirmed;

  useEffect(() => {
    latticePhaseRef.current = latticePhase;
  }, [latticePhase]);

  useEffect(() => {
    latticeResultRef.current = latticeResult;
  }, [latticeResult]);

  const cancelLattice = useCallback(() => {
    const controller = latticeAbortRef.current;
    if (!controller || !latticeMountedRef.current) return;
    setLatticePhase("canceling");
    controller.abort(new DOMException("Text to Lattice was canceled.", "AbortError"));
  }, []);

  useEffect(() => {
    latticeMountedRef.current = true;
    return () => {
      latticeMountedRef.current = false;
      latticeJobRef.current += 1;
      const controller = latticeAbortRef.current;
      latticeAbortRef.current = null;
      controller?.abort();
      if (latticeInputRef.current) latticeInputRef.current.value = "";
      latticeInputRef.current = null;
      latticeDialogRef.current = null;
      latticeOutputRef.current = null;
      latticeTriggerRef.current = null;
      latticeDirectLaunchRef.current = null;
    };
  }, []);

  const closeLattice = useCallback(() => {
    // Closing is visibility-only. Cancel and Start over are the explicit
    // teardown controls; input, active work, and any eventual result remain
    // mounted for the next open.
    setLatticeOpen(false);
  }, []);

  useEffect(() => {
    latticeCloseRef.current = closeLattice;
    return () => { latticeCloseRef.current = () => {}; };
  }, [closeLattice]);

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
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const focusableElements = () => Array.from(
      dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    ).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
    let containmentFrame = 0;
    const preferredFocusTarget = () => {
      const phase = latticePhaseRef.current;
      const result = latticeResultRef.current;
      if (["validating", "submitting", "processing", "canceling"].includes(phase)) {
        const cancel = latticeCancelButtonRef.current;
        if (cancel?.isConnected && !cancel.disabled) return cancel;
      }
      if (result && latticeOutputRef.current) return latticeOutputRef.current;
      const input = latticeInputRef.current;
      if (input && !input.disabled) return input;
      return dialog;
    };
    const containFocus = () => {
      if (!dialog) return;
      const active = document.activeElement;
      const activeIsUsable = active instanceof HTMLElement
        && dialog.contains(active)
        && !active.matches(":disabled, [hidden], [aria-hidden='true'], [tabindex='-1']");
      const preferred = preferredFocusTarget();
      if (activeIsUsable) return;
      preferred?.focus({ preventScroll: true });
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
      preferredFocusTarget()?.focus({ preventScroll: true });
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
    window.addEventListener("pageshow", reveal);
    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);
    document.addEventListener("focusin", reveal);
    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("keydown", handlePrintScreen, true);
    document.addEventListener("keyup", handlePrintScreen, true);
    latticeOutputRefreshRef.current = reveal;
    handleVisibility();
    return () => {
      latticeOutputRefreshRef.current = null;
      window.cancelAnimationFrame(revealFrame);
      window.clearTimeout(printScreenTimer);
      window.removeEventListener("blur", shield);
      window.removeEventListener("focus", reveal);
      window.removeEventListener("pageshow", reveal);
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
      document.removeEventListener("focusin", reveal);
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("keydown", handlePrintScreen, true);
      document.removeEventListener("keyup", handlePrintScreen, true);
      output?.setAttribute("data-shielded", "true");
    };
  }, [latticeOpen]);

  useEffect(() => {
    // Refresh on result arrival without recreating the protection controller
    // or resetting its active print/capture deadline.
    if (latticeOpen && latticeResult) latticeOutputRefreshRef.current?.();
  }, [latticeOpen, latticeResult]);

  const openLattice = useCallback((trigger: HTMLAnchorElement) => {
    latticeTriggerRef.current = trigger;
    setLatticeOpen(true);
    setLatticePhase((current) => current === "idle" ? "ready" : current);
  }, []);

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
    const legacyQueryLaunch = url.searchParams.get("tool") === "text-to-lattice";
    if (legacyQueryLaunch) {
      window.location.replace("/resume/#text-to-lattice");
      return;
    }
    if (url.hash !== "#text-to-lattice") return;
    const trigger = latticeDirectLaunchRef.current;
    if (!trigger) return;
    url.hash = "#project-lattice";
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    openLattice(trigger);
  }, [openLattice]);

  const updateLatticeInput = (value: string) => {
    setLatticeUseConfirmed(false);
    if (value.length > LATTICE_INPUT_SAFETY_LIMIT) {
      setLatticeResult(null);
      setLatticeError(`Keep the source to ${LATTICE_INPUT_SAFETY_LIMIT.toLocaleString("en-US")} characters or fewer.`);
      setLatticeInputInvalid(true);
      setLatticePhase("ready");
      return;
    }
    setLatticeInput(value);
    setLatticeResult(null);
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
    setLatticePhase("ready");
  };

  const executeLattice = async () => {
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
      setLatticePhase("validating");
      validateLatticeInput(latticeInput);
      setLatticeResult(null);
      setLatticeError("");
      setLatticeInputInvalid(false);
      const result = await requestRemoteLattice(latticeInput, {
        requestedMode: "auto",
        signal: controller.signal,
        onState: (phase: LatticePhase) => {
          if (!latticeMountedRef.current || latticeJobRef.current !== jobId) return;
          setLatticePhase(phase);
        },
      });
      if (!latticeMountedRef.current || latticeJobRef.current !== jobId || controller.signal.aborted) return;
      setLatticeResult(result);
      setLatticePhase("success");
      window.requestAnimationFrame(() => {
        const output = latticeOutputRef.current;
        const modal = output?.closest(".modal");
        if (!output || modal?.hasAttribute("hidden")) return;
        latticeOutputRefreshRef.current?.();
        output.scrollIntoView({ block: "nearest" });
        output.focus({ preventScroll: true });
      });
    } catch (error) {
      if (!latticeMountedRef.current || latticeJobRef.current !== jobId) return;
      if (controller.signal.aborted || error instanceof DOMException && error.name === "AbortError") {
        setLatticeResult(null);
        setLatticeError("Canceled. The request may already have reached the configured external service. hah.dev does not retain your sample or result.");
        setLatticeInputInvalid(false);
        setLatticePhase("ready");
        return;
      }
      setLatticeResult(null);
      setLatticeError(latticeFailureMessage(error));
      setLatticeInputInvalid(isLatticeInputFailure(error));
      setLatticePhase("error");
    } finally {
      if (latticeJobRef.current === jobId) latticeAbortRef.current = null;
    }
  };

  const runLattice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void executeLattice();
  };

  const startLatticeOver = () => {
    updateLatticeInput("");
    setLatticeUseConfirmed(false);
    setLatticePhase("ready");
    window.requestAnimationFrame(() => latticeInputRef.current?.focus({ preventScroll: true }));
  };

  const blockLatticeOutputTransfer = (event: SyntheticEvent<HTMLElement>) => {
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
          {projects.map((project) => (
            <ResumeProjectCard
              project={project}
              latticeLaunchRef={project.id === "lattice" ? latticeDirectLaunchRef : undefined}
              onLatticeLaunch={"interaction" in project && project.interaction === "lattice-demo" ? launchLattice : undefined}
              key={project.id}
            />
          ))}
        </div>
        <p className="project-record-link"><a href="/projects/">All canonical project records</a></p>
        <noscript>
          <p className="lattice-noscript-note">
            Text to Lattice is unavailable here. <a href="/projects/lattice/text-to-lattice/">Read the tool details</a>.
          </p>
        </noscript>
      </section>

      <div
        className="modal resume-modal lattice-modal"
        role="presentation"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeLattice();
        }}
        hidden={!latticeOpen}
      >
        <div
          ref={latticeDialogRef}
          className="modal-content lattice-modal-content"
          id="lattice-demo-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lattice-demo-title"
          aria-describedby="lattice-demo-description lattice-external-privacy lattice-model-disclosure lattice-demonstration-profile lattice-usage-policy"
          aria-keyshortcuts="Escape"
          tabIndex={-1}
        >
          <h3 id="lattice-demo-title">Text to Lattice</h3>

          <div className="lattice-modal-introduction">
            <p id="lattice-demo-description" className="lattice-modal-description">
              Enter up to {LATTICE_WORD_LIMIT} words. Meaning remains binding; register may change.
            </p>
            <p id="lattice-external-privacy" className="lattice-local-note">
              This text leaves hah.dev for processing by the configured external Hugging Face inference service only when you choose <strong>Process with external service</strong>. hah.dev does not retain your sample or result. Do not submit classified, controlled, privileged, export-controlled, operationally sensitive, or otherwise restricted information. <a href="/projects/lattice/text-to-lattice/#text-to-lattice-privacy">Privacy details</a>.
            </p>
            <p id="lattice-model-disclosure" className="lattice-local-note">
              Model-assisted result: Qwen drafts and Llama 3.2 checks through the configured external service. The service may apply its own processing terms. Known limits: the models and automated checks can alter or omit meaning, introduce bias, or fail to catch unsafe content. Review every result before relying on it. <a href={LLAMA_3_2_PUBLIC_TERMS.licenseUrl}>Built with Llama</a>.
            </p>
            <p className="lattice-usage-note" id="lattice-demonstration-profile">
              Demonstration profile: after explicit confirmation, the browser sends one
              content-free cookie setup POST and then exactly one content-bearing POST to
              <code> /api/lattice</code>. Only the second includes your text or can initiate
              external-provider processing. The browser does not contact model providers directly,
              and a failed request is not retried automatically.
            </p>
            <p className="lattice-usage-note" id="lattice-usage-policy">
              Demonstration only: 30 content-bearing transformation requests are accepted globally
              per UTC day and 3 from one ordinary persistent browser cookie jar. hah.dev uses one
              opaque, HttpOnly quota cookie scoped only to <code>/api/lattice</code> until the next UTC
              day; it contains no submitted text or result. Blocking or clearing cookies can reset the
              per-cookie-jar count, but not the global limit. Availability also depends on bounded
              provider capacity.
            </p>
          </div>

          <form className="lattice-form" onSubmit={runLattice} noValidate>
            <div className="lattice-source-field">
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
                disabled={busy}
                aria-describedby={`lattice-word-count${latticeInputInvalid && latticeError ? " lattice-input-error" : ""}`}
                aria-errormessage={latticeInputInvalid ? "lattice-input-error" : undefined}
                aria-invalid={latticeInputInvalid ? "true" : undefined}
                onChange={(event) => updateLatticeInput(event.currentTarget.value)}
              />
              <div className="lattice-input-meta">
                <small id="lattice-word-count" className={overLimit ? "text-red" : undefined}>{wordCount} of {LATTICE_WORD_LIMIT} words</small>
              </div>
            </div>
            <div className="lattice-use-confirmation">
              <input
                id="lattice-use-confirmation"
                type="checkbox"
                checked={latticeUseConfirmed}
                required
                disabled={busy || wordCount === 0 || overLimit || latticeInputInvalid}
                aria-describedby="lattice-use-confirmation-detail"
                onChange={(event) => {
                  const confirmed = event.currentTarget.checked;
                  setLatticeUseConfirmed(confirmed);
                  if (confirmed && latticeError === LATTICE_USE_CONFIRMATION_ERROR) setLatticeError("");
                }}
              />
              <label className="lattice-use-confirmation-label" htmlFor="lattice-use-confirmation">
                I confirm that this source is in one of the supported languages, I am authorized to send it to the configured external service, and this conversion has a lawful purpose and will not materially further conduct prohibited by the Llama 3.2 Acceptable Use Policy.
              </label>
              <small id="lattice-use-confirmation-detail" className="lattice-use-confirmation-detail">
                Supported languages: English, German, French, Italian, Portuguese, Hindi, Spanish, and Thai. See the <a href={LLAMA_3_2_PUBLIC_TERMS.acceptableUseUrl}>Llama 3.2 Acceptable Use Policy</a>.
              </small>
            </div>
            {latticeError ? (
              <p className="lattice-input-error" id="lattice-input-error" role="alert">
                {latticeError}{!latticeInputInvalid ? <> <a href="/projects/lattice/text-to-lattice/">Tool details</a>.</> : null}
              </p>
            ) : null}
            {progressText ? (
              <div className="lattice-progress">
                <span aria-live="polite" role="status">{progressText}</span>
              </div>
            ) : null}
            <div className="lattice-actions">
              <button className="lattice-run-button" type="submit" disabled={primaryUnavailable}>
                Process with external service
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
              <button className="lattice-cancel-button" type="button" onClick={closeLattice} aria-label={taskContinuesWhileClosed ? "Close; current task continues" : latticeResult ? "Close" : "Cancel"}>
                {taskContinuesWhileClosed || latticeResult ? "Close" : "Cancel"}
              </button>
            </div>
          </form>

          <section
            ref={latticeOutputRef}
            className="lattice-output"
            aria-labelledby="lattice-output-title"
            tabIndex={-1}
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
