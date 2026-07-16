import type { Config } from "@react-router/dev/config";

// Static SPA export for GitHub Pages. All data is client-side (IndexedDB),
// so there is no SSR value — prerender only the shell. `base` drives both
// Vite asset paths and the router basename; override via VITE_BASE for a
// different repo/domain (see vite.config.ts).
const base = process.env.VITE_BASE ?? "/faqminder/";

export default {
  ssr: false,
  basename: base,
} satisfies Config;
