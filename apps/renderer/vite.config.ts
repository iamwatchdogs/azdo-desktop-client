import "vite-plus/test/config";

import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  // Loaded over file:// when packaged, so asset URLs must be relative.
  base: "./",
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
    dedupe: ["react", "react-dom"],
    tsconfigPaths: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    // Electron's BrowserWindow needs the HMR socket pinned for a reliable connection.
    hmr: {
      protocol: "ws",
      host: "localhost",
      clientPort: 5173,
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}"],
    testTimeout: 15_000,
  },
});
