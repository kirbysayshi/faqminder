import { describe, expect, it } from "vitest";
import { parseFaqFilename } from "./index";

describe("parseFaqFilename", () => {
  it("splits title from descriptor and drops the GameFAQs suffix", () => {
    const r = parseFaqFilename(
      "Metal Gear Solid 2_ Sons of Liberty - Guide and Walkthrough - PlayStation 2 - By Conquerer - GameFAQs.txt",
    );
    expect(r.title).toBe("Metal Gear Solid 2: Sons of Liberty");
    expect(r.descriptor).toBe("Guide and Walkthrough · PlayStation 2 · By Conquerer");
  });

  it("handles a plain filename with no descriptor", () => {
    expect(parseFaqFilename("walkthrough.txt")).toEqual({
      title: "walkthrough",
      descriptor: "",
    });
  });

  it("converts underscore to colon", () => {
    expect(parseFaqFilename("Ace Combat 3_ Electrosphere.txt").title).toBe(
      "Ace Combat 3: Electrosphere",
    );
  });
});
