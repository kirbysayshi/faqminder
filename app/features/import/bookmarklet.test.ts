import { afterEach, describe, expect, it, vi } from "vitest";
import { FAQ_CLIP_MARKER } from "~/lib/filename";
import { BOOKMARKLET, grabAndCopy } from "./bookmarklet";

const title = "Zelda - Guide and Walkthrough - SNES - By Bar - GameFAQs";
const expected = `${FAQ_CLIP_MARKER}\t${title}\nA\nB`;
const done = "FAQ copied. Open FAQMinder, then Paste.";

// jsdom has no `execCommand` at all (calling it throws), so we ASSIGN a fake rather than
// spy on a missing property. It reads the copied text off the textarea at copy time; the
// `returns` fn decides, per call, whether that copy "succeeds".
function mockExec(returns: (call: number) => boolean) {
  let copied: string | undefined;
  let n = 0;
  (document as unknown as { execCommand: unknown }).execCommand = vi.fn((cmd: string) => {
    if (cmd !== "copy") return false;
    n += 1;
    if (returns(n)) {
      copied = document.querySelector("textarea")?.value;
      return true;
    }
    return false;
  });
  return () => copied;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (document as { execCommand?: unknown }).execCommand;
  document.body.innerHTML = "";
  document.title = "";
  // flash div / button live on <html>; clear any strays between tests.
  [...document.documentElement.children].forEach((c) => {
    if (/^(DIV|BUTTON|TEXTAREA)$/.test(c.tagName)) c.remove();
  });
});

describe("grabAndCopy", () => {
  it("copies immediately when the browser allows it (Safari/desktop have activation)", () => {
    document.title = title;
    document.body.innerHTML = '<pre class="faqtext">A\nB</pre>';
    const copied = mockExec(() => true);

    grabAndCopy(FAQ_CLIP_MARKER);

    expect(copied()).toBe(expected);
    expect(document.querySelector("button")).toBeNull(); // no fallback needed
    expect(document.querySelector("div")?.textContent).toBe(done); // banner instead
  });

  it("copies from the injected button's tap — the activation iOS Firefox needs", () => {
    document.title = title;
    document.body.innerHTML = '<div class="faqtext">A\nB</div>';
    const copied = mockExec((call) => call > 1); // auto-try refused, button tap succeeds

    grabAndCopy(FAQ_CLIP_MARKER);
    const btn = document.querySelector("button")!;
    expect(btn.textContent).toBe("Copy FAQ for FAQMinder");

    btn.click();
    expect(copied()).toBe(expected);
    // The button becomes the confirmation (then fades) rather than being replaced.
    expect(btn.textContent).toBe(done);
    expect(btn.disabled).toBe(true);
  });

  it("shows a retry prompt on the button if even its tap can't copy", () => {
    document.body.innerHTML = '<div class="faqtext">x</div>';
    mockExec(() => false); // never succeeds

    grabAndCopy(FAQ_CLIP_MARKER);
    const btn = document.querySelector("button")!;
    btn.click();

    expect(btn.textContent).toBe("Couldn't copy — tap to try again");
  });

  it("alerts and copies nothing when the page has no .faqtext", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const exec = vi.fn(() => false);
    (document as unknown as { execCommand: unknown }).execCommand = exec;

    grabAndCopy(FAQ_CLIP_MARKER);

    expect(alertSpy).toHaveBeenCalledOnce();
    expect(exec).not.toHaveBeenCalled();
    expect(document.querySelector("button")).toBeNull();
  });
});

// What a browser runs: strip the scheme, then percent-decode (a browser decodes a
// javascript: URL before executing it).
const decoded = () => decodeURIComponent(BOOKMARKLET.slice("javascript:".length));

describe("BOOKMARKLET", () => {
  // The encoded form is what gets stored in a bookmark, so it must carry no URL-special
  // characters that a bookmark field would eat: `#` (fragment delimiter — this is what
  // hex colors tripped on iOS Firefox), raw spaces, or newlines.
  it("is percent-encoded and URL-safe (no raw #, space, or newline)", () => {
    expect(BOOKMARKLET.startsWith("javascript:")).toBe(true);
    const enc = BOOKMARKLET.slice("javascript:".length);
    expect(enc).not.toMatch(/[#\s]/);
  });

  it("round-trips: the decoded source is valid, parseable JS", () => {
    expect(() => new Function(decoded())).not.toThrow();
  });

  it("runs once decoded — injects the Copy button in a headless DOM", () => {
    document.title = title;
    document.body.innerHTML = '<div class="faqtext">A\nB</div>';
    expect(() => (0, eval)(decoded())).not.toThrow();
    expect(document.querySelector("button")?.textContent).toBe("Copy FAQ for FAQMinder");
  });

  it("injects the shared marker so it can't drift from parsePastedFaq", () => {
    expect(decoded()).toContain(JSON.stringify(FAQ_CLIP_MARKER));
  });
});
