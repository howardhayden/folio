"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ProjectDescriptionDisclosureProps = Readonly<{
  hook: string;
  paragraph: string;
  projectId: string;
  projectName: string;
}>;

export default function ProjectDescriptionDisclosure({
  hook,
  paragraph,
  projectId,
  projectName,
}: ProjectDescriptionDisclosureProps) {
  const [open, setOpen] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const inlineContentId = `project-readme-content-${projectId}`;
  const modalTitleId = `project-readme-modal-title-${projectId}`;
  const modalContentId = `project-readme-modal-content-${projectId}`;
  const closeDescription = useCallback(() => setOpen(false), []);

  useEffect(() => {
    detailsRef.current?.removeAttribute("open");
  }, []);

  useEffect(() => {
    if (!open) return;

    const dialog = dialogRef.current;
    const focusableSelector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
      "[contenteditable='true']",
    ].join(",");
    const focusableElements = () => Array.from(
      dialog?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
    ).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDescription();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;
      const elements = focusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (active === last || active === dialog || !dialog.contains(active))) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (dialog && !dialog.contains(event.target as Node)) {
        (focusableElements()[0] ?? dialog).focus({ preventScroll: true });
      }
    };

    document.body.classList.add("resume-modal-open");
    document.body.classList.add("skill-stack-modal-open");
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    const focusFrame = window.requestAnimationFrame(() => dialog?.focus({ preventScroll: true }));

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.body.classList.remove("resume-modal-open");
      document.body.classList.remove("skill-stack-modal-open");
      const returnFocus = returnFocusRef.current;
      returnFocusRef.current = null;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [closeDescription, open]);

  return (
    <>
      <p className="card-text">{hook}</p>
      <details className="project-readme project-description-disclosure" ref={detailsRef}>
        <summary
          aria-controls={inlineContentId}
          onClick={(event) => {
            event.preventDefault();
            event.currentTarget.parentElement?.removeAttribute("open");
            returnFocusRef.current = event.currentTarget;
            setOpen(true);
          }}
        >
          <span>Read More</span>
          <span className="skill-stack-summary-context"> about {projectName}</span>
        </summary>
        <div className="project-readme-copy" id={inlineContentId}>
          <p className="card-text">{paragraph}</p>
        </div>
      </details>

      {open && typeof document !== "undefined" ? createPortal(
        <div
          className="modal resume-modal skill-stack-modal project-description-modal"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeDescription();
          }}
        >
          <div
            ref={dialogRef}
            className="modal-content skill-stack-modal-content project-description-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            aria-describedby={modalContentId}
            aria-keyshortcuts="Escape"
            tabIndex={-1}
          >
            <h3 id={modalTitleId}>{projectName}</h3>
            <div className="project-readme-copy" id={modalContentId}>
              <p className="card-text">{paragraph}</p>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
