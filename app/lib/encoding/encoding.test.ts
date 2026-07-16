import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeFaqBytes } from "./index";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function fixtureBuffer(name: string): ArrayBuffer {
  const buf = readFileSync(resolve(process.cwd(), "fixtures", name));
  return toArrayBuffer(buf);
}

describe("decodeFaqBytes", () => {
  it("strips a UTF-8 BOM", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69]);
    const { text } = decodeFaqBytes(toArrayBuffer(bytes));
    expect(text).toBe("hi");
  });

  it("normalizes CRLF and CR to LF", () => {
    const bytes = new TextEncoder().encode("a\r\nb\rc\n");
    const { text } = decodeFaqBytes(toArrayBuffer(bytes));
    expect(text).toBe("a\nb\nc\n");
  });

  it("falls back to windows-1252 for non-UTF-8 bytes", () => {
    // 0x93 = left double quote in CP1252, invalid as a standalone UTF-8 byte.
    const { text, encoding } = decodeFaqBytes(toArrayBuffer(new Uint8Array([0x93])));
    expect(encoding).toBe("windows-1252");
    expect(text).toBe("“");
  });

  it("leaves correctly-encoded high chars untouched", () => {
    const bytes = new TextEncoder().encode("¯©"); // ¯©
    const { text, repaired } = decodeFaqBytes(toArrayBuffer(bytes));
    expect(text).toBe("¯©");
    expect(repaired).toBe(false);
  });

  it("repairs double-encoded mojibake in the Fatal Frame fixture", () => {
    const { text, repaired } = decodeFaqBytes(
      fixtureBuffer(
        "Fatal Frame II_ Crimson Butterfly - Spoiler-Free Walkthrough - PlayStation 2 - By MarioSA - GameFAQs.txt",
      ),
    );
    expect(repaired).toBe(true);
    expect(text).toContain("Copyright © 2003-2004"); // real ©
    expect(text).not.toContain("Â©"); // no Â©
    expect(text).not.toContain("ï»¿"); // no mangled BOM
    expect(text.startsWith("=")).toBe(true); // first content line
  });

  it("decodes clean fixtures without repair", () => {
    const { text, repaired } = decodeFaqBytes(
      fixtureBuffer(
        "Ace Combat 3_ Electrosphere - Guide and Walkthrough - PlayStation - By Shotgunnova - GameFAQs.txt",
      ),
    );
    expect(repaired).toBe(false);
    expect(text).toContain("Shotgunnova");
  });
});
