import {
  ASCII_COLUMNS,
  ASCII_POSES,
  ASCII_ROWS,
  asciiPortrait,
  createAsciiFrames,
  normalizeAsciiArt,
  validateAsciiCharacterDefinition,
} from "../app/components/asciiCharacter.js";

validateAsciiCharacterDefinition(asciiPortrait);

const baseLines = normalizeAsciiArt(asciiPortrait);
const frames = createAsciiFrames(asciiPortrait);

if (baseLines.length !== ASCII_ROWS) {
  throw new Error(`Expected ${ASCII_ROWS} ASCII rows.`);
}

for (const [poseName, frame] of Object.entries(frames)) {
  const lines = frame.split("\n");
  if (
    lines.length !== ASCII_ROWS ||
    lines.some((line) => line.length !== ASCII_COLUMNS)
  ) {
    throw new Error(`Pose ${poseName} does not preserve fixed frame geometry.`);
  }
}

if (Object.keys(frames).length !== Object.keys(ASCII_POSES).length) {
  throw new Error("Not every authored ASCII pose produced a frame.");
}

console.log(
  `Validated ${Object.keys(frames).length} ASCII poses at ${ASCII_COLUMNS}x${ASCII_ROWS}.`,
);
