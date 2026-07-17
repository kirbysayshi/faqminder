import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "~/domains/db";
import { getReaderState } from "~/domains/reader";
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

  it("applies and steps the per-document font size, persisting it", async () => {
    const user = userEvent.setup();
    const { container } = renderReader("hello");
    const scroll = container.querySelector<HTMLElement>("[data-reader-scroll]")!;
    expect(scroll.style.fontSize).toBe("14px");
    await user.click(screen.getByLabelText("Increase text size"));
    expect(scroll.style.fontSize).toBe("15px");
    expect((await getReaderState("x"))?.fontSize).toBe(15);
  });

  it("honors an initial per-document font from storage", () => {
    const { container } = render(
      <MemoryRouter>
        <ReaderScreen meta={meta} text={"hello"} initialFont={20} />
      </MemoryRouter>,
    );
    const scroll = container.querySelector<HTMLElement>("[data-reader-scroll]")!;
    expect(scroll.style.fontSize).toBe("20px");
  });

  it("renders each block as a verbatim, id-tagged <pre>", () => {
    const { container } = renderReader("banner\nline2\n\ntext");
    const blocks = container.querySelectorAll("pre[data-block-id]");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toHaveTextContent("banner");
    expect(blocks[0]?.getAttribute("data-block-id")).toBe("0");
  });

  it("preserves ASCII art exactly (no whitespace collapsing)", () => {
    const art = "  |¯|   |¯|\n /   \\ / \\";
    const { container } = renderReader(art);
    const pre = container.querySelector("pre[data-block-id]");
    expect(pre?.textContent).toBe(art);
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
