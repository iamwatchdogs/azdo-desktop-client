import { gitQuiet } from "./git.ts";

/**
 * Resolves the base a push is compared against.
 *
 * Order of preference:
 *   1. The remote SHA from git's pre-push stdin (exact — this is what will
 *      change on the remote).
 *   2. The upstream `@{push}` ref.
 *   3. The configured remote-tracking branch for the current branch.
 *   4. The root commit (degenerate: the range spans all history, so every
 *      affected-file selection degrades to "everything"). Callers warn.
 *
 * Returns null when nothing resolves, which makes checks skip loudly rather
 * than scan an arbitrary range.
 */
export function resolvePushBase(
  root: string,
  remoteName: string,
  refs: readonly string[],
): string | null {
  const zeroSha = "0".repeat(40);
  for (const line of refs) {
    const fields = line.trim().split(/\s+/);
    const localSha = fields[1] ?? "";
    const remoteSha = fields[3] ?? "";
    if (localSha === zeroSha) continue; // branch deletion: nothing to check
    if (
      remoteSha !== zeroSha &&
      gitQuiet(["cat-file", "-e", `${remoteSha}^{commit}`], root) !== null
    ) {
      return remoteSha;
    }
  }

  const pushRef = gitQuiet(
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{push}"],
    root,
  )?.trim();
  if (pushRef !== undefined && pushRef !== "") return pushRef;

  const branch = gitQuiet(["symbolic-ref", "--quiet", "--short", "HEAD"], root)?.trim();
  if (branch !== undefined && branch !== "") {
    const remoteRef = gitQuiet(
      ["rev-parse", "--verify", "--quiet", `refs/remotes/${remoteName}/${branch}`],
      root,
    )?.trim();
    if (remoteRef !== undefined && remoteRef !== "") return remoteRef;
  }

  const rootCommit = gitQuiet(["rev-list", "--max-parents=0", "HEAD"], root)?.trim().split("\n")[0];
  return rootCommit === undefined || rootCommit === "" ? null : rootCommit;
}

/**
 * Reads git's pre-push stdin (`<local ref> <local sha> <remote ref> <remote sha>`
 * per line). Returns [] when there is no piped input, e.g. a manual invocation.
 */
export async function readPushRefs(): Promise<string[]> {
  if (process.stdin.isTTY) return [];
  const text = await new Promise<string>((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
  });
  return text.split("\n").filter((line) => line.trim() !== "");
}
