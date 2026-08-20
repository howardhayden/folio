# Hayden Howard Portfolio

A small, multi-page portfolio for Hayden Howard, centered on systems, information, resilience, and public service. The refactor deliberately preserves the original Bootstrap-era presentation and interaction design: its Jost typography, light navigation, interactive ASCII landing composition, pulsing Q&A, masonry cards, alternating timeline, modal details, hover motion, and blurred shelf-search overlay.

## Routes

- `/` — introduction, animated ASCII illustration, and Q&A
- `/resume` — structured skill stacks, career timeline, and education
- `/tools` — a considered productivity and technology stack
- `/shelf` — a client-side, filterable catalogue of 30 works

## Architecture

- Next-compatible App Router pages rendered through Vinext
- Reusable page chrome and page components
- Typed data for skills, roles, tools, and shelf records
- A fixed-geometry, patch-based ASCII character with writing, attention, directional swat, recovery, and collision states
- One focused client component for shelf filtering and sorting
- Bootstrap 4.5.2 styling retained locally for visual compatibility
- React-managed interactions in place of jQuery and page-global DOM scripts
- A single responsive stylesheet with reduced-motion fallbacks

The ASCII character's state model, collision map, accessibility behavior, and validation rules are documented in [`docs/ascii-character.md`](docs/ascii-character.md).

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

The test command validates every ASCII pose, performs a production build, validates the worker artifact, and checks rendered route output.

## Accessibility and performance notes

- Semantic landmarks and heading order across all routes
- Visible focus treatment and keyboard-native controls
- Accessible labels and keyboard dismissal for Shelf search
- Stable accessible description for changing ASCII frames, with the character data hidden from repeated assistive-technology announcements
- Fine-pointer collision behavior, touch-safe ambient writing, and a reduced-motion static/glance mode
- Pointer input is sampled at most once per animation frame; frame changes bypass React renders while retaining fixed geometry
- Search, blur, cards, timeline, and modal behavior retained
- Modal information remains present in structured source data
- Reduced-motion support and mobile-first layout fallbacks
- No jQuery, Bootstrap JavaScript, or page-specific global scripts

## License

MIT
