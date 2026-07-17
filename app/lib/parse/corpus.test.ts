import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocument, reflowText, type Block } from "./index";

/**
 * Corpus coverage for the classifier: every block of every fixture, snapshotted.
 *
 * The hand-written cases in parse.test.ts encode INTENT ("the underline is
 * dropped", "Q:/A: never merge") — they say what is *correct*. These snapshots are
 * the safety net: they say what *currently happens* to all ~4.8k blocks, so any
 * classifier change is visible and reviewable instead of silent. A snapshot diff is
 * not automatically a bug — read it and decide. Drop a new file in fixtures/ and it
 * is picked up and written on the next run.
 *
 * Reflowed output records its length as well as a preview, so text lost or gained
 * beyond the preview (how the dropped "A:" bug looked) still shows up in the diff.
 */

const DIR = resolve(process.cwd(), "fixtures");
const FIXTURES = readdirSync(DIR)
  .filter((n) => n.endsWith(".txt"))
  .sort();

const slug = (name: string) =>
  name.replace(/\.txt$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);

/**
 * One line per block: id, class, wrapping strategy + its columns, source line
 * count, and — for prose — the reflowed length and a preview of the OUTPUT (art is
 * verbatim, so its source line is the output). The length is what catches text
 * lost or gained past the preview.
 */
function describeBlock(b: Block): string {
  const id = `#${String(b.id).padStart(4, "0")}`;
  const lines = `L${String(b.lines.length).padEnd(3)}`;
  if (b.kind !== "prose" || !b.reflow) {
    return `${id} art                 ${lines} | ${(b.lines[0] ?? "").trimEnd().slice(0, 96)}`;
  }
  const { layout, firstLineIndent, padLeft } = b.reflow;
  const spec = `${layout.padEnd(7)} f=${String(firstLineIndent).padEnd(2)} p=${String(padLeft).padEnd(2)}`;
  const flowed = reflowText(b);
  return `${id} ${spec} ${lines} (${String(flowed.length).padStart(4)}) | ${flowed.slice(0, 96)}`;
}

function report(text: string): string {
  const { blocks } = parseDocument(text);
  const counts = { art: 0, block: 0, hanging: 0 };
  const lines: string[] = [];
  for (const b of blocks) {
    if (b.kind === "prose" && b.reflow) counts[b.reflow.layout]++;
    else counts.art++;
    lines.push(describeBlock(b));
  }
  const header = [
    `blocks: ${blocks.length}  art: ${counts.art}  prose-block: ${counts.block}  prose-hanging: ${counts.hanging}`,
    "-".repeat(80),
  ];
  return [...header, ...lines].join("\n") + "\n";
}

describe("classifier corpus", () => {
  it("covers every fixture", () => {
    expect(FIXTURES.length).toBeGreaterThan(0);
  });

  it.each(FIXTURES)("%s", async (name) => {
    const text = readFileSync(resolve(DIR, name), "utf-8");
    await expect(report(text)).toMatchFileSnapshot(`./__snapshots__/corpus/${slug(name)}.txt`);
  });

  // Small, scannable tally — the alarm for "that tweak reclassified 200 blocks".
  it("summary", async () => {
    const rows = FIXTURES.map((name) => {
      const { blocks } = parseDocument(readFileSync(resolve(DIR, name), "utf-8"));
      const n = (p: (b: Block) => boolean) => blocks.filter(p).length;
      return [
        name.slice(0, 44).padEnd(44),
        `blocks=${String(blocks.length).padStart(4)}`,
        `art=${String(n((b) => b.kind === "art")).padStart(4)}`,
        `block=${String(n((b) => b.reflow?.layout === "block")).padStart(4)}`,
        `hanging=${String(n((b) => b.reflow?.layout === "hanging")).padStart(3)}`,
      ].join("  ");
    });
    await expect(rows.join("\n") + "\n").toMatchFileSnapshot("./__snapshots__/corpus/_summary.txt");
  });
});
