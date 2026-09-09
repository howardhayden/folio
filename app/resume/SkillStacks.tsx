"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

export default function SkillStacks() {
  const sectionRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const detailsByIdRef = useRef(new Map<string, HTMLDetailsElement>());
  const openStackIdsRef = useRef<string[]>([]);
  const focusFrameRef = useRef<number | null>(null);
  const [openStackIds, setOpenStackIds] = useState<string[]>([]);

  const updateOpenStack = useCallback((id: string, isOpen: boolean) => {
    setOpenStackIds((current) => {
      const next = isOpen
        ? current.includes(id) ? current : [...current, id]
        : current.filter((openId) => openId !== id);
      openStackIdsRef.current = next;
      return next;
    });
  }, []);

  const closeAllStacks = useCallback(() => {
    for (const details of detailsByIdRef.current.values()) {
      if (details.open) details.open = false;
    }
    openStackIdsRef.current = [];
    setOpenStackIds([]);
  }, []);

  useEffect(() => {
    mainRef.current = sectionRef.current?.closest("main") ?? null;
    const restoredOpenIds = skillStacks
      .map(({ id }) => id)
      .filter((id) => detailsByIdRef.current.get(id)?.open);
    openStackIdsRef.current = restoredOpenIds;
    setOpenStackIds(restoredOpenIds);

    return () => {
      if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
      mainRef.current?.removeAttribute("data-skill-stack-reading");
    };
  }, []);

  useEffect(() => {
    if (openStackIds.length > 0) mainRef.current?.setAttribute("data-skill-stack-reading", "true");
    else mainRef.current?.removeAttribute("data-skill-stack-reading");
  }, [openStackIds.length]);

  useEffect(() => {
    if (openStackIds.length === 0) return;

    const isOutsideSkillStacks = (target: EventTarget | null) => (
      target instanceof Node && !sectionRef.current?.contains(target)
    );
    const handlePointerDown = (event: PointerEvent) => {
      if (isOutsideSkillStacks(event.target)) closeAllStacks();
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (isOutsideSkillStacks(event.target)) closeAllStacks();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const mostRecentId = openStackIdsRef.current.at(-1);
      if (!mostRecentId) return;

      const details = detailsByIdRef.current.get(mostRecentId);
      const summary = details?.querySelector<HTMLElement>("summary") ?? null;
      event.preventDefault();
      if (details) details.open = false;
      updateOpenStack(mostRecentId, false);
      focusFrameRef.current = window.requestAnimationFrame(() => {
        focusFrameRef.current = null;
        if (summary?.isConnected) summary.focus({ preventScroll: true });
      });
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeAllStacks, openStackIds.length, updateOpenStack]);

  return (
    <section className="container skill-stacks-section" aria-labelledby="skill-stacks-title" ref={sectionRef}>
      <h2 className="text-center skill-stack-heading" id="skill-stacks-title">Skill Stacks</h2>
      <div className="skill-stack-grid" id="skill-stacks-grid">
        {skillStacks.map((stack) => {
          const isOpen = openStackIds.includes(stack.id);
          const titleId = `skill-stack-title-${stack.id}`;
          const contentId = `skill-stack-content-${stack.id}`;

          return (
            <article
              aria-labelledby={titleId}
              className="card skill-stack-card"
              data-skill-stack-id={stack.id}
              data-skill-stack-open={isOpen ? "true" : undefined}
              key={stack.id}
            >
              <div className="card-body skill-stack-card-body">
                <div className="row justify-content-center stack-icon signal-fuzz">
                  <LegacyIcon name={iconByStackId[stack.id]} />
                </div>
                <h3 className="card-title tools-card-title row justify-content-center" id={titleId}>
                  {stack.title}
                </h3>
                <details
                  className="skill-stack-disclosure"
                  onToggle={(event) => updateOpenStack(stack.id, event.currentTarget.open)}
                  ref={(element) => {
                    if (element) detailsByIdRef.current.set(stack.id, element);
                    else detailsByIdRef.current.delete(stack.id);
                  }}
                >
                  <summary aria-controls={contentId}>
                    <span>Read More</span>
                    <span className="skill-stack-summary-context"> about {stack.title}</span>
                  </summary>
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
                </details>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
