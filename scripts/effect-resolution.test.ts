import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const catalog = readFileSync(resolve(root, "pnpm-workspace.yaml"), "utf8");

/** `effect:` in the catalog block, ignoring commented lines. */
function catalogPin(): string {
  const match = /^\s{2}"?effect"?: (\S+)$/m.exec(catalog);
  if (match === null) throw new Error("effect is missing from the pnpm catalog block");
  return match[1]!;
}

/**
 * pingdotgg/t3code hit this twice: t3@0.0.23 crashed at startup with
 * `state.value.asEffect is not a function` because a floating
 * @effect/platform-node-shared resolved a second effect copy, and t3@0.0.40
 * hung in an ERESOLVE loop for the same reason with rc.114. Two copies means
 * two module instances, so a Layer built against one is rejected by the
 * other's tag check.
 */
function installedEffectVersions(): string[] {
  const output = execFileSync("pnpm", ["ls", "effect", "--depth", "Infinity", "--parseable"], {
    cwd: root,
    encoding: "utf8",
  });
  return (
    output
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => /effect@([^/\s]+)\/node_modules\/effect$/.exec(line.trim())?.[1])
      // pnpm's store path carries a peer suffix (`4.0.4_react@19.3.0`).
      .map((version) => version?.split("_")[0])
      .filter((version): version is string => version !== undefined)
  );
}

/** Runtime deps of the effect copy apps/desktop actually imports. */
function effectRuntimeDependencies(): string[] {
  const manifestPath = execFileSync("node", ["-p", 'require.resolve("effect/package.json")'], {
    cwd: resolve(root, "apps/desktop"),
    encoding: "utf8",
  }).trim();
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    dependencies?: Record<string, string>;
  };
  return Object.keys(manifest.dependencies ?? {});
}

/**
 * tsconfig.base.json is JSONC: `//` lines and a `/** ... *` block. Strip both
 * so the block can be parsed structurally rather than asserted as text.
 */
function tsconfigBase(): { compilerOptions: Record<string, unknown> } {
  const raw = readFileSync(resolve(root, "tsconfig.base.json"), "utf8");
  const json = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
  return JSON.parse(json) as { compilerOptions: Record<string, unknown> };
}

function effectPlugin(): Record<string, unknown> {
  const { compilerOptions } = tsconfigBase();
  const plugins = compilerOptions["plugins"];
  if (!Array.isArray(plugins)) throw new Error("tsconfig.base.json declares no compiler plugins");
  const effect = plugins.find(
    (plugin): plugin is Record<string, unknown> =>
      typeof plugin === "object" &&
      plugin !== null &&
      (plugin as { name?: string }).name === "@effect/language-service",
  );
  if (effect === undefined) throw new Error("@effect/language-service plugin block is missing");
  return effect;
}

describe("effect dependency resolution", () => {
  it("pins effect exactly in the catalog so no workspace can float it", () => {
    const pin = catalogPin();
    // Exact, no caret or range: a caret is what let t3code resolve two copies.
    expect(pin).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("resolves exactly one effect copy across every workspace", () => {
    expect(installedEffectVersions()).toEqual([catalogPin()]);
  });

  it("does not pull a runtime dependency tree into effect", () => {
    expect(effectRuntimeDependencies()).toEqual([]);
  });

  it("declares the language-service plugin tsc-rs runs, so the gate resolves", () => {
    // knip fails the push gate when the plugin is referenced but undeclared,
    // and an editor's tsserver cannot resolve it either.
    const rootManifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      devDependencies: Record<string, string>;
    };
    expect(rootManifest.devDependencies["@effect/language-service"]).toBe("catalog:");
    expect(effectPlugin()["name"]).toBe("@effect/language-service");
  });

  it("default-denies unstable Effect APIs except the one proven edge", () => {
    const allowed = effectPlugin()["allowedUnstableApis"];
    expect(allowed).toEqual(["@effect/vitest"]);
    expect(effectPlugin()["allowedExperimentalApis"]).toEqual([]);

    const severity = effectPlugin()["diagnosticSeverity"];
    expect(typeof severity).toBe("object");
    const severities = severity as Record<string, string>;
    expect(severities["unstableApiUsage"]).toBe("error");
    expect(severities["experimentalApiUsage"]).toBe("error");
    expect(severities["anyUnknownInErrorContext"]).toBe("error");
    expect(severities["leakingRequirements"]).toBe("error");
  });

  it("does not relax the global-I/O rules the main process needs", () => {
    // main.ts is plain imperative tooling on purpose: it must be able to use
    // node:path and console.warn without opting out line by line.
    const severities = effectPlugin()["diagnosticSeverity"] as Record<string, string>;
    expect(severities["nodeBuiltinImport"]).toBe("off");
    expect(severities["globalConsole"]).toBe("off");
  });
});
