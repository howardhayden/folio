// Text-to-Lattice is an independently authored, bounded browser demonstrator.
// It does not embed Lattice's restricted profile or claim full conformance for
// arbitrary prose. Instead, it selects a public content layer passage by
// passage, applies a closed set of auditable rewrites, and fails closed when a
// material candidate cannot clear its preservation checks.

export const TEXT_TO_LATTICE_VERSION = "folio-text-to-lattice.v2";
export const LATTICE_WORD_LIMIT = 700;
export const LATTICE_INPUT_SAFETY_LIMIT = 50_000;

const LAYERS = Object.freeze({
  operative: Object.freeze({
    id: "operative",
    label: "Operative",
    description: "Instructions and constraints remain direct.",
  }),
  experiential: Object.freeze({
    id: "experiential",
    label: "Experiential",
    description: "Embodied, material, and relational detail stays concrete.",
  }),
  interpretive: Object.freeze({
    id: "interpretive",
    label: "Interpretive",
    description: "Causal and institutional relationships stay visible.",
  }),
  unresolved: Object.freeze({
    id: "unresolved",
    label: "Unresolved",
    description: "The public checks do not have enough evidence to select a layer.",
  }),
});

const WORD_FALLBACK = /[\p{L}\p{M}\p{N}]+(?:[’'][\p{L}\p{M}\p{N}]+)*/gu;
const DISALLOWED_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

const MATERIAL_REFERENT = /\b(?:arm|back|body|breath|button|chest|cloth|cold|door|fabric|finger|floor|foot|feet|gaze|hand|hands|heel|hip|jaw|knee|label|leather|leg|light|neck|palm|photograph|photo|rail|rain|record|room|shadow|shore|skin|spine|stone|surface|temperature|toe|torso|vinyl|warmth|water|wind|window)\b/iu;
const EXPERIENTIAL_ACTION = /\b(?:breathe[sd]?|brush(?:ed|es|ing)?|clean(?:ed|s|ing)?|cool(?:ed|s|ing)?|enter(?:ed|s|ing)?|feel|feels|felt|held|lean(?:ed|s|ing)?|lower(?:ed|s|ing)?|move[sd]?|moving|notice[sd]?|play(?:ed|s|ing)?|polish(?:ed|es|ing)?|raise[sd]?|reach(?:ed|es|ing)?|release[sd]?|remember(?:ed|s|ing)?|rest(?:ed|s|ing)?|shift(?:ed|s|ing)?|sit|sits|sitting|soften(?:ed|s|ing)?|stand|stands|standing|step(?:ped|s|ping)?|turn(?:ed|s|ing)?|walk(?:ed|s|ing)?|wipe[sd]?|wiping|yellow(?:ed|s|ing)?)\b/iu;
const SENSORY_STATE = /\b(?:bright|cold|cool|dark|dry|hot|rough|soft|warm|wet|smooth|quiet|loud|heavy|light)\b/iu;
const RELATIONAL_REFERENT = /\b(?:argument|care|child|colleague|conversation|family|friend|landlord|memory|mother|neighbor|parent|relationship|sister|student|tenant|worker|workers)\b/iu;
const PERCEPTION_OR_REFLECTION = /\b(?:feel|feels|felt|hear|heard|notice|noticed|recall|recalled|remember|remembered|said|saw|see|sees|thought|watched)\b/iu;
const RELATIONAL_SPEECH = /\b(?:he|i|she|they|we)\s+(?:replied|said|told|wrote)\b/iu;
const ORNAMENTAL_ABSTRACTION = /\b(?:abyss|ethereal|haunting|incandescent|ineffable|liminal|melancholy|poignant|profound|sublime|tapestry|visceral|whisper)\b/iu;

const INSTITUTIONAL_REFERENT = /\b(?:access|administrat(?:or|ors|ion)|agency|archive|authority|board|checksum|court|custody|digest|evidence|hearing|institution|landlord|management|network|organization|policy|power|process|provenance|record|records|regulation|system|testimony)\b/iu;
const ANALYTIC_RELATION = /\b(?:adjust(?:ed|s|ing)?|affect(?:ed|s|ing)?|bar(?:red|s|ring)?|cause[ds]?|change[ds]?|close[ds]?|control(?:led|s|ling)?|decid(?:e|ed|es|ing)|depend(?:ed|s|ing)?|demonstrat(?:e|ed|es|ing)|explain(?:ed|s|ing)?|expos(?:e|ed|es|ing)|indicat(?:e|ed|es|ing)|match(?:ed|es|ing)?|reinforc(?:e|ed|es|ing)|restrict(?:ed|s|ing)?|reveal(?:ed|s|ing)?|separat(?:e|ed|es|ing)|shape[ds]?|show(?:ed|s|ing)?|withh(?:eld|old|olds|olding))\b/iu;
const CAUSAL_RELATION = /\b(?:as a result|because|because of|consequently|depends? on|despite|due to|hence|if|in consequence|leads? to|reinforcing|results? in|since|so that|therefore|thus|unless|which means)\b/iu;
const EPISTEMIC_SIGNAL = /\b(?:evidence|how|interpret(?:ation|ed|ing|s)?|provenance|reason|why)\b/iu;
const FIGURATIVE_OR_ETHICAL = /\b(?:advantage|disadvantage|ethical|metaphor(?:ical|ically)?|stakes?|structural|systemic)\b/iu;
const DEONTIC_SIGNAL = /\b(?:has to|have to|must|need(?:s)? to|required to|should|shall)\b/iu;
const PROCEDURE_SIGNAL = /(?:^|\n)\s*(?:[-*•]|\d+[.)])\s+|\b(?:first|next|then|finally)\s*:/iu;

const COMMAND_VERBS = new Set([
  "add", "apply", "avoid", "call", "check", "choose", "click", "close",
  "conduct", "contact", "crawl", "dial", "do", "enable", "enter", "evacuate", "follow",
  "give", "hold", "install", "keep", "make", "notify", "open", "perform", "place", "press", "provide", "remove",
  "rest", "rinse", "save", "seek", "select", "set", "stop", "submit", "take",
  "tap", "touch", "turn", "type", "unplug", "update", "use", "wait", "wear",
]);

const SAFETY_SIGNAL = /\b(?:alarm|allerg(?:ic|y)|bleed(?:ing|s)?|danger|dizz(?:iness|y)|emergency|evacuate|faint(?:ed|ing)?|fire|help|injur(?:ed|ies|y)|overdose|rash|recovery|risk|smoke|symptom|unconscious|warning)\b/iu;
const ACCESSIBILITY_SIGNAL = /\b(?:accessibility|alt text|caption(?:s|ing)?|keyboard|ramp|screen[ -]reader|transcript|wheelchair)\b/iu;
const CONTACT_SIGNAL = /\b(?:call|contact|dial|email|notify|phone|text)\b/iu;
const TIMING_OR_QUANTITY = /\b(?:before|after|during|every|immediately|until|within)\b|\b\d+(?:[.,]\d+)?\s?(?:%|°[CF]|hours?|hrs?|kg|mg|mcg|mL|ml|minutes?|mins?|seconds?|secs?)\b/iu;
const PROHIBITION_SIGNAL = /\b(?:do not|don[’']t|must not|never|no longer|cannot|can[’']t|unless)\b/iu;

function resetAndTest(pattern, value) {
  pattern.lastIndex = 0;
  return pattern.test(value);
}

function titleCaseFirst(value) {
  if (!value) return value;
  return value[0].toLocaleUpperCase("en-US") + value.slice(1);
}

function replacementCase(source, replacement) {
  if (source === source.toLocaleUpperCase("en-US") && /\p{L}/u.test(source)) {
    return replacement.toLocaleUpperCase("en-US");
  }
  if (/^\p{Lu}/u.test(source)) return titleCaseFirst(replacement);
  return replacement;
}

export function countLatticeWords(value) {
  const text = String(value ?? "");
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("en", { granularity: "word" });
    let count = 0;
    for (const part of segmenter.segment(text)) {
      if (part.isWordLike) count += 1;
    }
    return count;
  }
  return text.match(WORD_FALLBACK)?.length ?? 0;
}

function firstCommandVerb(value) {
  const stripped = value
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/u, "")
    .replace(/^\s*(?:first|next|then|finally)\s*:\s*/iu, "")
    .replace(/^\s*please\s+/iu, "");
  const direct = /^(\p{L}+)/u.exec(stripped);
  if (direct && COMMAND_VERBS.has(direct[1].toLocaleLowerCase("en-US"))) {
    return { verb: direct[1].toLocaleLowerCase("en-US"), tail: stripped.slice(direct[0].length).trimStart() };
  }
  const conditional = /\b(?:if|when|unless|until)\b[^.!?]{0,160}?,\s*(?:please\s+)?(\p{L}+)/iu.exec(stripped);
  if (conditional && COMMAND_VERBS.has(conditional[1].toLocaleLowerCase("en-US"))) {
    return { verb: conditional[1].toLocaleLowerCase("en-US"), tail: stripped.slice(conditional.index + conditional[0].length).trimStart() };
  }
  const polite = /^(?:can|could|would|will) you\s+(\p{L}+)/iu.exec(stripped);
  if (polite && COMMAND_VERBS.has(polite[1].toLocaleLowerCase("en-US"))) {
    return { verb: polite[1].toLocaleLowerCase("en-US"), tail: stripped.slice(polite[0].length).trimStart() };
  }
  return null;
}

function looksLikeCommand(value) {
  if (resetAndTest(DEONTIC_SIGNAL, value)) return true;
  const match = firstCommandVerb(value);
  if (!match) return false;
  if (match.verb === "press" && /^(?:coverage|release|secretary|attention)\b/iu.test(match.tail)) return false;
  if (match.verb === "tap" && /^water\b/iu.test(match.tail)) return false;
  if (match.verb === "contact" && /^between\b/iu.test(match.tail)) return false;
  return true;
}

function isProtectedOperative(value) {
  if (!looksLikeCommand(value)) return false;
  // Protection is local to direct high-stakes instructions. Ordinary commands
  // still route to the operative layer, where guarded clarity rules may run.
  return resetAndTest(SAFETY_SIGNAL, value)
    || resetAndTest(ACCESSIBILITY_SIGNAL, value)
    || resetAndTest(CONTACT_SIGNAL, value)
    || resetAndTest(TIMING_OR_QUANTITY, value)
    || resetAndTest(PROHIBITION_SIGNAL, value);
}

export function scoreLatticeLayers(value) {
  const text = String(value ?? "").trim();
  const protectedOperative = isProtectedOperative(text);
  let operative = protectedOperative ? 20 : 0;
  let experiential = 0;
  let interpretive = 0;

  if (!protectedOperative && looksLikeCommand(text)) operative += 8;
  if (resetAndTest(DEONTIC_SIGNAL, text)) operative += 7;
  if (resetAndTest(PROCEDURE_SIGNAL, text)) operative += 4;

  const hasMaterial = resetAndTest(MATERIAL_REFERENT, text);
  if (hasMaterial && resetAndTest(EXPERIENTIAL_ACTION, text)) experiential += 7;
  if (hasMaterial && resetAndTest(SENSORY_STATE, text)) experiential += 5;
  if (resetAndTest(RELATIONAL_REFERENT, text) && resetAndTest(PERCEPTION_OR_REFLECTION, text)) experiential += 5;
  if (resetAndTest(RELATIONAL_SPEECH, text)) experiential += 5;

  if (resetAndTest(CAUSAL_RELATION, text)) interpretive += 7;
  if (resetAndTest(INSTITUTIONAL_REFERENT, text) && resetAndTest(ANALYTIC_RELATION, text)) interpretive += 7;
  if (resetAndTest(EPISTEMIC_SIGNAL, text)) interpretive += 4;
  if (resetAndTest(FIGURATIVE_OR_ETHICAL, text)) interpretive += 5;
  if (/\b(?:agency|institution|system)\b[^.!?]{0,80}\bpower\b/iu.test(text)) interpretive += 9;
  if (/\bcontact between\b[^.!?]{0,100}\b(?:caused|generated|produced|resulted)\b/iu.test(text)) interpretive += 7;
  if (/\b(?:political|social) movement\b|\bpolitical right\b/iu.test(text)) interpretive += 6;
  if (/\b(?:agency|institution|policy|system)\b[^.!?]{0,60}\b(?:cold|feels?|tighten(?:ed|s)?)\b/iu.test(text)) interpretive += 6;
  if (/\b(?:agency|institution|policy|system)\b[^.!?]{0,40}\bfeels?\b[^.!?]{0,20}\b(?:cold|warm)\b/iu.test(text)) interpretive += 5;

  return Object.freeze({ operative, experiential, interpretive, protectedOperative });
}

function layerFromScores(scores) {
  if (scores.protectedOperative) return LAYERS.operative;
  const ranked = [
    { layer: LAYERS.operative, score: scores.operative, priority: 3 },
    { layer: LAYERS.interpretive, score: scores.interpretive, priority: 2 },
    { layer: LAYERS.experiential, score: scores.experiential, priority: 1 },
  ].sort((a, b) => b.score - a.score || b.priority - a.priority);
  if (ranked[0].score < 4 || ranked[0].score - ranked[1].score < 2) return LAYERS.unresolved;
  return ranked[0].layer;
}

export function selectLatticeLayer(value) {
  return layerFromScores(scoreLatticeLayers(value));
}

function protectVerbatim(source) {
  let markerPrefix = "\uE000T2L";
  while (source.includes(markerPrefix)) markerPrefix += "X";
  const values = [];
  const patterns = [
    /`[^`\n]*`/gu,
    /\[[^\]\n]+\]\([^\n)]+\)/gu,
    /https?:\/\/[^\s<>]+/giu,
    /\b[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}\b/giu,
    /“[^”\n]*”/gu,
    /‘[^’\n]*’/gu,
    /"[^"\n]*"/gu,
    /<[^>\n]{1,500}>/gu,
  ];
  let masked = source;
  for (const pattern of patterns) {
    masked = masked.replace(pattern, (match) => {
      const marker = `${markerPrefix}${values.length}\uE001`;
      values.push({ marker, value: match });
      return marker;
    });
  }
  const restore = (value) => {
    let restored = value;
    for (const item of values) restored = restored.split(item.marker).join(item.value);
    return restored;
  };
  return { masked, values, restore };
}

function splitSentenceParts(paragraph) {
  if (!paragraph) return [];
  let rawParts;
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    rawParts = [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(paragraph)]
      .map(({ segment }) => segment);
  } else {
    rawParts = paragraph.match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/gu) ?? [paragraph];
  }
  return rawParts.map((raw) => {
    const leading = raw.match(/^\s*/u)?.[0] ?? "";
    const trailing = raw.match(/\s*$/u)?.[0] ?? "";
    const core = raw.slice(leading.length, raw.length - trailing.length || undefined);
    return { leading, core, trailing };
  }).filter((part) => part.core);
}

function splitClauses(sentence) {
  const clauses = [];
  const boundary = /;\s+|,\s+(?=(?:although|because|but|if|unless|while|yet)\b)/giu;
  let start = 0;
  for (const match of sentence.matchAll(boundary)) {
    const end = match.index + match[0].length;
    clauses.push(sentence.slice(start, end));
    start = end;
  }
  clauses.push(sentence.slice(start));
  return clauses.map((clause) => clause.trim()).filter(Boolean);
}

function analyzeDocument(masked, restore) {
  const pieces = masked.split(/(\n{2,})/u);
  const sentenceParts = [];
  const decisions = [];
  let paragraphIndex = 0;
  let sentenceIndex = 0;

  for (const piece of pieces) {
    if (/^\n{2,}$/u.test(piece)) {
      sentenceParts.push({ kind: "separator", text: piece });
      paragraphIndex += 1;
      continue;
    }
    for (const part of splitSentenceParts(piece)) {
      const currentSentenceIndex = sentenceIndex;
      sentenceIndex += 1;
      sentenceParts.push({
        kind: "sentence",
        ...part,
        paragraphIndex,
        sentenceIndex: currentSentenceIndex,
      });
      for (const clause of splitClauses(part.core)) {
        const scores = scoreLatticeLayers(restore(clause));
        const layer = layerFromScores(scores);
        decisions.push({
          text: restore(clause),
          maskedText: clause,
          layerId: layer.id,
          protected: scores.protectedOperative,
          inherited: false,
          paragraphIndex,
          sentenceIndex: currentSentenceIndex,
          wordCount: Math.max(1, countLatticeWords(restore(clause))),
          scores,
        });
      }
    }
  }

  const paragraphIds = new Set(decisions.map((decision) => decision.paragraphIndex));
  for (const id of paragraphIds) {
    const paragraphDecisions = decisions.filter((decision) => decision.paragraphIndex === id);
    const resolved = new Set(paragraphDecisions
      .filter((decision) => decision.layerId !== "unresolved")
      .map((decision) => decision.layerId));
    if (resolved.size !== 1) continue;
    const inheritedLayer = [...resolved][0];
    for (const decision of paragraphDecisions) {
      if (decision.layerId === "unresolved") {
        decision.layerId = inheritedLayer;
        decision.inherited = true;
      }
    }
  }

  return { sentenceParts, decisions };
}

const CONTRACTION_RULES = Object.freeze([
  ["cannot", /\bcan[’']t\b/giu], ["will not", /\bwon[’']t\b/giu],
  ["do not", /\bdon[’']t\b/giu], ["does not", /\bdoesn[’']t\b/giu],
  ["did not", /\bdidn[’']t\b/giu], ["is not", /\bisn[’']t\b/giu],
  ["are not", /\baren[’']t\b/giu], ["was not", /\bwasn[’']t\b/giu],
  ["were not", /\bweren[’']t\b/giu], ["have not", /\bhaven[’']t\b/giu],
  ["has not", /\bhasn[’']t\b/giu], ["had not", /\bhadn[’']t\b/giu],
  ["could not", /\bcouldn[’']t\b/giu], ["would not", /\bwouldn[’']t\b/giu],
  ["should not", /\bshouldn[’']t\b/giu], ["must not", /\bmustn[’']t\b/giu],
  ["I am", /\bI[’']m\b/gu], ["you are", /\byou[’']re\b/giu],
  ["we are", /\bwe[’']re\b/giu], ["they are", /\bthey[’']re\b/giu],
]);

const PHRASE_RULES = Object.freeze([
  { id: "connective-cause", pattern: /\b(?:due to|because of) the fact that\b/giu, replacement: "because" },
  { id: "connective-concession", pattern: /\bdespite the fact that\b/giu, replacement: "although" },
  { id: "connective-condition", pattern: /\bin the event that\b/giu, replacement: "if" },
  { id: "connective-exception", pattern: /\bwith the exception of\b/giu, replacement: "except for" },
  { id: "temporal-before", pattern: /\bprior to\b/giu, replacement: "before" },
  { id: "temporal-after", pattern: /\bsubsequent to\b/giu, replacement: "after" },
  { id: "frequency-always", pattern: /\bat all times\b/giu, replacement: "always" },
  { id: "frequency-daily", pattern: /\bon a daily basis\b/giu, replacement: "daily" },
  { id: "use", pattern: /\bmake use of\b/giu, replacement: "use" },
  { id: "consider", pattern: /\b(?:give consideration to|take into consideration)\b/giu, replacement: "consider" },
  { id: "decision-present", pattern: /\bmake a decision to\b/giu, replacement: "decide to" },
  { id: "decision-third-person", pattern: /\bmakes a decision to\b/giu, replacement: "decides to" },
  { id: "decision-past", pattern: /\bmade a decision to\b/giu, replacement: "decided to" },
  { id: "decision-progressive", pattern: /\bmaking a decision to\b/giu, replacement: "deciding to" },
  { id: "adjust-present", pattern: /\bmake an adjustment to\b/giu, replacement: "adjust" },
  { id: "adjust-third-person", pattern: /\bmakes an adjustment to\b/giu, replacement: "adjusts" },
  { id: "adjust-past", pattern: /\bmade an adjustment to\b/giu, replacement: "adjusted" },
  { id: "adjust-progressive", pattern: /\bmaking an adjustment to\b/giu, replacement: "adjusting" },
  { id: "change-present", pattern: /\bmake a change\b/giu, replacement: "change" },
  { id: "change-third-person", pattern: /\bmakes a change\b/giu, replacement: "changes" },
  { id: "change-past", pattern: /\bmade a change\b/giu, replacement: "changed" },
  { id: "change-progressive", pattern: /\bmaking a change\b/giu, replacement: "changing" },
  { id: "explain-past", pattern: /\bprovided an explanation of\b/giu, replacement: "explained" },
  { id: "investigate-past", pattern: /\bconducted an investigation of\b/giu, replacement: "investigated" },
  { id: "analyze-past", pattern: /\bconducted an analysis of\b/giu, replacement: "analyzed" },
  { id: "evaluate-past", pattern: /\bperformed an evaluation of\b/giu, replacement: "evaluated" },
  { id: "conclude-past", pattern: /\bcame to the conclusion that\b/giu, replacement: "concluded that" },
  { id: "possession-present", pattern: /\bis in possession of\b/giu, replacement: "has" },
]);

function applyExactRules(source, rules) {
  let text = source;
  const changes = [];
  for (const rule of rules) {
    text = text.replace(rule.pattern, (before) => {
      const after = replacementCase(before, rule.replacement);
      if (after === before) return before;
      changes.push({ id: rule.id, before, after });
      return after;
    });
  }
  return { text, changes };
}

function applyLexicalRules(source) {
  let text = source;
  const changes = [];
  for (const [replacement, pattern] of CONTRACTION_RULES) {
    text = text.replace(pattern, (before) => {
      const after = replacementCase(before, replacement);
      changes.push({ id: "expand-contraction", before, after });
      return after;
    });
  }
  const phrases = applyExactRules(text, PHRASE_RULES);
  text = phrases.text;
  changes.push(...phrases.changes);

  if (!/\b(?:may|might|must|not|only|should|unless|will|would)\b/iu.test(text)) {
    text = text.replace(/\bin order to (?=(?:address|allow|analyze|build|change|check|clarify|close|compare|create|document|explain|help|improve|keep|open|preserve|prevent|reduce|review|show|support|test|understand|use)\b)/giu, (before) => {
      const after = replacementCase(before, "to ");
      changes.push({ id: "purpose", before, after });
      return after;
    });
  }
  text = text.replace(/\b(?:is|are) able to\b/giu, (before) => {
    const after = replacementCase(before, "can");
    changes.push({ id: "ability", before, after });
    return after;
  });
  return { text, changes };
}

function applyStructuralRule(source, layerId) {
  if (layerId === "experiential") {
    const body = /^(She|He|They) felt (the [\p{L}\p{M}][\p{L}\p{M} -]{0,50}) in (her|his|their) (hand|hands|palm|palms|finger|fingers|arm|arms|foot|feet)\.$/iu.exec(source);
    if (body) {
      const agreement = { she: "her", he: "his", they: "their" }[body[1].toLocaleLowerCase("en-US")];
      if (agreement === body[3].toLocaleLowerCase("en-US")) {
        const after = `${titleCaseFirst(body[3])} ${body[4]} felt ${body[2]}.`;
        return { text: after, changes: [{ id: "embodied-location", before: source, after }] };
      }
    }
  }

  if (layerId === "interpretive") {
    const responsibility = /^([\p{Lu}][\p{L}\p{M}.-]*(?: [\p{L}\p{M}.-]+){0,5}) has responsibility for ([^,;.!?]{1,100})\.$/u.exec(source);
    if (responsibility && !/\b(?:primary|shared|sole)\b/iu.test(source)) {
      const after = `${responsibility[1]} is responsible for ${responsibility[2]}.`;
      return { text: after, changes: [{ id: "responsibility", before: source, after }] };
    }

    const existential = /^There (was|has been) an (increase|decrease) in ([^\d,;.!?]{1,80})\.$/u.exec(source);
    if (existential) {
      const verb = existential[2] === "increase" ? "increase" : "decrease";
      const afterVerb = existential[1] === "was" ? `${verb}d` : `has ${verb}d`;
      const after = `${titleCaseFirst(existential[3])} ${afterVerb}.`;
      return { text: after, changes: [{ id: "explicit-change", before: source, after }] };
    }

    const repeated = /^((?:The|A|An) [\p{L}\p{M}][\p{L}\p{M} -]{0,40}) ([\p{Ll}][\p{L}\p{M}-]*) ([^,;.!?]{1,60}), and \1 ([\p{Ll}][\p{L}\p{M}-]*) ([^,;.!?]{1,60})\.$/u.exec(source);
    if (repeated && !/\b(?:may|might|must|not|only|should|unless|would)\b/iu.test(source)) {
      const after = `${repeated[1]} ${repeated[2]} ${repeated[3]} and ${repeated[4]} ${repeated[5]}.`;
      return { text: after, changes: [{ id: "shared-subject", before: source, after }] };
    }
  }

  return { text: source, changes: [] };
}

function countMatches(value, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return [...value.matchAll(new RegExp(pattern.source, flags))].length;
}

function traceMatches(value, pattern) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return [...value.matchAll(new RegExp(pattern.source, flags))].map((match) => match[0].toLocaleLowerCase("en-US"));
}

function semanticSentinels(value) {
  return {
    negation: countMatches(value, /\b(?:cannot|can[’']t|do not|don[’']t|does not|doesn[’']t|did not|didn[’']t|is not|isn[’']t|are not|aren[’']t|was not|wasn[’']t|were not|weren[’']t|have not|haven[’']t|has not|hasn[’']t|had not|hadn[’']t|could not|couldn[’']t|would not|wouldn[’']t|should not|shouldn[’']t|must not|mustn[’']t|never|no)\b/iu),
    can: countMatches(value, /\b(?:can|cannot|can[’']t|is able to|are able to)\b/iu),
    could: countMatches(value, /\b(?:could|could not|couldn[’']t)\b/iu),
    should: countMatches(value, /\b(?:should|should not|shouldn[’']t)\b/iu),
    would: countMatches(value, /\b(?:would|would not|wouldn[’']t)\b/iu),
    must: countMatches(value, /\b(?:must|must not|mustn[’']t)\b/iu),
    uncertainty: countMatches(value, /\b(?:apparently|likely|may|might|perhaps|possibly|suggest(?:ed|s)?)\b/iu),
    condition: countMatches(value, /\b(?:if|in the event that)\b/iu),
    exception: countMatches(value, /\b(?:except for|unless|with the exception of)\b/iu),
    cause: countMatches(value, /\b(?:because|because of the fact that|due to the fact that)\b/iu),
    concession: countMatches(value, /\b(?:although|despite the fact that)\b/iu),
    chronologyBefore: countMatches(value, /\b(?:before|prior to)\b/iu),
    chronologyAfter: countMatches(value, /\b(?:after|subsequent to)\b/iu),
    frequencyAlways: countMatches(value, /\b(?:always|at all times)\b/iu),
    frequencyDaily: countMatches(value, /\b(?:daily|on a daily basis)\b/iu),
    quantities: traceMatches(value, /\b\d+(?:[.,]\d+)?(?:\s?(?:%|°[CF]|hours?|hrs?|kg|mg|mcg|mL|ml|minutes?|mins?|seconds?|secs?))?\b/giu),
  };
}

function normalizedWordSequence(value) {
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    return [...new Intl.Segmenter("en", { granularity: "word" }).segment(value)]
      .filter((part) => part.isWordLike)
      .map((part) => part.segment.toLocaleLowerCase("en-US"));
  }
  return (value.match(WORD_FALLBACK) ?? []).map((word) => word.toLocaleLowerCase("en-US"));
}

function sameArray(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function candidatePasses(source, candidate, protectedValues) {
  if (candidate.length > LATTICE_INPUT_SAFETY_LIMIT + 2_048) return false;
  for (const item of protectedValues) {
    if (source.split(item.marker).length !== candidate.split(item.marker).length) return false;
  }
  if (JSON.stringify(semanticSentinels(source)) !== JSON.stringify(semanticSentinels(candidate))) return false;
  return !sameArray(normalizedWordSequence(source), normalizedWordSequence(candidate));
}

function candidateForSentence(source, layerId, protectedValues) {
  const lexical = applyLexicalRules(source);
  const structuralFromLexical = applyStructuralRule(lexical.text, layerId);
  const structural = applyStructuralRule(source, layerId);
  const variants = [
    {
      rank: 3,
      id: "lexical-and-structural",
      text: structuralFromLexical.text,
      changes: [...lexical.changes, ...structuralFromLexical.changes],
    },
    { rank: 2, id: "structural", ...structural },
    { rank: 1, id: "lexical", ...lexical },
  ].filter((variant) => variant.changes.length > 0 && candidatePasses(source, variant.text, protectedValues));
  variants.sort((a, b) => b.changes.length - a.changes.length
    || b.rank - a.rank
    || a.text.length - b.text.length
    || a.id.localeCompare(b.id));
  return variants[0] ?? null;
}

function summarizeLayers(decisions) {
  const weights = new Map();
  for (const decision of decisions) {
    if (decision.layerId === "unresolved") continue;
    weights.set(decision.layerId, (weights.get(decision.layerId) ?? 0) + decision.wordCount);
  }
  const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (ranked.length === 0) {
    return { primary: LAYERS.unresolved, layersUsed: [], label: LAYERS.unresolved.label };
  }
  const layersUsed = ranked.map(([id]) => id);
  const primary = LAYERS[ranked[0][0]];
  if (ranked.length === 1) return { primary, layersUsed, label: primary.label };
  const others = ranked.slice(1).map(([id]) => LAYERS[id].label.toLocaleLowerCase("en-US"));
  return { primary, layersUsed, label: `${primary.label}-led · ${others.join(" and ")} passages` };
}

const ACTIONABLE_SOURCE = /\b(?:am|are|be|been|being|is|was|were)\s+[\p{L}\p{M}-]+ed\s+by\b|\b(?:make|made|makes|making)\s+(?:a|an|the)\s+(?:adjustment|change|decision|evaluation|recommendation|review)\b|\b(?:as if|as though|like a|like an|velvet fist)\b/iu;

function decisionClearsPositiveCheck(decision) {
  if (decision.layerId === "unresolved" || decision.inherited) return false;
  if (decision.protected) return decision.layerId === "operative";
  if (decision.wordCount > 25 || resetAndTest(ACTIONABLE_SOURCE, decision.text)) return false;
  if (decision.layerId === "experiential") {
    return decision.wordCount <= 18
      && decision.scores.experiential >= 5
      && decision.scores.interpretive === 0
      && (
        (resetAndTest(MATERIAL_REFERENT, decision.text)
          && (resetAndTest(EXPERIENTIAL_ACTION, decision.text) || resetAndTest(SENSORY_STATE, decision.text)))
        || (resetAndTest(RELATIONAL_REFERENT, decision.text)
          && resetAndTest(PERCEPTION_OR_REFLECTION, decision.text))
      )
      && !resetAndTest(ORNAMENTAL_ABSTRACTION, decision.text)
      && !/\b(?:although|because|whereas|while)\b/iu.test(decision.text);
  }
  if (decision.layerId === "interpretive") {
    return decision.scores.interpretive >= 7
      && resetAndTest(CAUSAL_RELATION, decision.text)
      && resetAndTest(INSTITUTIONAL_REFERENT, decision.text)
      && resetAndTest(ANALYTIC_RELATION, decision.text);
  }
  return false;
}

function qualityFindings(source, decisions, transformedDecisions) {
  const findings = [];
  if (decisions.some((decision) => decision.layerId === "unresolved")) {
    findings.push({ id: "unresolved-layer", message: "At least one passage lacks enough layer evidence." });
  }
  if (/\b(?:bad|good|nice|something|somehow|stuff|thing)\b/iu.test(source)) {
    findings.push({ id: "underspecified-language", message: "The source contains language the bounded rules cannot safely make more specific." });
  }
  const sentences = source.match(/[^.!?]+[.!?]?/gu) ?? [];
  if (sentences.some((sentence) => countLatticeWords(sentence) > 45)) {
    findings.push({ id: "long-scope", message: "A long sentence exceeds the bounded structural checks." });
  }
  if (decisions.some((decision, index) =>
    !transformedDecisions.has(index) && !decisionClearsPositiveCheck(decision))) {
    findings.push({
      id: "conformance-not-established",
      message: "At least one unchanged passage did not clear the narrow positive conformance check.",
    });
  }
  return findings;
}

export function textToLattice(value) {
  if (typeof value !== "string") throw new TypeError("Text-to-Lattice input must be text.");
  if (value.length > LATTICE_INPUT_SAFETY_LIMIT) {
    throw new RangeError(`Text-to-Lattice input is too long for the ${LATTICE_INPUT_SAFETY_LIMIT.toLocaleString("en-US")}-character safety limit.`);
  }
  if (DISALLOWED_CONTROLS.test(value)) throw new RangeError("Text-to-Lattice input contains unsupported control characters.");

  const source = value.replace(/\r\n?/gu, "\n").trim();
  const wordCount = countLatticeWords(source);
  if (wordCount === 0) throw new RangeError("Enter text with at least one word before running Text-to-Lattice.");
  if (wordCount > LATTICE_WORD_LIMIT) {
    throw new RangeError(`Text-to-Lattice accepts up to ${LATTICE_WORD_LIMIT} words; this input has ${wordCount}.`);
  }

  const protectedText = protectVerbatim(source);
  const analysis = analyzeDocument(protectedText.masked, protectedText.restore);
  const changes = [];
  const transformedDecisions = new Set();
  const outputPieces = [];

  for (const part of analysis.sentenceParts) {
    if (part.kind === "separator") {
      outputPieces.push(part.text);
      continue;
    }
    const sentenceDecisions = analysis.decisions
      .map((decision, index) => ({ decision, index }))
      .filter(({ decision }) => decision.sentenceIndex === part.sentenceIndex);
    let cursor = 0;
    let rewritten = "";
    for (const { decision, index } of sentenceDecisions) {
      const clauseStart = part.core.indexOf(decision.maskedText, cursor);
      if (clauseStart < 0) continue;
      rewritten += part.core.slice(cursor, clauseStart);
      const candidate = decision.protected
        ? null
        : candidateForSentence(decision.maskedText, decision.layerId, protectedText.values);
      rewritten += candidate?.text ?? decision.maskedText;
      cursor = clauseStart + decision.maskedText.length;
      if (candidate) {
        transformedDecisions.add(index);
        changes.push(...candidate.changes.map((change) => ({ ...change, layerId: decision.layerId })));
      }
    }
    rewritten += part.core.slice(cursor);
    outputPieces.push(part.leading, rewritten, part.trailing);
  }

  const summary = summarizeLayers(analysis.decisions);
  const findings = qualityFindings(source, analysis.decisions, transformedDecisions);
  const publicSegments = analysis.decisions.map((decision) => Object.freeze({
    text: decision.text,
    layerId: decision.layerId,
    protected: decision.protected,
    inherited: decision.inherited,
  }));

  if (changes.length > 0 && findings.length === 0) {
    const text = protectedText.restore(outputPieces.join(""));
    return Object.freeze({
      version: TEXT_TO_LATTICE_VERSION,
      status: "transformed",
      conformance: "bounded-checks-passed",
      text,
      wordCount,
      primaryLayer: summary.primary.id,
      layerId: summary.primary.id,
      layerLabel: summary.label,
      layersUsed: Object.freeze(summary.layersUsed),
      segments: Object.freeze(publicSegments),
      changes: Object.freeze(changes),
      revisions: Object.freeze(changes),
      revisionCount: changes.length,
      findings: Object.freeze(findings),
    });
  }

  if (findings.length === 0 && analysis.decisions.length > 0) {
    return Object.freeze({
      version: TEXT_TO_LATTICE_VERSION,
      status: "already-bounded-conformant",
      conformance: "bounded-checks-passed",
      text: source,
      wordCount,
      primaryLayer: summary.primary.id,
      layerId: summary.primary.id,
      layerLabel: summary.label,
      layersUsed: Object.freeze(summary.layersUsed),
      segments: Object.freeze(publicSegments),
      changes: Object.freeze([]),
      revisions: Object.freeze([]),
      revisionCount: 0,
      findings: Object.freeze([]),
    });
  }

  return Object.freeze({
    version: TEXT_TO_LATTICE_VERSION,
    status: "no-safe-candidate",
    conformance: "not-established",
    text: null,
    wordCount,
    primaryLayer: summary.primary.id,
    layerId: summary.primary.id,
    layerLabel: summary.label,
    layersUsed: Object.freeze(summary.layersUsed),
    segments: Object.freeze(publicSegments),
    changes: Object.freeze([]),
    revisions: Object.freeze([]),
    revisionCount: 0,
    findings: Object.freeze(findings),
  });
}
