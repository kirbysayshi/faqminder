import { page } from "vitest/browser";
import { render } from "@testing-library/react";
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

describe("reader layout (real browser)", () => {
  // Per-test: testing-library auto-cleanup unmounts between tests.
  beforeEach(() => {
    document.body.style.margin = "0";
    render(
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

  it("captures a screenshot of the reflowed reader", async () => {
    $("[data-reader-scroll]").scrollTo(0, 12000);
    // Scope to the rendered component: a bare page.screenshot() captures the
    // runner's own page, not the test's DOM. Lands in `screenshotDirectory`.
    await page.screenshot({ element: $("[data-reader-root]") });
  });
});
