import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

/**
 * architecture-check.ts is a CLI that scans the whole project when it runs, so
 * it is exercised the way the push gate runs it: as a subprocess against real
 * files. Fixtures are always restored, including when the assertion fails.
 */
function runCheck(): { code: number; output: string } {
  try {
    const output = execFileSync("node", ["scripts/architecture-check.ts"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status: number | null; stdout: string; stderr: string };
    return { code: failure.status ?? 1, output: `${failure.stdout}${failure.stderr}` };
  }
}

/** Replace `relativePath` with `contents`, run the check, restore the original. */
function checkWithFixture(relativePath: string, contents: string): string {
  const absolute = resolve(root, relativePath);
  const original = existsSync(absolute) ? readFileSync(absolute, "utf8") : undefined;
  writeFileSync(absolute, contents);
  try {
    return runCheck().output;
  } finally {
    if (original === undefined) {
      rmSync(absolute);
    } else {
      writeFileSync(absolute, original);
    }
  }
}

/** Append an effect import to a file that already has real content. */
function checkWithAppendedImport(relativePath: string): string {
  const absolute = resolve(root, relativePath);
  return checkWithFixture(
    relativePath,
    `${readFileSync(absolute, "utf8")}\nimport { Effect } from "effect";\nexport const __archProbe = Effect.succeed(1);\n`,
  );
}

describe("architecture-check effect boundary", () => {
  it("rejects effect in packages/shared", () => {
    const output = checkWithFixture(
      "packages/shared/src/__arch-probe.ts",
      'import { Effect } from "effect";\nexport const probe = Effect.succeed(1);\n',
    );
    expect(output).toContain("packages/shared/src/__arch-probe.ts");
    expect(output).toContain("effect must stay out of shared code");
  });

  it("rejects effect in the renderer", () => {
    const output = checkWithFixture(
      "apps/renderer/src/__arch-probe.ts",
      'import { Effect } from "effect";\nexport const probe = Effect.succeed(1);\n',
    );
    expect(output).toContain("apps/renderer/src/__arch-probe.ts");
    expect(output).toContain("effect must stay out of shared code");
  });

  // A regex that only matches the bare package lets every scoped @effect/*
  // import through, and arch-check is the only barrier: effect resolves from
  // packages/ and apps/renderer via the root symlink regardless of which
  // workspace declares the dependency.
  it("rejects scoped @effect imports in the renderer", () => {
    const output = checkWithFixture(
      "apps/renderer/src/__arch-probe.ts",
      'import { HttpServer } from "@effect/platform";\nexport const probe = HttpServer;\n',
    );
    expect(output).toContain("apps/renderer/src/__arch-probe.ts");
    expect(output).toContain("@effect/platform");
  });

  it("rejects scoped @effect imports in packages/shared, including the sanctioned test dep", () => {
    for (const specifier of ["@effect/platform", "@effect/vitest"]) {
      const output = checkWithFixture(
        "packages/shared/src/__arch-probe.ts",
        `import * as probe from "${specifier}";\nexport const p = probe;\n`,
      );
      expect(output).toContain("packages/shared/src/__arch-probe.ts");
      expect(output).toContain(specifier);
    }
  });

  it("rejects a dynamic @effect import in the preload bridge", () => {
    const absolute = resolve(root, "apps/desktop/src/preload.ts");
    const original = readFileSync(absolute, "utf8");
    writeFileSync(
      absolute,
      `${original}\nexport const __archProbe = () => import("@effect/platform");\n`,
    );
    try {
      const output = runCheck().output;
      expect(output).toContain("apps/desktop/src/preload.ts");
      expect(output).toContain("@effect/platform");
    } finally {
      writeFileSync(absolute, original);
    }
  });

  // preload.ts is a file, so a path pattern that looks for a preload/ directory
  // skips the one file where a bridged Effect would be destroyed by
  // structuredClone. This appends to the real preload.ts to pin that.
  it("rejects effect in the preload bridge", () => {
    const output = checkWithAppendedImport("apps/desktop/src/preload.ts");
    expect(output).toContain("apps/desktop/src/preload.ts");
    expect(output).toContain("effect must stay out of shared code");
  });

  it("allows effect in the main process", () => {
    const output = checkWithFixture(
      "apps/desktop/src/__arch-probe-main.ts",
      'import { Effect } from "effect";\nexport const probe = Effect.succeed(1);\n',
    );
    expect(output).toContain("architecture-check: ok");
  });

  it("allows scoped @effect imports in the main process", () => {
    const output = checkWithFixture(
      "apps/desktop/src/__arch-probe-main.ts",
      'import * as V from "@effect/vitest";\nexport const probe = V;\n',
    );
    expect(output).toContain("architecture-check: ok");
  });
});
