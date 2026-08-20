# Index ASCII Character

The index portrait is a fixed-geometry ASCII character system rather than a video, canvas, SVG, or full-frame text swap. It preserves the original 70-column by 34-row portrait and applies small authored patches to the head, shoulder, arm, hand, tablet, and temporary motion trails.

## Behavior model

The controller has four visible states:

1. `writing` — a slow, mostly still loop with small pen, hand, head, and shoulder changes;
2. `notice` — a brief pause and directional glance after pointer movement is detected over visible portrait cells;
3. `swat` — one of four authored sequences: left, right, upper-left, or upper-right;
4. `recover` — the arm retracts and the person returns to the writing loop.

Pointer events do not trigger a swat one-for-one. Movement is accumulated into an agitation budget. The first small movement episode produces a glance; continued movement crosses a hit-dependent threshold and produces a swat. Movement over the person or tablet is weighted more heavily than movement over the tree. Continued rapid movement can produce another swat after the current sequence and cooldown finish.

## Collision and direction

The pointer is mapped from the rendered `<pre>` rectangle into the fixed ASCII grid. The base portrait is used for collision so temporary animation marks cannot change the hit map.

- visible non-space cells are image cells;
- nearby cells inside the authored person and tablet regions receive stronger reactions;
- whitespace outside the visible portrait is inert;
- the pointer location is reduced to one of four authored directional sequences relative to the shoulder anchor.

The arm itself is never procedurally stretched to an arbitrary coordinate. This keeps the poses coherent and reviewable.

## Rendering and performance

Every pose is generated from the base portrait plus localized row-and-column patches. The component precomputes all frames once, then updates the `<pre>` element's `textContent` directly. Pointer events only record the latest position and accumulated distance; collision processing occurs at most once per animation frame. React state is not used for animation or pointer movement.

The sizing observer measures the stable base frame, not the current animated pose. Every row is padded to exactly 70 characters, so writing and swatting cannot change layout geometry.

## Accessibility and input modes

The changing character data is `aria-hidden`. A stable wrapper exposes the portrait as one image with a concise accessible description, avoiding repeated announcements of changing punctuation.

- fine hover pointers receive collision-aware reactions;
- coarse and touch pointers keep the ambient writing loop without a forced tap interaction;
- `prefers-reduced-motion: reduce` disables the writing and swat sequences, retaining only a brief, instantaneous directional glance on movement.

## Validation

`scripts/validate-ascii-character.mjs` runs before every production build. It rejects:

- tabs or multiline patches;
- incorrect base row counts;
- rows wider than 70 columns;
- patches outside the 70 × 34 grid;
- missing pose references or non-positive durations;
- rendered frames whose row count or width changes;
- collision regions outside the portrait.

The rendered HTML tests also verify fixed frame geometry, collision classification, all four direction choices, and the static accessible markup emitted before hydration.
