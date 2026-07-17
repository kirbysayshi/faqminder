# FAQMiner — conventions

`PLAN.md` is the cross-session source of truth (phases + resume protocol). `adrs/` holds architecture decisions. This file = durable conventions not obvious from code.

## Product
- **Mobile-first, offline-first.** Primary target is mobile, where tabs get purged from memory. **Persistence is load-bearing**: every bit of reader state (active FAQ, scroll anchor, font size, reflow overrides) must survive a cold reload.

## Architecture
- Layers per `adrs/0001-structure.md`: `routes → features → domains → lib`; `components` are pure. Import only a subfolder's `index.ts`/`types.ts` barrel.
- Boundaries are enforced — run `pnpm depcruise`. Violations are errors.
- Prose reflow is conservative and preserves visual intent; never auto-reflow ASCII art. See `PLAN.md`.
- **Tabs are expanded to 8-column stops at parse.** FAQs mix tabs and spaces for the same visual column, so every column measurement (and the verbatim render) is wrong until tabs are resolved. Done at parse, not import, so already-stored documents are fixed without re-importing.
- **Prose wraps to the viewport; wide art scrolls inside its own block.** The reader must never scroll horizontally as a whole — a full-width wrapper makes prose wrap to the widest art block instead of the screen.

## Tooling
- **pnpm only.** Add deps with `pnpm add <pkg>@latest` — never hand-pick versions. `pnpm-workspace.yaml` sets `savePrefix:''` (exact pins) and pre-approves `esbuild` builds. Build-script approval (`pnpm approve-builds`) is interactive — do not attempt it non-interactively; surface to the user if a new dep needs it.
- **TypeScript is pinned to 6.x, NOT latest (7.x).** TS 7 is the native compiler but dependency-cruiser (and much boundary/lint tooling) only supports `<7` as of this writing, and it silently cruises 0 modules under TS 7. Revisit the upgrade once [dependency-cruiser](https://github.com/sverweij/dependency-cruiser/issues/1069) supports TS 7.
- **Long-running tasks run in tmux** (dev server, verification). **Never assume the Vite port** — another Vite project already runs on 5173, so RR dev picks 5174+. Read the actual port from the tmux pane output.

## Verification
- Pure logic (parse/encoding/search/scroll geometry) + component integration are unit-tested (`pnpm test`, jsdom + fake-indexeddb).
- Real-browser end-to-end: start dev in tmux, then `pnpm verify:e2e` (drives all features via Playwright; reads `PORT`, default 5174). Offline/SW: `pnpm verify:offline` (builds, serves, cuts network). Playwright's Chromium is required (`pnpm exec playwright install chromium`).
- **`pnpm verify:layout` for anything layout-related** — jsdom has no layout engine, so wrapping/alignment/overflow bugs are invisible to unit tests. It asserts wrapping + alignment and writes screenshots to `scratch-shots/`. When measuring text position, use a `Range` over the text: an element's rect sits at the container edge regardless of `text-indent` and proves nothing.

## Deploy
- Static SPA → GitHub Pages via `pnpm deploy:gh` (manual; no CI). Base path is `VITE_BASE` (default `/faqminder/`) in `vite.config.ts` + `react-router.config.ts`. `build/client/404.html` is the SPA deep-link fallback (copied from `index.html` at build).
- Service worker (offline shell) is generated post-build by `scripts/build-sw.mjs` (Workbox), NOT vite-plugin-pwa — the plugin fights RR framework mode's per-environment `build/client` outDir. Registered client-only in `root.tsx` (prod).
