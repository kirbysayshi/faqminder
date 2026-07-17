// Pure sizing math for monospace text. The DOM measuring lives in the reader;
// only the arithmetic is here so it can be tested without a browser.

/**
 * Largest font size (px) at which `cols` monospace characters still fit in
 * `availablePx`, clamped to [min, max].
 *
 * `charRatio` is the advance width of one character per px of font size, measured
 * from the actual font rather than assumed — it varies per family (~0.6 for most
 * monospace faces) and guessing it would overflow by a few columns.
 *
 * Returns `max` when there's nothing to fit (no art), and floors to 1/10px so
 * rounding can only ever make it narrower, never overflow.
 */
export function fitFontSize({
  availablePx,
  cols,
  charRatio,
  min,
  max,
}: {
  availablePx: number;
  cols: number;
  charRatio: number;
  min: number;
  max: number;
}): number {
  if (cols <= 0 || charRatio <= 0 || availablePx <= 0) return max;
  const ideal = availablePx / (cols * charRatio);
  return Math.min(max, Math.max(min, Math.floor(ideal * 10) / 10));
}
