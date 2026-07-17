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
| Tests | Vitest — pure `lib/` fns against real `fixtures/` | parse/encoding/search are highest value |
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

**Parse / prose classifier** (`lib/parse`, run **once at import**, result cached in Dexie):
Split to lines → group by blank-line boundaries into blocks → classify. Goal = **preserve visual intent while letting font size change**. Classification is **relative within the block**, NOT against absolute line-length thresholds (FAQs vary widely in width):
- `prose` — lines wrap consistently near a shared right margin, high alpha ratio, no art signatures → join wrapped lines, soft-wrap, left-align.
- `indented-list` — prose-like but with a hanging/leading indent → reflow **preserving the left indent** (CSS `padding-left`/hanging indent), don't collapse the indent.
- `floated-box` — a text column with a right-side box/art gutter → reflow the prose column, drop the float, keep intent.
- `other` / `ascii-art` — banners, boxed tables, dotted-leader TOCs, anything with art signatures (runs of `| _ / \ = + . : ~`, box-drawing, leader dots) → rendered `<pre>` verbatim, never reflowed.

Conservative: when unsure, fall back to `other`. Reflowable blocks render a small toggle icon; user can force off/on per block. Never auto-reflow ASCII art.

**Reflow override model** (`domains/document`): store per-FAQ `{ auto: blockId[], overrides: Record<blockId, boolean> }`. Effective = override ?? auto-membership. Persisted; survives reload.

**Scroll bookmark** (`domains/reader`): persist an **anchor** = `{ blockId, fraction }` of top-most visible block, NOT raw scrollTop — robust to font-size / reflow changes. Throttled write; restore on mount before paint.

**Selection search** (`lib/search` + `features/selection-search`): on non-empty selection, find all case-insensitive occurrences with context snippets; overlay lists them; tap → scroll to occurrence's block + brief highlight. Own overlay (native mobile find is the thing we're replacing).

## Phases (status: `[ ]` todo · `[~]` wip · `[x]` done)

- [x] **P0 Scaffold** — Vite+RR8(fw mode,`ssr:false`)+TS6+Tailwind4, pnpm, Vitest, depcruise boundaries (13 mod, 0 violations), layer dirs, `404.html`, `deploy:gh`. Verified: typecheck/build/depcruise/test green; dev server 200 on `:5174/faqminder/`. PWA SW → P7.
- [x] **P1 Storage + import** — Dexie (`domains/library`, split faqs/contents tables), `lib/encoding` (BOM + CP1252 + mojibake repair), `lib/filename`, `features/import` + `features/library`. Tests: encoding/filename units + import→persist→list integration (fake-indexeddb). 10 green.
- [x] **P2 Reader + switch** — `lib/parse` block splitter (all `art` until P6), `features/reader` renders verbatim mono blocks w/ `data-block-id` (anchor/search hooks), `faq.$id` route via `clientLoader` reading IndexedDB + ErrorBoundary. Switch = navigation. Tests: parse units + reader render (exact ASCII preserved). 17 green. NB: `domains/document` deferred to P6 (parse is pure/ephemeral for now).
- [x] **P3 Scroll bookmark** — `domains/db` (centralized Dexie, v2 adds readerState), `domains/reader` persistence, `lib/scroll` anchor geometry (unit-tested), `useScrollBookmark` restores pre-paint + saves throttled on scroll & on pagehide/visibility-hidden (mobile purge). Reader keyed by faqId. 22 green.
- [x] **P4 Formatting** — **per-document** persisted font size (in `readerState`, loaded via clientLoader, merge-patched alongside scroll anchor), `FormattingControls` A−/A+ stepper (controlled) in reader header. Different docs keep their own base size (ASCII width varies). Line-height fixed — utilitarian.
- [x] **P5 Selection search** — `lib/search` (case-insensitive, per-block hits w/ context, unit-tested), `SelectionSearch` (co-located): selectionchange→count pill→bottom-sheet list→tap jumps + flashes block. 29 green.
- [x] **P6 Prose reflow** — `lib/parse` conservative classifier (relative hard-wrap test + list-marker/art-run guards; verified across all 8 fixtures), `reflowText`, `domains/document` override persistence (db v3 docState), `BlockView` renders art verbatim / prose reflowed-with-¶-toggle (indent preserved), default-on. 36 green. NB: indented-list/floated-box kinds reserved — v1 reflows confident prose only (lists/boxes stay verbatim, conservative).
- [x] **P7 PWA + polish** — SW via post-build Workbox (`scripts/build-sw.mjs`, precache 18 files, navigateFallback), client-only registration in root, manifest + SVG icon. Real-browser E2E (`scripts/verify-e2e.mjs`, 13 checks: import→reader→font→reflow→selection-jump→scroll-restore-across-reload→list) + offline verify (`scripts/verify-offline.mjs`, SW serves shell with network cut) both pass. Empty/error/busy states in place.

Each phase = its own commit(s). Update this table + note surprises before ending a session.

## Resume protocol

1. Read this file + `adrs/`. 2. `git log --oneline` to see last committed phase. 3. Continue first `[ ]`/`[~]` phase. 4. Update Phase Status before stopping.

## Open questions / risks

- Large fixtures (Dragon Warrior IV ~6.8k lines): may need windowing/virtualization in `features/reader` (defer to P7 if perf is fine).
- Fatal Frame fixture has BOM + Windows-1252 mojibake → `lib/encoding` must detect, not assume UTF-8.
- Mobile: custom selection overlay coexisting with native selection menu — validate in P5 (mobile-first).
- RR7 framework `ssr:false` + prerender + GH Pages base path — `404.html` SPA fallback is known-good on GH Pages, no verification needed.
