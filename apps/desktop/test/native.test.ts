import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { probeDbus } from "../src/native";

/**
 * probeDbus must never throw: it reports a missing session bus as a result, so
 * the main process can answer the IPC probe on any platform. On macOS/Linux
 * desktops a session bus may or may not exist, so the assertion is on the shape
 * and the reachability invariant, not on which branch runs.
 */
it.effect("returns a plain-serializable capability result", () =>
  Effect.promise(async () => {
    const result = await probeDbus();

    expect(Object.keys(result).toSorted()).toStrictEqual(["detail", "ok"]);
    expect(typeof result.detail).toBe("string");
    expect(result.detail.length).toBeGreaterThan(0);
    // ok and detail must agree, and the result must survive the bridge.
    expect(result.ok).toBe(result.detail === "session bus reachable");
    expect(() => structuredClone(result)).not.toThrow();
    expect(structuredClone(result)).toStrictEqual(result);
  }),
);

it.effect("resolves within the probe deadline instead of hanging", () =>
  Effect.promise(async () => {
    const started = Date.now();
    await probeDbus();
    // The internal race is 2s and the timeout is the same, so a hang here means
    // the deadline stopped working.
    expect(Date.now() - started).toBeLessThan(5_000);
  }).pipe(Effect.timeout("10 seconds")),
);

it.effect("handles the missing-bus host the same way the old impl did", () =>
  Effect.promise(async () => {
    const result = await probeDbus();
    // On a machine with no session bus both impls must report not-available
    // rather than throw: the IPC handler answers the probe on any platform.
    if (result.ok) {
      expect(result.detail).toBe("session bus reachable");
    } else {
      expect(result.detail).toBe("no session bus (expected outside a Linux desktop session)");
    }
  }),
);
