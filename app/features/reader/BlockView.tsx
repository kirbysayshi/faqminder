import { reflowText, type Block } from "~/lib/parse";

export const LINE_HEIGHT = 1.4;

// One block. `art` renders verbatim (monospace, no wrap). A `prose` block is a
// reflow candidate: it shows a toggle (¶) and renders either reflowed+wrapped
// (indent preserved) or verbatim, per `reflowOn`. data-block-id is always on the
// outer element for scroll-anchoring and search jumps.
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
  const content = block.lines.join("\n");

  if (block.kind !== "prose") {
    return (
      <pre
        data-block-id={block.id}
        className="font-mono whitespace-pre text-neutral-100"
        style={{ lineHeight: LINE_HEIGHT, marginTop }}
      >
        {content}
      </pre>
    );
  }

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
          className="font-mono whitespace-pre-wrap break-words text-neutral-100"
          style={{ lineHeight: LINE_HEIGHT, paddingLeft: `${block.indent}ch` }}
        >
          {reflowText(block)}
        </p>
      ) : (
        <pre
          className="font-mono whitespace-pre text-neutral-100"
          style={{ lineHeight: LINE_HEIGHT }}
        >
          {content}
        </pre>
      )}
    </div>
  );
}
