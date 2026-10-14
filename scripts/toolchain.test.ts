/**
 * The typecheck compiler, guarded in one place.
 *
 * tsc-rs is what actually enforces the Effect diagnostics in
 * tsconfig.base.json: the JS tsc ignores the plugins array outright, so a
 * workspace or script that falls back to `tsc` silently loses every TS377xxx
 * gate while still exiting green. pingdotgg/t3code reaches the same split by
 * making scripts a workspace of its own with `tsc-rs --noEmit`; here scripts/
 * is checked by a task, so the task is what has to be asserted.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8")) as Record<string, unknown>;
}

function typecheckScript(relativePath: string): string | undefined {
  const scripts = readJson(relativePath)["scripts"] as Record<string, string> | undefined;
  return scripts?.["typecheck"];
}

const WORKSPACES = [
  "apps/desktop/package.json",
  "apps/renderer/package.json",
  "packages/shared/package.json",
] as const;

describe("typecheck toolchain", () => {
  it.each(WORKSPACES)("typechecks %s with tsc-rs", (workspace) => {
    expect(typecheckScript(workspace)).toMatch(/\btsc-rs\b/);
  });

  it("fans the root typecheck out over the workspaces and the scripts", () => {
    // The root script names both halves explicitly: the workspace fan-out and
    // the scripts tree (the guard tests in this directory). Routing through
    // the typecheck:all task instead makes `vp run -r typecheck` resolve this
    // same script again, and Vite Task refuses the loop.
    expect(typecheckScript("package.json")).toBe(
      "vp run -r typecheck && tsc-rs -p scripts/tsconfig.json",
    );
  });

  it("checks the scripts workspace with tsc-rs too", () => {
    const viteConfig = readFileSync(resolve(root, "vite.config.ts"), "utf8");
    const command = /"typecheck:all":\s*\{\s*command:\s*(\[[^\]]*\])/.exec(viteConfig)?.[1];
    expect(command).toBeDefined();
    expect(command).toContain("tsc-rs -p scripts/tsconfig.json");
    // A bare `tsc` here typechecks scripts/ without the Effect plugin, which is
    // the exact regression this guards.
    expect(command).not.toMatch(/(^|[\s"[])tsc\s+-p/);
  });

  it("leaves no plain tsc invocation behind in the task graph", () => {
    const viteConfig = readFileSync(resolve(root, "vite.config.ts"), "utf8");
    const commands = [...viteConfig.matchAll(/command:\s*("(?:[^"\\]|\\.)*"|\[[^\]]*\])/g)].map(
      ([, value]) => value,
    );
    for (const command of commands) {
      expect(command).not.toMatch(/(^|[\s"[])tsc\s/);
    }
  });

  it("keeps the tree scanners independent of the suite", () => {
    // The boundary suite used to write probe fixtures into the source trees,
    // which forced knip and arch-check to wait for the tests so neither
    // scanned a fixture mid-flight. The suite now probes a throwaway root, so
    // the race is gone at its producer and a dependency is pure cost: it makes
    // CI re-run the whole root suite inside the arch-check step. Re-adding one
    // is a decision that needs a reason, so it has to break a test.
    const viteConfig = readFileSync(resolve(root, "vite.config.ts"), "utf8");
    expect(viteConfig).not.toContain('dependsOn: ["tests:all"]');
  });
});
