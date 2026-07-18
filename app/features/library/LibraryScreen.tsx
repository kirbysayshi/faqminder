import type { ReactNode } from "react";
import { Link } from "react-router";
import { deleteFaq, useFaqList } from "~/domains/library";
import { parseFaqFilename } from "~/lib/filename";

// The iOS system Share glyph (up-arrow out of a tray). Decorative — it reinforces the
// "Share button" wording, which already names it, so it's aria-hidden.
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="inline-block h-[1.1em] w-[1.1em] align-[-0.2em]"
    >
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M8 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2" />
    </svg>
  );
}

// FAQ picker / switcher. `importSlot` is composed in by the route (keeps the
// library and import features independent — ADR 0001).
export function LibraryScreen({ importSlot }: { importSlot?: ReactNode }) {
  const faqs = useFaqList();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col p-4">
      <header className="flex items-center justify-between gap-3 pb-4">
        <h1 className="text-xl font-semibold">FAQMinder</h1>
        {importSlot}
      </header>

      {faqs === undefined ? null : faqs.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center text-neutral-400">
          <p>No FAQs yet.</p>
          <p>
            This app is offline-first and stores data locally. It's best experienced if you
            Add to Home Screen via the Share button <ShareIcon />.
          </p>
          <a
            href="https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline underline-offset-2 hover:text-neutral-200 active:text-neutral-200"
          >
            Turn a website into an app in Safari on iPhone
          </a>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-800">
          {faqs.map((faq) => {
            const { descriptor } = parseFaqFilename(faq.source);
            return (
              <li key={faq.id} className="flex items-center gap-2">
                <Link to={`/faq/${faq.id}`} className="min-w-0 flex-1 py-3">
                  <div className="truncate font-medium">{faq.title}</div>
                  {descriptor && (
                    <div className="truncate text-sm text-neutral-400">{descriptor}</div>
                  )}
                </Link>
                <button
                  type="button"
                  aria-label={`Delete ${faq.title}`}
                  className="shrink-0 rounded p-2 text-neutral-500 active:text-red-400"
                  onClick={() => {
                    if (confirm(`Delete "${faq.title}"?`)) void deleteFaq(faq.id);
                  }}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
