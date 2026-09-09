import {
  containsDisallowedLatticeControls,
  containsLatticeNoncharacter,
  containsOversizedLatticeGrapheme,
  containsOversizedLatticeToken,
  containsUnpairedSurrogate,
  countLatticeFormatControls,
  countLatticeWords,
  hasInvalidLatticeBidiIsolates,
  LATTICE_FORMAT_CONTROL_LIMIT,
  LATTICE_INPUT_SAFETY_LIMIT,
} from "./inputPolicy.js";
import { latticeProtectedLiteralMatches } from "./protectedSpans.js";
const URL = /https?:\/\/[^\s<>"'`]+/gu;
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
const PHONE = /(?<![\p{L}\p{N}])(?:(?:\+[ \t]*)?\(?\d[\d(). \t-]{5,}\d)(?![\p{L}\p{N}])/gu;
const MARKDOWN_LINK = /\[[^\]\r\n]+\]\([^\r\n)]+\)/gu;
const INLINE_CODE = /`[^`\r\n]*`/gu;
const MARKUP = /<!--[\s\S]*?-->|<!DOCTYPE\s+[A-Za-z][^>\r\n]*>|<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s+[A-Za-z_:][A-Za-z0-9:._-]*(?:=(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*\s*\/?>/giu;
const QUANTITY = /(?:^|(?<=[\s([{,:;]))(?:[<>≤≥≈~][ \t]*)?[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:\s*(?:-|–|—|to)\s*[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))?(?:(?:%|°[CF]|[\p{L}\p{M}µμ]+(?:\/[\p{L}\p{M}µμ]+)?)|[ \t]+(?:percent|degrees?|seconds?|minutes?|hours?|days?|weeks?|months?|years?|milliseconds?|kilograms?|grams?|milligrams?|micrograms?|liters?|litres?|milliliters?|millilitres?|meters?|metres?|centimeters?|centimetres?|millimeters?|millimetres?|kilometers?|kilometres?|miles?|yards?|feet|foot|inches?|pounds?|ounces?|bytes?|kilobytes?|megabytes?|gigabytes?|terabytes?|ms|kg|mg|µg|μg|ml|cm|mm|km|mi|yd|ft|lb|oz|kb|mb|gb|tb))?/giu;
const FORMAL_IDENTIFIER = /(?<![\p{L}\p{N}])(?:[A-Z]{2,}[A-Z0-9]*(?:[-_.:/][A-Z0-9]+)+|[A-Z]{2,}\d+[A-Z0-9._/-]*|[A-Za-z]+-\d+(?:[-_.]\d+)*|v\d+(?:\.\d+){1,3}|[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12})(?![\p{L}\p{N}])/gu;

function occurrenceRecords(value, pattern, transform = (item) => item) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  return [...value.matchAll(new RegExp(pattern.source, flags))].map((match) => {
    const item = transform(match[0]);
    return item ? { item, index: match.index } : null;
  }).filter(Boolean);
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
      if (prefix.split(close).length - 1 <= prefix.split(open).length - 1) break;
      end -= 1;
    }
  }
  return value.slice(0, end);
}

function canonicalPhone(value) {
  const digits = value.match(/\d/gu) ?? [];
  if (digits.length < 7) return "";
  return /[+()-]/u.test(value) || /\d{7}/u.test(value) ? value : "";
}

function canonicalQuantity(value) {
  // Horizontal spacing around comparators, ranges, and a recognized unit is
  // presentational. Preserve every semantic character while comparing exact
  // quantity multisets independently of list layout.
  return value.replace(/[ \t]+/gu, "");
}

function sameMultiset(left, right) {
  if (left.length !== right.length) return false;
  const counts = new Map();
  for (const item of left) counts.set(item, (counts.get(item) ?? 0) + 1);
  for (const item of right) {
    const remaining = counts.get(item) ?? 0;
    if (remaining === 0) return false;
    if (remaining === 1) counts.delete(item);
    else counts.set(item, remaining - 1);
  }
  return counts.size === 0;
}

const BIDI_OPEN_ISOLATE = /[\u2066-\u2068]/u;
const BIDI_ISOLATE_CONTROL = /[\u2066-\u2069]/gu;
const WORD_LIKE_SCALAR = /[\p{L}\p{M}\p{N}]/u;
const QUESTION_SENTENCE_SEGMENTER = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("und", { granularity: "sentence" })
  : null;

function scalarBefore(value, index) {
  if (index <= 0) return "";
  let start = index - 1;
  const unit = value.charCodeAt(start);
  if (unit >= 0xDC00 && unit <= 0xDFFF && start > 0) start -= 1;
  return String.fromCodePoint(value.codePointAt(start));
}

function scalarAfter(value, index) {
  if (index + 1 >= value.length) return "";
  return String.fromCodePoint(value.codePointAt(index + 1));
}

function controlEmbeddedInWord(value, index) {
  return WORD_LIKE_SCALAR.test(scalarBefore(value, index))
    && WORD_LIKE_SCALAR.test(scalarAfter(value, index));
}

function bidiIsolateStructure(value) {
  const stack = [];
  const records = [];
  const childCounts = new Map();
  let ordinal = 0;
  for (let index = 0; index < value.length; index += 1) {
    const control = value[index];
    if (BIDI_OPEN_ISOLATE.test(control)) {
      const parentOrdinal = stack.at(-1)?.ordinal ?? 0;
      const siblingOrdinal = (childCounts.get(parentOrdinal) ?? 0) + 1;
      childCounts.set(parentOrdinal, siblingOrdinal);
      stack.push({
        control,
        startUtf16: index,
        contentStartUtf16: index + 1,
        depth: stack.length,
        ordinal: ordinal += 1,
        parentOrdinal,
        siblingOrdinal,
        openingEmbeddedInWord: controlEmbeddedInWord(value, index),
      });
    } else if (control === "\u2069") {
      const open = stack.pop();
      if (!open) return null;
      const content = value.slice(open.contentStartUtf16, index);
      records.push({
        ...open,
        endUtf16: index + 1,
        content,
        empty: content.replace(BIDI_ISOLATE_CONTROL, "").trim().length === 0,
        closingEmbeddedInWord: controlEmbeddedInWord(value, index),
        outer: open.startUtf16 === 0 && index + 1 === value.length,
      });
    }
  }
  if (stack.length > 0) return null;
  return records.sort((left, right) => left.startUtf16 - right.startUtf16);
}

function wholeDocumentIsolateFrameControls(value, records) {
  const topLevel = records.filter(({ depth }) => depth === 0);
  if (topLevel.length !== 1) return Object.freeze([]);
  const [outer] = topLevel;
  if (value.slice(0, outer.startUtf16).trim() || value.slice(outer.endUtf16).trim()) {
    return Object.freeze([]);
  }

  const controls = [];
  let startUtf16 = outer.startUtf16;
  let endUtf16 = outer.endUtf16;
  for (;;) {
    const frame = records.find((record) => (
      record.startUtf16 === startUtf16 && record.endUtf16 === endUtf16
    ));
    if (!frame) break;
    controls.push(frame.control);
    startUtf16 += 1;
    endUtf16 -= 1;
  }
  return Object.freeze(controls);
}

function exactOccurrenceOrdinalAt(value, item, index) {
  if (!item) return null;
  let cursor = 0;
  let ordinal = 0;
  for (;;) {
    const found = value.indexOf(item, cursor);
    if (found < 0 || found > index) return null;
    ordinal += 1;
    if (found === index) return ordinal;
    cursor = found + item.length;
  }
}

function sameBidiIsolateStructure(source, candidate) {
  const sourceRecords = bidiIsolateStructure(source);
  const candidateRecords = bidiIsolateStructure(candidate);
  if (!sourceRecords || !candidateRecords || sourceRecords.length !== candidateRecords.length) return false;
  const sourceHostFrames = wholeDocumentIsolateFrameControls(source, sourceRecords);
  const candidateHostFrames = wholeDocumentIsolateFrameControls(candidate, candidateRecords);
  const sourceLineOrdinals = lineBreakOrdinalTable(source);
  const candidateLineOrdinals = lineBreakOrdinalTable(candidate);
  if (sourceHostFrames.length !== candidateHostFrames.length
    || sourceHostFrames.some((control, index) => control !== candidateHostFrames[index])) return false;
  return sourceRecords.every((record, index) => {
    const compared = candidateRecords[index];
    const stableExactContent = record.content.length > 0
      && record.content === compared.content
      && literalCount(source, record.content) === literalCount(candidate, record.content);
    return record.control === compared.control
      && record.depth === compared.depth
      && record.ordinal === compared.ordinal
      && record.parentOrdinal === compared.parentOrdinal
      && record.siblingOrdinal === compared.siblingOrdinal
      && record.outer === compared.outer
      && record.empty === compared.empty
      && sourceLineOrdinals[record.startUtf16] === candidateLineOrdinals[compared.startUtf16]
      && sourceLineOrdinals[record.endUtf16 - 1] === candidateLineOrdinals[compared.endUtf16 - 1]
      && record.openingEmbeddedInWord === compared.openingEmbeddedInWord
      && record.closingEmbeddedInWord === compared.closingEmbeddedInWord
      && (!stableExactContent || exactOccurrenceOrdinalAt(source, record.content, record.contentStartUtf16)
        === exactOccurrenceOrdinalAt(candidate, compared.content, compared.contentStartUtf16));
  });
}

function lineBreakSignature(value) {
  return value.match(/\r\n|\r|\n|\u2028|\u2029/gu) ?? [];
}

function sameLineBreakStructure(source, candidate) {
  const sourceBreaks = lineBreakSignature(source);
  const candidateBreaks = lineBreakSignature(candidate);
  return sourceBreaks.length === candidateBreaks.length
    && sourceBreaks.every((lineBreak, index) => lineBreak === candidateBreaks[index]);
}

function questionTerminalRecords(value) {
  const lineOrdinals = lineBreakOrdinalTable(value);
  const records = [];
  for (const match of value.matchAll(/[?؟？](?=(?:[!！"']|\p{Pe}|\p{Pf})*(?:\s|$))/gu)) {
    const tokenStart = Math.max(
      value.lastIndexOf(" ", match.index - 1),
      value.lastIndexOf("\t", match.index - 1),
      value.lastIndexOf("\n", match.index - 1),
      value.lastIndexOf("\r", match.index - 1),
      value.lastIndexOf("\u2028", match.index - 1),
      value.lastIndexOf("\u2029", match.index - 1),
    ) + 1;
    if (value.slice(tokenStart, match.index).includes("://")) continue;
    records.push(`question\u241f${lineOrdinals[match.index]}`);
  }
  return records;
}

function sameQuestionStructure(source, candidate) {
  return sameMultiset(questionTerminalRecords(source), questionTerminalRecords(candidate));
}

function lineBreakOrdinalTable(value) {
  const ordinals = new Uint32Array(value.length + 1);
  let ordinal = 0;
  let index = 0;
  while (index < value.length) {
    ordinals[index] = ordinal;
    if (value[index] === "\r" && value[index + 1] === "\n") {
      ordinals[index + 1] = ordinal;
      index += 2;
      ordinal += 1;
      ordinals[index] = ordinal;
      continue;
    }
    if (/[\r\n\u2028\u2029]/u.test(value[index])) ordinal += 1;
    index += 1;
    ordinals[index] = ordinal;
  }
  return ordinals;
}

function bidiFrameOrdinalTable(value) {
  if (!bidiIsolateStructure(value)) return null;
  const frames = new Array(value.length + 1);
  const stack = [];
  let ordinal = 0;
  for (let index = 0; index < value.length; index += 1) {
    frames[index] = stack.join("/");
    const control = value[index];
    if (BIDI_OPEN_ISOLATE.test(control)) {
      stack.push(`${ordinal += 1}:${control.codePointAt(0).toString(16)}`);
    } else if (control === "\u2069") {
      stack.pop();
    }
    frames[index + 1] = stack.join("/");
  }
  return frames;
}

const DEFAULT_IGNORABLE_CODE_POINT = /\p{Default_Ignorable_Code_Point}/gu;
const DIRECTIONAL_FORMAT_CONTROL = /[\u061C\u200E\u200F]/gu;
const LATIN_WORD_SCALAR = /[\p{Script=Latin}\p{N}]/u;
const LATIN_JOINER_CONTROL = /[\u200C\u200D]/gu;
const INVISIBLE_FILLER = /[\u115F\u1160\u3164\uFFA0]/gu;

function defaultIgnorableRecords(value) {
  const lineOrdinals = lineBreakOrdinalTable(value);
  const frameOrdinals = bidiFrameOrdinalTable(value);
  const structural = [...value.matchAll(DIRECTIONAL_FORMAT_CONTROL), ...value.matchAll(INVISIBLE_FILLER)];
  const latinJoiners = [...value.matchAll(LATIN_JOINER_CONTROL)].filter((match) => (
    LATIN_WORD_SCALAR.test(scalarBefore(value, match.index))
      && LATIN_WORD_SCALAR.test(scalarAfter(value, match.index))
  ));
  return [...structural, ...latinJoiners].map((match) => (
    `${match[0]}\u241f${scalarBefore(value, match.index)}\u241f${scalarAfter(value, match.index)}`
      + `\u241f${lineOrdinals[match.index]}\u241f${frameOrdinals?.[match.index] ?? ""}`
  ));
}

function sameDefaultIgnorableStructure(source, candidate) {
  return sameMultiset(defaultIgnorableRecords(source), defaultIgnorableRecords(candidate));
}

function withoutDefaultIgnorables(value) {
  return value.replace(DEFAULT_IGNORABLE_CODE_POINT, "");
}

const PRESENTATION_SMALL_CAPS = Object.freeze(new Map([
  ...[..."ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘꞯʀꜱᴛᴜᴠᴡʏᴢ"].map((character, index) => (
    [character, "abcdefghijklmnopqrstuvwxyz"[index < 23 ? index : index + 1]]
  )),
]));

export function foldLatticePresentationLetters(value) {
  return [...value].map((character) => PRESENTATION_SMALL_CAPS.get(character) ?? character).join("");
}

function materialCharactersBeforeCompatibilityFold(value, { stripPresentationMarks = false } = {}) {
  // Remove default-ignorables before normalization. A combining grapheme
  // joiner can otherwise prevent two canonically equivalent spellings from
  // composing, then disappear later while leaving unequal byte sequences.
  const characters = [...withoutDefaultIgnorables(value)];
  return characters.map((character, index) => {
    if (/[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/u.test(character)) {
      return ` superscript${character.codePointAt(0).toString(16)} `;
    }
    if (/[‘’‛＇ʼ']/u.test(character)) {
      if (stripPresentationMarks) return "";
      const wordCharacter = /[\p{L}\p{M}\p{N}]/u;
      return wordCharacter.test(characters[index - 1] ?? "")
        && wordCharacter.test(characters[index + 1] ?? "") ? "'" : " ";
    }
    if (/[-‐‑‒–—―−]/u.test(character)) return stripPresentationMarks ? "" : "-";
    if (character === "_") return stripPresentationMarks ? "" : " ";
    // Strip presentation punctuation and symbols before compatibility
    // normalization. Otherwise ornaments such as ™ or spacing accents fold
    // into letters/marks and can falsely earn positive rewrite credit.
    if (/[\p{P}\p{S}]/u.test(character)) return stripPresentationMarks ? "" : " ";
    return character;
  }).join("");
}

function normalizedMaterialRepresentation(value, options) {
  const compatibilityProtected = foldLatticePresentationLetters(
    materialCharactersBeforeCompatibilityFold(value, options),
  );
  return compatibilityProtected.normalize("NFKC")
    .replace(DEFAULT_IGNORABLE_CODE_POINT, "")
    // Text/emoji presentation selectors do not change the underlying token.
    // Normalize both the BMP selectors (including VS16) and their supplementary
    // counterparts so a font-presentation change cannot earn rewrite credit.
    .replace(/[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/gu, "")
    .replace(/\p{Cf}/gu, "")
    .toLocaleLowerCase("und")
    .replace(/i\u0307/gu, "i")
    .replaceAll("ß", "ss")
    .replaceAll("ς", "σ")
    // Co- before a vowel has a narrow, conventional optional-hyphen form;
    // unlike re-sign/resign, joining it does not create a different base word.
    .replace(/\bco-(?=[aeiou])/gu, "co")
    // An internal stylistic hyphen and a word boundary compare alike, while a
    // deletion still changes the representation (x-y ≠ xy).
    .replace(/(?<=[\p{L}\p{M}\p{N}])-(?=[\p{L}\p{M}\p{N}])/gu, " ")
    // Materiality is lexical/syntactic: punctuation, Markdown decoration,
    // and mathematical glyph variants remain fidelity obligations elsewhere,
    // but cannot by themselves earn positive rewrite credit. Underscores are
    // treated as token boundaries rather than joining unchanged words.
    // Remove any combining mark that has no base character. Compatibility
    // folding must not turn a free-standing accent into apparent wording.
    .replace(/(?<![\p{L}\p{N}])\p{M}+/gu, " ")
    .replace(/[^\p{L}\p{M}\p{N}'\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const BOUNDARY_ANCHOR_WORD = /[\p{L}\p{M}\p{N}]+(?:[’'_-][\p{L}\p{M}\p{N}]+)*/gu;

function uniqueStructuralAnchors(value, signatureAt) {
  const anchors = new Map();
  for (const match of value.matchAll(BOUNDARY_ANCHOR_WORD)) {
    const normalized = normalizedMaterialRepresentation(match[0]);
    if (!normalized) continue;
    if (anchors.has(normalized)) anchors.set(normalized, null);
    else anchors.set(normalized, signatureAt(match.index));
  }
  return anchors;
}

function hasRelocatedUniqueBoundaryAnchor(source, candidate) {
  if (!sameLineBreakStructure(source, candidate) || lineBreakSignature(source).length === 0) return false;
  const sourceOrdinals = lineBreakOrdinalTable(source);
  const candidateOrdinals = lineBreakOrdinalTable(candidate);
  const sourceAnchors = uniqueStructuralAnchors(source, (index) => sourceOrdinals[index]);
  const candidateAnchors = uniqueStructuralAnchors(candidate, (index) => candidateOrdinals[index]);
  for (const [anchor, sourceOrdinal] of sourceAnchors) {
    if (sourceOrdinal === null || !candidateAnchors.has(anchor)) continue;
    const candidateOrdinal = candidateAnchors.get(anchor);
    if (candidateOrdinal !== null && candidateOrdinal !== sourceOrdinal) return true;
  }
  return false;
}

function questionScopeTable(value) {
  const scopes = new Uint8Array(value.length + 1);
  if (QUESTION_SENTENCE_SEGMENTER) {
    for (const part of QUESTION_SENTENCE_SEGMENTER.segment(value)) {
      const question = questionTerminalRecords(part.segment).length > 0 ? 1 : 0;
      scopes.fill(question, part.index, part.index + part.segment.length);
    }
    return scopes;
  }
  let start = 0;
  for (const match of value.matchAll(/[.!?。！？]+(?:\s|$)/gu)) {
    const end = match.index + match[0].length;
    const question = questionTerminalRecords(value.slice(start, end)).length > 0 ? 1 : 0;
    scopes.fill(question, start, end);
    start = end;
  }
  return scopes;
}

function hasRelocatedUniqueQuestionAnchor(source, candidate) {
  if (!sameQuestionStructure(source, candidate) || questionTerminalRecords(source).length === 0) return false;
  const sourceScopes = questionScopeTable(source);
  const candidateScopes = questionScopeTable(candidate);
  const sourceAnchors = uniqueStructuralAnchors(source, (index) => sourceScopes[index]);
  const candidateAnchors = uniqueStructuralAnchors(candidate, (index) => candidateScopes[index]);
  for (const [anchor, sourceScope] of sourceAnchors) {
    if (sourceScope === null || !candidateAnchors.has(anchor)) continue;
    const candidateScope = candidateAnchors.get(anchor);
    if (candidateScope !== null && candidateScope !== sourceScope) return true;
  }
  return false;
}

function hasRelocatedUniqueIsolateAnchor(source, candidate) {
  if (!/[\u2066-\u2069]/u.test(source) || !sameBidiIsolateStructure(source, candidate)) return false;
  const sourceFrames = bidiFrameOrdinalTable(source);
  const candidateFrames = bidiFrameOrdinalTable(candidate);
  if (!sourceFrames || !candidateFrames) return false;
  const sourceAnchors = uniqueStructuralAnchors(source, (index) => sourceFrames[index]);
  const candidateAnchors = uniqueStructuralAnchors(candidate, (index) => candidateFrames[index]);
  for (const [anchor, sourceFrame] of sourceAnchors) {
    if (sourceFrame === null || !candidateAnchors.has(anchor)) continue;
    const candidateFrame = candidateAnchors.get(anchor);
    if (candidateFrame !== null && candidateFrame !== sourceFrame) return true;
  }
  return false;
}

const TYPOGRAPHIC_COMBINING_MARK = /[\p{Me}\u0305\u0332-\u0338\u033F\u035C-\u0362\u1DCD\u20D2\u20D3\u20E5\u20E6\u20EB\uFE20-\uFE2F]/gu;

function normalizedWithoutPresentationCharacters(value) {
  // Remove punctuation and symbols before compatibility folding as well as
  // after it. The first pass prevents decorative compatibility symbols such
  // as ™ from folding into apparent letters; the second handles punctuation
  // introduced by compatibility normalization. This comparison is symmetric:
  // adding or removing presentation alone cannot earn rewrite credit.
  const protectedQuantities = [...withoutDefaultIgnorables(value)].map((character) => {
    if (/[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/u.test(character)) {
      return ` superscript${character.codePointAt(0).toString(16)} `;
    }
    if (/[\p{P}\p{S}]/u.test(character)) return "";
    return character;
  }).join("");
  return foldLatticePresentationLetters(protectedQuantities).normalize("NFKC")
    .replace(DEFAULT_IGNORABLE_CODE_POINT, "")
    .replace(TYPOGRAPHIC_COMBINING_MARK, "")
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/\p{Cf}/gu, "")
    .toLocaleLowerCase("und")
    .replace(/i\u0307/gu, "i")
    .replaceAll("ß", "ss")
    .replaceAll("ς", "σ")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizedTypographyRepresentation(value) {
  const protectedQuantities = [...withoutDefaultIgnorables(value)].map((character) => (
    /[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/u.test(character)
      ? ` superscript${character.codePointAt(0).toString(16)} `
      : character
  )).join("");
  return foldLatticePresentationLetters(protectedQuantities).normalize("NFKC")
    .replace(DEFAULT_IGNORABLE_CODE_POINT, "")
    .replace(TYPOGRAPHIC_COMBINING_MARK, "")
    .replace(/[\p{P}\p{S}]/gu, " ")
    .replace(/\p{Cf}/gu, "")
    .toLocaleLowerCase("und")
    .replace(/i\u0307/gu, "i")
    .replaceAll("ß", "ss")
    .replaceAll("ς", "σ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function materiallyDifferent(source, candidate) {
  // Whether a material lexical/syntactic/operator change serves the source's
  // realization plan remains an independent semantic-verifier decision. This
  // host gate only prevents case, spacing, and decorative punctuation from
  // being presented as a rewrite.
  return normalizedMaterialRepresentation(source) !== normalizedMaterialRepresentation(candidate)
    && normalizedTypographyRepresentation(source) !== normalizedTypographyRepresentation(candidate)
    && normalizedWithoutPresentationCharacters(source) !== normalizedWithoutPresentationCharacters(candidate);
}

function finding(id, passageId, message, atomIds = []) {
  return Object.freeze({ id, passageId, message, atomIds: Object.freeze(atomIds) });
}

function literalCount(value, literal) {
  if (!literal) return 0;
  let count = 0;
  let cursor = 0;
  while (cursor <= value.length - literal.length) {
    const index = value.indexOf(literal, cursor);
    if (index < 0) break;
    count += 1;
    cursor = index + literal.length;
  }
  return count;
}

function exactOccurrenceFindings(source, candidate, passageId) {
  // Keep this gate to literal formats with a surface-identity contract. Names
  // and lexical semantic markers are modeled as atoms and checked relationally
  // by the independent verifier; their counts cannot prove semantic fidelity.
  const checks = [
    ["url", URL, "A URL changed or its occurrence count differs.", trimmedUrl],
    ["email", EMAIL, "An email address changed or its occurrence count differs."],
    ["phone", PHONE, "A phone number changed or its occurrence count differs.", canonicalPhone],
    ["markdown-link", MARKDOWN_LINK, "A Markdown link changed or its occurrence count differs."],
    ["inline-code", INLINE_CODE, "Inline code changed or its occurrence count differs."],
    ["markup", MARKUP, "Markup changed or its occurrence count differs."],
    ["quantity", QUANTITY, "A number, comparator, range, or unit changed or its occurrence count differs.", canonicalQuantity],
    ["formal-identifier", FORMAL_IDENTIFIER, "A formal identifier changed or its occurrence count differs."],
  ];
  const findings = [];
  const compareBoundaryOrdinals = sameLineBreakStructure(source, candidate)
    && lineBreakSignature(source).length > 0;
  const compareFrameOrdinals = /[\u2066-\u2069]/u.test(source)
    && sameBidiIsolateStructure(source, candidate);
  const sourceOrdinals = compareBoundaryOrdinals ? lineBreakOrdinalTable(source) : null;
  const candidateOrdinals = compareBoundaryOrdinals ? lineBreakOrdinalTable(candidate) : null;
  const sourceFrames = compareFrameOrdinals ? bidiFrameOrdinalTable(source) : null;
  const candidateFrames = compareFrameOrdinals ? bidiFrameOrdinalTable(candidate) : null;
  for (const [id, pattern, message, transform] of checks) {
    const sourceRecords = occurrenceRecords(source, pattern, transform);
    const candidateRecords = occurrenceRecords(candidate, pattern, transform);
    const sourceOccurrences = sourceRecords.map(({ item }) => item);
    const candidateOccurrences = candidateRecords.map(({ item }) => item);
    if (!sameMultiset(sourceOccurrences, candidateOccurrences)) {
      findings.push(finding(`deterministic-${id}`, passageId, message));
      continue;
    }
    if (compareBoundaryOrdinals || compareFrameOrdinals) {
      if (!sameMultiset(
        sourceRecords.map(({ item, index }) => (
          `${sourceOrdinals?.[index] ?? ""}\u241f${sourceFrames?.[index] ?? ""}\u241f${item}`
        )),
        candidateRecords.map(({ item, index }) => (
          `${candidateOrdinals?.[index] ?? ""}\u241f${candidateFrames?.[index] ?? ""}\u241f${item}`
        )),
      )) {
        findings.push(finding(
          `deterministic-${id}-boundary`,
          passageId,
          "An exact source item moved across a line, paragraph, stanza, or direction-isolate boundary.",
        ));
      }
    }
  }
  return findings;
}

function protectedLiteralFindings(source, candidate, passageId) {
  const sourceProtected = latticeProtectedLiteralMatches(source);
  if (sourceProtected.length === 0) return [];
  const sourceOrdinals = lineBreakOrdinalTable(source);
  const candidateOrdinals = lineBreakOrdinalTable(candidate);
  const sourceFrames = bidiFrameOrdinalTable(source);
  const candidateFrames = bidiFrameOrdinalTable(candidate);
  const counts = new Map();
  for (const { text } of sourceProtected) counts.set(text, (counts.get(text) ?? 0) + 1);
  for (const [text, count] of counts) {
    if (literalCount(candidate, text) !== count) {
      return [finding("deterministic-protected-literal", passageId, "Protected dialogue or direct instruction text changed or disappeared.")];
    }
  }
  let cursor = 0;
  for (const span of sourceProtected) {
    const candidateIndex = candidate.indexOf(span.text, cursor);
    if (candidateIndex < 0
      || sourceOrdinals[span.startUtf16] !== candidateOrdinals[candidateIndex]
      || (sourceFrames?.[span.startUtf16] ?? "") !== (candidateFrames?.[candidateIndex] ?? "")) {
      return [finding("deterministic-protected-literal-order", passageId, "Protected dialogue or direct instructions changed order or structural scope.")];
    }
    cursor = candidateIndex + span.text.length;
  }
  return [];
}

function requiredAtomIds(plan) {
  return plan.atoms.map((atom) => atom.id);
}

function sameIdSet(expected, actual) {
  if (new Set(actual).size !== actual.length) return false;
  if (expected.length !== actual.length) return false;
  const actualSet = new Set(actual);
  return expected.every((id) => actualSet.has(id));
}

export function deterministicPassageReview(sourcePassage, plan, candidate) {
  const findings = [];
  const passageId = sourcePassage.id;
  if (typeof candidate?.text !== "string" || candidate.text.length === 0) {
    return Object.freeze([finding("candidate-empty", passageId, "The candidate passage is empty.")]);
  }
  if (candidate.text.length > Math.max(1_400, sourcePassage.text.length * 4 + 400)) {
    findings.push(finding("candidate-expanded", passageId, "The candidate expanded beyond the bounded passage limit."));
  }
  if (containsDisallowedLatticeControls(candidate.text) || containsUnpairedSurrogate(candidate.text)) {
    findings.push(finding("candidate-controls", passageId, "The candidate contains unsupported control characters."));
  }
  if (hasInvalidLatticeBidiIsolates(candidate.text)) {
    findings.push(finding("candidate-bidi-isolates", passageId, "The candidate contains unbalanced or overly nested direction isolates."));
  }
  if (!sameDefaultIgnorableStructure(sourcePassage.text, candidate.text)) {
    findings.push(finding("candidate-invisible-structure", passageId, "The candidate changed protected invisible directional, filler, or Latin-joiner structure."));
  }
  const bidiStructureMatches = sameBidiIsolateStructure(sourcePassage.text, candidate.text);
  if (!bidiStructureMatches || hasRelocatedUniqueIsolateAnchor(sourcePassage.text, candidate.text)) {
    findings.push(finding("candidate-bidi-sequence", passageId, "The candidate changed a source direction-isolate structure or moved unchanged language across its scope."));
  }
  if (!sameLineBreakStructure(sourcePassage.text, candidate.text)) {
    findings.push(finding("candidate-boundaries", passageId, "The candidate changed a source line, paragraph, or stanza boundary."));
  } else if (hasRelocatedUniqueBoundaryAnchor(sourcePassage.text, candidate.text)) {
    findings.push(finding("candidate-boundary-anchor", passageId, "Unchanged source language moved across a line, paragraph, or stanza boundary."));
  }
  if (!sameQuestionStructure(sourcePassage.text, candidate.text)
    || hasRelocatedUniqueQuestionAnchor(sourcePassage.text, candidate.text)) {
    findings.push(finding("candidate-speech-act", passageId, "The candidate changed a source question into a different speech act, or introduced one."));
  }
  if (countLatticeWords(candidate.text) > Math.max(120, sourcePassage.wordCount * 3 + 24)) {
    findings.push(finding("candidate-word-growth", passageId, "The candidate added too much unsupported language."));
  }
  if (candidate.layer !== plan.layer) {
    findings.push(finding("candidate-layer", passageId, "The candidate did not use the planned passage layer."));
  }

  const expectedAtomIds = requiredAtomIds(plan);
  if (!Array.isArray(candidate.preservedAtomIds)
    || !sameIdSet(expectedAtomIds, candidate.preservedAtomIds)) {
    findings.push(finding("candidate-atom-claim", passageId, "The candidate did not account for every planned atom exactly once.", expectedAtomIds));
  }

  for (const atom of plan.atoms) {
    if (atom.preservation !== "exact") continue;
    const exactEvidence = atom.evidence.map((item) => item.text).filter(Boolean);
    if (exactEvidence.some((evidence) => literalCount(sourcePassage.text, evidence) !== literalCount(candidate.text, evidence))) {
      findings.push(finding(
        "candidate-exact-atom",
        passageId,
        "Content marked for exact preservation changed or disappeared.",
        [atom.id],
      ));
    }
  }

  findings.push(...exactOccurrenceFindings(sourcePassage.text, candidate.text, passageId));
  findings.push(...protectedLiteralFindings(sourcePassage.text, candidate.text, passageId));

  if (plan.disposition === "rewrite" && !materiallyDifferent(sourcePassage.text, candidate.text)) {
    findings.push(finding("candidate-not-material", passageId, "The planned rewrite changed only presentation, not language."));
  }
  if (plan.disposition === "retain-if-conformant" && candidate.text !== sourcePassage.text) {
    findings.push(finding("candidate-retained-changed", passageId, "A passage asserted to be positively conformant was changed."));
  }

  return Object.freeze(findings);
}

export function deterministicBatchReview(batch, analysis, candidate) {
  const analysisById = new Map(analysis.passages.map((passage) => [passage.passageId, passage]));
  const candidateById = new Map(candidate.passages.map((passage) => [passage.passageId, passage]));
  const findings = [];
  if (analysisById.size !== batch.passages.length || candidateById.size !== batch.passages.length) {
    findings.push(finding("candidate-coverage", "", "The batch does not account for every passage exactly once."));
  }
  for (const sourcePassage of batch.passages) {
    const plan = analysisById.get(sourcePassage.id);
    const output = candidateById.get(sourcePassage.id);
    if (!plan || !output) {
      findings.push(finding("candidate-passage-missing", sourcePassage.id, "A source passage was omitted."));
      continue;
    }
    findings.push(...deterministicPassageReview(sourcePassage, plan, output));
  }
  const totalLength = candidate.passages.reduce((sum, passage) => sum + String(passage.text ?? "").length, 0);
  if (totalLength > LATTICE_INPUT_SAFETY_LIMIT + 8_000) {
    findings.push(finding("candidate-document-size", "", "The candidate exceeds the document safety boundary."));
  }
  return Object.freeze(findings);
}

export function deterministicDocumentReview(source, candidate) {
  const findings = [];
  if (typeof candidate !== "string" || candidate.length === 0) {
    return Object.freeze([finding("document-empty", "", "The assembled candidate is empty.")]);
  }
  if (candidate.length > LATTICE_INPUT_SAFETY_LIMIT + 8_000) {
    findings.push(finding("document-size", "", "The assembled candidate exceeds the document safety boundary."));
  }
  if (containsDisallowedLatticeControls(candidate) || containsUnpairedSurrogate(candidate)) {
    findings.push(finding("document-unicode", "", "The assembled candidate contains an unsupported or incomplete character."));
  }
  if (containsLatticeNoncharacter(candidate)
    || containsOversizedLatticeGrapheme(candidate)
    || containsOversizedLatticeToken(candidate)
    || countLatticeFormatControls(candidate) > LATTICE_FORMAT_CONTROL_LIMIT) {
    findings.push(finding("document-unicode-bounds", "", "The assembled candidate exceeds a Unicode safety boundary."));
  }
  if (hasInvalidLatticeBidiIsolates(candidate)) {
    findings.push(finding("document-bidi-isolates", "", "The assembled candidate contains unbalanced or overly nested direction isolates."));
  }
  if (!sameDefaultIgnorableStructure(source, candidate)) {
    findings.push(finding("document-invisible-structure", "", "The assembled candidate changed protected invisible directional, filler, or Latin-joiner structure."));
  }
  const bidiStructureMatches = sameBidiIsolateStructure(source, candidate);
  if (!bidiStructureMatches || hasRelocatedUniqueIsolateAnchor(source, candidate)) {
    findings.push(finding("document-bidi-sequence", "", "The assembled candidate changed a source direction-isolate structure or moved unchanged language across its scope."));
  }
  if (!sameLineBreakStructure(source, candidate)) {
    findings.push(finding("document-boundaries", "", "The assembled candidate changed a source line, paragraph, or stanza boundary."));
  } else if (hasRelocatedUniqueBoundaryAnchor(source, candidate)) {
    findings.push(finding("document-boundary-anchor", "", "Unchanged source language moved across a line, paragraph, or stanza boundary."));
  }
  if (!sameQuestionStructure(source, candidate) || hasRelocatedUniqueQuestionAnchor(source, candidate)) {
    findings.push(finding("document-speech-act", "", "The assembled candidate changed a source question into a different speech act, or introduced one."));
  }
  if (countLatticeWords(candidate) > Math.max(1_400, countLatticeWords(source) * 2 + 100)) {
    findings.push(finding("document-word-growth", "", "The assembled candidate added too much unsupported language."));
  }
  findings.push(...exactOccurrenceFindings(source, candidate, ""));
  findings.push(...protectedLiteralFindings(source, candidate, ""));
  return Object.freeze(findings);
}
