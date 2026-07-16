import { describe, expect, it } from "vitest";
import { anchorFromRects, scrollDeltaForAnchor, type BlockRect } from "./index";

// Three 100px blocks stacked from viewport top 0.
const rects: BlockRect[] = [
  { blockId: 0, top: 0, height: 100 },
  { blockId: 1, top: 100, height: 100 },
  { blockId: 2, top: 200, height: 100 },
];

describe("anchorFromRects", () => {
  it("returns the block at the container top with fraction 0 when unscrolled", () => {
    expect(anchorFromRects(rects, 0)).toEqual({ blockId: 0, fraction: 0 });
  });

  it("picks the block crossing the top edge and its fraction", () => {
    // container top at 150 => block 1 (top 100, height 100), 50% in.
    expect(anchorFromRects(shift(rects, -150), 0)).toEqual({ blockId: 1, fraction: 0.5 });
  });

  it("clamps a block sitting just below the top edge to fraction 0", () => {
    const a = anchorFromRects([{ blockId: 5, top: 10, height: 100 }], 0);
    expect(a).toEqual({ blockId: 5, fraction: 0 });
  });

  it("returns null when every block is above the top edge", () => {
    expect(anchorFromRects([{ blockId: 0, top: -100, height: 50 }], 0)).toBeNull();
  });
});

describe("scrollDeltaForAnchor", () => {
  it("is the inverse of anchorFromRects (restores the same position)", () => {
    // block 1 should sit 50% above the top edge => delta places its top at -50.
    const delta = scrollDeltaForAnchor({ top: 100, height: 100 }, 0, 0.5);
    expect(delta).toBe(150);
  });
});

// Simulate scrolling: every block's viewport top moves by `dy`.
function shift(rs: BlockRect[], dy: number): BlockRect[] {
  return rs.map((r) => ({ ...r, top: r.top + dy }));
}
