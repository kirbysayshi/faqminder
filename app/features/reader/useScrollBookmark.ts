import { useLayoutEffect } from "react";
import type { RefObject } from "react";
import { saveScrollAnchor, type ReaderState } from "~/domains/reader";
import { applyAnchor, currentAnchor } from "./anchor";

const SAVE_THROTTLE_MS = 400;

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

    if (initialAnchor) {
      applyAnchor(el, {
        blockId: initialAnchor.scrollBlockId,
        fraction: initialAnchor.scrollFraction,
      });
    }

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
