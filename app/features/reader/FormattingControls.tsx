import { useAtom } from "jotai";
import { clampFont, FONT_STEP, readerFontAtom } from "~/domains/reader";

const BTN =
  "flex h-9 w-9 items-center justify-center rounded text-neutral-300 active:bg-neutral-800 disabled:opacity-30";

// Utilitarian text-size stepper (mobile-friendly 36px targets). Backed by the
// global, persisted font atom.
export function FormattingControls() {
  const [font, setFont] = useAtom(readerFontAtom);
  return (
    <div className="flex shrink-0 items-center" role="group" aria-label="Text size">
      <button
        type="button"
        className={BTN}
        aria-label="Decrease text size"
        onClick={() => setFont((f) => clampFont(f - FONT_STEP))}
      >
        <span className="text-xs">A</span>
        <span aria-hidden>−</span>
      </button>
      <span className="w-7 text-center text-xs tabular-nums text-neutral-500" aria-hidden>
        {font}
      </span>
      <button
        type="button"
        className={BTN}
        aria-label="Increase text size"
        onClick={() => setFont((f) => clampFont(f + FONT_STEP))}
      >
        <span className="text-base">A</span>
        <span aria-hidden>+</span>
      </button>
    </div>
  );
}
