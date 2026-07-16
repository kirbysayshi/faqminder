import { db, type ReaderState } from "~/domains/db";

export type { ReaderState } from "~/domains/db";

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
