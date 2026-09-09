export const LATTICE_WORD_LIMIT = 700;
export const LATTICE_INPUT_SAFETY_LIMIT = 12_000;
// Keep the byte guard independently meaningful while admitting the documented
// 700-word dense-CJK boundary (about 32.2 kB). UTF-16 length alone would admit
// almost 36 kB of three-byte BMP input.
export const LATTICE_INPUT_UTF8_LIMIT = 35_000;
export const LATTICE_CLARIFICATION_WORD_LIMIT = 32;
export const LATTICE_CLARIFICATION_SAFETY_LIMIT = 160;
export const LATTICE_CLARIFICATION_UTF8_LIMIT = 96;
export const LATTICE_CLARIFICATION_SERIALIZED_UTF8_LIMIT = 128;
export const LATTICE_GRAPHEME_CODE_POINT_LIMIT = 64;
export const LATTICE_FORMAT_CONTROL_LIMIT = 256;
export const LATTICE_TOKEN_CODE_POINT_LIMIT = 512;
export const LATTICE_COMPLETION_CALL_LIMIT = 512;

const WORD_FALLBACK = /[\p{L}\p{M}\p{N}]+(?:[’'_-][\p{L}\p{M}\p{N}]+)*/gu;
const DISALLOWED_CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u206A-\u206F]/u;
// Default-ignorables include visually blank code points outside General
// Category Cf (for example Hangul fillers and variation selectors). Count the
// union so the global invisible-content ceiling and the visible-word check use
// the same security boundary.
const INVISIBLE_FORMATTING = /(?:\p{Cf}|\p{Default_Ignorable_Code_Point})/gu;
const TEXT_ENCODER = typeof TextEncoder === "function" ? new TextEncoder() : null;
const GRAPHEME_SEGMENTER = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("und", { granularity: "grapheme" })
  : null;
const WORD_SEGMENTER = typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
  ? new Intl.Segmenter("und", { granularity: "word" })
  : null;

function requireLatticeSegmentationSupport() {
  if (!GRAPHEME_SEGMENTER || !WORD_SEGMENTER) {
    throw new RangeError("This browser cannot safely segment Text to Lattice input.");
  }
}

export function containsUnpairedSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xD800 && unit <= 0xDBFF) {
      if (index + 1 >= value.length) return true;
      const next = value.charCodeAt(index + 1);
      if (next < 0xDC00 || next > 0xDFFF) return true;
      index += 1;
    } else if (unit >= 0xDC00 && unit <= 0xDFFF) {
      return true;
    }
  }
  return false;
}

export function containsDisallowedLatticeControls(value) {
  return DISALLOWED_CONTROLS.test(value);
}

export function containsLatticeNoncharacter(value) {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (
      codePoint >= 0xFDD0 && codePoint <= 0xFDEF
      || codePoint >= 0xFFFE && (codePoint & 0xFFFE) === 0xFFFE
    ) return true;
  }
  return false;
}

export function hasInvalidLatticeBidiIsolates(value) {
  let depth = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint >= 0x2066 && codePoint <= 0x2068) {
      depth += 1;
      if (depth > 8) return true;
    } else if (codePoint === 0x2069) {
      depth -= 1;
      if (depth < 0) return true;
    }
  }
  return depth !== 0;
}

export function containsOversizedLatticeGrapheme(value) {
  if (GRAPHEME_SEGMENTER) {
    for (const part of GRAPHEME_SEGMENTER.segment(value)) {
      if ([...part.segment].length > LATTICE_GRAPHEME_CODE_POINT_LIMIT) return true;
    }
    return false;
  }

  // The fallback bounds the combining/joining tail that creates pathological
  // graphemes without trying to replace the platform's Unicode segmenter.
  let continuationLength = 0;
  for (const character of value) {
    if (/\p{M}|\u200D|[\uFE00-\uFE0F]/u.test(character)) continuationLength += 1;
    else continuationLength = 1;
    if (continuationLength > LATTICE_GRAPHEME_CODE_POINT_LIMIT) return true;
  }
  return false;
}

export function countLatticeFormatControls(value) {
  return value.match(INVISIBLE_FORMATTING)?.length ?? 0;
}

export function latticeUtf8Length(value) {
  if (TEXT_ENCODER) return TEXT_ENCODER.encode(value).byteLength;
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    bytes += codePoint <= 0x7F ? 1 : codePoint <= 0x7FF ? 2 : codePoint <= 0xFFFF ? 3 : 4;
  }
  return bytes;
}

export function latticeInertJsonUtf8Length(value) {
  return latticeUtf8Length(JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029"));
}

export function containsOversizedLatticeToken(value) {
  if (WORD_SEGMENTER) {
    for (const part of WORD_SEGMENTER.segment(value)) {
      if (part.isWordLike && [...part.segment].length > LATTICE_TOKEN_CODE_POINT_LIMIT) return true;
    }
    return false;
  }
  for (const match of value.matchAll(WORD_FALLBACK)) {
    if ([...match[0]].length > LATTICE_TOKEN_CODE_POINT_LIMIT) return true;
  }
  return false;
}

export function countLatticeWords(value) {
  const source = String(value ?? "").replace(INVISIBLE_FORMATTING, "");
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("und", { granularity: "word" });
    let count = 0;
    for (const part of segmenter.segment(source)) {
      if (part.isWordLike) count += 1;
    }
    return count;
  }
  return source.match(WORD_FALLBACK)?.length ?? 0;
}

export function validateLatticeInput(value) {
  requireLatticeSegmentationSupport();
  if (typeof value !== "string") {
    throw new TypeError("Text to Lattice input must be text.");
  }
  if (value.length > LATTICE_INPUT_SAFETY_LIMIT) {
    throw new RangeError(
      `Text to Lattice input is too long for the ${LATTICE_INPUT_SAFETY_LIMIT.toLocaleString("en-US")}-character safety limit.`,
    );
  }
  if (containsDisallowedLatticeControls(value)) {
    throw new RangeError("Text to Lattice input contains unsupported control characters.");
  }
  if (containsUnpairedSurrogate(value)) {
    throw new RangeError("Text to Lattice input contains an incomplete Unicode character.");
  }
  if (latticeUtf8Length(value) > LATTICE_INPUT_UTF8_LIMIT) {
    throw new RangeError("Text to Lattice input is too large to process safely.");
  }
  if (containsLatticeNoncharacter(value)) {
    throw new RangeError("Text to Lattice input contains a reserved Unicode noncharacter.");
  }
  if (hasInvalidLatticeBidiIsolates(value)) {
    throw new RangeError("Text to Lattice input contains unbalanced or overly nested direction markers.");
  }
  if (containsOversizedLatticeGrapheme(value)) {
    throw new RangeError("Text to Lattice input contains a character sequence this demonstration cannot process safely.");
  }
  if (containsOversizedLatticeToken(value)) {
    throw new RangeError("Text to Lattice input contains an overlong word-like token.");
  }
  if (countLatticeFormatControls(value) > LATTICE_FORMAT_CONTROL_LIMIT) {
    throw new RangeError("Text to Lattice input contains too many invisible formatting controls.");
  }

  const wordCount = countLatticeWords(value);
  if (wordCount === 0) {
    throw new RangeError("Enter text with at least one word before running Text to Lattice.");
  }
  if (wordCount > LATTICE_WORD_LIMIT) {
    throw new RangeError(
      `Text to Lattice accepts up to ${LATTICE_WORD_LIMIT} words; this input has ${wordCount}.`,
    );
  }

  return Object.freeze({ source: value, wordCount });
}

export function validateLatticeClarificationAnswer(value) {
  requireLatticeSegmentationSupport();
  if (typeof value !== "string") {
    throw new TypeError("A clarification answer must be text.");
  }
  if (value.length > LATTICE_CLARIFICATION_SAFETY_LIMIT) {
    throw new RangeError(`Keep each clarification answer to ${LATTICE_CLARIFICATION_SAFETY_LIMIT} characters or fewer.`);
  }
  if (containsDisallowedLatticeControls(value)) {
    throw new RangeError("A clarification answer contains unsupported control characters.");
  }
  if (containsUnpairedSurrogate(value)) {
    throw new RangeError("A clarification answer contains an incomplete Unicode character.");
  }
  if (containsLatticeNoncharacter(value)) {
    throw new RangeError("A clarification answer contains a reserved Unicode noncharacter.");
  }
  if (hasInvalidLatticeBidiIsolates(value)) {
    throw new RangeError("A clarification answer contains unbalanced or overly nested direction markers.");
  }
  if (containsOversizedLatticeGrapheme(value)) {
    throw new RangeError("A clarification answer contains a character sequence this demonstration cannot process safely.");
  }
  if (containsOversizedLatticeToken(value)) {
    throw new RangeError("A clarification answer contains an overlong word-like token.");
  }
  if (countLatticeFormatControls(value) > LATTICE_FORMAT_CONTROL_LIMIT) {
    throw new RangeError("A clarification answer contains too many invisible formatting controls.");
  }
  if (latticeUtf8Length(value) > LATTICE_CLARIFICATION_UTF8_LIMIT) {
    throw new RangeError("Shorten the clarification answer before continuing.");
  }
  if (latticeInertJsonUtf8Length(value) > LATTICE_CLARIFICATION_SERIALIZED_UTF8_LIMIT) {
    throw new RangeError("Shorten the clarification answer before continuing.");
  }
  const wordCount = countLatticeWords(value);
  if (wordCount === 0) throw new RangeError("Enter a clarification answer before continuing.");
  if (wordCount > LATTICE_CLARIFICATION_WORD_LIMIT) {
    throw new RangeError(`Keep each clarification answer to ${LATTICE_CLARIFICATION_WORD_LIMIT} words or fewer.`);
  }
  return Object.freeze({ answer: value, wordCount });
}
