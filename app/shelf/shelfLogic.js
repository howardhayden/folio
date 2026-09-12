import { filterShelfPapersWithOntology } from "./shelfSearchOntology.ts";

const DEFAULT_SEED = 0x484148;

function paperKey(paper) {
  return paper.title;
}

function seededRandom(seed) {
  const numericSeed = Number(seed);
  let state = Number.isFinite(numericSeed) ? numericSeed >>> 0 : DEFAULT_SEED;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomShelfSeed(cryptoSource = globalThis.crypto, fallbackRandom = Math.random) {
  if (typeof cryptoSource?.getRandomValues === "function") {
    const seed = new Uint32Array(1);
    cryptoSource.getRandomValues(seed);
    return seed[0];
  }

  // Shelf order is not security-sensitive, but older browsers still deserve
  // a fresh arrangement rather than the former fixed revision sequence.
  return Math.floor(fallbackRandom() * 0x1_0000_0000) >>> 0;
}

export function filterShelfPapers(papers, filters) {
  return filterShelfPapersWithOntology(papers, filters);
}

export function shuffleShelfPapers(items, seed, previousOrder = []) {
  const shuffled = [...items];
  const random = seededRandom(seed);

  for (let currentIndex = shuffled.length; currentIndex > 1;) {
    const randomIndex = Math.floor(random() * currentIndex);
    currentIndex -= 1;
    [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
  }

  if (shuffled.length > 1) {
    const currentKeys = shuffled.map(paperKey);
    const matchingPreviousKeys = previousOrder.filter((key) => currentKeys.includes(key));
    if (matchingPreviousKeys.length === currentKeys.length
      && matchingPreviousKeys.every((key, index) => key === currentKeys[index])) {
      shuffled.push(shuffled.shift());
    }
  }

  return shuffled;
}

export function arrangeShelfPapers(papers, filters, seed, previousOrder = []) {
  return shuffleShelfPapers(filterShelfPapers(papers, filters), seed, previousOrder);
}
