// Pure geometry for the anchor-based scroll bookmark. The hook measures DOM
// rects and delegates the math here so it's testable without layout.

export interface BlockRect {
  blockId: number;
  top: number; // viewport-relative top (getBoundingClientRect().top)
  height: number;
}

export interface ScrollAnchor {
  blockId: number;
  fraction: number; // 0..1 scrolled into the block
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** The top-most block crossing `containerTop`, and how far into it we've scrolled. */
export function anchorFromRects(
  rects: readonly BlockRect[],
  containerTop: number,
): ScrollAnchor | null {
  for (const r of rects) {
    if (r.top + r.height > containerTop + 1) {
      return {
        blockId: r.blockId,
        fraction: clamp01((containerTop - r.top) / Math.max(r.height, 1)),
      };
    }
  }
  return null;
}

/** How much to add to scrollTop to place `rect` at `containerTop + fraction*height`. */
export function scrollDeltaForAnchor(
  rect: { top: number; height: number },
  containerTop: number,
  fraction: number,
): number {
  return rect.top - containerTop + fraction * rect.height;
}
