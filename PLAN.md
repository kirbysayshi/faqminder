# FAQMiner — Build Plan

Offline-first PWA for reading game-FAQ text walkthroughs. Local-only (no server), deployed static to GitHub Pages. This file is the **cross-session source of truth**: keep the Phase Status table current so any session can resume. Detail lives in code — this is a pointer, not a spec.

## Locked decisions

| Concern | Choice | Notes |
|---|---|---|
| Build | Vite + React + TS, pnpm | |
| Routing | React Router 7 **framework mode**, `ssr:false`, `prerender:['/']` | SPA static export; `base=/faqminder/`; `404.html` SPA fallback for deep links |
| State | **Jotai** (reactive/ephemeral atoms) | matches ADR "atoms" |
| Persistence | **Dexie** (IndexedDB) + `dexie-react-hooks` `useLiveQuery` | FAQ blobs + parsed model + per-doc reader state |
| Styling | Tailwind (utilitarian, terse UI) | |
| Offline | `vite-plugin-pwa` (precache app shell) | FAQ content already in IndexedDB |
| Layers | per `adrs/0001-structure.md` | enforced by dependency-cruiser + eslint-plugin-import |
| Tests | Vitest — pure `lib/` fns against real `fixtures/` | parse/encoding/search are highest value |
| Deploy | `gh-pages` manual (user handles repo/CI) | no GitHub Actions for now |

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
Split to lines → group by blank-line boundaries into blocks → classify each `prose | other`. Mark `prose` only when **confident** (conservative): ≥2 lines, consistent left indent, line lengths clustered ~[40,80], high alpha ratio, and NO art signatures (runs of `| _ / \ = + . : ~`, dotted leaders, box-drawing). Everything else stays `other` = rendered `<pre>` verbatim. Prose blocks: join wrapped lines → soft-wrap; render a small toggle icon above; user can force off/on. Never auto-reflow ASCII art.

**Reflow override model** (`domains/document`): store per-FAQ `{ auto: blockId[], overrides: Record<blockId, boolean> }`. Effective = override ?? auto-membership. Persisted; survives reload.

**Scroll bookmark** (`domains/reader`): persist an **anchor** = `{ blockId, fraction }` of top-most visible block, NOT raw scrollTop — robust to font-size / reflow changes. Throttled write; restore on mount before paint.

**Selection search** (`lib/search` + `features/selection-search`): on non-empty selection, find all case-insensitive occurrences with context snippets; overlay lists them; tap → scroll to occurrence's block + brief highlight. Own overlay (native mobile find is the thing we're replacing).

## Phases (status: `[ ]` todo · `[~]` wip · `[x]` done)

- [ ] **P0 Scaffold** — Vite+RR7+TS+Tailwind+PWA, pnpm, Vitest, dependency-cruiser boundaries, layer dirs, `404.html`, deploy script. Verify dev server + build.
- [ ] **P1 Storage + import** — Dexie schema (`domains/library`), `lib/encoding`, `features/import` file input → decode → save. List FAQs.
- [ ] **P2 Reader + switch** — `lib/parse` block model, `domains/document`, `features/reader` renders blocks; `_index` picker + `faq.$id` route; switch active FAQ.
- [ ] **P3 Scroll bookmark** — anchor persistence + restore.
- [ ] **P4 Formatting** — font size / line-height controls, persisted, applied via CSS vars.
- [ ] **P5 Selection search** — `lib/search`, overlay, jump-to-instance + highlight.
- [ ] **P6 Prose reflow** — classifier at import, per-block toggle icon, override persistence.
- [ ] **P7 PWA + polish** — manifest/icons, offline verify, empty/error states, end-to-end verify against fixtures.

Each phase = its own commit(s). Update this table + note surprises before ending a session.

## Resume protocol

1. Read this file + `adrs/`. 2. `git log --oneline` to see last committed phase. 3. Continue first `[ ]`/`[~]` phase. 4. Update Phase Status before stopping.

## Open questions / risks

- Large fixtures (Dragon Warrior IV ~6.8k lines): may need windowing/virtualization in `features/reader` (defer to P7 if perf is fine).
- Fatal Frame fixture has BOM + Windows-1252 mojibake → `lib/encoding` must detect, not assume UTF-8.
- Mobile: custom selection overlay coexisting with native selection menu — validate on device in P5.
- RR7 framework `ssr:false` + prerender + GH Pages base path + deep-link 404 shim — validate in P0.
