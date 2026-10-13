import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as Runner from "vite-plus/test";

/**
 * @effect/vitest registers suites through `import * as V from "vitest"` and
 * reads `V.TestRunner.getCurrentSuite`. If that resolves to a different module
 * instance than the one `vp test` executes from, registration and execution
 * land in different places and the runner silently reports zero tests
 * (Effect-TS/effect#6129, which upstream closed as not planned). This test
 * fails loudly instead of passing vacuously.
 */
it("resolves the vitest instance the runner executes from", () => {
  expect(typeof Runner.TestRunner.getCurrentSuite).toBe("function");
});

it.effect("runs an Effect and surfaces its failure", () =>
  Effect.gen(function* () {
    const value = yield* Effect.succeed(41).pipe(Effect.map((n) => n + 1));
    expect(value).toBe(42);
  }),
);
