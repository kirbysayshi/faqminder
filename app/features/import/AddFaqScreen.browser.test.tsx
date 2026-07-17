import { page } from "vitest/browser";
// vitest-browser-react, not @testing-library/react — see CLAUDE.md: RTL turns act() on
// for the whole test, so the real-event-driven state updates that are the point here
// would all be flagged "not wrapped in act". This renderer scopes act() to the render.
import { render } from "vitest-browser-react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FAQ_CLIP_MARKER } from "~/lib/filename";
import { AddFaqScreen } from "./AddFaqScreen";
import "~/app.css"; // real Tailwind — the 16px-input assertions depend on it

// Payload the copy bookmarklet would put on the clipboard: marker header + page title,
// then the FAQ body.
const payload = (title: string, body: string) => `${FAQ_CLIP_MARKER}\t${title}\n${body}`;

// Shadow navigator.clipboard for the click-driven read/write; afterEach removes the
// shadow, restoring the native (prototype) clipboard.
function stubClipboard(impl: Partial<Clipboard>) {
  Object.defineProperty(navigator, "clipboard", { value: impl, configurable: true });
}

describe("AddFaqScreen (real browser)", () => {
  beforeEach(async () => {
    document.body.style.margin = "0";
    // Routes let us observe the post-save navigation to the reader.
    await render(
      <MemoryRouter initialEntries={["/add"]}>
        <Routes>
          <Route path="/add" element={<AddFaqScreen />} />
          <Route path="/faq/:id" element={<div>reader open</div>} />
          <Route path="/" element={<div>library</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });

  afterEach(() => {
    delete (navigator as { clipboard?: unknown }).clipboard;
  });

  // Guard: without the real stylesheet the computed-size assertions below are meaningless.
  it("has the app stylesheet applied", () => {
    expect(getComputedStyle(document.querySelector("main")!).display).toBe("flex");
  });

  it("pastes from the clipboard, derives the title, and opens the reader on save", async () => {
    stubClipboard({
      readText: () =>
        Promise.resolve(
          payload("Zelda - Guide and Walkthrough - SNES - By Bar - GameFAQs", "STEP 1\nfoo"),
        ),
    });

    await page.getByRole("button", { name: "Paste from clipboard" }).click();

    // Happy path shows a confirmation, not the textarea.
    await expect.element(page.getByText(/Pasted —/)).toBeVisible();
    expect(document.querySelector("textarea")).toBeNull();
    await expect.element(page.getByLabelText("Title")).toHaveValue("Zelda");

    await page.getByRole("button", { name: "Add to library" }).click();
    await expect.element(page.getByText("reader open")).toBeVisible();
  });

  it("reveals the manual textarea only after a clipboard read fails", async () => {
    stubClipboard({ readText: () => Promise.reject(new Error("denied")) });

    // Nothing is shown until the button is tapped.
    expect(document.querySelector("textarea")).toBeNull();
    await page.getByRole("button", { name: "Paste from clipboard" }).click();

    const box = page.getByPlaceholder(/Long-press/);
    await expect.element(box).toBeVisible();
    await expect.element(page.getByText(/Couldn.t read the clipboard/)).toBeVisible();

    // Manual paste still derives the title from the header.
    await box.fill(payload("Metroid - FAQ - NES - By X - GameFAQs", "body line"));
    await expect.element(page.getByLabelText("Title")).toHaveValue("Metroid");
  });

  it("keeps text inputs at ≥16px so iOS never zooms the viewport on focus", async () => {
    stubClipboard({ readText: () => Promise.reject(new Error("denied")) });
    await page.getByRole("button", { name: "Paste from clipboard" }).click();

    const textarea = document.querySelector("textarea")!;
    await expect.element(page.getByPlaceholder(/Long-press/)).toBeVisible();
    expect(parseFloat(getComputedStyle(textarea).fontSize)).toBeGreaterThanOrEqual(16);

    // Fill to reveal the Title input, then check it too.
    await page.getByPlaceholder(/Long-press/).fill("some faq text");
    const title = document.querySelector<HTMLInputElement>('input[type="text"]')!;
    expect(parseFloat(getComputedStyle(title).fontSize)).toBeGreaterThanOrEqual(16);
  });

  it("offers the bookmarklet as a draggable javascript: link that no-ops on click", async () => {
    const link = document.querySelector<HTMLAnchorElement>('a[draggable="true"]')!;
    expect(link.getAttribute("href")).toMatch(/^javascript:/);
    expect(link.textContent).toContain("FAQMinder: Save FAQ");

    // Clicking it in-app must not run it / navigate away (it's for dragging to bookmarks).
    await page.getByRole("link", { name: /FAQMinder: Save FAQ/ }).click();
    expect(document.querySelector("h1")?.textContent).toBe("Add FAQ");
    await page.screenshot({ element: document.querySelector("main")! });
  });
});
