import { join } from "node:path";

import {
  checkConflictMarkersInRange,
  checkConflictMarkersStaged,
  checkDebugStatements,
  checkLargeFiles,
  checkPrivateKeys,
  policyCheck,
} from "../lib/policy.ts";
import { commandCheck, skip, type CheckOutcome } from "../lib/runner.ts";
import type { HookContext } from "../lib/types.ts";
import { shallowCloneGuard } from "./security.ts";

const APP_BUILD_FILES =
  /(?:^|\/)(?:vite\.config\.ts|playwright\.config\.ts|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml)$/;
const APP_SOURCE_DIRS = /^(?:apps\/desktop|apps\/renderer|packages\/shared)\//;

/** Staged-diff hygiene: debug statements, secrets, oversized blobs, conflicts. */
export function debugStatements(ctx: HookContext): Promise<CheckOutcome> {
  return policyCheck(() => checkDebugStatements(ctx.root, ctx.staged));
}

export function privateKeys(ctx: HookContext): Promise<CheckOutcome> {
  return policyCheck(() => checkPrivateKeys(ctx.root));
}

export function largeFiles(ctx: HookContext): Promise<CheckOutcome> {
  return policyCheck(() => checkLargeFiles(ctx.root));
}

export function conflictMarkersStaged(ctx: HookContext): Promise<CheckOutcome> {
  return policyCheck(() => checkConflictMarkersStaged(ctx.root, ctx.staged));
}

/**
 * Conflict markers across the push range.
 *
 * Three-dot (`base...tip`) is correct here, unlike the two-dot form gitleaks
 * uses: this answers "what does this range introduce relative to the merge
 * base", which is what an unresolved marker looks like. Two-dot would also
 * flag markers already present on the other side of the range.
 */
export function conflictMarkersInRange(ctx: HookContext): Promise<CheckOutcome> {
  // A merge has no range to walk, but the index holds the resolved result, so
  // scanning it catches markers that survived conflict resolution.
  if (ctx.mode === "merge") {
    return policyCheck(() => checkConflictMarkersStaged(ctx.root, ctx.changed));
  }
  if (ctx.base === null) return Promise.resolve(skip("no push base resolved"));
  return policyCheck(() => checkConflictMarkersInRange(ctx.root, `${ctx.base}...HEAD`));
}

/**
 * End-to-end tests.
 *
 * Build and Playwright are a dependent chain: only build when the range actually
 * touched app code, and only run Playwright if the build succeeded.
 */
export async function endToEndTests(ctx: HookContext): Promise<CheckOutcome> {
  if (process.env["SKIP_E2E"] === "1") return skip("SKIP_E2E=1");
  if (ctx.base === null) {
    return skip("no push base resolved — run `pnpm test:e2e` manually");
  }

  const touchesApp = ctx.changed.some(
    (file) => APP_SOURCE_DIRS.test(file) || APP_BUILD_FILES.test(file),
  );
  if (!touchesApp) return skip("no app or build changes in push range");

  const guard = shallowCloneGuard(ctx);
  if (guard !== null) return guard;

  const build = await commandCheck("vp", ["run", "--filter", "@ado/desktop", "build"], 600_000, {
    env: ctx.env,
    cwd: ctx.root,
  });
  if (build.status !== "passed") {
    return { status: build.status, output: `build failed\n${build.output}` };
  }

  return commandCheck(
    join(ctx.root, "apps/desktop/node_modules/.bin/playwright"),
    ["test", "--only-changed", ctx.base, "--pass-with-no-tests"],
    600_000,
    { cwd: join(ctx.root, "apps/desktop"), env: ctx.env },
  );
}
