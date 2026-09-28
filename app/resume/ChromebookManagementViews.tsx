"use client";

import { useRef } from "react";
import {
  chromebookActionPaths,
  chromebookExceptionPhases,
  chromebookManagementViews,
  chromebookPathStates,
  chromebookServiceBlueprints,
  chromebookSkillDomains,
  chromebookStateFlows,
} from "./chromebookManagementViews.js";
import {
  ActionSequence,
  FrostedStateStage,
  ReadableSequence,
  ReconciliationTable,
  RovingStateTabs,
  ServiceBlueprint,
  StateFlowFigure,
  useFrostedState,
} from "./lattice/diagramInfrastructure";

type ChromebookViewId = "flow" | "skills" | "matrix" | "blueprint";
type ChromebookConditionId = "normal-return" | "overdue-unreturned" | "late-return";
type ChromebookManagementViewsProps = Readonly<{
  instanceId: string;
  technologies: readonly string[];
}>;

function StateFlowView({ conditionId }: Readonly<{ conditionId: ChromebookConditionId }>) {
  const actionPath = chromebookActionPaths.find(({ id }) => id === conditionId);
  const stateFlow = chromebookStateFlows[conditionId];
  if (!actionPath || !stateFlow) return null;

  return (
    <StateFlowFigure
      condition={actionPath.condition}
      description={stateFlow.description}
      diagram={stateFlow.diagram}
      label={actionPath.label}
      tone={actionPath.tone}
    />
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
      <ReconciliationTable
        caption={`${actionPath.label}: evidence resolves into one ordered response`}
        rows={[
          { label: "Physical evidence", value: actionPath.physicalEvidence },
          { label: "Sierra ILS", value: actionPath.sierraEvidence },
          { label: "Endpoint context", value: actionPath.endpointEvidence },
          { label: "Interpretation", value: actionPath.interpretation },
          {
            className: `chromebook-matrix-action teaching-manifest-entry--${actionPath.tone}`,
            label: "Action sequence",
            value: <ActionSequence value={actionPath.actions.join(" → ")} />,
          },
          { label: "Operational result", value: actionPath.outcome },
        ]}
      />
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
      <ServiceBlueprint actionTone={actionPath.tone} steps={blueprint} />
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

      <FrostedStateStage
        frosted={state.frosted}
        labelledBy={`${idPrefix}-view-${selectedState.viewId}-tab ${pathTabId}${phaseTabId ? ` ${phaseTabId}` : ""}`}
        panelId={panelId}
        phase={state.phase}
        transitioning={state.transitioning}
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
      </FrostedStateStage>
    </section>
  );
}
