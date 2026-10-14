/**
 * The Effect diagnostics gate, guarded.
 *
 * tsc-rs turns this config into build-failing TS377xxx diagnostics, so every
 * severity in the map is a decision. Before this file the map was untested:
 * a rule could be downgraded to `off`, or removed entirely, and every gate
 * would stay green — the map reads as enforcement whether or not it is. The
 * checks below pin the decisions: which rules are errors, that the globals
 * turned off for the imperative shell have their `InEffect` counterparts
 * enforced, and that no key is misspelled. Update the frozen lists on
 * purpose, in this file, or the build tells you.
 */

import { describe, expect, it } from "vitest";

import { effectPluginConfig } from "./effect-config";

const config = effectPluginConfig();
const severities = config.diagnosticSeverity;

/**
 * Every rule name the pinned @effect/language-service (0.87.4) accepts as a
 * diagnosticSeverity key, taken from the package's own diagnostic names.
 * A key not in this list is a typo: the plugin warns (TS377134) and enforces
 * nothing.
 */
const KNOWN_RULES = [
  "anyUnknownInErrorContext",
  "cryptoRandomUUID",
  "cryptoRandomUUIDInEffect",
  "deterministicKeys",
  "experimentalApiUsage",
  "globalConsole",
  "globalConsoleInEffect",
  "globalDate",
  "globalDateInEffect",
  "globalErrorInEffectCatch",
  "globalErrorInEffectFailure",
  "globalFetch",
  "globalFetchInEffect",
  "globalRandom",
  "globalRandomInEffect",
  "globalTimers",
  "globalTimersInEffect",
  "instanceOfSchema",
  "leakingRequirements",
  "missingEffectServiceDependency",
  "nodeBuiltinImport",
  "preferSchemaOverJson",
  "processEnv",
  "processEnvInEffect",
  "schemaSyncInEffect",
  "unstableApiUsage",
  "unknownInEffectCatch",
  "unsafeEffectTypeAssertion",
] as const;

/**
 * The structural rules: they fire on ordinary code, so an Effect used loosely
 * in the main process is still caught. These are the ones the adoption leans
 * on hardest — a downgrade here is silent until a bug lands.
 */
const STRUCTURAL_ERROR_RULES = [
  "anyUnknownInErrorContext",
  "unsafeEffectTypeAssertion",
  "instanceOfSchema",
  "missingEffectServiceDependency",
  "leakingRequirements",
  "globalErrorInEffectCatch",
  "globalErrorInEffectFailure",
  "unknownInEffectCatch",
  "preferSchemaOverJson",
  "cryptoRandomUUID",
] as const;

describe("effect diagnostics config", () => {
  it("names only rule keys the language service recognizes", () => {
    // The plugin commits typos to a warning, which a typecheck run scrolls
    // past: the rule reads configured and enforces nothing.
    const unknown = Object.keys(severities).filter(
      (rule) => !(KNOWN_RULES as readonly string[]).includes(rule),
    );
    expect(unknown).toEqual([]);
  });

  it("keeps the structural rules at error", () => {
    for (const rule of STRUCTURAL_ERROR_RULES) {
      expect(severities[rule]).toBe("error");
    }
  });

  it("enforces the InEffect counterpart of every global it turns off", () => {
    // The globals are off because the process shell is imperative (node:
    // modules, console.warn, process.env). That is a scope decision, and it
    // is only safe because inside Effect code the same discipline fires.
    for (const global of [
      "globalConsole",
      "globalDate",
      "globalFetch",
      "globalRandom",
      "globalTimers",
    ] as const) {
      expect(severities[global]).toBe("off");
      expect(severities[`${global}InEffect`]).toBe("error");
    }
    // The plain cryptoRandomUUID cannot fire inside Effect code at all — the
    // engine routes it to the InEffect key — so that key is what makes the
    // rule live where Effect runs.
    expect(severities["cryptoRandomUUID"]).toBe("error");
    expect(severities["cryptoRandomUUIDInEffect"]).toBe("error");
    // nodeBuiltinImport has no InEffect counterpart; off is its only state,
    // which is why it is pinned explicitly rather than through the loop.
    expect(severities["nodeBuiltinImport"]).toBe("off");
  });

  it("default-denies the unstable and experimental modules, with one allowlisted edge", () => {
    expect(severities["unstableApiUsage"]).toBe("error");
    expect(severities["experimentalApiUsage"]).toBe("error");
    expect(config.allowedUnstableApis).toEqual(["@effect/vitest"]);
    expect(config.allowedExperimentalApis).toEqual([]);
  });

  it("keeps deterministicKeys a warning rather than silencing it", () => {
    expect(severities["deterministicKeys"]).toBe("warning");
  });
});
