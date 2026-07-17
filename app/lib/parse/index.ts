import type { Block, ParsedDoc, ReflowSpec } from "./types";

export type { Block, BlockKind, ParsedDoc, ReflowSpec } from "./types";

const BLANK = /^\s*$/;
// A bullet or enumerator at line start — hallmark of a list item, not wrapped prose.
const LIST_MARKER = /^\s*(?:[-*•‣·]|\(?\d{1,3}[.)]|[A-Za-z][.)])\s+\S/;
// Characters that make up rules, borders and ASCII art.
const ART_CHARS = /[-_=+*~|\\/#<>[\]{}()]/g;
// Label-column content that is pure decoration (a rule under a label), not a label.
const RULE_ONLY = /^[-_=~*+#.]+$/;
// Slack (chars) below the block's own max width that still counts as a "full" line.
const WRAP_SLACK = 15;
// Minimum non-space chars for a block to plausibly be a wrapped paragraph.
const MIN_PROSE_CHARS = 80;
// A hanging item may be shorter: its structure (one label + a consistent hang
// column + a clean split) is already strong evidence, so the floor can be lower.
const MIN_HANGING_CHARS = 40;

const TAB_STOP = 8; // FAQs are written for classic 8-column tab stops.

/**
 * Expands tabs to spaces at 8-column stops. FAQs mix tabs and spaces for the same
 * visual column (e.g. "\t  Try Out:" vs "          Offensive:"), so every column
 * measurement — and the verbatim render — is wrong until tabs are resolved.
 * Done at parse (not import) so already-stored documents are fixed too.
 */
export function expandTabs(text: string, size = TAB_STOP): string {
  if (!text.includes("\t")) return text;
  return text
    .split("\n")
    .map((line) => {
      if (!line.includes("\t")) return line;
      let out = "";
      for (const ch of line) {
        if (ch === "\t") out += " ".repeat(size - (out.length % size));
        else out += ch;
      }
      return out;
    })
    .join("\n");
}

const indentOf = (line: string): number => line.match(/^ */)![0].length;

/** Within one char — tolerates a stray off-by-one in hand-typed FAQs. */
const consistent = (nums: number[]): boolean =>
  nums.length === 0 || Math.max(...nums) - Math.min(...nums) <= 1;

function commonIndent(lines: string[]): number {
  let min = Infinity;
  for (const line of lines) {
    if (BLANK.test(line)) continue;
    min = Math.min(min, indentOf(line));
  }
  return Number.isFinite(min) ? min : 0;
}

/**
 * A rule, border, banner or dotted-leader line. Ratio-based (not "contains a run")
 * so a short label underline embedded in text — e.g. "-------  This option..." —
 * is NOT treated as decoration of the whole block.
 */
function isDecorative(line: string): boolean {
  const t = line.trim();
  if (t.length < 3) return false;
  if (/\.{4,}|(?:\.\s){3,}/.test(line)) return true; // TOC leaders
  const nonSpace = t.replace(/\s/g, "").length;
  const art = (t.match(ART_CHARS) ?? []).length;
  return nonSpace > 0 && art / nonSpace > 0.5;
}

/**
 * True when most lines resume text at the same column after an interior gap —
 * i.e. an aligned column. That's a table (shop lists, stat columns), not prose.
 * Prose only has incidental double-spaces after sentences, at varying columns.
 */
function hasAlignedColumn(lines: string[]): boolean {
  if (lines.length < 3) return false;
  const counts = new Map<number, number>();
  for (const line of lines) {
    const cols = new Set<number>();
    const re = /(?<=\S) {2,}(?=\S)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) cols.add(m.index + m[0].length);
    for (const c of cols) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const threshold = Math.max(3, Math.ceil(lines.length * 0.6));
  for (const n of counts.values()) if (n >= threshold) return true;
  return false;
}

/**
 * A label/definition item: a left label column and a body that hangs at a
 * consistent column, e.g.
 *
 *     MEMBER:  Once you've obtained the wagon you'll have this option.
 *     -------  This option will allow you to switch out characters
 *              (in standby) into your active party.
 */
function detectHanging(lines: string[], firstIndent: number): number | null {
  const hangs = lines.slice(1).map(indentOf).filter((i) => i > firstIndent);
  if (hangs.length === 0 || !consistent(hangs)) return null;
  const hang = Math.min(...hangs);
  // Must split cleanly on a space boundary — never mid-word.
  if (!lines.every((l) => l.length < hang || l[hang - 1] === " ")) return null;
  // The first line must carry body text, otherwise it isn't a label + body item.
  if (lines[0]!.length <= hang || lines[0]!.slice(hang).trim() === "") return null;
  // Exactly ONE meaningful label, on the first line. Later label-column content may
  // only be decoration (a "-----" underline). A second real label means this is
  // several items ("Q:" / "A:") — never merge those into one paragraph.
  for (let i = 1; i < lines.length; i++) {
    const label = lines[i]!.slice(firstIndent, hang).trim();
    if (label && !RULE_ONLY.test(label)) return null;
  }
  return hang;
}

/**
 * FAQs often run a paragraph straight into a diagram with no blank line between:
 *
 *     2 menus will appear: one in the upper left-hand corner and one at the...
 *      _____       ______
 *     |-----COMMAND------|
 *
 * Blank lines alone would make that one block, and the box's borders would drag
 * the paragraph down with them into `art`. So a run is cut at its FIRST decorative
 * line. Only the first — everything from there on stays a single block, so a box's
 * interior can never be split apart or mistaken for prose.
 */
function splitAtArt(lines: string[]): string[][] {
  const first = lines.findIndex(isDecorative);
  if (first <= 0) return [lines]; // all art, or no decoration at all
  const head = lines.slice(0, first);
  // Only split when it buys something: if the head isn't reflowable prose the run
  // is art either way, and cutting it would just fragment a banner for nothing.
  if (classify(head).kind !== "prose") return [lines];
  return [head, lines.slice(first)];
}

function classify(lines: string[]): { kind: "art" } | { kind: "prose"; reflow: ReflowSpec } {
  const ART = { kind: "art" } as const;
  if (lines.length < 2) return ART;

  const joined = lines.join(" ");
  const nonSpace = joined.replace(/\s/g, "").length;
  if (nonSpace < MIN_HANGING_CHARS) return ART; // too short to be prose at all
  const letters = joined.match(/[A-Za-z]/g)?.length ?? 0;
  if (letters / nonSpace < 0.6) return ART; // not text-dominated
  if (lines.some(isDecorative)) return ART; // rules / borders / banners / leaders
  if (lines.filter((l) => LIST_MARKER.test(l)).length >= 2) return ART; // a list

  // Hard-wrapped: every line but the last is "full" relative to this block's own
  // width. Real wrapped text has full lines; a TOC or list has short ragged ones.
  const lens = lines.map((l) => l.replace(/\s+$/, "").length);
  const maxLen = Math.max(...lens);
  if (Math.min(...lens.slice(0, -1)) < maxLen - WRAP_SLACK) return ART;

  const firstLineIndent = indentOf(lines[0]!);

  // A table check is needed here too: an indented TOC ("I  - Intro" / "  i - Sub")
  // otherwise looks like a label + hanging body.
  const hang = detectHanging(lines, firstLineIndent);
  if (hang !== null && !hasAlignedColumn(lines)) {
    return { kind: "prose", reflow: { layout: "hanging", padLeft: hang, firstLineIndent } };
  }

  // Block paragraph: continuation lines must share one indent. The first line is
  // free — it may be indented (paragraph indent) or outdented (hanging indent).
  if (nonSpace < MIN_PROSE_CHARS) return ART; // too short to be a wrapped paragraph
  const restIndents = lines.slice(1).map(indentOf);
  if (!consistent(restIndents)) return ART;
  const padLeft = restIndents.length ? Math.min(...restIndents) : firstLineIndent;

  if (hasAlignedColumn(lines)) return ART; // a table

  return { kind: "prose", reflow: { layout: "block", padLeft, firstLineIndent } };
}

/**
 * Reflowed text for a prose block: hard wraps dropped, whitespace collapsed.
 * For a hanging item the label is kept and decorative label-column content on
 * later lines (e.g. a "-----" underline) is dropped.
 */
export function reflowText(block: Block): string {
  const spec = block.reflow;
  const collapse = (parts: string[]) => parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

  if (spec?.layout === "hanging") {
    const label = block.lines[0]!.slice(spec.firstLineIndent, spec.padLeft).trim();
    const body = block.lines.map((l) => l.slice(spec.padLeft).trim());
    return collapse([label, ...body]);
  }
  return collapse(block.lines.map((l) => l.trim()));
}

/**
 * Splits text into blocks (maximal runs of non-blank lines separated by blank
 * lines) and classifies each. `gapBefore` preserves vertical spacing.
 */
export function parseDocument(text: string): ParsedDoc {
  const lines = expandTabs(text).split("\n");
  const blocks: Block[] = [];
  let i = 0;
  let id = 0;

  while (i < lines.length) {
    let blank = 0;
    while (i < lines.length && BLANK.test(lines[i]!)) {
      blank++;
      i++;
    }
    if (i >= lines.length) break;

    const startLine = i;
    const buf: string[] = [];
    while (i < lines.length && !BLANK.test(lines[i]!)) {
      buf.push(lines[i]!);
      i++;
    }

    let offset = 0;
    for (const segment of splitAtArt(buf)) {
      const c = classify(segment);
      blocks.push({
        id: id++,
        kind: c.kind,
        lines: segment,
        startLine: startLine + offset,
        // Only the run's first segment gets the blank-line gap; a segment that
        // continues the same run must butt right up against the previous one.
        gapBefore: offset === 0 ? blank : 0,
        indent: commonIndent(segment),
        ...(c.kind === "prose" ? { reflow: c.reflow } : {}),
      });
      offset += segment.length;
    }
  }

  return { blocks, lineCount: lines.length };
}
