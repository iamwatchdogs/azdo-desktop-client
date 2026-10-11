/**
 * The handler registry: config says *which* check, this says *what it does*.
 *
 * A spec whose `handler` is not registered is a configuration error and fails
 * loudly at startup. A missing handler must never degrade into a silent skip —
 * that is how a security gate quietly stops existing.
 */

import {
  coderabbit,
  codacy,
  dependencyScan,
  secretScan,
  staticAnalysis,
} from "./checks/security.ts";
import {
  conflictMarkersInRange,
  conflictMarkersStaged,
  debugStatements,
  endToEndTests,
  largeFiles,
  privateKeys,
} from "./checks/tests.ts";
import { typecheck, unitTests } from "./checks/toolchain.ts";
import type { CheckOutcome } from "./lib/runner.ts";
import type { HandlerSpec, HookContext } from "./lib/types.ts";

type Handler = (ctx: HookContext, spec: HandlerSpec) => Promise<CheckOutcome>;

const HANDLERS: Record<string, Handler> = {
  typecheck: async (ctx) => typecheck(ctx),
  debugStatements: async (ctx) => debugStatements(ctx),
  privateKeys: async (ctx) => privateKeys(ctx),
  largeFiles: async (ctx) => largeFiles(ctx),
  conflictMarkersStaged: async (ctx) => conflictMarkersStaged(ctx),
  conflictMarkersInRange: async (ctx) => conflictMarkersInRange(ctx),
  secretScan: async (ctx, spec) => secretScan(ctx, spec),
  dependencyScan: async (ctx, spec) => dependencyScan(ctx, spec),
  staticAnalysis: async (ctx, spec) => staticAnalysis(ctx, spec),
  unitTests: async (ctx) => unitTests(ctx),
  endToEndTests: async (ctx) => endToEndTests(ctx),
  codacy: async (ctx, spec) => codacy(ctx, spec),
  coderabbit: async (ctx, spec) => coderabbit(ctx, spec),
};

/** Throws if any spec names a handler this registry does not implement. */
export function assertHandlersResolve(specs: readonly { handler: string }[]): void {
  const unknown = specs.map((spec) => spec.handler).filter((handler) => !(handler in HANDLERS));
  if (unknown.length === 0) return;
  throw new Error(
    `hooks.config.ts references unimplemented handler(s): ${[...new Set(unknown)].join(", ")}`,
  );
}

export function runHandler(
  name: string,
  ctx: HookContext,
  spec: HandlerSpec,
): Promise<CheckOutcome> {
  const handler = HANDLERS[name];
  if (handler === undefined) throw new Error(`unimplemented hook handler: ${name}`);
  return handler(ctx, spec);
}
