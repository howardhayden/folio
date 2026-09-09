export const LATTICE_ATTESTATION_ORIGIN = "https://verify.hah.dev";
export const LATTICE_ATTESTATION_FRAME_URL = `${LATTICE_ATTESTATION_ORIGIN}/turnstile/`;
export const LATTICE_ATTESTATION_PROTOCOL = "hah.lattice.attestation";
export const LATTICE_ATTESTATION_PROTOCOL_VERSION = 1;

const TURNSTILE_SITE_KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;
const TURNSTILE_TOKEN_LIMIT = 2_048;
const TURNSTILE_TOKEN_UNSAFE_CHARACTER_PATTERN = /[\s\u0000-\u001F\u007F-\u009F]/u;
const ATTESTATION_REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{24}$/u;
const ATTESTATION_TIMEOUT_MS = 120_000;
const TURNSTILE_NORMAL_MINIMUM_WIDTH = 300;

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactlyKeys(value, keys) {
  if (!isPlainRecord(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index]);
}

export function latticeAttestationSize(container) {
  const availableWidth = Number(container?.getBoundingClientRect?.().width ?? container?.clientWidth ?? 0);
  return availableWidth > 0 && availableWidth < TURNSTILE_NORMAL_MINIMUM_WIDTH ? "compact" : "flexible";
}

export function isLatticeAttestationToken(value) {
  return typeof value === "string"
    && value.length > 0
    && value.length <= TURNSTILE_TOKEN_LIMIT
    && !TURNSTILE_TOKEN_UNSAFE_CHARACTER_PATTERN.test(value);
}

export function createLatticeAttestationRequestId(cryptoImpl = globalThis.crypto) {
  if (typeof cryptoImpl?.getRandomValues !== "function") {
    throw new Error("The acquisition check is unavailable right now.");
  }
  const bytes = cryptoImpl.getRandomValues(new Uint8Array(18));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function parseLatticeAttestationFrameMessage(value, requestId) {
  if (!isPlainRecord(value)
    || value.protocol !== LATTICE_ATTESTATION_PROTOCOL
    || value.version !== LATTICE_ATTESTATION_PROTOCOL_VERSION) {
    return null;
  }
  if (value.type === "ready" && hasExactlyKeys(value, ["protocol", "version", "type"])) {
    return Object.freeze({ type: "ready" });
  }
  if (!ATTESTATION_REQUEST_ID_PATTERN.test(requestId ?? "") || value.requestId !== requestId) return null;
  if ((value.type === "interactive" || value.type === "noninteractive" || value.type === "error")
    && hasExactlyKeys(value, ["protocol", "version", "type", "requestId"])) {
    return Object.freeze({ type: value.type });
  }
  if (value.type === "token"
    && hasExactlyKeys(value, ["protocol", "version", "type", "requestId", "token"])
    && isLatticeAttestationToken(value.token)) {
    return Object.freeze({ type: "token", token: value.token });
  }
  return null;
}

export function isLatticeAttestationFrameEvent(event, frameWindow, requestId) {
  if (event?.origin !== LATTICE_ATTESTATION_ORIGIN || event?.source !== frameWindow) return null;
  return parseLatticeAttestationFrameMessage(event.data, requestId);
}

function postStartMessage(frame, requestId, siteKey, size) {
  frame.contentWindow?.postMessage({
    protocol: LATTICE_ATTESTATION_PROTOCOL,
    version: LATTICE_ATTESTATION_PROTOCOL_VERSION,
    type: "start",
    requestId,
    siteKey,
    size,
  }, LATTICE_ATTESTATION_ORIGIN);
}

export function obtainLatticeAttestation(siteKey, container, signal) {
  if (!TURNSTILE_SITE_KEY_PATTERN.test(siteKey ?? "")
    || typeof HTMLElement === "undefined"
    || !(container instanceof HTMLElement)) {
    return Promise.reject(new Error("The acquisition check is unavailable right now."));
  }
  if (signal?.aborted) {
    return Promise.reject(new DOMException("The local conversion was canceled.", "AbortError"));
  }

  let requestId;
  try {
    requestId = createLatticeAttestationRequestId();
  } catch (error) {
    return Promise.reject(error);
  }
  const size = latticeAttestationSize(container);
  const frame = document.createElement("iframe");
  frame.className = "lattice-attestation-frame";
  frame.src = LATTICE_ATTESTATION_FRAME_URL;
  frame.title = "Text to Lattice acquisition check";
  frame.setAttribute("aria-label", "Text to Lattice acquisition check");
  frame.setAttribute(
    "sandbox",
    "allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts",
  );
  frame.referrerPolicy = "no-referrer";
  frame.loading = "eager";
  frame.tabIndex = -1;
  frame.dataset.size = size;

  return new Promise((resolve, reject) => {
    let settled = false;
    let started = false;

    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", receivedMessage);
      signal?.removeEventListener("abort", aborted);
      frame.removeEventListener("error", frameFailed);
      frame.remove();
      container.removeAttribute("data-verification-state");
    };
    const finish = (operation, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      operation(value);
    };
    const failed = () => finish(reject, new Error("The acquisition check did not finish. Please try again."));
    const aborted = () => finish(
      reject,
      new DOMException("The local conversion was canceled.", "AbortError"),
    );
    const frameFailed = () => failed();
    const receivedMessage = (event) => {
      const message = isLatticeAttestationFrameEvent(event, frame.contentWindow, requestId);
      if (!message || settled) return;
      if (message.type === "ready") {
        if (started) return;
        started = true;
        postStartMessage(frame, requestId, siteKey, size);
        return;
      }
      if (!started) return;
      if (message.type === "interactive") {
        container.dataset.verificationState = "interactive";
        frame.tabIndex = 0;
        frame.focus({ preventScroll: true });
        return;
      }
      if (message.type === "noninteractive") {
        container.dataset.verificationState = "pending";
        frame.tabIndex = -1;
        return;
      }
      if (message.type === "token") {
        finish(resolve, message.token);
        return;
      }
      failed();
    };

    const timer = window.setTimeout(failed, ATTESTATION_TIMEOUT_MS);
    window.addEventListener("message", receivedMessage);
    signal?.addEventListener("abort", aborted, { once: true });
    frame.addEventListener("error", frameFailed, { once: true });
    if (signal?.aborted) {
      aborted();
      return;
    }
    container.dataset.verificationState = "pending";
    try {
      container.replaceChildren(frame);
    } catch {
      failed();
    }
  });
}
