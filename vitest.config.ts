import "vite-plus/test/config";

import { defineConfig } from "vite-plus";

// Unit tests for the git-hook policy layer (scripts/hooks). These run in the
// root workspace only; each app/package owns its own Vitest config.
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
  },
});
