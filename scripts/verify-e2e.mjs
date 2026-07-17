// Real-browser end-to-end verification against the running dev server.
// Usage: PORT=5174 node scripts/verify-e2e.mjs
import { chromium } from "playwright";
import { resolve } from "node:path";

const PORT = process.env.PORT ?? "5174";
const URL = `http://localhost:${PORT}/faqminder/`;
const FIXTURE = resolve(
  process.cwd(),
  "fixtures",
  "Ace Combat 3_ Electrosphere - Guide and Walkthrough - PlayStation - By Shotgunnova - GameFAQs.txt",
);

let failures = 0;
function check(name, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures++;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 780 } }); // phone-ish
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

try {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => indexedDB.deleteDatabase("faqminder"));
  await page.reload({ waitUntil: "networkidle" });

  // --- Import ---
  check("library empty state", await page.getByText(/No FAQs yet/i).isVisible());
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.waitForSelector("[data-reader-scroll]", { timeout: 10000 });
  check("reader opens after import", await page.locator("[data-block-id]").count() > 20);
  check("title from filename", (await page.locator("h1").innerText()).includes("Ace Combat 3"));

  // --- Formatting ---
  const scroll = page.locator("[data-reader-scroll]");
  const before = await scroll.evaluate((el) => el.style.fontSize);
  await page.getByLabel("Increase text size").click();
  const after = await scroll.evaluate((el) => el.style.fontSize);
  check("font size steps up", parseInt(after) === parseInt(before) + 1);

  // --- Reflow toggle (pin one prose block by id; its label flips on toggle) ---
  const proseId = await page.evaluate(() =>
    document
      .querySelector('div[data-block-id]:has(button[aria-label*="soft-wrap"])')
      ?.getAttribute("data-block-id"),
  );
  check("prose reflow toggle present", proseId != null);
  const blockSel = `[data-block-id="${proseId}"]`;
  check("prose renders as <p> by default", (await page.locator(`${blockSel} p`).count()) === 1);
  await page.locator(`${blockSel} button`).click();
  await page.locator(`${blockSel} pre`).waitFor({ timeout: 3000 });
  check("toggling reflow off renders <pre>", (await page.locator(`${blockSel} pre`).count()) === 1);

  // --- Selection search ---
  const selected = await page.evaluate(() => {
    const el = document.querySelector("[data-reader-scroll]");
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.textContent.toLowerCase().indexOf("mission");
      if (i !== -1) {
        const r = document.createRange();
        r.setStart(node, i);
        r.setEnd(node, i + 7);
        const s = getSelection();
        s.removeAllRanges();
        s.addRange(r);
        return true;
      }
    }
    return false;
  });
  check("found a word to select", selected);
  const pill = page.getByRole("button", { name: /find/i });
  await pill.waitFor({ timeout: 5000 });
  check("selection surfaces a find pill", await pill.isVisible());
  await pill.click();
  check("match sheet opens", await page.getByText(/matches for/i).isVisible());
  const scrollBefore = await scroll.evaluate((el) => el.scrollTop);
  await page.locator("ul li button").last().click();
  await page.waitForTimeout(600);
  check("tapping a match jumps (scroll moved)", (await scroll.evaluate((el) => el.scrollTop)) !== scrollBefore);

  // --- Scroll bookmark across reload ---
  await scroll.evaluate((el) => el.scrollTo(0, 1500));
  await page.waitForTimeout(500); // throttled save
  const savedTop = await scroll.evaluate((el) => el.scrollTop);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("[data-reader-scroll]");
  await page.waitForTimeout(300);
  const restored = await page.locator("[data-reader-scroll]").evaluate((el) => el.scrollTop);
  check(`scroll restored on reload (saved ${savedTop}, restored ${restored})`, restored > 500);
  const fontAfterReload = await page.locator("[data-reader-scroll]").evaluate((el) => el.style.fontSize);
  check(`per-document font persisted across reload (${fontAfterReload})`, fontAfterReload === "15px");

  // --- Switch back to library ---
  await page.getByLabel("Back to library").click();
  await page.waitForURL(URL);
  const listLink = page.getByRole("link", { name: /Ace Combat 3/ });
  await listLink.waitFor({ timeout: 5000 });
  check("FAQ persists in library list", await listLink.isVisible());
} finally {
  await browser.close();
}

console.log(failures === 0 ? "\nALL E2E CHECKS PASSED" : `\n${failures} E2E CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
