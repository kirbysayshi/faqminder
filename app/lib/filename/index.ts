// Derives a display title + descriptor from a GameFAQs-style filename, e.g.
// "Metal Gear Solid 2_ Sons of Liberty - Guide and Walkthrough - PlayStation 2 - By Conquerer - GameFAQs.txt"
// -> { title: "Metal Gear Solid 2: Sons of Liberty",
//      descriptor: "Guide and Walkthrough · PlayStation 2 · By Conquerer" }
// The "_" stands in for ":" (filesystem-illegal char). Pure/stateless.

export interface ParsedFilename {
  title: string;
  descriptor: string;
}

export function parseFaqFilename(name: string): ParsedFilename {
  const base = name
    .replace(/\.[^.]+$/, "")
    .replace(/\s*-\s*GameFAQs\s*$/i, "");
  const parts = base.split(" - ");
  const rawTitle = parts[0] ?? base;
  const title = rawTitle.replace(/_/g, ":").replace(/\s+/g, " ").trim();
  const descriptor = parts.slice(1).map((p) => p.trim()).filter(Boolean).join(" · ");
  return { title: title || base, descriptor };
}

// First line the copy-from-GameFAQs bookmarklet prepends, so a pasted FAQ carries
// its page title (→ same title/descriptor as a file import). The bookmarklet source
// (features/import/bookmarklet) interpolates this exact constant — keep them in sync.
export const FAQ_CLIP_MARKER = "@@FAQMinder@@";

export interface PastedFaq {
  title: string;
  /** Filename-equivalent for descriptor parsing; "" when the source is unknown. */
  source: string;
  text: string;
}

// Splits pasted text into { title, source, text }. If the marker header is present
// (bookmarklet path), the page title after it is parsed like a filename and stripped
// off the body. Otherwise the title is guessed from the first non-blank line. Pure.
export function parsePastedFaq(raw: string): PastedFaq {
  const nl = raw.indexOf("\n");
  const firstLine = nl === -1 ? raw : raw.slice(0, nl);
  if (firstLine.startsWith(FAQ_CLIP_MARKER)) {
    const source = firstLine.slice(FAQ_CLIP_MARKER.length).trim();
    const text = nl === -1 ? "" : raw.slice(nl + 1);
    return { title: parseFaqFilename(source).title, source, text };
  }
  return { title: firstMeaningfulLine(raw), source: "", text: raw };
}

function firstMeaningfulLine(raw: string): string {
  for (const line of raw.split("\n")) {
    const t = line.trim().replace(/\s+/g, " ");
    if (t) return t.length > 80 ? t.slice(0, 79).trimEnd() + "…" : t;
  }
  return "Untitled FAQ";
}
