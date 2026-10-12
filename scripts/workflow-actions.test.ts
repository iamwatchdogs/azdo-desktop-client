/**
 * Workflow action references, guarded against the failure mode that has no local
 * signal.
 *
 * A `uses:` value GitHub cannot resolve kills the job at "Prepare all required
 * actions" — after every typecheck, lint and unit test in this repo has already
 * passed. The CI failure this file exists for was `google/osv-scanner-action`
 * pinned at a ref whose repo-root `action.yml` carries no `runs:` section, so
 * the bare repo root was never a working reference. Only the workflow text can
 * state what the reference must be, so only the workflow text is asserted.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { ActionReference } from "./workflow-actions.ts";
import { actionReferencesIn, unpinnedReferences } from "./workflow-actions.ts";

const CI_WORKFLOW = ".github/workflows/ci.yml";

// The v2.6.0 tag commit of google/osv-scanner-action.
const OSV_SCANNER_V2_6_0 = "a345acffa64b0eaede81a3d9aae6141214d9c8fc";

function ciReferences(): ActionReference[] {
  return actionReferencesIn(readFileSync(resolve(process.cwd(), CI_WORKFLOW), "utf8"));
}

function osvScannerReference(): ActionReference | undefined {
  return ciReferences().find(({ action }) => action.endsWith("osv-scanner-action"));
}

describe("osv-scanner-action", () => {
  it("runs the action from its subdirectory, not the repo root", () => {
    expect(osvScannerReference()?.action).toBe("google/osv-scanner-action/osv-scanner-action");
  });

  it("stays on the reviewed v2.6.0 pin", () => {
    // Deliberate bumps update both the pin here and the comment in ci.yml, so a
    // new release is re-verified rather than drifting in with a ref change.
    expect(osvScannerReference()?.ref).toBe(OSV_SCANNER_V2_6_0);
  });
});

describe("action pins", () => {
  it("resolves every action in CI to a full commit SHA", () => {
    expect(unpinnedReferences(ciReferences())).toEqual([]);
  });
});
