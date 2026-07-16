import { atomWithStorage } from "jotai/utils";
import { db, type ReaderState } from "~/domains/db";

export type { ReaderState } from "~/domains/db";

// Global reader font size (px), applied across all FAQs. Persisted synchronously
// to localStorage (getOnInit avoids a default→stored flash on load).
export const DEFAULT_FONT = 14;
export const MIN_FONT = 9;
export const MAX_FONT = 28;
export const FONT_STEP = 1;

export const readerFontAtom = atomWithStorage<number>(
  "faqminder:reader-font",
  DEFAULT_FONT,
  undefined,
  { getOnInit: true },
);

export function clampFont(px: number): number {
  return Math.min(MAX_FONT, Math.max(MIN_FONT, px));
}

export async function getReaderState(id: string): Promise<ReaderState | undefined> {
  return db.readerState.get(id);
}

/** Upsert the scroll anchor for a FAQ. Callers throttle. */
export async function saveScrollAnchor(
  id: string,
  scrollBlockId: number,
  scrollFraction: number,
): Promise<void> {
  await db.readerState.put({ id, scrollBlockId, scrollFraction, updatedAt: Date.now() });
}
