"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LegacyIcon, type LegacyIconName } from "../components/LegacyIcon";
import { skillStacks } from "../data";

const iconByStackId: Record<string, LegacyIconName> = {
  "systems-architecture": "map",
  "interaction-and-service-design": "app-indicator",
  "security-and-verification": "clipboard-check",
  "data-architecture-and-interoperability": "bar-chart-steps",
  "technical-documentation-and-modeling": "body-text",
  "business-analysis-and-operational-planning": "stopwatch",
  "software-development": "laptop",
  "frameworks-platforms-and-delivery": "browser-firefox",
  "fabrication-and-electronics": "tools",
};

type SkillStack = (typeof skillStacks)[number];

function SkillStackContent({ stack, contentId }: { stack: SkillStack; contentId: string }) {
  return (
    <div className="skill-stack-details" id={contentId}>
      {stack.items.length > 0 ? (
        <ul className="skill-stack-list">
          {stack.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : null}
      {stack.sections.map((section, index) => {
        const sectionTitleId = `${contentId}-section-${index + 1}`;
        return (
          <section className="skill-stack-group" aria-labelledby={sectionTitleId} key={section.label}>
            <h4 id={sectionTitleId}>{section.label}</h4>
            <ul className="skill-stack-list">
              {section.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export default function SkillStacks() {
  const [selectedStackId, setSelectedStackId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const selectedStack = useMemo(
    () => skillStacks.find(({ id }) => id === selectedStackId) ?? null,
    [selectedStackId],
  );

  const closeSkillStack = useCallback(() => setSelectedStackId(null), []);

  const openSkillStack = (stackId: string, trigger: HTMLElement) => {
    returnFocusRef.current = trigger;
    setSelectedStackId(stackId);
  };

  useEffect(() => {
    for (const disclosure of sectionRef.current?.querySelectorAll<HTMLDetailsElement>(
      ".skill-stack-disclosure[open]",
    ) ?? []) {
      disclosure.removeAttribute("open");
    }
  }, []);

  useEffect(() => {
    if (!selectedStack) return;

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
        closeSkillStack();
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
  }, [closeSkillStack, selectedStack]);

  return (
    <>
      <section ref={sectionRef} className="container skill-stacks-section" aria-labelledby="skill-stacks-title">
        <h2 className="text-center skill-stack-heading" id="skill-stacks-title">Skill Stacks</h2>
        <div className="skill-stack-grid" id="skill-stacks-grid">
          {skillStacks.map((stack) => {
            const titleId = `skill-stack-title-${stack.id}`;
            const contentId = `skill-stack-content-${stack.id}`;

            return (
              <article
                aria-labelledby={titleId}
                className="card skill-stack-card"
                data-skill-stack-id={stack.id}
                key={stack.id}
              >
                <div className="card-body skill-stack-card-body">
                  <div className="row justify-content-center stack-icon signal-fuzz">
                    <LegacyIcon name={iconByStackId[stack.id]} />
                  </div>
                  <h3 className="card-title tools-card-title row justify-content-center" id={titleId}>
                    {stack.title}
                  </h3>
                  <details className="skill-stack-disclosure">
                    <summary
                      aria-controls={contentId}
                      onClick={(event) => {
                        event.preventDefault();
                        event.currentTarget.parentElement?.removeAttribute("open");
                        openSkillStack(stack.id, event.currentTarget);
                      }}
                    >
                      <span>Read More</span>
                      <span className="skill-stack-summary-context"> about {stack.title}</span>
                    </summary>
                    <SkillStackContent stack={stack} contentId={contentId} />
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div
        className="modal resume-modal skill-stack-modal"
        role="presentation"
        hidden={!selectedStack}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) closeSkillStack();
        }}
      >
        {selectedStack ? (
          <div
            ref={dialogRef}
            className="modal-content skill-stack-modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`skill-stack-modal-title-${selectedStack.id}`}
            aria-keyshortcuts="Escape"
            tabIndex={-1}
          >
            <div className="row justify-content-center stack-icon signal-fuzz" aria-hidden="true">
              <LegacyIcon name={iconByStackId[selectedStack.id]} />
            </div>
            <h3 id={`skill-stack-modal-title-${selectedStack.id}`}>{selectedStack.title}</h3>
            <SkillStackContent
              stack={selectedStack}
              contentId={`skill-stack-modal-content-${selectedStack.id}`}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
