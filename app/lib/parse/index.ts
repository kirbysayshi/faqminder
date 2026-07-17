import type { Block, ParsedDoc, ReflowSpec } from "./types";

export type { Block, BlockKind, ParsedDoc, ReflowSpec } from "./types";

const BLANK = /^\s*$/;
// A bullet or enumerator at line start — hallmark of a list item, not wrapped prose.
const LIST_MARKER = /^\s*(?:[-*•‣·]|\(?\d{1,3}[.)]|[A-Za-z][.)])\s+\S/;
// Characters that make up rules, borders and ASCII art.
const ART_CHARS = /[-_=+*~|\\/#<>[\]{}()]/g;
// Label-column content that is pure decoration (a rule under a label), not a label.
const RULE_ONLY = /^[-_=~*+#.]+$/;
// "|e|l|e|c|t|r|o|" — single characters fenced by pipes. That's a title drawn out of
// letters, never running text; the letters would otherwise read as high alpha.
const FENCED_CHARS = /(?:\|.){4,}\|/;
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
  if (FENCED_CHARS.test(line)) return true; // a title drawn from fenced letters
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

export type Piece =
  | { kind: "art"; lines: string[] }
  | { kind: "prose"; lines: string[]; reflow: ReflowSpec };

// A marker plus its trailing space; the full match width is the column the item's
// text starts at, which is where its wrapped lines should hang.
const LIST_ITEM = /^( *)(?:[-*•‣·]|\(?\d{1,3}[.)]|[A-Za-z][.)])( +)(?=\S)/;

/**
 * A bulleted or numbered list. Emitted as ONE BLOCK PER ITEM: each item wraps under
 * its own marker, and items can never be merged into one another (which is what the
 * blanket "2+ markers => art" rule was protecting against). Any lead-in line before
 * the first marker becomes its own paragraph, so it doesn't get stranded at the
 * verbatim size while the items around it reflow.
 */
function classifyList(lines: string[]): Piece[] | null {
  const markers = lines.map((l) => LIST_ITEM.exec(l));
  const at = markers.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
  if (at.length < 2) return null; // one marker is a sentence, not a list

  const joined = lines.join(" ");
  const nonSpace = joined.replace(/\s/g, "").length;
  const letters = joined.match(/[A-Za-z]/g)?.length ?? 0;
  if (nonSpace === 0 || letters / nonSpace < 0.6) return null; // not text

  const indents = at.map((i) => markers[i]![1]!.length);
  if (!consistent(indents)) return null; // markers must line up
  const base = Math.min(...indents);

  // Between items, only continuation lines — indented past the marker column.
  for (let i = at[0]! + 1; i < lines.length; i++) {
    if (!markers[i] && indentOf(lines[i]!) <= base) return null;
  }

  const out: Piece[] = [];
  const lead = lines.slice(0, at[0]!);
  if (lead.length) {
    out.push({
      kind: "prose",
      lines: lead,
      reflow: {
        layout: "block",
        padLeft: commonIndent(lead),
        firstLineIndent: indentOf(lead[0]!),
      },
    });
  }

  for (let k = 0; k < at.length; k++) {
    const start = at[k]!;
    const end = k + 1 < at.length ? at[k + 1]! : lines.length;
    const itemLines = lines.slice(start, end);
    const continuations = itemLines.slice(1).map(indentOf);
    out.push({
      kind: "prose",
      lines: itemLines,
      reflow: {
        layout: "block",
        // Wrap under the item's text: the source's own continuation indent when it
        // has one, otherwise the column the marker hands over at.
        padLeft: continuations.length ? Math.min(...continuations) : markers[start]![0]!.length,
        firstLineIndent: markers[start]![1]!.length,
      },
    });
  }
  return out;
}

/** Group a run into maximal stretches of decorative / non-decorative lines. */
function byDecoration(lines: string[]): { decorative: boolean; lines: string[] }[] {
  const out: { decorative: boolean; lines: string[] }[] = [];
  for (const line of lines) {
    const decorative = isDecorative(line);
    const last = out.at(-1);
    if (last && last.decorative === decorative) last.lines.push(line);
    else out.push({ decorative, lines: [line] });
  }
  return out;
}

/**
 * Blank lines alone don't bound a block. FAQs run prose straight into a diagram and
 * straight out of a banner with no blank line either side:
 *
 *     //  How to Get the Game                    //
 *     --------------------------------------------
 *     This game will never be released in English commercially, but there's a
 *
 * So a run is cut into prose islands and everything else. Anything that isn't
 * reflowable prose is merged back together, which keeps a box's interior — its
 * content lines aren't decorative — from being fragmented or mistaken for prose.
 */
function piecesForRun(run: string[]): Piece[] {
  const out: Piece[] = [];
  let art: string[] = [];
  const flushArt = () => {
    if (art.length) out.push({ kind: "art", lines: art });
    art = [];
  };

  for (const segment of byDecoration(run)) {
    if (segment.decorative) {
      art.push(...segment.lines);
      continue;
    }
    const items = classifyList(segment.lines);
    if (items) {
      flushArt();
      out.push(...items);
      continue;
    }
    const c = classify(segment.lines);
    if (c.kind === "prose") {
      flushArt();
      out.push({ kind: "prose", lines: segment.lines, reflow: c.reflow });
    } else {
      art.push(...segment.lines);
    }
  }
  flushArt();
  return out;
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
    for (const piece of piecesForRun(buf)) {
      blocks.push({
        id: id++,
        kind: piece.kind,
        lines: piece.lines,
        startLine: startLine + offset,
        // Only the run's first piece gets the blank-line gap; a piece that
        // continues the same run must butt right up against the previous one.
        gapBefore: offset === 0 ? blank : 0,
        indent: commonIndent(piece.lines),
        ...(piece.kind === "prose" ? { reflow: piece.reflow } : {}),
      });
      offset += piece.lines.length;
    }
  }

  return { blocks, lineCount: lines.length, artCols: typicalArtWidth(blocks) };
}

const ART_WIDTH_PERCENTILE = 0.95;

/** See ParsedDoc.artCols: a high percentile, deliberately not the max. */
function typicalArtWidth(blocks: Block[]): number {
  const widths = blocks
    .filter((b) => b.kind === "art")
    .map((b) => Math.max(...b.lines.map((l) => l.replace(/\s+$/, "").length)))
    .sort((a, b) => a - b);
  if (widths.length === 0) return 0;
  return widths[Math.min(widths.length - 1, Math.floor(widths.length * ART_WIDTH_PERCENTILE))]!;
}
