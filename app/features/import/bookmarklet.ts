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
// Three constraints, each learned the hard way on iOS Firefox:
//   1. NO `//` LINE COMMENTS — BOOKMARKLET flattens newlines into a one-line javascript:
//      URL (bookmark fields strip newlines), and a surviving line comment would swallow
//      the rest of the code. Notes live out here instead.
//   2. NO `#` CHARACTERS — `#` is the URL fragment delimiter, so a bookmark is truncated
//      at the first one. That means rgb() colors, never hex. (A test guards this.)
//   3. COPY MUST HAPPEN INSIDE A USER GESTURE — iOS Firefox runs the bookmarklet itself
//      WITHOUT transient activation, so execCommand("copy") is refused and the async
//      clipboard write rejects. A tap on an injected button IS an activation, so we try an
//      immediate copy (works on Safari/desktop, where the bookmark tap carries activation)
//      and, if that's refused, fall back to a button the user taps.
//
// What it does: read `.faqtext` (jQuery when present, else querySelectorAll), build a
// payload whose header line (marker + page title) parsePastedFaq strips back off, and copy.
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

  const bar =
    "position:fixed;left:0;right:0;top:0;z-index:2147483647;box-sizing:border-box;margin:0;border:0;padding:14px 16px;background:rgb(10,10,10);color:rgb(255,255,255);font:600 16px -apple-system,system-ui,sans-serif;text-align:center;transition:opacity .5s ease";
  const fadeAway = (el: HTMLElement): void => {
    setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 600);
    }, 2200);
  };

  const copyNow = (): boolean => {
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
    return ok;
  };

  const done = "FAQ copied. Open FAQMinder, then Paste.";

  if (copyNow()) {
    const banner = document.createElement("div");
    banner.textContent = done;
    banner.style.cssText = bar;
    document.documentElement.appendChild(banner);
    fadeAway(banner);
    return;
  }

  const btn = document.createElement("button");
  btn.textContent = "Copy FAQ for FAQMinder";
  btn.style.cssText = bar + ";cursor:pointer";
  btn.onclick = function () {
    if (copyNow()) {
      btn.textContent = done;
      btn.disabled = true;
      fadeAway(btn);
    } else {
      btn.textContent = "Couldn't copy — tap to try again";
    }
  };
  document.body.appendChild(btn);
}

// Installable `javascript:` URL. The IIFE source is percent-encoded: a browser decodes a
// javascript: URL before executing it, so encoding makes every URL-special character
// survive being stored in a bookmark — notably `#` (the fragment delimiter, which would
// otherwise truncate the bookmark) but also spaces, quotes, etc. Flatten first so the
// decoded source is still one line even in a browser that strips literal newlines.
// (A test decodes this and runs it, and a real-browser test clicks it as a link.)
const flat = grabAndCopy.toString().replace(/\s*\n\s*/g, " ");
const source = `(${flat})(${JSON.stringify(FAQ_CLIP_MARKER)})`;
export const BOOKMARKLET = "javascript:" + encodeURIComponent(source);
