import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { effectPluginConfig } from "./effect-config";
import { toPosixPath } from "./to-posix-path";

const root = process.cwd();
const catalog = readFileSync(resolve(root, "pnpm-workspace.yaml"), "utf8");

/** `effect:` in the catalog block, ignoring commented lines. */
function catalogPin(): string {
  const match = /^\s{2}"?effect"?: (\S+)$/m.exec(catalog);
  if (match === null) throw new Error("effect is missing from the pnpm catalog block");
  return match[1]!;
}

/**
 * Version on one `pnpm ls --parseable` line, or undefined for any other
 * line. pnpm prints the platform's separator, so the line is normalized
 * before the regex, which is written for `/`: on the windows job the
 * unnormalized form matches nothing and the single-copy assertion fails as
 * `[]` instead of `["4.0.4"]`.
 */
function parseInstalledLine(line: string): string | undefined {
  const version = /effect@([^/\s]+)\/node_modules\/effect$/.exec(toPosixPath(line.trim()))?.[1];
  // pnpm's store path carries a peer suffix (`4.0.4_react@19.3.0`).
  return version?.split("_")[0];
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
  return output
    .split("\n")
    .map(parseInstalledLine)
    .filter((version): version is string => version !== undefined);
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
 * tsconfig.base.json is JSONC: `//` lines and a `/** ... *` block. The reader
 * in ./effect-config strips both so tests assert the parsed structure.
 */
function effectPlugin(): Record<string, unknown> {
  return effectPluginConfig(root) as unknown as Record<string, unknown>;
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

  it("reads the store path from Windows-style pnpm output", () => {
    // pnpm prints the platform's separator, and CI's windows job is where the
    // unnormalized regex returns [] instead of the pin.
    const windowsLine =
      "C:\\Users\\runner\\AppData\\Local\\pnpm\\store\\v3\\node_modules\\.pnpm\\effect@4.0.4_react@19.3.0\\node_modules\\effect";
    expect(parseInstalledLine(windowsLine)).toBe("4.0.4");
    expect(parseInstalledLine("")).toBeUndefined();
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

  it("treats the effect namespace as Effect, not a bag of functions", () => {
    // The InEffect rules and the namespace import treatment are wired through
    // this list: a package that is not in it does not get the Effect idiom
    // checks at all.
    expect(effectPluginConfig(root).namespaceImportPackages).toContain("effect");
  });
});
