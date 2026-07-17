import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAQ_CLIP_MARKER } from "~/lib/filename";
import { BOOKMARKLET } from "./bookmarklet";

// The emitted javascript: URL, minus the scheme — what a bookmark actually runs.
const code = BOOKMARKLET.slice("javascript:".length);
const runBookmarklet = () => (0, eval)(code);

const title = "Final Fantasy VII - Guide and Walkthrough - PS1 - By Z - GameFAQs";
const expected = `${FAQ_CLIP_MARKER}\t${title}\nINTRO\nline two`;

// Runs in real Chromium — a real JS engine parsing/executing the FLATTENED string exactly
// as a clicked bookmark would, against a real DOM. What it can NOT assert is the actual
// clipboard write succeeding: headless has no user gesture, so the real execCommand("copy")
// returns false and clipboard read/write is permission-denied. That path — and WebKit /
// iOS Firefox gesture timing especially — is only verifiable on a device. So we force the
// copy mechanism and assert the payload it's handed.
describe("bookmarklet (real browser)", () => {
  beforeEach(() => {
    document.title = title;
    document.body.innerHTML = '<pre class="faqtext">INTRO\nline two</pre>';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    delete (navigator as { clipboard?: unknown }).clipboard;
    document.querySelectorAll("textarea, div").forEach((el) => el.remove());
  });

  it("executes without a SyntaxError and hands the copy the right payload", () => {
    vi.spyOn(document, "execCommand").mockReturnValue(false); // force the writeText path
    const writeText = vi.fn((_t: string) => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    expect(runBookmarklet).not.toThrow();
    expect(writeText).toHaveBeenCalledWith(expected);
  });
});
