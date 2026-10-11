import { existsSync } from "node:fs";
import { join } from "node:path";

import { mergeBaseResolves } from "../lib/git.ts";
import { commandCheck, skip, type CheckOutcome } from "../lib/runner.ts";
import type { HandlerSpec, HookContext } from "../lib/types.ts";

/**
 * Secret scanning over the commits being pushed.
 *
 * Range semantics here are deliberately two-dot (`base..tip`) and differ from
 * the three-dot form used for conflict markers. `git log base..tip` is exactly
 * the set of commits being introduced — the push commits, or on a merge the
 * incoming branch's commits — which is what a secret scanner needs. Three-dot
 * would also drag in commits that landed on the other side after the branch
 * point: someone else's secrets, already scanned.
 */
export async function secretScan(ctx: HookContext, spec: HandlerSpec): Promise<CheckOutcome> {
  const args =
    ctx.base === null
      ? ["git", "--no-banner", "--redact=50", "--exit-code=1"]
      : [
          "git",
          "--no-banner",
          "--redact=50",
          "--exit-code=1",
          "--log-opts",
          `${ctx.base}..${ctx.tip}`,
        ];

  // `.gitleaks.toml` carries the default rules plus a narrow test-fixture
  // exception; without it this check reports its own test suite as a leak.
  args.push("--config", ".gitleaks.toml");

  return commandCheck("gitleaks", args, spec.timeoutMs ?? 300_000, {
    cwd: ctx.root,
    env: ctx.env,
    ...(spec.onMissing === undefined ? {} : { onMissing: spec.onMissing }),
    ...(spec.installHint === undefined ? {} : { installHint: spec.installHint }),
  });
}

/**
 * Dependency vulnerability scan.
 *
 * This reports every advisory in the lockfile, including transitive ones you
 * did not introduce. Treat a hit here as a triage signal; CI is where a
 * blocking CVE gate belongs.
 */
export async function dependencyScan(ctx: HookContext, spec: HandlerSpec): Promise<CheckOutcome> {
  return commandCheck(
    "osv-scanner",
    ["scan", "source", "--lockfile=pnpm-lock.yaml", "--format=vertical", "--verbosity=error"],
    spec.timeoutMs ?? 300_000,
    {
      cwd: ctx.root,
      env: ctx.env,
      ...(spec.onMissing === undefined ? {} : { onMissing: spec.onMissing }),
      ...(spec.installHint === undefined ? {} : { installHint: spec.installHint }),
    },
  );
}

/** Semgrep rules from `.semgrep/`, scoped to the push range when possible. */
export async function staticAnalysis(ctx: HookContext, spec: HandlerSpec): Promise<CheckOutcome> {
  const args = [
    "scan",
    "--config",
    ".semgrep",
    "--metrics=off",
    "--disable-version-check",
    "--error",
    "--exclude=node_modules",
    "--exclude=dist",
    "--exclude=dist-electron",
    "--exclude=release",
    "--exclude=.vite-plus",
  ];
  if (ctx.base !== null) args.push("--baseline-commit", ctx.base);

  return commandCheck("semgrep", args, spec.timeoutMs ?? 600_000, {
    env: ctx.env,
    ...(spec.onMissing === undefined ? {} : { onMissing: spec.onMissing }),
    ...(spec.installHint === undefined ? {} : { installHint: spec.installHint }),
  });
}

/** Codacy analysis. Opt-in: needs `.codacy/codacy.yaml` and the CLI. */
export async function codacy(ctx: HookContext, spec: HandlerSpec): Promise<CheckOutcome> {
  if (!existsSync(join(ctx.root, ".codacy", "codacy.yaml"))) {
    return skip("not configured — run `codacy-cli init` to generate .codacy/codacy.yaml");
  }
  return commandCheck("codacy-cli", ["analyze"], spec.timeoutMs ?? 600_000, {
    cwd: ctx.root,
    env: ctx.env,
    ...(spec.onMissing === undefined ? {} : { onMissing: spec.onMissing }),
    ...(spec.installHint === undefined ? {} : { installHint: spec.installHint }),
  });
}

/** CodeRabbit review. Advisory and LLM-driven, so it is opt-in. */
export async function coderabbit(ctx: HookContext, spec: HandlerSpec): Promise<CheckOutcome> {
  if (process.env["CODERABBIT_ADVISORY"] !== "1") {
    return skip("advisory only (LLM-driven) — enable with CODERABBIT_ADVISORY=1");
  }
  if (ctx.base === null) return skip("no push base resolved");
  return commandCheck(
    "coderabbit",
    ["review", "--base-commit", ctx.base],
    spec.timeoutMs ?? 1_800_000,
    {
      cwd: ctx.root,
      env: ctx.env,
      ...(spec.onMissing === undefined ? {} : { onMissing: spec.onMissing }),
      ...(spec.installHint === undefined ? {} : { installHint: spec.installHint }),
    },
  );
}

/**
 * `--changed` selection silently returns nothing when the push base cannot be
 * resolved, which happens on a shallow clone: `git merge-base` finds nothing,
 * vitest reports "No test files found", and it exits 0. Verify the merge base
 * resolves before trusting an affected-test run.
 */
export function shallowCloneGuard(ctx: HookContext): CheckOutcome | null {
  if (ctx.base === null) return null;
  if (mergeBaseResolves(ctx.root, ctx.base, ctx.tip)) return null;
  return {
    status: "failed",
    output:
      `cannot compute a merge base over ${ctx.base.slice(0, 8)}..${ctx.tip.slice(0, 8)} — affected-test selection ` +
      "would silently run nothing.\n  Fetch full history first:  git fetch --unshallow",
  };
}
