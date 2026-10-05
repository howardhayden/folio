// Trusted internal instrumentation only. The public opt-in grants no authority.
// These identities attest to this JS request/client path; deployed binding and
// source custody are separately required to attribute a native DO transaction.
const REQUESTS = new WeakMap();
const SIGNALS = new WeakMap();
const CLAIMS = new WeakMap();
const DISPATCHES = new WeakMap();
const ACKNOWLEDGMENTS = new WeakMap();
const PROVIDERS = new WeakMap();
const FIELDS = Object.freeze(["status", "claim", "order", "provider"]);
const UNAVAILABLE = Object.freeze({
  status: "unavailable", claim: "unavailable", order: "unavailable", provider: "unavailable",
});

function active(handle) {
  const state = REQUESTS.get(handle);
  return state && !state.closed ? state : null;
}

function forSignal(signal) {
  return active(SIGNALS.get(signal));
}

export function isClosedLatticeAdmissionObservation(value) {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).length !== FIELDS.length
      || !FIELDS.every((field) => Object.hasOwn(descriptors, field)
        && Object.hasOwn(descriptors[field], "value") && descriptors[field].enumerable)) return false;
    const [status, claim, order, provider] = FIELDS.map((field) => descriptors[field].value);
    if (status === "unavailable") return [claim, order, provider].every((item) => item === "unavailable");
    if (status !== "complete") return false;
    if (claim === "not-called") return order === "not-called" && provider === "not-started";
    if (order !== "after-validation") return false;
    if (claim === "denied-once") return provider === "not-started";
    return claim === "allowed-once" && ["not-started", "after-admission"].includes(provider);
  } catch { return false; }
}

export function createLatticeAdmissionObservation(signal) {
  if (signal === null || typeof signal !== "object" || SIGNALS.has(signal)) return null;
  const handle = Object.freeze({});
  REQUESTS.set(handle, {
    closed: false, tainted: false, validated: false, claimCalls: 0, dispatchCalls: 0,
    currentClaim: null, claimPending: false, result: null, pipelineTrusted: false,
    providerStarted: false, pending: new Set(), observation: null,
  });
  SIGNALS.set(signal, handle);
  return handle;
}

export function observeLatticeAdmissionTrustedStep(handle, trusted) {
  const state = active(handle);
  if (state && trusted !== true) state.tainted = true;
}

export function observeLatticeAdmissionValidation(handle) {
  const state = active(handle);
  if (state) state.validated = true;
}

export function beginLatticeAdmissionClaim(handle, defaultClient) {
  const state = active(handle);
  if (!state) return null;
  state.claimCalls = Math.min(2, state.claimCalls + 1);
  if (!state.validated || defaultClient !== true || state.claimCalls !== 1) state.tainted = true;
  const call = Object.freeze({});
  CLAIMS.set(call, state);
  state.currentClaim = call;
  state.claimPending = true;
  return call;
}

export function beginLatticeCapacityDispatch(signal) {
  const state = forSignal(signal);
  if (!state) return null;
  state.dispatchCalls = Math.min(2, state.dispatchCalls + 1);
  if (!state.claimPending || state.currentClaim === null || state.dispatchCalls !== 1) state.tainted = true;
  const dispatch = Object.freeze({});
  DISPATCHES.set(dispatch, { state, call: state.currentClaim });
  state.pending.add(dispatch);
  return dispatch;
}

export function rememberLatticeCapacityAcknowledgment(dispatch, result, allowed) {
  const source = DISPATCHES.get(dispatch);
  if (!source || source.state.closed || result === null || typeof result !== "object") return;
  if (typeof allowed !== "boolean" || !source.state.pending.has(dispatch)
    || source.call === null || source.call !== source.state.currentClaim) {
    source.state.tainted = true;
    return;
  }
  ACKNOWLEDGMENTS.set(result, { ...source, allowed });
}

export function endLatticeCapacityDispatch(dispatch) {
  const source = DISPATCHES.get(dispatch);
  if (source && !source.state.closed) source.state.pending.delete(dispatch);
}

export function endLatticeAdmissionClaim(handle, call, result) {
  const state = active(handle);
  if (!state) return;
  const acknowledgment = ACKNOWLEDGMENTS.get(result);
  if (CLAIMS.get(call) !== state || state.currentClaim !== call || !state.claimPending
    || acknowledgment?.state !== state || acknowledgment.call !== call
    || state.dispatchCalls !== 1 || state.pending.size !== 0) {
    state.tainted = true;
  } else state.result = acknowledgment.allowed ? "allowed-once" : "denied-once";
  state.claimPending = false;
}

export function observeLatticeAdmissionPipeline(handle, trusted) {
  const state = active(handle);
  if (!state) return;
  state.pipelineTrusted = trusted === true;
  if (!state.pipelineTrusted) state.tainted = true;
}

export function beginLatticeAdmissionProviderFetch(signal) {
  const state = forSignal(signal);
  if (!state) return null;
  if (!state.pipelineTrusted || state.result !== "allowed-once" || state.claimPending) state.tainted = true;
  state.providerStarted = true;
  const dispatch = Object.freeze({});
  PROVIDERS.set(dispatch, state);
  state.pending.add(dispatch);
  return dispatch;
}

export function endLatticeAdmissionProviderFetch(dispatch, complete) {
  const state = PROVIDERS.get(dispatch);
  if (state && !state.closed) {
    state.pending.delete(dispatch);
    if (complete !== true) state.tainted = true;
  }
}

export function sealLatticeAdmissionObservation(handle, aborted) {
  const state = REQUESTS.get(handle);
  if (!state) return null;
  if (state.closed) return state.observation;
  state.closed = true;
  if (aborted !== false || state.tainted || state.claimPending || state.pending.size !== 0
    || state.claimCalls > 1 || state.dispatchCalls > 1
    || (state.claimCalls === 0 && (state.dispatchCalls !== 0 || state.providerStarted))
    || (state.claimCalls === 1 && state.result === null)) {
    state.observation = UNAVAILABLE;
  } else {
    state.observation = Object.freeze({
      status: "complete",
      claim: state.result ?? "not-called",
      order: state.claimCalls === 0 ? "not-called" : "after-validation",
      provider: state.providerStarted ? "after-admission" : "not-started",
    });
  }
  return state.observation;
}
