import { useLayoutEffect, useState } from "react";
import type { RefObject } from "react";
import { ART_FONT, MIN_ART_FONT } from "~/domains/reader";
import { fitFontSize } from "~/lib/typography";

/**
 * Advance width of one character per px of font size, measured from the font that
 * is actually rendering. Assuming ~0.6 would overflow by a few columns on any face
 * that differs.
 */
function measureCharRatio(el: HTMLElement): number {
  const probe = document.createElement("span");
  probe.textContent = "0".repeat(50);
  probe.style.cssText =
    "position:absolute;visibility:hidden;white-space:pre;left:-9999px;font-size:100px";
  el.appendChild(probe);
  const ratio = probe.getBoundingClientRect().width / 50 / 100;
  probe.remove();
  return ratio;
}

/**
 * Size for text that can't wrap. When `fit` is on, shrink art so the document's
 * typical diagram width fits the screen — an 80-column drawing running off a phone
 * is worse than a small one, and pinch-zoom recovers the detail. Off, art stays at
 * the base size and scrolls. Recomputed on resize/rotate.
 */
export function useArtFont(
  scrollRef: RefObject<HTMLElement | null>,
  artCols: number,
  fit: boolean,
): number {
  const [font, setFont] = useState(ART_FONT);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!fit) {
      setFont(ART_FONT);
      return;
    }
    const compute = () => {
      const style = getComputedStyle(el);
      const available =
        el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      setFont(
        fitFontSize({
          availablePx: available,
          cols: artCols,
          charRatio: measureCharRatio(el),
          min: MIN_ART_FONT,
          max: ART_FONT,
        }),
      );
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRef, artCols, fit]);

  return font;
}
