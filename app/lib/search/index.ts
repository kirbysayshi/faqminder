import type { ParsedDoc } from "~/lib/parse";

// Finds occurrences of a selected string across the document, case-insensitively.
// Operates on parsed blocks so each hit carries the blockId to scroll to. Pure.

export interface Occurrence {
  blockId: number;
  line: number; // absolute source line index
  column: number; // match start column within the line
  before: string; // context left of the match (may start with "…")
  match: string; // the matched text, original casing
  after: string; // context right of the match (may end with "…")
}

export const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 300;
const CTX_BEFORE = 24;
const CTX_AFTER = 40;

function context(line: string, start: number, end: number): Pick<Occurrence, "before" | "match" | "after"> {
  const from = Math.max(0, start - CTX_BEFORE);
  const to = Math.min(line.length, end + CTX_AFTER);
  return {
    before: (from > 0 ? "…" : "") + line.slice(from, start),
    match: line.slice(start, end),
    after: line.slice(end, to) + (to < line.length ? "…" : ""),
  };
}

export function normalizeQuery(raw: string): string {
  return raw.trim();
}

export function findOccurrences(doc: ParsedDoc, rawQuery: string): Occurrence[] {
  const query = normalizeQuery(rawQuery);
  if (query.length < MIN_QUERY_LENGTH) return [];
  const needle = query.toLowerCase();
  const out: Occurrence[] = [];

  for (const block of doc.blocks) {
    for (let i = 0; i < block.lines.length; i++) {
      const line = block.lines[i]!;
      const hay = line.toLowerCase();
      let from = 0;
      let idx = hay.indexOf(needle, from);
      while (idx !== -1) {
        out.push({
          blockId: block.id,
          line: block.startLine + i,
          column: idx,
          ...context(line, idx, idx + needle.length),
        });
        if (out.length >= MAX_RESULTS) return out;
        from = idx + needle.length;
        idx = hay.indexOf(needle, from);
      }
    }
  }
  return out;
}
