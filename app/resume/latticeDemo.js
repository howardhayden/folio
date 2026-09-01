// The portfolio demonstrator is deliberately narrower than the full Lattice
// engine. It classifies short free-form samples, preserves their word inventory
// and order, and changes cadence only where punctuation can do so without
// inventing semantic atoms.

export const LATTICE_DEMO_VERSION = "folio-lattice-demo.v1";
export const LATTICE_INPUT_LIMIT = 250;

const LAYERS = Object.freeze({
  operative: Object.freeze({
    id: "operative",
    label: "Operative layer",
    description: "Protected instructions and constraints remain immediately legible.",
  }),
  experiential: Object.freeze({
    id: "experiential",
    label: "Experiential layer",
    description: "Cadence follows bodily, material, environmental, or reflective attention.",
  }),
  interpretive: Object.freeze({
    id: "interpretive",
    label: "Interpretive layer",
    description: "Cadence keeps causal and institutional relationships visible.",
  }),
});

const protectedPatterns = [
  /\b(?:do not|don['’]t|never|must not|cannot|can['’]t)\b/iu,
  /\b(?:stop|leave|call|wait|avoid)\s+immediately\b/iu,
  /\b(?:warning|danger|emergency|overdose|allerg(?:y|ic)|injur(?:y|ies)|dizz(?:y|iness)|faint(?:ing)?|unconscious)\b/iu,
  /\b\d+(?:[.,]\d+)?\s?(?:mcg|mg|g|kg|mL|ml|L|°C|°F|hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/u,
  /\b(?:every|within|no later than|at least|at most)\s+\d+(?:[.,]\d+)?\b/iu,
  /\b(?:screen reader|keyboard navigation|alt text|aria-(?:label|describedby)|accessibility equivalent)\b/iu,
  /(?:^|[.!?]\s+)(?:please\s+)?(?:click|tap|press|select|choose|enter|type|submit|open|close|call|touch|hold|wait|take|remove|avoid|keep|use)\b/iu,
  /(?:^|[.!?]\s+)(?:please\s+)?contact(?!\s+between\b)\b/iu,
];

const experientialPatterns = [
  /\b(?:body|breath|breathe|shoulder|arm|hand|palm|finger|torso|spine|back|hip|knee|leg|foot|feet|heel|toe|skin|chest|jaw|neck|gaze|eyes?)\b/giu,
  /\b(?:move|moving|step|walk|walking|turn|turning|raise|lower|reach|rest|sit|stand|lean|shift|soften|release|feel|notice|remember|reflect)\b/giu,
  /\b(?:brush|wipe|clean|polish|condition|leather|cloth|fabric|grain|surface|water|rain|wind|air|light|shadow|room|floor|rail|door|window|sky|shore|warmth|cool|temperature)\b/giu,
];

const interpretivePatterns = [
  /\b(?:because|therefore|so that|which means|as a result|consequence|caus(?:e|es|ed|al|ality)|effect|depends? on|leads? to)\b/giu,
  /\b(?:system|institution|organization|policy|power|authority|structure|relationship|network|process|evidence|record|provenance|incentive|constraint|trade-?off|externality)\b/giu,
  /\b(?:why|how|explains?|interpret(?:s|ed|ation)?|demonstrates?|reveals?|shows?)\b/giu,
];

const nonMovementInstruction = /(?:^|[.!?]\s+)(?:please\s+)?(?:click|tap|press|select|choose|enter|type|submit|open|close|call|contact|touch|hold|wait|take|remove|avoid|keep|use)\b/iu;

function matchesAny(text, patterns) {
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

function matchCount(text, patterns) {
  return patterns.reduce((total, pattern) => {
    pattern.lastIndex = 0;
    return total + [...text.matchAll(pattern)].length;
  }, 0);
}

export function segmentGraphemes(value) {
  const text = String(value ?? "");
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    return [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text)]
      .map(({ segment }) => segment);
  }

  // Array.from is a code-point fallback for older engines. Modern browsers and
  // the supported Node runtime take the standards-based Segmenter path above.
  return Array.from(text);
}

export function countLatticeCharacters(value) {
  return segmentGraphemes(value).length;
}

export function selectLatticeLayer(value) {
  const text = String(value ?? "").trim();

  if (matchesAny(text, protectedPatterns)) return LAYERS.operative;

  const experientialScore = matchCount(text, experientialPatterns);
  const interpretiveScore = matchCount(text, interpretivePatterns);

  if (nonMovementInstruction.test(text) && experientialScore === 0) {
    return LAYERS.operative;
  }

  if (interpretiveScore > experientialScore) return LAYERS.interpretive;
  return LAYERS.experiential;
}

function wordsInOrder(value) {
  return (value.match(/[\p{L}\p{M}\p{N}]+(?:[’'][\p{L}\p{M}\p{N}]+)*/gu) ?? [])
    .map((word) => word.toLocaleLowerCase("en-US"));
}

function sameWordInventory(source, candidate) {
  const sourceWords = wordsInOrder(source);
  const candidateWords = wordsInOrder(candidate);
  return sourceWords.length === candidateWords.length
    && sourceWords.every((word, index) => word === candidateWords[index]);
}

function uppercaseFirst(value) {
  return value ? value[0].toLocaleUpperCase("en-US") + value.slice(1) : value;
}

function shapeConnectors(text) {
  return text
    .replace(/;\s*(however|therefore|instead|meanwhile|still|yet|but)\b/giu, (_match, connector) => `. ${uppercaseFirst(connector)}`)
    .replace(/,\s*(but|yet)\s+/giu, (_match, connector) => `. ${uppercaseFirst(connector)} `);
}

function shapeLongClauses(text) {
  if (wordsInOrder(text).length < 18) return text;
  return text.replace(/;\s+/gu, ". ");
}

function shapeExperientialCadence(text) {
  const shaped = shapeLongClauses(shapeConnectors(text));
  if (countLatticeCharacters(shaped) < 140) return shaped;

  const firstBoundary = /([.!?])\s+/.exec(shaped);
  if (!firstBoundary || firstBoundary.index > 150) return shaped;
  const boundary = firstBoundary.index + firstBoundary[1].length;
  return `${shaped.slice(0, boundary)}\n\n${shaped.slice(boundary).trimStart()}`;
}

function shapeInterpretiveCadence(text) {
  return shapeLongClauses(shapeConnectors(text));
}

function shapeForLayer(text, layer) {
  if (layer.id === "operative") return text;
  if (layer.id === "interpretive") return shapeInterpretiveCadence(text);
  return shapeExperientialCadence(text);
}

export function latticeize(value) {
  if (typeof value !== "string") throw new TypeError("Lattice input must be text.");

  const characterCount = countLatticeCharacters(value);
  if (characterCount > LATTICE_INPUT_LIMIT) {
    throw new RangeError(`Lattice input cannot exceed ${LATTICE_INPUT_LIMIT} characters.`);
  }

  const source = value.replace(/\r\n?/gu, "\n").trim();
  if (!source) throw new RangeError("Enter text before running Lattice.");

  const layer = selectLatticeLayer(source);
  const candidate = shapeForLayer(source, layer);
  const output = sameWordInventory(source, candidate) ? candidate : source;
  const conformance = output === source ? "literal" : "cadence-only";

  return Object.freeze({
    version: LATTICE_DEMO_VERSION,
    layerId: layer.id,
    layerLabel: layer.label,
    layerDescription: layer.description,
    conformance,
    text: output,
  });
}
