import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
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
    expect(container.querySelectorAll("pre[data-block-id]").length).toBeGreaterThan(20);
    expect(screen.getByRole("heading")).toHaveTextContent("Ace Combat 3");
  });
});
