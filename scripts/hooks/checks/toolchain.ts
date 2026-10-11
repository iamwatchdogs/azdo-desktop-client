import { capOutput, commandCheck, type CheckOutcome } from "../lib/runner.ts";
import type { HookContext } from "../lib/types.ts";

/**
 * Typecheck is two sequential steps: every workspace, then the hook scripts
 * themselves (which live outside the workspace graph and need their own tsconfig).
 * Not expressible as one command, which is why it is a handler.
 */
export async function typecheck(ctx: HookContext): Promise<CheckOutcome> {
  const workspaces = await commandCheck("vp", ["run", "-r", "typecheck"], 300_000, {
    env: ctx.env,
    cwd: ctx.root,
  });
  if (workspaces.status !== "passed") return workspaces;

  const scripts = await commandCheck("tsc", ["-p", "scripts/tsconfig.json"], 180_000, {
    env: ctx.env,
    cwd: ctx.root,
  });
  if (scripts.status !== "passed") {
    return {
      status: scripts.status,
      output: `workspace typecheck passed, but scripts/ failed\n${scripts.output}`,
    };
  }
  return { status: "passed", output: "" };
}

/** Unit tests across workspaces, scoped to the push range when one is known. */
export async function unitTests(ctx: HookContext): Promise<CheckOutcome> {
  const workspaces = ["packages/shared", "apps/renderer", "apps/desktop"];
  const sections: string[] = [];

  for (const workspace of workspaces) {
    const args =
      ctx.base === null
        ? ["test", "run", "--passWithNoTests"]
        : ["test", "run", "--changed", ctx.base, "--passWithNoTests"];

    const result = await commandCheck("vp", ["-C", workspace, ...args], 600_000, {
      env: ctx.env,
      cwd: ctx.root,
    });
    const command = `$ vp -C ${workspace} ${args.join(" ")}`;
    if (result.status !== "passed") {
      sections.push(`${command}\n${result.output}`);
      return { status: result.status, output: sections.join("\n\n") };
    }
    sections.push(`${command}\n${capOutput(result.output, 2000)}`);
  }

  return { status: "passed", output: sections.join("\n\n") };
}
