# Council Packet — Effect 4 + tsc-rs adoption validation

## TARGET

"Has the Effect 4 + tsc-rs setup (the one used upstream in `pingdotgg/t3code`) been configured in this repo?"

Repo: `/Users/shamith/Projects/active/azure-devops-app` — Electron desktop app
(`apps/desktop` = main+preload, `apps/renderer` = React 19 SPA,
`packages/shared` = IPC contracts), pnpm monorepo on vite-plus.

## UPSTREAM BASELINE (verbatim; retrieved 2026-10-13 from

raw.githubusercontent.com/pingdotgg/t3code/main/{package.json,tsconfig.base.json})

t3code root `package.json`:

```
"prepare": "effect-tsgo patch && vp config --no-agent"
"typecheck": "vp run -r --concurrency-limit 2 typecheck"
devDependencies include: "@effect/tsgo": "catalog:", "tsc-rs": "0.4.0",
  "typescript": "catalog:", "vite-plus": "catalog:"
```

t3code `tsconfig.base.json` `compilerOptions.plugins` entry:

```json
[
  {
    "name": "@effect/language-service",
    "namespaceImportPackages": ["@effect/platform-node", "effect"],
    "diagnosticSeverity": {
      "anyUnknownInErrorContext": "error",
      "unsafeEffectTypeAssertion": "error",
      "instanceOfSchema": "error",
      "deterministicKeys": "error",
      "strictEffectProvide": "off",
      "unstableApiUsage": "off",
      "experimentalApiUsage": "off",
      "missingEffectServiceDependency": "error",
      "leakingRequirements": "error",
      "globalErrorInEffectCatch": "error",
      "globalErrorInEffectFailure": "error",
      "unknownInEffectCatch": "error",
      "strictBooleanExpressions": "off",
      "lazyEffect": "off",
      "preferSchemaOverJson": "error",
      "schemaSyncInEffect": "error",
      "cryptoRandomUUID": "error",
      "cryptoRandomUUIDInEffect": "error",
      "nodeBuiltinImport": "error",
      "globalDate": "error",
      "globalDateInEffect": "error",
      "globalConsole": "error",
      "globalConsoleInEffect": "error",
      "globalRandom": "error",
      "globalRandomInEffect": "error",
      "globalTimers": "error",
      "globalTimersInEffect": "error",
      "globalFetch": "error",
      "globalFetchInEffect": "error",
      "schemaNumber": "off"
    },
    "overrides": [
      {
        "include": ["**/*.test.ts", "**/*.test.tsx"],
        "options": { "diagnosticSeverity": { "preferSchemaOverJson": "off" } }
      }
    ]
  }
]
```

Upstream general flags: `strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`, `useDefineForClassFields`,
`verbatimModuleSyntax`, `erasableSyntaxOnly`, `target: ESNext`,
`module/moduleResolution: NodeNext`.

## THIS REPO'S CONFIG (as read by the lead)

- `pnpm-workspace.yaml` catalog: `:51 "@effect/language-service": 0.87.4`,
  `:52 "@effect/vitest": 4.0.4`, `:71 "effect": 4.0.4` (exact, no caret),
  `:90 "tsc-rs": 0.6.0`, `:93 "typescript": 7.0.2`.
  Line 15 `tsc-rs: true` under `allowBuilds`.
- Root `package.json`: `"prepare": "vp config --no-agent"` (NO `effect-tsgo patch`);
  devDeps include `@effect/language-service`, `tsc-rs`, `typescript`, `vite-plus`,
  `vitest`, `knip`, `ts-morph`, `oxlint`, `tsx`. NO `@effect/tsgo`.
  `"typecheck": "vp run -r typecheck"` (no `--concurrency-limit`).
- `tsconfig.base.json:38-79` plugins entry: `name` `@effect/language-service`,
  `namespaceImportPackages: ["effect"]`, `allowedUnstableApis: ["@effect/vitest"]`,
  `allowedExperimentalApis: []`, 19-key `diagnosticSeverity` map.
  Strictness block broader than upstream (adds `noImplicitReturns`,
  `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
  `noPropertyAccessFromIndexSignature`, `noUncheckedSideEffectImports`,
  `allowUnreachableCode: false`, `isolatedModules`, `moduleDetection: force`).
  `target: ES2023`, `moduleResolution: bundler`.
- Workspace typecheck scripts: `apps/desktop/package.json:12`,
  `apps/renderer/package.json:10`, `packages/shared/package.json:11`
  → `"tsc-rs --noEmit"`. Root `package.json:17` → `"vp run -r typecheck"`.
  `vite.config.ts:240-243` task `typecheck:all:
  ["vp run -r typecheck", "tsc-rs -p scripts/tsconfig.json"]`;
  `push-gate` `dependsOn` at `vite.config.ts:351`.
- All 5 tsconfig files extend `tsconfig.base.json`; none shadows `plugins`.
- Dependency placement: `effect` runtime dep of `apps/desktop` ONLY;
  `@effect/vitest` devDep of `apps/desktop` only; `@effect/language-service`
  root devDep. `apps/renderer` and `packages/shared` declare nothing Effect.
  pnpm isolated linker, no hoisting settings, no `.npmrc` —
  `require.resolve('effect')` fails from renderer and shared.
- `scripts/architecture-check.ts:42` — `const EFFECT_SPECIFIER = /^effect(?:\/|$)/;`
  applied at `:78` when `inPackages || inRenderer || inPreload`.
  All 4 `architecture-check.test.ts` fixtures use the bare `effect` specifier.
- `AGENTS.md:290-292` documents: "Effect 4 lives in the main process only
  (`effect`, t3code-style). It never crosses the bridge (`arch-check` rejects any
  `effect*` specifier under `packages/`, `apps/renderer/` and `preload/`)."

## EXPLORER EVIDENCE (5 independent explorers — ADJUDICATE, do not blindly repeat)

### E1 — compiler wiring

`tsc-rs@0.6.0` is the compiler in all 3 workspaces + the `scripts/` task; no bare
`tsc` anywhere in the task graph. Verified by running `pnpm typecheck` and
`vp run typecheck:all` — all green. Guarded by `scripts/toolchain.test.ts`
(asserts every typecheck script matches `/\btsc-rs\b/`; that the `typecheck:all`
task contains `"tsc-rs -p scripts/tsconfig.json"`; and that no command matches a
bare `tsc ` or `tsc -p`) and `scripts/effect-resolution.test.ts` (asserts exact
catalog pin `/^\d+\.\d+\.\d+$/`, exactly one `effect` copy, plugin name ===
`"@effect/language-service"`, `allowedUnstableApis`, empty experimental allowlist,
stability rules === `"error"`). Both test files run inside the push-gate.
Caveats: `scripts/` is covered ONLY by the push-gate task, not `pnpm typecheck`;
`tsc-rs` is a root-only devDep that workspaces resolve via `PATH`; nothing asserts
that `tsc-rs` is a _declared dependency_.

### E2 — plugin activation chain

`plugins` is declared exactly ONCE at `tsconfig.base.json:38-79` (JSONC). All 5
tsconfigs `extends` it directly; none declares or shadows `plugins`; none chains
through another workspace config. `tsc-rs -p <config> --showConfig` resolves
`plugins:[{"name":"@effect/language-service"}]` for ALL FIVE, and all four tsc-rs
typechecks exit 0. Critically: the option keys
`allowedUnstableApis` / `allowedExperimentalApis` / `namespaceImportPackages` and
rule codes 377135/377136 exist in the tsc-rs native binary but do NOT exist in the
`@effect/language-service@0.87.4` JS bundle (`indexOf` = -1 for
`unstableApiUsage`/`experimentalApiUsage`; its own options are only
`allowedDuplicatedPackages`/`allowedFloatingEffects`). So the stability gate is
enforced by the COMPILER, not the editor plugin. JS `tsc` 7.0.2 drops `plugins`
entirely (`--showConfig` → undefined) for all five configs. Plugin module
resolution is anchored to the repo root, so moving the block into a workspace
tsconfig would break resolution.

### E3 — rule map comparison

19-key SUBSET of upstream's 30. Weaker than upstream (7): `nodeBuiltinImport`,
`globalConsole`, `globalDate`, `globalTimers`, `globalFetch`, `globalRandom` all
`off` vs upstream `error`; `deterministicKeys` `warning` vs upstream `error`.
Upstream-`error` keys OMITTED entirely (7): `schemaSyncInEffect`,
`cryptoRandomUUIDInEffect`, `globalDateInEffect`, `globalConsoleInEffect`,
`globalRandomInEffect`, `globalTimersInEffect`, `globalFetchInEffect`.
STRICTER than upstream (2): `unstableApiUsage` and `experimentalApiUsage` are
`error` vs upstream `off`. Added options not in upstream (2):
`allowedUnstableApis: ["@effect/vitest"]`, `allowedExperimentalApis: []`.
Missing upstream `overrides` block (upstream exempts `**/*.test.ts` from
`preferSchemaOverJson`; this repo has none). `namespaceImportPackages` omits
`@effect/platform-node` (inert — repo has no such dep). Repo adds ZERO new rule
names. Empirically verified in a scratch dir OUTSIDE the repo: with this repo's
block, `preferSchemaOverJson` fires TS377026 and `unstableApiUsage` fires TS377136
as errors. `preferSchemaOverJson` fired as an ERROR inside a `.test.ts` file,
which upstream would have exempted.

### E4 — the effect-tsgo question

The missing `@effect/tsgo` + `effect-tsgo patch` is the OLDER, now-redundant
mechanism. `node_modules/tsc-rs/README.md:20-29` verbatim: "`tsc-rs` has the
[Effect] language service diagnostics built in (codes 377xxx), so an Effect
project needs no second compiler. … They run only when the tsconfig has the
plugin, as with `@effect/language-service`". `README.md:31-44`: rules are "a port
of [Effect-TS/tsgo] 0.51.1"; "So a project on `effect@4` gets TS377136 warnings
… as with effect-tsgo 0.51.1." `npm view @effect/tsgo readme` shows
`effect-tsgo patch` PATCHES the plain `typescript` package so that plain `tsc`
emits Effect diagnostics — i.e. it patches the very compiler this repo does not
use. Installed tsc-rs is 0.6.0 (`tscVersion` 7.1.0-dev), NEWER than upstream's
0.4.0. EMPIRICAL: a probe file importing `HttpServerRequest.fromWeb` from
`effect/http` produced
`apps/desktop/src/__council_probe.ts(2,40): error TS377136: \`effect/http/HttpServerRequest#fromWeb\` is an unstable API`under tsc-rs, and NO output under plain`tsc`7.0.2 (both compilers confirmed
loading the file via`--listFiles`). Probe deleted; `git status --porcelain`printed nothing. Repo-wide rg finds`effect-tsgo`/`@effect/tsgo`ONLY in the
stale council research doc. tsgo's own README warns "Use`effect-tsgo`instead of`tsgo`, not alongside it" (duplicate diagnostics).

### E5 — placement and boundary

Dependency placement is correct and minimal. BUT the boundary is enforced only
for the bare package. Regex verification: `@effect/vitest => false`,
`@effect/schema => false`, `@effect/language-service => false`,
`effect => true`, `effect/http => true`, `effectful => false`,
`my-effect => false`. So an `@effect/*` import in `packages/shared`,
`apps/renderer`, or `preload.ts` passes arch-check silently and exits 0.
`AGENTS.md:290-292` claims arch-check "rejects any `effect*` specifier" — the
code covers strictly less than the documented claim. The gap is currently masked
by three other gates (no dep declared + isolated linker + tsc-rs
module-resolution failure), but all three evaporate the moment a dependency is
declared in the wrong workspace. `architecture-check.test.ts` never exercises an
`@effect/*` specifier, and `README.md:94-95`'s arch-check failure list omits the
Effect rule entirely.

## VERDICT CRITERIA

- **PASS** = fully configured, at least equivalent to upstream, no actionable gaps.
- **WARN** = configured and genuinely enforced, but with material gaps,
  divergences, or documentation/code mismatches that need action.
- **FAIL** = not configured, not enforced, or broken.

## RULES OF ENGAGEMENT

- You MAY spot-verify anything you intend to rely on, using read-only commands.
- Do NOT modify, create, or delete any tracked file. If you create a temporary
  probe file, delete it and finish by confirming `git status --porcelain` prints
  nothing.
- Your job is to find problems. A PASS with caveats is less valuable than a
  specific WARN.
- Cite `file:line` for every claim.
- Judge 2 has already delivered WARN/HIGH and has written
  `.agents/council/2026-10-13-validate-effect-tsc-rs-judge-2.md`. You may read it
  ONLY during Round 2 — in Round 1, work independently and do NOT read the other
  judges' files.
