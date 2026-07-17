import { anchorFromRects, scrollDeltaForAnchor, type BlockRect, type ScrollAnchor } from "~/lib/scroll";

export type { ScrollAnchor } from "~/lib/scroll";

// DOM measurement for the reader's scroll anchor. The geometry itself is pure and
// lives in ~/lib/scroll; this only reads rects. Shared by the persistent bookmark
// and by font resizing (which must keep the same content under the viewport top).

function measureBlocks(el: HTMLElement): BlockRect[] {
  const rects: BlockRect[] = [];
  for (const b of el.querySelectorAll<HTMLElement>("[data-block-id]")) {
    const r = b.getBoundingClientRect();
    rects.push({ blockId: Number(b.dataset.blockId), top: r.top, height: r.height });
  }
  return rects;
}

/** The block currently at the top of the viewport, and how far into it we are. */
export function currentAnchor(el: HTMLElement): ScrollAnchor | null {
  return anchorFromRects(measureBlocks(el), el.getBoundingClientRect().top);
}

/** Scroll so `anchor` sits back at the top of the viewport. */
export function applyAnchor(el: HTMLElement, anchor: ScrollAnchor): void {
  const block = el.querySelector<HTMLElement>(`[data-block-id="${anchor.blockId}"]`);
  if (!block) return;
  el.scrollTop += scrollDeltaForAnchor(
    block.getBoundingClientRect(),
    el.getBoundingClientRect().top,
    anchor.fraction,
  );
}
