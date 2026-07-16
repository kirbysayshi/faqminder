import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "~/domains/db";
import { getReflowOverrides } from "~/domains/document";
import type { FaqMeta } from "~/domains/library";
import { ReaderScreen } from "./ReaderScreen";

const meta: FaqMeta = {
  id: "faq1", title: "T", source: "t.txt", addedAt: 0, byteSize: 0,
  lineCount: 0, encoding: "utf-8", repaired: false,
};

const prose = [
  "This is a normal hard-wrapped paragraph of prose text that a FAQ author",
  "typed at roughly seventy columns wide, breaking each line manually as they",
  "went, which is exactly the kind of block we want to be able to reflow.",
].join("\n");

function renderReader() {
  return render(
    <MemoryRouter>
      <ReaderScreen meta={meta} text={prose} />
    </MemoryRouter>,
  );
}

describe("reflow toggle", () => {
  beforeEach(async () => {
    localStorage.clear();
    await db.docState.clear();
  });
  afterEach(() => db.close({ disableAutoOpen: false }));

  it("auto-reflows prose (default on) and toggles + persists off", async () => {
    const user = userEvent.setup();
    const { container } = renderReader();

    // Default: prose rendered reflowed (a <p>, single line, no newline).
    const blockEl = container.querySelector<HTMLElement>('[data-block-id="0"]')!;
    expect(blockEl.tagName).toBe("DIV");
    expect(blockEl.querySelector("p")).not.toBeNull();
    expect(blockEl.querySelector("pre")).toBeNull();

    // Toggle off -> renders verbatim <pre>, and the choice is persisted.
    await user.click(screen.getByLabelText(/undo soft-wrap/i));
    expect(blockEl.querySelector("pre")).not.toBeNull();
    expect(blockEl.querySelector("p")).toBeNull();
    expect(await getReflowOverrides("faq1")).toEqual({ 0: false });
  });

  it("honors an initial override (off) from storage", () => {
    const { container } = render(
      <MemoryRouter>
        <ReaderScreen meta={meta} text={prose} initialReflowOverrides={{ 0: false }} />
      </MemoryRouter>,
    );
    const blockEl = container.querySelector<HTMLElement>('[data-block-id="0"]')!;
    expect(blockEl.querySelector("pre")).not.toBeNull();
  });
});
