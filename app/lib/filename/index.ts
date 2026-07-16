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
