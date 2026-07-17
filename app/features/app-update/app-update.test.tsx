import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "~/domains/db";
import { APP_VERSION, clearAppShellCache } from "~/domains/version";
import { UpdateBanner } from "./UpdateBanner";

// __APP_VERSION__ is defined as "test" under Vitest (see vite.config.ts).
const unregister = vi.fn().mockResolvedValue(true);
const cacheDelete = vi.fn().mockResolvedValue(true);

function serveVersion(version: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version }) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "serviceWorker", {
    value: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) },
    configurable: true,
  });
  vi.stubGlobal("caches", {
    keys: vi.fn().mockResolvedValue(["precache-v1"]),
    delete: cacheDelete,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("UpdateBanner", () => {
  it("stays hidden when the deployed version matches", async () => {
    serveVersion(APP_VERSION);
    render(<UpdateBanner />);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("stays hidden when the server can't be reached (offline is not news)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<UpdateBanner />);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers an update when the deployed version has moved on", async () => {
    serveVersion("deadbeef-999");
    render(<UpdateBanner />);
    expect(await screen.findByRole("status")).toHaveTextContent(/new version is available/i);
    // Asks the server without a cached answer, which could never report a new build.
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("version.json"), {
      cache: "no-store",
    });
  });

  it("re-checks when the app returns to the foreground", async () => {
    serveVersion(APP_VERSION);
    render(<UpdateBanner />);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    serveVersion("deadbeef-999"); // deployed while we were backgrounded
    // The throttle is time-based; jump past it rather than waiting 30s.
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    window.dispatchEvent(new Event("focus"));

    expect(await screen.findByRole("status")).toBeInTheDocument();
  });

  it("offers an Update button", async () => {
    serveVersion("deadbeef-999");
    render(<UpdateBanner />);
    expect(await screen.findByRole("button", { name: /update/i })).toBeInTheDocument();
  });
});

// The reload itself isn't asserted: jsdom won't let location.reload be replaced,
// which is why applyUpdate() is just clearAppShellCache() + reload.
describe("clearAppShellCache", () => {
  it("drops the service worker and every cache", async () => {
    await clearAppShellCache();
    expect(unregister).toHaveBeenCalled(); // no stale service worker survives
    expect(cacheDelete).toHaveBeenCalledWith("precache-v1"); // no stale app code
  });

  it("never touches the user's library", async () => {
    await db.faqs.put({
      id: "keep", title: "My FAQ", source: "f.txt", addedAt: 1,
      byteSize: 1, lineCount: 1, encoding: "utf-8", repaired: false,
    });
    await clearAppShellCache();
    expect(await db.faqs.get("keep")).toMatchObject({ title: "My FAQ" });
  });

  it("still resolves when caches/serviceWorker are unavailable", async () => {
    vi.stubGlobal("caches", undefined);
    Object.defineProperty(navigator, "serviceWorker", { value: undefined, configurable: true });
    await expect(clearAppShellCache()).resolves.toBeUndefined();
  });
});
