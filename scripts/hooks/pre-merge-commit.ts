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

// The index already holds the resolved merge result, so the comparison is
// against HEAD. An empty index means this fired outside a merge (a manual
// invocation, or a merge that changed nothing) — nothing to validate.
if (ctx.changed.length === 0) {
  process.stderr.write("pre-merge-commit: nothing staged; skipping\n");
  process.exit(0);
}

process.stderr.write(`pre-merge-commit: merge result vs HEAD (${ctx.changed.length} files)\n\n`);

process.exit(
  await runChecks({ label: "pre-merge-commit", checks: planChecks(preMergeCommit, ctx) }),
);
