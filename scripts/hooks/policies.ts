/**
 * Staged-diff policy checks — the one thing no bundled tool does.
 *
 * `vp staged` and `vp check` cover formatting, linting, and type checks. These
 * four rules inspect the staged content itself, which nothing in the toolchain
 * exposes, so they stay as code. Every other check is declared in
 * vite.config.ts and executed by Vite Task.
 *
 * Two read only the *added lines* of the index (debug statements, conflict
 * markers); the other two read the whole staged blob (private keys, size).
 *
 * Takes no arguments: it reads the index itself rather than the file list
 * lint-staged appends, so it behaves identically whichever hook invoked it.
 */

import { repoRoot, stagedFiles } from "./lib/git.ts";
import {
  checkConflictMarkersStaged,
  checkDebugStatements,
  checkLargeFiles,
  checkPrivateKeys,
  type CheckOutcome,
  type Violation,
} from "./policy.ts";

const root = repoRoot();

function report(label: string, violations: Violation[]): CheckOutcome {
  if (violations.length === 0) return { status: "passed", output: "" };
  return { status: "failed", output: `${label}\n${format(violations)}` };
}

function format(violations: readonly Violation[], limit = 20): string {
  const shown = violations
    .slice(0, limit)
    .map((v) =>
      v.line === null ? `  ${v.file}: ${v.message}` : `  ${v.file}:${v.line}: ${v.message}`,
    );
  if (violations.length > shown.length) {
    shown.push(`  ... and ${violations.length - shown.length} more`);
  }
  return shown.join("\n");
}

const files = stagedFiles(root);
const outcomes: CheckOutcome[] = [
  report("debug statements", checkDebugStatements(root, files)),
  report("private keys", checkPrivateKeys(root)),
  report("oversized files", checkLargeFiles(root)),
  report("unresolved conflict markers", checkConflictMarkersStaged(root, files)),
];

const failures = outcomes.filter((o) => o.status === "failed");
if (failures.length > 0) {
  process.stderr.write(`policies: ${failures.length} of ${outcomes.length} failed\n\n`);
  for (const f of failures) process.stderr.write(`${f.output}\n`);
  process.exit(1);
}
process.stderr.write(`policies: ${outcomes.length} checks passed\n`);
