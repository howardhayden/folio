# Index ASCII Cat

The index illustration is a fixed 70 × 34 ASCII character system. It replaces the former seated writer with a cat seen from beneath a glass table: the belly and face sit behind two large, glass-facing paws, while the tail moves behind the loaf. The surrounding hah.dev layout, copy, routes, and interactions are unchanged.

## Behavior model

The controller has four visible states:

1. `idle` — the cat remains loafed while its tail moves left, center, and right;
2. `track` — entering or moving within the ASCII frame turns both pupils toward one of four pointer quadrants while the tail continues swishing;
3. `bat` — after a short dwell or enough pointer movement, one foreleg extends from the appropriate shoulder and presents a paw pad against the glass near the target quadrant;
4. `settle` — the paw retracts, the cat keeps watching the last pointer location, and the loaf is restored.

The pointer direction is sampled relative to the cat's face, then locked for each bat so a single gesture cannot reverse halfway through. A pointer that remains over the illustration invites another bat after the cooldown; it does not have to cross visible cat ink. Leaving the frame retracts the paw and returns the cat to its ambient loaf.

## Authored anatomy and perspective

- the body is a broad horizontal loaf occupying rows 8–30;
- the face and ears remain behind the foreground paws;
- two large pads show the paw undersides that would be visible through glass;
- every bat begins at the left or right shoulder on row 21;
- contact paws are authored for left, right, upper-left, and upper-right targets;
- a doubled slash path gives the moving foreleg visible weight and continuous shoulder attachment;
- the non-batting paw remains planted against the glass;
- the eyes move independently of the body silhouette, preserving the under-table viewpoint;
- left, center, and right tail silhouettes remain available throughout idle and interactive motion.

## Rendering and performance

Each semantic pose is composed from cat body, face, pupil, paw, foreleg, and tail layers, then reduced to localized patches against the base loaf. Frames are precomputed once. Animation updates the `<pre>` element's `textContent` directly, so pointer motion does not trigger React rendering and the illustration never changes its 70 × 34 layout geometry.

Pointer coordinates are mapped into the fixed grid. Interaction uses the whole rendered ASCII frame, including whitespace, because the cat is following the pointer above the apparent glass rather than reacting only to collisions with its own body.

## Accessibility and input modes

The changing text is hidden from repeated assistive-technology announcements. A stable image description explains the cat, glass-table viewpoint, gaze, tail, and batting behavior.

- fine hover pointers receive gaze tracking, dwell-aware batting, and repeated playful attempts;
- touch and coarse pointers retain the ambient loaf and tail cycle without a hover-only interaction;
- `prefers-reduced-motion: reduce` holds the cat in a still loaf, permits only a static directional gaze while the pointer is present, and suppresses tail and paw animation.

## Validation

The build-time validator and rendered tests reject:

- incorrect row counts, row widths, tabs, or out-of-grid patches;
- missing idle, tracking, batting, or settling sequences;
- missing coverage for any pointer quadrant;
- tail states that do not differ visibly;
- a contact pose without a visible central paw pad;
- a bat detached from its authored shoulder;
- a directional gaze without both pupils in the correct location;
- reintroduction of the superseded human hand, pen, or `OOO` arm motifs;
- accessible markup that describes the former writer instead of the cat.
