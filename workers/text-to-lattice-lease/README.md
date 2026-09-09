# Text to Lattice usage lease

Text to Lattice inference stays inside the browser. The official hah.dev client
asks this Worker to authorize a bounded portfolio-demonstration run through a
bodyless API schema with no source, answer, prompt, candidate, result, word
count, register, or genre field.

## Policy

- Three grants per pseudonymous browser in a rolling 24-hour window.
- Forty actionable POST, PATCH, or DELETE requests service-wide in a
  rolling 60-second window, admitted before Siteverify or lifecycle work.
- Three thousand actionable requests service-wide per UTC calendar day, aligned
  with the provider's Free-plan reset and enforced before downstream work.
- Eight otherwise grant-eligible acquisition attempts service-wide in a rolling
  60-second window.
- One hundred grants service-wide in a rolling 24-hour window.
- Eight active leases service-wide, with at most one active lease per
  pseudonymous browser.
- Forty-five-minute idle expiry, renewed by the active client every ten minutes.
- Five-minute minimum between accepted renewals and a four-hour absolute run lifetime.

The official interface describes the tool as a portfolio demonstration, not a
copywriting, fiction-writing, or nonfiction-writing service. These quotas bound
official grants. The exact global limits remain the grant and concurrency
backstop for the official API when a browser pseudonym changes. Free-plan
fail-closed exhaustion, not the grant counters, is the monetary boundary.

Every acquisition also requires a fresh Cloudflare Turnstile attestation. A
bodyless cookie/challenge response is established after request validation,
configuration checks, and local shaping, but before the singleton is called.
The Worker validates a returned token server-side after exact minute and daily
request admission and before grant accounting, and requires the
`verify.hah.dev` hostname, `text_to_lattice` action, five-minute validity window, and
single-use result. The token is capped at 2,048 characters and travels only in
an acquisition header. The official frame bridge places no source or generated
text in that token. Origin and Fetch Metadata checks remain CSRF controls, not
authentication substitutes.

The Turnstile browser runtime is confined to a dedicated cross-origin static
frame at `https://verify.hah.dev/turnstile/`; it is never loaded into the
résumé document. The frame receives only the public site key, widget size, and
a random single-request correlation identifier. Browser same-origin isolation
prevents the provider runtime from reading the parent DOM. The versioned
message bridge checks the exact origin, exact `Window`, closed schema, and
correlation identifier in both directions, and the parent destroys the frame
on success, error, timeout, or cancellation.

One globally named SQLite Durable Object serializes exact request admission and
lease decisions. After request-safety checks, authenticated-control credential
validation, cheap acquisition challenge establishment, and location shaping,
its `/admit` transition admits at most 40 actionable POST, PATCH, or DELETE
requests in a rolling minute and 3,000 per UTC calendar day. That transition
runs before a POST can invoke Turnstile Siteverify and before any acquire,
renew, or release action. A request rejected by either exact boundary receives
a bounded `Retry-After` estimate, including the next UTC reset for the daily
boundary. Hostile actionable requests that reach it still consume a public
Worker request and an admission Durable Object request; the boundary limits
downstream work but cannot erase that cost. Requests that only establish the
signed browser cookie or request an attestation never read or write singleton
state.

Cloudflare's
[location-local, permissive, eventually consistent Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
first shapes the exact route at 40 calls per minute before query, method, body,
credential, or configuration work. Independent namespaces then keep
the 24-POST/60-second acquisition counter from consuming either the
12-PATCH/60-second renewal counter or the 20-DELETE/60-second release counter.
Two additional namespaces permit four PATCHes and four DELETEs per signed lease
per 60 seconds in each location. They run before their shared method counters,
so replay pressure from one lease cannot consume all local renewal or release
capacity. A sixth combined namespace runs after actor and method shaping and
admits 40 calls per minute at one location, preventing the independent method
counters from adding into an unbudgeted sustained rate. All seven bindings are
load shedders, not quota authorities.

The public bearer is `l1.<opaque-id>.<absolute-expiry>.<HMAC>`. Its 192-bit
identifier, canonical encoding, signed expiry, and domain-separated HMAC are
verified before either control shaper or the Durable Object. The Durable Object
stores only the opaque identifier. Consequently, an arbitrary token-shaped
string cannot consume control-shaper or Durable Object capacity. Possession of
a valid unexpired bearer remains authority, so the per-lease shaper bounds
replay in each location and the exact lifecycle transition remains global.

The method margins are deliberate. In one 60-second window, eight validated
acquisitions require at most `8 × 2 = 16` POSTs (one cookie/challenge request
and one attested retry each). Eight newly granted leases plus eight leases
carried into the window can require at most `8 + 8 = 16` DELETEs. The
independent limits therefore leave eight POST and four DELETE calls of margin.
No more than eight active leases can heartbeat at once, so the PATCH limit
leaves four calls of margin. The complete 40-call public burst exactly fills the
ingress and combined shapers: 8 challenge POSTs return before the singleton, so
only 32 calls cross exact admission and leave eight calls of exact-gate margin.
The edge threshold also retains eight calls of margin. At the active cap, eight
simultaneous first-time browsers use sixteen POSTs and eight DELETEs; their
releases cannot be crowded out by the acquisition counter.

Renewal is an exact Durable Object transition, not merely a client timer. The
active token must exist, must not have reached its idle expiry, and must be at
least five minutes past its last accepted renewal. An accepted PATCH extends
idle expiry by at most another 45 minutes and never beyond four hours from the
original grant. It does not add an acquisition attempt or grant.

The browser deduplicates concurrent release work and tracks each cleanup from
its start for two release-shaper windows. Its bounded map is derived from the
documented 16-call legitimate release burst, so all 32 distinct releases
across two consecutive retained windows can reach the API without an older
cleanup record displacing or blocking a legitimate release.

New lease records bind their opaque identifier to the owning opaque visitor
identifier, enforcing one active lease per browser. Older state versions did
not retain that relation. Migration therefore keeps an active legacy record
ownerless rather than guessing; it continues to consume service-wide capacity
and temporarily blocks new grants with an expiry-based `Retry-After` estimate
until it is released or expires. Renew and release remain available to its
authenticated bearer during that bounded transition.

Versions 1–3 predate the UTC-day admission counter, so no daily count exists to
recover from those schemas. Their first version-4 mutation therefore persists
a saturated current-day counter and refuses exact admission until 00:00 UTC;
legacy state can never be reinterpreted as zero use. Any future live schema
migration must preserve the version-4 `admissionDay` record exactly. Missing,
malformed, unaligned, or zero-count version-4 records fail validation rather
than silently resetting the budget.

Denied unknown control identifiers and other true no-ops do not rewrite usage
state or its alarm. If the same request also discovers expired state, that
pruning is persisted atomically; later repeats are write-free.

A zone-level edge rate-limit/WAF rule is also a deployment prerequisite because
rejected or malicious traffic still consumes Worker requests. The
Free-plan-compatible rule is deliberately path-only (the Free rule expression
does not expose the HTTP method):

- Match Path exactly `/api/text-to-lattice/lease`.
- Count by IP.
- Permit 48 requests per 10 seconds.
- Block for 10 seconds after the threshold.

Those periods follow the current
[Cloudflare Free availability boundary](https://developers.cloudflare.com/waf/rate-limiting-rules/#availability),
which exposes one rule and limits both its counting period and mitigation
timeout to 10 seconds. A longer timeout must not be represented as part of the
Free deployment.

The path-only rule must also admit the worst documented legitimate same-IP
burst: 16 cold-start POSTs, 8 new-lease releases, 8 carried-lease releases,
and 8 simultaneous renewal heartbeats total 40 calls,
leaving eight calls of margin at the 48-call threshold. This permits ordinary cookie establishment, acquisition,
cancellation, and release while shedding a simple single-source burst before the Worker. Free
WAF counters are per IP and are not exact global accounting; the Durable Object
continues to enforce the exact multi-user limits. Distributed abuse, replay
from multiple Cloudflare locations, and the documented counter-update delay
mean no application rule can guarantee that a free allocation will never be
exhausted. On Workers Free, exhaustion fails closed rather than becoming an
unbounded paid service.

## Free-tier budget

Cloudflare currently documents daily Free-plan allowances of
[100,000 Worker requests](https://developers.cloudflare.com/workers/platform/limits/)
and [100,000 SQLite Durable Object requests, 5,000,000 rows read, and 100,000
rows written, plus 13,000 GB-s of Durable Object duration](https://developers.cloudflare.com/durable-objects/platform/pricing/).
At the five-minute server minimum, one continuously occupied active slot can
accept at most `86,400 ÷ 300 = 288` renewals in one UTC day, including a renewal
at the opening boundary by a carried lease. Eight slots therefore admit at most
`8 × 288 = 2,304` renewals, regardless of how many leases rotate through them.
Adding at most 100 new grants and 108 releases (100 new leases plus eight carried
leases) produces a protocol ceiling of 2,512 accepted lifecycle actions. The
one cheap challenge response per new grant raises the public Worker ceiling for
that accepted protocol traffic to 2,612 calls, while its admission and action
calls total `2,512 + 2,512 = 5,024` direct Durable Object requests. The 3,000
UTC-day admission boundary retains 488 actions, or 19.4% over that concurrency-
tight protocol ceiling. An individual four-hour lease can still accept at most
`(240 ÷ 5) − 1 = 47` renewals; multiplying that per-lease bound by 100 would
ignore the eight-slot service-wide constraint and is not used for budgeting.

The operational guard is budgeted independently of successful grants. At one
location, the nominal configured rate is `40 × 60 × 24 = 57,600` successful
ingress and combined-shaper decisions per day. In the scoped worst case, all
57,600 reach the singleton admission endpoint, but the exact UTC-day gate
permits only 3,000 to reach a primary lifecycle action. For capacity planning,
the calculation assumes an admitted handler reaches its lifecycle action within
60 seconds. Under that measured-operating assumption, budget 40 actions admitted
during the prior rolling minute across the UTC boundary, for 3,040 primary
action calls. Cloudflare does not provide a contractual wall-time ceiling for a
connected HTTP invocation, so 40 is a budgeting allowance rather than an
application-enforced hard maximum; deployment must measure this latency and
recalculate the allowance if it can be exceeded. The defensive release path is
charged once for every one of those calls—not merely for successful grants—even
though denied acquisitions cannot have created a lease. That deliberately
conservative charge produces `3,040 + 3,040 = 6,080` lifecycle calls.

Alarm requests are included explicitly, including Cloudflare's documented
[at-least-once delivery and up to six retries](https://developers.cloudflare.com/durable-objects/api/alarms/).
A UTC day is therefore budgeted for 3,000 current-day request expiries, 40
request expiries carried from the prior minute under the same latency
assumption, 100 attempt expiries under the rolling grant limit, 100 paired
grant/visitor expiries from the prior rolling day, 108 lease expiries, and one
UTC rollover: 3,349 underlying expiry moments. Exact
decisions still prune those millisecond timestamps on every request, while
retention alarms are rounded up to UTC minute boundaries. A singleton can
therefore schedule at most 1,440 alarm buckets in a UTC day. Charging seven
invocations to every bucket gives 10,080 calls. Only one alarm can be scheduled
at a time, so at most one prior-day retry sequence can remain in flight at the
boundary; charging all seven attempts again yields 10,087 alarm invocations.
Thus the scoped Durable Object total is
`57,600 admissions + 6,080 lifecycle calls + 10,087 alarms = 73,767`, leaving
26,233 requests of daily headroom.

Row writes are bounded separately. Conservatively charge all 3,000 admission
mutations, all 3,040 primary action calls, all 3,040 compensating releases, all
3,349 underlying expiry moments again as request-triggered pruning mutations,
and all 10,087 alarm invocations as state-changing: 22,516 transactions. This
double-charges expiry cleanup through both request and alarm paths, and charges
rolled-back alarm retries as writes. Each transaction performs
at most one state-row operation (`put` or `delete`) and one alarm-row operation
(`setAlarm` or `deleteAlarm`, including final cleanup). Therefore
`2 × 22,516 = 45,032` rows are written, leaving 54,968. One state-key read per
Durable Object request gives at most 73,767 rows read, leaving 4,926,233.

Duration is statically bounded for this topology as well: one globally named
Durable Object has 128 MB, billed as 0.128 GB of allocated memory. Even if that
one singleton remained active for all 86,400 seconds, `0.128 × 86,400 = 11,059.2`
GB-s, leaving `13,000 − 11,059.2 = 1,940.8` GB-s of Free-plan duration headroom.
Actual activity should be lower; other Durable Objects on the account consume
the same allocation.

These are deliberately conservative bounds inside the named, single-location
nominal scenario, not a distributed-abuse or total Worker-request guarantee.
Every request denied by the in-Worker ingress shaper has already consumed a
Worker invocation. Worker rate-limit bindings and the WAF rule are location- or
IP-local and permissive; counter overshoot, traffic spread across locations or
addresses, other account workloads, CPU, and real runtime require provider-side
measurement. A distributed hostile flood can exhaust the shared Free allocation
despite every application control. Free quota exhaustion remains fail closed.
Production enablement requires
cold/warm CPU tests and 24-hour request, alarm, row-read, row-write, and duration
measurement against the same account that will host the service.

The dedicated verification frame is delivered by a static-assets-only project
with no Worker script. Under Cloudflare's documented
[Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/),
static asset requests are free and unlimited, so those HTML, CSS, and JavaScript
GETs add zero Worker or Durable Object calls to these protocol and operational
maxima.
Changing that route to execute Worker code would invalidate this arithmetic and
requires a new budget review before deployment.

## Production boundary

hah.dev is currently exported to GitHub Pages, which cannot execute an API.
Deploy this Worker separately on the exact same-origin lease route declared in
`wrangler.jsonc`; sibling API paths and all public HTML, Markdown, JSON,
JSON-LD, sitemap, and llms GET paths continue to go directly to the static site
without invoking the Worker or passing through a usage gate.

Before enabling the static client:

1. Verify that `hah.dev` is an active Cloudflare zone and its DNS record is proxied.
2. Configure and verify the exact path-scoped edge rate-limit/WAF rule described above.
3. Create a dedicated Turnstile widget restricted to exactly `verify.hah.dev`.
   Keep the public site key in a Worker binding so it need not be committed;
   keep the validation key secret. The client and verifier require the
   `text_to_lattice` action.
4. Generate three independent values of at least 32 random bytes for the
   cookie, lease, and Turnstile validation domains. Obtain the widget's public
   site key separately. Store all four bindings as
   **Cloudflare encrypted Worker secrets**; do not reuse a secret between domains, put a production
   value in Wrangler `vars`, or commit it in `.env` or `.dev.vars`:

   ```sh
   npx wrangler@4.129.1 secret put VISITOR_COOKIE_SECRET --config workers/text-to-lattice-lease/wrangler.jsonc
   npx wrangler@4.129.1 secret put LEASE_CREDENTIAL_SECRET --config workers/text-to-lattice-lease/wrangler.jsonc
   npx wrangler@4.129.1 secret put TURNSTILE_SECRET_KEY --config workers/text-to-lattice-lease/wrangler.jsonc
   npx wrangler@4.129.1 secret put TURNSTILE_SITE_KEY --config workers/text-to-lattice-lease/wrangler.jsonc
   ```

   `VISITOR_COOKIE_SECRET` signs only the pseudonymous HttpOnly browser cookie.
   `LEASE_CREDENTIAL_SECRET` signs only expiry-bearing lease credentials.
   `TURNSTILE_SECRET_KEY` validates challenges; `TURNSTILE_SITE_KEY` is public
   by design but is delivered from its binding. The Worker rejects missing,
   short, invalid, or reused private secrets, and also rejects a public site key
   equal to any private secret. Configuration failures return its generic
   fail-closed `503` response.

5. Confirm all four encrypted bindings are present with `wrangler secret list`;
   that command reports names, never secret values. Deploy the Worker and its
   SQLite migration only from an approved revision. Verify
   that the route fails closed and does not pass API failures through to the
   GitHub Pages origin:

   ```sh
   npx wrangler@4.129.1 deploy --config workers/text-to-lattice-lease/wrangler.jsonc
   ```

6. Deploy the static-only project in
   `workers/text-to-lattice-attestation-frame/` at `verify.hah.dev`. At the
   `hah.dev` response-header/CDN layer, allow `https://verify.hah.dev` in the
   main page's `frame-src`; do not allow Cloudflare's challenge origin in the
   main page's `script-src`, and disable `document-domain` through
   `Permissions-Policy`. Confirm the frame's checked-in CSP and
   `frame-ancestors https://hah.dev` header on the deployed response. No account
   identifier, deploy credential, site key, or secret is committed by the
   static project.
7. Smoke-test bodyless same-origin acquisition and authenticated bodyless renewal
   and release; tampered, expired, and random bearer rejection before shaping;
   missing, replayed, expired, wrong-host, and wrong-action Turnstile rejection;
   exact-origin/source/schema frame-message rejection and keyboard access;
   request-body/query and forged-origin rejection; exact 40-request rolling and
   3,000-request UTC-day admission; 8-attempt and rolling grant limits; one-active-lease-per-browser and
   eight-lease concurrency; renewal minimum and absolute lifetime; every `429`
   response's `Retry-After` header, including proxy and HTTP-date forms; and
   configuration rejection when the public site-key binding equals any private
   secret.
8. Verify the enabled edge rule, exact Worker route and fail mode, seven distinct
   rate-limit bindings whose namespace identifiers are unused by every other
   Worker in the account, four secret binding names, and provider-side
   cold/warm request/CPU/storage/alarm measurements from the deployed revision.
9. Record release approval for the public verifier's use on arbitrary
   user-supplied prose under the Llama 3.2 Community License and Acceptable Use
   Policy. Also record either upstream license confirmation for the exact
   `binary-mlc-llm-libs` revision or the source revisions, license inventory,
   and reproducible build evidence for a replacement WASM. The Apache-2.0
   licenses on the WebLLM and MLC LLM source repositories do not, by
   themselves, establish the provenance of an otherwise unlicensed binary
   repository.
10. Only then publish the static client that requires the lease.

The three secret runtime values belong only in Cloudflare and should not be
duplicated into GitHub. The current GitHub Pages workflow uses GitHub’s
ephemeral permissions and needs no stored deployment credential. If Worker
deployment is automated later, keep a least-privilege `CLOUDFLARE_API_TOKEN`
in a protected GitHub environment secret; `CLOUDFLARE_ACCOUNT_ID` is an
identifier rather than secret material and can be an environment variable.
Never embed either value in a workflow or repository file.

The GitHub Pages workflow installs the locked dependency graph without lifecycle
scripts and uses no long-lived deploy credential. Local static preview does not
emulate the Durable Object: if capability checks are bypassed, acquisition fails
closed and the canonical semantic fallbacks remain available.

## Privacy and retention

Official-client acquisition, renewal, and release calls are bodyless and
suppress the referrer. The acquisition header carries only a short-lived
Turnstile token. Cloudflare
Turnstile separately processes the security signals described in its
[Privacy Addendum](https://www.cloudflare.com/turnstile-privacy-policy/),
including IP address, TLS fingerprint, user-agent, site key, and the dedicated
verification origin. The provider runtime runs only in the isolated frame and
the official bridge never sends it source, clarification, prompt, result,
register, or genre, or places source or result in the token or validation
request. The gate stores
an HMAC-signed opaque, host-only `__Secure-` browser cookie scoped to
`/api/text-to-lattice`, its opaque identifier and grant
timestamps, aggregate request/attempt/grant timestamps, and opaque active-lease
identifiers associated with the owning opaque visitor identifier.
It does not write IP addresses, user-agent strings, referrers, source text, or
results to application storage, and Worker observability is disabled. Cloudflare
may still process request, security, and recovery metadata under its service terms.

On the first bodyless acquisition request, the Worker sets the signed cookie,
returns the public Turnstile site key with `428`, and the client retries once
with a fresh attestation header and without adding a body. That cheap challenge
is locally shaped but never calls the singleton; the attested retry crosses the
exact minute and UTC-day admissions before Siteverify. A browser that
does not retain the cookie fails closed. Every valid acquisition decision
refreshes the same opaque identity for another 24 hours. The Durable Object
signs that stable refresh within its
acquisition transaction before the decision is committed. Refresh values for
one pseudonym are identical, so delayed or out-of-order responses cannot replace
a newer identity with one that expires sooner; the browser's 24-hour `Max-Age`
controls ordinary retention. Manually replaying an older valid value resumes the
same pseudonym and gains no new per-visitor capacity. Absence or deliberate
clearing still creates a new pseudonym, which is why the exact shared limits
remain authoritative. The Durable Object also signs the expiry-bearing lease
credential inside that transaction. Its expiry and the lease's absolute maximum
derive from the same decision timestamp. The outer Worker verifies the returned
HMAC, opaque identifier, and exact maximum before it discloses the bearer, so
either signature must finish before a grant can be committed.

Turnstile, the visitor cookie, and the quota gate protect the official hah.dev
interface. Because the engine and pinned models are public client-side assets,
a modified client can use them without calling this lease API; no UI quota can
turn public model downloads into a private service boundary.

Every exact decision treats request and attempt timestamps as expired after 60
seconds, the fixed admission budget as expired at the next UTC-day boundary,
browser and grant timestamps as expired at the rolling 24-hour boundary,
inactive leases as expired after 45 minutes, and actively renewed leases as
expired no later than the four-hour absolute maximum. Background cleanup rounds
the first pending expiry up to the next UTC minute, making the normal
application-visible retention targets 120 seconds, 24 hours plus 60 seconds, 46
minutes for an inactive lease, and four hours plus 60 seconds for a continuously
renewed lease. Cloudflare may delay alarms further during maintenance or failure
handling; a later request still applies exact expiry before making a decision.
Deleted state may remain in Cloudflare-managed SQLite
point-in-time recovery history under Cloudflare's provider retention terms.

Every state-changing acquisition, renewal, release, pruning pass, and alarm
cleanup writes its usage state and corresponding next alarm inside one
SQLite-backed Durable Object storage transaction. True no-ops are write-free.
Cloudflare's [SQLite transaction semantics](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/#transaction)
include direct `ctx.storage` operations in the transaction; this permits the
top-level alarm operation and state write to commit or roll back together.
If setting or deleting the alarm fails, that transaction rolls back the state
mutation and the Worker fails closed; it cannot disclose an untracked grant,
consume a hidden concurrency slot, or acknowledge an unscheduled renewal or
release.
