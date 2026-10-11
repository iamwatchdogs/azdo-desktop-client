import { preCommit, preMergeCommit, prePush } from "../../hooks.config.ts";
import { changedFilesInRange, gitQuiet, stagedFiles } from "./lib/git.ts";
import { hookEnv, optOutEnv, runChecks, runCommandSpec, skip, type Check } from "./lib/runner.ts";
import {
  isCommandSpec,
  isHandlerSpec,
  type CheckSpec,
  type CommandSpec,
  type HookContext,
} from "./lib/types.ts";
import { assertHandlersResolve, runHandler } from "./registry.ts";

/** Builds the `Check[]` a runner consumes from declarative specs. */
export function planChecks(specs: readonly CheckSpec[], ctx: HookContext): Check[] {
  const declared = specs.filter((spec) => isCommandSpec(spec) || isHandlerSpec(spec));
  const specsWithHandlers = declared.filter(isHandlerSpec);
  assertHandlersResolve(specsWithHandlers);

  return declared.map((spec) => {
    const optOut = optOutEnv(spec);
    if (optOut !== null) return { id: spec.id, run: async () => skip(optOut) };
    return isCommandSpec(spec)
      ? commandPlan(spec, ctx)
      : { id: spec.id, run: async () => runHandler(spec.handler, ctx, spec) };
  });
}

function commandPlan(spec: CommandSpec, ctx: HookContext): Check {
  return {
    id: spec.id,
    run: async () =>
      runCommandSpec(spec.cmd, spec.args, spec.timeoutMs, ctx, {
        ...(spec.cwd === undefined ? {} : { cwd: spec.cwd }),
        ...(spec.onMissing === undefined ? {} : { onMissing: spec.onMissing }),
        ...(spec.installHint === undefined ? {} : { installHint: spec.installHint }),
      }),
  };
}

export function commitContext(root: string): HookContext {
  return {
    root,
    env: hookEnv(root),
    mode: "commit",
    base: null,
    changed: [],
    staged: stagedFiles(root),
  };
}

export function pushContext(root: string, base: string | null): HookContext {
  return {
    root,
    env: hookEnv(root),
    mode: "push",
    base,
    changed: base === null ? [] : changedFilesInRange(root, `${base}...HEAD`),
    staged: [],
  };
}

/**
 * Context for `pre-merge-commit`.
 *
 * `MERGE_HEAD` does not exist yet when this hook runs — git writes the merge
 * state afterwards and passes no arguments. What is available is the index: the
 * merge has already been resolved and written, so `git diff --cached HEAD` is
 * exactly the content this merge introduces. That also holds for a merge
 * resolved by hand after a conflict.
 */
export function mergeContext(root: string): HookContext {
  const staged = stagedFiles(root);
  return {
    root,
    env: hookEnv(root),
    mode: "merge",
    base: "HEAD",
    changed: staged,
    staged,
  };
}

/** Default branch names to refuse committing on. */
export function protectedBranches(root: string): string[] {
  const configured = gitQuiet(["config", "--get", "init.defaultBranch"], root)?.trim();
  const names = new Set(["main", "master"]);
  if (configured !== undefined && configured !== "") names.add(configured);
  return [...names];
}

export { preCommit, preMergeCommit, prePush, runChecks };
