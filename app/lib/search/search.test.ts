import { describe, expect, it } from "vitest";
import { parseDocument } from "~/lib/parse";
import { findOccurrences } from "./index";

describe("findOccurrences", () => {
  const doc = parseDocument(
    ["  1. Controls ........ CNTR", "", "== CONTROLS ==", "Press X to fire. controls."].join("\n"),
  );

  it("ignores queries shorter than the minimum", () => {
    expect(findOccurrences(doc, "C")).toEqual([]);
    expect(findOccurrences(doc, "   ")).toEqual([]);
  });

  it("finds all case-insensitive occurrences with their block ids", () => {
    const hits = findOccurrences(doc, "controls");
    expect(hits.map((h) => [h.blockId, h.line])).toEqual([
      [0, 0], // "Controls" in the TOC line (block 0)
      [1, 2], // "CONTROLS" header (block 1, line 0)
      [1, 3], // "controls." in prose (same block 1, line 1 — no blank between)
    ]);
    expect(hits[0]!.match).toBe("Controls"); // original casing preserved
  });

  it("returns context around the match", () => {
    const [hit] = findOccurrences(doc, "fire");
    expect(hit).toMatchObject({ before: "Press X to ", match: "fire", after: ". controls." });
  });

  it("finds multiple hits on the same line", () => {
    const d = parseDocument("na na na batman");
    expect(findOccurrences(d, "na")).toHaveLength(3);
  });
});
