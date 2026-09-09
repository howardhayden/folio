import { countLatticeWords, hasInvalidLatticeBidiIsolates } from "./inputPolicy.js";
import { latticeProtectedLiteralMatches } from "./protectedSpans.js";

export const PASSAGE_WORD_LIMIT = 36;
export const PASSAGE_CHARACTER_LIMIT = 420;
// Two maximum ordinary passages fit one initial work group. This bounded
// compaction keeps every valid 700-word/12k-character source below the public
// group ceiling in practice; an overfull model prompt can still split once at
// the stage boundary without changing source units.
export const BATCH_WORD_TARGET = 72;
export const BATCH_CHARACTER_TARGET = 840;
export const BATCH_PASSAGE_LIMIT = 4;
export const SOURCE_SPAN_WORD_TARGET = 6;
export const SOURCE_SPAN_CHARACTER_LIMIT = 96;
export const SOURCE_SPAN_LIMIT = 12;
export const LITERAL_SOURCE_SPAN_LIMIT = 24;
export const LITERAL_BATCH_SPAN_LIMIT = 24;
export const MODEL_SOURCE_SPAN_LIMIT = SOURCE_SPAN_LIMIT + (LITERAL_BATCH_SPAN_LIMIT * 2);
export const LATTICE_PASSAGE_LIMIT = 64;
export const LATTICE_BATCH_LIMIT = 32;
export const LATTICE_EXECUTION_BATCH_LIMIT = 64;
// Balanced isolate controls are host-owned boundaries. Bounded isolates can
// remain one evidence unit; controls surrounding longer logical text are
// lifted into exact source gaps so dense valid input can still be processed in
// ordinary bounded passages without asking a model to reproduce the controls.

const GRAPHEME_SEGMENTER = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("und", { granularity: "grapheme" })
  : null;
const WORD_SEGMENTER = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("und", { granularity: "word" })
  : null;
const SENTENCE_SEGMENTER = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("und", { granularity: "sentence" })
  : null;
const PARAGRAPH_BREAK = /(?:(?:\r\n|\n|\r)[ \t]*(?:\r\n|\n|\r)|\u2029)/u;
const SINGLE_PERIOD_TOKEN = /^["'“‘«（(\[]*([\p{L}\p{M}]{1,12})\.["'”’»）)\]]*$/u;
const NUMERIC_PERIOD_FRAGMENT = /^["'“‘«（(\[]*[\p{N}]+(?:[.,:/-][\p{N}]+)*\.["'”’»）)\]]*$/u;
const SENTENCE_TERMINAL = /[.!?。！？]["'”’»）)\]]*$/u;
const QUOTED_TERMINAL = /[.!?。！？]["'”’»）)]$/u;
const COMMON_ABBREVIATION = /^(?:mr|mrs|ms|mx|dr|prof|asst|assoc|rev|sr|jr|st|mt|gen|col|lt|sgt|capt|cmdr|adm|hon|pres|gov|sen|rep|supt|det|fig|figs|eq|eqs|dept|est|inc|ltd|co|corp|vs|etc)$/iu;
const ATTRIBUTION_CUE = /\b(?:said|asked|replied|responded|answered|added|called|cried|shouted|whispered|murmured|muttered|observed|remarked|noted|explained|warned|urged|insisted|announced|declared|admitted|conceded|continued|drawled|yelled|screamed|offered|told|wrote)\b/iu;
const NUMERIC_BACKWARD_PRECURSOR = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|section|sec|part|chapter|ch|item|figure|fig|number|no)\.$/iu;

function suspectedSingleTokenAbbreviation(value) {
  const stem = SINGLE_PERIOD_TOKEN.exec(value)?.[1] ?? "";
  if (!stem) return false;
  return stem.length === 1 || COMMON_ABBREVIATION.test(stem);
}

function suspectedAbbreviationChain(value) {
  const tokens = value.trim().split(/\s+/u);
  return tokens.length > 0 && tokens.every(suspectedSingleTokenAbbreviation);
}

function looksLikeQuotedAttribution(value) {
  const wordCount = countLatticeWords(value);
  if (wordCount < 2 || wordCount > 12) return false;
  const words = value.match(/[\p{L}\p{M}]+/gu) ?? [];
  const cueIndex = words.findIndex((word) => ATTRIBUTION_CUE.test(word));
  if (cueIndex < 1 || cueIndex > 2) return false;
  // A short clause after a closing quotation is not necessarily attribution:
  // “…” The sign said stop. has an inanimate determiner subject and a direct
  // object. Keep those as independent planning units instead of assigning the
  // sign a speaker role. Named/pronominal speakers and unambiguously responsive
  // reporting verbs remain eligible without maintaining an open-ended noun list.
  const determinerSubject = /^(?:the|a|an)\b/iu.test(words[0] ?? "");
  const cue = words[cueIndex]?.toLocaleLowerCase("und") ?? "";
  const ambiguousInanimateCue = new Set(["said", "wrote", "noted", "observed"]);
  const hasObjectLikeTail = words.length > cueIndex + 1
    && !/^(?:after|before|while|when|softly|quietly|loudly|again)$/iu.test(words[cueIndex + 1]);
  return !(determinerSubject && ambiguousInanimateCue.has(cue) && hasObjectLikeTail);
}

const LITERAL_PATTERNS = Object.freeze([
  ["markdown-link", /\[[^\]\r\n]+\]\([^\r\n)]+\)/gu],
  ["url", /https?:\/\/[^\s<>"'`]+/gu],
  ["email", /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu],
  ["phone", /(?<![\p{L}\p{N}])(?:(?:\+[ \t]*)?\(?\d[\d(). \t-]{5,}\d)(?![\p{L}\p{N}])/gu],
  ["inline-code", /`[^`\r\n]*`/gu],
  ["markup", /<!--[\s\S]*?-->|<!DOCTYPE\s+[A-Za-z][^>\r\n]*>|<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s+[A-Za-z_:][A-Za-z0-9:._-]*(?:=(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/giu],
  ["quantity", /(?:^|(?<=[\s([{,:;]))(?:[<>≤≥≈~][ \t]*)?[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:\s*(?:-|–|—|to)\s*[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))?(?:(?:%|°[CF]|[\p{L}\p{M}µμ]+(?:\/[\p{L}\p{M}µμ]+)?)|[ \t]+(?:percent|degrees?|seconds?|minutes?|hours?|days?|weeks?|months?|years?|milliseconds?|kilograms?|grams?|milligrams?|micrograms?|liters?|litres?|milliliters?|millilitres?|meters?|metres?|centimeters?|centimetres?|millimeters?|millimetres?|kilometers?|kilometres?|miles?|yards?|feet|foot|inches?|pounds?|ounces?|bytes?|kilobytes?|megabytes?|gigabytes?|terabytes?|ms|kg|mg|µg|μg|ml|cm|mm|km|mi|yd|ft|lb|oz|kb|mb|gb|tb))?/giu],
  ["formal-identifier", /(?<![\p{L}\p{N}])(?:[A-Z]{2,}[A-Z0-9]*(?:[-_.:/][A-Z0-9]+)+|[A-Z]{2,}\d+[A-Z0-9._/-]*|[A-Za-z]+-\d+(?:[-_.]\d+)*|v\d+(?:\.\d+){1,3}|[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12})(?![\p{L}\p{N}])/gu],
]);

function safeCodeUnitBoundary(value, offset) {
  if (offset <= 0 || offset >= value.length) return offset;
  const before = value.charCodeAt(offset - 1);
  const after = value.charCodeAt(offset);
  return before >= 0xD800 && before <= 0xDBFF && after >= 0xDC00 && after <= 0xDFFF
    ? offset - 1
    : offset;
}

function safeGraphemeBoundary(value, offset) {
  const safeOffset = safeCodeUnitBoundary(value, offset);
  if (safeOffset <= 0 || safeOffset >= value.length || !GRAPHEME_SEGMENTER) {
    return safeOffset;
  }
  const part = GRAPHEME_SEGMENTER.segment(value).containing(safeOffset);
  return part?.index ?? safeOffset;
}

function nextGraphemeBoundary(value, offset) {
  if (offset < 0) return 0;
  if (offset >= value.length) return value.length;
  if (GRAPHEME_SEGMENTER) {
    const part = GRAPHEME_SEGMENTER.segment(value).containing(offset);
    return part ? part.index + part.segment.length : value.length;
  }
  const first = value.charCodeAt(offset);
  return first >= 0xD800 && first <= 0xDBFF && offset + 1 < value.length
    && value.charCodeAt(offset + 1) >= 0xDC00 && value.charCodeAt(offset + 1) <= 0xDFFF
    ? offset + 2
    : offset + 1;
}

function trimLeadingWhitespaceGraphemes(value, start, end) {
  let cursor = safeGraphemeBoundary(value, start);
  while (cursor < end) {
    const part = GRAPHEME_SEGMENTER?.segment(value).containing(cursor);
    if (!part || part.index !== cursor || !/^\s+$/u.test(part.segment)) break;
    cursor = part.index + part.segment.length;
  }
  return cursor;
}

function trimTrailingWhitespaceGraphemes(value, start, end) {
  let cursor = safeGraphemeBoundary(value, end);
  while (cursor > start) {
    const part = GRAPHEME_SEGMENTER?.segment(value).containing(cursor - 1);
    if (!part || part.index + part.segment.length !== cursor || !/^\s+$/u.test(part.segment)) break;
    cursor = part.index;
  }
  return cursor;
}

function wordLimitedEnd(value, start, hardEnd, wordLimit = PASSAGE_WORD_LIMIT) {
  const slice = value.slice(start, hardEnd);
  if (WORD_SEGMENTER) {
    const words = [...WORD_SEGMENTER.segment(slice)]
      .filter((part) => part.isWordLike);
    if (words.length <= wordLimit) return hardEnd;
    return start + words[wordLimit].index;
  }

  const wordPattern = /[\p{L}\p{M}\p{N}]+(?:[’'_-][\p{L}\p{M}\p{N}]+)*/gu;
  let count = 0;
  for (const match of slice.matchAll(wordPattern)) {
    count += 1;
    if (count > wordLimit) return start + match.index;
  }
  return hardEnd;
}

function preferredBreak(value, start, proposedEnd, runEnd) {
  if (proposedEnd >= runEnd) return runEnd;
  if (/\s/u.test(value[proposedEnd])) return proposedEnd;
  const window = value.slice(start, proposedEnd);
  const minimum = Math.max(1, Math.floor(window.length * 0.42));
  const sentencePattern = /[.!?。！？](?:["'”’»)\]]*)\s+/gu;
  let sentenceEnd = -1;
  for (const match of window.matchAll(sentencePattern)) {
    const candidate = match.index + match[0].length;
    if (candidate >= minimum) sentenceEnd = candidate;
  }
  if (sentenceEnd > 0) return start + sentenceEnd;

  const whitespacePattern = /\s+/gu;
  let whitespaceEnd = -1;
  for (const match of window.matchAll(whitespacePattern)) {
    if (match.index >= minimum) whitespaceEnd = match.index + match[0].length;
  }
  if (whitespaceEnd > 0) return start + whitespaceEnd;

  return safeGraphemeBoundary(value, proposedEnd);
}

function literalContainingBoundary(literalIntervals, boundary) {
  return literalIntervals.find(({ startUtf16, endUtf16 }) => (
    startUtf16 < boundary && boundary < endUtf16
  )) ?? null;
}

function literalSafePassageEnd(literalIntervals, cursor, proposedEnd) {
  const literal = literalContainingBoundary(literalIntervals, proposedEnd);
  if (!literal) return proposedEnd;
  // Prefer ending before a literal that begins inside the current unit. When
  // the unit begins with that literal, carry the complete literal even if it
  // exceeds the ordinary passage target; it will become an immutable unit.
  return literal.startUtf16 > cursor ? literal.startUtf16 : literal.endUtf16;
}

function outerBidiIsolateRanges(value) {
  const ranges = [];
  const stack = [];
  for (let index = 0; index < value.length; index += 1) {
    const control = value[index];
    if (/[\u2066-\u2068]/u.test(control)) {
      stack.push(index);
    } else if (control === "\u2069") {
      const startUtf16 = stack.pop();
      if (startUtf16 === undefined) return [];
      if (stack.length === 0) ranges.push({ startUtf16, endUtf16: index + 1 });
    }
  }
  return stack.length === 0 ? ranges : [];
}

const BIDI_ISOLATE_FRAME_NAMES = Object.freeze(new Map([
  ["\u2066", "LRI"],
  ["\u2067", "RLI"],
  ["\u2068", "FSI"],
]));

function liftedWholeSourceIsolate(value) {
  const topLevel = outerBidiIsolateRanges(value);
  if (topLevel.length !== 1) return null;
  const [outer] = topLevel;
  if (value.slice(0, outer.startUtf16).trim() || value.slice(outer.endUtf16).trim()) return null;
  let contentStartUtf16 = outer.startUtf16;
  let contentEndUtf16 = outer.endUtf16;
  const frames = [];
  while (contentStartUtf16 < contentEndUtf16) {
    const nestedValue = value.slice(contentStartUtf16, contentEndUtf16);
    const [range] = outerBidiIsolateRanges(nestedValue);
    const frame = BIDI_ISOLATE_FRAME_NAMES.get(nestedValue[0]);
    if (!range || range.startUtf16 !== 0 || range.endUtf16 !== nestedValue.length
      || !frame || nestedValue.at(-1) !== "\u2069") break;
    frames.push(frame);
    contentStartUtf16 += 1;
    contentEndUtf16 -= 1;
  }
  if (frames.length === 0) return null;
  return Object.freeze({
    frames: Object.freeze(frames),
    contentStartUtf16,
    contentEndUtf16,
  });
}

function allBidiIsolateRanges(value) {
  const ranges = [];
  const stack = [];
  let ordinal = 0;
  for (let index = 0; index < value.length; index += 1) {
    const control = value[index];
    const frame = BIDI_ISOLATE_FRAME_NAMES.get(control);
    if (frame) {
      stack.push({
        startUtf16: index,
        frame,
        ordinal: ordinal += 1,
      });
    } else if (control === "\u2069") {
      const open = stack.pop();
      if (!open) return Object.freeze([]);
      ranges.push(Object.freeze({
        ...open,
        endUtf16: index + 1,
        closeUtf16: index,
      }));
    }
  }
  return Object.freeze(stack.length === 0
    ? ranges.sort((left, right) => left.startUtf16 - right.startUtf16)
    : []);
}

function directionFramedContentRanges(value, {
  records,
  selectedStarts,
  startUtf16 = 0,
  endUtf16 = value.length,
  baseFrames = [],
}) {
  const ranges = [];
  const frames = [];
  const openingAt = new Map(records
    .filter(({ startUtf16: start }) => selectedStarts.has(start))
    .map((record) => [record.startUtf16, record]));
  const closingAt = new Map(records
    .filter(({ startUtf16: start }) => selectedStarts.has(start))
    .map((record) => [record.closeUtf16, record]));
  let cursor = startUtf16;
  for (let index = startUtf16; index < endUtf16; index += 1) {
    const opening = openingAt.get(index);
    const closing = closingAt.get(index);
    if (!opening && !closing) continue;
    if (cursor < index) {
      ranges.push(Object.freeze({
        startUtf16: cursor,
        endUtf16: index,
        directionFrames: Object.freeze([...baseFrames, ...frames]),
      }));
    }
    if (opening) frames.push(opening.frame);
    else {
      const active = frames.pop();
      if (active !== closing.frame) {
        throw new Error("Text to Lattice lost a selected direction-isolate frame.");
      }
    }
    cursor = index + 1;
  }
  if (frames.length > 0) {
    throw new Error("Text to Lattice left a selected direction-isolate frame open.");
  }
  if (cursor < endUtf16) {
    ranges.push(Object.freeze({
      startUtf16: cursor,
      endUtf16,
      directionFrames: Object.freeze([...baseFrames]),
    }));
  }
  return Object.freeze(ranges);
}

function isolateStartsCrossingPassageBoundaries(records, passages, {
  startUtf16,
  endUtf16,
}) {
  const boundaries = new Set(passages.flatMap((passage) => [
    passage.startUtf16,
    passage.endUtf16,
  ]).filter((boundary) => boundary > startUtf16 && boundary < endUtf16));
  return records
    .filter((record) => record.startUtf16 >= startUtf16 && record.endUtf16 <= endUtf16)
    .filter((record) => [...boundaries].some((boundary) => (
      record.startUtf16 < boundary && boundary < record.endUtf16
    )))
    .map(({ startUtf16: start }) => start);
}

function indivisibleRangeSafeEnd(ranges, cursor, proposedEnd) {
  const range = ranges.find(({ startUtf16, endUtf16 }) => (
    startUtf16 < proposedEnd && proposedEnd < endUtf16
  ));
  if (!range) return proposedEnd;
  return range.startUtf16 > cursor ? range.startUtf16 : range.endUtf16;
}

function appendRunPassages(source, runStart, runEnd, passages, literalIntervals = [], directionFrames = []) {
  let cursor = runStart;
  while (cursor < runEnd) {
    cursor = trimLeadingWhitespaceGraphemes(source, cursor, runEnd);
    if (cursor >= runEnd) return;

    const characterEnd = safeGraphemeBoundary(
      source,
      Math.min(runEnd, cursor + PASSAGE_CHARACTER_LIMIT),
    );
    const proposedEnd = wordLimitedEnd(source, cursor, characterEnd);
    let end = safeGraphemeBoundary(source, preferredBreak(source, cursor, proposedEnd, runEnd));
    end = literalSafePassageEnd(literalIntervals, cursor, end);
    end = trimTrailingWhitespaceGraphemes(source, cursor, end);
    if (end <= cursor) {
      // A single valid grapheme can exceed the nominal passage limit (for
      // example, a base character followed by many combining marks). Keep the
      // grapheme intact and make forward progress instead of spinning.
      end = Math.min(runEnd, nextGraphemeBoundary(source, cursor));
    }
    if (end <= cursor) throw new Error("Text to Lattice could not advance across a source grapheme.");

    let text = source.slice(cursor, end);
    let wordCount = countLatticeWords(text);
    const exactOversizedLiteral = literalIntervals.some((literal) => (
      literal.startUtf16 === cursor
      && literal.endUtf16 === end
      && end - cursor > PASSAGE_CHARACTER_LIMIT
    ));
    if (exactOversizedLiteral) {
      passages.push({
        id: `p${String(passages.length + 1).padStart(4, "0")}`,
        text,
        startUtf16: cursor,
        endUtf16: end,
        wordCount,
        protected: true,
        // The host preserves this literal exactly. Its complete source can be
        // too large for an adjacent model stage, so downstream serializers use
        // a host attestation and bounded inert edges instead of the full text.
        hostAttestedOnly: true,
        ...(directionFrames.length ? { directionFrames } : {}),
      });
      cursor = end;
      continue;
    }
    if (wordCount === 0) {
      if (/\S/u.test(text)) {
        passages.push({
          id: `p${String(passages.length + 1).padStart(4, "0")}`,
          text,
          startUtf16: cursor,
          endUtf16: end,
          wordCount: 0,
          protected: true,
          ...(directionFrames.length ? { directionFrames } : {}),
        });
      }
      cursor = end;
      continue;
    }
    const literalScan = scanLiteralSpans({ id: "scan", text }, LITERAL_SOURCE_SPAN_LIMIT);
    if (!literalScan.complete && literalScan.nextStartUtf16 > 0) {
      // End immediately after the last complete admitted literal. Ending at
      // the next literal's start can strand its preceding word in this unit,
      // creating alternating one-word groups in dense but valid markup.
      end = cursor + (literalScan.spans.at(-1)?.endUtf16 ?? literalScan.nextStartUtf16);
      end = trimTrailingWhitespaceGraphemes(source, cursor, end);
      text = source.slice(cursor, end);
      wordCount = countLatticeWords(text);
    }
    if (wordCount === 0) {
      if (/\S/u.test(text)) {
        passages.push({
          id: `p${String(passages.length + 1).padStart(4, "0")}`,
          text,
          startUtf16: cursor,
          endUtf16: end,
          wordCount: 0,
          protected: true,
          ...(directionFrames.length ? { directionFrames } : {}),
        });
      }
      cursor = end;
      continue;
    }
    passages.push({
      id: `p${String(passages.length + 1).padStart(4, "0")}`,
      text,
      startUtf16: cursor,
      endUtf16: end,
      wordCount,
      ...(directionFrames.length ? { directionFrames } : {}),
    });
    cursor = end;
  }
}

export function segmentLatticeSource(source) {
  let passages = [];
  // A document-wide isolate is host structure, not prose. Lift its exact
  // controls into the preserved outer boundaries so a long, valid interior
  // can be processed in bounded passages without ever regenerating the frame.
  const liftedIsolate = liftedWholeSourceIsolate(source);
  const planningStartUtf16 = liftedIsolate?.contentStartUtf16 ?? 0;
  const planningEndUtf16 = liftedIsolate?.contentEndUtf16 ?? source.length;
  const planningSource = source.slice(planningStartUtf16, planningEndUtf16);
  // Literal intervals are discovered on the complete source before any
  // sentence or size split. Platform sentence guesses may treat punctuation
  // inside code/markup as a terminal; merge only those unsafe hints while
  // retaining sentence-first planning everywhere else in the document.
  const sourceLiteralIntervals = rawLiteralMatches(source);
  if (SENTENCE_SEGMENTER) {
    // Start from the platform's sentence hints, then coalesce short fragments.
    // Sentence boundary detection is heuristic: titles, initials, dates, and
    // dialogue attributions can otherwise become semantically orphaned plans.
    // Paragraph boundaries remain hard, and every source range is retained.
    const rawHintedRuns = [];
    for (const part of SENTENCE_SEGMENTER.segment(planningSource)) {
      const partStart = planningStartUtf16 + part.index;
      const partEnd = partStart + part.segment.length;
      const previous = rawHintedRuns.at(-1);
      if (previous && literalContainingBoundary(sourceLiteralIntervals, partStart)) {
        previous.end = partEnd;
      } else {
        rawHintedRuns.push({ start: partStart, end: partEnd });
      }
    }
    const hintedRuns = [];
    for (const hinted of rawHintedRuns) {
      let { start, end } = hinted;
      start = trimLeadingWhitespaceGraphemes(source, start, end);
      end = trimTrailingWhitespaceGraphemes(source, start, end);
      if (start < end) {
        hintedRuns.push({
          start,
          end,
          wordCount: countLatticeWords(source.slice(start, end)),
        });
      }
    }

    const planningRuns = [];
    for (const run of hintedRuns) {
      const previous = planningRuns.at(-1);
      const separator = previous ? source.slice(previous.end, run.start) : "";
      const combinedWords = previous ? previous.wordCount + run.wordCount : 0;
      const combinedCharacters = previous ? run.end - previous.start : 0;
      const previousText = previous ? source.slice(previous.start, previous.end) : "";
      const runText = source.slice(run.start, run.end);
      const suspectedBoundaryFragment = suspectedAbbreviationChain(previousText)
        || run.wordCount === 1 && NUMERIC_PERIOD_FRAGMENT.test(runText) && NUMERIC_BACKWARD_PRECURSOR.test(previousText)
        || NUMERIC_PERIOD_FRAGMENT.test(previousText)
        || QUOTED_TERMINAL.test(previousText) && looksLikeQuotedAttribution(runText);
      const shouldCoalesce = previous
        && !PARAGRAPH_BREAK.test(separator)
        && (!SENTENCE_TERMINAL.test(previousText) || separator.length === 0 || suspectedBoundaryFragment)
        && combinedWords <= PASSAGE_WORD_LIMIT
        && combinedCharacters <= PASSAGE_CHARACTER_LIMIT;
      if (shouldCoalesce) {
        previous.end = run.end;
        previous.wordCount = combinedWords;
      } else {
        planningRuns.push({ ...run });
      }
    }
    for (const run of planningRuns) appendRunPassages(source, run.start, run.end, passages, sourceLiteralIntervals);
  } else {
    appendRunPassages(source, planningStartUtf16, planningEndUtf16, passages, sourceLiteralIntervals);
  }

  if (passages.length > LATTICE_PASSAGE_LIMIT) {
    // Highly fragmented but otherwise valid text falls back to the bounded
    // lossless partition instead of being rejected solely for punctuation.
    passages = [];
    appendRunPassages(source, planningStartUtf16, planningEndUtf16, passages, sourceLiteralIntervals);
  }

  // Sentence segmenters may alternate short punctuation fragments with
  // literal-saturated passages (notably dense markup), inflating the batch
  // count even though a direct lossless partition fits the same literal and
  // context ceilings. Prefer that direct partition only when the hinted plan
  // would exceed the public initial-group ceiling and it materially reduces
  // the bounded group count.
  if (batchLatticePassages(passages, { enforceLimit: false }).length > LATTICE_BATCH_LIMIT) {
    const compactPassages = [];
    appendRunPassages(source, planningStartUtf16, planningEndUtf16, compactPassages, sourceLiteralIntervals);
    if (batchLatticePassages(compactPassages, { enforceLimit: false }).length
      < batchLatticePassages(passages, { enforceLimit: false }).length) {
      passages = compactPassages;
    }
  }

  // Lift only isolate frames that cross a bounded passage edge. Complete short
  // isolates stay together and model-visible; lifting every control after one
  // long frame crossed an edge could otherwise turn a valid document with many
  // short sibling isolates into hundreds of one-fragment passages. Selected
  // controls remain exact host-owned gaps and their logical contents carry the
  // active frame stack as metadata.
  if (passages.some(({ text }) => hasInvalidLatticeBidiIsolates(text))) {
    const isolateRecords = allBidiIsolateRanges(source);
    const selectedStarts = new Set(isolateStartsCrossingPassageBoundaries(
      isolateRecords,
      passages,
      { startUtf16: planningStartUtf16, endUtf16: planningEndUtf16 },
    ));
    const baseFrames = liftedIsolate?.frames ?? [];
    for (let attempt = 0; attempt <= isolateRecords.length; attempt += 1) {
      if (selectedStarts.size === 0) break;
      const selectedRecords = isolateRecords.filter(({ startUtf16: start }) => selectedStarts.has(start));
      const selectedControlInsideLiteral = selectedRecords.some((record) => (
        sourceLiteralIntervals.some(({ startUtf16, endUtf16 }) => (
          startUtf16 <= record.startUtf16 && record.startUtf16 < endUtf16
          || startUtf16 <= record.closeUtf16 && record.closeUtf16 < endUtf16
        ))
      ));
      if (selectedControlInsideLiteral) {
        throw new RangeError("Text to Lattice cannot safely separate a direction control inside an exact literal.");
      }

      const directionSafe = [];
      for (const range of directionFramedContentRanges(source, {
        records: isolateRecords,
        selectedStarts,
        startUtf16: planningStartUtf16,
        endUtf16: planningEndUtf16,
        baseFrames,
      })) {
        const containedLiterals = sourceLiteralIntervals.filter(({ startUtf16, endUtf16 }) => (
          startUtf16 >= range.startUtf16 && endUtf16 <= range.endUtf16
        ));
        appendRunPassages(
          source,
          range.startUtf16,
          range.endUtf16,
          directionSafe,
          containedLiterals,
          range.directionFrames,
        );
      }
      passages = directionSafe.map((passage, index) => ({
        ...passage,
        id: `p${String(index + 1).padStart(4, "0")}`,
      }));
      if (!passages.some(({ text }) => hasInvalidLatticeBidiIsolates(text))) break;
      const priorSize = selectedStarts.size;
      for (const start of isolateStartsCrossingPassageBoundaries(
        isolateRecords,
        passages,
        { startUtf16: planningStartUtf16, endUtf16: planningEndUtf16 },
      )) selectedStarts.add(start);
      if (selectedStarts.size === priorSize) break;
    }
  }

  if (passages.length > LATTICE_PASSAGE_LIMIT) {
    throw new RangeError(`Text to Lattice supports at most ${LATTICE_PASSAGE_LIMIT} bounded passages per run.`);
  }

  // Whitespace between passages is host-preserved during reassembly, but it is
  // also semantic boundary evidence (space, line, paragraph, or stanza). Carry
  // the exact adjacent separators with every work unit so model stages never
  // have to infer document structure from trimmed passage text.
  return Object.freeze(passages.map((passage, index) => Object.freeze({
    ...passage,
    ...(liftedIsolate && !passage.directionFrames?.length
      ? { directionFrames: liftedIsolate.frames }
      : {}),
    separatorBefore: source.slice(index === 0 ? 0 : passages[index - 1].endUtf16, passage.startUtf16),
    separatorAfter: source.slice(passage.endUtf16, index + 1 < passages.length
      ? passages[index + 1].startUtf16
      : source.length),
  })));
}

export function batchLatticePassages(passages, { enforceLimit = true } = {}) {
  const batches = [];
  let current = [];
  let currentWords = 0;
  let currentCharacters = 0;
  let currentLiterals = 0;

  const finish = () => {
    if (current.length === 0) return;
    batches.push(Object.freeze({
      id: `b${String(batches.length + 1).padStart(3, "0")}`,
      passages: Object.freeze(current),
      wordCount: currentWords,
      characterCount: currentCharacters,
    }));
    current = [];
    currentWords = 0;
    currentCharacters = 0;
    currentLiterals = 0;
  };

  for (const passage of passages) {
    if (passage.protected === true) {
      finish();
      continue;
    }
    const literalScan = scanLiteralSpans(passage, LITERAL_SOURCE_SPAN_LIMIT);
    if (!literalScan.complete) {
      throw new RangeError("Text to Lattice cannot safely model more than twenty-four separate exact literals in one indivisible passage.");
    }
    const literalCount = literalScan.spans.length;
    const wouldOverflow = current.length > 0 && (
      current.length >= BATCH_PASSAGE_LIMIT
      || currentWords + passage.wordCount > BATCH_WORD_TARGET
      || currentCharacters + passage.text.length > BATCH_CHARACTER_TARGET
      || currentLiterals + literalCount > LITERAL_BATCH_SPAN_LIMIT
    );
    if (wouldOverflow) finish();
    current.push(passage);
    currentWords += passage.wordCount;
    currentCharacters += passage.text.length;
    currentLiterals += literalCount;
  }
  finish();
  if (enforceLimit && batches.length > LATTICE_BATCH_LIMIT) {
    throw new RangeError(`Text to Lattice supports at most ${LATTICE_BATCH_LIMIT} bounded work groups per run.`);
  }
  return Object.freeze(batches);
}

export function splitLatticePassage(passage) {
  if (passage?.protected === true || !Number.isSafeInteger(passage?.wordCount) || passage.wordCount < 2) {
    return null;
  }
  const words = WORD_SEGMENTER
    ? [...WORD_SEGMENTER.segment(passage.text)].filter((part) => part.isWordLike)
    : [...passage.text.matchAll(/[\p{L}\p{M}\p{N}]+(?:[’'_-][\p{L}\p{M}\p{N}]+)*/gu)]
      .map((match) => ({ index: match.index, segment: match[0] }));
  if (words.length < 2) return null;
  const parentLiterals = rawLiteralMatches(passage.text);
  const literalSignature = (items) => items.map(({ literalType, startUtf16, endUtf16, text }) => (
    `${literalType}\u241f${startUtf16}\u241f${endUtf16}\u241f${text}`
  ));
  const midpoint = passage.text.length / 2;
  const candidates = [...new Set([
    ...[...passage.text.matchAll(/[\u2066-\u2068]/gu)].map((match) => match.index),
    ...[...passage.text.matchAll(/\u2069/gu)].map((match) => match.index + match[0].length),
    ...[...passage.text.matchAll(/\s+/gu)].flatMap((match) => [match.index, match.index + match[0].length]),
  ])]
    .sort((left, right) => Math.abs(left - midpoint) - Math.abs(right - midpoint));
  let leftEnd = null;
  let rightStart = null;
  let leftText = null;
  let rightText = null;
  for (const boundary of candidates) {
    const safeBoundary = safeGraphemeBoundary(passage.text, boundary);
    const candidateLeftEnd = trimTrailingWhitespaceGraphemes(passage.text, 0, safeBoundary);
    const candidateRightStart = trimLeadingWhitespaceGraphemes(passage.text, safeBoundary, passage.text.length);
    if (parentLiterals.some(({ startUtf16, endUtf16 }) => (
      startUtf16 < candidateRightStart && endUtf16 > candidateLeftEnd
    ))) continue;
    const candidateLeft = passage.text.slice(0, candidateLeftEnd);
    const candidateRight = passage.text.slice(candidateRightStart);
    if (countLatticeWords(candidateLeft) === 0 || countLatticeWords(candidateRight) === 0
      || hasInvalidLatticeBidiIsolates(candidateLeft) || hasInvalidLatticeBidiIsolates(candidateRight)) continue;
    const childLiterals = [
      ...rawLiteralMatches(candidateLeft),
      ...rawLiteralMatches(candidateRight).map((literal) => ({
        ...literal,
        startUtf16: literal.startUtf16 + candidateRightStart,
        endUtf16: literal.endUtf16 + candidateRightStart,
      })),
    ];
    if (JSON.stringify(literalSignature(parentLiterals)) !== JSON.stringify(literalSignature(childLiterals))) continue;
    leftEnd = candidateLeftEnd;
    rightStart = candidateRightStart;
    leftText = candidateLeft;
    rightText = candidateRight;
    break;
  }
  if (leftText === null || rightText === null || leftEnd === null || rightStart === null) return null;
  const leftWordCount = countLatticeWords(leftText);
  const rightWordCount = countLatticeWords(rightText);
  return Object.freeze([
    Object.freeze({
      id: `${passage.id}a`,
      text: leftText,
      startUtf16: passage.startUtf16,
      endUtf16: passage.startUtf16 + leftEnd,
      wordCount: leftWordCount,
      separatorBefore: passage.separatorBefore ?? "",
      separatorAfter: passage.text.slice(leftEnd, rightStart),
      ...(passage.directionFrames?.length ? { directionFrames: passage.directionFrames } : {}),
    }),
    Object.freeze({
      id: `${passage.id}b`,
      text: rightText,
      startUtf16: passage.startUtf16 + rightStart,
      endUtf16: passage.endUtf16,
      wordCount: rightWordCount,
      separatorBefore: passage.text.slice(leftEnd, rightStart),
      separatorAfter: passage.separatorAfter ?? "",
      ...(passage.directionFrames?.length ? { directionFrames: passage.directionFrames } : {}),
    }),
  ]);
}

export function latticeSourceSpansForPassage(passage) {
  const spans = [];
  const isolateRanges = outerBidiIsolateRanges(passage.text);
  let cursor = 0;
  while (cursor < passage.text.length) {
    let end;
    if (spans.length === SOURCE_SPAN_LIMIT - 1) {
      end = passage.text.length;
    } else {
      const characterEnd = safeGraphemeBoundary(
        passage.text,
        Math.min(passage.text.length, cursor + SOURCE_SPAN_CHARACTER_LIMIT),
      );
      const safeCharacterEnd = characterEnd > cursor
        ? characterEnd
        : Math.min(passage.text.length, nextGraphemeBoundary(passage.text, cursor));
      end = wordLimitedEnd(passage.text, cursor, safeCharacterEnd, SOURCE_SPAN_WORD_TARGET);
      if (end <= cursor) end = Math.min(passage.text.length, nextGraphemeBoundary(passage.text, cursor));
      end = indivisibleRangeSafeEnd(isolateRanges, cursor, end);
    }
    if (end <= cursor) throw new Error("Text to Lattice could not advance across a source evidence span.");
    const index = spans.length + 1;
    spans.push(Object.freeze({
      id: `${passage.id}:s${String(index).padStart(2, "0")}`,
      kind: "source",
      passageId: passage.id,
      startUtf16: cursor,
      endUtf16: end,
      text: passage.text.slice(cursor, end),
    }));
    cursor = end;
  }
  if (spans.length === 0 && passage.text.length === 0) {
    throw new Error("Text to Lattice cannot enumerate evidence for an empty passage.");
  }
  return Object.freeze(spans);
}

function trimmedUrl(value) {
  const localOpeners = [];
  let end = value.length;
  for (let index = 0; index < value.length; index += 1) {
    if (/[\u2066-\u2068]/u.test(value[index])) {
      localOpeners.push(index);
    } else if (value[index] === "\u2069") {
      if (localOpeners.length === 0) {
        end = index;
        break;
      }
      localOpeners.pop();
    }
  }
  if (end === value.length && localOpeners.length > 0) end = localOpeners[0];
  while (end > 0 && /[.,;:!?]/u.test(value[end - 1])) end -= 1;
  for (const [open, close] of [["(", ")"], ["[", "]"], ["{", "}"]]) {
    while (end > 0 && value[end - 1] === close) {
      const prefix = value.slice(0, end);
      const opens = prefix.split(open).length - 1;
      const closes = prefix.split(close).length - 1;
      if (closes <= opens) break;
      end -= 1;
    }
  }
  return value.slice(0, end);
}

function isPhoneShaped(value) {
  const digits = value.match(/\d/gu) ?? [];
  if (digits.length < 7) return false;
  return /[+()-]/u.test(value) || /\d{7}/u.test(value);
}

function graphemeEnvelope(value, startUtf16, endUtf16) {
  const start = safeGraphemeBoundary(value, startUtf16);
  if (endUtf16 <= start || endUtf16 >= value.length) {
    return { startUtf16: start, endUtf16: Math.max(start, Math.min(value.length, endUtf16)) };
  }
  const lastUnit = Math.max(start, endUtf16 - 1);
  const part = GRAPHEME_SEGMENTER?.segment(value).containing(lastUnit);
  const end = part ? part.index + part.segment.length : nextGraphemeBoundary(value, lastUnit);
  return { startUtf16: start, endUtf16: end };
}

function rawLiteralMatches(value) {
  const matches = [];
  const seen = new Set();
  for (const protectedMatch of latticeProtectedLiteralMatches(value)) {
    const envelope = graphemeEnvelope(value, protectedMatch.startUtf16, protectedMatch.endUtf16);
    const key = `${envelope.startUtf16}\u241f${envelope.endUtf16}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({
      literalType: protectedMatch.literalType,
      ...envelope,
      text: value.slice(envelope.startUtf16, envelope.endUtf16),
    });
  }
  for (const [literalType, pattern] of LITERAL_PATTERNS) {
    for (const match of value.matchAll(pattern)) {
      if (!match[0]) continue;
      if (literalType === "inline-code" && match[0].length <= 2) continue;
      if (literalType === "phone" && !isPhoneShaped(match[0])) continue;
      const text = literalType === "url" ? trimmedUrl(match[0]) : match[0];
      if (!text) continue;
      const matchedStartUtf16 = match.index;
      const matchedEndUtf16 = matchedStartUtf16 + text.length;
      const { startUtf16, endUtf16 } = graphemeEnvelope(value, matchedStartUtf16, matchedEndUtf16);
      const exactText = value.slice(startUtf16, endUtf16);
      const key = `${startUtf16}\u241f${endUtf16}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ literalType, startUtf16, endUtf16, text: exactText });
    }
  }
  matches.sort((left, right) => left.startUtf16 - right.startUtf16
    || right.endUtf16 - left.endUtf16
    || left.literalType.localeCompare(right.literalType));
  const nonOverlapping = [];
  for (const match of matches) {
    if (nonOverlapping.some((kept) => match.startUtf16 < kept.endUtf16 && match.endUtf16 > kept.startUtf16)) continue;
    nonOverlapping.push(match);
  }
  return nonOverlapping;
}

function scanLiteralSpans(passage, limit) {
  const nonOverlapping = rawLiteralMatches(passage.text);
  // Consecutive literals separated only by presentation characters are one
  // exact surface bundle, even when their syntactic kinds differ. The host's
  // independent literal checks still validate each underlying URL/code/markup
  // occurrence. This compact representation prevents valid literal-rich text
  // from multiplying work groups while preserving every code unit.
  const coalesced = [];
  for (const match of nonOverlapping) {
    const previous = coalesced.at(-1);
    const separator = previous ? passage.text.slice(previous.endUtf16, match.startUtf16) : "";
    const protectedKind = (literalType) => literalType?.startsWith("protected-");
    const canBundle = previous
      && countLatticeWords(separator) === 0
      && match.endUtf16 - previous.startUtf16 <= PASSAGE_CHARACTER_LIMIT
      && (!protectedKind(previous.literalType) && !protectedKind(match.literalType)
        || previous.literalType === match.literalType);
    if (canBundle) {
      previous.endUtf16 = match.endUtf16;
      previous.text = passage.text.slice(previous.startUtf16, match.endUtf16);
      if (previous.literalType !== match.literalType) previous.literalType = "exact-bundle";
    } else {
      coalesced.push({ ...match });
    }
  }
  const included = coalesced.slice(0, limit);
  const nextStartUtf16 = coalesced.length > limit ? coalesced[limit].startUtf16 : null;
  const spans = Object.freeze(included.map((match, index) => Object.freeze({
    id: `${passage.id}:l${String(index + 1).padStart(2, "0")}`,
    kind: "literal",
    literalType: match.literalType,
    passageId: passage.id,
    startUtf16: match.startUtf16,
    endUtf16: match.endUtf16,
    text: match.text,
  })));
  return Object.freeze({ spans, complete: nextStartUtf16 === null, nextStartUtf16 });
}

export function latticeLiteralSpanScanForPassage(passage, limit = LITERAL_SOURCE_SPAN_LIMIT) {
  return scanLiteralSpans(passage, limit);
}

export function latticeLiteralSpansForPassage(passage) {
  return scanLiteralSpans(passage, LITERAL_SOURCE_SPAN_LIMIT).spans;
}

export function latticePromptSpansForPassage(passage, selectedLiterals = latticeLiteralSpansForPassage(passage)) {
  const coarse = latticeSourceSpansForPassage(passage);
  const isolateRanges = outerBidiIsolateRanges(passage.text);
  const literals = selectedLiterals.filter((literal) => !isolateRanges.some((range) => (
    literal.startUtf16 < range.endUtf16 && literal.endUtf16 > range.startUtf16
  )));
  if (literals.length === 0) return coarse;

  // Model-facing evidence is a single lossless partition. Fine literal spans
  // replace, rather than duplicate, the same substring in a coarse span.
  // Coarse boundaries that fall inside a literal are suppressed so an exact
  // value never needs more than one cited literal span.
  const boundaries = new Set([0, passage.text.length]);
  for (const literal of literals) {
    boundaries.add(literal.startUtf16);
    boundaries.add(literal.endUtf16);
  }
  for (const span of coarse) {
    if (!literals.some((literal) => span.endUtf16 > literal.startUtf16 && span.endUtf16 < literal.endUtf16)) {
      boundaries.add(span.endUtf16);
    }
  }
  const orderedBoundaries = [...boundaries].sort((left, right) => left - right);
  let sourceIndex = 0;
  const spans = [];
  for (let index = 0; index < orderedBoundaries.length - 1; index += 1) {
    const startUtf16 = orderedBoundaries[index];
    const endUtf16 = orderedBoundaries[index + 1];
    if (endUtf16 <= startUtf16) continue;
    const literal = literals.find((item) => item.startUtf16 === startUtf16 && item.endUtf16 === endUtf16);
    if (literal) {
      spans.push(literal);
      continue;
    }
    sourceIndex += 1;
    spans.push(Object.freeze({
      id: `${passage.id}:s${String(sourceIndex).padStart(2, "0")}`,
      kind: "source",
      passageId: passage.id,
      startUtf16,
      endUtf16,
      text: passage.text.slice(startUtf16, endUtf16),
    }));
  }
  return Object.freeze(spans);
}

export function latticeSourceSpansForBatch(batch) {
  const scans = batch.passages.map((passage) => scanLiteralSpans(passage, LITERAL_SOURCE_SPAN_LIMIT));
  const available = scans.map(({ spans }) => spans);
  if (scans.some(({ complete }) => !complete)
    || available.reduce((sum, spans) => sum + spans.length, 0) > LITERAL_BATCH_SPAN_LIMIT) {
    throw new RangeError("Text to Lattice could not fit every exact literal into one bounded batch.");
  }
  return Object.freeze(batch.passages.map((passage, passageIndex) => {
    const spans = latticePromptSpansForPassage(passage, available[passageIndex]);
    const partitionLiteralIds = new Set(spans.filter(({ kind }) => kind === "literal").map(({ id }) => id));
    const literalAnnotations = Object.freeze(available[passageIndex].filter(({ id }) => !partitionLiteralIds.has(id)));
    return Object.freeze({
      passageId: passage.id,
      spans,
      literalAnnotations,
      ...(passage.directionFrames?.length ? { directionFrames: passage.directionFrames } : {}),
      literalCoverage: Object.freeze({
        included: partitionLiteralIds.size + literalAnnotations.length,
        detectedAtLeast: available[passageIndex].length,
        complete: partitionLiteralIds.size + literalAnnotations.length === available[passageIndex].length,
      }),
    });
  }));
}

export function graphemeExcerpt(value, edge, limit = 96) {
  if (value.length <= limit) return value;
  if (edge === "end") {
    const start = safeGraphemeBoundary(value, value.length - limit);
    return value.slice(start);
  }
  const end = safeGraphemeBoundary(value, limit);
  return value.slice(0, end > 0 ? end : nextGraphemeBoundary(value, 0));
}

export function contextPassagesForBatch(passages, batch) {
  const first = passages.indexOf(batch.passages[0]);
  const last = passages.indexOf(batch.passages[batch.passages.length - 1]);
  const protectedBefore = [];
  let precedingIndex = first - 1;
  while (precedingIndex >= 0 && passages[precedingIndex].protected === true) {
    const passage = passages[precedingIndex];
    protectedBefore.unshift(Object.freeze({
      passageId: passage.id,
      excerpt: passage.text,
      separatorBefore: passage.separatorBefore ?? "",
      separatorAfter: passage.separatorAfter ?? "",
      protectedExact: true,
      ...(passage.hostAttestedOnly === true ? { hostAttestedOnly: true } : {}),
    }));
    precedingIndex -= 1;
  }
  const protectedAfter = [];
  let followingIndex = last + 1;
  while (followingIndex < passages.length && passages[followingIndex].protected === true) {
    const passage = passages[followingIndex];
    protectedAfter.push(Object.freeze({
      passageId: passage.id,
      excerpt: passage.text,
      separatorBefore: passage.separatorBefore ?? "",
      separatorAfter: passage.separatorAfter ?? "",
      protectedExact: true,
      ...(passage.hostAttestedOnly === true ? { hostAttestedOnly: true } : {}),
    }));
    followingIndex += 1;
  }
  const preceding = precedingIndex >= 0 ? passages[precedingIndex] : null;
  const following = followingIndex < passages.length ? passages[followingIndex] : null;
  return Object.freeze({
    preceding: preceding
      ? Object.freeze({
        passageId: preceding.id,
        excerpt: preceding.protected === true ? preceding.text : graphemeExcerpt(preceding.text, "end"),
        separatorBefore: preceding.separatorBefore ?? "",
        separatorAfter: preceding.separatorAfter ?? "",
        ...(preceding.directionFrames?.length ? { directionFrames: preceding.directionFrames } : {}),
        ...(preceding.protected === true ? { protectedExact: true } : {}),
        ...(preceding.hostAttestedOnly === true ? { hostAttestedOnly: true } : {}),
      })
      : null,
    following: following
      ? Object.freeze({
        passageId: following.id,
        excerpt: following.protected === true ? following.text : graphemeExcerpt(following.text, "start"),
        separatorBefore: following.separatorBefore ?? "",
        separatorAfter: following.separatorAfter ?? "",
        ...(following.directionFrames?.length ? { directionFrames: following.directionFrames } : {}),
        ...(following.protected === true ? { protectedExact: true } : {}),
        ...(following.hostAttestedOnly === true ? { hostAttestedOnly: true } : {}),
      })
      : null,
    protectedBefore: Object.freeze(protectedBefore),
    protectedAfter: Object.freeze(protectedAfter),
  });
}

export function reassembleLatticeSource(source, passages, replacements) {
  let replacementById;
  if (replacements instanceof Map) {
    replacementById = replacements;
  } else {
    if (!Array.isArray(replacements)
      || replacements.some((item) => typeof item?.passageId !== "string" || typeof item?.text !== "string")
      || new Set(replacements.map(({ passageId }) => passageId)).size !== replacements.length) {
      throw new Error("Text to Lattice did not return each source passage as one text replacement.");
    }
    replacementById = new Map(replacements.map((item) => [item.passageId, item.text]));
  }
  if ([...replacementById.values()].some((text) => typeof text !== "string")) {
    throw new Error("Text to Lattice returned an invalid passage replacement.");
  }
  const replaceablePassages = passages.filter((passage) => passage.protected !== true);
  if (replacementById.size !== replaceablePassages.length
    || [...replacementById.keys()].some((id) => !replaceablePassages.some((passage) => passage.id === id))) {
    throw new Error("Text to Lattice did not return every source passage exactly once.");
  }

  let cursor = 0;
  let output = "";
  for (const passage of passages) {
    if (passage.protected !== true && !replacementById.has(passage.id)) {
      throw new Error(`Text to Lattice omitted passage ${passage.id}.`);
    }
    output += source.slice(cursor, passage.startUtf16);
    output += passage.protected === true ? passage.text : replacementById.get(passage.id);
    cursor = passage.endUtf16;
  }
  output += source.slice(cursor);
  return output;
}
