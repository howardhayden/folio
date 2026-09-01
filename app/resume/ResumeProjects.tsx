"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  countLatticeCharacters,
  latticeize,
  LATTICE_INPUT_LIMIT,
} from "./latticeDemo.js";

type ProjectIconName =
  | "airplane-engines"
  | "tree"
  | "diagram-3"
  | "bricks"
  | "backpack4"
  | "pen-fill"
  | "archive";

type ProjectResource = {
  label: string;
  url: string;
  icon: ProjectIconName;
  opensInNewTab?: boolean;
};

type Project = {
  name: string;
  url: string;
  icon: ProjectIconName;
  summary: string[];
  publication: string;
  resources?: ProjectResource[];
  interaction?: "lattice-demo";
  readmeAfterFirstParagraph?: boolean;
};

const projects: Project[] = [
  {
    name: "Lattice",
    url: "https://github.com/howardhayden/lattice",
    icon: "pen-fill",
    summary: [
      "Lattice turns linguistic register into an explicit, testable system.",
      "It separates meaning from expression by decomposing content into semantic atoms that candidate prose must preserve. Outputs are evaluated in order of safety, semantic fidelity, accessibility, clarity, domain correctness, register fit, and ornament, preventing style from obscuring instructions, altering causality, or assuming relative education, while welcoming inference.",
      "Its Relational Systems Register connects embodied experience, relationships, institutions, causality, and ethical stakes through consequential detail, subtext, and systems-conscious realism.",
      "Lattice demonstrates that expressive language can be distinctive without becoming semantically unaccountable.",
    ],
    resources: [
      {
        label: "Documentation",
        url: "https://github.com/howardhayden/lattice",
        icon: "backpack4",
        opensInNewTab: true,
      },
    ],
    publication: "September 2026",
    interaction: "lattice-demo",
    readmeAfterFirstParagraph: true,
  },
  {
    name: "FOG OF SEA",
    url: "https://fogofsea.app/",
    icon: "airplane-engines",
    summary: [
      "Naval strategy game with cozy vibes.",
      "Single-player naval strategy learning game implementing nested stochastic matrices within deterministic systems, local-first privacy with resilient data handling, and accessibility, through a cozy-sublime, tactical and diegetic interface.",
    ],
    resources: [
      {
        label: "Systems Atlas",
        url: "https://nbviewer.org/github/howardhayden/fogofsea/blob/main/docs/Systems-Atlas.ipynb",
        icon: "backpack4",
        opensInNewTab: true,
      },
    ],
    publication: "August 2026",
  },
  {
    name: "CHORUS",
    url: "https://chorus.observer/",
    icon: "diagram-3",
    summary: [
      "Social simulation of influence, uncertainty, and collective belief.",
      "Multi-agent social simulation game modeling disinformation propagation, algorithmic amplification, social capital, and cross-scenario effects through interconnected social actors, procedural scenario generation, cross-system state effects, and coherency validation at network scale.",
    ],
    resources: [
      {
        label: "Documentation",
        url: "https://chorus.observer/notebooks/",
        icon: "backpack4",
        opensInNewTab: true,
      },
    ],
    publication: "August 2026",
  },
  {
    name: "IN KEEPING",
    url: "https://inkeep.ing/",
    icon: "bricks",
    summary: [
      "Local-first library continuity lab with user-created workspaces, explicit persistence, integrity-linked revisions, structured safeguards, and notebooks. Models dependencies and access paths; records custody, fixity, rights, metadata, conditions, decisions, and recovery actions; preserves provenance and continuity through disruption and handoff.",
    ],
    resources: [
      {
        label: "Technical report",
        url: "https://inkeep.ing/?view=reports",
        icon: "backpack4",
        opensInNewTab: true,
      },
      {
        label: "Public notice",
        url: "https://inkeep.ing/?view=reports",
        icon: "backpack4",
        opensInNewTab: true,
      },
    ],
    publication: "August 2026",
  },
  {
    name: "Evenward.rest",
    url: "https://evenward.rest/",
    icon: "tree",
    summary: [
      "A privacy-conscious, self-regulation studio prototype designed around movement, attention, pattern, knowledge, and play.",
    ],
    publication: "July 2026",
  },
  {
    name: "Medium",
    url: "https://medium.com/@howardhayden",
    icon: "archive",
    summary: [
      "The quiet infrastructure that shapes how we live, work, and act under and in preparation for pressure.",
    ],
    publication: "June 2026–present",
  },
];

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

export default function ResumeProjects() {
  const [latticeOpen, setLatticeOpen] = useState(false);
  const [latticeInput, setLatticeInput] = useState("");
  const [latticeError, setLatticeError] = useState("");
  const [latticeResult, setLatticeResult] = useState<ReturnType<typeof latticeize> | null>(null);
  const latticeDialogRef = useRef<HTMLDivElement>(null);
  const latticeInputRef = useRef<HTMLTextAreaElement>(null);
  const latticeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const characterCount = countLatticeCharacters(latticeInput);

  const closeLattice = () => setLatticeOpen(false);

  useEffect(() => {
    if (!latticeOpen) return;

    const previousOverflow = document.body.style.overflow;
    const dialog = latticeDialogRef.current;
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const focusableElements = () => Array.from(
      dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    ).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeLattice();
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
    const focusFrame = window.requestAnimationFrame(() => {
      (latticeInputRef.current ?? dialog)?.focus({ preventScroll: true });
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.body.classList.remove("resume-modal-open");
      document.body.style.overflow = previousOverflow;
      const trigger = latticeTriggerRef.current;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [latticeOpen]);

  const openLattice = (trigger: HTMLButtonElement) => {
    latticeTriggerRef.current = trigger;
    setLatticeError("");
    setLatticeOpen(true);
  };

  const updateLatticeInput = (value: string) => {
    if (countLatticeCharacters(value) > LATTICE_INPUT_LIMIT) {
      setLatticeError(`The ${LATTICE_INPUT_LIMIT}-character limit was reached. The added text was not accepted.`);
      return;
    }

    setLatticeInput(value);
    setLatticeError("");
    setLatticeResult(null);
  };

  const runLattice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setLatticeResult(latticeize(latticeInput));
      setLatticeError("");
    } catch (error) {
      setLatticeResult(null);
      setLatticeError(error instanceof Error ? error.message : "Lattice could not process that text.");
    }
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
                  <div
                    className="row justify-content-center"
                    aria-hidden="true"
                  >
                    <span className="tool-icon">
                      <ProjectIcon icon={project.icon} />
                    </span>
                  </div>

                  <h3
                    className="card-title tools-card-title row justify-content-center"
                    id={headingId}
                  >
                    {project.interaction === "lattice-demo" ? (
                      <button
                        type="button"
                        className="project-title-button signal-fuzz"
                        aria-haspopup="dialog"
                        aria-controls="lattice-demo-dialog"
                        onClick={(event) => openLattice(event.currentTarget)}
                      >
                        {project.name}
                      </button>
                    ) : (
                      <a className="signal-fuzz" href={project.url}>{project.name}</a>
                    )}
                  </h3>

                  {project.readmeAfterFirstParagraph ? (
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
                                    ? `${resource.label} for ${project.name}, opens in a new tab`
                                    : `${resource.label} for ${project.name}`
                                }
                              >
                                <span aria-hidden="true">
                                  <ProjectIcon icon={resource.icon} />
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
                    <small>{project.publication}</small>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {latticeOpen ? (
        <div className="modal resume-modal lattice-modal" role="presentation" onPointerDown={closeLattice}>
          <div
            ref={latticeDialogRef}
            className="modal-content lattice-modal-content"
            id="lattice-demo-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lattice-demo-title"
            aria-describedby="lattice-demo-description"
            aria-keyshortcuts="Escape"
            tabIndex={-1}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="lattice-modal-heading">
              <div>
                <p className="lattice-modal-kicker">Relational Systems Register</p>
                <h3 id="lattice-demo-title">Lattice</h3>
              </div>
              <button className="lattice-modal-close" type="button" onClick={closeLattice}>
                Close
              </button>
            </div>

            <p id="lattice-demo-description" className="lattice-modal-description">
              Enter up to {LATTICE_INPUT_LIMIT} characters. This short-form demonstrator selects an operative, experiential, or interpretive layer, then reshapes cadence only when every word can remain in order.
            </p>

            <form onSubmit={runLattice} noValidate>
              <label className="lattice-input-label" htmlFor="lattice-demo-input">
                Text to Lattice-icize
              </label>
              <textarea
                ref={latticeInputRef}
                className="form-control lattice-input"
                id="lattice-demo-input"
                value={latticeInput}
                rows={5}
                aria-describedby={`lattice-demo-help lattice-character-count${latticeError ? " lattice-input-error" : ""}`}
                aria-errormessage={latticeError ? "lattice-input-error" : undefined}
                aria-invalid={latticeError ? "true" : undefined}
                onChange={(event) => updateLatticeInput(event.currentTarget.value)}
              />
              <div className="lattice-input-meta">
                <small id="lattice-demo-help">Protected instructions remain direct.</small>
                <small id="lattice-character-count">{characterCount} / {LATTICE_INPUT_LIMIT}</small>
              </div>
              {latticeError ? (
                <p className="lattice-input-error" id="lattice-input-error" role="alert">
                  {latticeError}
                </p>
              ) : null}
              <button className="lattice-run-button" type="submit">
                Lattice-icize
              </button>
            </form>

            <section className="lattice-output" aria-labelledby="lattice-output-title" aria-live="polite" aria-atomic="true">
              <h4 id="lattice-output-title">Lattice-icized text</h4>
              {latticeResult ? (
                <>
                  <p className="lattice-output-register">
                    {latticeResult.layerLabel} · {latticeResult.conformance === "literal" ? "wording preserved" : "cadence shaped"}
                  </p>
                  <p className="lattice-output-text">{latticeResult.text}</p>
                  <p className="lattice-output-note">{latticeResult.layerDescription}</p>
                </>
              ) : (
                <p className="lattice-output-placeholder">Your result will appear here.</p>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
