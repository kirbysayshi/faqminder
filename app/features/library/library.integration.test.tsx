import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "~/domains/library/db";
import { ImportButton } from "~/features/import";
import { LibraryScreen } from "./LibraryScreen";

function faqFile(name: string, body: string): File {
  return new File([body], name, { type: "text/plain" });
}

describe("import → persist → list (integration)", () => {
  beforeEach(async () => {
    await db.faqs.clear();
    await db.contents.clear();
  });
  afterEach(() => db.close({ disableAutoOpen: false }));

  it("decodes uploaded files, persists them, and lists them", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LibraryScreen importSlot={<ImportButton />} />
      </MemoryRouter>,
    );

    // Uploading 2 files skips the single-file auto-navigate.
    const input = screen.getByLabelText<HTMLInputElement>(/add faq/i);
    await user.upload(input, [
      faqFile("Chrono Trigger - Guide - SNES - By X - GameFAQs.txt", "Chrono content"),
      faqFile("EarthBound_ Mother 2 - FAQ - SNES - By Y.txt", "EarthBound content"),
    ]);

    expect(await screen.findByText("Chrono Trigger")).toBeInTheDocument();
    expect(await screen.findByText("EarthBound: Mother 2")).toBeInTheDocument();

    const rows = await db.faqs.toArray();
    expect(rows).toHaveLength(2);
    expect(await db.contents.get(rows.find((r) => r.title === "Chrono Trigger")!.id)).toMatchObject(
      { text: "Chrono content" },
    );
  });
});
