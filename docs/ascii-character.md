# Index ASCII Cat

The index illustration is a fixed 70 × 34 ASCII character system. It depicts a cat loafing on a glass table while the viewer looks up from beneath it. The torso stays broad and low across the glass, the forepaws remain tucked close to the underside of the chest, and the cat lowers its head to look down rather than sitting upright to face the viewer. The surrounding hah.dev layout, copy, routes, and interactions are unchanged.

The cat is built procedurally from tonal character density. Its volume comes from irregular fields of light and dark fur characters, not an outlined mascot shell. The loaf is a low, asymmetric superellipse with distinct shoulder and haunch volume instead of a round body stamp. The lowered head has small ears integrated into its upper contour but deliberately has no explicit eyes, nose, mouth, smile, or other distinct face. Attention is communicated by pivoting and reshaping the whole head around a fixed neck blend.

## Behavior model

The controller has five visible states:

1. `idle` — the cat holds its loaf while its rump-rooted tail moves through five silhouettes in an eight-phase out-and-back swish;
2. `track` — entering or moving within the ASCII frame turns the lowered head toward one of four pointer quadrants while the tail continues moving;
3. `bat` — a short dwell or sufficient pointer movement produces a readable shoulder-to-paw reach and glass contact, sometimes followed by zero to three smaller taps;
4. `settle` — the reaching paw recoils and tucks back into the loaf;
5. `follow` — after the pointer leaves the ASCII frame, the head continues following its external direction briefly before the cat returns to ambient rest.

Pointer direction is sampled relative to the lowered head at row 20, column 21. Points at least three rows above that anchor map to an upper quadrant; all others map left or right. The same mapping accepts coordinates outside the 70 × 34 frame, allowing the cat to follow the pointer after it moves away. External following lasts up to two seconds after departure and refreshes as the pointer continues moving. Bat frames retain the precise in-frame row and column, including edge and corner cells, so the compact contact lands at the pointer rather than at one fixed endpoint for the whole quadrant.

The action direction is locked for each bat, so one reach cannot reverse halfway through. Ready, reach, contact, and recoil form a 530 millisecond primary gesture. A deterministic cadence pattern adds zero, one, two, or three compact `mini-in`/`mini-contact` pairs before recoil; the first interaction is always a clean single bat. Complete gestures last between 530 and 1,115 milliseconds. This produces natural variation and occasional paw flurries without animation randomness or unreadably fast motion. The tail keeps its current phase throughout the bat and settle, then resumes from the adjacent ambient position. A pointer that stays over the illustration can invite another bat after the post-gesture cooldown.

## Anatomy and under-glass perspective

- the torso forms a horizontal, foreshortened loaf across the middle of the frame;
- the head remains lowered into the near side of the loaf and pivots around a fixed posterior neck mass;
- small, tapered ears grow directly from the lowered head contour and rotate with it without becoming separate blobs or a cartoon face;
- all head and body surfaces use the same tonal fur vocabulary: ` .,:;clodxkO0KXNM`;
- compact forepaw contacts are centered at row 23, columns 28 and 40, close to the chest rather than spread like oversized icons;
- a bat begins at the authored left or right shoulder, unfolds as a broad three-to-five-cell fur band through a close elbow and wrist, and ends in a small `K`-centered glass contact at the pointer;
- the non-batting paw remains tucked against the glass;
- moving limbs use fur-density bands rather than slash-built sticks;
- the long, tapered tail originates at the right rump, hugs the haunch through a fixed proximal curve, reaches column 69, and arcs through rows 12–22 across five ambient silhouettes.

From below, glass compresses the nearest paw and belly surfaces while the body spreads laterally above them. The silhouette therefore reads as weight resting across a transparent plane, not as a cat sitting upright in front of the viewer. No pupil landmarks or facial symbols are used to fake attention.

## Rendering and performance

Each semantic pose is composed from the procedural loaf, directionally rotated head and ears, compact paw contacts, broad foreleg paths, and rump-rooted tail. It is then reduced to patches against the base `loaf-center` frame. Ambient and tracking frames are precomputed once; a bat's small frame set is generated at gesture start for the current pointer cell. A deterministic motion clock advances an eight-phase tail cycle built from five silhouettes independently from head direction, follow deadlines, and paw cooldowns. Repeated midpoint phases preserve whether the swish is traveling outward or returning; a bat freezes that exact phase and resumes it with a short post-settle buffer. Animation writes directly to the `<pre>` element's `textContent`, so pointer motion does not trigger React rendering or alter the fixed 70 × 34 geometry.

The entire rendered frame, including its whitespace, is interactive. This matches the glass-table premise: the cat is reacting to a pointer moving across the apparent transparent surface, not only to collisions with visible fur characters.

## Pointer cadence

- entering the frame starts directional head tracking immediately;
- 16 pixels of accumulated pointer movement or a 520 millisecond dwell can initiate a bat;
- the primary bat uses 105, 115, and 165 millisecond ready/reach/contact poses;
- a fixed ordinal pattern distributes zero through three mini-bat follow-ups, with 80–100 millisecond inward and 95–115 millisecond contact poses;
- recoil takes 145 milliseconds, settle takes 190 milliseconds, and the 1,100 millisecond cooldown starts after the bat completes;
- leaving the frame samples the departure coordinates, then window-level pointer movement updates the head direction during the two-second follow interval.

The fixed mini-bat pattern makes the variation repeatable in tests while avoiding a mechanical identical response on every attempt.

## Accessibility and input modes

The changing ASCII text is hidden from repeated assistive-technology announcements. The stable image description is exported with the character system and rendered before client hydration:

> A cat loafs on a glass table above the viewer, turns its lowered head toward the pointer, swishes its tail, and bats with a tucked paw.

- fine hover pointers receive head tracking, dwell-aware batting, follow-up taps, and brief tracking after departure;
- touch and coarse pointers retain the ambient loaf and tail cycle without a hover-only batting interaction;
- `prefers-reduced-motion: reduce` suppresses tail and paw animation while retaining a static directional head pose during pointer tracking and brief follow behavior.

## Validation

The build-time validator and rendered tests reject:

- incorrect row counts, row widths, tabs, or out-of-grid patches;
- missing idle, tracking, batting, retracting, or settling sequences;
- missing direction coverage for any pointer quadrant;
- direction mapping that fails for pointer coordinates outside the ASCII frame;
- fewer than five distinct connected tail silhouettes, an incorrect eight-phase order, abrupt adjacent transitions, loss of the full outer span, or a blunt terminal stack;
- loss of the dense procedural loaf or either compact resting paw contact;
- a bat detached from its authored shoulder, missing its compact contact, or rendered as a line-art limb;
- a targeted bat whose central contact does not land on the sampled pointer cell;
- mini-bat patterns that omit zero through three follow-up counts, become nondeterministic, or fall outside the readable 530–1,115 millisecond gesture envelope;
- circular loaf silhouettes, unstable tail roots, broad whole-tail swings, or an inherited line height that stretches the cat vertically;
- tracking poses that fail to change the lowered head region distinctly for all four directions;
- facial-cartoon glyphs, oversized mascot paws, or the superseded human hand, pen, and arm motifs;
- changes to the site's established shell, route distinctions, page copy, project records, shelf records, or accessible markup.
