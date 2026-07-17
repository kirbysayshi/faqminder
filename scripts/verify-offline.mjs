// Verifies the production build works offline via the service worker.
// Serves build/client under /faqminder/, lets the SW install, then cuts the
// network and reloads — the app shell must still load. Run after `pnpm build`.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(process.cwd(), "build/client");
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
      .getByRole("heading", { name: "FAQMiner" })
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    check(`renders at ${new URL(url).pathname}`, ok);
  }

  await page.goto("http://localhost:4173/faqminder/", { waitUntil: "networkidle" });
  check("app loads online", await page.getByText(/FAQMiner/).first().isVisible());
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, { timeout: 10000 });
  check("service worker controls the page", true);

  // Cut the network entirely; the SW must serve the shell + all modules.
  await context.setOffline(true);
  await page.goto("about:blank");
  await page.goto("http://localhost:4173/faqminder/", { waitUntil: "networkidle" });
  const ok = await page
    .getByRole("heading", { name: "FAQMiner" })
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
