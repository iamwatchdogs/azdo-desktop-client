/**
 * Git hook policy — the declarative layer.
 *
 * This file is DATA ONLY. It states which checks run, which binary runs them,
 * and what happens when that binary is missing. It contains no control flow:
 * branches, loops, and push-range computation live in `scripts/hooks/checks/`.
 *
 * `onMissing: "fail"` marks a security gate. If that binary is not installed
 * the hook blocks instead of skipping, because a silently-absent scanner still
 * produces a green build that someone will trust. Advisory tools that are
 * genuinely optional stay on the default `skip`.
 *
 * Escape hatches (all opt-in, none implied):
 *   VP_GIT_HOOKS=0        skip the hook entirely
 *   ALLOW_MAIN=1          allow committing on the default branch
 *   SKIP_OSV=1            skip the dependency scan
 *   SKIP_E2E=1            skip the Playwright end-to-end run
 *   CODERABBIT_ADVISORY=1 opt into the CodeRabbit LLM review
 */

import type { CheckSpec } from "./scripts/hooks/lib/types.ts";

/**
 * Runs on every commit. Budget: keep this under ~10s so it is never bypassed.
 *
 * `vp staged` formats and re-stages before these checks, so the tree a human
 * reviews is the tree that was linted.
 */
export const preCommit: readonly CheckSpec[] = [
  { id: "lint", cmd: "vp", args: ["lint", "-c", ".oxlintrc.json"], timeoutMs: 180_000 },
  {
    id: "complexity",
    cmd: "vp",
    args: ["lint", "-c", ".oxlintrc.complexity.json"],
    timeoutMs: 180_000,
  },
  { id: "typecheck", handler: "typecheck" },
  {
    id: "ast-check",
    cmd: "node",
    args: ["scripts/architecture-check.ts"],
    timeoutMs: 120_000,
  },
  { id: "debug-statements", handler: "debugStatements" },
  { id: "detect-private-key", handler: "privateKeys" },
  { id: "check-added-large-files", handler: "largeFiles" },
  { id: "check-merge-conflict", handler: "conflictMarkersStaged" },
];

/**
 * Runs before push. Heavier than pre-commit, but the heavy work is either
 * range-scoped (tests) or belongs in CI. Keep the blocking set small; anything
 * that can run minutes belongs in a workflow, not a developer's push.
 */
export const prePush: readonly CheckSpec[] = [
  {
    id: "fmt:check",
    cmd: "vp",
    args: ["fmt", "-c", ".oxfmtrc.json", "--check"],
    timeoutMs: 120_000,
  },
  { id: "lint", cmd: "vp", args: ["lint", "-c", ".oxlintrc.json"], timeoutMs: 180_000 },
  {
    id: "complexity",
    cmd: "vp",
    args: ["lint", "-c", ".oxlintrc.complexity.json"],
    timeoutMs: 180_000,
  },
  { id: "typecheck", handler: "typecheck" },
  {
    id: "ast-check",
    cmd: "node",
    args: ["scripts/architecture-check.ts"],
    timeoutMs: 120_000,
  },
  {
    id: "knip",
    cmd: "knip",
    args: [
      "--no-progress",
      "--reporter",
      "compact",
      "--include",
      "files,dependencies,unlisted,unresolved,exports",
    ],
    timeoutMs: 300_000,
  },
  // Security gates: a missing scanner must block, not silently pass.
  {
    id: "gitleaks",
    handler: "secretScan",
    timeoutMs: 300_000,
    onMissing: "fail",
    installHint: "brew install gitleaks",
  },
  {
    id: "osv-scanner",
    handler: "dependencyScan",
    timeoutMs: 300_000,
    onMissing: "fail",
    installHint: "brew install osv-scanner",
    skipWhenEnv: "SKIP_OSV",
  },
  {
    id: "semgrep",
    handler: "staticAnalysis",
    timeoutMs: 600_000,
    onMissing: "fail",
    installHint: "brew install semgrep (or pipx install semgrep)",
  },
  { id: "check-merge-conflict", handler: "conflictMarkersInRange" },
  { id: "tests (vitest)", handler: "unitTests" },
  { id: "tests (playwright e2e)", handler: "endToEndTests" },
  {
    id: "codacy",
    handler: "codacy",
    timeoutMs: 600_000,
    onMissing: "skip",
    installHint: "brew install codacy-cli, then `codacy-cli init`",
  },
  {
    id: "coderabbit-advisory",
    handler: "coderabbit",
    timeoutMs: 1_800_000,
    onMissing: "skip",
    installHint: "brew install coderabbit, then `coderabbit auth login`",
  },
];

/**
 * Runs before a merge commit is created (`pre-merge-commit`).
 *
 * Intentionally identical to the push policy: a merge is another way to move
 * code, and it should face the same gate. Copied rather than aliased so the two
 * policies can diverge later without a surprise, and a test asserts they
 * currently match.
 *
 * Git has no `pre-merge` hook — `pre-merge-commit` is the merge-stage hook, and
 * it only fires for non-fast-forward merges. A fast-forward merge creates no
 * merge commit and therefore runs nothing here; the checks that matter for an
 * already-reviewed branch still apply at push time.
 */
export const preMergeCommit: readonly CheckSpec[] = [...prePush];

/** Flattens the manifest into a plain `id -> spec` view for validation/tests. */
export function specById(specs: readonly CheckSpec[]): Map<string, CheckSpec> {
  return new Map(specs.map((spec) => [spec.id, spec]));
}
