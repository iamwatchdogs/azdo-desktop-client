import { addedLinesForFile, gitBuffer, gitQuiet, stagedFiles, type AddedLine } from "./lib/git.ts";

export interface CheckOutcome {
  status: "passed" | "failed";
  output: string;
}

export interface Violation {
  file: string;
  line: number | null;
  message: string;
}

/**
 * 100 MiB matches GitHub's hard per-file limit, so anything rejected here would
 * be rejected by the remote — better a commit-time reason than a push-time 413.
 */
const MAX_COMMIT_FILE_BYTES = Number(process.env["ADO_HOOKS_MAX_FILE_BYTES"] ?? 100 * 1024 * 1024);

const MIB = 1024 * 1024;
const MAX_KEY_SCAN_BYTES = 2 * MIB;
const SELF_PATH = "scripts/hooks/policy.ts";

const CODE_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const TEXT_FILE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|json|jsonc|css|html|yml|yaml|sh)$/;
const TEST_FILE = /(?:^|\/)(?:test|tests|e2e|__tests__)\/|\.(?:test|spec)\.(?:ts|tsx)$/;

const PRIVATE_KEY_PATTERNS: readonly RegExp[] = [
  /-----BEGIN (?:RSA |DSA |EC |OPENSSH |ENCRYPTED |SSH2 ENCRYPTED )?PRIVATE KEY-----/,
  /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
  /PuTTY-User-Key-File-\d+/,
  /-----BEGIN OpenVPN Static key V1-----/,
];
const KEY_ALLOW_MARKER = "detect-private-key: allow";

interface DebugRule {
  pattern: RegExp;
  label: string;
  /**
   * Console output, exempt in test files only (they use console.log as fixture
   * data). Runtime code has no path-based exemption: intentional logging uses
   * warn/error/info, or opts one line in with the allow marker.
   */
  consoleLog?: boolean;
  testFileOnly?: boolean;
}

const DEBUG_RULES: readonly DebugRule[] = [
  { pattern: /(?:^|[^\w$.])debugger\b/, label: "debugger statement" },
  { pattern: /\bconsole\.(?:debug|trace|dir)\s*\(/, label: "console debug statement" },
  { pattern: /\bconsole\.(?:time|timeEnd|timeLog)\s*\(/, label: "console timing statement" },
  { pattern: /\bconsole\.log\s*\(/, label: "console.log leftover", consoleLog: true },
  { pattern: /\bfdescribe\s*\(|\bfit\s*\(/, label: "focused test (fdescribe/fit)" },
  { pattern: /\bxit\s*\(|\bxdescribe\s*\(/, label: "skipped test (xit/xdescribe)" },
  { pattern: /\.only\(/, label: "focused test (.only)", testFileOnly: true },
];
const DEBUG_ALLOW_MARKER = "debug-statements: allow";

// `=======` alone is only a conflict marker in text-like files: it is also
// valid setext underline and RST heading syntax.
const CONFLICT_MARKER = /^(?:<{7}\s|>{7}\s)/;
const CONFLICT_BAR = /^={7}\s*$/;
const CONFLICT_ALLOW_MARKER = "check-merge-conflict: allow";

const STAGED_DIFF_ARGS = ["diff", "--cached", "--diff-filter=ACMR"] as const;

function addedLinesByFile(
  root: string,
  files: readonly string[],
  diffArgs: readonly string[],
): Map<string, AddedLine[]> {
  const result = new Map<string, AddedLine[]>();
  for (const file of files) {
    const lines = addedLinesForFile(root, diffArgs, file);
    if (lines.length > 0) result.set(file, lines);
  }
  return result;
}

function isCommentOnly(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*");
}

function debugRuleApplies(rule: DebugRule, file: string): boolean {
  if (rule.consoleLog === true && TEST_FILE.test(file)) return false;
  if (rule.testFileOnly === true && !TEST_FILE.test(file)) return false;
  return true;
}

function matchDebugRule(file: string, text: string): string | null {
  if (text.includes(DEBUG_ALLOW_MARKER) || isCommentOnly(text)) return null;
  const rule = DEBUG_RULES.find(
    (candidate) => debugRuleApplies(candidate, file) && candidate.pattern.test(text),
  );
  return rule?.label ?? null;
}

export function debugViolationsInFile(file: string, lines: readonly AddedLine[]): Violation[] {
  return lines.flatMap((added) => {
    const message = matchDebugRule(file, added.text);
    return message === null ? [] : [{ file, line: added.line, message }];
  });
}

/** True when any added line in a file carries an opt-out marker. */
export function fileOptsOut(lines: readonly AddedLine[], marker: string): boolean {
  return lines.some((added) => added.text.includes(marker));
}

export function checkDebugStatements(root: string, files: readonly string[]): Violation[] {
  const byFile = addedLinesByFile(
    root,
    files.filter((file) => CODE_FILE.test(file) && file !== SELF_PATH),
    STAGED_DIFF_ARGS,
  );
  // Not gated on fileOptsOut: the marker exempts the line carrying it, not its
  // file. A file-wide opt-out would launder every console.log committed with it.
  return [...byFile].flatMap(([file, lines]) => debugViolationsInFile(file, lines));
}

export function checkConflictMarkersStaged(root: string, files: readonly string[]): Violation[] {
  return scanConflictMarkers(root, files, STAGED_DIFF_ARGS);
}

export function debugRuleAppliesToFile(rule: DebugRule, file: string): boolean {
  return debugRuleApplies(rule, file);
}

export function isConflictMarker(file: string, text: string): boolean {
  if (CONFLICT_MARKER.test(text)) return true;
  return TEXT_FILE.test(file) && CONFLICT_BAR.test(text);
}

export function conflictViolationsInFile(file: string, lines: readonly AddedLine[]): Violation[] {
  return lines.flatMap((added) => {
    if (added.text.includes(CONFLICT_ALLOW_MARKER) || !isConflictMarker(file, added.text))
      return [];
    return [{ file, line: added.line, message: "unresolved conflict marker" }];
  });
}

function scanConflictMarkers(
  root: string,
  files: readonly string[],
  diffArgs: readonly string[],
): Violation[] {
  const byFile = addedLinesByFile(root, files, diffArgs);
  return [...byFile].flatMap(([file, lines]) =>
    fileOptsOut(lines, CONFLICT_ALLOW_MARKER) ? [] : conflictViolationsInFile(file, lines),
  );
}

function blobSize(root: string, spec: string): number | null {
  const text = gitQuiet(["cat-file", "-s", spec], root);
  if (text === null) return null;
  const size = Number(text.trim());
  return Number.isFinite(size) ? size : null;
}

/** Staged blob as UTF-8 text, or null when absent, binary or oversized. */
function stagedTextBlob(root: string, file: string): string | null {
  if (file === SELF_PATH) return null;
  const size = blobSize(root, `:${file}`);
  if (size === null || size > MAX_KEY_SCAN_BYTES) return null;
  const blob = gitBuffer(["cat-file", "blob", `:${file}`], root);
  if (blob === null || blob.includes(0)) return null;
  return blob.toString("utf8");
}

function privateKeyViolationsInFile(root: string, file: string): Violation[] {
  const content = stagedTextBlob(root, file);
  if (content === null || content.includes(KEY_ALLOW_MARKER)) return [];
  const pattern = PRIVATE_KEY_PATTERNS.find((candidate) => candidate.test(content));
  if (pattern === undefined) return [];
  const line = content.slice(0, content.search(pattern)).split("\n").length;
  return [{ file, line, message: "private key detected" }];
}

/** PEM/armour detection over already-read text. */
export function privateKeyViolationsInText(file: string, content: string): Violation[] {
  if (content.includes(KEY_ALLOW_MARKER)) return [];
  const pattern = PRIVATE_KEY_PATTERNS.find((candidate) => candidate.test(content));
  if (pattern === undefined) return [];
  const line = content.slice(0, content.search(pattern)).split("\n").length;
  return [{ file, line, message: "private key detected" }];
}

export function checkPrivateKeys(root: string): Violation[] {
  return stagedFiles(root).flatMap((file) => privateKeyViolationsInFile(root, file));
}

/**
 * The size rule over an already-measured blob, exported for unit tests.
 *
 * A file exactly at the limit passes: the message says "exceeds", so flagging
 * the boundary would print "100.0 MiB exceeds 100 MiB limit" for a file that
 * did not exceed it. A `size` of null (deleted, or not a blob) reads as
 * "not oversized" rather than a failure.
 */
export function largeFileViolation(file: string, size: number | null): Violation | null {
  if (size === null || size <= MAX_COMMIT_FILE_BYTES) return null;
  const actual = (size / MIB).toFixed(1);
  const limit = (MAX_COMMIT_FILE_BYTES / MIB).toFixed(0);
  return { file, line: null, message: `${actual} MiB exceeds ${limit} MiB limit` };
}

function largeFileViolationsInFile(root: string, file: string): Violation[] {
  const violation = largeFileViolation(file, blobSize(root, `:${file}`));
  return violation === null ? [] : [violation];
}

export function checkLargeFiles(root: string): Violation[] {
  return stagedFiles(root).flatMap((file) => largeFileViolationsInFile(root, file));
}
