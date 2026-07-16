# App Structure / Layers

Date: 2026-07-16
Status: accepted

## Decision

```
app/
  routes/       # Route entry points (React Router v7) — compose features, no business logic
  features/     # Containers, co-located components, cross-domain hooks — all JSX-adjacent code
  domains/      # Pure state: atoms, queries, mutations, single-domain hooks — no JSX ever
  components/   # Pure UI promoted from features — props only, no state library imports
  store/        # Provider setup, store utilities
  lib/          # Stateless utilities — no app imports, no state management / store
```

**The JSX rule** — does this file contain or return JSX?

- Yes → features/ (or components/ once promoted)
- No → domains/

Feature hooks that compose domain hooks and return data (no JSX) live in `features/` because they are UI-adjacent. When the same pure state logic is needed by multiple features, extract it to a domain.

**Import rules:**

```
routes/     →  features/, domains/, lib/
features/   →  components/, domains/, lib/
domains/    →  other domains, lib/  — no cycles
components/ →  lib/ only
lib/        →  external packages only
```

**Public API:** import only `index.ts` (runtime) or `types.ts` (type-only) from any layer subfolder. Internal file imports from outside the folder are a build error. Shared primitive types with no clear domain owner live in `lib/`.

**Cross-domain state:** domains may import from other domains ONLY when the dependency is one-directional. A higher-order domain derives pure state from foundational domains without creating cycles. Cross-domain hooks that shape data for a UI live in the feature, not the domain.

**Component lifecycle:** components start co-located inside the feature that first uses them. Promoted to `components/` ONLY when a second feature needs them. `components/` is always pure.

**Enforcement:** `dependency-cruiser` checks boundaries during build. `eslint-plugin-import` provides continuous editor feedback. Violations fail the build.

## Consequences

- Dependency unidirectional: `routes` → `features` → `domains` → `lib`. No cycles, enforced by tooling.
- Features are self-contained: containers, co-located components, and hooks travel together.
- Domains are JSX-free: pure state logic is testable without React.
- Components are structurally pure.
- `app/root.tsx` wires global providers; `app/routes/` are the entry points.