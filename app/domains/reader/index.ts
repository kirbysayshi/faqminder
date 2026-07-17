import { db, type ReaderState } from "~/domains/db";

export type { ReaderState } from "~/domains/db";

// Per-document reader state (scroll anchor + font size). Both are persisted per
// FAQ so each document keeps its own place and base font size.
export const DEFAULT_FONT = 14;
export const MIN_FONT = 9;
export const MAX_FONT = 28;
export const FONT_STEP = 1;

/**
 * Base size for text that CANNOT be wrapped — ASCII art, diagrams, tables. Fixed:
 * resizing only ever affects wrapped prose, because scaling art would just make a
 * fixed-width drawing overflow further. Art scrolls inside its own block, and the
 * viewport still pinch-zooms for a closer look.
 */
export const ART_FONT = 14;

/**
 * Floor for shrink-to-fit art. Below this the drawing stops reading as a picture,
 * so freakishly wide diagrams keep their horizontal scroll rather than dissolve.
 */
export const MIN_ART_FONT = 6;

/** Default on: an 80-column diagram overflowing a phone is worse than a small one. */
export const DEFAULT_ART_FIT = true;

export function saveArtFit(id: string, artFit: boolean): Promise<void> {
  return patch(id, { artFit });
}

export function clampFont(px: number): number {
  return Math.min(MAX_FONT, Math.max(MIN_FONT, px));
}

export async function getReaderState(id: string): Promise<ReaderState | undefined> {
  return db.readerState.get(id);
}

// Merge-patch so writing one field (font) never clobbers another (scroll anchor).
async function patch(id: string, fields: Partial<ReaderState>): Promise<void> {
  await db.transaction("rw", db.readerState, async () => {
    const cur = await db.readerState.get(id);
    await db.readerState.put({
      scrollBlockId: 0,
      scrollFraction: 0,
      ...cur,
      ...fields,
      id,
      updatedAt: Date.now(),
    });
  });
}

/** Upsert the scroll anchor for a FAQ. Callers throttle. */
export function saveScrollAnchor(
  id: string,
  scrollBlockId: number,
  scrollFraction: number,
): Promise<void> {
  return patch(id, { scrollBlockId, scrollFraction });
}

export function saveFontSize(id: string, fontSize: number): Promise<void> {
  return patch(id, { fontSize });
}
