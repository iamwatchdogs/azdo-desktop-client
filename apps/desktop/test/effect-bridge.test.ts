import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as VitePlusTest from "vite-plus/test";
import * as Vitest from "vitest";

/**
 * @effect/vitest registers suites through `import * as V from "vitest"` and
 * reads `V.TestRunner.getCurrentSuite`. If that is a different module instance
 * from the one the runner executes, registration and execution land in
 * different places and vitest silently reports zero tests
 * (Effect-TS/effect#6129). pingdotgg/t3code closed that by patching
 * @effect/vitest to import vite-plus/test directly; on vite-plus 1.1.0 the
 * patch is unnecessary because vite-plus/test re-exports vitest, so the two
 * specifiers below are the same object. That identity is what makes the
 * unpatched setup work, and it is what this asserts — a typeof check would
 * pass on any instance and prove nothing.
 */
it("resolves the same TestRunner from vitest and vite-plus/test", () => {
  expect(Vitest.TestRunner).toBe(VitePlusTest.TestRunner);
});

it.effect("runs an Effect and asserts inside it", () =>
  Effect.gen(function* () {
    const value = yield* Effect.succeed(41).pipe(Effect.map((n) => n + 1));
    expect(value).toBe(42);
  }),
);
