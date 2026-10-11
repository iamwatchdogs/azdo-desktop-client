import type { Check, CheckOutcome } from "./runner.ts";

/**
 * Everything a check needs to run, resolved once by the dispatcher.
 *
 * Config declares *what* runs; this object carries the *context* it runs
 * against. Every check is a pure function of (spec, context).
 */
/** Which git operation is invoking the hook. */
export type HookMode = "commit" | "push" | "merge";

export interface HookContext {
  /** Absolute path to the repository root. */
  readonly root: string;
  /** Environment for spawned checks (local binaries first, colors off). */
  readonly env: NodeJS.ProcessEnv;
  readonly mode: HookMode;
  /**
   * Lower bound for comparisons.
   *
   * push:  the remote SHA, or null when it could not be resolved.
   * merge: `HEAD` — the index already holds the resolved merge result, so HEAD
   *        is what that result is measured against.
   * commit: null (the staged diff is the comparison).
   *
   * `MERGE_HEAD` is deliberately absent: it does not exist yet when
   * pre-merge-commit runs. Git writes the merge state after the hook returns
   * and passes it no arguments, so merge checks read the index instead.
   */
  readonly base: string | null;
  /** Files whose content this operation introduces. */
  readonly changed: readonly string[];
  /** Files staged for the pending commit. */
  readonly staged: readonly string[];
}

/**
 * What happens when a required binary is not installed.
 *
 * - `skip` (advisory tools): report and move on.
 * - `fail` (security gates): block. A gate that silently disappears is
 *   worse than no gate, because the green result gets trusted.
 */
export type MissingPolicy = "skip" | "fail";

/** Metadata shared by both spec shapes. */
interface SpecMeta {
  readonly id: string;
  /** Defaults to `skip`. Set `fail` for security gates. */
  readonly onMissing?: MissingPolicy;
  /** Installation hint shown when the binary is missing. */
  readonly installHint?: string;
  /** Env var that disables the check when set to `1`. */
  readonly skipWhenEnv?: string;
}

/** A check expressed entirely as a command. No logic lives here. */
export interface CommandSpec extends SpecMeta {
  readonly cmd: string;
  readonly args: readonly string[];
  readonly timeoutMs: number;
  /** Working directory, relative to the repository root. */
  readonly cwd?: string;
}

/** A check whose behavior cannot be a command: loops, branches, composition. */
export interface HandlerSpec extends SpecMeta {
  readonly handler: string;
  readonly timeoutMs?: number;
}

export type CheckSpec = CommandSpec | HandlerSpec;

export type Handler = (ctx: HookContext) => Promise<CheckOutcome>;

export function isCommandSpec(spec: CheckSpec): spec is CommandSpec {
  return "cmd" in spec;
}

export function isHandlerSpec(spec: CheckSpec): spec is HandlerSpec {
  return "handler" in spec;
}

export type { Check };
