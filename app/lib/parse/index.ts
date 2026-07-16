import type { Block, ParsedDoc } from "./types";

export type { Block, BlockKind, ParsedDoc } from "./types";

const BLANK = /^\s*$/;

function commonIndent(lines: string[]): number {
  let min = Infinity;
  for (const line of lines) {
    if (BLANK.test(line)) continue;
    const m = line.match(/^ */);
    min = Math.min(min, m ? m[0].length : 0);
  }
  return Number.isFinite(min) ? min : 0;
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
      kind: "art",
      lines: buf,
      startLine,
      gapBefore: blank,
      indent: commonIndent(buf),
    });
  }

  return { blocks, lineCount: lines.length };
}
