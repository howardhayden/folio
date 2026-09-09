import { SiteHeader } from "../../../components/SiteChrome";
import { textToLatticeContract } from "../../../content/textToLatticeContent.js";
import { LATTICE_DOCUMENTATION_RESOURCES, projectBySlug } from "../../../resume/projects.js";
import { JsonLd } from "../../../semantic/JsonLd";
import { semanticMetadata } from "../../../semantic/metadata";
import { jsonLdForPage } from "../../../semantic/portfolio.js";

export const metadata = semanticMetadata(
  textToLatticeContract.name,
  textToLatticeContract.purpose,
  textToLatticeContract.canonicalPath,
);

export default function TextToLatticePage() {
  const security = textToLatticeContract.securityAndPrivacy;
  const policy = textToLatticeContract.usagePolicy;
  const latticeProject = projectBySlug("lattice");
  const interactiveRelease = latticeProject && "interactiveRelease" in latticeProject
    ? latticeProject.interactiveRelease
    : "not-applicable";
  const releaseHeld = interactiveRelease === "held";

  return (
    <>
      <JsonLd value={jsonLdForPage(textToLatticeContract.canonicalPath)} />
      <SiteHeader />
      <main className="container mt-4 page-view semantic-page" data-page-view="text-to-lattice">
        <article data-tool-id={textToLatticeContract.id}>
          <h1>{textToLatticeContract.name}</h1>
          <p className="lead">{textToLatticeContract.purpose}</p>

          <section className="lattice-release-hold" aria-labelledby="text-to-lattice-release-status">
            <h2 id="text-to-lattice-release-status">Release status: {interactiveRelease}</h2>
            {releaseHeld ? (
              <>
                <p>The completed interactive client is not in the public application bundle because GATE-02 is the sole open release blocker: the live lease service, verification origin, and response-policy boundary are not yet established. Model-behavior, provenance, accessibility, capacity, and privacy gaps remain visible as accepted residuals or bounded post-deployment verification; they are not represented as completed evidence.</p>
                <p>This hold preserves the implementation without representing source controls as deployed proof.</p>
              </>
            ) : (
              <>
                <p>The interactive client’s availability follows the machine-checked release record for this build.</p>
                <p><a href="/resume/?tool=text-to-lattice#project-lattice">Use Text to Lattice</a></p>
              </>
            )}
            <ul>
              <li><a href="/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-QUALIFICATION.md">Read the release qualification</a></li>
              <li><a href="/documentation/text-to-lattice/TEXT-TO-LATTICE-RELEASE-REGISTER.json">Inspect the machine-readable release register</a></li>
            </ul>
          </section>

          <h2>Documentation maps</h2>
          <p>Read the method and the demonstrator at their own boundaries.</p>
          <ul>
            {LATTICE_DOCUMENTATION_RESOURCES.map(({ label, url }) => (
              <li key={url}><a href={url}>{label}</a></li>
            ))}
          </ul>

          <h2>Input</h2>
          <p>{textToLatticeContract.input}</p>

          <h2>Output</h2>
          <p>{textToLatticeContract.output}</p>

          <h2>Process</h2>
          <ol>{textToLatticeContract.process.map((item) => <li key={item}>{item}</li>)}</ol>

          <h2>Constraints and limitations</h2>
          <ul>{textToLatticeContract.constraints.map((item) => <li key={item}>{item}</li>)}</ul>

          <section aria-labelledby="text-to-lattice-privacy-heading" id="text-to-lattice-privacy">
            <h2 id="text-to-lattice-privacy-heading">Privacy and upstream downloads</h2>
            <p>{security.huggingFace.summary}</p>
            <ul>{security.huggingFace.protections.map((item) => <li key={item}>{item}</li>)}</ul>
            <p>{security.huggingFace.residualDisclosure}</p>
            <h3>Hugging Face policies and documentation</h3>
            <ul>
              {security.huggingFace.sources.map((source) => (
                <li key={source.url}><a href={source.url}>{source.label}</a></li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="text-to-lattice-hardening">
            <h2 id="text-to-lattice-hardening">Input and model hardening</h2>
            <p>{security.inputHardening.summary}</p>
            <h3>Hard limits</h3>
            <ul>{security.inputHardening.limits.map((item) => <li key={item}>{item}</li>)}</ul>
            <h3>Isolation and validation</h3>
            <ul>{security.inputHardening.isolation.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>

          <section aria-labelledby="text-to-lattice-usage-heading" id="text-to-lattice-usage">
            <h2 id="text-to-lattice-usage-heading">Demonstration usage limits</h2>
            <p>{policy.purpose}</p>
            <dl className="paper-meta">
              <div className="paper-meta-item"><dt>Pseudonymous browser</dt><dd>{policy.visitor.limit} grants per rolling 24-hour window</dd></div>
              <div className="paper-meta-item"><dt>Shared request pace</dt><dd>{policy.globalRequests.limit} admitted API requests per rolling {policy.globalRequests.windowSeconds} seconds</dd></div>
              <div className="paper-meta-item"><dt>Shared daily request budget</dt><dd>{policy.globalDailyRequests.limit.toLocaleString("en-US")} actionable API requests per {policy.globalDailyRequests.window.toLowerCase()}</dd></div>
              <div className="paper-meta-item"><dt>Shared grant pace</dt><dd>{policy.globalAttempts.limit} otherwise eligible acquisition attempts per rolling {policy.globalAttempts.windowSeconds} seconds</dd></div>
              <div className="paper-meta-item"><dt>Shared daily grants</dt><dd>{policy.globalGrants.limit} grants per rolling 24-hour window</dd></div>
              <div className="paper-meta-item"><dt>Concurrent capacity</dt><dd>{policy.activeLeases.limit} active leases, at most {policy.activeLeases.perVisitorLimit} per browser; inactive leases expire after {policy.activeLeases.ttlSeconds / 60} minutes; every run ends within {policy.activeLeases.maximumLifetimeSeconds / 3_600} hours</dd></div>
            </dl>

            <details className="project-readme text-to-lattice-technical">
              <summary>API enforcement and free-tier basis</summary>
              <div className="project-readme-copy">
                <p>{security.api.summary}</p>
                <ul>{security.api.rules.map((item) => <li key={item}>{item}</li>)}</ul>
                <dl className="paper-meta">
                  <div className="paper-meta-item"><dt>Lease lifecycle</dt><dd>The client renews every {policy.activeLeases.renewalIntervalSeconds / 60} minutes; renewal is accepted no sooner than every {policy.activeLeases.minimumRenewalIntervalSeconds / 60} minutes. Inactive records target removal within {policy.activeLeases.applicationRetentionTargetSeconds / 60} minutes, and a continuously renewed run within {policy.activeLeases.maximumApplicationRetentionTargetSeconds / 3_600} hours.</dd></div>
                  <div className="paper-meta-item"><dt>Lease authentication</dt><dd>{policy.enforcement.leaseCredential.format}; {policy.enforcement.leaseCredential.validation}; {policy.enforcement.leaseCredential.storage}; {policy.enforcement.leaseCredential.keyManagement}</dd></div>
                  <div className="paper-meta-item"><dt>Human verification</dt><dd>{policy.enforcement.humanAttestation.role}. Hostname: {policy.enforcement.humanAttestation.hostname}; {policy.enforcement.humanAttestation.browserIsolation}; {policy.enforcement.humanAttestation.messageBoundary}.</dd></div>
                  <div className="paper-meta-item"><dt>Control shaping</dt><dd>Each authenticated lease may reach the location shapers at most {policy.enforcement.renewalLeaseLocationShaper.limit} times for renewal and {policy.enforcement.releaseLeaseLocationShaper.limit} times for release per {policy.enforcement.renewalLeaseLocationShaper.windowSeconds} seconds. These checks run before the shared PATCH and DELETE shapers.</dd></div>
                  <div className="paper-meta-item"><dt>Enforcement authority</dt><dd>{policy.enforcement.authority}. {policy.enforcement.exactRequestAdmission.role}. {policy.enforcement.exactDailyRequestAdmission.role}. The combined local shaper allows {policy.enforcement.pathLocationShaper.limit} calls per {policy.enforcement.pathLocationShaper.windowSeconds} seconds; the POST, PATCH, and DELETE shapers allow {policy.enforcement.locationShaper.limit}, {policy.enforcement.renewalLocationShaper.limit}, and {policy.enforcement.releaseLocationShaper.limit} calls in the same period in {policy.enforcement.locationShaper.scope}. They shed load rather than establish exact quota state.</dd></div>
                  <div className="paper-meta-item"><dt>Edge rule</dt><dd>A required {policy.enforcement.edgeFloodProtection.plan} rule limits the exact API path to {policy.enforcement.edgeFloodProtection.limit} calls per {policy.enforcement.edgeFloodProtection.windowSeconds} seconds per IP and blocks for {policy.enforcement.edgeFloodProtection.mitigationSeconds} seconds. It slows simple floods; it does not guarantee the provider budget against distributed hostile traffic.</dd></div>
                  <div className="paper-meta-item"><dt>Free-tier basis</dt><dd>As of {policy.freeTierBasis.asOf}, Cloudflare documents {policy.freeTierBasis.workerRequestsPerDay.toLocaleString("en-US")} Worker requests, {policy.freeTierBasis.durableObjectRequestsPerDay.toLocaleString("en-US")} Durable Object requests, {policy.freeTierBasis.durableObjectRowsWrittenPerDay.toLocaleString("en-US")} SQLite rows written, and {policy.freeTierBasis.durableObjectGigabyteSecondsPerDay.toLocaleString("en-US")} Durable Object GB-s per day. Eight continuously occupied slots can accept at most {policy.freeTierBasis.maximumAcceptedRenewalsPerUtcDayAtActiveCap.toLocaleString("en-US")} renewals per UTC day; with new grants and releases, the concurrency-tight protocol ceiling is {policy.freeTierBasis.maximumProtocolLifecycleActionsPerUtcDay.toLocaleString("en-US")} lifecycle actions, leaving {policy.freeTierBasis.protocolActionHeadroomUnderDailyAdmissionCap.toLocaleString("en-US")} actions below the exact daily admission cap. The nominal single-location scenario budgets {policy.freeTierBasis.maximumBudgetedAlarmInvocationsPerUtcDay.toLocaleString("en-US")} alarm invocations, including the documented retries and prior-day spill, and preserves {policy.freeTierBasis.durableObjectRequestHeadroomPerDay.toLocaleString("en-US")} Durable Object requests, {policy.freeTierBasis.durableObjectRowsWrittenHeadroomPerDay.toLocaleString("en-US")} row writes, and {policy.freeTierBasis.durableObjectRowsReadHeadroomPerDay.toLocaleString("en-US")} row reads. Even if the one {policy.freeTierBasis.durableObjectMemoryMegabytes} MB singleton remained active for every second of the day, it would use {policy.freeTierBasis.maximumSingletonDurationGigabyteSecondsPerDay.toLocaleString("en-US")} GB-s and retain {policy.freeTierBasis.durableObjectDurationHeadroomGigabyteSecondsPerDay.toLocaleString("en-US")} GB-s of duration headroom. In-Worker shaping cannot erase a billed Worker invocation, and neither it nor an IP-local WAF rule guarantees the aggregate Worker allowance; Free-plan exhaustion remains fail closed but can reduce availability. The verification frame adds {policy.freeTierBasis.verificationFrameWorkerCallsForDailyGrants} Worker calls under its static-only hosting contract. Distributed hostile traffic and permissive counter overshoot are additional. This is a {policy.freeTierBasis.scope}. {policy.freeTierBasis.exhaustionMode}. <a href={policy.freeTierBasis.workerLimitsUrl}>Worker limits</a>; <a href={policy.freeTierBasis.staticAssetsBillingUrl}>Static Assets billing</a>; <a href={policy.freeTierBasis.durableObjectPricingUrl}>Durable Object pricing</a>; <a href={policy.freeTierBasis.durableObjectAlarmsUrl}>Durable Object alarms</a>.</dd></div>
                  <div className="paper-meta-item"><dt>Failure mode</dt><dd>{policy.failureMode}</dd></div>
                </dl>
                <p>{security.api.limitation}</p>
                <ul>{security.api.sources.map((source) => <li key={source.url}><a href={source.url}>{source.label}</a></li>)}</ul>
                <p>Acquisition and lease-control requests are bodyless and same-origin. Acquisition alone carries a bounded Turnstile token. hah.dev sends no source, clarification, prompt, candidate, result, word count, register, or genre to the gate. The browser receives a pseudonymous signed HttpOnly cookie scoped to the API path; the gate retains bounded timestamps and opaque lease records. Cloudflare-managed point-in-time recovery may retain deleted SQLite state for up to {policy.providerRecoveryHistoryDays} days.</p>
              </div>
            </details>
          </section>

          <section aria-labelledby="text-to-lattice-output-handling">
            <h2 id="text-to-lattice-output-handling">Output handling</h2>
            <p>{security.outputProtection.summary}</p>
            <ul>{security.outputProtection.controls.map((item) => <li key={item}>{item}</li>)}</ul>
            <p>{security.outputProtection.limitation}</p>
          </section>

          <section aria-labelledby="text-to-lattice-availability" data-tool-availability="progressive-enhancement">
            <h2 id="text-to-lattice-availability">Availability and fallback</h2>
            <p>{releaseHeld
              ? "The interactive converter is a completed, optional enhancement presently held outside the public bundle by the open production-origin and secret-boundary gate."
              : "The interactive converter is an optional progressive enhancement."} The Lattice project title remains a native link to the canonical Lattice project record. Its icon leads to this contract while the client is held or JavaScript is unavailable; in an enabled JavaScript release, that icon alone opens the converter.</p>
            <ul>
              <li>{releaseHeld
                ? "Without JavaScript—and with JavaScript while this release is held—the project title remains an ordinary link to Lattice and its icon links to this contract; no text-entry interface is published."
                : "Without JavaScript, the project title remains an ordinary link to Lattice and its icon links to this contract; no text-entry interface is rendered."}</li>
              <li>{releaseHeld ? "When a later release is enabled, absence" : "Absence"} of secure-context WebGPU support makes the dialog identify the missing capability and disable conversion.</li>
              <li>{releaseHeld ? "When enabled, absence" : "Absence"} of uncached pinned model assets stops conversion without presenting the source as transformed text.</li>
            </ul>
            <p>The portfolio’s public HTML, <a href="/projects.json">project manifest</a>, <a href="/knowledge-graph.jsonld">knowledge graph</a>, and <a href="/content/projects/lattice.md">canonical project Markdown</a> do not depend on the local inference engine.</p>
            <noscript><p className="lattice-noscript-note">JavaScript is disabled. The complete public contract remains on this page.</p></noscript>
          </section>

          <h2>Local implementation provenance</h2>
          <dl className="paper-meta">
            <div className="paper-meta-item"><dt>Generator</dt><dd><a href={textToLatticeContract.implementation.generator.revisionUrl}>{textToLatticeContract.implementation.generator.name}</a>, revision {textToLatticeContract.implementation.generator.revision}; {textToLatticeContract.implementation.generator.inferenceSummary}</dd></div>
            <div className="paper-meta-item"><dt>Verifier</dt><dd><a href={textToLatticeContract.implementation.verifier.revisionUrl}>{textToLatticeContract.implementation.verifier.name}</a>, revision {textToLatticeContract.implementation.verifier.revision}; deterministic decoding with fixed seed {textToLatticeContract.implementation.verifier.inference.seed}</dd></div>
            <div className="paper-meta-item"><dt>Runtime</dt><dd><a href={textToLatticeContract.implementation.runtime.documentationUrl}>{textToLatticeContract.implementation.runtime.name} {textToLatticeContract.implementation.runtime.version}</a> (<a href={textToLatticeContract.implementation.runtime.repository}>source</a>); {textToLatticeContract.implementation.runtime.tokenizerName} {textToLatticeContract.implementation.runtime.tokenizerVersion}; <a href={textToLatticeContract.implementation.runtime.structuredOutputPackageUrl}>{textToLatticeContract.implementation.runtime.structuredOutputName} {textToLatticeContract.implementation.runtime.structuredOutputVersion}</a> for constrained JSON; <a href={textToLatticeContract.implementation.runtime.wasmRepository}>model-library WASM revision {textToLatticeContract.implementation.runtime.wasmRevision}</a>. {textToLatticeContract.implementation.runtime.wasmLicenseStatus}</dd></div>
          </dl>
          <p>Model-assisted result design: Qwen drafts locally and Llama 3.2 checks locally. Local checks can miss altered, omitted, biased, or unsafe meaning; every result requires review before reliance. Built with Llama. Llama 3.2 is licensed under the <a href={textToLatticeContract.implementation.verifier.licenseUrl}>Llama 3.2 Community License</a> and <a href={textToLatticeContract.implementation.verifier.acceptableUseUrl}>Acceptable Use Policy</a>, Copyright © Meta Platforms, Inc. All Rights Reserved.</p>
          <p><a href="/third-party-notices/">Third-party notices and local license copies</a>.</p>
          <p><a href="/resume/#projects-title">Return to the Lattice project card</a>.</p>
          <p><a href="/projects/lattice/">Read the canonical Lattice project record</a>.</p>
        </article>
      </main>
    </>
  );
}
