import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument, reflowText } from "./index";

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

  it("parses a real fixture into many blocks, preserving lines verbatim", () => {
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
    expect(blocks[0]!.lines.join("\n")).toContain("Shotgunnova"); // lines untouched
    // The banner is art; ASCII art must dominate a FAQ (conservative classifier).
    expect(blocks[0]!.kind).toBe("art");
    const art = blocks.filter((b) => b.kind === "art").length;
    expect(art / blocks.length).toBeGreaterThan(0.6);
  });
});

describe("prose classification", () => {
  const prose = [
    "This is a normal hard-wrapped paragraph of prose text that a FAQ author",
    "typed at roughly seventy columns wide, breaking each line manually as they",
    "went, which is exactly the kind of block we want to be able to reflow.",
  ].join("\n");

  it("classifies a hard-wrapped paragraph as prose", () => {
    expect(parseDocument(prose).blocks[0]!.kind).toBe("prose");
  });

  it("reflows prose by dropping hard wraps and collapsing whitespace", () => {
    const { blocks } = parseDocument(prose);
    const text = reflowText(blocks[0]!);
    expect(text).not.toContain("\n");
    expect(text.startsWith("This is a normal hard-wrapped paragraph")).toBe(true);
    expect(text).toContain("author typed at"); // wrap boundary joined with a space
  });

  it("keeps ASCII banners as art", () => {
    const banner = ["=====================", "|  SUPER GAME  FAQ  |", "====================="].join("\n");
    expect(parseDocument(banner).blocks[0]!.kind).toBe("art");
  });

  it("keeps a ragged list as art (conservative)", () => {
    const list = [
      "  - Sword: found in the opening cave near the waterfall",
      "  - Shield: purchased from the town armorer for 90 gold",
      "  - Potion: dropped occasionally by slimes in the forest",
    ].join("\n");
    // Ragged right edge (varying line lengths) => not a wrapped paragraph.
    expect(parseDocument(list).blocks[0]!.kind).toBe("art");
  });

  it("keeps a dotted-leader TOC as art", () => {
    const toc = [
      "  I. Introduction ............................ INTRO",
      " II. Controls ............................... CTRL0",
      "III. Walkthrough ............................ WLKTH",
    ].join("\n");
    expect(parseDocument(toc).blocks[0]!.kind).toBe("art");
  });
});
