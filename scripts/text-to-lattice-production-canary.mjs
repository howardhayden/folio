export const LATTICE_PRODUCTION_CANARY_TEXT =
  "A visitor places a blue notebook on the desk, reads the first page, and closes it.\n";

export const LATTICE_PRODUCTION_CANARY_REQUEST = Object.freeze({
  text: LATTICE_PRODUCTION_CANARY_TEXT,
  requested_mode: "operative",
  schema_version: 1,
});

// Generate a fresh length/structure fixture in memory. Release receipts contain
// counts and timing only. No visitor passage or generated body is recorded.
export function makeLongProseFixture(pick) {
  const people = ["reader", "clerk", "guide", "painter", "baker", "gardener"];
  const objects = ["book", "basket", "lantern", "folder", "notebook", "box"];
  const places = ["workshop", "cottage", "library", "station", "market", "hall"];
  const verbs = ["carried", "brought", "held", "moved"];
  const colors = ["blue", "red", "green", "yellow"];
  return Array.from({ length: 12 }, (_, paragraph) => {
    const person = pick(people);
    const other = pick(people.filter(value => value !== person));
    const item = pick(objects);
    const place = pick(places);
    const color = pick(colors);
    const lines = [
      ["At", pick(["dawn", "noon", "dusk"]), "the", person, pick(verbs), "a", color, item, "beside", "the", "old", place, "in", "silence"],
      ["The", other, "saw", "the", item, "and", "asked", "whether", "the", person, "needed", "help", "that", "day"],
      ["They", "walked", "past", "the", place, "together", "and", "set", "the", item, "on", "a", "wooden", "table"],
      ["Before", "leaving", "the", place, "the", person, "thanked", "the", other, "and", "closed", "the", "front", "door"],
    ];
    const sentences = lines.map((words, i) => {
      if (paragraph < 4) words.splice([10, 6, 10, 10][i], 0, ["quiet", "politely", "down", "gently"][i]);
      return words.join(" ") + ".";
    });
    // Four additional line boundaries exercise the long-job tier after packing.
    return paragraph < 4 ? sentences[0] + "\n" + sentences.slice(1).join(" ") : sentences.join(" ");
  }).join("\n\n") + "\n";
}
