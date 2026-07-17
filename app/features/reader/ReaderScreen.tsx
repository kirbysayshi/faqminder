import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { parseDocument } from "~/lib/parse";
import type { FaqMeta } from "~/domains/library";
import { setReflowOverride } from "~/domains/document";
import {
  clampFont,
  DEFAULT_FONT,
  saveFontSize,
  type ReaderState,
} from "~/domains/reader";
import { BlockView } from "./BlockView";
import { FormattingControls } from "./FormattingControls";
import { SelectionSearch } from "./SelectionSearch";
import { useScrollBookmark } from "./useScrollBookmark";

// The reader: a full-height column with a sticky header and a scroll region.
// Blocks carry data-block-id for scroll-anchoring (P3) and selection jumps (P5).
// Prose blocks auto-reflow (P6) unless the user has overridden per block.
// Scroll anchor and font size are both per-document (persisted).
export function ReaderScreen({
  meta,
  text,
  initialAnchor = null,
  initialReflowOverrides = {},
  initialFont = DEFAULT_FONT,
}: {
  meta: FaqMeta;
  text: string;
  initialAnchor?: ReaderState | null;
  initialReflowOverrides?: Record<number, boolean>;
  initialFont?: number;
}) {
  const doc = useMemo(() => parseDocument(text), [text]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overrides, setOverrides] = useState(initialReflowOverrides);
  const [font, setFont] = useState(initialFont);
  useScrollBookmark(meta.id, scrollRef, initialAnchor);

  const stepFont = useCallback(
    (delta: number) => {
      setFont((cur) => {
        const next = clampFont(cur + delta);
        if (next !== cur) void saveFontSize(meta.id, next);
        return next;
      });
    },
    [meta.id],
  );

  const toggleReflow = useCallback(
    (blockId: number) => {
      setOverrides((prev) => {
        const on = !(prev[blockId] ?? true); // prose defaults to reflowed
        void setReflowOverride(meta.id, blockId, on);
        return { ...prev, [blockId]: on };
      });
    },
    [meta.id],
  );

  return (
    <div className="flex h-dvh flex-col bg-neutral-950">
      <header className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-2 py-2">
        <Link
          to="/"
          aria-label="Back to library"
          className="rounded p-2 text-neutral-400 active:text-neutral-100"
        >
          ‹
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{meta.title}</h1>
        <FormattingControls size={font} onStep={stepFont} />
      </header>

      <div
        ref={scrollRef}
        data-reader-scroll
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-2 font-mono"
        style={{ fontSize: `${font}px` }}
      >
        <div>
          {doc.blocks.map((block) => (
            <BlockView
              key={block.id}
              block={block}
              reflowOn={overrides[block.id] ?? true}
              onToggle={toggleReflow}
            />
          ))}
        </div>
      </div>

      <SelectionSearch doc={doc} scrollRef={scrollRef} />
    </div>
  );
}
