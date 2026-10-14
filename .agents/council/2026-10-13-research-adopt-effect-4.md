---
id: council-2026-10-13-research-adopt-effect-4
type: council
date: 2026-10-13
flags: --deep --debate --tier=quality --explorers=5
---

## Council Consensus: **WARN**

**Target:** "Check whether the Effect 4 dependency is a good suit for this project" — an
Electron + React 19 pnpm monorepo (`@ado/desktop` main+preload, `@ado/renderer` SPA,
`@ado/shared` contracts) on vite-plus, to be developed heavily with AI-assisted tools and
autonomous agent loops.

**Modes:** research, --deep, --debate
**Judges:** 3 (systems-architect, agentic-dx, contrarian/risk-steward)
**Explorers:** 5 (facets: v4 status/ecosystem/governance · toolchain & bundling · boundary
mechanics · AI-assisted & agent-loop fit · production adoption & risk)
**Fidelity:** full (R1 and R2 in-session; R2 injected lead-verified corrections)

---

## Verdicts

| Judge   | Perspective       | Round 1 | Round 2 | Changed? |
| ------- | ----------------- | ------- | ------- | -------- |
| Judge 1 | systems-architect | WARN    | WARN    | No       |
| Judge 2 | agentic-dx        | WARN    | WARN    | No       |
| Judge 3 | contrarian / risk | WARN    | WARN    | No       |

Unanimous. No judge argued PASS; no judge argued FAIL.

---

## Key Insight

Effect 4 is the **only** TypeScript dependency that packages, in one zero-runtime-dependency
package, everything a rigorous autonomous loop needs (typed error channel, `Schedule`
retry, interruption, `Scope` resource safety, `TestClock`, `withSpan` tracing) — and it
lands 12 days after GA with a first-ever 3-year LTS, an exact TS 7.0.2 / Oxlint 1.87.0
toolchain match, and a default-deny machine gate (`@effect/tsgo`, `allowedUnstableApis: []`)
that converts its biggest weakness into an enforced invariant. But it **cannot** cross this
app's IPC bridge, and Effect's own agentic reference repo (`mikearnaldi/accountability`,
which runs `ralph-auto.sh`) bans Effect from the frontend by design. So the answer is not
yes/no — it is a **bounded, main-process-only, machine-gated adoption**, and the boundary
is architecture rather than a pilot stage.

---

## The Decisive Local Evidence

I ran `structuredClone` against real `effect@4.0.4` values on Node 24.21 (Electron inherits
V8 semantics). This is the single fact that determines the architecture:

| Value crossing `contextBridge`                       | Result                                          |
| ---------------------------------------------------- | ----------------------------------------------- |
| `Data.TaggedError` instance (keys `['repo','_tag']`) | **`{}` — `_tag` and all fields destroyed**      |
| `Effect.succeed(1)`                                  | `{"~effect/Effect/args":1}`, `isEffect: false`  |
| `Effect.gen(...)`                                    | **DataCloneError (DOMException)**               |
| `Exit.succeed(1)`                                    | `{"~effect/Effect/args":1}`, `isExit: false`    |
| `Option.some(1)`                                     | `{"value":1}`, `isOption: false`                |
| `Option.none()`                                      | `{}` — indistinguishable from `{}`              |
| `Cause.fail(...)`                                    | survives; `isCause: true`, `Cause.pretty` works |
| `BigInt` / `Date` / `Map` / `Set`                    | clone cleanly                                   |

Electron documents `ipcRenderer.invoke` as Structured Clone, "Sending Functions, Promises,
Symbols, WeakMaps, or WeakSets will throw", and for `ipcMain.handle`: "only the `message`
property from the original error is provided to the renderer process"
(https://www.electronjs.org/docs/latest/api/ipc-main).

**Consequence:** the existing `CapabilityResult { ok, detail }` contract in
`packages/shared/src/ipc.ts` is not a workaround for Effect — it is the _only_ shape that
survives the bridge. It must stay the wire type. Effect's value is strictly **inside** the
main process.

---

## Verified Facts (primary sources)

| Claim                                                                                                                                                                                                                                                           | Source                                                    | Version/Date |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------ |
| `effect` latest = **4.0.4**, published **2026-10-13** (today); GA 4.0.0 = 2026-10-01 → 12 days old, 4 patches                                                                                                                                                   | registry.npmjs.org/effect                                 | 4.0.4        |
| 105 betas + 11 RCs over 7.5 months                                                                                                                                                                                                                              | npm registry time data                                    | GA           |
| **Zero runtime dependencies**; `type: module`; exports `.` and `./schema`                                                                                                                                                                                       | `npm pack effect@4.0.4` → package.json (verified locally) | 4.0.4        |
| Minimal program 7.1 kB min+gzip (vs 35.6 kB in 3.x); 6.4× throughput; 86% less heap/50k fibers                                                                                                                                                                  | MIGRATION.md; Effect 4.0 release post                     | 4.0.4        |
| `@stability unstable` = breaking in **minor**; `experimental` = breaking in **patch**; "Modules in packages other than `effect` are currently `@stability unstable`"                                                                                            | MIGRATION.md (verbatim)                                   | main         |
| Unstable list: `ai, cli, cluster, devtools, eventlog, http, http-api, jsonschema, observability, persistence, process, reactivity, rpc, schema, socket, sql, workflow, workers`                                                                                 | MIGRATION.md (verbatim)                                   | main         |
| First-ever LTS: bugfixes ≥ Sep 2029 (full policy doc unpublished)                                                                                                                                                                                               | Effect 4.0 release post                                   | Sep 30 2026  |
| `@effect/tsgo@0.51.1` supports **TS 7.0.2** and Oxlint **1.83.0/1.85.0/1.86.0/1.87.0** — exact match for this repo's pins                                                                                                                                       | Effect-TS/tsgo README                                     | 0.51.1       |
| tsgo rules `anyUnknownInErrorContext`, `classSelfMismatch`, `duplicatePackage`, `floatingEffect` (default **error** for `src/**/*.ts`), `apiStabilityLeak`; options `allowedUnstableApis`/`allowedExperimentalApis` default `[]`; structured output for tooling | Effect-TS/tsgo README                                     | 0.51.1       |
| `npx @effect/tsgo setup --help` = "Non-interactive, for LLM friends"                                                                                                                                                                                            | Effect-TS/tsgo README                                     | 0.51.1       |
| Tarball ships `AGENTS.md` + `CLAUDE.md` (19,459 B each) and **82 `ai-docs/` example trees** (`01_basics`…`80_cluster`)                                                                                                                                          | `tar -tzf effect-4.0.4.tgz` (verified locally)            | 4.0.4        |
| No `llms.txt` on effect.website (404)                                                                                                                                                                                                                           | curl                                                      | Oct 13 2026  |
| Shipped `dist/Schema.js` exports `minLength`, `maxLength`, `pattern`, `makeFilter`, `toStandardSchemaV1`, `withDecodingDefault`, `toFormatter`, `decodeUnknownSync`, `TaggedStruct`, `TaggedUnion`, `Result` — docs drift **refuted**                           | grep on shipped dist (verified locally)                   | 4.0.4        |
| effect core dist: **zero `node:` specifiers**, 516 files, no namespaces/enums/decorators/top-level-await                                                                                                                                                        | grep on shipped dist (verified locally)                   | 4.0.4        |
| `@effect/vitest` + `vp test` → **zero tests discovered** (dual vitest instance); closed **not planned** Jul 28 2026; last comment Oct 1 2026 says the old override **no longer works** for Effect 4 + Vite Plus 1, workaround needs literal `vitest: 5.0.1`     | Effect-TS/effect#6129 (verbatim)                          | open issue   |
| Effect's own agentic reference repo: "FRONTEND (web) … **NO Effect code**"; backend "Effect-based"; runs `./ralph-auto.sh`                                                                                                                                      | mikearnaldi/accountability/CLAUDE.md (verbatim)           | 267 lines    |
| OpenCode (213k★) depends on `effect` + `zod` together — it did **not** replace Zod                                                                                                                                                                              | anomalyco/opencode package.json                           | 2026-10-13   |
| 62.8M downloads/wk; 17,261★; MIT; Effectful Technologies Inc.                                                                                                                                                                                                   | npm API / GitHub API                                      | 2026-10-13   |
| `@effect/platform` frozen 0.97.2 (v3); `@effect/schema` frozen 0.75.5 (2024-10-16) yet 1.38M/wk                                                                                                                                                                 | npm registry                                              | today        |
| TS 7.0 GA 2026-07-08; npm latest 7.0.2 (this repo already pins it)                                                                                                                                                                                              | devblogs.microsoft.com/typescript                         | 7.0.2        |

## Refuted Claims (withdrawn during R2)

Two explorer/judge findings were disproven against the shipped tarball and are recorded here
so they are not re-litigated:

1. **"`LLMS.md` / `ai-docs/` do not ship in the tarball"** — refuted. The tarball ships them
   under the names `AGENTS.md` / `CLAUDE.md`, plus 82 real `ai-docs` example trees.
2. **"Schema docs drift means agents will emit hallucinated v3 APIs at scale"** — largely
   refuted. The shipped dist exports the entire documented filter surface. Residual drift is
   narrow: a legacy `Either` nav page, a `Micro` section, and the site's
   `Schema.standardSchemaV1` vs the dist's `Schema.toStandardSchemaV1`.

## Disagreements

None on the verdict. Two scope disagreements, both resolved in favour of the stricter rule:

- Judge 1 would forbid Effect in `packages/shared` outright; Judge 2 permits `import type`.
  → **Adopt the stricter rule** (Judge 1): even a type-only import creates an edge that
  invites later value leakage, and Zod owns that boundary by design.
- Judge 3's opportunity-cost argument (TanStack Query covers the ADO work) — Judge 3 withdrew
  it after Judge 1 established the ADO REST/polling work lives in **main**, where TanStack
  Query (renderer-side) does not apply.

## Cross-Vendor Insights

N/A (single vendor, Claude judges).

## Recommendation (consensus)

**WARN — adopt, but only as a bounded, main-process-only, machine-gated dependency.** Not
app-wide, and not on the bridge.

The exact shape all three judges independently converged on:

1. **`effect: catalog: 4.0.4`** (exact pin, no caret — 4.0.0–4.0.3 had the verified startup
   regressions #8936/#9082; 4.0.4 fixed both). Never a literal version in `package.json`.
2. **Scope: `apps/desktop/src/**` only.** Convert `apps/desktop/src/native.ts` first — its
   return type `{ ok, detail }` already _is_ a `Result`, and its hand-rolled
   `new Promise` + `setTimeout` + `bus.once("connect")` + manual `clearTimeout` dbus probe
   is literally `Effect.tryPromise` + `Effect.timeout("2 seconds")` +
   `Effect.orElseSucceed(describeError)`. Then the ADO REST client, then `main.ts` handlers
   — each ending in exactly one `Effect.runPromise` returning a plain value.
3. **Zero Effect in `apps/renderer`, `preload.ts`, and `packages/shared`** (enforced by
   `scripts/architecture-check.ts`, not by convention).
4. **Keep Zod 4 at the IPC boundary.** Do not migrate `packages/shared` to `effect/Schema`
   — it is `@stability unstable`, and the largest agent-on-Effect precedent (OpenCode) runs
   `effect` _and_ `zod` side by side.
5. **Ship `@effect/tsgo@0.51.1` as a blocking pre-push gate** with `allowedUnstableApis: []`,
   `allowedExperimentalApis: []`, `floatingEffect: "error"`. This is the load-bearing
   condition: it converts MIGRATION.md's 20-module unstable list from a discipline problem
   into a default-deny build failure. **Adoption is void without it.**
   > **Superseded 2026-10-14** by `feat/adopt-effect-4` (PR #1): the gate shipped without
   > `@effect/tsgo` — tsc-rs 0.6.0 carries the TS377xxx diagnostics natively, with
   > `unstableApiUsage`/`experimentalApiUsage` at `error` in `tsconfig.base.json` and the six
   > `*InEffect` rules default-deny global I/O inside Effect code. The default-deny condition
   > this item called load-bearing is met by the pinned compiler's own plugin block; the
   > reasoning above is kept as the historical record.
6. **Do not adopt `@effect/vitest`** — #6129 is closed _not planned_ and the only surviving
   workaround requires a literal `vitest: 5.0.1` override colliding with the catalog's
   `5.0.3`, violating the repo's catalog-only versioning rule. Write plain Vitest 5 specs
   wrapping `Effect.runSync`/`runPromise`.
   > **Superseded 2026-10-14** by `feat/adopt-effect-4` (PR #1): the veto rested on the
   > assumption that compatibility needs a version override. It does not — vite-plus 1.1.0
   > re-exports vitest, so `@effect/vitest` runs on the catalog's `5.0.3`, and the module
   > identity that assumption hinged on is asserted in
   > `apps/desktop/test/effect-bridge.test.ts`, so a future re-export change turns a test
   > red instead of silently running zero suites. The reasoning above is kept as the
   > historical record.
7. **Exclude `@effect/platform-node` and `effect/http`'s Node client.** `platform-node`
   imports `node:stream/http/fs/https/worker_threads` + `undici`, unreachable from the
   sandboxed preload, and its lazy `import("./Undici.js")` would be **inlined** into
   `dist-electron/main.cjs` by a single-file bundle with no code-splitting — a second HTTP
   stack in a process that already has `node:http` and `fetch`.
8. **Three tests/gates to ship with the first commit:**
   - `arch-check` rule: no `effect*` specifier in `packages/**` or `apps/renderer/**`.
   - A Vitest spec asserting every `AzdoBridge` return type is plain-serializable (a
     `structuredClone` round-trip over each shared schema) — this makes "never throw an
     Effect across the bridge" mechanically true rather than aspirational.
   - AGENTS.md note: point agents at `node_modules/effect/AGENTS.md` and
     `node_modules/effect/ai-docs/`, and forbid citing `effect.website`.
9. **Re-evaluate at 4.1/4.2** against: #6129 status, the unpublished full LTS policy,
   residual docs drift, and a **measured cognitive-complexity spike**
   (`pnpm check:complexity`) comparing the converted ADO module against a promise-based
   control.

## The Unmeasured Gap (stated honestly)

No judge found measured data on: LLM accuracy on Effect vs plain TS/Promises; diff size,
review burden, or files-read-per-change under Effect; or whether `Effect.gen` blocks / deep
`.pipe` chains trip a cognitive-complexity ceiling of 15. Zero upstream Effect-TS issues
mention cognitive or cyclomatic complexity. The spike gate in item 9 exists precisely
because this gap is real and is the one number that could change the verdict.

## Severity-Weighted Findings

| Severity    | Finding                                                                                                                                                                           | Owner      |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| significant | Effect values are destroyed by `contextBridge` — `Data.TaggedError` → `{}`, `Exit`/`Effect`/`Option` lose identity, `Effect.gen`/`Schema` throw. Boundary must terminate at main. | all 3      |
| significant | `@effect/vitest` is unusable with `vp test` (#6129 closed not planned; workaround violates catalog-only rule)                                                                     | all 3      |
| significant | 20 ecosystem modules are `@stability unstable`; mitigated only by `@effect/tsgo` `allowedUnstableApis: []` — must be a blocking gate                                              | all 3      |
| significant | Zero measured data on the AI-assisted/complexity premise; spike gate required                                                                                                     | all 3      |
| minor       | `@effect/platform-node` undici inlining into a single-file CJS bundle                                                                                                             | judges 1/2 |
| minor       | Residual docs drift (`standardSchemaV1`, legacy `Either`/`Micro` nav) — ban effect.website in agent context                                                                       | judges 1/2 |
| minor       | 12-day-old GA, 4 patches in 12 days, bus factor of 4 dominant contributors                                                                                                        | judge 3    |
| minor       | `effect` must be banned from `packages/shared` even type-only (stricter than Judge 2)                                                                                             | judge 1    |

---

_Council completed 2026-10-13. 5 explorers + 3 judges × 2 rounds. All load-bearing claims
re-verified by the lead against the shipped `effect@4.0.4` tarball, MIGRATION.md,
`@effect/tsgo` README, and `Effect-TS/effect#6129`._
