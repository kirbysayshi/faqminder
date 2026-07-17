// Layout/visual check in a real browser (jsdom has no layout, so this is the only
// place wrapping can actually be verified). Imports a fixture, then asserts prose
// wraps to the viewport and nothing overflows horizontally. Writes screenshots to
// scratch-shots/ for eyeballing.
// Usage: PORT=5174 node scripts/verify-layout.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const PORT = process.env.PORT ?? "5174";
const URL = `http://localhost:${PORT}/faqminder/`;
const FIXTURE = resolve(
  process.cwd(),
  "fixtures",
  "Dragon Warrior IV - Guide and Walkthrough - NES - By Ramina - GameFAQs.txt",
);
const SHOTS = resolve(process.cwd(), "scratch-shots");
mkdirSync(SHOTS, { recursive: true });

let failures = 0;
const check = (n, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${extra ? ` — ${extra}` : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 800 } }); // phone
try {
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => indexedDB.deleteDatabase("faqminder"));
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.waitForSelector("[data-reader-scroll]", { timeout: 15000 });
  await page.waitForTimeout(500);

  const scroll = page.locator("[data-reader-scroll]");

  // 1. The reader itself must never scroll horizontally.
  const h = await scroll.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
  check("reader does not scroll horizontally", h.sw <= h.cw + 1, `scrollWidth=${h.sw} clientWidth=${h.cw}`);

  // 2. No prose paragraph's TEXT may overflow its box (scrollWidth, not the box
  //    rect — the <p> box always sits at the container edge and proves nothing).
  const prose = await page.evaluate(() => {
    const el = document.querySelector("[data-reader-scroll]");
    const ps = [...el.querySelectorAll("p")];
    const over = ps.filter((p) => p.scrollWidth > p.clientWidth + 1);
    return {
      count: ps.length,
      over: over.length,
      sample: over.slice(0, 2).map((p) => p.textContent.slice(0, 40)),
    };
  });
  check("prose paragraphs present", prose.count > 0, `${prose.count} reflowed`);
  check("no prose text overflows", prose.over === 0, JSON.stringify(prose.sample));

  // 3. Reflowed prose must actually wrap to multiple visual lines.
  const wrapped = await page.evaluate(() => {
    const p = document.querySelector("[data-reader-scroll] p");
    if (!p) return 0;
    const lh = parseFloat(getComputedStyle(p).lineHeight) || 20;
    return Math.round(p.getBoundingClientRect().height / lh);
  });
  check("prose wraps to multiple lines", wrapped > 1, `${wrapped} lines`);

  // 4. Sibling definition items must share a left edge. Measure the RENDERED TEXT
  //    (a Range over the first character) — the <p> box is always at the container
  //    edge regardless of text-indent, so measuring the element proves nothing.
  const lefts = await page.evaluate(() => {
    const el = document.querySelector("[data-reader-scroll]");
    const textLeft = (p) => {
      const r = document.createRange();
      r.setStart(p.firstChild, 0);
      r.setEnd(p.firstChild, 1);
      return Math.round(r.getBoundingClientRect().left);
    };
    return [...el.querySelectorAll("p")]
      .filter((p) => /^(Offensive|Try Out|Save MP|Defensive|Use No MP):/.test(p.textContent ?? ""))
      .map((p) => ({ t: p.textContent.slice(0, 10), x: textLeft(p) }));
  });
  const uniqueLefts = new Set(lefts.map((l) => l.x));
  check(
    "tactic items' TEXT shares one left edge",
    lefts.length >= 2 && uniqueLefts.size === 1,
    JSON.stringify(lefts),
  );

  // 5. The body column must keep a usable share of a phone screen.
  const bodyWidth = await page.evaluate(() => {
    const p = [...document.querySelectorAll("[data-reader-scroll] p")].find((x) =>
      /^Try Out:/.test(x.textContent ?? ""),
    );
    if (!p) return null;
    const pad = parseFloat(getComputedStyle(p).paddingLeft);
    return Math.round(p.getBoundingClientRect().width - pad);
  });
  check("hanging body keeps usable width on a phone", bodyWidth === null || bodyWidth > 200, `${bodyWidth}px`);

  await page.screenshot({ path: resolve(SHOTS, "reader-top.png") });
  await scroll.evaluate((el) => el.scrollTo(0, 12000));
  await page.waitForTimeout(300);
  await page.screenshot({ path: resolve(SHOTS, "reader-mid.png") });
} finally {
  await browser.close();
}
console.log(failures === 0 ? "\nLAYOUT OK" : `\n${failures} LAYOUT CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
