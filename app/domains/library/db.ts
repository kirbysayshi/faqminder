import Dexie, { type EntityTable } from "dexie";
import type { FaqMeta, FaqContent } from "./types";

// Two tables so the library list reads only lightweight metadata, never the full
// (potentially multi-MB) text — matters on mobile. Reader state tables are added
// by later phases via new Dexie versions.
export const db = new Dexie("faqminder") as Dexie & {
  faqs: EntityTable<FaqMeta, "id">;
  contents: EntityTable<FaqContent, "id">;
};

db.version(1).stores({
  faqs: "id, addedAt",
  contents: "id",
});
