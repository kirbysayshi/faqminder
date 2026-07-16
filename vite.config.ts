import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// NOTE: base drives both Vite asset paths and the RR basename (react-router.config.ts).
// Override via VITE_BASE for a different repo/domain.
const base = process.env.VITE_BASE ?? "/faqminder/";

// Service worker / Workbox is wired in P7 (offline phase): vite-plugin-pwa needs
// special handling of RR framework mode's per-environment outDir (build/client).
export default defineConfig({
  base,
  resolve: {
    alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) },
  },
  plugins: [tailwindcss(), reactRouter()],
});
