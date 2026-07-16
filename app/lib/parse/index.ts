import type { Block, ParsedDoc } from "./types";

export type { Block, BlockKind, ParsedDoc } from "./types";

const BLANK = /^\s*$/;

// Runs that signal ASCII art / tables / TOC leaders — never reflow these.
const ART_RUN = /([-_=+*~|\\/#:])\1{3,}|\.{4,}|(?:\. ){3,}|(?:[-=+*] ){4,}/;
// A bullet or enumerator at line start — hallmark of a list item, not wrapped prose.
const LIST_MARKER = /^\s*(?:[-*•‣·]|\(?\d{1,3}[.)]|[A-Za-z][.)])\s+\S/;
// Slack (chars) below the block's own max width that still counts as a "full" line.
const WRAP_SLACK = 15;
// Minimum non-space chars for a block to plausibly be a wrapped paragraph.
const MIN_PROSE_CHARS = 80;

function commonIndent(lines: string[]): number {
  let min = Infinity;
  for (const line of lines) {
    if (BLANK.test(line)) continue;
    const m = line.match(/^ */);
    min = Math.min(min, m ? m[0].length : 0);
  }
  return Number.isFinite(min) ? min : 0;
}

// Conservative hard-wrapped-paragraph detector. Relative to the block's own width
// (no absolute line-length assumptions). Anything uncertain stays `art`.
function classify(lines: string[]): "art" | "prose" {
  if (lines.length < 2) return "art";
  const joined = lines.join(" ");
  const nonSpace = joined.replace(/\s/g, "").length;
  if (nonSpace < MIN_PROSE_CHARS) return "art"; // too short to be a wrapped paragraph
  const letters = joined.match(/[A-Za-z]/g)?.length ?? 0;
  if (letters / nonSpace < 0.6) return "art"; // not text-dominated
  if (lines.some((l) => ART_RUN.test(l))) return "art"; // tables / rules / TOC leaders
  if (lines.filter((l) => LIST_MARKER.test(l)).length >= 2) return "art"; // a list, not a paragraph
  const indents = lines.map((l) => l.match(/^ */)![0].length);
  if (Math.max(...indents) - Math.min(...indents) > 4) return "art"; // ragged left (list/box)
  const lens = lines.map((l) => l.replace(/\s+$/, "").length);
  const max = Math.max(...lens);
  const bodyMin = Math.min(...lens.slice(0, -1)); // every line but the last
  if (bodyMin < max - WRAP_SLACK) return "art"; // a non-last line isn't full => not wrapped
  return "prose";
}

/** Reflowed text for a prose block: dedent, drop hard wraps, collapse whitespace. */
export function reflowText(block: Block): string {
  return block.lines
    .map((l) => l.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits text into blocks (maximal runs of non-blank lines separated by blank
 * lines). Every block starts as `art` (verbatim); classification into reflowable
 * kinds happens in a later pass (P6). `gapBefore` preserves vertical spacing.
 */
export function parseDocument(text: string): ParsedDoc {
  const lines = text.split("\n");
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
    blocks.push({
      id: id++,
      kind: classify(buf),
      lines: buf,
      startLine,
      gapBefore: blank,
      indent: commonIndent(buf),
    });
  }

  return { blocks, lineCount: lines.length };
}
