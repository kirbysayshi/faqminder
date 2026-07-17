import { reflowText, type Block } from "~/lib/parse";

export const LINE_HEIGHT = 1.4;

// Verbatim monospace. Wide ASCII art scrolls horizontally *within its own block*
// so it never widens the page and force prose off-screen.
function Verbatim({ lines }: { lines: string[] }) {
  return (
    <div className="overflow-x-auto">
      <pre
        className="w-max whitespace-pre text-neutral-100"
        style={{ lineHeight: LINE_HEIGHT }}
      >
        {lines.join("\n")}
      </pre>
    </div>
  );
}

// One block. `art` renders verbatim. A `prose` block is a reflow candidate: it
// shows a toggle (¶) and renders either reflowed (wrapping to the viewport, with
// the original indent structure preserved via padding + text-indent) or verbatim.
// data-block-id is always on the outer element for scroll-anchoring / search jumps.
export function BlockView({
  block,
  reflowOn,
  onToggle,
}: {
  block: Block;
  reflowOn: boolean;
  onToggle: (blockId: number) => void;
}) {
  const marginTop = block.gapBefore ? `${block.gapBefore * LINE_HEIGHT}em` : 0;

  if (block.kind !== "prose" || !block.reflow) {
    return (
      <div data-block-id={block.id} style={{ marginTop }}>
        <Verbatim lines={block.lines} />
      </div>
    );
  }

  const { padLeft, firstLineIndent } = block.reflow;
  // Honor the source's columns, but cap them on narrow screens: a FAQ written for
  // 80 columns can hang its body at col 21, which would eat half a phone. min()
  // keeps the true column on desktop and adapts on mobile.
  const hang = `min(${padLeft}ch, 30%)`;
  const first = `min(${firstLineIndent}ch, 12%)`;

  return (
    <div data-block-id={block.id} className="relative" style={{ marginTop }}>
      <button
        type="button"
        onClick={() => onToggle(block.id)}
        aria-pressed={reflowOn}
        aria-label={reflowOn ? "Undo soft-wrap for this paragraph" : "Soft-wrap this paragraph"}
        title={reflowOn ? "Auto soft-wrapped — tap to undo" : "Tap to soft-wrap"}
        className={`absolute right-0 top-0 z-10 px-1 text-xs leading-none ${
          reflowOn ? "text-sky-400" : "text-neutral-600"
        }`}
      >
        ¶
      </button>
      {reflowOn ? (
        <p
          className="whitespace-pre-wrap break-words text-neutral-100"
          style={{
            lineHeight: LINE_HEIGHT,
            // Only wrapped text resizes; art keeps the container's base size. The
            // ch-based indents below scale with it, so the structure holds.
            fontSize: "var(--prose-font)",
            // Continuation lines sit at the hang column; the first line offsets
            // back to its own indent — reproduces paragraph and hanging indents.
            paddingLeft: hang,
            textIndent: `calc(${first} - ${hang})`,
          }}
        >
          {reflowText(block)}
        </p>
      ) : (
        <Verbatim lines={block.lines} />
      )}
    </div>
  );
}
