import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  arrangeShelfPapers,
  randomShelfSeed,
} from "../app/shelf/shelfLogic.js";

const fixture = [
  { title: "Alpha", languages: ["English"], publishers: ["One"], authors: ["A"], collections: ["Technology"] },
  { title: "Bravo", languages: ["English"], publishers: ["Two"], authors: ["B"], collections: ["Technology"] },
  { title: "Charlie", languages: ["Spanish"], publishers: ["One"], authors: ["C"], collections: ["Technology"] },
  { title: "Delta", languages: ["English"], publishers: ["One"], authors: ["D"], collections: ["History"] },
];

const emptyFilters = { language: "", publisher: "", author: "", collection: "" };

test("Shelf seeds each client arrangement from browser entropy", () => {
  const suppliedSeeds = [0x1020_3040, 0x5060_7080];
  const cryptoSource = {
    getRandomValues(words) {
      words[0] = suppliedSeeds.shift();
      return words;
    },
  };

  assert.equal(randomShelfSeed(cryptoSource), 0x1020_3040);
  assert.equal(randomShelfSeed(cryptoSource), 0x5060_7080);
  assert.equal(suppliedSeeds.length, 0, "a fresh entropy read is made for every arrangement");
});

test("Shelf retains a bounded random fallback and never mutates canonical records", () => {
  const sourceOrder = fixture.map(({ title }) => title);

  assert.equal(randomShelfSeed(null, () => 0.25), 0x4000_0000);
  arrangeShelfPapers(fixture, emptyFilters, 0x4000_0000);
  assert.deepEqual(fixture.map(({ title }) => title), sourceOrder);
});

test("Shelf defers randomization until after hydration and reseeds every search edit", async () => {
  const source = await readFile(new URL("../app/shelf/ShelfExplorer.tsx", import.meta.url), "utf8");

  assert.match(source, /const \[filtered, setFiltered\] = useState\(papers\);/u,
    "the server and first client render share the canonical order");
  assert.match(source, /useEffect\(\(\) => \{[\s\S]*?requestAnimationFrame\(\(\) => \{[\s\S]*?randomShelfSeed\(\)/u,
    "load-in randomization begins only after hydration commits");

  const changeFilter = source.match(/const changeFilter =[\s\S]*?\n  \};/u)?.[0] ?? "";
  assert.match(changeFilter, /randomShelfSeed\(\)/u,
    "every input edit draws a fresh seed");
  assert.doesNotMatch(source, /arrangementRevision/u,
    "client arrangements no longer replay a fixed revision sequence");
});
