# Text to Lattice response policy

This Worker is the bounded fallback for response-header controls that the
GitHub Pages origin cannot emit. It proxies the existing `hah.dev` origin and
adds the declared Content Security Policy and `Permissions-Policy` only to the
four résumé document aliases used by Text to Lattice. Its four exact
Cloudflare routes are `/`, `/index.html`, `/resume/`, and
`/resume/index.html`; it is not attached to `hah.dev/*`. The normal stately
résumé and Text to Lattice launch links use fragments, which never reach the
server, so they retain an exact document route. Other paths bypass this Worker
entirely. The separate capability Worker owns only the exact no-query
`hah.dev/api/lattice` route; no provider origin or legacy lease or verification
surface is part of the current browser contract.

The document also carries the same CSP as a meta fallback for legacy query
state and origin-preview contexts; the HTTP response remains authoritative on
the four supported public aliases and uniquely supplies `Permissions-Policy`.
The policy fixes `connect-src` to `'self'`, denies frames, objects, base-URL
changes, and embedding, restricts form submission to self, disables
`document-domain`, and preserves or adds `Cache-Control: no-transform`. The
Worker repeats the exact-path check as defense in depth. It has no bindings,
storage, telemetry, or content inspection, and observability is disabled. This
route shape avoids coupling unrelated portfolio traffic and arbitrary paths to
the Text to Lattice Worker allowance.

The protected deployment runs
`scripts/verify-text-to-lattice-route-inventory.mjs` after Wrangler finishes.
Using the deployment token, that check resolves the active hah.dev zone and
requires this script to own exactly the four document routes above and the API
script to own exactly `hah.dev/api/lattice`, with neither script exposed through
a custom domain. It rejects missing, extra, stale wildcard, or malformed
inventory instead of inferring route absence from positive page probes.

The historical `hah.dev/api/text-to-lattice/lease` route and
`verify.hah.dev` custom domain are retired only during guarded qualification
activation, after their exact owners and addresses pass a read-only preflight.
The retirement operation detaches only those two entry surfaces. It preserves
the legacy Worker scripts, Durable Object storage, and other state, refuses an
owner mismatch or undeclared extra surface, and records sanitized evidence.
Held publication may inventory either surface as retirement-required; an
exposed qualification client fails validation unless both are detached.
