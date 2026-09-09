(() => {
  "use strict";

  const PARENT_ORIGIN = "https://hah.dev";
  const PROTOCOL = "hah.lattice.attestation";
  const PROTOCOL_VERSION = 1;
  const TURNSTILE_ACTION = "text_to_lattice";
  const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  const SCRIPT_TIMEOUT_MS = 15_000;
  const REQUEST_TIMEOUT_MS = 115_000;
  const SITE_KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;
  const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{24}$/u;
  const TOKEN_LIMIT = 2_048;
  const TOKEN_UNSAFE_CHARACTER_PATTERN = /[\s\u0000-\u001F\u007F-\u009F]/u;
  const ALLOWED_SIZES = new Set(["compact", "flexible"]);

  const status = document.getElementById("verification-status");
  const widget = document.getElementById("turnstile-widget");
  let activeRequestId = null;
  let settled = false;
  let widgetId = null;
  let requestTimer = null;
  let scriptPromise = null;

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

  function isValidStartMessage(value) {
    return hasExactlyKeys(value, ["protocol", "version", "type", "requestId", "siteKey", "size"])
      && value.protocol === PROTOCOL
      && value.version === PROTOCOL_VERSION
      && value.type === "start"
      && REQUEST_ID_PATTERN.test(value.requestId)
      && SITE_KEY_PATTERN.test(value.siteKey)
      && ALLOWED_SIZES.has(value.size);
  }

  function isValidToken(value) {
    return typeof value === "string"
      && value.length > 0
      && value.length <= TOKEN_LIMIT
      && !TOKEN_UNSAFE_CHARACTER_PATTERN.test(value);
  }

  function post(type, extra = {}) {
    if (window.parent === window) return;
    window.parent.postMessage({
      protocol: PROTOCOL,
      version: PROTOCOL_VERSION,
      type,
      ...(activeRequestId === null ? {} : { requestId: activeRequestId }),
      ...extra,
    }, PARENT_ORIGIN);
  }

  function setStatus(message) {
    if (status) status.textContent = message;
  }

  function removeWidget() {
    if (widgetId === null || typeof window.turnstile?.remove !== "function") return;
    try {
      window.turnstile.remove(widgetId);
    } catch {
      // The parent removes this browsing context after every terminal result.
    }
    widgetId = null;
  }

  function finish(type, extra) {
    if (settled || activeRequestId === null) return;
    settled = true;
    window.clearTimeout(requestTimer);
    removeWidget();
    post(type, extra);
  }

  function fail() {
    setStatus("Verification could not finish.");
    finish("error");
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let scriptTimer = null;
      const cleanup = () => {
        window.clearTimeout(scriptTimer);
        script.removeEventListener("load", loaded);
        script.removeEventListener("error", failed);
      };
      const failed = () => {
        cleanup();
        script.remove();
        reject(new Error("Turnstile did not load."));
      };
      const loaded = () => {
        if (!window.turnstile) {
          failed();
          return;
        }
        cleanup();
        resolve(window.turnstile);
      };
      script.addEventListener("load", loaded, { once: true });
      script.addEventListener("error", failed, { once: true });
      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.referrerPolicy = "no-referrer";
      scriptTimer = window.setTimeout(failed, SCRIPT_TIMEOUT_MS);
      document.head.append(script);
    }).catch((error) => {
      scriptPromise = null;
      throw error;
    });
    return scriptPromise;
  }

  async function start(message) {
    activeRequestId = message.requestId;
    requestTimer = window.setTimeout(fail, REQUEST_TIMEOUT_MS);
    setStatus("Verification is starting.");
    try {
      const turnstile = await loadTurnstile();
      if (settled) return;
      widgetId = turnstile.render(widget, {
        sitekey: message.siteKey,
        action: TURNSTILE_ACTION,
        appearance: "interaction-only",
        execution: "execute",
        retry: "never",
        "refresh-expired": "never",
        "response-field": false,
        "feedback-enabled": false,
        size: message.size,
        tabindex: 0,
        callback(token) {
          if (!isValidToken(token)) {
            fail();
            return;
          }
          setStatus("Verification is complete.");
          finish("token", { token });
        },
        "before-interactive-callback"() {
          setStatus("Complete the security check to continue.");
          post("interactive");
        },
        "after-interactive-callback"() {
          post("noninteractive");
        },
        "error-callback": fail,
        "expired-callback": fail,
        "timeout-callback": fail,
        "unsupported-callback": fail,
      });
      turnstile.execute(widgetId);
    } catch {
      fail();
    }
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== PARENT_ORIGIN
      || event.source !== window.parent
      || activeRequestId !== null
      || !isValidStartMessage(event.data)) {
      return;
    }
    void start(event.data);
  });

  if (window.parent === window) {
    setStatus("Open Text to Lattice on hah.dev to continue.");
  } else {
    post("ready");
  }
})();
