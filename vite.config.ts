/// <reference types="vitest/config" />
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import { fileURLToPath } from "node:url";

// NOTE: base drives both Vite asset paths and the RR basename (react-router.config.ts).
// Override via VITE_BASE for a different repo/domain.
const base = process.env.VITE_BASE ?? "/faqminder/";

// The reactRouter plugin expects a route-build context, so it's excluded under
// Vitest — tests exercise pure lib/domains + component render, not route modules.
const testing = !!process.env.VITEST;

// Vite's dev server 404s on the base path without its trailing slash. GitHub Pages
// redirects that to the slash form, so mirror it in dev — otherwise "/faqminder"
// works in production but not locally.
function baseRedirect(): Plugin {
  const bare = base.replace(/\/+$/, "");
  return {
    name: "faqminder:base-redirect",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (bare && req.url === bare) {
          res.writeHead(301, { Location: base });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

// Service worker / Workbox is generated post-build (scripts/build-sw.mjs), not by
// a plugin: vite-plugin-pwa fights RR framework mode's per-environment outDir.
export default defineConfig({
  base,
  resolve: {
    alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) },
  },
  plugins: [tailwindcss(), !testing && reactRouter(), baseRedirect()],
  test: {
    passWithNoTests: true, // root-level only; not a per-project option
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./app/test/setup.ts"],
          include: ["app/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["app/**/*.browser.test.{ts,tsx}"],
        },
      },
      {
        // Layout/visual tests. jsdom has no layout engine, so wrapping, alignment
        // and overflow can ONLY be verified in a real browser.
        extends: true,
        test: {
          name: "browser",
          globals: true,
          setupFiles: ["./app/test/setup.browser.ts"],
          include: ["app/**/*.browser.test.{ts,tsx}"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            screenshotDirectory: "scratch-shots",
            instances: [
              // Phone-sized: the app is mobile-first and that's where wrapping bites.
              { browser: "chromium", viewport: { width: 390, height: 800 } },
            ],
          },
        },
      },
    ],
  },
});
