import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { type DbusBus, probeDbus, probeOpenBus } from "../src/native";

/**
 * A stand-in bus. `emit` decides which event the probe observes; leaving it
 * unset is how the deadline path is driven, because nothing ever fires. The
 * handler is deferred a tick so the resume happens after registration, the way
 * a real EventEmitter would.
 */
function stubBus(options: { emit?: "connect" | "error"; onDisconnect?: () => void }): {
  open: Effect.Effect<DbusBus, string>;
  wasClosed: () => boolean;
} {
  let closed = false;
  const bus: DbusBus = {
    once: (event, handler) => {
      if (event === options.emit) {
        setTimeout(handler, 0);
      }
    },
    disconnect: () => {
      closed = true;
      options.onDisconnect?.();
    },
  };
  return { open: Effect.succeed(bus), wasClosed: () => closed };
}

/**
 * probeDbus must never throw: it reports a missing session bus as a result, so
 * the main process can answer the IPC probe on any platform. Which branch runs
 * depends on the host, so these assert the contract, not the outcome.
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

it.effect("keeps the reason the session bus was unavailable", () =>
  Effect.promise(async () => {
    const result = await probeDbus();
    if (result.ok) {
      expect(result.detail).toBe("session bus reachable");
      return;
    }
    // The probe never collapses a failure to a bare "no session bus": a host
    // with a stale DBUS_SESSION_BUS_ADDRESS still has to be diagnosable, which
    // is what the pre-Effect implementation reported through describeError.
    expect(result.detail).toMatch(/^no session bus \(expected outside a Linux desktop session\)/);
    const reason = result.detail.slice(
      "no session bus (expected outside a Linux desktop session): ".length,
    );
    expect(reason.length).toBeGreaterThan(0);
  }),
);

// The three paths below need a bus, so they drive probeOpenBus directly. On a
// host with no session bus, dbus-next's sessionBus() throws before any of this
// runs, so probing the real bus cannot reach the connect race at all.

it.effect("reports reachable and closes the bus when it connects", () =>
  Effect.gen(function* () {
    const { open, wasClosed } = stubBus({ emit: "connect" });
    const result = yield* probeOpenBus(open);

    expect(result).toStrictEqual({ ok: true, detail: "session bus reachable" });
    expect(wasClosed()).toBe(true);
  }),
);

it.effect("reports unavailable and closes the bus when the bus errors", () =>
  Effect.gen(function* () {
    const { open, wasClosed } = stubBus({ emit: "error" });
    const result = yield* probeOpenBus(open);

    expect(result.ok).toBe(false);
    expect(result.detail).toBe("no session bus (expected outside a Linux desktop session)");
    expect(wasClosed()).toBe(true);
  }),
);

it.effect("gives up at the deadline and still closes the bus", () =>
  Effect.gen(function* () {
    // Nothing fires, so the probe can only finish by hitting its own deadline.
    const { open, wasClosed } = stubBus({});
    const result = yield* probeOpenBus(open);

    expect(result.ok).toBe(false);
    expect(result.detail).toBe("no session bus (expected outside a Linux desktop session)");
    expect(wasClosed()).toBe(true);
  }).pipe(Effect.timeout("10 seconds")),
);

it.effect("reports the reason the bus could not be opened", () =>
  Effect.gen(function* () {
    const result = yield* probeOpenBus(Effect.fail("could not get DISPLAY environment variable"));

    expect(result.ok).toBe(false);
    expect(result.detail).toBe(
      "no session bus (expected outside a Linux desktop session): could not get DISPLAY environment variable",
    );
  }),
);

it.effect("still reports when closing the bus throws", () =>
  Effect.gen(function* () {
    const { open } = stubBus({
      emit: "connect",
      onDisconnect: () => {
        throw new Error("already disconnected");
      },
    });
    const result = yield* probeOpenBus(open);

    expect(result.ok).toBe(true);
    expect(result.detail).toBe("session bus reachable");
  }),
);
