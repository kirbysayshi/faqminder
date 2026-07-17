/// <reference types="vitest/config" />
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// NOTE: base drives both Vite asset paths and the RR basename (react-router.config.ts).
// Override via VITE_BASE for a different repo/domain.
const base = process.env.VITE_BASE ?? "/faqminder/";

// The reactRouter plugin expects a route-build context, so it's excluded under
// Vitest — tests exercise pure lib/domains + component render, not route modules.
const testing = !!process.env.VITEST;

// Service worker / Workbox is generated post-build (scripts/build-sw.mjs), not by
// a plugin: vite-plugin-pwa fights RR framework mode's per-environment outDir.
export default defineConfig({
  base,
  resolve: {
    alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) },
  },
  plugins: [tailwindcss(), !testing && reactRouter()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./app/test/setup.ts"],
    include: ["app/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
  },
});
