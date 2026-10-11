import "vite-plus/test/config";

import { defineConfig } from "vite-plus";

// Electron loads .node prebuilds from disk, so natives stay external.
const MAIN_PROCESS_EXTERNALS = [
  "electron",
  "@napi-rs/keyring",
  "@crowecawcaw/xa11y",
  "dbus-next",
  "ffi-rs",
];

const isExternal = (id: string): boolean =>
  MAIN_PROCESS_EXTERNALS.some((pkg) => id === pkg || id.startsWith(`${pkg}/`));

export default defineConfig({
  run: {
    tasks: {
      dev: { command: "tsx scripts/dev.ts", cache: false },
      build: {
        command: "vp pack && tsx scripts/sync-renderer.ts",
        dependsOn: ["@ado/renderer#build"],
        cache: false,
      },
    },
  },
  pack: [
    {
      // One self-contained CJS per entry: the sandboxed preload cannot resolve
      // package imports from inside the ASAR.
      format: "cjs",
      outDir: "dist-electron",
      dts: false,
      sourcemap: true,
      outExtensions: () => ({ js: ".cjs" }),
      outputOptions: { codeSplitting: false },
      entry: ["src/main.ts"],
      clean: true,
      deps: {
        alwaysBundle: (id) => !id.startsWith("node:") && !isExternal(id),
        neverBundle: isExternal,
        onlyBundle: false,
      },
    },
    {
      format: "cjs",
      outDir: "dist-electron",
      dts: false,
      sourcemap: true,
      outExtensions: () => ({ js: ".cjs" }),
      outputOptions: { codeSplitting: false },
      entry: ["src/preload.ts"],
      clean: false,
      deps: {
        alwaysBundle: (id) => !id.startsWith("node:") && !isExternal(id),
        neverBundle: isExternal,
        onlyBundle: false,
      },
    },
  ],
  // e2e specs run under Playwright.
  test: {
    include: ["test/unit/**/*.test.{ts,tsx}", "test/integration/**/*.test.{ts,tsx}"],
  },
});
