import { useLiveQuery } from "dexie-react-hooks";
import { db, type FaqMeta } from "~/domains/db";

export type { FaqMeta, FaqContent } from "~/domains/db";

export interface NewFaqInput {
  title: string;
  source: string;
  text: string;
  byteSize: number;
  encoding: string;
  repaired: boolean;
}

export async function addFaq(input: NewFaqInput): Promise<string> {
  const id = crypto.randomUUID();
  const lineCount = input.text.length ? input.text.split("\n").length : 0;
  await db.transaction("rw", db.faqs, db.contents, async () => {
    await db.faqs.add({
      id,
      title: input.title,
      source: input.source,
      addedAt: Date.now(),
      lineCount,
      byteSize: input.byteSize,
      encoding: input.encoding,
      repaired: input.repaired,
    });
    await db.contents.add({ id, text: input.text });
  });
  return id;
}

export async function deleteFaq(id: string): Promise<void> {
  await db.transaction("rw", db.faqs, db.contents, db.readerState, db.docState, async () => {
    await db.faqs.delete(id);
    await db.contents.delete(id);
    await db.readerState.delete(id);
    await db.docState.delete(id);
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
