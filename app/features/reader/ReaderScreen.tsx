import { useAtomValue } from "jotai";
import { useMemo, useRef } from "react";
import { Link } from "react-router";
import { parseDocument } from "~/lib/parse";
import type { FaqMeta } from "~/domains/library";
import { readerFontAtom, type ReaderState } from "~/domains/reader";
import { FormattingControls } from "./FormattingControls";
import { useScrollBookmark } from "./useScrollBookmark";

const LINE_HEIGHT = 1.4;

// The reader: a full-height column with a sticky header and a scroll region that
// renders each block verbatim (monospace). Wide ASCII art scrolls horizontally;
// font size (P4) is driven by the --reader-font CSS var. Blocks carry
// data-block-id for scroll-anchoring (P3) and selection jumps (P5).
export function ReaderScreen({
  meta,
  text,
  initialAnchor = null,
}: {
  meta: FaqMeta;
  text: string;
  initialAnchor?: ReaderState | null;
}) {
  const doc = useMemo(() => parseDocument(text), [text]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const font = useAtomValue(readerFontAtom);
  useScrollBookmark(meta.id, scrollRef, initialAnchor);

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
        <FormattingControls />
      </header>

      <div
        ref={scrollRef}
        data-reader-scroll
        className="flex-1 overflow-auto overscroll-contain px-3 py-2"
        style={{ fontSize: `${font}px` }}
      >
        <div className="w-max min-w-full">
          {doc.blocks.map((block) => (
            <pre
              key={block.id}
              data-block-id={block.id}
              className="font-mono whitespace-pre text-neutral-100"
              style={{
                lineHeight: LINE_HEIGHT,
                marginTop: block.gapBefore ? `${block.gapBefore * LINE_HEIGHT}em` : 0,
              }}
            >
              {block.lines.join("\n")}
            </pre>
          ))}
        </div>
      </div>
    </div>
  );
}
