/**
 * pre-push — L0 dispatcher.
 *
 * Wiring only: resolve the push base, build context, run the `prePush` policy
 * from `hooks.config.ts`. No check logic lives in this file.
 */

import { planChecks, prePush, pushContext, runChecks } from "./context.ts";
import { repoRoot } from "./lib/git.ts";
import { readPushRefs, resolvePushBase } from "./lib/push.ts";

const root = repoRoot();
const remote = process.argv[2] ?? "origin";
const base = resolvePushBase(root, remote, await readPushRefs());

process.stderr.write(
  base === null
    ? "pre-push: no push base resolved — running full checks\n\n"
    : `pre-push: range ${base.slice(0, 8)}..HEAD (${pushContext(root, base).changed.length} files)\n\n`,
);

const ctx = pushContext(root, base);
process.exit(await runChecks({ label: "pre-push", checks: planChecks(prePush, ctx) }));
