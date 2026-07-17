import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "~/domains/db";
import { ART_FONT, getReaderState } from "~/domains/reader";
import type { FaqMeta } from "~/domains/library";
import { ReaderScreen } from "./ReaderScreen";

const meta: FaqMeta = {
  id: "x",
  title: "Ace Combat 3",
  source: "ace.txt",
  addedAt: 0,
  byteSize: 0,
  lineCount: 0,
  encoding: "utf-8",
  repaired: false,
};

function renderReader(text: string) {
  return render(
    <MemoryRouter>
      <ReaderScreen meta={meta} text={text} />
    </MemoryRouter>,
  );
}

describe("ReaderScreen", () => {
  beforeEach(() => db.readerState.clear());
  afterEach(() => db.close({ disableAutoOpen: false }));

  // The prose size rides a CSS var; the container's own font-size is the fixed
  // base that unwrappable art inherits.
  const proseFont = (c: HTMLElement) =>
    c.querySelector<HTMLElement>("[data-reader-scroll]")!.style.getPropertyValue("--prose-font");

  it("applies and steps the per-document font size, persisting it", async () => {
    const user = userEvent.setup();
    const { container } = renderReader("hello");
    expect(proseFont(container)).toBe("14px");
    await user.click(screen.getByLabelText("Increase text size"));
    expect(proseFont(container)).toBe("15px");
    expect((await getReaderState("x"))?.fontSize).toBe(15);
  });

  it("honors an initial per-document font from storage", () => {
    const { container } = render(
      <MemoryRouter>
        <ReaderScreen meta={meta} text={"hello"} initialFont={20} />
      </MemoryRouter>,
    );
    expect(proseFont(container)).toBe("20px");
  });

  it("keeps unwrappable art at the fixed base size, not the prose size", async () => {
    const user = userEvent.setup();
    const { container } = renderReader("hello");
    const scroll = container.querySelector<HTMLElement>("[data-reader-scroll]")!;
    expect(scroll.style.fontSize).toBe(`${ART_FONT}px`);
    await user.click(screen.getByLabelText("Increase text size"));
    expect(scroll.style.fontSize).toBe(`${ART_FONT}px`); // unchanged by resizing
    expect(proseFont(container)).toBe("15px");
  });

  it("renders each block as a verbatim, id-tagged element", () => {
    const { container } = renderReader("banner\nline2\n\ntext");
    const blocks = container.querySelectorAll("[data-block-id]");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toHaveTextContent("banner");
    expect(blocks[0]?.getAttribute("data-block-id")).toBe("0");
    expect(blocks[0]?.querySelector("pre")).not.toBeNull();
  });

  it("preserves ASCII art exactly (no whitespace collapsing)", () => {
    const art = "  |¯|   |¯|\n /   \\ / \\";
    const { container } = renderReader(art);
    expect(container.querySelector("[data-block-id] pre")?.textContent).toBe(art);
  });

  it("lets wide art scroll inside its own block instead of widening the page", () => {
    const { container } = renderReader("|" + "=".repeat(200) + "|");
    // The art sits in its own horizontal scroller; the page never scrolls sideways.
    expect(container.querySelector("[data-block-id] .overflow-x-auto")).not.toBeNull();
    expect(container.querySelector("[data-reader-scroll]")?.className).toContain(
      "overflow-x-hidden",
    );
  });

  it("renders a large real fixture without dropping blocks", () => {
    const text = readFileSync(
      resolve(
        process.cwd(),
        "fixtures",
        "Ace Combat 3_ Electrosphere - Guide and Walkthrough - PlayStation - By Shotgunnova - GameFAQs.txt",
      ),
      "utf-8",
    );
    const { container } = renderReader(text);
    expect(container.querySelectorAll("[data-block-id]").length).toBeGreaterThan(20);
    expect(screen.getByRole("heading")).toHaveTextContent("Ace Combat 3");
  });
});
