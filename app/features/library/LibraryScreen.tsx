import type { ReactNode } from "react";
import { Link } from "react-router";
import { deleteFaq, useFaqList } from "~/domains/library";
import { parseFaqFilename } from "~/lib/filename";

// FAQ picker / switcher. `importSlot` is composed in by the route (keeps the
// library and import features independent — ADR 0001).
export function LibraryScreen({ importSlot }: { importSlot?: ReactNode }) {
  const faqs = useFaqList();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col p-4">
      <header className="flex items-center justify-between gap-3 pb-4">
        <h1 className="text-xl font-semibold">FAQMiner</h1>
        {importSlot}
      </header>

      {faqs === undefined ? null : faqs.length === 0 ? (
        <p className="mt-16 text-center text-neutral-400">
          No FAQs yet. Tap <span className="text-neutral-200">Add FAQ</span> to import a
          .txt walkthrough.
        </p>
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
