import type { CapabilityResult } from "@ado/shared";
import { Effect } from "effect";

// Imports are lazy: a missing platform prebuild must not kill the main process.
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** @napi-rs/keyring — Keychain / Credential Manager / Secret Service. */
export async function getSecret(service: string, account: string): Promise<string | null> {
  const { Entry } = await import("@napi-rs/keyring");
  return new Entry(service, account).getPassword();
}

export async function setSecret(service: string, account: string, secret: string): Promise<void> {
  const { Entry } = await import("@napi-rs/keyring");
  new Entry(service, account).setPassword(secret);
}

/** @crowecawcaw/xa11y — accessibility tree (AX / UIA / AT-SPI). */
export async function checkAccessibility(): Promise<CapabilityResult> {
  let xa11y: typeof import("@crowecawcaw/xa11y");
  try {
    xa11y = await import("@crowecawcaw/xa11y");
  } catch (error) {
    return { ok: false, detail: `xa11y unavailable: ${describeError(error)}` };
  }

  try {
    const apps = await xa11y.App.list();
    return { ok: true, detail: `accessibility API available (${apps.length} app(s) listed)` };
  } catch (error) {
    if (error instanceof xa11y.PermissionDeniedError) {
      return { ok: false, detail: "accessibility permission not granted" };
    }
    return { ok: false, detail: describeError(error) };
  }
}

const NO_SESSION_BUS = "no session bus (expected outside a Linux desktop session)";

/**
 * The slice of a dbus-next bus this probe drives. Narrow on purpose: the probe
 * only listens for two events and closes the bus, so a test double needs no
 * native module and no session bus.
 */
export interface DbusBus {
  once(event: "connect" | "error", handler: () => void): void;
  disconnect(): void;
}

/**
 * Runs the probe against `open`, which yields the bus or the reason it is
 * unavailable. Taking the opener as a parameter is what lets the connect race,
 * the deadline and the scope close be driven directly; probeDbus is this with
 * the real opener wired in.
 */
export function probeOpenBus(
  open: Effect.Effect<DbusBus, string>,
): Effect.Effect<CapabilityResult> {
  return Effect.scoped(
    Effect.gen(function* () {
      // acquireRelease is what makes disconnect run on every path below.
      const bus = yield* Effect.acquireRelease(open, (opened) =>
        Effect.sync(() => {
          try {
            opened.disconnect();
          } catch {
            // A bus that never connected is already torn down, and its
            // disconnect throwing must not turn a reported probe into a
            // defect.
          }
        }),
      );

      return yield* Effect.callback<boolean>((resume) => {
        const timeout = setTimeout(() => resume(Effect.succeed(false)), 2_000);
        const settle = (value: boolean) => {
          clearTimeout(timeout);
          resume(Effect.succeed(value));
        };
        bus.once("connect", () => settle(true));
        bus.once("error", () => settle(false));
      }).pipe(
        Effect.timeout("2 seconds"),
        Effect.orElseSucceed(() => false),
      );
    }),
  ).pipe(
    Effect.match({
      onSuccess: (connected) =>
        connected
          ? { ok: true, detail: "session bus reachable" }
          : { ok: false, detail: NO_SESSION_BUS },
      onFailure: (reason) => ({ ok: false, detail: `${NO_SESSION_BUS}: ${reason}` }),
    }),
  );
}

/**
 * dbus-next — Linux session bus.
 *
 * Expressing the connect race as an Effect rather than a hand-rolled promise
 * keeps the whole attempt inside one scope: Effect.acquireRelease guarantees
 * disconnect runs on every path, and dbus-next's import-time and call-time
 * throws stay in the failure channel instead of escaping as defects. A missing
 * session bus is an expected state outside a Linux desktop session, so this
 * function reports it as a result rather than throwing, and keeps the reason:
 * a host with a stale DBUS_SESSION_BUS_ADDRESS is still a host an operator
 * needs told about.
 */
export async function probeDbus(): Promise<CapabilityResult> {
  return Effect.runPromise(
    probeOpenBus(
      Effect.gen(function* () {
        // dbus-next throws while its module initialises on a host with no dbus
        // address, so the import itself has to be in the failure channel.
        const { sessionBus } = yield* Effect.tryPromise({
          try: () => import("dbus-next"),
          catch: describeError,
        });
        // sessionBus() throws synchronously where there is no session bus.
        return yield* Effect.try({
          try: () => sessionBus() as unknown as DbusBus,
          catch: describeError,
        });
      }),
    ),
  );
}

/** ffi-rs — resolve getpid() through libSystem / libc / kernel32. */
export async function probeFfi(): Promise<CapabilityResult> {
  try {
    const { DataType, open, load, close } = await import("ffi-rs");
    const target =
      process.platform === "win32"
        ? { library: "kernel32.dll", funcName: "GetCurrentProcessId" }
        : process.platform === "darwin"
          ? { library: "/usr/lib/libSystem.B.dylib", funcName: "getpid" }
          : { library: "libc.so.6", funcName: "getpid" };

    open({ library: "ffi-probe", path: target.library });
    const pid = load({
      library: "ffi-probe",
      funcName: target.funcName,
      retType: DataType.I32,
      paramsType: [],
      paramsValue: [],
    });
    close("ffi-probe");

    return { ok: typeof pid === "number", detail: `${target.funcName}() = ${String(pid)}` };
  } catch (error) {
    return { ok: false, detail: describeError(error) };
  }
}
