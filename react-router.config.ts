import type { Config } from "@react-router/dev/config";

// Static SPA export for GitHub Pages. All data is client-side (IndexedDB),
// so there is no SSR value — prerender only the shell. `base` drives both
// Vite asset paths and the router basename; override via VITE_BASE for a
// different repo/domain (see vite.config.ts).
const base = process.env.VITE_BASE ?? "/faqminder/";

// basename MUST keep base's trailing slash: React Router requires `basename` to
// begin with Vite's `base`, and without it SPA mode silently skips generating
// build/client/index.html. The cost is that the router only matches "/faqminder/",
// not "/faqminder" — the trailing slash is added by a redirect at the HTTP layer
// (GitHub Pages does this for directory URLs; vite.config mirrors it in dev).
export default {
  ssr: false,
  basename: base,
} satisfies Config;
