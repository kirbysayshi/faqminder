import { describe, expect, it } from "vitest";
import { fitFontSize } from "./index";

const base = { charRatio: 0.6, min: 6, max: 14 };

describe("fitFontSize", () => {
  it("shrinks so the columns fit the width", () => {
    // 80 cols on a 414px phone: 414 / (80 * 0.6) = 8.6px
    expect(fitFontSize({ ...base, availablePx: 414, cols: 80 })).toBeCloseTo(8.6, 1);
  });

  it("never exceeds the base size on a wide screen", () => {
    expect(fitFontSize({ ...base, availablePx: 1400, cols: 80 })).toBe(14);
  });

  it("floors rather than rounds, so it can't overflow by a fraction", () => {
    const size = fitFontSize({ ...base, availablePx: 414, cols: 80 });
    expect(size * 80 * 0.6).toBeLessThanOrEqual(414);
  });

  it("clamps absurdly wide art to the minimum (it scrolls instead)", () => {
    // The 349-column outlier: fitting it honestly would mean a ~2px font.
    expect(fitFontSize({ ...base, availablePx: 414, cols: 349 })).toBe(6);
  });

  it("falls back to the base size when there's nothing to fit", () => {
    expect(fitFontSize({ ...base, availablePx: 414, cols: 0 })).toBe(14);
    expect(fitFontSize({ ...base, availablePx: 0, cols: 80 })).toBe(14);
  });
});
