import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";
import type { FaqMeta, NewFaqInput } from "./types";

export type { FaqMeta, FaqContent, NewFaqInput } from "./types";

export async function addFaq(input: NewFaqInput): Promise<string> {
  const id = crypto.randomUUID();
  const lineCount = input.text.length ? input.text.split("\n").length : 0;
  await db.transaction("rw", db.faqs, db.contents, async () => {
    await db.faqs.add({
      id,
      title: input.title,
      source: input.source,
      addedAt: Date.now(),
      byteSize: input.byteSize,
      lineCount,
      encoding: input.encoding,
      repaired: input.repaired,
    });
    await db.contents.add({ id, text: input.text });
  });
  return id;
}

export async function deleteFaq(id: string): Promise<void> {
  await db.transaction("rw", db.faqs, db.contents, async () => {
    await db.faqs.delete(id);
    await db.contents.delete(id);
  });
}

export async function getFaqMeta(id: string): Promise<FaqMeta | undefined> {
  return db.faqs.get(id);
}

export async function getFaqText(id: string): Promise<string | undefined> {
  return (await db.contents.get(id))?.text;
}

/** Reactive library list (newest first), metadata only. `undefined` while loading. */
export function useFaqList(): FaqMeta[] | undefined {
  return useLiveQuery(() => db.faqs.orderBy("addedAt").reverse().toArray());
}
