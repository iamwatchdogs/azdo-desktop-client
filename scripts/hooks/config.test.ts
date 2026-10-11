/**
 * Guards on the declarative manifest.
 *
 * Config is data, so it can be checked mechanically: every handler must exist,
 * ids must be unique, and the security gates must not silently lose their
 * fail-closed policy.
 */

import { describe, expect, it } from "vitest";

import { preCommit, preMergeCommit, prePush, specById } from "../../hooks.config.ts";
import { isCommandSpec, isHandlerSpec, type CheckSpec } from "./lib/types.ts";
import { assertHandlersResolve } from "./registry.ts";

const all: CheckSpec[] = [...preCommit, ...prePush, ...preMergeCommit];

describe("hooks.config.ts", () => {
  it("has no duplicate ids within a hook", () => {
    for (const [label, specs] of [
      ["preCommit", preCommit],
      ["prePush", prePush],
      ["preMergeCommit", preMergeCommit],
    ] as const) {
      const ids = specs.map((spec) => spec.id);
      expect(new Set(ids).size, `duplicate id in ${label}`).toBe(ids.length);
    }
  });

  it("references only handlers the registry implements", () => {
    expect(() => assertHandlersResolve(all.filter(isHandlerSpec))).not.toThrow();
  });

  it("rejects a spec naming an unknown handler", () => {
    expect(() => assertHandlersResolve([{ handler: "doesNotExist" }])).toThrow(
      /unimplemented handler/,
    );
  });

  it("keeps security gates fail-closed", () => {
    for (const id of ["gitleaks", "osv-scanner", "semgrep"]) {
      const spec = specById(prePush).get(id);
      expect(spec, `${id} missing from pre-push policy`).toBeDefined();
      expect(spec?.onMissing, `${id} must fail closed`).toBe("fail");
    }
  });

  it("keeps advisory tools skippable", () => {
    for (const id of ["codacy", "coderabbit-advisory"]) {
      expect(specById(prePush).get(id)?.onMissing, `${id} must stay advisory`).not.toBe("fail");
    }
  });

  it("gives every command check a positive timeout", () => {
    for (const spec of all.filter(isCommandSpec)) {
      expect(spec.timeoutMs, `${spec.id} needs a timeout`).toBeGreaterThan(0);
    }
  });

  it("mirrors the push policy for merges", () => {
    expect(preMergeCommit.map((spec) => spec.id)).toEqual(prePush.map((spec) => spec.id));
  });

  it("keeps merge security gates fail-closed too", () => {
    for (const id of ["gitleaks", "osv-scanner", "semgrep"]) {
      expect(specById(preMergeCommit).get(id)?.onMissing, `${id} must fail closed on merge`).toBe(
        "fail",
      );
    }
  });

  it("declares no shell string anywhere — args are arrays", () => {
    for (const spec of all.filter(isCommandSpec)) {
      expect(Array.isArray(spec.args)).toBe(true);
      for (const arg of spec.args) {
        expect(typeof arg).toBe("string");
      }
    }
  });
});
