/**
 * pre-merge-commit — L0 dispatcher.
 *
 * Git has no `pre-merge` hook. This is the merge-stage one: it runs after a
 * non-fast-forward merge is resolved and before the merge commit is created.
 * Wiring only — policy comes from the `preMergeCommit` list in hooks.config.ts.
 */

import { mergeContext, planChecks, preMergeCommit, runChecks } from "./context.ts";
import { repoRoot } from "./lib/git.ts";

const root = repoRoot();
const ctx = mergeContext(root);

// No MERGE_HEAD means this is not a merge in progress (for example a manual
// invocation). Nothing to validate, and failing here would be noise.
if (ctx === null) {
  process.stderr.write("pre-merge-commit: no merge in progress; skipping\n");
  process.exit(0);
}

process.stderr.write(
  `pre-merge-commit: range ${ctx.base}...${ctx.tip.slice(0, 8)} (${ctx.changed.length} files)\n\n`,
);

process.exit(
  await runChecks({ label: "pre-merge-commit", checks: planChecks(preMergeCommit, ctx) }),
);
