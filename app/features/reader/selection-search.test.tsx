import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FaqMeta } from "~/domains/library";
import { ReaderScreen } from "./ReaderScreen";

const meta: FaqMeta = {
  id: "x", title: "T", source: "t.txt", addedAt: 0, byteSize: 0,
  lineCount: 0, encoding: "utf-8", repaired: false,
};

function selectSubstring(el: HTMLElement, needle: string) {
  const node = el.firstChild as Text;
  const start = (node.textContent ?? "").indexOf(needle);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + needle.length);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

describe("SelectionSearch", () => {
  beforeEach(() => localStorage.clear());

  it("surfaces occurrences of a selection and jumps to one", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <ReaderScreen meta={meta} text={"alpha map beta\ngamma map delta"} />
      </MemoryRouter>,
    );
    const block = container.querySelector<HTMLElement>('[data-block-id="0"]')!;
    const scroll = container.querySelector<HTMLElement>("[data-reader-scroll]")!;
    scroll.scrollTo = vi.fn(); // jsdom has no scrollTo

    selectSubstring(block, "map");

    // Pill appears with the match count (2 occurrences of "map").
    const pill = await screen.findByRole("button", { name: /find “map”/i });
    expect(pill).toHaveTextContent("2");

    await user.click(pill);
    expect(await screen.findByText(/2 matches for/i)).toBeInTheDocument();

    // Jump to the first occurrence.
    const rows = screen.getAllByRole("button").filter((b) => b.textContent?.includes("map"));
    await user.click(rows[0]!);

    expect(scroll.scrollTo).toHaveBeenCalled();
    expect(block.classList.contains("reader-flash")).toBe(true);
    await waitFor(() => expect(screen.queryByText(/2 matches for/i)).not.toBeInTheDocument());
  });

  it("shows nothing when the selection is too short", async () => {
    render(
      <MemoryRouter>
        <ReaderScreen meta={meta} text={"alpha map beta"} />
      </MemoryRouter>,
    );
    const block = document.querySelector<HTMLElement>('[data-block-id="0"]')!;
    selectSubstring(block, "a");
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.queryByRole("button", { name: /find/i })).not.toBeInTheDocument();
  });
});
