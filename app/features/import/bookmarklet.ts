import { FAQ_CLIP_MARKER } from "~/lib/filename";

// The routine the bookmarklet runs *on the GameFAQs page* — NOT in our bundle. It's a
// real function (so TypeScript checks it and a unit test can execute it against a DOM);
// BOOKMARKLET below is its `.toString()`, flattened to one line, with the marker injected
// as an argument.
//
// Because the body is stringified and run elsewhere, it may use ONLY browser globals and
// its `marker` parameter — no imports, no closure over module scope, since `.toString()`
// drops all of that.
//
// Keep the body FREE OF `//` LINE COMMENTS: BOOKMARKLET flattens newlines to build a
// one-line `javascript:` URL (bookmark fields strip newlines), and a surviving line
// comment would swallow everything after it. Notes therefore live out here, not inside.
//
// What it does: read `.faqtext` (via jQuery when the page has it, else querySelectorAll),
// prepend a header line (marker + page title, which parsePastedFaq strips back off so the
// paste derives the same title/descriptor as a file import), and copy. Copy is
// sync-`execCommand`-first because that runs inside the tap gesture WebKit / iOS Firefox
// require; async `clipboard.writeText` is only the fallback (a bookmarklet is a tick
// removed from the gesture, so WebKit may reject the async write).
export function grabAndCopy(marker: string): void {
  const jq = (window as unknown as { jQuery?: (s: string) => { text(): string } }).jQuery;
  let body = "";
  if (jq) {
    body = jq(".faqtext").text();
  } else {
    const parts: string[] = [];
    document.querySelectorAll(".faqtext").forEach((e) => parts.push(e.textContent ?? ""));
    body = parts.join("\n");
  }
  if (!body) {
    alert("FAQMinder: no FAQ text (.faqtext) found on this page.");
    return;
  }
  const payload = marker + "\t" + document.title + "\n" + body;

  const toast = (s: string): void => {
    const d = document.createElement("div");
    d.textContent = s;
    d.style.cssText =
      "position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#0a0a0a;color:#fff;font:14px -apple-system,system-ui,sans-serif;padding:12px 16px;text-align:center";
    document.documentElement.appendChild(d);
    setTimeout(() => d.remove(), 2600);
  };

  const ta = document.createElement("textarea");
  ta.value = payload;
  ta.readOnly = true;
  ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    ta.setSelectionRange(0, payload.length);
  } catch (e) {
    void e;
  }
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (e) {
    ok = false;
    void e;
  }
  ta.remove();

  const done = "FAQ copied. Open FAQMinder, then Paste.";
  if (ok) {
    toast(done);
  } else if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(payload).then(
      function () {
        toast(done);
      },
      function () {
        alert("FAQMinder: couldn't copy to the clipboard.");
      },
    );
  } else {
    alert("FAQMinder: clipboard unavailable in this browser.");
  }
}

// Installable `javascript:` URL. Flatten newlines+indentation to a single line (bookmark
// fields strip newlines, which would break a multi-line body). Wrapping the function in
// parens makes it an IIFE; the marker is passed as its argument so lib/filename stays the
// single source of truth. String literals hold no newlines, so flattening is lossless.
const flat = grabAndCopy.toString().replace(/\s*\n\s*/g, " ");
export const BOOKMARKLET = `javascript:(${flat})(${JSON.stringify(FAQ_CLIP_MARKER)})`;
