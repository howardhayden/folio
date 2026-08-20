# Index ASCII Character

The index portrait is a fixed-geometry ASCII character system rather than a video, canvas, SVG, or full-frame text swap. It preserves the original 70-column by 34-row portrait and applies small authored patches to the head, shoulder, upper arm, elbow, forearm, hand, pen, and tablet.

## Behavior model

The controller has four visible states:

1. `writing` — a slow, mostly still loop with small pen, hand, head, and shoulder changes;
2. `notice` — a brief pause and full-head directional tilt after pointer movement is detected anywhere inside the portrait frame;
3. `swat` — one of four authored sequences: left, right, upper-left, or upper-right;
4. `recover` — a direction-specific lowering pose that preserves the pointer-facing head tilt before returning to the writing loop.

Pointer events do not trigger a swat one-for-one. Movement is accumulated into an agitation budget. The first small movement episode produces a glance; continued movement over visible portrait cells crosses a hit-dependent threshold and produces a swat. Movement over the person or tablet is weighted more heavily than movement over the tree. Whitespace can turn the head but cannot add agitation or trigger a swat. Continued rapid movement can produce another swat after the current sequence and cooldown finish.

The direction that launches a swat is copied into a locked `actionDirection`. The live pointer may continue moving, but it cannot turn an arm or recovery pose inside an already-started gesture. Its newest direction becomes the next possible action target instead. During the notice state, the head can still change direction without restarting the pose timer.

## Authored anatomy

The swat is an articulated overhead gesture, not a line stretched from the torso to the pointer.

- the face-direction anchor is row 26, column 39;
- the shoulder attachment is row 28, column 42;
- every wind-up, extension, contact, recoil, and recovery keeps the hand above the authored head box;
- `OOO` runs give the upper arm and forearm visible mass across every intervening row;
- `(OOO)` marks a deliberate elbow joint whose render-aspect-corrected angle remains between 98° and 155°;
- the arm path remains laterally connected from the hand through the elbow to the shoulder;
- `(@)=====>` reads as a hand retaining a short pen, with its point trailing toward the back-right rather than becoming the swatting limb;
- upper-left and upper-right poses keep the upward head tilt through recovery.

These constraints exist specifically to prevent a short, thin, unbent torso-height projection from reappearing.

## Collision and direction

The pointer is mapped from the rendered `<pre>` rectangle into the fixed ASCII grid. The base portrait is used for collision so temporary animation marks cannot change the hit map. Gaze direction is calculated relative to the face before collision classification, allowing the person to face the pointer even over a blank cell.

- visible non-space cells are image cells;
- nearby cells inside the authored person and tablet regions receive stronger reactions;
- whitespace outside the visible portrait is inert;
- the pointer location is reduced to one of four authored directional sequences relative to the face anchor.

The arm itself is never procedurally stretched to an arbitrary coordinate. The four targets choose among authored, validated poses while the pointer-facing head remains spatially coherent.

## Rendering and performance

Every pose is generated from the base portrait plus localized row-and-column patches. The component precomputes all frames once, then updates the `<pre>` element's `textContent` directly. Pointer events only record the latest position and accumulated distance; collision processing occurs at most once per animation frame. React state is not used for animation or pointer movement.

The sizing observer measures the stable base frame, not the current animated pose. Every row is padded to exactly 70 characters, so writing and swatting cannot change layout geometry.

## Accessibility and input modes

The changing character data is `aria-hidden`. A stable wrapper exposes the portrait as one image with a concise accessible description, avoiding repeated announcements of changing punctuation.

- fine hover pointers receive collision-aware reactions;
- coarse and touch pointers keep the ambient writing loop without a forced tap interaction;
- `prefers-reduced-motion: reduce` disables the writing and swat sequences, retaining only a brief, instantaneous full-head directional glance on movement.

## Validation

`scripts/validate-ascii-character.mjs` runs before every production build. It rejects:

- tabs or multiline patches;
- incorrect base row counts;
- rows wider than 70 columns;
- patches outside the 70 × 34 grid;
- missing pose references or non-positive durations;
- rendered frames whose row count or width changes;
- collision regions outside the portrait.

It also rejects semantic anatomy regressions:

- missing notice, swat, or recovery sequences for any of the four directions;
- a hand at or below the head;
- a disconnected row or lateral jump in the arm path;
- a missing shoulder, hand, elbow, or pen landmark;
- an elbow outside the authored slight-bend range;
- a pen that is too short to read or long enough to become a rod;
- the former dash-rod and thin-underscore recovery motifs;
- a swat or recovery frame whose head looks away from its direction, including loss of the upper gaze.

The rendered HTML tests verify the same anatomy landmarks and direction coverage, fixed frame geometry, collision classification, the face-centered direction boundary, route-level reduced-motion-compatible markup, and the stable accessible description emitted before hydration.
