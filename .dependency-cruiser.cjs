/**
 * Enforces the layer boundaries from adrs/0001-structure.md.
 * Direction: routes -> features -> domains -> lib. components are pure.
 * Run: pnpm depcruise
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies break the unidirectional layer model.",
      from: {},
      to: { circular: true },
    },
    {
      name: "lib-is-pure",
      severity: "error",
      comment: "lib/ is stateless: no imports from any other app layer (ADR 0001).",
      from: { path: "^app/lib/" },
      to: { path: "^app/(features|domains|components|store|routes)/" },
    },
    {
      name: "components-are-pure",
      severity: "error",
      comment: "components/ import lib/ only — no state or feature deps (ADR 0001).",
      from: { path: "^app/components/" },
      to: { path: "^app/(features|domains|store|routes)/" },
    },
    {
      name: "domains-no-jsx-layers",
      severity: "error",
      comment: "domains/ may use other domains + lib only (ADR 0001).",
      from: { path: "^app/domains/" },
      to: { path: "^app/(features|components|store|routes)/" },
    },
    {
      name: "features-no-routes",
      severity: "error",
      comment: "features/ must not import routes/ (ADR 0001).",
      from: { path: "^app/features/" },
      to: { path: "^app/routes/" },
    },
    {
      name: "routes-skip-components",
      severity: "error",
      comment: "routes/ compose features/domains/lib; promote shared UI through a feature.",
      from: { path: "^app/routes/" },
      to: { path: "^app/components/" },
    },
    {
      name: "public-api-only",
      severity: "error",
      comment:
        "Cross-folder imports must target a subfolder's index/types barrel (ADR 0001 public API).",
      from: { path: "^(app/(?:domains|features|components|lib)/[^/]+/)" },
      to: {
        path: "^app/(?:domains|features|components|lib)/[^/]+/",
        pathNot: ["$1", "(?:index|types)\\.(?:ts|tsx)$"],
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
    },
    exclude: { path: "\\.(test|spec)\\.(ts|tsx)$" },
  },
};
