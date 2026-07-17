import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { expandTabs, parseDocument, reflowText } from "./index";

const first = (text: string) => parseDocument(text).blocks[0]!;

describe("parseDocument", () => {
  it("splits on blank-line boundaries and records gaps", () => {
    const { blocks } = parseDocument("A\nB\n\n\nC\n");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ id: 0, lines: ["A", "B"], startLine: 0, gapBefore: 0 });
    expect(blocks[1]).toMatchObject({ id: 1, lines: ["C"], startLine: 4, gapBefore: 2 });
  });

  it("records leading blank lines as gapBefore on the first block", () => {
    expect(parseDocument("\n\nHello\n").blocks[0]).toMatchObject({ startLine: 2, gapBefore: 2 });
  });

  it("computes the common left indent, ignoring blank interior lines", () => {
    expect(first("    a\n      b\n    c").indent).toBe(4);
  });

  it("parses a real fixture, preserving lines verbatim, banner stays art", () => {
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
    expect(blocks[0]!.kind).toBe("art"); // the banner
    // A real FAQ has both: plenty of art, and prose worth reflowing.
    expect(blocks.some((b) => b.kind === "art")).toBe(true);
    expect(blocks.some((b) => b.kind === "prose")).toBe(true);
  });
});

describe("expandTabs", () => {
  it("expands to 8-column tab stops, not a fixed run of spaces", () => {
    expect(expandTabs("\t  X")).toBe(" ".repeat(10) + "X"); // tab -> col 8, then 2 spaces
    expect(expandTabs("a\tb")).toBe("a" + " ".repeat(7) + "b"); // advances to col 8
  });

  it("makes tab- and space-indented siblings agree on their indent", () => {
    // Real FAQs mix both for the same visual column (Dragon Warrior IV does).
    const spaced = first(
      [
        "          Offensive: Dealing damage is the priority.  This will have mages",
        "                     in the party use their best attack spells here.",
      ].join("\n"),
    );
    const tabbed = first(
      [
        "\t  Try Out:   The best way to describe 'Try Out' is \"random\".  All it",
        "                     does is choose random spells to use or simply attack.",
      ].join("\n"),
    );
    expect(spaced.reflow!.firstLineIndent).toBe(10);
    expect(tabbed.reflow!.firstLineIndent).toBe(10); // NOT 0 — tabs resolved
    expect(tabbed.reflow!.layout).toBe("hanging");
  });
});

describe("prose classification", () => {
  const prose = [
    "This is a normal hard-wrapped paragraph of prose text that a FAQ author",
    "typed at roughly seventy columns wide, breaking each line manually as they",
    "went, which is exactly the kind of block we want to be able to reflow.",
  ].join("\n");

  it("classifies a hard-wrapped paragraph as a reflowable block", () => {
    expect(first(prose)).toMatchObject({
      kind: "prose",
      reflow: { layout: "block", padLeft: 0, firstLineIndent: 0 },
    });
  });

  it("reflows by dropping hard wraps and collapsing whitespace", () => {
    const text = reflowText(first(prose));
    expect(text).not.toContain("\n");
    expect(text).toContain("author typed at"); // wrap boundary joined with a space
  });

  it("keeps a paragraph whose FIRST line is indented (indent must not break it)", () => {
    const block = first(
      [
        "    Once you reach Chapter 5, the first menu that appears when you enter",
        "battle will be slightly different.  Once you recruit Mara and Nara you see",
        "this menu (having 'Tactics' selected):",
      ].join("\n"),
    );
    // First line indents 4, continuation sits at 0 -> positive text-indent.
    expect(block).toMatchObject({
      kind: "prose",
      reflow: { layout: "block", padLeft: 0, firstLineIndent: 4 },
    });
  });

  it("reflows a label + hanging body, dropping the decorative underline", () => {
    const block = first(
      [
        "MEMBER:  Once you've obtained the wagon in Chapter 5 you'll have this one.",
        "-------  This option will allow you to switch out characters from a wagon",
        "         (in standby) into your active party.  If you have less than 5",
      ].join("\n"),
    );
    expect(block.reflow).toMatchObject({ layout: "hanging", padLeft: 9, firstLineIndent: 0 });
    const text = reflowText(block);
    expect(text.startsWith("MEMBER: Once you've obtained")).toBe(true);
    expect(text).toContain("this one. This option will allow"); // body lines joined
    expect(text).not.toContain("---"); // underline dropped, not inlined
  });

  it("never merges separate labelled items (Q: / A:) on its own initiative", () => {
    const block = first(
      [
        "Q: Is there any way to stop the sea lice from eating my rations as I go?",
        "A: Hold L2 and move the left analog stick back and forth while the rations",
        "   are being eaten to shake them off before they finish the job entirely.",
      ].join("\n"),
    );
    // Two real labels: renders verbatim. The ¶ is still offered — merging these is
    // the reader's call to make, not ours to make for them.
    expect(block.reflow?.defaultOn).toBe(false);
  });

  it("splits a paragraph that runs straight into a diagram (no blank line)", () => {
    // Dragon Warrior IV does this constantly: prose, then a menu box, no gap.
    const { blocks } = parseDocument(
      [
        "    There are three main menus that you'll be paying attention to more",
        "than anything else in the game and that's the Command menu, the Status",
        "menu and the Battle menu.  I'll also be discussing the Tactics sub-menu",
        " _____       ______",
        "|-----COMMAND------|",
        "| >TALK     SPELL  |",
        "|__________________|",
      ].join("\n"),
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: "prose", reflow: { layout: "block" } });
    // The box stays one intact art block, butted against the prose (no gap).
    expect(blocks[1]).toMatchObject({ kind: "art", gapBefore: 0 });
    expect(blocks[1]!.lines).toHaveLength(4);
    expect(blocks[1]!.startLine).toBe(3);
  });

  it("splits a hanging item that runs straight into a diagram", () => {
    const { blocks } = parseDocument(
      [
        "STATUS:  This selection will lead to a new menu where you can view your",
        "-------  current statistics and experience points.  If you press the A",
        "         button again another menu will appear with more information.",
        "         ______    ______",
        "         |------STATUS------|",
        "         |__________________|",
      ].join("\n"),
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: "prose", reflow: { layout: "hanging" } });
    expect(reflowText(blocks[0]!)).not.toContain("---"); // underline still dropped
    expect(blocks[1]!.kind).toBe("art");
  });

  it("frees prose that starts right after a banner (no blank line)", () => {
    const { blocks } = parseDocument(
      [
        " --------------------------------------------",
        "//  How to Get the Game                    //",
        "--------------------------------------------",
        "This game will never be released in English commercially, but there's a",
        "ROM patch for an English fan translation. I won't post the link here",
        "because of its legal status, but it's really good. It's possible to",
        "find online -- just look around.",
      ].join("\n"),
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: "art", gapBefore: 0 }); // banner intact
    expect(blocks[0]!.lines).toHaveLength(3);
    expect(blocks[1]).toMatchObject({ kind: "prose", startLine: 3 });
  });

  it("reflows each list item separately, never merging them", () => {
    const { blocks } = parseDocument(
      [
        "The story is pretty generic -- you are a card player who quests to:",
        "   1) defeat the evil Great Team Rocket through the game of Pokemon TCG",
        "   2) collect all the cards",
        "   3) master the game by building the best deck(s) possible",
      ].join("\n"),
    );
    // Lead-in + one block per item — not one merged paragraph, and not verbatim.
    expect(blocks).toHaveLength(4);
    expect(blocks.every((b) => b.kind === "prose")).toBe(true);
    expect(reflowText(blocks[0]!)).toMatch(/^The story is pretty generic/);
    expect(reflowText(blocks[1]!)).toBe(
      "1) defeat the evil Great Team Rocket through the game of Pokemon TCG",
    );
    expect(reflowText(blocks[2]!)).toBe("2) collect all the cards");
    // Item text hangs under its own marker: "   1) " => text at col 6.
    expect(blocks[1]!.reflow).toMatchObject({ firstLineIndent: 3, padLeft: 6 });
  });

  it("wraps a bullet item under its marker, using the source's own indent", () => {
    const { blocks } = parseDocument(
      [
        "- Your starter deck is not horrible.",
        "- Some Base Set cards have different rarities that are more appropriate",
        "  for the card.",
        "- You collect coins instead of medals, which you can then use to flip",
        "  your own coins in battle.",
      ].join("\n"),
    );
    expect(blocks).toHaveLength(3);
    expect(reflowText(blocks[1]!)).toBe(
      "- Some Base Set cards have different rarities that are more appropriate for the card.",
    );
    expect(blocks[1]!.reflow).toMatchObject({ firstLineIndent: 0, padLeft: 2 });
  });

  it("frees a paragraph sitting under a short heading (no blank line)", () => {
    const { blocks } = parseDocument(
      [
        "-- MAIL",
        "Occasionally you will receive mail that includes a booster pack. If you",
        "save right before you open the booster, then you can reset the game and",
        "try again if you don't get the cards you wanted. Not every mail includes",
        "it's hard to tell which pieces of mail have a booster.",
      ].join("\n"),
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: "art", lines: ["-- MAIL"] });
    expect(blocks[1]!.kind).toBe("prose");
    expect(reflowText(blocks[1]!)).toMatch(/^Occasionally you will receive mail/);
  });

  it("keeps ASCII banners as art", () => {
    const banner = ["=====================", "|  SUPER GAME  FAQ  |", "====================="];
    expect(first(banner.join("\n")).kind).toBe("art");
  });

  it("reflows a ragged bulleted list one item at a time", () => {
    const { blocks } = parseDocument(
      [
        "  - Sword: found in the opening cave near the waterfall",
        "  - Shield: purchased from the town armorer for 90 gold",
        "  - Potion: dropped occasionally by slimes in the forest",
      ].join("\n"),
    );
    expect(blocks).toHaveLength(3); // three items, never merged into a paragraph
    expect(reflowText(blocks[0]!)).toBe("- Sword: found in the opening cave near the waterfall");
  });

  it("keeps a stylised title drawn from fenced letters as art", () => {
    // Real Ace Combat banner: high alpha, but reflowing it destroys the drawing.
    const title = [
      "    |e|l|e|c|t|r|o|s|p|h|e|r|e| Spoiler-free FAQ/Walkthrough by Shotgunnova",
      "     ¯ ¯ ¯ ¯ ¯ ¯ ¯ ¯ ¯ ¯ ¯ ¯ ¯  EMAIL: shotgunnova (@) gmail (do+) com",
    ].join("\n");
    expect(first(title).kind).toBe("art");
  });

  it("keeps an aligned price table as art (aligned column, not prose)", () => {
    const shop = [
      "Chain Mail        350G",
      "Bronze Armor      700G",
      "Half Plate Armor  1200G",
      "Scale Shield      180G",
      "Iron Shield       650G",
      "Wooden Hat        120G",
    ].join("\n");
    expect(first(shop).kind).toBe("art");
  });

  it("keeps a dotted-leader TOC as art", () => {
    const toc = [
      "  I. Introduction ............................ INTRO",
      " II. Controls ............................... CTRL0",
      "III. Walkthrough ............................ WLKTH",
    ].join("\n");
    expect(first(toc).kind).toBe("art");
  });

  it("never reflows an indented TOC (short ragged entries) unasked", () => {
    const toc = [
      "                1. CHAPTER ONE: THE ROYAL SOLDIERS OF BURLAND CASTLE",
      "                   1A. Burland",
      "                   1B. Cave to Izmit",
      "                   1C. Izmit Village",
    ].join("\n");
    expect(first(toc).reflow?.defaultOn ?? false).toBe(false);
  });
});

describe("offering the ¶ toggle", () => {
  it("offers it on a lone long line, but leaves it verbatim", () => {
    // Fits without being cut off, so nothing is broken — but the reader may still
    // want it to read like the prose around it rather than at the verbatim size.
    const block = first("To use an attack, select the attack you want to use and press A.");
    expect(block.kind).toBe("prose");
    expect(block.reflow!.defaultOn).toBe(false);
  });

  it("does not offer it on text too narrow to ever need wrapping", () => {
    expect(first("-- MAIL").kind).toBe("art"); // a ¶ here would be pure noise
  });

  it("never reflows a floated box (a drawing with prose beside it)", () => {
    // Real Zelda shape: sits just under the decorative threshold, so it reads as a
    // wrapped paragraph and merges the borders into the text.
    const block = first(
      [
        "+-------------------------------+  Finally, follow the road north then west,",
        "| KINSTONE FUSION #09 PERFORMED |  and fuse Kinstones with the left miner",
        "+-------------------------------+  there. This makes a chest appear at the",
      ].join("\n"),
    );
    expect(block.kind).toBe("art");
  });

  it("never mistakes a table's narrow rows for a heading over a paragraph", () => {
    // Real Ace Combat shape: stripping the short rows would leave survivors of
    // similar length that read as wrapped prose and get merged.
    const { blocks } = parseDocument(
      [
        " [x01] Carrier ---- Default",
        " [x01] Convoy ----- Default",
        " [x04] Facilities - Default [Island - Non-TGT]",
        " [x09] Gun -------- Default [x4 Island]",
        " [x05] MSSL ------- Default [x4 Island]",
      ].join("\n"),
    );
    expect(blocks.every((b) => b.reflow?.defaultOn !== true)).toBe(true);
  });

  it("does not offer it on drawings or tables — wrapping those is only damage", () => {
    expect(first("|-----COMMAND------|\n| >TALK     SPELL  |").kind).toBe("art");
    expect(
      first(
        [
          "Chain Mail        350G",
          "Bronze Armor      700G",
          "Half Plate Armor  1200G",
          "Scale Shield      180G",
        ].join("\n"),
      ).kind,
    ).toBe("art");
  });
});
