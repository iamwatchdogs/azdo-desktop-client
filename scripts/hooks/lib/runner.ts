import { spawn } from "node:child_process";
import { delimiter, join } from "node:path";

import type { HookContext, MissingPolicy } from "./types.ts";

/**
 * `missing` is a distinct status, not `skipped`: it means a check that was
 * supposed to run could not. The report counts it as a failure so a security
 * gate can never disappear behind a green summary.
 */
export type CheckStatus = "passed" | "failed" | "skipped" | "missing";

export interface CheckOutcome {
  status: CheckStatus;
  output: string;
}

export interface Check {
  id: string;
  run: () => Promise<CheckOutcome>;
}

export interface RunOptions {
  cwd: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv | undefined;
}

export interface CommandResult {
  code: number;
  output: string;
  notFound: boolean;
  timedOut: boolean;
}

const MAX_OUTPUT_CHARS = 8000;

/** Keeps the tail of long outputs so reports stay readable. */
export function capOutput(output: string, max = MAX_OUTPUT_CHARS): string {
  const trimmed = output.trimEnd();
  if (trimmed.length <= max) return trimmed;
  return `... (${trimmed.length - max} chars truncated) ...\n${trimmed.slice(-max)}`;
}

/** Environment for hook children: local binaries first, colors off. */
export function hookEnv(root: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: `${join(root, "node_modules/.bin")}${delimiter}${process.env["PATH"] ?? ""}`,
    NO_COLOR: "1",
  };
}

/** Spawns a command, buffering stdout/stderr, with optional timeout. */
export function runCommand(
  command: string,
  args: readonly string[],
  options: RunOptions,
): Promise<CommandResult> {
  const { cwd, timeoutMs = 0 } = options;
  return new Promise((resolve) => {
    const child = spawn(command, [...args], {
      cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let output = "";
    let timedOut = false;
    let settled = false;

    const settle = (result: CommandResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    if (timeoutMs > 0) {
      const signal = AbortSignal.timeout(timeoutMs);
      signal.addEventListener(
        "abort",
        () => {
          timedOut = true;
          child.kill("SIGKILL");
        },
        { once: true },
      );
    }

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      settle({
        code: 127,
        output: `failed to start ${command}: ${error.message}`,
        notFound: error.code === "ENOENT",
        timedOut,
      });
    });
    child.on("close", (code) => {
      settle({ code: code ?? 1, output, notFound: false, timedOut });
    });
  });
}

export interface CommandCheckOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv | undefined;
  /** `fail` turns a missing binary into a blocking `missing` status. */
  onMissing?: MissingPolicy;
  /** Installation hint appended to the missing-binary message. */
  installHint?: string;
}

/**
 * Outcome for a single command.
 *
 * A missing binary is `missing` (blocking) when the caller marks the check as a
 * security gate, and `skipped` otherwise.
 */
export async function commandCheck(
  command: string,
  args: readonly string[],
  timeoutMs: number,
  options?: CommandCheckOptions,
): Promise<CheckOutcome> {
  const result = await runCommand(command, args, {
    cwd: options?.cwd ?? process.cwd(),
    timeoutMs,
    env: options?.env,
  });

  if (result.notFound) {
    const hint = options?.installHint === undefined ? "" : ` — ${options.installHint}`;
    const message = `${command} is not installed${hint}`;
    return options?.onMissing === "fail"
      ? {
          status: "missing",
          output: `${message}\n  This check is a security gate; refusing to pass without it.`,
        }
      : { status: "skipped", output: message };
  }
  if (result.timedOut) {
    return {
      status: "failed",
      output: `${command} timed out after ${timeoutMs}ms\n${capOutput(result.output)}`,
    };
  }
  if (result.code !== 0) {
    return { status: "failed", output: capOutput(result.output) };
  }
  return { status: "passed", output: "" };
}

export function skip(output: string): CheckOutcome {
  return { status: "skipped", output };
}

/**
 * Applies the manifest's opt-out convention to a handler.
 * Returns null when the check should run.
 */
export function optOutEnv(spec: { skipWhenEnv?: string }): string | null {
  const name = spec.skipWhenEnv;
  if (name === undefined) return null;
  return process.env[name] === "1" ? `${name}=1` : null;
}

/** Runs a command declared in the manifest, resolving `cwd` against the root. */
export async function runCommandSpec(
  cmd: string,
  args: readonly string[],
  timeoutMs: number,
  ctx: HookContext,
  options?: { cwd?: string; onMissing?: MissingPolicy; installHint?: string },
): Promise<CheckOutcome> {
  return commandCheck(cmd, args, timeoutMs, {
    env: ctx.env,
    ...(options?.cwd === undefined ? {} : { cwd: join(ctx.root, options.cwd) }),
    ...(options?.onMissing === undefined ? {} : { onMissing: options.onMissing }),
    ...(options?.installHint === undefined ? {} : { installHint: options.installHint }),
  });
}

export interface RunnerReport {
  label: string;
  checks: readonly Check[];
}

/**
 * Runs every check in parallel and reports all failures at the end.
 *
 * Only `failed` and `missing` set a non-zero exit code. `missing` is counted
 * separately in the summary so a blocked gate is never mistaken for a pass.
 */
export async function runChecks(report: RunnerReport): Promise<number> {
  const startedAt = Date.now();
  const results = await Promise.all(
    report.checks.map(async (check) => {
      try {
        return { check, outcome: await check.run() };
      } catch (error) {
        const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
        return { check, outcome: { status: "failed" as const, output: message } };
      }
    }),
  );

  const failed = results.filter((entry) => entry.outcome.status === "failed");
  const missing = results.filter((entry) => entry.outcome.status === "missing");
  const skipped = results.filter((entry) => entry.outcome.status === "skipped");
  const passed = results.filter((entry) => entry.outcome.status === "passed");
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  const parts = [`${passed.length} passed`];
  if (failed.length > 0) parts.push(`${failed.length} failed`);
  if (missing.length > 0) parts.push(`${missing.length} missing`);
  if (skipped.length > 0) parts.push(`${skipped.length} skipped`);

  process.stderr.write(
    `\n${report.label}: ${results.length} checks — ${parts.join(", ")} (${seconds}s)\n\n`,
  );

  for (const { check, outcome } of results) {
    process.stderr.write(`  ${statusLabel(outcome.status)}  ${check.id}\n`);
    if (outcome.status !== "passed" && outcome.output !== "") {
      process.stderr.write(indent(capOutput(outcome.output), "      "));
      process.stderr.write("\n");
    }
  }
  process.stderr.write("\n");

  return failed.length > 0 || missing.length > 0 ? 1 : 0;
}

function statusLabel(status: CheckStatus): string {
  switch (status) {
    case "passed":
      return "pass";
    case "failed":
      return "FAIL";
    case "missing":
      return "MISS";
    case "skipped":
      return "skip";
    default:
      return "skip";
  }
}

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line) => (line === "" ? "" : `${prefix}${line}`))
    .join("\n");
}
