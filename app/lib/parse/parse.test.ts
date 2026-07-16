import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument } from "./index";

describe("parseDocument", () => {
  it("splits on blank-line boundaries and records gaps", () => {
    const { blocks } = parseDocument("A\nB\n\n\nC\n");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ id: 0, lines: ["A", "B"], startLine: 0, gapBefore: 0 });
    expect(blocks[1]).toMatchObject({ id: 1, lines: ["C"], startLine: 4, gapBefore: 2 });
  });

  it("records leading blank lines as gapBefore on the first block", () => {
    const { blocks } = parseDocument("\n\nHello\n");
    expect(blocks[0]).toMatchObject({ startLine: 2, gapBefore: 2 });
  });

  it("computes the common left indent, ignoring blank interior lines", () => {
    const { blocks } = parseDocument("    a\n      b\n    c");
    expect(blocks[0]!.indent).toBe(4);
  });

  it("parses a real fixture into many verbatim blocks", () => {
    const text = readFileSync(
      resolve(
        process.cwd(),
        "fixtures",
        "Ace Combat 3_ Electrosphere - Guide and Walkthrough - PlayStation - By Shotgunnova - GameFAQs.txt",
      ),
      "utf-8",
    );
    const { blocks } = parseDocument(text);
    expect(blocks.length).toBeGreaterThan(20);
    // Every block is verbatim until the P6 classifier runs.
    expect(blocks.every((b) => b.kind === "art")).toBe(true);
    // Lines are preserved exactly (no trimming of ASCII art).
    expect(blocks[0]!.lines.join("\n")).toContain("Shotgunnova");
  });
});
