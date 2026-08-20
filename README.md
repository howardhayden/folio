# Hayden Howard Portfolio

A small, multi-page portfolio for Hayden Howard, centered on systems, information, resilience, and public service. The site now treats the landing page as `00 / INDEX`: Resume, Tools, and Shelf visibly branch from that origin through shared numbered chrome and route spines while retaining their own URLs, metadata, compositions, content, and interactions. Its Jost typography, interactive ASCII landing composition, Q&A, masonry cards, alternating timeline, modal details, hover motion, and shelf filtering remain intact.

## Routes

- `00 /` — introduction, reactive ASCII illustration, Q&A, and the directory from which the other routes grow
- `01 /resume` — structured skill stacks, projects, career timeline, and education
- `02 /tools` — a considered productivity and technology stack
- `03 /shelf` — a client-side, filterable catalogue of 30 works

## Architecture

- Next-compatible App Router pages rendered through Vinext
- One index-rooted route manifest shared by the numbered navigation, home directory, branch leads, and return markers
- Distinct static routes with one active-route signal, one main landmark, and preserved page-specific layouts
- Typed data for skills, roles, tools, and shelf records
- A fixed-geometry, patch-based ASCII character with writing, full-head pointer tracking, four articulated overhead swats, direction-locked recovery, and collision states
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
- Fine-pointer gaze and collision behavior, touch-safe ambient writing, and a reduced-motion static/full-head-glance mode
- Pointer input is sampled at most once per animation frame; frame changes bypass React renders while retaining fixed geometry
- Search, blur, cards, timeline, and modal behavior retained
- Modal information remains present in structured source data
- Reduced-motion support and mobile-first layout fallbacks
- No jQuery, Bootstrap JavaScript, or page-specific global scripts

## License

MIT
