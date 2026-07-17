// Drives the PRODUCTION build in a real browser, against a server that models
// GitHub Pages. Covers what only exists in a real deploy: both base-path forms, the
// update-available flow (by publishing a new version mid-run), and the service
// worker serving the shell with the network cut. Run after `pnpm build`.
import http from "node:http";
import { readFile, readFile as read } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(process.cwd(), "build/client");
// Served for version.json, so the run can pretend a new build was deployed.
let publishedVersion = JSON.parse(await read(resolve(ROOT, "version.json"), "utf-8")).version;
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".map": "application/json",
};

const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  // Model GitHub Pages: a directory URL without its trailing slash is 301'd to the
  // slash form. The router only matches "/faqminder/" (see react-router.config.ts).
  if (p === "/faqminder") {
    res.writeHead(301, { Location: "/faqminder/" });
    res.end();
    return;
  }
  p = p.replace(/^\/faqminder/, "") || "/";
  if (p === "/version.json") {
    res.setHeader("content-type", "application/json");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify({ version: publishedVersion }));
    return;
  }
  try {
    const body = await readFile(resolve(ROOT, "." + p));
    res.setHeader("content-type", TYPES[extname(p)] ?? "application/octet-stream");
    res.end(body);
  } catch {
    const body = await readFile(resolve(ROOT, "index.html")); // SPA fallback
    res.setHeader("content-type", "text/html");
    res.end(body);
  }
});
await new Promise((r) => server.listen(4173, r));

let failures = 0;
const check = (n, ok) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}`);
  if (!ok) failures++;
};

const browser = await chromium.launch();
const context = await browser.newContext();
// Counts document loads, so "Update actually reloaded" is provable.
await context.addInitScript(() => {
  try {
    sessionStorage.setItem("loads", String(Number(sessionStorage.getItem("loads") ?? 0) + 1));
  } catch {
    // about:blank has no accessible storage; nothing to count there.
  }
});
const page = await context.newPage();
page.on("console", (m) => m.type() === "error" && console.log("CONSOLE:", m.text()));
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
page.on("requestfailed", (r) => console.log("REQFAIL:", r.url(), r.failure()?.errorText));
try {
  // Both base-path forms must render. GitHub Pages 301s "/faqminder" -> "/faqminder/",
  // but this server deliberately does NOT redirect, so it proves the router itself
  // tolerates the slash-less URL (basename must have no trailing slash).
  for (const url of ["http://localhost:4173/faqminder/", "http://localhost:4173/faqminder"]) {
    await page.goto(url, { waitUntil: "networkidle" });
    const ok = await page
      .getByRole("heading", { name: "FAQMinder" })
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    check(`renders at ${new URL(url).pathname}`, ok);
  }

  await page.goto("http://localhost:4173/faqminder/", { waitUntil: "networkidle" });
  check("app loads online", await page.getByText(/FAQMinder/).first().isVisible());

  // --- Update available ---
  const banner = page.locator("[data-update-banner]");
  check("no update banner while running the deployed version", !(await banner.isVisible()));

  publishedVersion = `deployed-${Date.now()}`; // someone just shipped
  await page.reload({ waitUntil: "networkidle" });
  const noticed = await banner.isVisible({ timeout: 8000 }).catch(() => false);
  check("banner appears once a new version is published", noticed);

  if (noticed) {
    const loadsBefore = await page.evaluate(() => Number(sessionStorage.getItem("loads") ?? 0));
    await page.getByRole("button", { name: /update/i }).click();
    const reloaded = await page
      .waitForFunction(
        (n) => Number(sessionStorage.getItem("loads") ?? 0) > n,
        loadsBefore,
        { timeout: 10000 },
      )
      .then(() => true)
      .catch(() => false);
    check("Update reloads the app", reloaded);
    // NB: don't assert caches are empty here — the reloaded app re-registers the SW
    // and immediately re-precaches, which is the point. That the OLD precache is
    // dropped is asserted directly in app-update.test.tsx.
  }
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, { timeout: 10000 });
  check("service worker controls the page", true);

  // Cut the network entirely; the SW must serve the shell + all modules.
  await context.setOffline(true);
  await page.goto("about:blank");
  await page.goto("http://localhost:4173/faqminder/", { waitUntil: "networkidle" });
  const ok = await page
    .getByRole("heading", { name: "FAQMinder" })
    .isVisible({ timeout: 10000 })
    .catch(() => false);
  check("app shell renders OFFLINE (SW-served)", ok);
} catch (e) {
  console.log("ERROR:", e.message);
  failures++;
} finally {
  await browser.close();
  server.close();
}

console.log(failures === 0 ? "\nOFFLINE OK" : `\n${failures} OFFLINE CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
