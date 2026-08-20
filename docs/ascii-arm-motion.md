# Raised ASCII arm motion

The pointer swat uses an authored three-joint ASCII rig rather than a thin line drawn from the figure toward the pointer.

## Silhouette

Each swat frame keeps a fixed shoulder on the upper torso, sends a thick upper arm upward and outward to the elbow, and folds a tapered forearm back inward to a higher hand. This creates an unmistakable bent elbow and prevents the moving limb from reading as a horizontal appendage.

The contact poses rise substantially above the shoulder. Left, right, upper-left, and upper-right reactions retain distinct hand and elbow destinations, but all use the same anatomical rule: the elbow remains outside both the shoulder and hand.

## Pen

The hand retains a short pen in every wind-up, extension, contact, recoil, and recovery pose. The pen begins at the hand's upper-right edge and uses a compact `/---'` stroke pointing toward the rear-right. It is deliberately much shorter and thinner than the arm so the two forms cannot be confused.

## Rendering

`asciiArmMotion.js` generates the corrected swat frames directly from the canonical 70 by 34 portrait. `NaturalSwatAsciiArt` substitutes those frames when the existing character state machine enters a swat or recovery pose; writing, noticing, collision detection, reduced-motion behavior, and timing remain unchanged.

The build validator enforces fixed geometry, minimum visible thickness, raised hand and elbow positions, an outward elbow bend, complete state coverage, and an attached in-bounds pen.
