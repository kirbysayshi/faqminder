import { useCallback, useEffect, useRef, useState } from "react";
import { APP_VERSION, applyUpdate, fetchRemoteVersion } from "~/domains/version";

// Don't hammer the server when a phone rapidly blurs/focuses.
const MIN_INTERVAL_MS = 10_000;

/**
 * Watches for the deployed app moving on underneath us. Re-checks whenever the app
 * comes back to the foreground — on mobile a tab may sit backgrounded for days, and
 * waiting for the *next* load to pick up a new build is exactly the staleness we're
 * avoiding.
 */
export function useAppUpdate(): { available: boolean; apply: () => Promise<void> } {
  const [available, setAvailable] = useState(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (available) return; // already know; stop asking
    let cancelled = false;

    async function check() {
      const now = Date.now();
      if (now - lastCheck.current < MIN_INTERVAL_MS) return;
      lastCheck.current = now;
      const remote = await fetchRemoteVersion();
      if (!cancelled && remote && remote !== APP_VERSION) setAvailable(true);
    }

    const onForeground = () => {
      if (document.visibilityState === "visible") void check();
    };

    void check();
    document.addEventListener("visibilitychange", onForeground);
    window.addEventListener("focus", onForeground);
    window.addEventListener("pageshow", onForeground); // bfcache restore

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onForeground);
      window.removeEventListener("focus", onForeground);
      window.removeEventListener("pageshow", onForeground);
    };
  }, [available]);

  return { available, apply: useCallback(() => applyUpdate(), []) };
}
