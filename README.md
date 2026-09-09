# Hayden Howard Portfolio

A progressively enhanced portfolio for Hayden Howard, centered on systems, information, resilience, and public service. The refactor deliberately preserves the original Bootstrap-era presentation and interaction design: its Jost typography, light navigation, interactive ASCII landing composition, pulsing Q&A, masonry cards, alternating timeline, modal details, hover motion, and blurred shelf-search overlay.

## Views

- `/` — introduction, animated ASCII illustration, and Q&A
- `/resume/` — structured skill stacks, career timeline, education, and projects
- `/tools/` — a considered productivity and technology stack
- `/shelf/` — a progressively enhanced, filterable catalogue of 30 works
- `/projects/` — canonical project records and relationships
- `/requirements/` and `/ns/` — shared requirements and the site vocabulary

## Architecture

- Canonical Next-compatible routes rendered through Vinext and exported as static HTML
- Native navigation between canonical pages; legacy query/hash state remains a client-side compatibility path
- Reusable shared chrome and conditionally mounted view components
- Typed data for skills, roles, tools, and shelf records
- A fixed-geometry, patch-based ASCII character with writing, attention, directional swat, recovery, and collision states
- One focused client component for shelf filtering and sorting
- Bootstrap 4.6.2 styling retained locally for visual compatibility
- React-managed interactions in place of jQuery and page-global DOM scripts
- A single responsive stylesheet with reduced-motion fallbacks
- Direct JSON, JSON-LD, Markdown, sitemap, robots, and llms artifacts for machine-readable access

The ASCII character's state model, collision map, accessibility behavior, and validation rules are documented in [`docs/ascii-character.md`](docs/ascii-character.md).

## Lattice documentation

The [Lattice and Text to Lattice documentation index](public/documentation/text-to-lattice/index.html) separates the typed Lattice method from the browser demonstrator that applies it to free-form prose. It publishes complete Markdown and progressively enhanced HTML editions of the concept and ecosystem map, system skill map, service blueprint, and security model.

[`docs/text-to-lattice/LATTICE-DOCUMENTATION-ATLAS.json`](docs/text-to-lattice/LATTICE-DOCUMENTATION-ATLAS.json) is the single authority for those editions. Run `npm run docs:lattice` to regenerate them and `npm run docs:lattice:check` to reject drift without changing files.

## Local development

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run lint
npm test
```

The test command validates every ASCII pose, performs a production build, validates the worker artifact, and checks the index shell and each rendered state.

## Accessibility and performance notes

- One visible semantic main landmark with a consistent heading order in every state
- Visible focus treatment and keyboard-native controls
- Accessible labels and keyboard dismissal for Shelf search
- Stable accessible description for changing ASCII frames, with the character data hidden from repeated assistive-technology announcements
- Fine-pointer collision behavior, touch-safe ambient writing, and a reduced-motion static/glance mode
- Pointer input is sampled at most once per animation frame; frame changes bypass React renders while retaining fixed geometry
- Search, blur, cards, timeline, and modal behavior retained
- Modal information remains present in structured source data
- Reduced-motion support and mobile-first layout fallbacks
- No jQuery, Bootstrap JavaScript, or page-specific global scripts

## Licensing

hah.dev portfolio is **source-available for noncommercial use** under
**PolyForm-Noncommercial-1.0.0**; commercial use requires a separate written license. Personal, résumé, ASCII-character, animation, and distinctive identity material remains rights-reserved.
No current source file or function has a permissive commercial-use exception.
See [`LICENSING.md`](LICENSING.md),
[`WORKFLOW-BOUNDARIES.md`](WORKFLOW-BOUNDARIES.md), and
[`LICENSE-MAP.json`](LICENSE-MAP.json) for scope and historical limits.
