"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  createFrostedStateTransition,
} from "./frostedStateTransition.js";
import {
  chromebookActionPaths,
  chromebookExceptionPhases,
  chromebookManagementViews,
  chromebookPathStates,
  chromebookServiceBlueprints,
  chromebookSkillDomains,
  chromebookStateFlows,
} from "./chromebookManagementViews.js";

type ChromebookViewId = "flow" | "skills" | "matrix" | "blueprint";
type ChromebookConditionId = "normal-return" | "overdue-unreturned" | "late-return";
type TransitionPhase = "stable" | "outgoing" | "incoming";

type ChromebookManagementViewsProps = Readonly<{
  instanceId: string;
  technologies: readonly string[];
}>;

type StateTabItem = Readonly<{
  id: string;
  label: string;
}>;

function motionDuration(milliseconds: number) {
  return [
    "(prefers-reduced-motion: reduce)",
    "(prefers-reduced-transparency: reduce)",
    "(forced-colors: active)",
  ].some((query) => window.matchMedia(query).matches) ? 0 : milliseconds;
}

function useFrostedState(initialValue: string) {
  const [selected, setSelected] = useState(initialValue);
  const [displayed, setDisplayed] = useState(initialValue);
  const [phase, setPhase] = useState<TransitionPhase>("stable");
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
      onPhase: (nextPhase: TransitionPhase) => setPhase(nextPhase),
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

function RovingStateTabs({
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
  items: readonly StateTabItem[];
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

function ActionSequence({ value }: Readonly<{ value: string }>) {
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

function ReadableSequence({ value }: Readonly<{ value: string }>) {
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

function StateFlowView({ conditionId }: Readonly<{ conditionId: ChromebookConditionId }>) {
  const actionPath = chromebookActionPaths.find(({ id }) => id === conditionId);
  const stateFlow = chromebookStateFlows[conditionId];
  if (!actionPath || !stateFlow) return null;

  return (
    <figure
      className="chromebook-state-flow"
      role="img"
      aria-label={stateFlow.description}
      tabIndex={0}
    >
      <figcaption>
        <span className={`teaching-manifest-entry--${actionPath.tone}`}>
          <span className="teaching-manifest-percent signal-fuzz">{actionPath.label}</span>
        </span>
        <small>{actionPath.condition}</small>
      </figcaption>
      <pre className="tools-card-accent signal-fuzz" aria-hidden="true">
        {stateFlow.diagram}
      </pre>
    </figure>
  );
}

function SkillMapView({
  conditionId,
  idPrefix,
  technologies,
}: Readonly<{
  conditionId: ChromebookConditionId;
  idPrefix: string;
  technologies: readonly string[];
}>) {
  const actionPath = chromebookActionPaths.find(({ id }) => id === conditionId);
  if (!actionPath) return null;

  return (
    <figure className="chromebook-skill-map">
      <figcaption>
        Capability overlap for <span className="chromebook-plain-emphasis">{actionPath.label.toLowerCase()}</span>
      </figcaption>
      <div className="chromebook-skill-map-visual" aria-hidden="true">
        {chromebookSkillDomains.map((domain) => {
          const isActive = actionPath.activeDomains.includes(domain.id);
          return (
            <div
              className={`chromebook-skill-domain chromebook-skill-domain--${domain.id} teaching-manifest-entry--${domain.tone}${isActive ? "" : " chromebook-skill-domain--quiet"}`}
              key={domain.id}
            >
              <span className="teaching-manifest-percent signal-fuzz">{domain.label}</span>
            </div>
          );
        })}
        <div className={`chromebook-skill-map-center teaching-manifest-entry--${actionPath.tone}`}>
          <ActionSequence value={actionPath.actions.join(" → ")} />
        </div>
      </div>
      <p className="chromebook-visually-hidden" id={`${idPrefix}-skill-domain-description`}>
        {chromebookSkillDomains.map((domain) => `${domain.label}: ${domain.context}.`).join(" ")}
      </p>
      <p className="chromebook-state-resolution">
        {actionPath.condition}. Action: {actionPath.actions.join(", then ")}. {actionPath.outcome}.
      </p>
      <ul className="chromebook-technology-list" aria-label="Technologies">
        {technologies.map((technology) => <li key={technology}>{technology}</li>)}
      </ul>
    </figure>
  );
}

function ReconciliationMatrixView({
  conditionId,
  idPrefix,
}: Readonly<{
  conditionId: ChromebookConditionId;
  idPrefix: string;
}>) {
  const actionPath = chromebookActionPaths.find(({ id }) => id === conditionId);
  if (!actionPath) return null;
  const headingId = `${idPrefix}-reconciliation-heading`;

  return (
    <section className="chromebook-reconciliation" aria-labelledby={headingId}>
      <h4 id={headingId}>Cross-state reconciliation matrix</h4>
      <p>{actionPath.condition}</p>
      <table className="chromebook-evidence-table">
        <caption>{actionPath.label}: evidence resolves into one ordered response</caption>
        <tbody>
          <tr>
            <th scope="row">Physical evidence</th>
            <td>{actionPath.physicalEvidence}</td>
          </tr>
          <tr>
            <th scope="row">Sierra ILS</th>
            <td>{actionPath.sierraEvidence}</td>
          </tr>
          <tr>
            <th scope="row">Endpoint context</th>
            <td>{actionPath.endpointEvidence}</td>
          </tr>
          <tr>
            <th scope="row">Interpretation</th>
            <td>{actionPath.interpretation}</td>
          </tr>
          <tr>
            <th scope="row">Action sequence</th>
            <td className={`chromebook-matrix-action teaching-manifest-entry--${actionPath.tone}`}>
              <ActionSequence value={actionPath.actions.join(" → ")} />
            </td>
          </tr>
          <tr>
            <th scope="row">Operational result</th>
            <td>{actionPath.outcome}</td>
          </tr>
        </tbody>
      </table>
      <p className="chromebook-view-note">
        Every physical return proceeds through <ReadableSequence value="Wipe → Verify" />. The
        elapsed-time lock condition is not exposed in this portfolio record.
      </p>
    </section>
  );
}

function ServiceBlueprintView({
  conditionId,
  idPrefix,
}: Readonly<{
  conditionId: ChromebookConditionId;
  idPrefix: string;
}>) {
  const actionPath = chromebookActionPaths.find(({ id }) => id === conditionId);
  const blueprint = chromebookServiceBlueprints[conditionId];
  if (!actionPath || !blueprint) return null;
  const headingId = `${idPrefix}-blueprint-heading`;

  return (
    <section className="chromebook-blueprint" aria-labelledby={headingId}>
      <h4 id={headingId}>{actionPath.label} service blueprint</h4>
      <p>
        {conditionId === "late-return"
          ? "The selected phase retains the earlier lock so the full exception lifecycle remains legible."
          : actionPath.interpretation}
      </p>
      <dl className="timeline-manifest chromebook-blueprint-lanes">
        {blueprint.map((step, index) => {
          const isLast = index === blueprint.length - 1;
          const isAction = "emphasis" in step && step.emphasis === "action";
          return (
            <div className="timeline-manifest-entry" key={step.lane}>
              <dt className="timeline-manifest-line">
                <span className="timeline-manifest-prefix" aria-hidden="true">{isLast ? "└─ " : "├─ "}</span>
                <span>{step.lane}</span>
              </dt>
              <dd className={`timeline-manifest-line timeline-manifest-value${isAction ? ` chromebook-blueprint-action teaching-manifest-entry--${actionPath.tone}` : ""}`}>
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
      <p className="chromebook-view-note">
        The exact elapsed-time lock condition is not published in this portfolio record.
      </p>
    </section>
  );
}

function parseState(value: string) {
  const [viewId, conditionId] = value.split(":");
  return Object.freeze({
    conditionId: conditionId as ChromebookConditionId,
    viewId: viewId as ChromebookViewId,
  });
}

function stateValue(viewId: ChromebookViewId, conditionId: ChromebookConditionId) {
  return `${viewId}:${conditionId}`;
}

export default function ChromebookManagementViews({
  instanceId,
  technologies,
}: ChromebookManagementViewsProps) {
  const idPrefix = `chromebook-management-views-${instanceId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const panelId = `${idPrefix}-panel`;
  const state = useFrostedState(stateValue("flow", "normal-return"));
  const selectedState = parseState(state.selected);
  const displayedState = parseState(state.displayed);
  const lastExceptionRef = useRef<Exclude<ChromebookConditionId, "normal-return">>("overdue-unreturned");

  const selectView = (id: string) => {
    state.select(stateValue(id as ChromebookViewId, selectedState.conditionId));
  };

  const selectCondition = (conditionId: ChromebookConditionId) => {
    if (conditionId !== "normal-return") lastExceptionRef.current = conditionId;
    state.select(stateValue(selectedState.viewId, conditionId));
  };

  const selectedPath = selectedState.conditionId === "normal-return" ? "normal" : "exception";
  const pathTabId = `${idPrefix}-path-${selectedPath}-tab`;
  const phaseTabId = selectedPath === "exception"
    ? `${idPrefix}-phase-${selectedState.conditionId}-tab`
    : "";

  return (
    <section className="chromebook-management-views" aria-label="Chromebook Management system views">
      <RovingStateTabs
        className="chromebook-view-tabs"
        idPrefix={`${idPrefix}-view`}
        items={chromebookManagementViews}
        label="Chromebook Management views"
        onSelect={selectView}
        panelId={panelId}
        selected={selectedState.viewId}
      />

      <div className="chromebook-condition-navigation" role="group" aria-label="Selected operating condition">
        <RovingStateTabs
          className="chromebook-condition-tabs"
          idPrefix={`${idPrefix}-path`}
          items={chromebookPathStates}
          label="Return path"
          onSelect={(id) => selectCondition(
            id === "normal" ? "normal-return" : lastExceptionRef.current,
          )}
          panelId={panelId}
          selected={selectedPath}
        />
        {selectedPath === "normal" ? (
          <div className="chromebook-exception-navigation chromebook-condition-leaf">
            <span className="timeline-manifest-prefix" aria-hidden="true">└─</span>
            <span>Returned before lock</span>
          </div>
        ) : (
          <div className="chromebook-exception-navigation">
            <span className="timeline-manifest-prefix" aria-hidden="true">└─</span>
            <RovingStateTabs
              className="chromebook-exception-tabs"
              idPrefix={`${idPrefix}-phase`}
              items={chromebookExceptionPhases}
              label="Exception phase"
              onSelect={(id) => selectCondition(id as Exclude<ChromebookConditionId, "normal-return">)}
              panelId={panelId}
              selected={selectedState.conditionId}
            />
          </div>
        )}
      </div>

      <div className="chromebook-state-stage">
        <div
          className={`resume-search-surface resume-search-results--replacing chromebook-state-surface${state.frosted ? " resume-search-surface--frosted" : ""}`}
          id={panelId}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-view-${selectedState.viewId}-tab ${pathTabId}${phaseTabId ? ` ${phaseTabId}` : ""}`}
          aria-busy={state.transitioning}
          aria-hidden={state.transitioning ? "true" : undefined}
          inert={state.transitioning ? true : undefined}
          data-transition-phase={state.phase}
          tabIndex={0}
        >
          {displayedState.viewId === "flow" ? (
            <StateFlowView conditionId={displayedState.conditionId} />
          ) : null}
          {displayedState.viewId === "skills" ? (
            <SkillMapView
              conditionId={displayedState.conditionId}
              idPrefix={idPrefix}
              technologies={technologies}
            />
          ) : null}
          {displayedState.viewId === "matrix" ? (
            <ReconciliationMatrixView
              conditionId={displayedState.conditionId}
              idPrefix={idPrefix}
            />
          ) : null}
          {displayedState.viewId === "blueprint" ? (
            <ServiceBlueprintView
              conditionId={displayedState.conditionId}
              idPrefix={idPrefix}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
