import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const checkScript = resolve(repoRoot, "scripts/architecture-check.ts");

const BARE_PROBE = 'import { Effect } from "effect";\nexport const probe = Effect.succeed(1);\n';
const SCOPED_PROBE = 'import * as probe from "@effect/platform";\nexport const probe = probe;\n';

/**
 * architecture-check.ts is a CLI: it derives its root from cwd and scans the
 * tsconfig program at that root. So the boundary rules are exercised against
 * a throwaway tree carrying the same relative layout — the same paths
 * through the same code, with nothing written into the source tree.
 *
 * Writing into the live tree is what this replaces, and why: each test then
 * spawns a whole-repo ts-morph scan (~3.5-7s on CI runners, over the vitest
 * 5s default), a probe that outlives its test fails a concurrent `vp check`
 * with TS2307, knip and architecture-check themselves flag the probe when
 * they scan beside the suite, and the read-write-restore around it is a
 * file-system race in its own right. The suite owns its fixtures here.
 */
function checkWithFixtures(files: Record<string, string>): { code: number; output: string } {
  const root = mkdtempSync(join(tmpdir(), "arch-check-"));
  try {
    for (const [relativePath, contents] of Object.entries(files)) {
      const absolute = join(root, relativePath);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, contents);
    }
    // The guard refuses to run without one, and scans whatever it includes:
    // exactly the fixtures, so each spawn parses a handful of files.
    writeFileSync(
      join(root, "tsconfig.json"),
      `${JSON.stringify({ include: ["**/*.ts"] }, null, 2)}\n`,
    );
    return runCheck(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runCheck(cwd: string): { code: number; output: string } {
  try {
    const output = execFileSync("node", [checkScript], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status: number | null; stdout: string; stderr: string };
    return { code: failure.status ?? 1, output: `${failure.stdout}${failure.stderr}` };
  }
}

describe("architecture-check effect boundary", () => {
  it("rejects effect in packages/shared", () => {
    const { code, output } = checkWithFixtures({
      "packages/shared/src/__probe.ts": BARE_PROBE,
    });
    expect(output).toContain("packages/shared/src/__probe.ts");
    expect(output).toContain("effect must stay out of shared code");
    expect(code).not.toBe(0);
  });

  it("rejects effect in the renderer", () => {
    const { code, output } = checkWithFixtures({
      "apps/renderer/src/__probe.ts": BARE_PROBE,
    });
    expect(output).toContain("apps/renderer/src/__probe.ts");
    expect(output).toContain("effect must stay out of shared code");
    expect(code).not.toBe(0);
  });

  // A regex that only matches the bare package lets every scoped @effect/*
  // import through, and arch-check is the only barrier: effect resolves from
  // packages/ and apps/renderer via the root symlink regardless of which
  // workspace declares the dependency.
  it("rejects scoped @effect imports in the renderer", () => {
    const { code, output } = checkWithFixtures({
      "apps/renderer/src/__probe.ts": SCOPED_PROBE,
    });
    expect(output).toContain("apps/renderer/src/__probe.ts");
    expect(output).toContain("@effect/platform");
    expect(code).not.toBe(0);
  });

  it("rejects scoped @effect imports in packages/shared, including the sanctioned test dep", () => {
    for (const specifier of ["@effect/platform", "@effect/vitest"]) {
      const { code, output } = checkWithFixtures({
        "packages/shared/src/__probe.ts": `import * as probe from "${specifier}";\nexport const p = probe;\n`,
      });
      expect(output).toContain("packages/shared/src/__probe.ts");
      expect(output).toContain(specifier);
      expect(code).not.toBe(0);
    }
  });

  it("rejects a dynamic @effect import in the preload bridge", () => {
    const { code, output } = checkWithFixtures({
      "apps/desktop/src/preload.ts": 'export const __probe = () => import("@effect/platform");\n',
    });
    expect(output).toContain("apps/desktop/src/preload.ts");
    expect(output).toContain("@effect/platform");
    expect(code).not.toBe(0);
  });

  // preload.ts is a file, so a path pattern that looks for a preload/ directory
  // skips the one file where a bridged Effect would be destroyed by
  // structuredClone. The fixture keeps that path shape to pin it.
  it("rejects effect in the preload bridge", () => {
    const { code, output } = checkWithFixtures({
      "apps/desktop/src/preload.ts": BARE_PROBE,
    });
    expect(output).toContain("apps/desktop/src/preload.ts");
    expect(output).toContain("effect must stay out of shared code");
    expect(code).not.toBe(0);
  });

  it("allows effect in the main process", () => {
    const { code, output } = checkWithFixtures({
      "apps/desktop/src/main/index.ts": BARE_PROBE,
    });
    expect(output).toContain("architecture-check: ok");
    expect(code).toBe(0);
  });

  it("allows scoped @effect imports in the main process", () => {
    const { code, output } = checkWithFixtures({
      "apps/desktop/src/main/index.ts":
        'import * as V from "@effect/vitest";\nexport const probe = V;\n',
    });
    expect(output).toContain("architecture-check: ok");
    expect(code).toBe(0);
  });

  it("reports violation paths with POSIX separators", () => {
    // Every prefix check below runs on the path relative to the root, which
    // `relative` returns with `\` on Windows: unnormalized, the rules above
    // silently pass there. Pinning the output format pins the normalization
    // on every platform.
    const { output } = checkWithFixtures({
      "packages/shared/src/__probe.ts": BARE_PROBE,
    });
    const violation = output.split("\n").find((line) => line.includes("__probe"));
    expect(violation).toBeDefined();
    // The guard indents its report by two; the path itself must be POSIX.
    expect(violation?.trim().startsWith("packages/shared/src/__probe.ts:")).toBe(true);
  });

  // The fixture tree proves the rules; this proves the check still runs over
  // the real project: read-only, no fixtures, so it cannot interfere with a
  // tool scanning the source tree. Slower than the rest by design.
  it("scans the real project clean", { timeout: 30_000 }, () => {
    const { code, output } = runCheck(repoRoot);
    expect(output).toContain("architecture-check: ok");
    expect(code).toBe(0);
  });
});
