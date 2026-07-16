# FAQMiner — conventions

`PLAN.md` is the cross-session source of truth (phases + resume protocol). `adrs/` holds architecture decisions. This file = durable conventions not obvious from code.

## Product
- **Mobile-first, offline-first.** Primary target is mobile, where tabs get purged from memory. **Persistence is load-bearing**: every bit of reader state (active FAQ, scroll anchor, font size, reflow overrides) must survive a cold reload.

## Architecture
- Layers per `adrs/0001-structure.md`: `routes → features → domains → lib`; `components` are pure. Import only a subfolder's `index.ts`/`types.ts` barrel.
- Boundaries are enforced — run `pnpm depcruise`. Violations are errors.
- Prose reflow runs **once at import**, is conservative, and preserves visual intent; never auto-reflow ASCII art. See `PLAN.md`.

## Tooling
- **pnpm only.** Add deps with `pnpm add <pkg>@latest` — never hand-pick versions. `pnpm-workspace.yaml` sets `savePrefix:''` (exact pins) and pre-approves `esbuild` builds. Build-script approval (`pnpm approve-builds`) is interactive — do not attempt it non-interactively; surface to the user if a new dep needs it.
- **TypeScript is pinned to 6.x, NOT latest (7.x).** TS 7 is the native compiler but dependency-cruiser (and much boundary/lint tooling) only supports `<7` as of this writing, and it silently cruises 0 modules under TS 7. Revisit the upgrade once the toolchain supports TS 7.
- **Long-running tasks run in tmux** (dev server, verification). **Never assume the Vite port** — another Vite project already runs on 5173, so RR dev picks 5174+. Read the actual port from the tmux pane output.

## Deploy
- Static SPA → GitHub Pages via `pnpm deploy:gh` (manual; no CI). Base path is `VITE_BASE` (default `/faqminder/`) in `vite.config.ts` + `react-router.config.ts`. `build/client/404.html` is the SPA deep-link fallback (copied from `index.html` at build).
