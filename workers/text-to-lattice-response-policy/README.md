# Text to Lattice response policy

This Worker is the bounded fallback for response-header controls that the
GitHub Pages origin cannot emit. It proxies the existing `hah.dev` origin and
adds the qualified Content Security Policy and `Permissions-Policy` only to
the four résumé document aliases used by Text to Lattice. Its four exact
Cloudflare routes are `/`, `/index.html`, `/resume/`, and
`/resume/index.html`; it is not attached to `hah.dev/*`. The normal stately
résumé and Text to Lattice launch links use fragments, which never reach the
server, so they retain an exact document route. Other paths bypass this Worker
entirely, and the lease route remains owned by the lease Worker.

The document also carries the same CSP as a meta fallback for legacy query
state and origin-preview contexts; the HTTP response remains authoritative on
the four supported public aliases and uniquely supplies `Permissions-Policy`.
The Worker repeats the exact-path check as defense in depth. It has no bindings,
storage, telemetry, or content inspection, and observability is disabled. This
route shape avoids coupling unrelated portfolio traffic and arbitrary paths to
the Text to Lattice Worker allowance.

The protected deployment runs
`scripts/verify-text-to-lattice-route-inventory.mjs` after Wrangler finishes.
Using the deployment token, that check resolves the active hah.dev zone and
requires this script to own exactly the four routes above and the lease script
to own only its exact API route. It rejects missing, extra, stale wildcard, or
malformed inventory instead of inferring route absence from the four positive
page probes.
