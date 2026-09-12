# VSCodium testing guide

This archive is a source candidate. It does not deploy or alter `hah.dev`.

## Prerequisites

- VSCodium
- Node.js 22.13.0 or newer
- npm

## Install and verify

Open the extracted folder in VSCodium, then run these commands in its terminal:

```bash
npm ci --ignore-scripts
npm run lint
npm test
```

`npm test` performs the production export, release-boundary checks, type checking,
worker-runtime checks, and the complete test suite.

## Run the local site

```bash
npm run dev -- --host 127.0.0.1
```

Open the URL Vite prints, normally `http://127.0.0.1:5173/`.

## Focused checks

### Resume Search

1. Open `/resume/` and confirm the centered input under **Resume** has the
   placeholder **Search**.
2. Try exact queries such as `accessibility`, ontology queries such as
   `information architecture`, and safe typos such as `accesibility` and
   `infrmation architecture`. Confirm `shift work`, `night shift`, `long
   shifts`, and `12-hour shift` retrieve **Corrections Officer**; try
   `sofwtare`, `informtion`, `accesib`, and `offcier` as progressive typo cases.
   Confirm `thin blue line` and `first responder` retrieve **Corrections
   Officer**; `government` retrieves **Corrections Officer**, **Officer
   Candidate**, and **University of Tartu**; and `wargaming` retrieves **FOG OF
   SEA** and the King’s College London record.
3. Try a deliberately ambiguous short typo. It must not guess between nearby
   concepts.
4. Confirm result groups remain ordered Projects, Experiences, Skills, then
   Education.
5. Open a same-page result. Search should close, the canonical résumé should
   return, and focus/scroll should reach the result target.
6. Press Escape or use **Close** and confirm the previous résumé state is
   restored.
7. With one short result, confirm the page ends with the visible results rather
   than retaining the full hidden résumé scroll length. Rapidly close and
   refocus Search; the transition must reverse without a jump or stuck blur.
8. Confirm `work` does not return Medium; `UX` and `Information Architecture`
   do not return Officer Candidate; and project cards never show raw types such
   as `CollectionPage`, `SoftwareApplication`, or `VideoGame`.
9. Open a project card's **Read More**, press Escape, and confirm only the card
   modal closes while Search remains open.
10. Check the University chronology. Its four columns divide the verified
    August 2019–May 2023 degree interval equally; **Digital Humanities Forum
    Committee** and **OhioLINK Luminary** begin in Q3, not Q4.

### Shelf Search

1. Open `/shelf/` and expand Search.
2. Exercise Language, Publisher, Author, and Collection separately. Each field
   owns its own ontology and typo-collision boundary.
3. Confirm multiple active fields retain AND behavior and that the existing
   Shelf ordering, randomization, dropdown, and zero-result behavior are
   unchanged.
4. Type `Engi`, `Engil`, `Engils`, and `Engilsh` in Language. Every state should
   retain the English results. Confirm the rule is engine-wide with Language
   `simplixf`, Publisher `stdu`, Author `jonh`, `adma`, or `erci`, and Collection
   `tecnol`; Author `chra` must fail closed as a true Charles/Cara collision.

### Text to Lattice modal continuity

1. Open `/resume/`, choose **Use Text to Lattice**, and enter disposable test
   prose.
2. Close and reopen the modal before submitting. The same input and current
   process/result state should remain.
3. During availability checking, model setup, conversion, clarification, or a
   completed result, closing the modal is visibility-only. Reopening must show
   the same input, request, post-request process, clarification, error, or
   result. Only **Cancel** and **Start over** tear down that state.
4. A capability failure should expose **Check again**. A stalled worker should
   end with a visible error rather than a permanently full preparation bar.
5. Confirm the modal owns an opaque white viewport at every scroll position;
   no blurred Resume heading, Search label, or card text may bleed through.
6. Confirm **Source text** uses the same borderless, faint lower-edge treatment
   as Resume Search, scaled to the existing large textarea rather than styled
   as a separate input family.

The complete Text to Lattice transaction intentionally depends on the deployed
same-origin lease route, isolated verification origin, browser WebGPU support,
and multi-gigabyte model downloads. A standalone Vite server has no production
lease service. It now stops before making a nonexistent local lease request and
explains that conversion requires the deployed `https://hah.dev` origin, so use
it for interface/state testing; verify a terminal model result only after
deploying this exact candidate through the repository's protected workflow. The
first production lease response is a closed, versioned HTTP 200 challenge, not
a lease grant: it establishes the signed visitor state and requests attestation
before the retried request can receive a lease. A legacy HTTP 428 challenge is
retained only for compatibility while Worker and Pages deployments overlap or
roll back; the current client advertises and strictly validates the typed HTTP
200 envelope.

## Production evidence still required

After deployment, retain one supported-browser run that reaches a non-error
terminal result, the 200 lease acquisition and 204 release, and a sanitized
two-origin privacy trace. Also verify that no Cloudflare Web Analytics beacon is
injected on either document origin. Do not weaken the Content Security Policy to
permit the beacon.
