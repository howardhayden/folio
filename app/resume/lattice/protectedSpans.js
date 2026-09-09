const SENTENCE_SEGMENTER = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("und", { granularity: "sentence" })
  : null;

const DIALOGUE_PAIRS = Object.freeze([
  ["“", "”"],
  ["‘", "’"],
  ["\"", "\""],
  ["«", "»"],
  ["‹", "›"],
  ["„", "“"],
  ["「", "」"],
  ["『", "』"],
]);

const COMMAND_VERBS = new Set([
  "add", "apply", "avoid", "call", "check", "choose", "click", "close",
  "conduct", "contact", "crawl", "dial", "do", "enable", "enter", "evacuate", "follow",
  "give", "hold", "install", "keep", "make", "notify", "open", "perform", "place", "press", "provide", "remove",
  "reboot", "recover", "reset", "restart", "restore", "rest", "retry", "rinse", "rollback", "save", "seek", "select", "set", "stop", "submit", "take",
  "tap", "touch", "turn", "type", "undo", "unplug", "update", "use", "wait", "wear",
]);

const DEONTIC_SIGNAL = /\b(?:has to|have to|must|need(?:s)? to|required to|should|shall)\b/iu;
const SAFETY_SIGNAL = /\b(?:alarm|allerg(?:ic|y)|bleed(?:ing|s)?|danger|dizz(?:iness|y)|emergency|evacuate|faint(?:ed|ing)?|fire|help|injur(?:ed|ies|y)|overdose|rash|risk|smoke|symptom|unconscious|warning)\b/iu;
const MEDICAL_SIGNAL = /\b(?:clinician|doctor|dose|hospital|medical care|medication|medicine|nurse|pain|prescription|tablet|treatment|wound)\b/iu;
const ACCESSIBILITY_SIGNAL = /\b(?:accessibility|alt text|caption(?:s|ing)?|keyboard|ramp|screen[ -]reader|transcript|wheelchair)\b/iu;
const CONTACT_SIGNAL = /\b(?:call|contact|dial|email|notify|phone|text)\b/iu;
const TIMING_OR_QUANTITY = /\b(?:before|after|during|every|immediately|until|within)\b|\b\d+(?:[.,]\d+)?\s?(?:%|°[CF]|hours?|hrs?|kg|mg|mcg|mL|ml|minutes?|mins?|seconds?|secs?)\b/iu;
const RECOVERY_SIGNAL = /\b(?:backup|reboot|recover(?:y|ed|ing)?|reset|restart|restore|retry|roll(?:\s+|-)?back|undo)\b/iu;
const PROHIBITION_SIGNAL = /\b(?:do not|don[’']t|must not|never|no longer|cannot|can[’']t|unless)\b/iu;
const CLASSIFICATION_MASK = /`[^`\r\n]*`|<!--[^]*?-->|<\/?[A-Za-z][^>\r\n]*>|\[[^\]\r\n]+\]\([^\r\n)]+\)/gu;
const CLAUSE_BOUNDARY = /;\s+|,\s+(?=(?:although|because|but|if|unless|while|yet)\b)/giu;

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
  if (DEONTIC_SIGNAL.test(value)) return true;
  const match = firstCommandVerb(value);
  if (!match) return false;
  if (match.verb === "press" && /^(?:coverage|release|secretary|attention)\b/iu.test(match.tail)) return false;
  if (match.verb === "tap" && /^water\b/iu.test(match.tail)) return false;
  if (match.verb === "contact" && /^between\b/iu.test(match.tail)) return false;
  return true;
}

function isProtectedInstruction(value) {
  return looksLikeCommand(value) && (
    SAFETY_SIGNAL.test(value)
    || MEDICAL_SIGNAL.test(value)
    || ACCESSIBILITY_SIGNAL.test(value)
    || CONTACT_SIGNAL.test(value)
    || TIMING_OR_QUANTITY.test(value)
    || RECOVERY_SIGNAL.test(value)
    || PROHIBITION_SIGNAL.test(value)
  );
}

function trimRange(value, startUtf16, endUtf16) {
  let start = startUtf16;
  let end = endUtf16;
  while (start < end && /\s/u.test(value[start])) start += 1;
  while (end > start && /\s/u.test(value[end - 1])) end -= 1;
  return { startUtf16: start, endUtf16: end };
}

function wordScalarBefore(value, index) {
  if (index <= 0) return "";
  let start = index - 1;
  const unit = value.charCodeAt(start);
  if (unit >= 0xDC00 && unit <= 0xDFFF && start > 0) start -= 1;
  return String.fromCodePoint(value.codePointAt(start));
}

function wordScalarAfter(value, index) {
  if (index + 1 >= value.length) return "";
  return String.fromCodePoint(value.codePointAt(index + 1));
}

function pairedDialogueMatches(value, opening, closing) {
  const matches = [];
  let cursor = 0;
  for (;;) {
    const startUtf16 = value.indexOf(opening, cursor);
    if (startUtf16 < 0) break;
    if (opening === "\"" && /\p{N}/u.test(wordScalarBefore(value, startUtf16))) {
      cursor = startUtf16 + opening.length;
      continue;
    }
    let endMarkerUtf16 = value.indexOf(closing, startUtf16 + opening.length);
    while (endMarkerUtf16 >= 0 && closing === "’"
      && /[\p{L}\p{M}\p{N}]/u.test(wordScalarBefore(value, endMarkerUtf16))
      && /[\p{L}\p{M}\p{N}]/u.test(wordScalarAfter(value, endMarkerUtf16))) {
      endMarkerUtf16 = value.indexOf(closing, endMarkerUtf16 + closing.length);
    }
    if (endMarkerUtf16 < 0) break;
    const endUtf16 = endMarkerUtf16 + closing.length;
    matches.push({
      literalType: "protected-dialogue",
      startUtf16,
      endUtf16,
      text: value.slice(startUtf16, endUtf16),
    });
    cursor = endUtf16;
  }
  return matches;
}

function dialogueMatches(value) {
  const matches = DIALOGUE_PAIRS.flatMap(([opening, closing]) => (
    pairedDialogueMatches(value, opening, closing)
  )).sort((left, right) => left.startUtf16 - right.startUtf16 || right.endUtf16 - left.endUtf16);
  const nonOverlapping = [];
  for (const match of matches) {
    if (!nonOverlapping.some((kept) => match.startUtf16 < kept.endUtf16 && match.endUtf16 > kept.startUtf16)) {
      nonOverlapping.push(match);
    }
  }
  return nonOverlapping;
}

function maskedClause(value, startUtf16, endUtf16, dialogue) {
  const characters = [...value.slice(startUtf16, endUtf16)];
  for (const span of dialogue) {
    const overlapStart = Math.max(startUtf16, span.startUtf16);
    const overlapEnd = Math.min(endUtf16, span.endUtf16);
    if (overlapStart >= overlapEnd) continue;
    const prefixLength = [...value.slice(startUtf16, overlapStart)].length;
    const overlapLength = [...value.slice(overlapStart, overlapEnd)].length;
    characters.splice(prefixLength, overlapLength, ...Array(overlapLength).fill(" "));
  }
  return characters.join("").replace(CLASSIFICATION_MASK, (match) => " ".repeat(match.length));
}

function protectedInstructionMatches(value, dialogue) {
  const sentences = SENTENCE_SEGMENTER ? [...SENTENCE_SEGMENTER.segment(value)] : [{ segment: value, index: 0 }];
  const matches = [];
  for (const sentence of sentences) {
    const clauseEnds = [];
    for (const boundary of sentence.segment.matchAll(CLAUSE_BOUNDARY)) {
      clauseEnds.push(boundary.index + boundary[0].length);
    }
    let relativeStart = 0;
    for (const relativeEnd of [...clauseEnds, sentence.segment.length]) {
      const rawStart = sentence.index + relativeStart;
      const rawEnd = sentence.index + relativeEnd;
      relativeStart = relativeEnd;
      const { startUtf16, endUtf16 } = trimRange(value, rawStart, rawEnd);
      if (startUtf16 >= endUtf16) continue;
      const classified = maskedClause(value, startUtf16, endUtf16, dialogue);
      if (!isProtectedInstruction(classified)) continue;
      matches.push({
        literalType: "protected-instruction",
        startUtf16,
        endUtf16,
        text: value.slice(startUtf16, endUtf16),
      });
    }
  }
  return matches;
}

export function latticeProtectedLiteralMatches(value) {
  const source = String(value ?? "");
  const dialogue = dialogueMatches(source);
  const instructions = protectedInstructionMatches(source, dialogue).filter((instruction) => (
    dialogue.every((span) => (
      instruction.startUtf16 >= span.endUtf16
      || instruction.endUtf16 <= span.startUtf16
      || (instruction.startUtf16 <= span.startUtf16 && instruction.endUtf16 >= span.endUtf16)
    ))
  ));
  const uncoveredDialogue = dialogue.filter((span) => (
    !instructions.some((instruction) => (
      instruction.startUtf16 <= span.startUtf16 && instruction.endUtf16 >= span.endUtf16
    ))
  ));
  return Object.freeze([...uncoveredDialogue, ...instructions]
    .sort((left, right) => left.startUtf16 - right.startUtf16 || right.endUtf16 - left.endUtf16)
    .map((span) => Object.freeze(span)));
}
