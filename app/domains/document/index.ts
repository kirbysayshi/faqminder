import { db } from "~/domains/db";

// Per-FAQ reflow overrides: only blocks the user has flipped away from the auto
// classification are stored. Effective state is resolved in the reader.

export async function getReflowOverrides(faqId: string): Promise<Record<number, boolean>> {
  return (await db.docState.get(faqId))?.reflowOverrides ?? {};
}

export async function setReflowOverride(
  faqId: string,
  blockId: number,
  on: boolean,
): Promise<void> {
  await db.transaction("rw", db.docState, async () => {
    const cur = (await db.docState.get(faqId))?.reflowOverrides ?? {};
    await db.docState.put({ id: faqId, reflowOverrides: { ...cur, [blockId]: on } });
  });
}
