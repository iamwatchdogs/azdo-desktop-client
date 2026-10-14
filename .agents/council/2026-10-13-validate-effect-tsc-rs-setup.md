---
id: council-2026-10-13-validate-effect-tsc-rs-setup
type: council
date: 2026-10-13
flags: --deep --debate --tier=quality --explorers=5
---

## Council Consensus: **WARN**

**Target:** "Has the Effect 4 + tsc-rs setup (the one used upstream in `pingdotgg/t3code`) been configured in this repo?"
Repo: `/Users/shamith/Projects/active/azure-devops-app` — Electron desktop app on a vite-plus pnpm monorepo.

**Modes:** validate, --deep, --debate
**Rounds:** 2 (independent assessment + adversarial debate)
**Fidelity:** full (judges retained R1 context via session resumption; R2 injected lead-verified corrections)
**Judges:** 3 — Judge 1 (correctness/completeness), Judge 2 (risk), Judge 3 (completeness/self-consistency)
**Explorers:** 5 — compiler wiring · plugin activation chain · rule-map comparison · effect-tsgo mechanism · placement & boundary
**Tier:** quality requested; **degraded** — the quality model (`Anthropic: Claude Opus 4.8`) returned `PAID_MODEL_AUTH_REQUIRED`, so judges ran on the default subagent model. Flagged because it affects the _strength_ of the reasoning, not the _content_ of the verdicts, which are independently corroborated by the lead's own mutation evidence below.

---

## Answer to the question

**Yes — it is configured, and on the axis that matters most it is configured more strictly than upstream.** `effect@4.0.4`, `@effect/language-service@0.87.4`, `@effect/vitest@4.0.4`, `tsc-rs@0.6.0`, `typescript@7.0.2` are all exact catalog pins; the `@effect/language-service` plugin entry at `tsconfig.base.json:38-79` reaches all five tsconfigs; `tsc-rs --noEmit` is the compiler in every workspace plus the `scripts/` task; and the Effect 4 stability gate is not aspirational — `TS377136` fires as an **error** on an unstable import.

**The one upstream mechanism this repo deliberately does not replicate — `@effect/tsgo` + `effect-tsgo patch` in `prepare` — is obsolete there, not missing.** `node_modules/tsc-rs/README.md:20-29` states the diagnostics are "built in … so an Effect project needs no second compiler", and `effect-tsgo patch` patches the plain `typescript` package — the compiler this repo never runs (proved: TS377136 under `tsc-rs`, zero diagnostics under plain `tsc` 7.0.2).

**The verdict is WARN because three machine gates and two top-level docs have real holes** — the most consequential being that the app's single load-bearing architectural boundary is protected by exactly one regex that covers only half of the Effect namespace.

---

## Verdicts

| Judge   | Perspective  | Round 1 | Round 2 | Changed? |
| ------- | ------------ | ------- | ------- | -------- |
| Judge 1 | correctness  | WARN    | WARN    | No       |
| Judge 2 | risk         | WARN    | WARN    | No       |
| Judge 3 | completeness | WARN    | WARN    | No       |

Unanimous, HIGH confidence, both rounds. No judge argued PASS or FAIL.

## Verdict Shifts (R1 → R2)

None. The debate sharpened findings rather than moving verdicts — and it corrected one judge's factual error (see _Debate Notes_).

---

## The Single Most Consequential Finding

**The Effect boundary — the rule the entire adoption exists to protect — is enforced by exactly one regex, and that regex has a demonstrated live hole.**

- `scripts/architecture-check.ts:42` — `const EFFECT_SPECIFIER = /^effect(?:\/|$)/;`, applied at `:78` to `packages/`, `apps/renderer/`, `preload.ts`.
- It matches `effect`, `effect/http`, `effect/Option` — and **nothing else**. `@effect/vitest`, `@effect/schema`, `@effect/language-service` all return `false`.
- **Lead-verified, and it refutes explorer E5's premise:** `effect` _is_ resolvable from `apps/renderer` and `packages/shared` via the root symlink `node_modules/effect -> node_modules/.pnpm/effect@4.0.4/…` (`node_modules/.modules.yaml:1762` records a populated `hoistPattern`; no `.npmrc`; no `node-linker`). A probe file `apps/renderer/src/__council_probe.ts` containing `import { Effect } from "effect"; export const probe: Effect.Effect<number> = Effect.succeed(1);` runs `npx tsc-rs --noEmit -p apps/renderer/tsconfig.json` with **exit 0 and zero diagnostics**.

So the "isolated linker masks the gap" safety net never existed. `arch-check` is the **only** barrier — for bare `effect` as much as for `@effect/*` — and it is silent for the entire scoped family. `scripts/architecture-check.test.ts` has four fixtures, every one of them using the bare `effect` specifier, so nothing defends the hole either.

The stakes are documented in the repo's own words at `scripts/architecture-check.ts:73-77`: Effect values do not survive `contextBridge`, so a wrapped Effect crosses as a bare `{}` or throws `DataCloneError`. A `@effect/*` package declared in the wrong workspace today passes `arch-check`, all four typechecks, and `knip` — and ships.

Meanwhile `AGENTS.md:290-291` claims `arch-check` "rejects any `effect*` specifier under `packages/`, `apps/renderer/` and `preload/`" — the code enforces strictly less than the doc promises, so the doc's own spec is unmet.

**Fix (one character, plus one fixture):**

```ts
const EFFECT_SPECIFIER = /^@?effect(?:\/|$)/;
```

plus an `@effect/*` fixture in `scripts/architecture-check.test.ts`, and correcting `AGENTS.md:290-291`. Optionally back it at the manifest level by asserting no `effect`/`@effect/*` entry is declared by `apps/renderer` or `packages/shared`.

---

## Severity-Weighted Findings

| Severity    | Finding                                                                                                                                                                                                                                                                                                                                                                                               | Owner                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| significant | Effect boundary guarded by one regex that covers only the bare package; the isolated-linker mask never existed, so `arch-check` is the only barrier for bare `effect` too                                                                                                                                                                                                                             | all 3                          |
| significant | `README.md:47` documents `pnpm typecheck` as running "`tsc --noEmit` per workspace (TypeScript 7 native)". The compiler is `tsc-rs`. The command table of the most-read doc names the exact compiler whose substitution silently disables every Effect gate                                                                                                                                           | J2 (R1) → adopted by all in R2 |
| significant | `cryptoRandomUuid: "error"` (`tsconfig.base.json:57`) is misaimed: the engine routes in-Effect usage to `cryptoRandomUuidInEffect`, which is omitted and defaults to non-error. Verified: `crypto.randomUuid()` at module scope → `TS377078`; the same call inside `Effect.sync(() => …)` → **no diagnostic**. The configured rule guards an empty set (zero `crypto.randomUuid()` calls in the tree) | J1, corroborated J3            |
| significant | 13 of upstream's 24 error-severity rules are absent or weakened, and 13 of the 19 configured keys are unguarded by any test. Downgrading `preferSchemaOverJson` — the highest-yield rule, triggered on a 3-line file — leaves every gate green                                                                                                                                                        | J3                             |
| significant | The comment justifying the six `off` rules (`tsconfig.base.json:58-62`) is factually wrong twice: it claims the rules "only bite inside Effect code" (they fire on plain imperative code — verified `TS377064`/`TS377066`/`TS377057`), and it claims "main.ts must stay dependency-free" (main.ts imports electron, electron-store, electron-updater, @ado/shared, node:path)                         | J3                             |
| significant | The `@effect/*` import boundary and the React rule share one structural gap: `inMainProcess` at `architecture-check.ts:55` excludes `apps/desktop/src/native.ts`, so a React import in that file passes `arch-check` with exit 0                                                                                                                                                                      | J1 (R2)                        |
| moderate    | Restoring upstream parity is priced and cheap: adding only the seven `*InEffect` keys costs **exactly one** diagnostic — `native.ts:77` `TS377073` (the `setTimeout` inside `Effect.callback`). Base-global rules need not be enabled. Nine of the thirteen divergent rules cost **nothing** (`Date.now`, `fetch`, `Math.random`, `crypto.randomUuid` have zero occurrences in the tree)              | J3 (R2)                        |
| moderate    | Editor/LSP does not see the load-bearing gate: `allowedUnstableApis`, `allowedExperimentalApis` and codes 377135/377136 are in the tsc-rs binary but **entirely absent** from `@effect/language-service@0.87.4`. No `js/ts.tsdk.path` documented                                                                                                                                                      | J1, J2                         |
| moderate    | Two machine test files guard a closed list of workspaces (`scripts/toolchain.test.ts:28-32`) while `pnpm-workspace.yaml` globs `apps/*`/`packages/*` discover any number. A fourth workspace that forgets `extends tsconfig.base.json` loses every Effect gate silently                                                                                                                               | J2                             |
| moderate    | The upstream `overrides` block exempting `**/*.test.ts` from `preferSchemaOverJson` is absent; the rule errors on `JSON.parse` inside a test (`TS377026`)                                                                                                                                                                                                                                             | J1, J3                         |
| moderate    | `scripts/` is typechecked only by the pre-push `typecheck:all` task, never by `pnpm typecheck` — so the two files that _guard the Effect setup_ are unguarded locally. `AGENTS.md:238-240`'s "all checks pass" list omits `vp run typecheck:all`                                                                                                                                                      | J1, J2, J3                     |
| moderate    | The tracked council research doc (`.agents/council/2026-10-13-research-adopt-effect-4.md:150-157`) still recommends `@effect/tsgo@0.51.1` by name ("adoption is void without it") and forbids `@effect/vitest`. Both are superseded by the shipped route                                                                                                                                              | J2, J3                         |
| moderate    | `AGENTS.md:292-294` overstates twice: only `probeDbus` ends in a `runPromise` (the 7 other `ipcMain.handle` handlers are plain async), and the structuredClone contract is asserted for four hand-picked cases, not "every" return type                                                                                                                                                               | J3                             |
| minor       | `README.md:94-95`'s arch-check failure list omits the Effect rule entirely — the two top-level docs disagree                                                                                                                                                                                                                                                                                          | J2, J3                         |
| minor       | `tsc-rs` is a root-only devDep resolved via `PATH`; no test asserts the declaration, so a root cleanup fails four typechecks rather than a test                                                                                                                                                                                                                                                       | J1, J2                         |
| minor       | `allowedUnstableApis` is module-wide for `@effect/vitest` rather than export-scoped; contained by the exact 4.0.4 pin plus the vitest-instance-identity test                                                                                                                                                                                                                                          | J2                             |
| minor       | `namespaceImportPackages` omits `@effect/platform-node` (inert — no such dep), leaving a trap if platform-node is ever adopted                                                                                                                                                                                                                                                                        | J3                             |

---

## What Is Genuinely Correct (not a paper config)

Verified by the lead independently of the judges:

| Claim                                         | Evidence                                                                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The stability gate really fires               | `TS377136` error on `effect/http/HttpServerRequest#fromWeb` under `tsc-rs`; the allowlist itself is honoured (`allowedUnstableApis: ["@effect/vitest"]`)                                         |
| The compiler is the one that enforces         | `tsc-rs --showConfig` resolves the plugin in all five tsconfigs; plain `tsc` 7.0.2 reports `plugins: undefined` for all five                                                                     |
| The guard tests are real gates                | Deleting/weakening `Effect.acquireRelease` reds 3 native tests; a caret pin reds 2 `effect-resolution` tests; disabling the arch-check Effect rule reds 3 tests; emptying the allowlist reds 8   |
| The Iconversus-upstream axis is stricter      | `unstableApiUsage`/`experimentalApiUsage` are `error` vs upstream `off`; `allowedUnstableApis` has exactly one audited entry                                                                     |
| The config cannot silently typo               | An invalid `diagnosticSeverity` key emits `warning TS377134` (typo `allowedUnstableApi` → 8× `TS377136`), so the map is fail-safe                                                                |
| The risk model is wrong in the safe direction | `floatingEffect` fires as `error TS377001` **completely unconfigured**                                                                                                                           |
| Pnpm dependency placement is correct          | `effect` is a runtime dep of `apps/desktop` only; `@effect/vitest` a dev dep of the same; `@effect/language-service` a root devDep. `apps/renderer` and `packages/shared` declare nothing Effect |

---

## Debate Notes

**Key Exchanges**

- **Judge 3 → Judge 1 (factual correction, upheld):** Judge 1's R1 justified the base `off` values by claiming `native.ts:77` "legitimately calls `setTimeout` inside an `Effect.callback`". Judge 3 ran the verbatim shape and this is **false** — the base `globalTimers` rule does not fire on `Effect.callback` bodies at all (only `console.warn` fired, `TS377064`). What covers `native.ts:77` is `globalTimersInEffect` (`TS377073`). The lead independently reproduced this: adding the `*InEffect` keys as `error` yields exactly `apps/desktop/src/native.ts(77,25): error TS377073` and nothing else. **Consequence:** the remediation both Judge 1 and Judge 2 recommended ("add the `*InEffect` keys while keeping the base keys `off`") is a breaking change to the only Effect source file in the repo, and neither priced it in R1.
- **Lead → all judges (premise refutation, absorbed):** The packet and explorer E5 asserted `require.resolve('effect')` fails from renderer/shared under an isolated linker. The lead disproved it (root symlink resolves; `hoistPattern` populated; bare `effect` import in the renderer typechecks with exit 0). Both Judge 1 and Judge 3 had already flagged this in R1; Judge 2 accepted and revised its framing so the boundary finding is no longer "future-conditional" but a **live silent-pass**.
- **Judge 2 → all judges (severity elevation, upheld):** `README.md:47` — the command table row for `pnpm typecheck` naming `tsc` instead of `tsc-rs` — was found by Judge 2 alone. In R2 all three agreed it is categorically the worst single doc defect, cheaper to fix (one word) than anything else in the report, and it names the exact silent failure `scripts/toolchain.test.ts:4-6` was written to prevent.

**Steel-Man Highlights**

- Judge 1's devil's advocate: the setup is _stronger_ than the rule map implies — `floatingEffect` is on by default as an error, an invalid rule key warns (`TS377134`) rather than passing, and 6 of 19 keys are actively guarded by tests that demonstrably go red. The 13 omitted rules police constructs with _zero_ occurrences in the tree.
- Judge 3's devil's advocate, which converted the rule gap into an action: upstream parity is a **priced** change — five diagnostics in three files for full base-parity, **one** diagnostic (`native.ts:77`) for the `*InEffect` subset. Nine of thirteen divergent rules cost nothing.
- Judge 2's blind spot, which is the real risk in an agent-developed repo: the code is red where it matters, but _the docs an agent reads first_ (`README.md:47`) name the wrong compiler, and the "guard suite can be hollowed without notice" because 13 of 19 keys are unpinned.

**Convergence Detected:** No — R1 was already unanimous, so no anchoring risk arises from a shift. What R2 produced was a _precision_ gain (priced fixes) and one upheld factual correction between judges.

---

## Recommendation

**WARN — configured and genuinely enforced, but do not merge without the boundary fix.**

In priority order, cheapest and highest-value first:

1. **`README.md:47`: one word.** Change the row to `` `tsc-rs --noEmit` per workspace (TypeScript 7 native, Rust port) ``. This is the single highest-value edit in the review — it removes the only doc that invites the substitution which silently disables every Effect gate.
2. **Widen `EFFECT_SPECIFIER` to `/^@?effect(?:\/|$)/`** at `scripts/architecture-check.ts:42`, add an `@effect/*` fixture to `scripts/architecture-check.test.ts`, and correct `AGENTS.md:290-291` to match. This closes the only live silent-pass in a machine gate.
3. **Pin the whole plugin block in `scripts/effect-resolution.test.ts:106-118`** as a frozen expected object (rule map, both allowlists, `namespaceImportPackages`). Today downgrading `preferSchemaOverJson` to `off` ships green.
4. **Price and record the rule-map decision.** Adding the seven `*InEffect` keys as `error` costs exactly one diagnostic — `native.ts:77`'s `setTimeout` inside `Effect.callback` — fixable with `Effect.sleep`/`Schedule` or a scoped `@effect-diagnostics` suppression carrying a comment that says why the timer must stay real. Then rewrite the factually wrong comment at `tsconfig.base.json:58-62`, which currently misstates both which rules cover which code and that `main.ts` is dependency-free.
5. **Either fix or stop implying the misaimed rule:** add `cryptoRandomUuidInEffect: "error"`, or delete `cryptoRandomUuid: "error"` at `:57` so the config stops asserting a guard over an empty set.
6. **Correct `AGENTS.md:292-294`** — one `runPromise` at `native.ts:112`, and four asserted structuredClone cases rather than "every" return type — and add `vp run typecheck:all` to the `:238-240` checklist.
7. **Mark the research doc superseded** where it names `@effect/tsgo@0.51.1` by name and forbids `@effect/vitest`.

Do **not** "fix" the repo toward t3code: the missing `@effect/tsgo` + `effect-tsgo patch` is the older mechanism, correctly superseded by `tsc-rs@0.6.0`'s built-in port. Adding them would run two implementations of the same diagnostic set — which `@effect/tsgo`'s own README warns against.

---

## Refuted Claims (so they are not re-litigated)

1. **"The isolated pnpm linker masks the arch-check gap."** False. `effect` resolves from renderer and shared through the root symlink, and a bare `effect` import in the renderer typechecks clean (exit 0).
2. **"`globalTimers: 'off'` is what makes `native.ts:77` legal."** False (Judge 3, upheld). The base rule does not cover `Effect.callback` bodies; `globalTimersInEffect` does.
3. **"`main.ts` must stay dependency-free" (as a reason for the six `off` rules).** False. `main.ts:1-14` imports electron, electron-store, electron-updater, `@ado/shared` and `node:path`.
4. **"`@effect/tsgo` + `effect-tsgo patch` are missing."** Obsolete, not missing — tsc-rs 0.6.0 has the 377xxx codes built in.
5. **"The plain `tsc` ignores the plugins array only imprecisely."** Correct as written in `scripts/toolchain.test.ts:5` — `tsc` 7.0.2 reports `plugins: undefined` for all five configs.

---

_Completed 2026-10-13. 5 explorers + 3 judges × 2 rounds; all load-bearing claims independently re-verified by the lead against the working tree, including a mutation sweep of the Effect config and a live `arch-check` boundary probe (reverted; tree byte-identical to HEAD except this report set)._
