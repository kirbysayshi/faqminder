import { describe, expect, it } from "vitest";
import { FAQ_CLIP_MARKER, parseFaqFilename, parsePastedFaq } from "./index";

describe("parseFaqFilename", () => {
  it("splits title from descriptor and drops the GameFAQs suffix", () => {
    const r = parseFaqFilename(
      "Metal Gear Solid 2_ Sons of Liberty - Guide and Walkthrough - PlayStation 2 - By Conquerer - GameFAQs.txt",
    );
    expect(r.title).toBe("Metal Gear Solid 2: Sons of Liberty");
    expect(r.descriptor).toBe("Guide and Walkthrough · PlayStation 2 · By Conquerer");
  });

  it("handles a plain filename with no descriptor", () => {
    expect(parseFaqFilename("walkthrough.txt")).toEqual({
      title: "walkthrough",
      descriptor: "",
    });
  });

  it("converts underscore to colon", () => {
    expect(parseFaqFilename("Ace Combat 3_ Electrosphere.txt").title).toBe(
      "Ace Combat 3: Electrosphere",
    );
  });
});

describe("parsePastedFaq", () => {
  it("reads title/descriptor from the marker header and strips it from the body", () => {
    const raw =
      `${FAQ_CLIP_MARKER}\tMetal Gear Solid 2 - Guide and Walkthrough - PlayStation 2 - By Conquerer - GameFAQs\n` +
      "  1. INTRODUCTION\nbody line";
    const r = parsePastedFaq(raw);
    expect(r.title).toBe("Metal Gear Solid 2");
    expect(r.source).toContain("PlayStation 2");
    expect(r.text).toBe("  1. INTRODUCTION\nbody line");
    // the descriptor the library will show comes from `source`
    expect(parseFaqFilename(r.source).descriptor).toBe(
      "Guide and Walkthrough · PlayStation 2 · By Conquerer",
    );
  });

  it("does not swallow real body when there is no header", () => {
    const raw = "         SUPER GAME FAQ\n         by Someone\n\nSection 1";
    const r = parsePastedFaq(raw);
    expect(r.title).toBe("SUPER GAME FAQ");
    expect(r.source).toBe("");
    expect(r.text).toBe(raw); // whole thing is the FAQ — nothing stripped
  });

  it("falls back to a placeholder title for blank input", () => {
    expect(parsePastedFaq("   \n\n ").title).toBe("Untitled FAQ");
  });
});
