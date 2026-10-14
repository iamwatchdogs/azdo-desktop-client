import { describe, expect, it } from "vitest";

import { toPosixPath } from "./to-posix-path";

describe("toPosixPath", () => {
  it("rewrites Windows separators", () => {
    expect(toPosixPath("apps\\desktop\\src\\main\\index.ts")).toBe(
      "apps/desktop/src/main/index.ts",
    );
  });

  it("rewrites an anchored Windows drive path", () => {
    expect(toPosixPath("C:\\repos\\app\\packages\\shared\\src\\ipc.ts")).toBe(
      "C:/repos/app/packages/shared/src/ipc.ts",
    );
  });

  it("leaves POSIX separators untouched", () => {
    expect(toPosixPath("apps/desktop/src/main/index.ts")).toBe("apps/desktop/src/main/index.ts");
  });

  it("leaves an already-mixed path alone", () => {
    expect(toPosixPath("apps/desktop\\src/main")).toBe("apps/desktop/src/main");
  });
});
