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
  // Text lives in the <pre>/<p> inside the block wrapper.
  const host = el.querySelector("pre, p") ?? el;
  const node = host.firstChild as Text;
  const start = (node.textContent ?? "").indexOf(needle);
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, start + needle.length);
  const sel = window.getSelection()!;
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

const searchInput = () => screen.getByRole("searchbox", { name: /search this faq/i });
const resultRows = () =>
  screen.getAllByRole("button").filter((b) => /^\d+/.test(b.textContent ?? ""));

describe("DocumentSearch", () => {
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
    expect(await screen.findByText(/2 matches/i)).toBeInTheDocument();
    // The selection arrives pre-filled and stays editable.
    expect(searchInput()).toHaveValue("map");

    await user.click(resultRows()[0]!);

    expect(scroll.scrollTo).toHaveBeenCalled();
    expect(block.classList.contains("reader-flash")).toBe(true);
    await waitFor(() => expect(screen.queryByText(/2 matches/i)).not.toBeInTheDocument());
  });

  it("searches a typed term without needing a selection first", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter>
        <ReaderScreen meta={meta} text={"alpha map beta\ngamma map delta"} />
      </MemoryRouter>,
    );
    const scroll = container.querySelector<HTMLElement>("[data-reader-scroll]")!;
    scroll.scrollTo = vi.fn();

    await user.click(screen.getByRole("button", { name: /search this faq/i }));
    await user.type(searchInput(), "map");

    expect(await screen.findByText(/2 matches/i)).toBeInTheDocument();
    await user.click(resultRows()[1]!); // jump to the second hit
    expect(scroll.scrollTo).toHaveBeenCalled();
  });

  it("prompts instead of searching until the term is long enough", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReaderScreen meta={meta} text={"alpha map beta\ngamma map delta"} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /search this faq/i }));
    expect(await screen.findByText(/type at least 2 characters/i)).toBeInTheDocument();

    await user.type(searchInput(), "m");
    expect(screen.getByText(/type at least 2 characters/i)).toBeInTheDocument();
    expect(resultRows()).toHaveLength(0);
  });

  // The 16px rule that stops iOS zooming on focus is asserted against a real
  // computed style in reader.layout.browser.test.tsx.
  it("focuses the input on open so the keyboard is ready", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ReaderScreen meta={meta} text={"alpha map beta"} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /search this faq/i }));
    expect(searchInput()).toHaveFocus();
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
