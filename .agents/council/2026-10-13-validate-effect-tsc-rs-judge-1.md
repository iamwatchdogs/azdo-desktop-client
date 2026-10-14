```json
{
  "judge": "judge-1",
  "verdict": "WARN",
  "confidence": "HIGH",
  "key_insight": "The setup is genuinely wired end-to-end and genuinely enforced - I proved all four load-bearing rules actually fire (TS377136 unstable, TS377135 experimental, TS377026 preferSchemaOverJson, and the @effect/vitest allowlist itself). It is NOT a paper config. The verdict is WARN because three claims are false in the repo's own words: (1) `cryptoRandomUuid: error` is misaimed and polices only non-Effect code, so the in-Effect surface it exists for is unguarded; (2) AGENTS.md:290-291 says arch-check rejects any `effect*` specifier, but `@effect/*` imports pass it with exit 0 - and the 'isolated linker' safety net E5 counted on does not exist, so arch-check is the ONLY barrier for bare `effect` too; (3) the whole `*InEffect` rule family is omitted, leaving Date/console/timers/fetch/random unguarded inside the exact code Effect is meant to police.",
  "findings": [
    {
      "severity": "significant",
      "description": "`cryptoRandomUuid: \"error\"` at tsconfig.base.json:57 is misaimed: the rule engine routes in-Effect usage to a separate key, `cryptoRandomUuidInEffect`, which is OMITTED from the config and therefore defaults to non-error. Empirically verified: `crypto.randomUuid()` at module scope yields `error TS377078 ... effect(cryptoRandomUuid)`, while the identical call inside `Effect.sync(() => crypto.randomUuid())` yields NO diagnostic. Adding `cryptoRandomUuidInEffect: \"error\"` produces `error TS377079 ... effect(cryptoRandomUuidInEffect)`. The rule therefore guards exactly the code that does not exist (there are zero `crypto.randomUuid()` calls anywhere in `apps/`, `packages/`, `scripts/` outside council probes) and does not guard the code that does. It is currently dead configuration that reads as live.",
      "fix": "Either add `\"cryptoRandomUuidInEffect\": \"error\"` to diagnosticSeverity (and audit the same asymmetry across the whole map), or delete `cryptoRandomUuid: \"error\"` so the config stops implying a guard it does not provide.",
      "why": "A rule that silently does not fire inside Effect code is worse than no rule: an agent reading the config concludes uuid generation is default-denied, writes `Effect.sync(() => crypto.randomUuid())`, and the gate is green. The t3code baseline the repo is trying to match sets both `cryptoRandomUuid` and `cryptoRandomUuidInEffect` to `error`.",
      "ref": "tsconfig.base.json:57"
    },
    {
      "severity": "significant",
      "description": "The Effect import boundary is enforced only for the bare package, and the documented claim over-reaches. `EFFECT_SPECIFIER = /^effect(?:\\/|$)/` (scripts/architecture-check.ts:42, applied at :78) matches `effect`, `effect/http`, `effect/Option` - but nothing else. Verified regex: `@effect/vitest => false`, `@effect/schema => false`, `@effect/language-service => false`, `effectful => false`. Verified end-to-end: writing `import { Schema } from \"@effect/language-service/schema\"` into `packages/shared/src/__j1boundary.ts` and running `vp run arch-check` printed `architecture-check: ok (38 files)` with exit 0; the control - the same fixture with `import { Effect } from \"effect\"` - printed `architecture-check: 1 violation(s)`. Meanwhile AGENTS.md:290-291 states arch-check \"rejects any `effect*` specifier under `packages/`, `apps/renderer/` and `preload/`\".",
      "fix": "Widen the guard to the whole Effect namespace in the forbidden zones, e.g. add `const EFFECT_FAMILY = /^(?:effect|@effect\\/)/;` and test `EFFECT_SPECIFIER.test(spec) || EFFECT_FAMILY.test(spec)`, or better, assert at the dependency level that no `effect`/`@effect/*` package is declared by `apps/renderer` or `packages/shared` in the manifest. Add a `@effect/*` fixture to scripts/architecture-check.test.ts (all 4 current fixtures use the bare specifier).",
      "why": "The bridge is the one boundary whose failure destroys data silently: `structuredClone` strips the prototype getters and symbol keys behind an Effect, so a bridged Effect crosses as a bare `{}` and throws `DataCloneError`. A `@effect/*` package added to the wrong workspace today passes arch-check, passes all four typechecks, passes knip, and ships.",
      "ref": "scripts/architecture-check.ts:42,78; AGENTS.md:290-291"
    },
    {
      "severity": "moderate",
      "description": "The `*InEffect` rule family is omitted entirely, so Effect code is unguarded for every global-I/O surface where upstream sets `error`. Upstream's map has 30 keys; this repo's has 19. Omitted upstream-`error` keys (7): `schemaSyncInEffect`, `cryptoRandomUuidInEffect`, `globalDateInEffect`, `globalConsoleInEffect`, `globalRandomInEffect`, `globalTimersInEffect`, `globalFetchInEffect`. Verified empirically with the repo's exact map: inside `Effect.sync`, `Date.now()`, `console.log`, `setTimeout`, `fetch`, `Math.random()` and `require(\"node:fs\")` produce ZERO diagnostics, while `globalDateInEffect: \"error\"` alone produces `TS377067` and `globalConsoleInEffect: \"error\"` produces `TS377065`. Note the non-Effect half IS justified by real usage - `apps/desktop/src/native.ts:77` legitimately calls `setTimeout` inside an `Effect.callback` - so the `off` values at tsconfig.base.json:63-68 are a deliberate, defensible call. The gap is specifically the missing in-Effect counterparts.",
      "fix": "Add the `*InEffect` keys set to `error` alongside the existing `off` values. That keeps `main.ts` and `native.ts`'s callback plumbing legal while making genuinely impure code inside `Effect.gen`/`Effect.sync` fail. Keep the base rules `off`.",
      "why": "This is the largest single divergence from the t3code baseline and it lands on exactly the surface the Effect rules exist to police. It is also invisible in the current repo because the only Effect source file happens not to trip it.",
      "ref": "tsconfig.base.json:63-68"
    },
    {
      "severity": "moderate",
      "description": "The `isolated linker` safety net that E5 counted on does not exist, which makes the arch-check gap far more exposed than the explorers assessed. E5 states `require.resolve('effect')` fails from `apps/renderer` and `packages/shared` under the isolated linker. It does not. Verified with a valid negative control: a `require.resolve('totally-not-installed-xyz')` from `apps/renderer` correctly FAILS, while `require.resolve('effect/package.json')` from `apps/renderer`, `packages/shared` and the repo root all SUCCEED, resolving through the root symlink `node_modules/effect -> node_modules/.pnpm/effect@4.0.4/node_modules/effect`. Root `package.json` does not declare `effect` (only `@effect/language-service`, which has no peerDependencies), and `node_modules/.modules.yaml` records `hoistPattern: [\"*\"]`. The TypeScript consequence is decisive: a probe file `packages/shared/src/__probe_effect.ts` containing `import { Effect } from \"effect\"; export const probe: Effect.Effect<number> = Effect.succeed(1);` typechecks with ZERO errors under `tsc-rs -p packages/shared/tsconfig.json` (exit 0).",
      "fix": "Stop treating resolution as a barrier. Encode the boundary where it is actually enforced: widen the arch-check regex (finding 2) and/or add a manifest assertion that `apps/renderer/package.json` and `packages/shared/package.json` declare no `effect`/`@effect/*` entry, alongside the existing effect-resolution.test.ts dependency audit.",
      "why": "E5's risk model said the gap is \"masked by three other gates\" that only \"evaporate the moment a dependency is declared\". One of the three masks was never real. The only remaining barrier for a bare `effect` import into `packages/shared` or the renderer is arch-check - and arch-check is the thing with the regex hole.",
      "ref": "pnpm-workspace.yaml:1-3; scripts/architecture-check.ts:42"
    },
    {
      "severity": "moderate",
      "description": "The missing upstream `overrides` block has a live consequence: `preferSchemaOverJson` errors inside `.test.ts`. Upstream exempts `**/*.test.ts`, `**/*.test.tsx` from that rule; this repo has no overrides block at all. Verified: `apps/desktop/test/__j1test.ts` calling `JSON.parse` inside an `Effect.sync` produced `error TS377026 ... effect(preferSchemaOverJson)` under `tsc-rs -p apps/desktop/tsconfig.json`. So any test that JSON-parses fails the typecheck, which is a divergence from upstream that this repo did not choose.",
      "fix": "Add the upstream override block: `\"overrides\": [{ \"include\": [\"**/*.test.ts\", \"**/*.test.tsx\"], \"options\": { \"diagnosticSeverity\": { \"preferSchemaOverJson\": \"off\" } } }]`.",
      "why": "Tests legitimately build fixtures from JSON strings. The rule's cost/benefit inverts in test code, and the repo inherits the strict half without the exemption. No test trips it today, so it is a latent, not active, failure.",
      "ref": "tsconfig.base.json:47-77"
    },
    {
      "severity": "moderate",
      "description": "The editor plugin and the gate are two independent rule engines that can silently disagree, and nothing verifies they agree. `@effect/language-service@0.87.4` is the editor-side language service; `tsc-rs@0.6.0` (tscVersion 7.1.0-dev) is the gate. I verified the JS bundle genuinely lacks the load-bearing keys: a recursive scan of every `.js` under `node_modules/@effect/language-service/` reports `unstableApiUsage` ABSENT, `experimentalApiUsage` ABSENT, `allowedUnstableApis` ABSENT, `allowedExperimentalApis` ABSENT, `377135` ABSENT, `377136` ABSENT, while `namespaceImportPackages`, `allowedDuplicatedPackages` and `allowedFloatingEffects` are PRESENT. So the stability gate is enforced entirely by the compiler's built-in port of tsgo 0.51.1 (node_modules/tsc-rs/README.md:31-38), and `@effect/language-service` is dead weight inside the gate despite being pinned at pnpm-workspace.yaml:51 and asserted by scripts/effect-resolution.test.ts:96-104. A version bump of one without the other produces no failure signal.",
      "fix": "Add an assertion that the two are version-coupled, or drop the pretence: either pin `@effect/language-service` to the same upstream revision tsc-rs ports from and say so in a comment, or state explicitly that it exists solely for editor UX and that the gate never loads it.",
      "why": "This is precisely the class of problem the t3code `effect-tsgo patch` mechanism existed to eliminate: two mechanisms, one authoritative, no check that they match. The repo avoided the patch but kept the split.",
      "ref": "pnpm-workspace.yaml:51; tsconfig.base.json:40; scripts/effect-resolution.test.ts:96-104"
    },
    {
      "severity": "moderate",
      "description": "Gate coverage for `scripts/` is asymmetric in a way that leaves the guarders unguarded. `pnpm typecheck` (package.json:17) is `vp run -r typecheck`, which runs only the three workspace scripts; `scripts/` is not a workspace package (pnpm-workspace.yaml:1-3 globs only `apps/*` and `packages/*`). `scripts/` is typechecked solely by the `typecheck:all` task (vite.config.ts:240-243) inside `push-gate` (vite.config.ts:351). So `scripts/toolchain.test.ts` and `scripts/effect-resolution.test.ts` - the two files that guard the Effect/tsc-rs setup - can be broken locally, pass pre-commit, and fail only at push. Verified by reading vite.config.ts:351: `dependsOn: [\"complexity\", \"typecheck:all\", \"arch-check\", \"knip\", \"secrets\", \"tests:all\"]`.",
      "fix": "Either make `scripts/` a real workspace package so `vp run -r typecheck` covers it, or extend the root `typecheck` script to `vp run -r typecheck && tsc-rs -p scripts/tsconfig.json` so the local loop matches the push gate.",
      "why": "The repo's own comment at vite.config.ts:329-332 makes exactly this argument about the root workspace running unconditionally - \"a change to the gate's own logic must not disable the tests checking it\" - but the same reasoning is not applied to the scripts typecheck.",
      "ref": "vite.config.ts:241,351; package.json:17; pnpm-workspace.yaml:1-3"
    },
    {
      "severity": "minor",
      "description": "Nothing asserts that `tsc-rs` is a declared dependency, even though all four typechecks are single-word shell invocations that resolve it from PATH. `tsc-rs` is a root-only devDep (package.json:28, catalog pnpm-workspace.yaml:90); `apps/desktop/package.json:12`, `apps/renderer/package.json:10` and `packages/shared/package.json:11` each say `\"typecheck\": \"tsc-rs --noEmit\"` with no declared dependency of their own. I confirmed resolution works from every workspace today (`require.resolve('tsc-rs')` OK from `.`, `apps/renderer`, `packages/shared`, `apps/desktop`), but knip's `--include files,dependencies,unlisted,unresolved,exports` does not check binaries, so a root devDep cleanup would break all four typechecks with no assertion catching the cause. The `allowBuilds: tsc-rs: true` entry (pnpm-workspace.yaml:14-15) is a related single point of failure: the platform binary is fetched by postinstall, so `--ignore-scripts` or an offline install leaves `tsc-rs` non-executable.",
      "fix": "Extend scripts/toolchain.test.ts to also assert `tsc-rs` appears in the root `devDependencies` and in the catalog block, so a cleanup fails a test rather than four typechecks.",
      "why": "The guard is textual over the task graph; the thing it guards depends on an undeclared resolution path. Cheap to close.",
      "ref": "apps/desktop/package.json:12; apps/renderer/package.json:10; packages/shared/package.json:11; pnpm-workspace.yaml:14-15,90"
    },
    {
      "severity": "minor",
      "description": "`namespaceImportPackages` narrows upstream's `[\"@effect/platform-node\", \"effect\"]` to `[\"effect\"]`. Verified inert today: `rg '@effect/platform-node'` across the repo (excluding pnpm-lock.yaml) matches only a comment in scripts/effect-resolution.test.ts:20, and the only `@effect/*` packages in the tree are `@effect/language-service` (root) and `@effect/vitest` (apps/desktop).",
      "fix": "No change needed while the dependency set stays at `effect` + `@effect/vitest`. If `@effect/platform-*` is ever adopted, revisit this key rather than assuming it still covers the repo.",
      "why": "The narrowing is currently safe by coincidence of the dependency set, not by design. Recording that makes the next dependency addition a decision rather than an accident.",
      "ref": "tsconfig.base.json:41; scripts/effect-resolution.test.ts:20"
    },
    {
      "severity": "minor",
      "description": "Documentation drift in the arch-check failure list: README.md:94-95 enumerates \"packages→apps imports, renderer→electron imports, and React in process code\" and omits the Effect rule entirely, while scripts/architecture-check.ts:78-82 enforces it. AGENTS.md:299's cross-reference to \"Strict TypeScript below\" resolves to the bullet at AGENTS.md:301, not a heading - technically correct but easy to break.",
      "fix": "Add the Effect rule to README.md:94-95's list, and reword AGENTS.md:290-291 to \"rejects any `effect` or `@effect/*` specifier\" once the regex is widened (finding 2).",
      "why": "The README list is the discoverable summary of what the boundary guard actually blocks. A missing entry means the one rule protecting the bridge from structuredClone data loss is the least documented.",
      "ref": "README.md:94-95; AGENTS.md:290-291,299"
    }
  ],
  "recommendation": "Merge nothing yet; this is a WARN, not a FAIL, and the setup is far more real than a paper config would be. Order of work: (1) fix finding 1 by adding `cryptoRandomUuidInEffect: \"error\"` and then auditing every paired `X` / `XInEffect` key in the map for the same inversion; (2) fix finding 3 by adding the six `*InEffect` global keys as `error` while deliberately leaving their base keys `off` - `apps/desktop/src/native.ts:77` proves the `off` half is a real, needed decision, not an oversight; (3) fix finding 2 by widening the arch-check regex to `@effect/*` and adding a `@effect/*` fixture, then correct AGENTS.md:290-291 and README.md:94-95 to match what the code does; (4) add the upstream test-file override (finding 5) - it is a four-line change that removes a latent failure; (5) close findings 7 and 8, which are both one assertion each. Treat finding 4 as a correction to the risk model, not a code change: `effect` resolves fine from `apps/renderer` and `packages/shared`, so arch-check is the only barrier there and it has the hole. Do not add `@effect/tsgo` / `effect-tsgo patch` - E4 is right that it patches the `typescript` package this repo does not use, and tsc-rs 0.6.0 (tscVersion 7.1.0-dev) carries the 377xxx codes natively, which I confirmed by firing TS377135 and TS377136 from the repo's own config.",
  "explorer_adjudication": [
    {
      "explorer": "E1",
      "status": "CONFIRM",
      "rationale": "Every load-bearing claim verified independently. All three workspace scripts are literally `\"typecheck\": \"tsc-rs --noEmit\"` (apps/desktop/package.json:12, apps/renderer/package.json:10, packages/shared/package.json:11) and vite.config.ts:241 adds `\"tsc-rs -p scripts/tsconfig.json\"` in the `typecheck:all` task; a repo-wide rg for a bare `tsc ` invocation in package.json / vite.config.ts returns only the `tsc-rs` matches. I ran all four tsc-rs typechecks directly - apps/desktop, apps/renderer, packages/shared and scripts all exit 0 - and root `pnpm typecheck` fans out to the same three workspaces with `tsc-rs --noEmit`. Its own caveats are accurate: `scripts/` is covered only by the push gate (vite.config.ts:351), and nothing asserts `tsc-rs` is a declared dependency (I promoted that caveat to finding 8). The guard is not a taxidermy test - scripts/toolchain.test.ts, effect-resolution.test.ts and architecture-check.test.ts total 16 tests, all passing, and I verified the individual behaviours they assert rather than taking the green as evidence."
    },
    {
      "explorer": "E2",
      "status": "CONFIRM",
      "rationale": "The headline and the critical mechanism are right, and my probes make them stronger than the explorer stated. All five tsconfigs resolve `plugins:[{\"name\":\"@effect/language-service\"}]` via `tsc-rs -p <cfg> --showConfig`; none declares or shadows `plugins`; all extend tsconfig.base.json directly. `--showConfig` collapsing the entry to `{name}` only is standard TypeScript normalization, NOT evidence the options are dropped - and E2's inference that the options still apply is correct, proven three ways: `unstableApiUsage` fired TS377136, `experimentalApiUsage` fired TS377135, `preferSchemaOverJson` fired TS377026, and removing `allowedUnstableApis` from a scratch copy made the repo's own `@effect/vitest` test files fail. Its claim that the stability gate lives in the compiler rather than the JS plugin is confirmed by a recursive scan of every `.js` in `node_modules/@effect/language-service/`: `unstableApiUsage`, `experimentalApiUsage`, `allowedUnstableApis`, `allowedExperimentalApis`, `377135`, `377136` all ABSENT. TWO CORRECTIONS, both immaterial to the conclusion: (a) `namespaceImportPackages` is PRESENT in the JS bundle, not absent as stated; (b) the claim that \"moving the block into a workspace tsconfig would break resolution\" is unsupported - I declared the plugin inline in an untracked config at `apps/desktop/__j1probe/tsconfig-ws.json` and TS377136 still fired, because tsc-rs reads the `plugins` array as configuration and never needs to load the JS module."
    },
    {
      "explorer": "E3",
      "status": "CONFIRM",
      "rationale": "The arithmetic and both empirical claims check out. I counted the diagnosticSeverity map at tsconfig.base.json:47-77: exactly 19 keys against upstream's 30. The seven `off`-vs-`error` weakenings, the seven omitted upstream-`error` keys, the two strengthenings (`unstableApiUsage`/`experimentalApiUsage` at `error` vs upstream `off`), the two added options and the missing `overrides` block are all as described. Its two empirical claims reproduce exactly: `preferSchemaOverJson` fires TS377026, and it fires as an ERROR inside a `.test.ts` file (I put a JSON.parse inside an `Effect.sync` in `apps/desktop/test/__j1test.ts` and got `error TS377026`) which upstream would have exempted. I went one step further and established the DEFAULT severity of the omitted keys, which the explorer left open: with the repo's map, in-Effect `Date.now()`/`console.log`/`setTimeout`/`fetch`/`Math.random()`/`require(\"node:fs\")` all produce zero diagnostics, whereas adding `globalDateInEffect: \"error\"` produces TS377067 and `globalConsoleInEffect: \"error\"` produces TS377065 - so omission genuinely means unguarded, not default-deny. I promoted this to finding 3 with the important qualifier E3 missed: the base `off` values are justified by real usage at apps/desktop/src/native.ts:77."
    },
    {
      "explorer": "E4",
      "status": "CONFIRM",
      "rationale": "The conclusion is right and the reasoning is sound. `rg 'effect-tsgo|@effect/tsgo'` across the repo (excluding node_modules and pnpm-lock.yaml) returns nothing; the only matches in the tree are in `.agents/council/2026-10-13-research-adopt-effect-4.md` and the council packet itself, so the explorer's \"only in the stale council research doc\" claim holds. `npx tsc-rs --version` reports `7.1.0-dev` against the `0.6.0` pin at pnpm-workspace.yaml:90, newer than upstream's 0.4.0. node_modules/tsc-rs/README.md:20-44 states verbatim that tsc-rs has the Effect diagnostics (377xxx) built in and needs no second compiler, and that the rules are a port of Effect-TS/tsgo 0.51.1 - which is exactly why patching plain `typescript` is redundant here. I reproduced the core empirical claim independently: `HttpServerRequest.fromWeb` from `effect/http` yields `error TS377136 ... is an unstable API` under tsc-rs. I also verified the other half of the stability pair that the explorer did not test: `effect/net/Dns` yields `error TS377135 ... is an experimental API`, confirming `experimentalApiUsage: \"error\"` is live and that AGENTS.md:299's claim is true."
    },
    {
      "explorer": "E5",
      "status": "CONFIRM",
      "rationale": "The headline finding is correct, reproduces exactly, and I escalated it: `EFFECT_SPECIFIER` at scripts/architecture-check.ts:42 returns false for `@effect/vitest`, `@effect/schema`, `@effect/language-service`, `effectful` and `my-effect` while returning true for `effect`, `effect/http` and `effect/Option`. Writing an `import { Schema } from \"@effect/language-service/schema\"` fixture into `packages/shared/src/` and running `vp run arch-check` produced `architecture-check: ok (38 files)` and exit 0, while the bare-`effect` control produced `1 violation(s)`. AGENTS.md:290-291's \"rejects any `effect*` specifier\" over-reaches, architecture-check.test.ts's four fixtures all use the bare specifier, and README.md:94-95 omits the Effect rule from the documented failure list. ONE SUB-CLAIM REJECTED, and it materially changes the risk: E5's \"all three masks evaporate the moment a dependency is declared\" rests on `require.resolve('effect')` failing from `apps/renderer` and `packages/shared` under the isolated linker. It does not fail. With a valid negative control, `require.resolve('effect/package.json')` succeeds from both, via the root symlink `node_modules/effect -> node_modules/.pnpm/effect@4.0.4/node_modules/effect`; root `package.json` declares no `effect` dep and `node_modules/.modules.yaml` shows `hoistPattern: [\"*\"]`. Decisively, a probe `packages/shared/src/__probe_effect.ts` importing `effect` typechecks with ZERO errors. So one of the three masks never existed, and for bare `effect` the ONLY barrier is arch-check - the component with the hole."
    }
  ]
}
```

# Judge 1 — Technical correctness and end-to-end completeness

## Verdict: WARN (confidence HIGH)

## 1. What I actually ran

| Check                                                                                                       | Result                                                                      |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `npx tsc-rs --noEmit -p apps/desktop/tsconfig.json`                                                         | exit 0                                                                      |
| `npx tsc-rs --noEmit -p apps/renderer/tsconfig.json`                                                        | exit 0                                                                      |
| `npx tsc-rs --noEmit -p packages/shared/tsconfig.json`                                                      | exit 0                                                                      |
| `npx tsc-rs --noEmit -p scripts/tsconfig.json`                                                              | exit 0                                                                      |
| `npx tsc-rs -p <cfg> --showConfig` × 5 configs                                                              | `plugins:[{"name":"@effect/language-service"}]` for all five                |
| root `pnpm typecheck`                                                                                       | fans out to the 3 workspaces, each `tsc-rs --noEmit`                        |
| `vitest run scripts/toolchain.test.ts scripts/effect-resolution.test.ts scripts/architecture-check.test.ts` | 3 files, 16 tests, all pass                                                 |
| `vitest run` in `apps/desktop`                                                                              | 2 files, 9 tests, all pass (including 8 `it.effect`)                        |
| `vp run arch-check`                                                                                         | `architecture-check: ok (37 files)`                                         |
| `vp run knip`                                                                                               | clean except two untracked peer-judge probe files                           |
| `node -e` regex semantics                                                                                   | `effect`⇒true, `effect/http`⇒true, all `@effect/*`⇒false, `effectful`⇒false |
| `npx tsc-rs --version`                                                                                      | `7.1.0-dev` (pin `0.6.0`)                                                   |

Every probe I created was deleted. `git status --porcelain` is clean of my work — the only
untracked paths are the council packet (lead-created) and two in-flight probe files
belonging to Judge 3, which I deliberately did not touch. Note that one of them
(`apps/desktop/src/__j3-jsonparse-probe.ts`) is _currently_ making `pnpm typecheck` fail
with `TS377026`, which is itself incidental proof that the gate is live rather than
decorative.

## 2. The setup is real, not decorative

I want to be unambiguous about this because it is the single most important question the
target asks, and a config that looks right on disk is the easiest thing to rubber-stamp.

`--showConfig` collapses the plugin entry to `{"name":"@effect/language-service"}`. That is
standard TypeScript normalization of the `plugins` array — it is **not** evidence that the
`diagnosticSeverity` map, `allowedUnstableApis` or `namespaceImportPackages` are dropped. I
proved the full block is applied by tsc-rs, four independent ways:

- `HttpServerRequest.fromWeb` from `effect/http` → `error TS377136 ... is an unstable API`
- `Dns` from `effect/net/Dns` → `error TS377135 ... is an experimental API`
- `JSON.parse` inside `Effect.sync` → `error TS377026 ... effect(preferSchemaOverJson)`
- Removing `allowedUnstableApis` from a scratch copy of the exact repo config makes the
  repo's **own** `@effect/vitest` test files fail typecheck — the allowlist is load-bearing,
  not inert. `@effect/vitest` annotates its exports `@stability unstable`
  (`dist/index.d.ts:170` for `effect`, `:261` for `it`), so without it all 9 desktop tests
  would be un-compilable.

The `@effect/tsgo` omission is also correct. `tsc-rs@0.6.0` (tscVersion `7.1.0-dev`) carries
the 377xxx codes natively (`node_modules/tsc-rs/README.md:20-44`, verified verbatim), so
`effect-tsgo patch` would patch the `typescript` package this repo never invokes. E4 is
right and there is nothing to add here.

And the enforcement genuinely bites: AGENTS.md:299's claim that "an unstable or experimental
module import fails `pnpm typecheck`" is **true**, which I verified rather than assumed.

## 3. Why WARN and not PASS

PASS requires "at least equivalent to upstream, no actionable gaps." It is not equivalent to
upstream, and three of the repo's own sentences are false.

**The most interesting finding is finding 1, and it is one no explorer made.** I was
suspicious of the 19-key map because of an asymmetry: the config sets a bunch of paired
rules but always only one side of each pair. `cryptoRandomUuid` has an in-Effect counterpart
`cryptoRandomUuidInEffect`, and the same is true for all six globals. I tested both
directions:

```
crypto.randomUuid() at module scope        → error TS377078 (cryptoRandomUuid)   [fires]
crypto.randomUuid() inside Effect.sync(...) → NO DIAGNOSTIC                    [silent]
+ cryptoRandomUuidInEffect: "error"        → error TS377079 (cryptoRandomUuidInEffect)
```

So `cryptoRandomUuid: "error"` at `tsconfig.base.json:57` polices non-Effect code and is
silent inside Effect code — and there are **zero** `crypto.randomUuid()` calls anywhere in
`apps/`, `packages/`, or `scripts/`. The rule that is supposed to default-deny non-deterministic
UUID generation inside Effect code is, in practice, a guard on an empty set. An agent that
reads the config concludes UUID generation is blocked, writes `Effect.sync(() => crypto.randomUuid())`,
and the gate is green.

This is the exact "errors are values, not conventions" failure the repo's own AGENTS.md:275-277
rails against ("symptom patches: making a consumer tolerate bad data instead of fixing the
producer") — here the producer is the rule map and the consumer is the developer's trust in it.

**Finding 3 follows the same mechanism but in the opposite direction.** The six `off` globals
are, unusually, _justified_: `apps/desktop/src/native.ts:77` legitimately calls `setTimeout`
inside an `Effect.callback`. Upstream would reject that file outright. So the `off` values are
a defensible, deliberate call — I want to be clear I am not recommending flipping them. The
gap is the missing `*InEffect` counterparts, which I proved default to non-error. That means
impure code inside `Effect.gen`/`Effect.sync` is unguarded for Date/console/timers/fetch/random.

**Finding 2 is E5's, confirmed and escalated.** I don't need to re-derive the regex result
here; my fixture test is in the packet. What I add is that the risk model is worse than
assessed. `effect` resolves perfectly well from `apps/renderer` and `packages/shared` through
the root symlink (`node_modules/effect → node_modules/.pnpm/effect@4.0.4/...`, with
`hoistPattern: ["*"]` in `.modules.yaml`), and `tsc-rs` resolves an `effect` import from
`packages/shared` with zero errors. One of E5's three masks never existed, so for bare `effect`
the _only_ barrier is arch-check — the component with the hole.

## 4. Two explorer corrections

Neither changes a verdict, but both should be recorded because both would mislead a future
agent. E2 lists `namespaceImportPackages` as absent from the `@effect/language-service` JS
bundle — it is present. E2 also claims moving the plugin block into a workspace tsconfig would
break resolution — I declared it inline in a workspace config and TS377136 still fired,
because tsc-rs reads the `plugins` array as configuration and never loads the JS module at all.

## 5. What I did not find

No architecture-boundary violations (`packages/` never imports `apps/`, renderer never
imports `electron`, process code never imports React — the React rule at
`architecture-check.ts:64-72` is correct and my probes did not trip it). No debug statements
in the files I read. Effect is declared in exactly one workspace (`apps/desktop`) and the
`effect` catalog pin is exact (`4.0.4`, no caret), with exactly one installed copy. The
`@effect/vitest` + `vite-plus/test` identity that makes the unpatched setup work is asserted
by a real test that actually runs. Nothing is broken.

## 6. Repo state

All of my probes are deleted. `git status --porcelain` shows two untracked paths that are not
mine: `.agents/council/2026-10-13-validate-effect-tsc-rs-packet.md` (created by the lead) and
`apps/desktop/src/__j3-{globals,jsonparse}-probe.ts` (in-flight work by Judge 3, created
~30 minutes into my session and still present at my final check). I left both untouched.
