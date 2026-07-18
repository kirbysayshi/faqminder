import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { parseDocument } from "~/lib/parse";
import type { FaqMeta } from "~/domains/library";
import { setReflowOverride } from "~/domains/document";
import {
  clampFont,
  DEFAULT_ART_FIT,
  DEFAULT_FONT,
  saveArtFit,
  saveFontSize,
  type ReaderState,
} from "~/domains/reader";
import { applyAnchor, currentAnchor, type ScrollAnchor } from "./anchor";
import { BlockView } from "./BlockView";
import { DocumentSearch } from "./DocumentSearch";
import { FormattingControls } from "./FormattingControls";
import { ReaderOptions } from "./ReaderOptions";
import { useArtFont } from "./useArtFont";
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
  initialArtFit = DEFAULT_ART_FIT,
}: {
  meta: FaqMeta;
  text: string;
  initialAnchor?: ReaderState | null;
  initialReflowOverrides?: Record<number, boolean>;
  initialFont?: number;
  initialArtFit?: boolean;
}) {
  const doc = useMemo(() => parseDocument(text), [text]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overrides, setOverrides] = useState(initialReflowOverrides);
  const [font, setFont] = useState(initialFont);
  const [artFit, setArtFit] = useState(initialArtFit);
  const [searchOpen, setSearchOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { size: artFont, measured } = useArtFont(scrollRef, doc.artCols, artFit);
  useScrollBookmark(meta.id, scrollRef, initialAnchor, measured);

  // Anything that resizes text re-lays-out the whole document, so remember what was
  // under the top of the viewport BEFORE the change and put it back after —
  // otherwise the reader jumps somewhere unpredictable.
  const pendingAnchor = useRef<ScrollAnchor | null>(null);
  const rememberViewport = useCallback(() => {
    const el = scrollRef.current;
    pendingAnchor.current = el ? currentAnchor(el) : null;
  }, []);

  const toggleArtFit = useCallback(
    (fit: boolean) => {
      rememberViewport();
      setArtFit(fit);
      void saveArtFit(meta.id, fit);
    },
    [meta.id, rememberViewport],
  );

  const stepFont = useCallback(
    (delta: number) => {
      const next = clampFont(font + delta);
      if (next === font) return;
      rememberViewport();
      setFont(next);
      void saveFontSize(meta.id, next);
    },
    [font, meta.id, rememberViewport],
  );

  // Keyed on the sizes that actually reflow the document, not on the settings that
  // produce them: toggling artFit only re-lays-out once useArtFont has measured and
  // published a new artFont, a render later.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const anchor = pendingAnchor.current;
    pendingAnchor.current = null;
    if (el && anchor) applyAnchor(el, anchor); // after re-layout, before paint
  }, [font, artFont]);

  const toggleReflow = useCallback(
    (blockId: number, on: boolean) => {
      void setReflowOverride(meta.id, blockId, on);
      setOverrides((prev) => ({ ...prev, [blockId]: on }));
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
        <button
          type="button"
          aria-label="Reader options"
          onClick={() => setOptionsOpen(true)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-neutral-300 active:bg-neutral-800"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <FormattingControls size={font} onStep={stepFont} />
      </header>

      <div
        ref={scrollRef}
        data-reader-scroll
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-2 font-mono"
        // Unwrappable text (art/diagrams) inherits artFont — the base size, or
        // shrunk to fit the screen. Only wrapped prose follows --prose-font.
        style={{ fontSize: `${artFont}px`, "--prose-font": `${font}px` } as React.CSSProperties}
      >
        <div>
          {doc.blocks.map((block) => (
            <BlockView
              key={block.id}
              block={block}
              // Confident prose arrives wrapped; text we only suspect arrives
              // verbatim with the toggle offered. Either can be overridden.
              reflowOn={overrides[block.id] ?? block.reflow?.defaultOn ?? false}
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
      <ReaderOptions
        open={optionsOpen}
        onOpenChange={setOptionsOpen}
        artFit={artFit}
        onArtFitChange={toggleArtFit}
      />
    </div>
  );
}
