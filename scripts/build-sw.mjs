// Generates the service worker after `react-router build`. Done as a post-build
// step (not vite-plugin-pwa) because RR framework mode's per-environment outDir
// (build/client) doesn't play well with the plugin. SPA shell is precached;
// FAQ content lives in IndexedDB, not the SW cache.
import { generateSW } from "workbox-build";

const base = process.env.VITE_BASE ?? "/faqminder/";

const { count, size, warnings } = await generateSW({
  globDirectory: "build/client",
  globPatterns: ["**/*.{js,css,html,svg,woff2,webmanifest}"],
  swDest: "build/client/sw.js",
  navigateFallback: `${base}index.html`,
  navigateFallbackDenylist: [/\/404\.html$/],
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
});

for (const w of warnings) console.warn(w);
console.log(`SW precached ${count} files, ${(size / 1024).toFixed(1)} KiB.`);
