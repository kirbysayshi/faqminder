import { afterEach, describe, expect, it, vi } from "vitest";
import { FAQ_CLIP_MARKER } from "~/lib/filename";
import { BOOKMARKLET, grabAndCopy } from "./bookmarklet";

// grabAndCopy is the function the bookmarklet stringifies. jsdom's execCommand is a
// no-op (returns false / throws), so copying always falls through to clipboard.writeText
// here — which is exactly the branch we spy on.
function stubClipboard() {
  const writeText = vi.fn((_text: string) => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { clipboard?: unknown }).clipboard;
  document.body.innerHTML = "";
  document.title = "";
});

describe("grabAndCopy", () => {
  it("copies marker + page title + .faqtext body", () => {
    document.title = "Zelda - Guide and Walkthrough - SNES - By Bar - GameFAQs";
    document.body.innerHTML = '<pre class="faqtext">STEP 1\nfoo\nbar</pre>';
    const writeText = stubClipboard();

    grabAndCopy(FAQ_CLIP_MARKER);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]![0]).toBe(
      `${FAQ_CLIP_MARKER}\tZelda - Guide and Walkthrough - SNES - By Bar - GameFAQs\nSTEP 1\nfoo\nbar`,
    );
  });

  it("alerts and copies nothing when the page has no .faqtext", () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const writeText = stubClipboard();

    grabAndCopy(FAQ_CLIP_MARKER);

    expect(alert).toHaveBeenCalledOnce();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("leaves the page clean — the scratch textarea is removed", () => {
    document.body.innerHTML = '<div class="faqtext">x</div>';
    stubClipboard();
    grabAndCopy(FAQ_CLIP_MARKER);
    expect(document.querySelector("textarea")).toBeNull();
  });
});

describe("BOOKMARKLET", () => {
  it("is a javascript: URL whose body is valid, parseable JS", () => {
    expect(BOOKMARKLET.startsWith("javascript:")).toBe(true);
    // Parsing (not running) proves the stringified function is syntactically valid —
    // the whole point of building it from a real function instead of a hand-minified blob.
    expect(() => new Function(BOOKMARKLET.slice("javascript:".length))).not.toThrow();
  });

  it("injects the shared marker so it can't drift from parsePastedFaq", () => {
    expect(BOOKMARKLET).toContain(JSON.stringify(FAQ_CLIP_MARKER));
  });
});
