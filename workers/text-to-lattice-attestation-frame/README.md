# Text to Lattice attestation frame

This static origin confines Cloudflare Turnstile to `https://verify.hah.dev/turnstile/`. The résumé page embeds the frame cross-origin; the Turnstile runtime therefore cannot read the résumé DOM or the user's source text under the browser same-origin policy.

The frame receives only a public Turnstile site key, widget size, and single-use random correlation ID. It returns only lifecycle signals or the bounded Turnstile token. Both sides require an exact origin, the expected window, a closed message schema, protocol version, and matching correlation ID. The parent removes the frame and its third-party execution context on success, error, timeout, or cancellation.

## Credential profiles

The preferred production anti-bot profile uses a real Turnstile widget pair
restricted to exactly `verify.hah.dev` and the `text_to_lattice` action. The
bounded demonstration profile instead uses Cloudflare's exact published testing
site and secret pair from the lease Worker's `demonstrationProfile.js`. The
official canonical browser flow can exercise Cloudflare's widget and Siteverify
endpoints through this isolated frame. A direct server probe can submit the same
public dummy token without this frame, so its success proves only the Siteverify,
lease, and release path—not widget participation. The pair is intentionally public
and provides no proof that the visitor is human, no hostname-bound assurance, and
no production anti-bot protection. It is a declared integration profile, not an
alternate endpoint, unsigned assertion, or project-defined bypass protocol.

The lease Worker recognizes only the exact provider-published testing secret,
and that branch accepts only the exact provider-published dummy token. The
Siteverify response must still have a bounded age, but the dummy token is
reusable and therefore provides no freshness, single-use, hostname, or action
assurance. Exact parent/frame origins and window identity, correlation, bodyless
acquisition, signed browser identity, global admission, lease limits, and privacy
boundaries remain unchanged. A production widget pair restores fresh single-use
token validation plus hostname and action checks. Replacing either complete
profile with the other is a release-boundary change and requires the same live
qualification and rollback checks.

## Deployment prerequisites

1. Prefer a dedicated Turnstile widget whose hostname allowlist contains exactly
   `verify.hah.dev`. Do not add `hah.dev` to that widget. If the demonstrable
   release uses the official testing pair instead, keep that fact explicit and
   do not describe the resulting interaction as anti-bot protected.
2. Store the selected complete pair as `TURNSTILE_SITE_KEY` and
   `TURNSTILE_SECRET_KEY` bindings for the lease Worker. A production secret must
   never enter this static project or the browser bundle. The official testing
   pair is public and checked in deliberately so its weaker assurance is
   reviewable; putting it in encrypted bindings does not make it secret.
   The current demonstrable-release workflow requires the exact official testing
   site key and dummy-token lifecycle. It preserves any different complete pair
   but fails its live profile check until the workflow, register, and qualification
   are intentionally changed for that profile.
3. Bind the static-assets project to the `verify.hah.dev` custom domain and deploy from this directory. The checked-in Wrangler configuration contains no account identifier or credential.
4. Deploy `workers/text-to-lattice-response-policy/` on the four exact
   `hah.dev` routes `/`, `/index.html`, `/resume/`, and
   `/resume/index.html`. That Worker proxies the GitHub Pages response and sets
   the qualified CSP and `Permissions-Policy: document-domain=()`; unrelated
   pages, assets, and arbitrary paths do not invoke it. The document carries
   the same CSP as a meta fallback for legacy query-state and origin-preview
   contexts. The Worker has no bindings, storage, telemetry, content inspection,
   or observability.
   The canonical launch is `https://hah.dev/resume/#text-to-lattice`; the
   fragment is client-side state and leaves the protected `/resume/` request
   unchanged.
   Do not add `https://challenges.cloudflare.com` to the main page's
   `script-src`; only this isolated frame needs Cloudflare's runtime and
   challenge origins.
5. Confirm that the deployed `_headers` policy is present on `/turnstile/`
   responses, then test the declared profile from the official parent with
   keyboard navigation and a screen reader. In the first activation session,
   carry its token through the `200` acquisition, `204` release, and two-origin
   privacy trace required by the lease Worker runbook; a frame-only success does
   not establish the complete widget-to-lease path. Under the official testing
   profile, this evidence establishes integration and privacy behavior only—not
   bot resistance. Record a real renewal when ordinary use naturally reaches its
   interval, but do not delay operational completion merely to manufacture that
   follow-up trace. Any failed acquisition or release, observed real renewal
   failure, or content-bearing trace still returns GATE-06 and the public client
   to the held documentation-only state.

For an enabled release, every push to `main` runs the protected Pages service
job. While the client is held, the same job runs only when the head commit says
`[deploy-text-to-lattice-services]` or an approved manual dispatch explicitly
requests it. The job deploys the exact response policy, then this frame and its
byte/header verification, then the lease Worker. It reads binding names without
exposing values, preserves a complete existing pair, generates only missing
independent signing secrets, and adds the exact official testing pair only when
both Turnstile bindings are absent and `--require-official-test-profile` is
present. Every missing binding is installed in one Wrangler `secret bulk`
operation. A one-sided Turnstile pair, unexpected binding, ambiguous bulk plan,
install failure, or live-probe failure stops the service job; the workflow does
not silently mix or overwrite credential profiles. The following exact site-key
and dummy-token probes reject a preserved non-demonstration pair for this release;
they do not expose or overwrite it.
The same protected job reads the hah.dev zone route inventory and rejects any
missing, extra, or stale wildcard route owned by the response-policy or lease
Worker before it runs the public probes.

The public parent and frame share a versioned message schema but deploy
separately. A breaking bridge change must continue accepting the currently
published parent protocol until that client is retired, or use a new versioned
frame path. Record the current frame and lease deployment identifiers and tested
rollback order before changing this contract; if a later step fails, restore a
frame compatible with the public parent rather than leaving a partial rollout.

The main site is statically exported to GitHub Pages, so its CSP cannot be represented reliably in `next.config.ts`; the exact response-policy Worker supplies that hosting boundary. The frame itself uses Cloudflare Workers Static Assets and invokes no Worker script. Cloudflare documents static asset requests as free and unlimited, so the frame adds no calls to the lease Worker's daily request or Durable Object budget. If routing is later changed to execute Worker code for each frame GET, those GETs must be included in the free-tier budget before deployment.

Cloudflare remains the verification provider and network/TLS operator for this origin and receives the normal Turnstile signals described in its [Privacy Addendum](https://www.cloudflare.com/turnstile-privacy-policy/). Origin isolation prevents its browser runtime from reading the parent page; it does not remove Cloudflare from that infrastructure trust boundary. See Cloudflare's documentation for [client-side rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/), [hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/), [Content Security Policy](https://developers.cloudflare.com/turnstile/reference/content-security-policy/), and [server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

A sandboxed frame served from `hah.dev` without `allow-same-origin` is not an equivalent fallback. It receives an opaque origin, which turns its outbound message origin into `null`, forces the parent to use a wildcard target for messages into the frame, denies ordinary origin storage, and may prevent Turnstile from issuing a token for the configured hostname. Adding `allow-same-origin` to a same-origin scripted frame restores parent DOM access and defeats the isolation. The dedicated origin preserves an exact two-origin protocol while allowing Turnstile's documented browser flow.

No user text, sample text, secrets, generated output, or analytics belong in this project.
