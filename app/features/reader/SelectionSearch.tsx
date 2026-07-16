import { useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";
import { findOccurrences, MIN_QUERY_LENGTH, normalizeQuery } from "~/lib/search";
import type { ParsedDoc } from "~/lib/parse";

const SELECT_DEBOUNCE_MS = 120;

// Highlight-to-find: when the user selects text in the reader, surface every other
// occurrence and let them jump to it — replacing the painful mobile browser find.
export function SelectionSearch({
  doc,
  scrollRef,
}: {
  doc: ParsedDoc;
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onSelectionChange() {
      if (open) return; // don't let interacting with our UI clobber the query
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const el = scrollRef.current;
        const sel = document.getSelection();
        const text = sel ? sel.toString() : "";
        const inside = !!(el && sel?.anchorNode && el.contains(sel.anchorNode));
        setQuery(inside && normalizeQuery(text).length >= MIN_QUERY_LENGTH ? text : "");
      }, SELECT_DEBOUNCE_MS);
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
  }, [open, scrollRef]);

  const occurrences = useMemo(() => findOccurrences(doc, query), [doc, query]);

  function jump(blockId: number) {
    const el = scrollRef.current;
    const block = el?.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
    if (!el || !block) return;
    const delta = block.getBoundingClientRect().top - el.getBoundingClientRect().top - 8;
    el.scrollTo({ top: el.scrollTop + delta, behavior: "smooth" });
    block.classList.remove("reader-flash");
    void block.offsetWidth; // restart the animation
    block.classList.add("reader-flash");
    setOpen(false);
    setQuery("");
    document.getSelection()?.removeAllRanges();
  }

  if (occurrences.length === 0) return null;
  const label = normalizeQuery(query);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed inset-x-0 bottom-4 z-20 mx-auto flex w-max max-w-[90%] items-center gap-2 rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 shadow-lg"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <span className="truncate">Find “{label}”</span>
          <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs text-neutral-100">
            {occurrences.length}
          </span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="flex max-h-[70dvh] flex-col rounded-t-xl bg-neutral-900"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-neutral-800 px-4 py-3">
              <span className="min-w-0 truncate text-sm">
                <span className="text-neutral-400">{occurrences.length} matches for </span>
                <span className="font-medium">“{label}”</span>
              </span>
              <button
                type="button"
                aria-label="Close"
                className="rounded p-1 text-neutral-400 active:text-neutral-100"
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            <ul className="min-h-0 flex-1 divide-y divide-neutral-800 overflow-auto">
              {occurrences.map((o, i) => (
                <li key={`${o.line}:${o.column}:${i}`}>
                  <button
                    type="button"
                    onClick={() => jump(o.blockId)}
                    className="flex w-full items-baseline gap-2 px-4 py-3 text-left active:bg-neutral-800"
                  >
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-neutral-600">
                      {o.line + 1}
                    </span>
                    <span className="min-w-0 truncate font-mono text-xs text-neutral-400">
                      {o.before}
                      <mark className="bg-yellow-300/30 text-neutral-100">{o.match}</mark>
                      {o.after}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
