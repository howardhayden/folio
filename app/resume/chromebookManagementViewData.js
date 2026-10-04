export const chromebookManagementViews = Object.freeze([
  Object.freeze({ id: "flow", label: "State Flow" }),
  Object.freeze({ id: "skills", label: "Skill Map" }),
  Object.freeze({ id: "matrix", label: "Reconciliation Matrix" }),
  Object.freeze({ id: "blueprint", label: "Service Blueprint" }),
]);

export const chromebookPathStates = Object.freeze([
  Object.freeze({ id: "normal", label: "Normal return" }),
  Object.freeze({ id: "exception", label: "Exception lifecycle" }),
]);

export const chromebookExceptionPhases = Object.freeze([
  Object.freeze({ id: "overdue-unreturned", label: "Still out" }),
  Object.freeze({ id: "late-return", label: "Returned late" }),
]);

export const chromebookActionPaths = Object.freeze([
  Object.freeze({
    id: "normal-return",
    label: "Returned before lock",
    tone: "blue-green",
    condition: "Turned in before the lock condition",
    physicalEvidence: "In staff custody",
    sierraEvidence: "returned",
    endpointEvidence: "No overdue lock in effect",
    interpretation: "The returned device enters the required return-assurance path.",
    actions: Object.freeze(["Wipe", "Verify"]),
    outcome: "Device wiped and verified",
    activeDomains: Object.freeze(["return-timing", "return-assurance"]),
  }),
  Object.freeze({
    id: "overdue-unreturned",
    label: "Still out too long",
    tone: "red-orange",
    condition: "Not turned in for too long",
    physicalEvidence: "Still out",
    sierraEvidence: "overdue / not returned",
    endpointEvidence: "Lock not yet applied",
    interpretation: "Endpoint access is secured while the device remains out.",
    actions: Object.freeze(["Lock"]),
    outcome: "Locked pending physical return",
    activeDomains: Object.freeze(["return-timing", "endpoint-control"]),
  }),
  Object.freeze({
    id: "late-return",
    label: "Returned after lock",
    tone: "storm-gray",
    condition: "Turned in after being out too long",
    physicalEvidence: "Back in staff custody",
    sierraEvidence: "returned after overdue",
    endpointEvidence: "Locked during the overdue exception",
    interpretation: "Access is restored after return before return assurance is completed.",
    actions: Object.freeze(["Unlock", "Wipe", "Verify"]),
    outcome: "Device wiped and verified after return",
    activeDomains: Object.freeze(["return-timing", "endpoint-control", "return-assurance"]),
  }),
]);

export const chromebookSkillDomains = Object.freeze([
  Object.freeze({
    id: "return-timing",
    label: "Return timing",
    tone: "blue-green",
    context: "returned · overdue · lock condition",
  }),
  Object.freeze({
    id: "endpoint-control",
    label: "Endpoint control",
    tone: "red-orange",
    context: "lock while out · unlock after return",
  }),
  Object.freeze({
    id: "return-assurance",
    label: "Return assurance",
    tone: "storm-gray",
    context: "wipe · verify every returned device",
  }),
]);

const FLOW_WIDTH = 36;

function centered(value) {
  return `${" ".repeat(Math.max(0, Math.floor((FLOW_WIDTH - value.length) / 2)))}${value}`;
}

function centeredLines(value) {
  const words = value.split(" ");
  const lines = [];
  for (const word of words) {
    const current = lines.at(-1);
    if (!current || `${current} ${word}`.length > FLOW_WIDTH) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
  }
  return lines.map(centered);
}

function actionLines(actions) {
  return actions.flatMap((action) => [centered("│"), centered(action.toUpperCase())]);
}

function buildStateFlow(path) {
  const priorException = path.id === "late-return"
    ? [centered("LOCKED WHILE STILL OUT"), centered("│")]
    : [];

  return [
    centered("PHYSICAL CHROMEBOOK"),
    centered("│"),
    centered("┌────────────┴────────────┐"),
    centered("▼                         ▼"),
    centered("SIERRA ILS          GOOGLE ADMIN"),
    centered("return status/time   endpoint access"),
    centered("└────────────┬────────────┘"),
    centered("▼"),
    centered("CHROMEBOOK MANAGER"),
    centered("condition → action layer"),
    centered("│"),
    ...priorException,
    ...centeredLines(path.condition.toUpperCase()),
    ...actionLines(path.actions),
    centered("│"),
    ...centeredLines(path.outcome.toUpperCase()),
  ].join("\n");
}

function stateFlowDescription(path) {
  if (path.id === "normal-return") {
    return "Sierra ILS return timing and Google Admin endpoint access resolve a device returned before the lock condition to Wipe, then Verify. The device ends wiped and verified.";
  }
  if (path.id === "overdue-unreturned") {
    return "Sierra ILS return timing and Google Admin endpoint access resolve a device not turned in for too long to Lock. It remains locked pending physical return.";
  }
  return "The device was locked while still out. After it is turned in late, Sierra ILS return evidence and Google Admin endpoint access resolve to Unlock, then Wipe, then Verify. The returned device ends wiped and verified.";
}

export const chromebookStateFlows = Object.freeze(Object.fromEntries(
  chromebookActionPaths.map((path) => [
    path.id,
    Object.freeze({
      description: stateFlowDescription(path),
      diagram: buildStateFlow(path),
    }),
  ]),
));

const [normalReturnPath, overdueUnreturnedPath, lateReturnPath] = chromebookActionPaths;

export const chromebookServiceBlueprints = Object.freeze({
  "normal-return": Object.freeze([
    Object.freeze({ lane: "Trigger", value: normalReturnPath.condition }),
    Object.freeze({ lane: "Physical custody", value: normalReturnPath.physicalEvidence }),
    Object.freeze({ lane: "Sierra ILS evidence", value: normalReturnPath.sierraEvidence }),
    Object.freeze({ lane: "Endpoint context", value: normalReturnPath.endpointEvidence }),
    Object.freeze({ lane: "Interpretation", value: normalReturnPath.interpretation }),
    Object.freeze({ lane: "Action sequence", value: normalReturnPath.actions.join(" → "), emphasis: "action" }),
    Object.freeze({ lane: "Outcome", value: normalReturnPath.outcome }),
  ]),
  "overdue-unreturned": Object.freeze([
    Object.freeze({ lane: "Trigger", value: overdueUnreturnedPath.condition }),
    Object.freeze({ lane: "Physical custody", value: overdueUnreturnedPath.physicalEvidence }),
    Object.freeze({ lane: "Sierra ILS evidence", value: overdueUnreturnedPath.sierraEvidence }),
    Object.freeze({ lane: "Endpoint context", value: overdueUnreturnedPath.endpointEvidence }),
    Object.freeze({ lane: "Interpretation", value: overdueUnreturnedPath.interpretation }),
    Object.freeze({ lane: "Action sequence", value: overdueUnreturnedPath.actions.join(" → "), emphasis: "action" }),
    Object.freeze({ lane: "Outcome", value: overdueUnreturnedPath.outcome }),
  ]),
  "late-return": Object.freeze([
    Object.freeze({ lane: "Trigger", value: `${overdueUnreturnedPath.condition} → ${lateReturnPath.condition}` }),
    Object.freeze({ lane: "Physical custody", value: `${overdueUnreturnedPath.physicalEvidence} → ${lateReturnPath.physicalEvidence}` }),
    Object.freeze({ lane: "Sierra ILS evidence", value: `${overdueUnreturnedPath.sierraEvidence} → ${lateReturnPath.sierraEvidence}` }),
    Object.freeze({ lane: "Endpoint context", value: `${overdueUnreturnedPath.endpointEvidence} → ${lateReturnPath.endpointEvidence}` }),
    Object.freeze({ lane: "Interpretation", value: "Lock while the device remains out; after return, restore access and complete return assurance." }),
    Object.freeze({
      lane: "Action sequence",
      value: [...overdueUnreturnedPath.actions, "Await physical return", ...lateReturnPath.actions].join(" → "),
      emphasis: "action",
    }),
    Object.freeze({ lane: "Outcome", value: `${overdueUnreturnedPath.outcome} → ${lateReturnPath.outcome}` }),
  ]),
});
