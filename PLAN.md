# FAQMinder — Build Plan

Offline-first, **mobile-first** PWA for reading game-FAQ text walkthroughs. Local-only (no server), deployed static to GitHub Pages. Primary target = mobile, where tabs/apps get purged from memory — so **persistence is load-bearing** (every bit of reader state survives a cold reload). This file is the **cross-session source of truth**: the P0–P7 table is history (all shipped); current state is "Since P7" + "Open questions". Detail lives in code — this is a pointer, not a spec.

## Locked decisions

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite + React + **TS 6.x** (pinned; TS 7 breaks depcruise — see CLAUDE.md), pnpm | |
| Routing | React Router **8** framework mode, `ssr:false` | SPA static export; `base=/faqminder/` (trailing slash is load-bearing — see CLAUDE.md); `404.html` SPA fallback |
| State | **Jotai** — provider only | No atoms remain: the last one (font) became per-document persisted state. Kept as the sanctioned home for future ephemeral UI state |
| Persistence | **Dexie** (IndexedDB) + `dexie-react-hooks` `useLiveQuery` | FAQ blobs + parsed model + per-doc reader state |
| Styling | Tailwind (utilitarian, terse UI) | |
| Offline | Workbox via post-build script | NOT vite-plugin-pwa — it fights RR framework mode's per-env `build/client` outDir. See `scripts/build-sw.mjs` |
| Layers | per `adrs/0001-structure.md` | enforced by dependency-cruiser (`pnpm depcruise`). No ESLint in this project |
| Tests | Vitest, two projects: **unit** (jsdom) + **browser** (real Chromium, `*.browser.test.tsx`) | layout can only be verified in a real browser; see CLAUDE.md |
| Deploy | `gh-pages` manual (user handles repo/CI) | no GitHub Actions for now |
| Long tasks | run in **tmux** (dev server, verify) | another Vite project is already running — **never assume the port**, read it from Vite's output |
| Versions | install with `pnpm add <pkg>@latest` | never hand-pick versions; `pnpm-workspace.yaml` sets `savePrefix:''` (exact) + pre-approves `esbuild` builds |

## Feature → layer map

`lib/` = pure stateless. `domains/` = state, no JSX. `features/` = JSX/containers. `components/` = promoted pure UI. Import direction enforced (ADR 0001).

Everything that acts on the reader's own DOM lives **inside** `features/reader` as a
co-located hook/component (ADR 0001: a feature's hooks travel with it) — that keeps
imports feature→domain and avoids feature→feature. `domains/db` owns the Dexie
schema; other domains build operations on it.

| Feature | lib | domains | features |
|---|---|---|---|
| Import FAQ (file input) | `encoding` (bytes→text, BOM/mojibake), `filename` | `library` (Dexie CRUD) | `import` |
| Library / switch FAQ | — | `library` (list via `useLiveQuery`) | `library` (picker) |
| Reader view + reflow | `parse` (blocks, classify, reflow), `typography` (fit math) | `document` (reflow overrides) | `reader` → `BlockView` |
| Scroll bookmark | `scroll` (anchor geometry) | `reader` (anchor persistence) | `reader` → `useScrollBookmark`, `anchor` |
| Font / art fit | `typography` | `reader` (fontSize, artFit — per doc) | `reader` → `FormattingControls`, `ReaderOptions`, `useArtFont` |
| Search (selection + typed) | `search` (occurrences+context) | — | `reader` → `DocumentSearch` |
| Update available | — | `version` (poll, hard refresh) | `app-update` (banner, in `root.tsx`) |

## Key algorithms (non-obvious — capture here)

**Tabs**: expanded to 8-col stops at parse (`expandTabs`) — FAQs mix tabs/spaces for one visual column; all column math and the verbatim render depend on it.

**Layout**: prose wraps to the viewport; each art block scrolls horizontally on its own. The reader never scrolls horizontally as a whole. Reflowed prose reproduces the source's structure via `padding-left` (hang column) + `text-indent` (first line), each capped with CSS `min()` so an 80-col FAQ doesn't eat half a phone.

**Parse / prose classifier** (`lib/parse`, deterministic, re-run per open):
Split to lines → group by blank-line boundaries into runs. **Blank lines don't bound a block**: FAQs run prose straight into a diagram and straight out of a banner with no gap either side, so each run is cut into prose islands (`piecesForRun`); anything that isn't reflowable prose merges back together, which keeps a box's interior intact. Then classify. Goal = **preserve visual intent while letting font size change**. Everything is **relative within the block** — no absolute line-length thresholds (FAQs vary widely in width). Reflowable layouts:
- `list` — a bulleted/numbered run becomes **one block per item**: each wraps under its own marker and items are never merged into each other. A lead-in line before the first marker becomes its own paragraph, so it isn't stranded at the verbatim size.
- `block` — a wrapped paragraph. Continuation lines share one indent (`padLeft`); the first line is free, so a paragraph indent (first line in) or hanging indent (first line out) both survive.
- `hanging` — a label/definition item: one label, then a body at a consistent hang column (`TALK:` / `-----` / body…). The label is kept; decorative label-column content on later lines (a `-----` underline) is dropped. Requires exactly **one** meaningful label — a second (`Q:`/`A:`) means separate items, so leave verbatim.

**Two questions, not one** — see CLAUDE.md. *Could* it wrap (gets a ¶) and *should* it, unasked (`reflow.defaultOn`)?
- **No ¶ at all** (pure `art`): not text-dominated (<60% letters), any decorative line (art chars > .5, dotted leaders, or letters fenced by pipes — `|e|l|e|c|`), an aligned column (a shop/stat table), ≥2 list markers that aren't a clean list, narrower than ~40 cols (nothing to fix), or a run of box characters beside text (a **floated box** — a drawing with prose flowing next to it on the same lines; it sits *just under* the decorative threshold and would otherwise merge borders into the prose). That last check lives **below** the hanging path on purpose, or a label's `-----` underline would trip it.
- **¶ on, reflowed unasked** (`defaultOn`): confidently a hard-wrapped paragraph — every line but the last is full, indents are consistent, long enough.
- **¶ off, verbatim**: everything else text-shaped. One tap from wrapped, nothing mangled meanwhile.

Order is load-bearing in `piecesForRun`: confident prose → `splitHeading` → standalone fallback. Reversed, an ambiguous block swallows the heading before it can be split off. `splitHeading` takes **exactly one** short line: greedily taking every short line ate a table's narrow rows, and the similar-length survivors then read as a paragraph and merged.

**Reflow override model** (`domains/document`): only the user's deviations are stored, per FAQ: `Record<blockId, boolean>`. Effective = `override ?? reflow.defaultOn`. Persisted; survives reload.

**Scroll bookmark** (`domains/reader`): persist an **anchor** = `{ blockId, fraction }` of top-most visible block, NOT raw scrollTop — robust to font-size / reflow changes. Throttled write; restore once the layout has *settled*, not on mount (see CLAUDE.md — the art font lands a render late).

**Search** (`lib/search` + `features/reader/DocumentSearch`): two ways into one sheet — select text (count pill) or the header magnifier (type a term). The sheet header IS the query input, so a selection arrives pre-filled and editable. Tap a hit → scroll to its block + brief highlight. Our own UI: painful mobile browser find is the thing we're replacing.

## Phases (status: `[ ]` todo · `[~]` wip · `[x]` done)

- [x] **P0 Scaffold** — Vite+RR8(fw mode,`ssr:false`)+TS6+Tailwind4, pnpm, Vitest, depcruise boundaries (13 mod, 0 violations), layer dirs, `404.html`, `deploy:gh`. Verified: typecheck/build/depcruise/test green; dev server 200 on `:5174/faqminder/`. PWA SW → P7.
- [x] **P1 Storage + import** — Dexie (`domains/library`, split faqs/contents tables), `lib/encoding` (BOM + CP1252 + mojibake repair), `lib/filename`, `features/import` + `features/library`. Tests: encoding/filename units + import→persist→list integration (fake-indexeddb). 10 green.
- [x] **P2 Reader + switch** — `lib/parse` block splitter (all `art` until P6), `features/reader` renders verbatim mono blocks w/ `data-block-id` (anchor/search hooks), `faq.$id` route via `clientLoader` reading IndexedDB + ErrorBoundary. Switch = navigation. Tests: parse units + reader render (exact ASCII preserved). 17 green. NB: `domains/document` deferred to P6 (parse is pure/ephemeral for now).
- [x] **P3 Scroll bookmark** — `domains/db` (centralized Dexie, v2 adds readerState), `domains/reader` persistence, `lib/scroll` anchor geometry (unit-tested), `useScrollBookmark` restores pre-paint + saves throttled on scroll & on pagehide/visibility-hidden (mobile purge). Reader keyed by faqId. 22 green.
- [x] **P4 Formatting** — **two sizes**: prose (per-doc, persisted, A−/A+ via `--prose-font`) and a separate size for unwrappable art — shrunk to fit the 95th-percentile art width (`artFit`, per-doc, default on, toggled in reader options) or `ART_FONT` with per-block scroll. Resize preserves the top-of-viewport anchor (`overflow-anchor:none` — native anchoring is absent on iOS Safari). Per-document persisted font size (in `readerState`, loaded via clientLoader, merge-patched alongside scroll anchor), `FormattingControls` A−/A+ stepper (controlled) in reader header. Different docs keep their own base size (ASCII width varies). Line-height fixed — utilitarian.
- [x] **P5 Search** — `lib/search` (case-insensitive, per-block hits w/ context, unit-tested), `DocumentSearch` (co-located): two entry points into one sheet — select text → count pill, or the header button → type a term. Sheet header IS the query input (selection arrives pre-filled, stays editable); tap a hit to jump + flash. Input is 16px so iOS never zooms on focus.
- [x] **P6 Prose reflow** — `lib/parse` conservative classifier (`block` + `hanging` layouts; tab expansion; table/TOC/decoration guards; verified across all 8 fixtures), `reflowText`, `domains/document` override persistence (db v3 docState), `BlockView` renders art verbatim / prose reflowed-with-¶-toggle, default-on. Prose wraps to viewport; art scrolls per-block. Verified in-browser via the `browser` test project. NB: floated boxes now actively guarded (a run of box chars beside text), not merely unlucky.
- [x] **P7 PWA + polish** — SW via post-build Workbox (`scripts/build-sw.mjs`, precache 18 files, navigateFallback), client-only registration in root, manifest + SVG icon. Real-browser E2E (`scripts/verify-e2e.mjs`, 13 checks: import→reader→font→reflow→selection-jump→scroll-restore-across-reload→list) + offline verify (`scripts/verify-offline.mjs`, SW serves shell with network cut) both pass. Empty/error/busy states in place.

Each phase = its own commit(s). Update this table + note surprises before ending a session.

## Since P7 (the original plan is complete; this is where the work actually is)

Driven by reading real FAQs on a phone. Roughly in order:
- **Deploy is gated** — `pnpm deploy:gh` runs every check then ships the checked artifact; `pnpm check` is the same without shipping.
- **`/faqminder` (no trailing slash)** 404'd — fixed at the HTTP layer, not the router (see Deploy in CLAUDE.md).
- **Update notifications** — `domains/version` + `features/app-update`: poll `version.json`, offer a hard refresh. Beat the n+1 problem where a new SW only lands on the *next* load.
- **Font**: per-document, not global. Prose-only sizing (`--prose-font`); art gets its own size, fitted to the 95th-percentile art width. Both preserve the top-of-viewport anchor.
- **Search**: manual input added beside selection-search; one shared sheet.
- **Parser**, the long tail — tabs, blank lines not bounding blocks, per-item list reflow, floated boxes, the two-question ¶ model. Every one of these came from a screenshot of a real document, not from reasoning.
- **Tests**: Vitest browser project (real layout) + corpus snapshots over every fixture block.

## Resume protocol

1. Read this file + `adrs/`. 2. `git log --oneline` for recent work. 3. Pick up "Open questions" below (the P0–P7 table is history, all done). 4. Update this file before stopping.

## Open questions

- **"Wrap all text" — proposed, undecided, not built.** ¶ turns out to mean "render this at the reading size, wrapping as needed", NOT "this is prose" — which is why TOC entries, headings and menu lists all want one. Tapping ¶ on 40 TOC entries is untenable, so: a per-document switch in reader options that flips on every block that *has* a ¶ (`override ?? (defaultOn || wrapAll)`). Rejected alternatives: hold-to-apply-to-similar (needs a similarity model, hidden gesture, mass-applies mistakes) and a block hierarchy with apply-to-children (a second parser to patch the first one's failures). The switch adds **no new inference**, so it can't be wrong in a new way. Small: one persisted flag, one switch, one term — reuse `rememberViewport` so the viewport doesn't jump.
- **The classifier will never be perfect** — that's the premise, not a defect. Prefer widening what gets a ¶ (cheap, reversible) over sharpening the guess (expensive, and each new rule risks a regression the counts won't show).
- **No virtualisation.** Biggest fixtures render ~1.4k blocks with no trouble; revisit only if a real document drags.
- **Floated boxes render verbatim.** Reflowing the prose column while dropping the float is the real fix; today they're only *protected* from being mangled.
- Verification never touches a real GitHub Pages host — the base-path redirect is modelled locally. Confirm on the first deploy.
