import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto"; // in-memory IndexedDB for Dexie tests (jsdom has none)

// jsdom has no layout engine, so it has no ResizeObserver either. The reader
// observes its scroll container to re-fit ASCII art on resize; a no-op stub is
// honest here, because nothing in jsdom ever resizes. The real behaviour is
// covered by the browser project, which has actual layout.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
