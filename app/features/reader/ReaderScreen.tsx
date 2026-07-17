import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { parseDocument } from "~/lib/parse";
import type { FaqMeta } from "~/domains/library";
import { setReflowOverride } from "~/domains/document";
import {
  ART_FONT,
  clampFont,
  DEFAULT_FONT,
  saveFontSize,
  type ReaderState,
} from "~/domains/reader";
import { applyAnchor, currentAnchor, type ScrollAnchor } from "./anchor";
import { BlockView } from "./BlockView";
import { DocumentSearch } from "./DocumentSearch";
import { FormattingControls } from "./FormattingControls";
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
  const [searchOpen, setSearchOpen] = useState(false);
  useScrollBookmark(meta.id, scrollRef, initialAnchor);

  // Resizing re-lays-out the whole document, so remember what was under the top of
  // the viewport BEFORE the change and put it back after — otherwise the reader
  // jumps somewhere unpredictable.
  const pendingAnchor = useRef<ScrollAnchor | null>(null);

  const stepFont = useCallback(
    (delta: number) => {
      const next = clampFont(font + delta);
      if (next === font) return;
      const el = scrollRef.current;
      pendingAnchor.current = el ? currentAnchor(el) : null;
      setFont(next);
      void saveFontSize(meta.id, next);
    },
    [font, meta.id],
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const anchor = pendingAnchor.current;
    pendingAnchor.current = null;
    if (el && anchor) applyAnchor(el, anchor); // after re-layout, before paint
  }, [font]);

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
    <div
      data-reader-root
      className="flex flex-col bg-neutral-950"
      // Fill the viewport, less the update banner when it's showing (var is 0px
      // otherwise, so this is plain 100dvh in the normal case).
      style={{ height: "calc(100dvh - var(--app-banner, 0px))" }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-2 py-2">
        <Link
          to="/"
          aria-label="Back to library"
          className="rounded p-2 text-neutral-400 active:text-neutral-100"
        >
          ‹
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{meta.title}</h1>
        <button
          type="button"
          aria-label="Search this FAQ"
          onClick={() => setSearchOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-neutral-300 active:bg-neutral-800"
        >
          <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 14 14" strokeLinecap="round" />
          </svg>
        </button>
        <FormattingControls size={font} onStep={stepFont} />
      </header>

      <div
        ref={scrollRef}
        data-reader-scroll
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-2 font-mono"
        // Unwrappable text (art/diagrams) inherits the fixed base size; only
        // wrapped prose follows --prose-font.
        style={{ fontSize: `${ART_FONT}px`, "--prose-font": `${font}px` } as React.CSSProperties}
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

      <DocumentSearch
        doc={doc}
        scrollRef={scrollRef}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
    </div>
  );
}
