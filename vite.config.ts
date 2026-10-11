import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    // Format staged files on commit; the full gate runs on push.
    "*": "vp fmt -c .oxfmtrc.json --no-error-on-unmatched-pattern",
  },
});
