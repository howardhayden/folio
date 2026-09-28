"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  createFrostedStateTransition,
} from "../frostedStateTransition.js";

export type FrostedStatePhase = "stable" | "outgoing" | "incoming";

export type DiagramStateTabItem = Readonly<{
  id: string;
  label: string;
}>;

export type ReconciliationRow = Readonly<{
  className?: string;
  label: string;
  value: ReactNode;
}>;

export type ServiceBlueprintStep = Readonly<{
  emphasis?: string;
  lane: string;
  value: string;
}>;

function motionDuration(milliseconds: number) {
  return [
    "(prefers-reduced-motion: reduce)",
    "(prefers-reduced-transparency: reduce)",
    "(forced-colors: active)",
  ].some((query) => window.matchMedia(query).matches) ? 0 : milliseconds;
}

export function useFrostedState(initialValue: string) {
  const [selected, setSelected] = useState(initialValue);
  const [displayed, setDisplayed] = useState(initialValue);
  const [phase, setPhase] = useState<FrostedStatePhase>("stable");
  const [frosted, setFrosted] = useState(false);
  const controllerRef = useRef<ReturnType<typeof createFrostedStateTransition> | null>(null);

  useEffect(() => {
    const controller = createFrostedStateTransition({
      cancelFrame: (frame: number) => window.cancelAnimationFrame(frame),
      clearTimer: (timer: number) => window.clearTimeout(timer),
      durationFor: motionDuration,
      initialValue,
      onDisplayed: setDisplayed,
      onFrosted: setFrosted,
      onPhase: (nextPhase: FrostedStatePhase) => setPhase(nextPhase),
      onSelected: setSelected,
      requestFrame: (callback: FrameRequestCallback) => window.requestAnimationFrame(callback),
      setTimer: (callback: () => void, milliseconds: number) => window.setTimeout(callback, milliseconds),
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, [initialValue]);

  const select = (nextValue: string) => {
    if (controllerRef.current) {
      controllerRef.current.select(nextValue);
      return;
    }
    setSelected(nextValue);
    setDisplayed(nextValue);
    setFrosted(false);
    setPhase("stable");
  };

  return {
    displayed,
    frosted,
    phase,
    select,
    selected,
    transitioning: phase !== "stable",
  };
}

export function RovingStateTabs({
  className,
  idPrefix,
  items,
  label,
  onSelect,
  panelId,
  selected,
}: Readonly<{
  className: string;
  idPrefix: string;
  items: readonly DiagramStateTabItem[];
  label: string;
  onSelect: (id: string) => void;
  panelId: string;
  selected: string;
}>) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const activate = (index: number, focus = false) => {
    const item = items[index];
    if (!item) return;
    onSelect(item.id);
    if (focus) tabRefs.current[index]?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % items.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    activate(nextIndex, true);
  };

  return (
    <div className={className} role="tablist" aria-label={label}>
      {items.map((item, index) => {
        const isSelected = selected === item.id;
        return (
          <button
            ref={(element) => { tabRefs.current[index] = element; }}
            className="button-reset resume-search-close chromebook-state-tab signal-fuzz"
            id={`${idPrefix}-${item.id}-tab`}
            type="button"
            role="tab"
            aria-controls={panelId}
            aria-selected={isSelected}
            key={item.id}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => activate(index)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function ActionSequence({ value }: Readonly<{ value: string }>) {
  return (
    <>
      <span className="teaching-manifest-percent signal-fuzz" aria-hidden="true">
        {value}
      </span>
      <span className="chromebook-visually-hidden">
        {value.replaceAll(" → ", ", then ")}
      </span>
    </>
  );
}

export function ReadableSequence({ value }: Readonly<{ value: string }>) {
  if (!value.includes(" → ")) return <>{value}</>;
  return (
    <>
      <span aria-hidden="true">{value}</span>
      <span className="chromebook-visually-hidden">
        {value.replaceAll(" → ", ", then ")}
      </span>
    </>
  );
}

export function StateFlowFigure({
  condition,
  description,
  diagram,
  label,
  tone,
}: Readonly<{
  condition: string;
  description: string;
  diagram: string;
  label: string;
  tone: string;
}>) {
  return (
    <figure
      className="chromebook-state-flow"
      role="img"
      aria-label={description}
      tabIndex={0}
    >
      <figcaption>
        <span className={`teaching-manifest-entry--${tone}`}>
          <span className="teaching-manifest-percent signal-fuzz">{label}</span>
        </span>
        <small>{condition}</small>
      </figcaption>
      <pre className="tools-card-accent signal-fuzz" aria-hidden="true">
        {diagram}
      </pre>
    </figure>
  );
}

export function ReconciliationTable({
  caption,
  rows,
}: Readonly<{
  caption: string;
  rows: readonly ReconciliationRow[];
}>) {
  return (
    <table className="chromebook-evidence-table">
      <caption>{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td className={row.className}>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ServiceBlueprint({
  actionTone,
  steps,
}: Readonly<{
  actionTone: string;
  steps: readonly ServiceBlueprintStep[];
}>) {
  return (
    <dl className="timeline-manifest chromebook-blueprint-lanes">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isAction = step.emphasis === "action";
        return (
          <div className="timeline-manifest-entry" key={step.lane}>
            <dt className="timeline-manifest-line">
              <span className="timeline-manifest-prefix" aria-hidden="true">{isLast ? "└─ " : "├─ "}</span>
              <span>{step.lane}</span>
            </dt>
            <dd className={`timeline-manifest-line timeline-manifest-value${isAction ? ` chromebook-blueprint-action teaching-manifest-entry--${actionTone}` : ""}`}>
              <span className="timeline-manifest-prefix" aria-hidden="true">{isLast ? "   " : "│  "}</span>
              <span>
                {isAction
                  ? <ActionSequence value={step.value} />
                  : <ReadableSequence value={step.value} />}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function FrostedStateStage({
  children,
  frosted,
  labelledBy,
  panelId,
  phase,
  transitioning,
}: Readonly<{
  children: ReactNode;
  frosted: boolean;
  labelledBy: string;
  panelId: string;
  phase: FrostedStatePhase;
  transitioning: boolean;
}>) {
  return (
    <div className="chromebook-state-stage">
      <div
        className={`resume-search-surface resume-search-results--replacing chromebook-state-surface${frosted ? " resume-search-surface--frosted" : ""}`}
        id={panelId}
        role="tabpanel"
        aria-labelledby={labelledBy}
        aria-busy={transitioning}
        aria-hidden={transitioning ? "true" : undefined}
        inert={transitioning ? true : undefined}
        data-transition-phase={phase}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  );
}
