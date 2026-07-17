import { db, type ReaderState } from "~/domains/db";

export type { ReaderState } from "~/domains/db";

// Per-document reader state (scroll anchor + font size). Both are persisted per
// FAQ so each document keeps its own place and base font size.
export const DEFAULT_FONT = 14;
export const MIN_FONT = 9;
export const MAX_FONT = 28;
export const FONT_STEP = 1;

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
