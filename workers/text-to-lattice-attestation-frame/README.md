# Text to Lattice attestation frame

This static origin confines Cloudflare Turnstile to `https://verify.hah.dev/turnstile/`. The résumé page embeds the frame cross-origin; the Turnstile runtime therefore cannot read the résumé DOM or the user's source text under the browser same-origin policy.

The frame receives only a public Turnstile site key, widget size, and single-use random correlation ID. It returns only lifecycle signals or the bounded Turnstile token. Both sides require an exact origin, the expected window, a closed message schema, protocol version, and matching correlation ID. The parent removes the frame and its third-party execution context on success, error, timeout, or cancellation.

## Production prerequisites

1. Create a dedicated Turnstile widget whose hostname allowlist contains exactly `verify.hah.dev`. Do not add `hah.dev` to that widget.
2. Store `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` as encrypted bindings for the lease Worker. The site key is public by design but is not committed here; the secret key must never enter this static project or the browser bundle.
3. Bind the static-assets project to the `verify.hah.dev` custom domain and deploy from this directory. The checked-in Wrangler configuration contains no account identifier or credential.
4. At the `hah.dev` response-header/CDN layer, add `https://verify.hah.dev` to `frame-src` and disable `document-domain` through `Permissions-Policy`. Do not add `https://challenges.cloudflare.com` to the main page's `script-src`; only this isolated frame needs Cloudflare's runtime and challenge origins.
5. Confirm that the deployed `_headers` policy is present on `/turnstile/`
   responses, then test a real interactive challenge from the official parent
   with keyboard navigation and a screen reader. Before first activation, carry
   its token through the complete acquisition, delayed successful renewal, and
   release trace required by the lease Worker runbook; a frame-only success does
   not establish that the site key and validation secret belong to one working
   widget.

The public parent and frame share a versioned message schema but deploy
separately. A breaking bridge change must continue accepting the currently
published parent protocol until that client is retired, or use a new versioned
frame path. Record the current frame and lease deployment identifiers and tested
rollback order before changing this contract; if a later step fails, restore a
frame compatible with the public parent rather than leaving a partial rollout.

The main site is statically exported to GitHub Pages, so its CSP cannot be represented reliably in `next.config.ts`; the main-site `frame-src` allowance is a hosting prerequisite. The frame itself uses Cloudflare Workers Static Assets and invokes no Worker script. Cloudflare documents static asset requests as free and unlimited, so the frame adds no calls to the lease Worker's daily request or Durable Object budget. If routing is later changed to execute Worker code for each frame GET, those GETs must be included in the free-tier budget before deployment.

Cloudflare remains the verification provider and network/TLS operator for this origin and receives the normal Turnstile signals described in its [Privacy Addendum](https://www.cloudflare.com/turnstile-privacy-policy/). Origin isolation prevents its browser runtime from reading the parent page; it does not remove Cloudflare from that infrastructure trust boundary. See Cloudflare's documentation for [client-side rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/), [hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/), [Content Security Policy](https://developers.cloudflare.com/turnstile/reference/content-security-policy/), and [server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

A sandboxed frame served from `hah.dev` without `allow-same-origin` is not an equivalent fallback. It receives an opaque origin, which turns its outbound message origin into `null`, forces the parent to use a wildcard target for messages into the frame, denies ordinary origin storage, and may prevent Turnstile from issuing a token for the configured hostname. Adding `allow-same-origin` to a same-origin scripted frame restores parent DOM access and defeats the isolation. The dedicated origin preserves an exact two-origin protocol while allowing Turnstile's documented browser flow.

No user text, sample text, secrets, generated output, or analytics belong in this project.
