/** This build's identity (git sha + build time; `<sha>-dev` while developing). */
export const APP_VERSION = __APP_VERSION__;

export const VERSION_URL = `${import.meta.env.BASE_URL}version.json`;

/**
 * The version the server is currently publishing, or null if it can't be reached.
 * `no-store` because a cached answer can never report a new version. Failures are
 * silent by design: this is an offline-first app, and being offline is not news.
 */
export async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const res = await fetch(VERSION_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const version = (data as { version?: unknown } | null)?.version;
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

/**
 * Drops the service worker and every Cache Storage entry, so the next load fetches
 * the new app instead of replaying a stale precache.
 *
 * IndexedDB is deliberately untouched: it holds the user's FAQ library.
 */
export async function clearAppShellCache(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if ("caches" in globalThis) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // Swallow: a failed cleanup must not strand the user on the old code.
  }
}

/**
 * Clear, then reload. This is the whole point: with `skipWaiting` a new service
 * worker activates immediately, but the page keeps running the old code until
 * something forces it — otherwise the update only lands on the *next* load.
 */
export async function applyUpdate(): Promise<void> {
  await clearAppShellCache();
  location.reload();
}
