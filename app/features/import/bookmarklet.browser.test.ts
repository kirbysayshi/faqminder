import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAQ_CLIP_MARKER } from "~/lib/filename";
import { BOOKMARKLET } from "./bookmarklet";

// What a browser runs after it percent-decodes the javascript: URL.
const decoded = decodeURIComponent(BOOKMARKLET.slice("javascript:".length));
const runDecoded = () => (0, eval)(decoded);

const title = "Final Fantasy VII - Guide and Walkthrough - PS1 - By Z - GameFAQs";
const expected = `${FAQ_CLIP_MARKER}\t${title}\nINTRO\nline two`;

// Real Chromium — a real engine, real DOM, and (below) the real URL-decode path a bookmark
// takes. What it can NOT assert is the clipboard write itself (headless has no user gesture,
// so real execCommand("copy") returns false and clipboard access is denied) — that, and iOS
// Firefox's decode/gesture behavior, are device-only. So execCommand is forced.
describe("bookmarklet (real browser)", () => {
  beforeEach(() => {
    document.title = title;
    document.body.innerHTML = '<pre class="faqtext">INTRO\nline two</pre>';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    [...document.documentElement.children].forEach((c) => {
      if (/^(A|DIV|BUTTON|TEXTAREA)$/.test(c.tagName)) c.remove();
    });
  });

  it("the browser decodes and runs the ENCODED url when clicked as a link", async () => {
    // The real path: put the percent-encoded BOOKMARKLET on an <a href> and click it, so
    // the browser (not us) does the decode. If encoding were wrong, nothing would run.
    // javascript: navigation runs as a task, so wait for the effect.
    vi.spyOn(document, "execCommand").mockReturnValue(false);
    const a = document.createElement("a");
    a.href = BOOKMARKLET;
    document.body.appendChild(a);
    a.click();
    await expect
      .element(page.getByRole("button", { name: "Copy FAQ for FAQMinder" }))
      .toBeVisible();
  });

  it("hands the copy the right payload when the button is tapped", () => {
    let copied: string | undefined;
    let n = 0;
    vi.spyOn(document, "execCommand").mockImplementation((cmd: string) => {
      if (cmd !== "copy") return false;
      n += 1;
      if (n === 1) return false; // auto-try refused (no activation)
      copied = document.querySelector("textarea")?.value;
      return true;
    });

    runDecoded();
    document.querySelector("button")!.click();
    expect(copied).toBe(expected);
  });
});
