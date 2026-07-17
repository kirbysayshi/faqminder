# FAQMiner — Build Plan

Offline-first, **mobile-first** PWA for reading game-FAQ text walkthroughs. Local-only (no server), deployed static to GitHub Pages. Primary target = mobile, where tabs/apps get purged from memory — so **persistence is load-bearing** (every bit of reader state survives a cold reload). This file is the **cross-session source of truth**: keep the Phase Status table current so any session can resume. Detail lives in code — this is a pointer, not a spec.

## Locked decisions

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite + React + **TS 6.x** (pinned; TS 7 breaks depcruise — see CLAUDE.md), pnpm | |
| Routing | React Router 7 **framework mode**, `ssr:false`, `prerender:['/']` | SPA static export; `base=/faqminder/`; `404.html` SPA fallback for deep links |
| State | **Jotai** (reactive/ephemeral atoms) | matches ADR "atoms" |
| Persistence | **Dexie** (IndexedDB) + `dexie-react-hooks` `useLiveQuery` | FAQ blobs + parsed model + per-doc reader state |
| Styling | Tailwind (utilitarian, terse UI) | |
| Offline | `vite-plugin-pwa` (precache app shell) | **SW wiring deferred to P7** — plugin's default outDir fights RR framework mode's per-env `build/client`. Static manifest only for now |
| Layers | per `adrs/0001-structure.md` | enforced by dependency-cruiser + eslint-plugin-import |
| Tests | Vitest, two projects: **unit** (jsdom) + **browser** (real Chromium, `*.browser.test.tsx`) | layout can only be verified in a real browser; see CLAUDE.md |
| Deploy | `gh-pages` manual (user handles repo/CI) | no GitHub Actions for now |
| Long tasks | run in **tmux** (dev server, verify) | another Vite project is already running — **never assume the port**, read it from Vite's output |
| Versions | install with `pnpm add <pkg>@latest` | never hand-pick versions; `pnpm-workspace.yaml` sets `savePrefix:''` (exact) + pre-approves `esbuild` builds |

## Feature → layer map

`lib/` = pure stateless. `domains/` = state, no JSX. `features/` = JSX/containers. `components/` = promoted pure UI. Import direction enforced (ADR 0001).

| Feature | lib | domains | features |
|---|---|---|---|
| Import FAQ (file input) | `encoding` (bytes→text, BOM/mojibake), `parse` | `library` (Dexie CRUD) | `import` |
| Switch active FAQ | — | `library` (list via useLiveQuery), `reader` (activeId atom) | `library` (picker) |
| Reader view | `parse` (block model) | `document` (parsed cache) | `reader` |
| Scroll bookmark | — | `reader` (anchor persistence) | `scroll-bookmark` |
| Font/format controls | — | `reader` (fontSize/lineHeight atoms, persisted) | `formatting` |
| Selection → find instances | `search` (occurrences+context) | `reader` (overlay state) | `selection-search` |
| Prose reflow + undo | `parse` (classify + join) | `document` (reflow overrides, persisted) | `reflow` |

## Key algorithms (non-obvious — capture here)

**Tabs**: expanded to 8-col stops at parse (`expandTabs`) — FAQs mix tabs/spaces for one visual column; all column math and the verbatim render depend on it.

**Layout**: prose wraps to the viewport; each art block scrolls horizontally on its own. The reader never scrolls horizontally as a whole. Reflowed prose reproduces the source's structure via `padding-left` (hang column) + `text-indent` (first line), each capped with CSS `min()` so an 80-col FAQ doesn't eat half a phone.

**Parse / prose classifier** (`lib/parse`, deterministic, re-run per open):
Split to lines → group by blank-line boundaries into blocks → classify. Goal = **preserve visual intent while letting font size change**. Everything is **relative within the block** — no absolute line-length thresholds (FAQs vary widely in width). Two reflowable layouts:
- `block` — a wrapped paragraph. Continuation lines share one indent (`padLeft`); the first line is free, so a paragraph indent (first line in) or hanging indent (first line out) both survive.
- `hanging` — a label/definition item: one label, then a body at a consistent hang column (`TALK:` / `-----` / body…). The label is kept; decorative label-column content on later lines (a `-----` underline) is dropped. Requires exactly **one** meaningful label — a second (`Q:`/`A:`) means separate items, so leave verbatim.

Rejected as `art` (verbatim, never reflowed): <2 lines, too short, not text-dominated, any decorative line (ratio of art chars > .5, or dotted leaders), ≥2 list markers, ragged/non-full lines (a TOC's short entries), or an aligned column (a shop/stat table — most lines resume text at the same column).

Conservative: when unsure → `art`. Reflowable blocks render a ¶ toggle; the user can force off/on per block, persisted.

**Reflow override model** (`domains/document`): store per-FAQ `{ auto: blockId[], overrides: Record<blockId, boolean> }`. Effective = override ?? auto-membership. Persisted; survives reload.

**Scroll bookmark** (`domains/reader`): persist an **anchor** = `{ blockId, fraction }` of top-most visible block, NOT raw scrollTop — robust to font-size / reflow changes. Throttled write; restore on mount before paint.

**Selection search** (`lib/search` + `features/selection-search`): on non-empty selection, find all case-insensitive occurrences with context snippets; overlay lists them; tap → scroll to occurrence's block + brief highlight. Own overlay (native mobile find is the thing we're replacing).

## Phases (status: `[ ]` todo · `[~]` wip · `[x]` done)

- [x] **P0 Scaffold** — Vite+RR8(fw mode,`ssr:false`)+TS6+Tailwind4, pnpm, Vitest, depcruise boundaries (13 mod, 0 violations), layer dirs, `404.html`, `deploy:gh`. Verified: typecheck/build/depcruise/test green; dev server 200 on `:5174/faqminder/`. PWA SW → P7.
- [x] **P1 Storage + import** — Dexie (`domains/library`, split faqs/contents tables), `lib/encoding` (BOM + CP1252 + mojibake repair), `lib/filename`, `features/import` + `features/library`. Tests: encoding/filename units + import→persist→list integration (fake-indexeddb). 10 green.
- [x] **P2 Reader + switch** — `lib/parse` block splitter (all `art` until P6), `features/reader` renders verbatim mono blocks w/ `data-block-id` (anchor/search hooks), `faq.$id` route via `clientLoader` reading IndexedDB + ErrorBoundary. Switch = navigation. Tests: parse units + reader render (exact ASCII preserved). 17 green. NB: `domains/document` deferred to P6 (parse is pure/ephemeral for now).
- [x] **P3 Scroll bookmark** — `domains/db` (centralized Dexie, v2 adds readerState), `domains/reader` persistence, `lib/scroll` anchor geometry (unit-tested), `useScrollBookmark` restores pre-paint + saves throttled on scroll & on pagehide/visibility-hidden (mobile purge). Reader keyed by faqId. 22 green.
- [x] **P4 Formatting** — **two sizes**: prose (per-doc, persisted, A−/A+ via `--prose-font`) and a fixed `ART_FONT` for unwrappable art. Resize preserves the top-of-viewport anchor (`overflow-anchor:none` — native anchoring is absent on iOS Safari). Per-document persisted font size (in `readerState`, loaded via clientLoader, merge-patched alongside scroll anchor), `FormattingControls` A−/A+ stepper (controlled) in reader header. Different docs keep their own base size (ASCII width varies). Line-height fixed — utilitarian.
- [x] **P5 Selection search** — `lib/search` (case-insensitive, per-block hits w/ context, unit-tested), `SelectionSearch` (co-located): selectionchange→count pill→bottom-sheet list→tap jumps + flashes block. 29 green.
- [x] **P6 Prose reflow** — `lib/parse` conservative classifier (`block` + `hanging` layouts; tab expansion; table/TOC/decoration guards; verified across all 8 fixtures), `reflowText`, `domains/document` override persistence (db v3 docState), `BlockView` renders art verbatim / prose reflowed-with-¶-toggle, default-on. Prose wraps to viewport; art scrolls per-block. Verified in-browser via the `browser` test project. NB: floated-box (prose beside a right-hand art gutter) still stays verbatim — conservative.
- [x] **P7 PWA + polish** — SW via post-build Workbox (`scripts/build-sw.mjs`, precache 18 files, navigateFallback), client-only registration in root, manifest + SVG icon. Real-browser E2E (`scripts/verify-e2e.mjs`, 13 checks: import→reader→font→reflow→selection-jump→scroll-restore-across-reload→list) + offline verify (`scripts/verify-offline.mjs`, SW serves shell with network cut) both pass. Empty/error/busy states in place.

Each phase = its own commit(s). Update this table + note surprises before ending a session.

## Resume protocol

1. Read this file + `adrs/`. 2. `git log --oneline` to see last committed phase. 3. Continue first `[ ]`/`[~]` phase. 4. Update Phase Status before stopping.

## Open questions / risks

- Large fixtures (Dragon Warrior IV ~6.8k lines): may need windowing/virtualization in `features/reader` (defer to P7 if perf is fine).
- Fatal Frame fixture has BOM + Windows-1252 mojibake → `lib/encoding` must detect, not assume UTF-8.
- Mobile: custom selection overlay coexisting with native selection menu — validate in P5 (mobile-first).
- RR7 framework `ssr:false` + prerender + GH Pages base path — `404.html` SPA fallback is known-good on GH Pages, no verification needed.
