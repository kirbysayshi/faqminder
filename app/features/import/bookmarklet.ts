import { FAQ_CLIP_MARKER } from "~/lib/filename";

// The routine the bookmarklet runs *on the GameFAQs page* — NOT in our bundle. It's a
// real function (so TypeScript checks it and a unit test can execute it against a DOM);
// BOOKMARKLET below is just its `.toString()` with the marker injected as an argument.
//
// Because the body is stringified and run elsewhere, it may use ONLY browser globals and
// its `marker` parameter — no imports, no closure over module scope, since `.toString()`
// drops all of that. Keep the syntax plain (no spread/async) so the minifier can't inject
// a helper the stringified copy would then reference out of scope.
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
  // Header line carries the page title so the paste derives the same title/descriptor
  // as a file import; parsePastedFaq strips it back off.
  const payload = marker + "\t" + document.title + "\n" + body;

  const toast = (s: string): void => {
    const d = document.createElement("div");
    d.textContent = s;
    d.style.cssText =
      "position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#0a0a0a;color:#fff;font:14px -apple-system,system-ui,sans-serif;padding:12px 16px;text-align:center";
    document.documentElement.appendChild(d);
    setTimeout(() => d.remove(), 2600);
  };

  // Copy is sync-execCommand-first: it runs inside the tap gesture, which WebKit / iOS
  // Firefox require. Async clipboard.writeText is only the fallback (a bookmarklet is a
  // tick removed from the gesture, so WebKit may reject the async write).
  const ta = document.createElement("textarea");
  ta.value = payload;
  ta.readOnly = true;
  ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    ta.setSelectionRange(0, payload.length); // iOS: .select() alone doesn't always select
  } catch {
    // some engines throw on a programmatic range set — .select() already covers it
  }
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();

  const done = "FAQ copied ✓  Open FAQMinder → Paste";
  if (ok) {
    toast(done);
  } else if (navigator.clipboard?.writeText) {
    navigator.clipboard
      .writeText(payload)
      .then(() => toast(done), () => alert("FAQMinder: couldn't copy to the clipboard."));
  } else {
    alert("FAQMinder: clipboard unavailable in this browser.");
  }
}

// Installable `javascript:` URL. Wrapping the stringified function in parens makes it an
// IIFE; the marker is passed as its argument so lib/filename stays the single source of
// truth. Emitted from the compiled function body, so it's valid JS by construction.
export const BOOKMARKLET = `javascript:(${grabAndCopy.toString()})(${JSON.stringify(
  FAQ_CLIP_MARKER,
)})`;
