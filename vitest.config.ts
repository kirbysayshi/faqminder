import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Separate from vite.config: tests exercise pure lib/domains logic, so we skip
// the reactRouter plugin (which expects a route build context).
export default defineConfig({
  resolve: {
    alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./app/test/setup.ts"],
    include: ["app/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
  },
});
