"use client";

import type { ReactNode } from "react";
import {
  LATTICE_EVIDENCE_CLAIM_BOUNDARY,
  textToLatticeAdapterBoundary,
  textToLatticeAdmissionStateMachine,
  textToLatticeEndToEndFlow,
  textToLatticeEvidenceViews,
  textToLatticeReconciliation,
  textToLatticeReconciliationRows,
  textToLatticeServiceBlueprintLanes,
  textToLatticeServiceBlueprintStages,
} from "./evidenceViews.js";
import {
  FrostedStateStage,
  ReconciliationTable,
  RovingStateTabs,
  ServiceBlueprint,
  StateFlowFigure,
  useFrostedState,
} from "./diagramInfrastructure";

type EvidenceViewId = "end-to-end" | "adapter" | "admission" | "reconciliation" | "blueprint";
type EvidenceAtom = Readonly<{
  actor: string;
  action: string;
  condition: string;
  outcome: string;
  recovery: string;
}>;
type EvidenceFlowModel = Readonly<{
  condition: string;
  description: string;
  diagram: string;
  equivalentSteps: readonly EvidenceAtom[];
  label: string;
  title: string;
  tone: string;
}>;
type EvidenceReconciliationRow = Readonly<{
  label: string;
  tone: string;
  value: string;
}>;
type BlueprintStage = EvidenceAtom & Readonly<{
  boundary: string;
  stage: string;
  title: string;
}>;

function ClaimBoundary() {
  return <p className="chromebook-view-note lattice-evidence-claim-boundary">{LATTICE_EVIDENCE_CLAIM_BOUNDARY}</p>;
}

function EvidenceAtoms({
  headingId,
  items,
  title,
}: Readonly<{
  headingId: string;
  items: readonly EvidenceAtom[];
  title: string;
}>) {
  return (
    <details className="lattice-evidence-text-equivalent" aria-labelledby={headingId}>
      <summary id={headingId}>{title}</summary>
      <ol>
        {items.map((item, index) => (
          <li key={`${item.actor}-${index}`}>
            <dl>
              <div>
                <dt>Actor</dt>
                <dd>{item.actor}</dd>
              </div>
              <div>
                <dt>Action</dt>
                <dd>{item.action}</dd>
              </div>
              <div>
                <dt>Condition</dt>
                <dd>{item.condition}</dd>
              </div>
              <div>
                <dt>Outcome</dt>
                <dd>{item.outcome}</dd>
              </div>
              <div>
                <dt>Recovery</dt>
                <dd>{item.recovery}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </details>
  );
}

function FlowView({
  idPrefix,
  model,
  viewId,
}: Readonly<{
  idPrefix: string;
  model: EvidenceFlowModel;
  viewId: EvidenceViewId;
}>) {
  const headingId = `${idPrefix}-heading`;
  return (
    <section className="lattice-evidence-view" aria-labelledby={headingId} data-lattice-evidence-view={viewId}>
      <h4 id={headingId}>{model.title}</h4>
      <ClaimBoundary />
      <StateFlowFigure
        condition={model.condition}
        description={model.description}
        diagram={model.diagram}
        label={model.label}
        tone={model.tone}
      />
      <EvidenceAtoms
        headingId={`${idPrefix}-text-equivalent-heading`}
        items={model.equivalentSteps}
        title={`${model.title} text equivalent`}
      />
    </section>
  );
}

function ReconciliationMatrixView({ idPrefix }: Readonly<{ idPrefix: string }>) {
  const headingId = `${idPrefix}-heading`;
  return (
    <section className="chromebook-reconciliation lattice-evidence-view" aria-labelledby={headingId} data-lattice-evidence-view="reconciliation">
      <h4 id={headingId}>Reconciliation matrix</h4>
      <ClaimBoundary />
      <p>
        Closed host evidence reconciles into one of four public result statuses. Propagated request,
        provider, Worker, and client-response contract failures remain errors rather than results.
      </p>
      <ReconciliationTable
        caption="Conditions and evidence reconciled against host decision, public outcome, and recovery"
        rows={textToLatticeReconciliationRows.map((row: EvidenceReconciliationRow) => ({
          className: `lattice-evidence-matrix-value teaching-manifest-entry--${row.tone}`,
          label: row.label,
          value: row.value,
        }))}
      />
      <p className="chromebook-view-note">
        Reanalysis is committed only for a batch whose replacement candidate survives second verification.
        A propagated request or response failure never becomes a partial result.
      </p>
      <details
        className="lattice-evidence-text-equivalent"
        aria-labelledby={`${idPrefix}-text-equivalent-heading`}
      >
        <summary id={`${idPrefix}-text-equivalent-heading`}>Complete reconciliation text equivalent</summary>
        <p>{textToLatticeReconciliation.description}</p>
        <ol>
          {textToLatticeReconciliationRows.map((row: EvidenceReconciliationRow) => (
            <li key={row.label}>
              <h6>{row.label}</h6>
              <p>{row.value}</p>
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

function BlueprintTextEquivalent({
  headingId,
  stages,
}: Readonly<{
  headingId: string;
  stages: readonly BlueprintStage[];
}>) {
  return (
    <details className="lattice-evidence-text-equivalent" aria-labelledby={headingId}>
      <summary id={headingId}>Service blueprint text equivalent</summary>
      <ol>
        {stages.map((stage) => (
          <li key={stage.stage}>
            <h6>{stage.stage} · {stage.title}</h6>
            <dl>
              <div>
                <dt>Actors</dt>
                <dd>{stage.actor}</dd>
              </div>
              <div>
                <dt>Action</dt>
                <dd>{stage.action}</dd>
              </div>
              <div>
                <dt>Condition</dt>
                <dd>{stage.condition}</dd>
              </div>
              <div>
                <dt>Outcome</dt>
                <dd>{stage.outcome}</dd>
              </div>
              <div>
                <dt>Recovery</dt>
                <dd>{stage.recovery}</dd>
              </div>
              <div>
                <dt>Data boundary</dt>
                <dd>{stage.boundary}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </details>
  );
}

function ServiceBlueprintView({ idPrefix }: Readonly<{ idPrefix: string }>) {
  const headingId = `${idPrefix}-heading`;
  return (
    <section className="chromebook-blueprint lattice-evidence-view" aria-labelledby={headingId} data-lattice-evidence-view="blueprint">
      <h4 id={headingId}>Service blueprint</h4>
      <ClaimBoundary />
      <p>
        The lanes separate visitor action, visible service, browser and API work, fixed provider
        support, evidence and recovery, and the content boundary across BP-01 through BP-08.
      </p>
      <ServiceBlueprint actionTone="storm-gray" steps={textToLatticeServiceBlueprintLanes} />
      <BlueprintTextEquivalent
        headingId={`${idPrefix}-text-equivalent-heading`}
        stages={textToLatticeServiceBlueprintStages}
      />
    </section>
  );
}

function renderEvidenceView(viewId: EvidenceViewId, idPrefix: string): ReactNode {
  if (viewId === "end-to-end") {
    return (
      <FlowView
        idPrefix={`${idPrefix}-end-to-end`}
        model={textToLatticeEndToEndFlow}
        viewId={viewId}
      />
    );
  }
  if (viewId === "adapter") {
    return (
      <FlowView
        idPrefix={`${idPrefix}-adapter`}
        model={textToLatticeAdapterBoundary}
        viewId={viewId}
      />
    );
  }
  if (viewId === "admission") {
    return (
      <FlowView
        idPrefix={`${idPrefix}-admission`}
        model={textToLatticeAdmissionStateMachine}
        viewId={viewId}
      />
    );
  }
  if (viewId === "reconciliation") {
    return <ReconciliationMatrixView idPrefix={`${idPrefix}-reconciliation`} />;
  }
  return <ServiceBlueprintView idPrefix={`${idPrefix}-blueprint`} />;
}

export default function TextToLatticeEvidence({ instanceId }: Readonly<{ instanceId: string }>) {
  const idPrefix = `text-to-lattice-evidence-${instanceId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const descriptionId = `${instanceId}-evidence-description`;
  const panelId = `${idPrefix}-panel`;
  const state = useFrostedState("end-to-end");
  const selectedView = state.selected as EvidenceViewId;
  const displayedView = state.displayed as EvidenceViewId;

  return (
    <section
      className="chromebook-management-views lattice-evidence-views"
      aria-label="Text to Lattice evidence views"
      aria-describedby={descriptionId}
    >
      <p id={descriptionId} className="chromebook-view-note lattice-evidence-description">
        These five diagrams are explanatory models of the implemented source. Viewing or switching
        them does not run a request, and they are not live request telemetry or deployment proof.
      </p>
      <RovingStateTabs
        className="chromebook-view-tabs lattice-evidence-view-tabs"
        idPrefix={`${idPrefix}-view`}
        items={textToLatticeEvidenceViews}
        label="Text to Lattice evidence diagrams"
        onSelect={(id) => state.select(id)}
        panelId={panelId}
        selected={selectedView}
      />
      <FrostedStateStage
        frosted={state.frosted}
        labelledBy={`${idPrefix}-view-${selectedView}-tab`}
        panelId={panelId}
        phase={state.phase}
        transitioning={state.transitioning}
      >
        {renderEvidenceView(displayedView, idPrefix)}
      </FrostedStateStage>
    </section>
  );
}
