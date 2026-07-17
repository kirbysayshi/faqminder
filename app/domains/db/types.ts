// Persisted row shapes (the Dexie schema owns these). Domains build operations
// on top; non-persisted DTOs (e.g. NewFaqInput) live with their domain.

export interface FaqMeta {
  id: string;
  title: string;
  source: string; // original filename
  addedAt: number; // epoch ms
  byteSize: number;
  lineCount: number;
  encoding: string;
  repaired: boolean;
}

export interface FaqContent {
  id: string;
  text: string;
}

/** Per-FAQ reader state. Anchor = top-most visible block + fraction into it —
 * robust to font-size / reflow changes (see PLAN.md). */
export interface ReaderState {
  id: string; // faqId
  scrollBlockId: number;
  scrollFraction: number; // 0..1 within that block
  fontSize?: number; // per-document font size (px); ASCII width varies by doc
  artFit?: boolean; // shrink unwrappable art to fit the screen instead of scrolling
  updatedAt: number;
}

/** Per-FAQ document state. `reflowOverrides` maps blockId -> user's on/off choice,
 * overriding the auto classification (only deviations are stored). */
export interface DocState {
  id: string; // faqId
  reflowOverrides: Record<number, boolean>;
}
