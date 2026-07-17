# FAQMinder — conventions

`PLAN.md` is the cross-session source of truth (phases + resume protocol). `adrs/` holds architecture decisions. This file = durable conventions not obvious from code.

## Product
- **Mobile-first, offline-first.** Primary target is mobile, where tabs get purged from memory. **Persistence is load-bearing**: every bit of reader state (active FAQ, scroll anchor, font size, reflow overrides) must survive a cold reload.
- **Never disable viewport zoom** (`maximum-scale`/`user-scalable=no`). It's an accessibility failure, and ASCII art depends on pinch-zoom since A−/A+ only scales prose. Any text input must therefore be **≥16px**, or iOS zooms the viewport on focus and buries the document behind the keyboard — that's why the search input sets `font-size: 16px` explicitly.

## Architecture
- Layers per `adrs/0001-structure.md`: `routes → features → domains → lib`; `components` are pure. Import only a subfolder's `index.ts`/`types.ts` barrel.
- Boundaries are enforced — run `pnpm depcruise`. Violations are errors.
- Prose reflow is conservative and preserves visual intent; never auto-reflow ASCII art. See `PLAN.md`.
- **Tabs are expanded to 8-column stops at parse.** FAQs mix tabs and spaces for the same visual column, so every column measurement (and the verbatim render) is wrong until tabs are resolved. Done at parse, not import, so already-stored documents are fixed without re-importing.
- **Prose wraps to the viewport; wide art scrolls inside its own block.** The reader must never scroll horizontally as a whole — a full-width wrapper makes prose wrap to the widest art block instead of the screen.
- **Art is sized to the 95th percentile of art width, never the max.** FAQs are ~80 columns but carry a few freak diagrams (one fixture has a 349-column line); fitting the max would shrink every drawing to ~2px to humour an outlier. Typical art fits; outliers keep their per-block scroll. Toggle in reader options (`artFit`, per-document, default on).
- **Two font sizes.** Resizing (A−/A+) only scales *wrapped* prose, via the `--prose-font` var; unwrappable art/diagrams follow `artFit`/`ART_FONT` (scaling a fixed-width drawing just makes it overflow further — it scrolls in-block, and the viewport still pinch-zooms). Resizing re-lays-out the document, so the reader captures the top-of-viewport anchor *before* the change and restores it after. `overflow-anchor: none` is deliberate: native scroll anchoring is absent on iOS Safari (our primary target) and fights the explicit restore.

## Tooling
- **pnpm only.** Add deps with `pnpm add <pkg>@latest` — never hand-pick versions. `pnpm-workspace.yaml` sets `savePrefix:''` (exact pins) and pre-approves `esbuild` builds. Build-script approval (`pnpm approve-builds`) is interactive — do not attempt it non-interactively; surface to the user if a new dep needs it.
- **TypeScript is pinned to 6.x, NOT latest (7.x).** TS 7 is the native compiler but dependency-cruiser (and much boundary/lint tooling) only supports `<7` as of this writing, and it silently cruises 0 modules under TS 7. Revisit the upgrade once [dependency-cruiser](https://github.com/sverweij/dependency-cruiser/issues/1069) supports TS 7.
- **Long-running tasks run in tmux** (dev server, verification). **Never assume the Vite port** — another Vite project already runs on 5173, so RR dev picks 5174+. Read the actual port from the tmux pane output.

## Verification
`pnpm test` runs both Vitest projects; `test:unit` / `test:browser` run one. Playwright's Chromium is required (`pnpm exec playwright install chromium`).
- **unit** (jsdom + fake-indexeddb) — pure logic (parse/encoding/search/scroll geometry) + component integration.
- **Classifier changes: read the corpus diff.** `parse.test.ts` holds hand-written cases that encode *intent* (the `-----` underline is dropped; `Q:`/`A:` never merge). `corpus.test.ts` snapshots every block of every fixture (`__snapshots__/corpus/`, one line per block + a `_summary.txt` tally) — that's the net that makes a reclassification visible instead of silent. A snapshot diff is **not automatically a bug**: read it, decide, then update. Snapshots record *current* behaviour, so never let one stand in for an intent test. Drop a file in `fixtures/` and it's covered on the next run.
- **browser** (`*.browser.test.tsx`, real Chromium at phone size) — **anything layout-related**: jsdom has no layout engine, so wrapping/alignment/overflow bugs are invisible to unit tests. Screenshots land in `scratch-shots/` (also auto-captured on failure).
  - Import `~/app.css` and assert a computed style first — without the real stylesheet every measurement is meaningless.
  - Measure text position with a `Range` over the text: an element's rect sits at the container edge regardless of `text-indent` and proves nothing. Measure overflow with `scrollWidth`, not the box rect.
  - Render with **`vitest-browser-react`** (`await render(...)` — it's async), never `@testing-library/react`. RTL turns React's act environment on for the whole test, so every update driven by a real browser event — the entire point here — is reported as "not wrapped in act". This renderer scopes `act()` to the render and turns it back off. (RTL + `userEvent` stays correct for the jsdom unit tests, where userEvent is act-wrapped.)
  - Render per-test (`beforeEach`) — the renderer auto-cleans up between tests.
  - `page.screenshot()` needs `{ element }`, else it captures the runner's own page (blank). Omit `path` — it's relative to the test file and escapes `screenshotDirectory`.
- Full-app flows (routing, IndexedDB, reload): start dev in tmux, then `pnpm verify:e2e` (Playwright; reads `PORT`, default 5174). Production build (base paths, update flow, offline/SW): `pnpm verify:prod` (builds, serves, cuts network).

## Deploy
- Static SPA → GitHub Pages. `pnpm deploy:gh` (`scripts/deploy.sh`) is the only way to ship: it runs typecheck → tests → depcruise → e2e → production build, and deploys **the artifact those checks ran against**. `pnpm check` is the same without deploying. No CI.
  - It starts its own dev server for the e2e step and **reads the port from that server's output** (another Vite may hold 5173/5174). `set -m` + killing the process group means it only ever kills its own server — never pattern-kill `react-router dev`, that would take out a tmux dev server.
- Base path is `VITE_BASE` (default `/faqminder/`) in `vite.config.ts` + `react-router.config.ts`. `build/client/404.html` is the SPA deep-link fallback (copied from `index.html` at build).
- **The base path's trailing slash is load-bearing.** RR requires `basename` to begin with Vite's `base`, and without the trailing slash SPA mode *silently* stops emitting `build/client/index.html`. Consequence: the router matches `/faqminder/` but not `/faqminder` — the slash is added by an HTTP redirect (GitHub Pages does this for directory URLs; `vite.config.ts`'s `baseRedirect` plugin mirrors it in dev). Don't "fix" this by trimming the basename.
- Service worker (offline shell) is generated post-build by `scripts/build-sw.mjs` (Workbox), NOT vite-plugin-pwa — the plugin fights RR framework mode's per-environment `build/client` outDir. Registered client-only in `root.tsx` (prod).
- **Staleness**: the `faqminder:app-version` plugin (vite.config) computes one version per build (`<sha>-<time>`; `<sha>-dev` in dev) and publishes it twice — `__APP_VERSION__` compiled into the client, and `version.json`. These MUST come from the same value, or every load thinks it's stale. `.json` is deliberately outside the SW precache globs: a cached version.json could never report a new build. The app polls on load/focus/pageshow and offers a hard refresh (`clearAppShellCache` drops the SW + Cache Storage — **never IndexedDB**, that's the user's library), because with `skipWaiting` a new SW activates but the page keeps running old code until forced.
