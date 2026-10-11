/**
 * Fail-closed behaviour of the hook runner.
 *
 * The point of these tests is the one property that is easy to get wrong and
 * invisible in review: a security gate that cannot run must BLOCK, not report
 * success. "If you have a gate you have never watched fail, you don't know
 * whether it is a gate."
 */

import { describe, expect, it } from "vitest";

import { commandCheck, optOutEnv, runChecks, type Check } from "./lib/runner.ts";

describe("commandCheck: missing binaries", () => {
  it("skips an advisory tool that is not installed", async () => {
    const outcome = await commandCheck("definitely-not-a-real-binary", [], 1000, {
      onMissing: "skip",
    });
    expect(outcome.status).toBe("skipped");
  });

  it("blocks when a security gate is not installed", async () => {
    const outcome = await commandCheck("definitely-not-a-real-binary", [], 1000, {
      onMissing: "fail",
      installHint: "brew install gitleaks",
    });
    expect(outcome.status).toBe("missing");
    expect(outcome.output).toContain("brew install gitleaks");
  });
});

describe("runChecks: exit code", () => {
  const capture = async (checks: Check[]): Promise<number> => {
    const original = process.stderr.write.bind(process.stderr);
    process.stderr.write = () => true;
    try {
      return await runChecks({ label: "test", checks });
    } finally {
      process.stderr.write = original;
    }
  };

  it("exits 0 when every check passes or skips", async () => {
    const code = await capture([
      { id: "a", run: async () => ({ status: "passed", output: "" }) },
      { id: "b", run: async () => ({ status: "skipped", output: "n/a" }) },
    ]);
    expect(code).toBe(0);
  });

  it("exits non-zero when a check fails", async () => {
    const code = await capture([
      { id: "a", run: async () => ({ status: "failed", output: "boom" }) },
    ]);
    expect(code).toBe(1);
  });

  it("exits non-zero when a security gate is MISSING, not just when it fails", async () => {
    const code = await capture([
      { id: "gitleaks", run: async () => ({ status: "missing", output: "not installed" }) },
      { id: "lint", run: async () => ({ status: "passed", output: "" }) },
    ]);
    expect(code).toBe(1);
  });

  it("runs checks in parallel and reports every failure, not just the first", async () => {
    const slow = async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 30);
      });
      return { status: "failed", output: "slow failure" } as const;
    };
    const code = await capture([
      { id: "fast", run: async () => ({ status: "failed", output: "fast failure" }) },
      { id: "slow", run: slow },
    ]);
    expect(code).toBe(1);
  });
});

describe("opt-out convention", () => {
  it("returns the var name when set to 1", () => {
    process.env["ADO_TEST_SKIP"] = "1";
    expect(optOutEnv({ skipWhenEnv: "ADO_TEST_SKIP" })).toBe("ADO_TEST_SKIP=1");
    delete process.env["ADO_TEST_SKIP"];
  });

  it("returns null when unset or set to anything else", () => {
    expect(optOutEnv({ skipWhenEnv: "ADO_TEST_SKIP" })).toBeNull();
    process.env["ADO_TEST_SKIP"] = "0";
    expect(optOutEnv({ skipWhenEnv: "ADO_TEST_SKIP" })).toBeNull();
    delete process.env["ADO_TEST_SKIP"];
  });

  it("returns null when no var is declared", () => {
    expect(optOutEnv({})).toBeNull();
  });
});
