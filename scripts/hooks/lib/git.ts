import { execFileSync } from "node:child_process";

/** Runs git in `cwd`, returning stdout. Throws when git exits non-zero. */
function git(args: readonly string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

/** Runs git in `cwd`, returning stdout or null when git exits non-zero. */
export function gitQuiet(args: readonly string[], cwd: string): string | null {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

/** Runs git in `cwd`, returning raw stdout bytes or null on failure. */
export function gitBuffer(args: readonly string[], cwd: string): Buffer | null {
  try {
    return execFileSync("git", args, { cwd });
  } catch {
    return null;
  }
}

/** Absolute path of the enclosing repository root. */
export function repoRoot(): string {
  const root = gitQuiet(["rev-parse", "--show-toplevel"], process.cwd());
  if (root === null || root.trim() === "") {
    console.error("hooks: not inside a git repository");
    process.exit(1);
  }
  return root.trim();
}

/** NUL-safe split for `git -z` style output. */
function splitNul(text: string): string[] {
  return text.split("\0").filter((entry) => entry !== "");
}

/** Staged files (added, copied, modified, renamed). */
export function stagedFiles(root: string): string[] {
  return splitNul(git(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"], root));
}

/** Files changed in `range` (added, copied, modified, renamed). */
export function changedFilesInRange(root: string, range: string): string[] {
  return splitNul(git(["diff", "--name-only", "--diff-filter=ACMR", "-z", range], root));
}

/**
 * True when `git merge-base <base> HEAD` resolves.
 *
 * On a shallow clone it does not, and affected-test selection (`vitest
 * --changed`, `playwright --only-changed`) silently reports "no test files"
 * with a zero exit code. Callers use this to fail loudly instead.
 *
 * Both ends of the range matter: a merge compares HEAD against MERGE_HEAD, so
 * a guard that only checked HEAD would pass trivially and prove nothing.
 */
export function mergeBaseResolves(root: string, base: string, tip = "HEAD"): boolean {
  return gitQuiet(["merge-base", base, tip], root) !== null;
}

export interface AddedLine {
  line: number;
  text: string;
}

/** File path of a `+++ b/path` diff header, or null. */
function diffHeaderPath(raw: string): string | null {
  if (!raw.startsWith("+++ ")) return null;
  const path = raw.slice(4);
  return path.startsWith("b/") ? path.slice(2) : path;
}

/** First line number of a `@@ -a,b +c,d @@` hunk header, or 0. */
function hunkStart(raw: string): number {
  if (!raw.startsWith("@@")) return 0;
  const match = /\+(\d+)/.exec(raw);
  return match?.[1] === undefined ? 0 : Number(match[1]);
}

/** Added (`+`) lines with new-file line numbers, keyed by file path. */
function addedLines(diff: string): Map<string, AddedLine[]> {
  const result = new Map<string, AddedLine[]>();
  let file = "";
  let lineNumber = 0;

  for (const raw of diff.split("\n")) {
    const header = diffHeaderPath(raw);
    if (header !== null) {
      file = header;
      lineNumber = 0;
      continue;
    }
    const hunk = hunkStart(raw);
    if (hunk !== 0) {
      lineNumber = hunk;
      continue;
    }
    if (file === "" || lineNumber === 0) continue;

    if (raw.startsWith("+")) {
      appendAdded(result, file, { line: lineNumber, text: raw.slice(1) });
      lineNumber += 1;
    } else if (!raw.startsWith("-") && !raw.startsWith("\\")) {
      lineNumber += 1;
    }
  }

  return result;
}

function appendAdded(result: Map<string, AddedLine[]>, file: string, entry: AddedLine): void {
  const entries = result.get(file);
  if (entries === undefined) result.set(file, [entry]);
  else entries.push(entry);
}

/** Added (`+`) lines of one file across a diff selector. */
export function addedLinesForFile(
  root: string,
  diffArgs: readonly string[],
  file: string,
): AddedLine[] {
  const diff = git([...diffArgs, "-U0", "--", file], root);
  return addedLines(diff).get(file) ?? [];
}
