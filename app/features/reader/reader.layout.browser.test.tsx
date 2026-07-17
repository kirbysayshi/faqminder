import { page } from "vitest/browser";
// vitest-browser-react, not @testing-library/react: RTL turns React's act
// environment on for the whole test, so every state update driven by a REAL browser
// event (which is the entire point of these tests) is reported as "not wrapped in
// act". This renderer scopes act() to the render itself, then turns it back off.
import { render } from "vitest-browser-react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import type { FaqMeta } from "~/domains/library";
import { ReaderScreen } from "./ReaderScreen";
import "~/app.css"; // real Tailwind — layout depends on it
// Real fixture: mixes tabs/spaces, wide ASCII art, hanging definition items.
import dw4 from "../../../fixtures/Dragon Warrior IV - Guide and Walkthrough - NES - By Ramina - GameFAQs.txt?raw";

const meta: FaqMeta = {
  id: "layout", title: "Dragon Warrior IV", source: "dw4.txt", addedAt: 0,
  byteSize: 0, lineCount: 0, encoding: "utf-8", repaired: false,
};

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const all = <T extends HTMLElement>(sel: string) => [...document.querySelectorAll<T>(sel)];

/** Left edge of rendered TEXT. An element's rect sits at the container edge no
 *  matter what text-indent does, so measuring the element proves nothing. */
function textLeft(el: HTMLElement): number {
  const range = document.createRange();
  range.setStart(el.firstChild!, 0);
  range.setEnd(el.firstChild!, 1);
  return Math.round(range.getBoundingClientRect().left);
}

const tacticItems = () =>
  all<HTMLParagraphElement>("[data-reader-scroll] p").filter((p) =>
    /^(Offensive|Try Out|Save MP|Defensive|Use No MP):/.test(p.textContent ?? ""),
  );

/** The block currently under the top of the viewport. */
function topBlockId(reader: HTMLElement): string | undefined {
  const top = reader.getBoundingClientRect().top;
  return all("[data-block-id]").find((b) => b.getBoundingClientRect().bottom > top + 1)?.dataset
    .blockId;
}

const px = (el: Element) => parseFloat(getComputedStyle(el).fontSize);

async function stepFont(dir: "Increase" | "Decrease", times = 1) {
  for (let i = 0; i < times; i++) await page.getByLabelText(`${dir} text size`).click();
}

describe("reader layout (real browser)", () => {
  // Per-test: the renderer auto-cleans up between tests, so re-render each time.
  beforeEach(async () => {
    document.body.style.margin = "0";
    await render(
      <MemoryRouter>
        <ReaderScreen meta={meta} text={dw4} />
      </MemoryRouter>,
    );
  });

  // Guard: without the real stylesheet every measurement below is meaningless.
  it("has the app stylesheet applied", () => {
    const reader = $("[data-reader-scroll]");
    expect(getComputedStyle(reader).overflowX).toBe("hidden");
    expect(getComputedStyle(reader).fontFamily).toMatch(/mono/i);
  });

  it("never scrolls horizontally — wide art scrolls inside its own block", () => {
    const reader = $("[data-reader-scroll]");
    expect(reader.scrollWidth).toBeLessThanOrEqual(reader.clientWidth + 1);
    // The art is still reachable: its own wrapper is the thing that scrolls.
    const wideArt = all("[data-block-id] .overflow-x-auto").filter(
      (d) => d.scrollWidth > d.clientWidth + 1,
    );
    expect(wideArt.length).toBeGreaterThan(0);
  });

  it("reflows prose, and no paragraph's text overflows its box", () => {
    const ps = all<HTMLParagraphElement>("[data-reader-scroll] p");
    expect(ps.length).toBeGreaterThan(100);
    const overflowing = ps.filter((p) => p.scrollWidth > p.clientWidth + 1);
    expect(overflowing.map((p) => p.textContent?.slice(0, 40))).toEqual([]);
  });

  it("wraps prose to several visual lines", () => {
    const p = $<HTMLParagraphElement>("[data-reader-scroll] p");
    const lineHeight = parseFloat(getComputedStyle(p).lineHeight) || 20;
    expect(Math.round(p.getBoundingClientRect().height / lineHeight)).toBeGreaterThan(1);
  });

  it("aligns sibling definition items regardless of tab vs space indentation", () => {
    // Dragon Warrior IV indents these with a mix of "\t  " and 10 spaces.
    const items = tacticItems();
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(new Set(items.map(textLeft)).size).toBe(1);
  });

  it("keeps a usable body column on a phone (hang indent is capped)", () => {
    const item = tacticItems()[0]!;
    const pad = parseFloat(getComputedStyle(item).paddingLeft);
    expect(item.getBoundingClientRect().width - pad).toBeGreaterThan(200);
  });

  it("resizes only wrapped prose — art keeps its base size", async () => {
    const art = $("[data-block-id] pre"); // verbatim block
    const prose = $<HTMLParagraphElement>("[data-reader-scroll] p");
    const artBefore = px(art);
    const proseBefore = px(prose);

    await stepFont("Increase", 4);
    expect(px(prose)).toBeGreaterThan(proseBefore); // wrapped text grew
    expect(px(art)).toBe(artBefore); // art untouched

    await stepFont("Decrease", 8);
    expect(px(prose)).toBeLessThan(proseBefore); // wrapped text shrank
    expect(px(art)).toBe(artBefore); // still untouched
  });

  it("keeps the content at the top of the viewport when resizing", async () => {
    const reader = $("[data-reader-scroll]");
    reader.scrollTo(0, 9000);
    const before = topBlockId(reader);
    expect(before).toBeDefined();

    // Native scroll anchoring is off (iOS Safari lacks it), so this only passes
    // because the reader restores the anchor itself. Without it the top jumps ~10
    // blocks backwards when the document re-lays-out.
    await stepFont("Increase", 5);
    expect(topBlockId(reader)).toBe(before); // same content still on screen

    await stepFont("Decrease", 5);
    expect(topBlockId(reader)).toBe(before);
  });

  it("captures a screenshot of the reflowed reader", async () => {
    $("[data-reader-scroll]").scrollTo(0, 12000);
    // Scope to the rendered component: a bare page.screenshot() captures the
    // runner's own page, not the test's DOM. Lands in `screenshotDirectory`.
    await page.screenshot({ element: $("[data-reader-root]") });
  });
});
