import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { findOccurrences, MIN_QUERY_LENGTH, normalizeQuery } from "~/lib/search";
import type { ParsedDoc } from "~/lib/parse";

const SELECT_DEBOUNCE_MS = 120;

/**
 * Finding things in a FAQ, from two directions:
 *  - select text in the document -> a pill offers every other occurrence
 *  - type a term (reader header) -> the same results, without having to find an
 *    instance first
 * Both land in the same sheet, whose header IS the query input — so a selection
 * arrives pre-filled and stays editable.
 *
 * `open` is owned by the reader, because the header button opens it too.
 */
export function DocumentSearch({
  doc,
  scrollRef,
  open,
  onOpenChange,
}: {
  doc: ParsedDoc;
  scrollRef: RefObject<HTMLElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const occurrences = useMemo(() => findOccurrences(doc, query), [doc, query]);
  const label = normalizeQuery(query);
  const close = () => onOpenChange(false);

  function jump(blockId: number) {
    const el = scrollRef.current;
    const block = el?.querySelector<HTMLElement>(`[data-block-id="${blockId}"]`);
    if (!el || !block) return;
    const delta = block.getBoundingClientRect().top - el.getBoundingClientRect().top - 8;
    el.scrollTo({ top: el.scrollTop + delta, behavior: "smooth" });
    block.classList.remove("reader-flash");
    void block.offsetWidth; // restart the animation
    block.classList.add("reader-flash");
    onOpenChange(false);
    setQuery("");
    document.getSelection()?.removeAllRanges();
  }

  return (
    <>
      {!open && occurrences.length > 0 && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
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
        <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/50" onClick={close}>
          <div
            className="flex max-h-[70dvh] flex-col rounded-t-xl bg-neutral-900"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-neutral-800 p-3">
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && close()}
                placeholder="Search this FAQ"
                aria-label="Search this FAQ"
                enterKeyHint="search"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded bg-neutral-800 px-2 py-1.5 text-neutral-100 placeholder:text-neutral-500"
                // 16px is load-bearing, not styling: iOS zooms the viewport when
                // focusing an input smaller than this, burying the document behind
                // the keyboard. Fixing it here keeps pinch-zoom available, which
                // `maximum-scale=1` on the viewport would have destroyed.
                style={{ fontSize: "16px" }}
              />
              <button
                type="button"
                aria-label="Close search"
                className="shrink-0 rounded p-1 text-neutral-400 active:text-neutral-100"
                onClick={close}
              >
                ✕
              </button>
            </div>

            <div className="px-4 py-2 text-xs text-neutral-500" role="status">
              {label.length < MIN_QUERY_LENGTH
                ? `Type at least ${MIN_QUERY_LENGTH} characters`
                : `${occurrences.length} ${occurrences.length === 1 ? "match" : "matches"}`}
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
