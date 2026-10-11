/**
 * Policy rules exercised directly against their exported pure helpers.
 *
 * These cover the false-positive behaviour that makes teams disable hooks: a
 * rule that cries wolf on ordinary syntax gets bypassed, and bypassing one rule
 * erodes trust in all the others.
 */

import { describe, expect, it } from "vitest";

import type { AddedLine } from "./lib/git.ts";
import {
  conflictViolationsInFile,
  debugRuleAppliesToFile,
  debugViolationsInFile,
  isConflictMarker,
  fileOptsOut,
  largeFileViolation,
  privateKeyViolationsInText,
} from "./policy.ts";

// These tests feed real rule patterns as fixture data, so the file opts out of
// the debug-statement rule that would otherwise flag its own fixtures.
// debug-statements: allow

const line = (n: number, text: string): AddedLine => ({ line: n, text });

describe("debug statements", () => {
  it("flags a debugger statement", () => {
    const found = debugViolationsInFile("src/a.ts", [line(10, "debugger;")]);
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(10);
  });

  it("flags a leftover console.log in application code", () => {
    expect(debugViolationsInFile("src/a.ts", [line(3, 'console.log("x");')])).toHaveLength(1);
  });

  it("flags console.log in the desktop entrypoints too", () => {
    expect(
      debugViolationsInFile("apps/desktop/src/main.ts", [line(3, "console.log(1);")]),
    ).toHaveLength(1);
    expect(
      debugViolationsInFile("apps/desktop/src/preload.ts", [line(3, "console.log(1);")]),
    ).toHaveLength(1);
  });

  it("flags console.log in build and hook scripts", () => {
    expect(debugViolationsInFile("scripts/foo.ts", [line(1, "console.log(1);")])).toHaveLength(1);
    expect(
      debugViolationsInFile("apps/desktop/scripts/dev.ts", [line(1, "console.log(1);")]),
    ).toHaveLength(1);
  });

  it("allows an intentional console.log that carries the allow marker", () => {
    expect(
      debugViolationsInFile("apps/desktop/src/main.ts", [
        line(1, "console.log(1); // debug-statements: allow"),
      ]),
    ).toHaveLength(0);
  });

  it("allows console.log in test files", () => {
    expect(debugViolationsInFile("src/a.test.ts", [line(3, "console.log(1);")])).toHaveLength(0);
  });

  it("ignores a commented-out debugger", () => {
    expect(debugViolationsInFile("src/a.ts", [line(1, "// debugger;")])).toHaveLength(0);
  });

  it("honours the allow marker", () => {
    expect(
      debugViolationsInFile("src/a.ts", [line(1, "debugger; // debug-statements: allow")]),
    ).toHaveLength(0);
  });

  it("does not let a marker on one line exempt another line in the same file", () => {
    expect(
      debugViolationsInFile("apps/desktop/src/main.ts", [
        line(1, "console.log(1); // debug-statements: allow"),
        line(2, "console.log(2);"),
      ]),
    ).toHaveLength(1);
  });

  it("flags focused tests, including in non-test files", () => {
    expect(
      debugViolationsInFile("src/a.test.ts", [line(1, 'fdescribe("x", () => {})')]),
    ).toHaveLength(1);
  });

  it("only applies the .only rule to test files", () => {
    expect(
      debugRuleAppliesToFile(
        { pattern: /\.only\(/, label: "only", testFileOnly: true },
        "src/a.ts",
      ),
    ).toBe(false);
    expect(
      debugRuleAppliesToFile(
        { pattern: /\.only\(/, label: "only", testFileOnly: true },
        "src/a.test.ts",
      ),
    ).toBe(true);
  });
});

describe("conflict markers", () => {
  it("flags git markers in any file type", () => {
    expect(isConflictMarker("src/a.ts", "<<<<<<< HEAD")).toBe(true);
    expect(isConflictMarker("src/a.ts", ">>>>>>> other")).toBe(true);
    expect(isConflictMarker("image.png", "<<<<<<< HEAD")).toBe(true);
  });

  it("flags the ======= bar only in text-like files", () => {
    expect(isConflictMarker("src/a.ts", "=======")).toBe(true);
    expect(isConflictMarker("config/settings.json", "=======")).toBe(true);
    // `=======` is not a conflict marker in binary-ish paths.
    expect(isConflictMarker("assets/data.bin", "=======")).toBe(false);
  });

  it("treats < and > markers as conflicts in every file type", () => {
    expect(isConflictMarker("assets/data.bin", "<<<<<<< HEAD")).toBe(true);
    expect(isConflictMarker("README.md", ">>>>>>> other")).toBe(true);
  });

  it("reports the line number of the marker", () => {
    const found = conflictViolationsInFile("src/a.ts", [line(42, "<<<<<<< HEAD")]);
    expect(found[0]?.line).toBe(42);
  });

  it("honours the allow marker", () => {
    expect(
      conflictViolationsInFile("src/a.ts", [
        line(1, "<<<<<<< HEAD // check-merge-conflict: allow"),
      ]),
    ).toHaveLength(0);
  });
});

describe("private keys", () => {
  it("detects a PEM RSA key and reports its line", () => {
    const pem = ["# key", "-----BEGIN RSA PRIVATE KEY-----", "AAAA"].join("\n");
    const found = privateKeyViolationsInText("id_rsa", pem);
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(2);
  });

  it("detects an OpenSSH key", () => {
    expect(
      privateKeyViolationsInText("id_ed25519", "-----BEGIN OPENSSH PRIVATE KEY-----\nxx"),
    ).toHaveLength(1);
  });

  it("detects a PuTTY key file", () => {
    expect(privateKeyViolationsInText("k.ppk", "PuTTY-User-Key-File-3: ssh-rsa")).toHaveLength(1);
  });

  it("ignores ordinary text", () => {
    expect(privateKeyViolationsInText("README.md", "no secrets here")).toHaveLength(0);
  });

  it("honours the allow marker", () => {
    const pem = "-----BEGIN RSA PRIVATE KEY-----\n// detect-private-key: allow";
    expect(privateKeyViolationsInText("fixture.pem", pem)).toHaveLength(0);
  });
});

describe("oversized files", () => {
  const MIB = 1024 * 1024;

  it("allows a file at the limit", () => {
    expect(largeFileViolation("a.bin", 100 * MIB)).toBeNull();
  });

  it("rejects a file just over the limit and names both sizes", () => {
    const violation = largeFileViolation("a.bin", 100 * MIB + 1);
    expect(violation?.message).toBe("100.0 MiB exceeds 100 MiB limit");
    expect(violation?.line).toBeNull();
  });

  it("treats an unmeasurable blob as not oversized", () => {
    expect(largeFileViolation("deleted.bin", null)).toBeNull();
  });
});

describe("opt-out markers", () => {
  it("is file-scoped: one marker line silences the whole file", () => {
    const lines = [
      line(1, "// debug-statements: allow"),
      line(2, "debugger;"),
      line(3, 'console.log("x");'),
    ];
    expect(fileOptsOut(lines, "debug-statements: allow")).toBe(true);
  });

  it("does not opt out when no line carries the marker", () => {
    expect(fileOptsOut([line(1, "debugger;")], "debug-statements: allow")).toBe(false);
  });
});
