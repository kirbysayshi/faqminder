import { useLayoutEffect } from "react";
import type { RefObject } from "react";
import { saveScrollAnchor, type ReaderState } from "~/domains/reader";
import { anchorFromRects, scrollDeltaForAnchor, type BlockRect } from "~/lib/scroll";

const SAVE_THROTTLE_MS = 400;

function measureBlocks(el: HTMLElement): BlockRect[] {
  const rects: BlockRect[] = [];
  for (const b of el.querySelectorAll<HTMLElement>("[data-block-id]")) {
    const r = b.getBoundingClientRect();
    rects.push({ blockId: Number(b.dataset.blockId), top: r.top, height: r.height });
  }
  return rects;
}

function currentAnchor(el: HTMLElement): { blockId: number; fraction: number } | null {
  return anchorFromRects(measureBlocks(el), el.getBoundingClientRect().top);
}

function restore(el: HTMLElement, anchor: ReaderState): void {
  const block = el.querySelector<HTMLElement>(`[data-block-id="${anchor.scrollBlockId}"]`);
  if (!block) return;
  const bRect = block.getBoundingClientRect();
  el.scrollTop += scrollDeltaForAnchor(
    bRect,
    el.getBoundingClientRect().top,
    anchor.scrollFraction,
  );
}

/**
 * Persistent auto-bookmark for the reader scroll region. Restores `initialAnchor`
 * before paint, then saves the anchor (throttled) on scroll and immediately when
 * the page is hidden/backgrounded — mobile tabs get purged without a scroll event.
 */
export function useScrollBookmark(
  faqId: string,
  scrollRef: RefObject<HTMLElement | null>,
  initialAnchor: ReaderState | null,
): void {
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (initialAnchor) restore(el, initialAnchor);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      const a = currentAnchor(el);
      if (a) void saveScrollAnchor(faqId, a.blockId, a.fraction);
    };
    const onScroll = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        flush();
      }, SAVE_THROTTLE_MS);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);

    return () => {
      if (timer) clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush(); // save on unmount (e.g. switching FAQs)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faqId]);
}
