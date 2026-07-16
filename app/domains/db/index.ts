import Dexie, { type EntityTable } from "dexie";
import type { FaqMeta, FaqContent, ReaderState, DocState } from "./types";

export type { FaqMeta, FaqContent, ReaderState, DocState } from "./types";

// The app's single IndexedDB database. faqs/contents split so the library list
// reads only lightweight metadata (matters on mobile). Schema grows by adding
// Dexie versions — never mutate a shipped version's stores.
export const db = new Dexie("faqminder") as Dexie & {
  faqs: EntityTable<FaqMeta, "id">;
  contents: EntityTable<FaqContent, "id">;
  readerState: EntityTable<ReaderState, "id">;
  docState: EntityTable<DocState, "id">;
};

db.version(1).stores({
  faqs: "id, addedAt",
  contents: "id",
});
db.version(2).stores({
  readerState: "id",
});
db.version(3).stores({
  docState: "id",
});
