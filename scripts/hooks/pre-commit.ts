/**
 * pre-commit — L0 dispatcher.
 *
 * Wiring only: guard, format, then run the `preCommit` policy from
 * `hooks.config.ts`. No check logic lives in this file.
 */

import { commitContext, planChecks, preCommit, protectedBranches, runChecks } from "./context.ts";
import { gitQuiet, repoRoot } from "./lib/git.ts";
import { capOutput, runCommand } from "./lib/runner.ts";

const root = repoRoot();
const ctx = commitContext(root);

// Guard before the empty-index exit, so `git commit --allow-empty` on the
// default branch is still refused.
const branch = gitQuiet(["symbolic-ref", "--quiet", "--short", "HEAD"], root)?.trim() ?? "";
if (protectedBranches(root).includes(branch)) {
  if (process.env["ALLOW_MAIN"] !== "1") {
    process.stderr.write(
      `pre-commit: refusing to commit directly on '${branch}'.\n` +
        "  Create a branch first:  git switch -c <branch-name>\n" +
        "  Override once with:    ALLOW_MAIN=1 git commit ...\n",
    );
    process.exit(1);
  }
  process.stderr.write(`pre-commit: ALLOW_MAIN=1 set — committing on '${branch}'\n`);
}

if (ctx.staged.length === 0) {
  process.stderr.write("pre-commit: nothing staged; skipping\n");
  process.exit(0);
}

const formatted = await runCommand("vp", ["staged"], {
  cwd: root,
  env: ctx.env,
  timeoutMs: 180_000,
});
if (formatted.code !== 0) {
  process.stderr.write(
    `pre-commit: formatting staged files failed\n${capOutput(formatted.output)}\n`,
  );
  process.exit(1);
}

process.exit(await runChecks({ label: "pre-commit", checks: planChecks(preCommit, ctx) }));
