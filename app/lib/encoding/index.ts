// Decodes uploaded FAQ bytes to clean text. Handles BOMs, non-UTF-8 (CP1252),
// and double-encoded "mojibake" (UTF-8 misread as CP1252 then re-saved as UTF-8 —
// see the Fatal Frame fixture). Newlines normalized to \n. Pure/stateless.

export interface DecodeResult {
  text: string;
  encoding: string;
  repaired: boolean;
}

function highCharCount(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) >= 0x80) n++;
  return n;
}

// Reverse one layer of "latin1 bytes decoded as UTF-8". Returns null if the string
// has code points > 0xFF (can't be latin1 bytes) or the bytes aren't valid UTF-8.
function latin1ToUtf8(s: string): string | null {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 0xff) return null;
    bytes[i] = c;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

// Mojibake signatures: Ã-/Â-continuation bigrams, smart-quote runs, mangled BOM.
const MOJIBAKE = /Ã.|Â[ -¿]|â€|ï»¿/;

function repairMojibake(input: string): { text: string; repaired: boolean } {
  let cur = input;
  let repaired = false;
  // Guarded, iterative: only accept a pass that both round-trips as valid UTF-8
  // and does not increase the high-char count (mojibake inflates high chars).
  for (let pass = 0; pass < 3; pass++) {
    if (!MOJIBAKE.test(cur)) break;
    const next = latin1ToUtf8(cur);
    if (next === null || highCharCount(next) > highCharCount(cur)) break;
    cur = next;
    repaired = true;
  }
  return { text: cur, repaired };
}

export function decodeFaqBytes(buf: ArrayBuffer): DecodeResult {
  const bytes = new Uint8Array(buf);
  let encoding = "utf-8";
  let text: string;

  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = "utf-16le";
    text = new TextDecoder("utf-16le").decode(bytes.subarray(2));
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = "utf-16be";
    text = new TextDecoder("utf-16be").decode(bytes.subarray(2));
  } else {
    const body =
      bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
        ? bytes.subarray(3)
        : bytes;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(body);
    } catch {
      encoding = "windows-1252";
      text = new TextDecoder("windows-1252").decode(body);
    }
  }

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rep = repairMojibake(text);
  text = rep.text;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM may re-surface post-repair

  text = text.replace(/\r\n?/g, "\n");
  return { text, encoding, repaired: rep.repaired };
}
