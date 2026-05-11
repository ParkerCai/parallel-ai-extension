import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

import manifest from "./manifest.json";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
    },
  },
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        multipanel: "multi-panel/index.html",
      },
    },
  },
});
