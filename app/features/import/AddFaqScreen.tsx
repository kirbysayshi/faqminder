import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { addFaq } from "~/domains/library";
import { parsePastedFaq } from "~/lib/filename";
import { BOOKMARKLET } from "./bookmarklet";
import { ImportButton } from "./ImportButton";

// Text inputs are 16px so iOS Safari/Firefox don't zoom the viewport on focus
// (see CLAUDE.md — the zoom buries the page behind the keyboard).
const NO_ZOOM = { fontSize: "16px" } as const;

// Add-FAQ view: paste (the primary no-server path from GameFAQs), plus the copy
// bookmarklet + install help, plus file import as a fallback. Routed to from the
// library header (AddFaqLink).
export function AddFaqScreen() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState("");
  const [titleEdit, setTitleEdit] = useState<string | null>(null);
  // The manual textarea only appears once a clipboard read fails — the happy path is
  // a single "Paste from clipboard" tap.
  const [showTextarea, setShowTextarea] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parsePastedFaq(raw), [raw]);
  const hasBody = parsed.text.trim().length > 0;
  // Title field tracks the derived title until the user edits it.
  const title = titleEdit ?? (raw.trim() ? parsed.title : "");

  async function pasteFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      if (t.trim()) {
        setRaw(t);
        setTitleEdit(null);
        setShowTextarea(false);
        return;
      }
    } catch {
      // permission denied / unsupported — fall through to the manual textarea
    }
    setShowTextarea(true); // reveal the box so they can long-press → Paste
  }

  async function copyBookmarklet() {
    try {
      await navigator.clipboard.writeText(BOOKMARKLET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false); // fall back to manual select of the shown text
    }
  }

  async function save() {
    if (!hasBody || busy) return;
    setBusy(true);
    try {
      const text = parsed.text;
      const id = await addFaq({
        title: title.trim() || parsed.title,
        source: parsed.source,
        text,
        byteSize: new TextEncoder().encode(text).length,
        encoding: "utf-8",
        repaired: false,
      });
      navigate(`/faq/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 p-4">
      <header className="flex items-center gap-3">
        <Link to="/" className="rounded p-1 text-neutral-400 active:text-neutral-200">
          ← Library
        </Link>
        <h1 className="text-xl font-semibold">Add FAQ</h1>
      </header>

      {/* Paste — primary path */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium">Paste a FAQ</h2>
          <button
            type="button"
            onClick={pasteFromClipboard}
            className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 active:bg-neutral-300"
          >
            Paste from clipboard
          </button>
        </div>
        {showTextarea && (
          <>
            <p className="text-sm text-neutral-400">
              Couldn’t read the clipboard automatically — long-press the box below and
              choose <span className="text-neutral-200">Paste</span>.
            </p>
            <textarea
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setTitleEdit(null);
              }}
              autoFocus
              placeholder="Long-press here → Paste…"
              style={NO_ZOOM}
              className="h-40 w-full resize-y rounded-md border border-neutral-700 bg-neutral-900 p-3 font-mono text-neutral-100 placeholder:text-neutral-500"
            />
          </>
        )}
        {!showTextarea && raw.trim() && (
          <p className="text-sm text-neutral-400">
            ✓ Pasted — {parsed.text.split("\n").length} lines.
          </p>
        )}
        {raw.trim() && (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-neutral-400">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitleEdit(e.target.value)}
              style={NO_ZOOM}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100"
            />
          </label>
        )}
        {(raw.trim() || showTextarea) && (
          <button
            type="button"
            onClick={save}
            disabled={!hasBody || busy}
            className="self-start rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 active:bg-neutral-300 disabled:opacity-40"
          >
            {busy ? "Adding…" : "Add to library"}
          </button>
        )}
      </section>

      {/* Bookmarklet — one-tap copy from GameFAQs */}
      <section className="flex flex-col gap-3 border-t border-neutral-800 pt-6">
        <h2 className="font-medium">One-tap copy from GameFAQs</h2>
        <p className="text-sm text-neutral-400">
         This bookmarklet copies the FAQ to the clipboard when executed on a GameFAQs FAQ page.
        </p>
        {/* Desktop install: drag this link to the bookmarks bar (the link text becomes
            the bookmark name). href is set imperatively so React doesn't sanitize the
            javascript: URL; the click is swallowed so tapping it in-app is a no-op. */}
        <a
          ref={(el) => el?.setAttribute("href", BOOKMARKLET)}
          onClick={(e) => e.preventDefault()}
          draggable
          className="inline-flex cursor-grab select-none items-center gap-2 self-start rounded-md border border-dashed border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-100 active:cursor-grabbing"
        >
          <span aria-hidden>↗</span> FAQMinder: Save FAQ
        </a>
        <p className="text-xs text-neutral-500">
          Desktop: drag the above link to your bookmarks bar (or right click it -&gt; Save Bookmark). Mobile: tap to copy the URL below and
          paste it as a new/edited bookmark's address.
        </p>
        <button
          type="button"
          onClick={copyBookmarklet}
          className="self-start rounded-md bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-900 active:bg-neutral-300"
        >
          {copied ? "Copied ✓" : "Copy bookmarklet URL"}
        </button>
        <details className="text-sm text-neutral-400">
          <summary className="cursor-pointer text-neutral-300">
            How do I install it?
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            <p>
              <span className="text-neutral-200">Easiest (desktop):</span> in Safari,
              Firefox, or Chrome on a Mac/PC, save it as a bookmark, then let
              iCloud / Firefox Sync / Chrome Sync carry it to your phone.
            </p>
            <p>
              <span className="text-neutral-200">On iOS:</span> bookmark any page,
              then edit that bookmark and replace its address with the copied URL.
            </p>
          </div>
        </details>
      </section>

      {/* File import — fallback */}
      <section className="flex flex-col gap-3 border-t border-neutral-800 pt-6">
        <h2 className="font-medium">Or import a file</h2>
        <p className="text-sm text-neutral-400">
          Already saved a <code>.txt</code> walkthrough? Load it directly.
        </p>
        <ImportButton label="Choose a .txt file" className="self-start" />
      </section>
    </main>
  );
}
