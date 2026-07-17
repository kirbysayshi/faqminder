/**
 * Per-document reader options. A sheet rather than more header buttons: these are
 * set-once-and-forget, unlike text size.
 */
export function ReaderOptions({
  open,
  onOpenChange,
  artFit,
  onArtFitChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artFit: boolean;
  onArtFitChange: (fit: boolean) => void;
}) {
  if (!open) return null;
  const close = () => onOpenChange(false);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/50" onClick={close}>
      <div
        className="rounded-t-xl bg-neutral-900"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <span className="text-sm font-medium">Options</span>
          <button
            type="button"
            aria-label="Close options"
            className="rounded p-1 text-neutral-400 active:text-neutral-100"
            onClick={close}
          >
            ✕
          </button>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4">
          <span className="min-w-0">
            <span className="block text-sm text-neutral-100">Fit diagrams to screen</span>
            <span className="block text-xs text-neutral-500">
              Shrink ASCII art so it fits, instead of scrolling sideways. Pinch to zoom in.
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={artFit}
            onChange={(e) => onArtFitChange(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-sky-500"
          />
        </label>
      </div>
    </div>
  );
}
