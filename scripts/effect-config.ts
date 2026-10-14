/**
 * Reads the @effect/language-service block out of tsconfig.base.json.
 *
 * tsconfig.base.json is JSONC, and the block it holds is a real gate: tsc-rs
 * runs the 377xxx diagnostics from it, so every severity in the map is a
 * build-failing decision. Two test suites read the block — the resolution
 * guards (the plugin must be declared for knip and tsserver) and the
 * diagnostics guards (the severities must stay what they were decided to
 * be) — so the parsing lives here once rather than drifting between them.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface EffectPluginConfig {
  readonly name: string;
  readonly namespaceImportPackages: string[];
  readonly allowedUnstableApis: string[];
  readonly allowedExperimentalApis: string[];
  readonly diagnosticSeverity: Record<string, string>;
}

function stripComments(raw: string): string {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

/** Throws when the plugin block is missing or the tsconfig stops parsing. */
export function effectPluginConfig(root: string = process.cwd()): EffectPluginConfig {
  const raw = readFileSync(resolve(root, "tsconfig.base.json"), "utf8");
  const parsed = JSON.parse(stripComments(raw)) as {
    compilerOptions?: { plugins?: unknown[] };
  };

  const plugins = parsed.compilerOptions?.plugins;
  if (!Array.isArray(plugins)) {
    throw new TypeError("tsconfig.base.json declares no compilerOptions.plugins array");
  }

  const plugin = plugins.find(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" &&
      entry !== null &&
      (entry as { name?: unknown }).name === "@effect/language-service",
  );
  if (plugin === undefined) {
    throw new TypeError("@effect/language-service plugin block is missing");
  }

  const severity = plugin["diagnosticSeverity"];
  if (typeof severity !== "object" || severity === null) {
    throw new TypeError("@effect/language-service block declares no diagnosticSeverity map");
  }

  const strings = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

  return {
    name: String(plugin["name"]),
    namespaceImportPackages: strings(plugin["namespaceImportPackages"]),
    allowedUnstableApis: strings(plugin["allowedUnstableApis"]),
    allowedExperimentalApis: strings(plugin["allowedExperimentalApis"]),
    diagnosticSeverity: severity as Record<string, string>,
  };
}
