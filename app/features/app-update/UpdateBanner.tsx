import { useEffect, useState } from "react";
import { useAppUpdate } from "./useAppUpdate";

const BANNER_HEIGHT = "2.25rem";

/**
 * Slim bar pinned above everything when the deployed build has moved on. It's fixed
 * (so it can't be scrolled past) and publishes its height as --app-banner, which the
 * screens use to stay off it — the var defaults to 0px, so nothing shifts when the
 * banner is absent.
 */
export function UpdateBanner() {
  const { available, apply } = useAppUpdate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (available) root.style.setProperty("--app-banner", BANNER_HEIGHT);
    else root.style.removeProperty("--app-banner");
    return () => {
      root.style.removeProperty("--app-banner");
    };
  }, [available]);

  if (!available) return null;

  return (
    <div
      role="status"
      data-update-banner
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-sky-700 px-3 text-sm text-white"
      style={{ height: BANNER_HEIGHT, paddingTop: "env(safe-area-inset-top)" }}
    >
      <span className="min-w-0 truncate">A new version is available.</span>
      <button
        type="button"
        onClick={() => {
          setBusy(true);
          void apply();
        }}
        disabled={busy}
        className="shrink-0 rounded bg-white px-2 py-0.5 font-medium text-sky-900 active:bg-neutral-200 disabled:opacity-60"
      >
        {busy ? "Updating…" : "Update"}
      </button>
    </div>
  );
}
