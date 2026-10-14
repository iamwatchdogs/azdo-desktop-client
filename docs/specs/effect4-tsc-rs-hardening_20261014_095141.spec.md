# Spec: harden the Effect 4 + tsc-rs adoption

Date: 2026-10-14 09:51 (20261014_095141)
Branch: `feat/adopt-effect-4`

## Context

The Effect 4 adoption (effect confined to `apps/desktop/src/main` + `preload`,
typechecked by tsc-rs with the `@effect/language-service` diagnostics) is
implemented and enforced, but the council validation ended at **WARN**: the
setup is real, yet five holes survive every gate. This spec closes them.

Upstream evidence (pingdotgg/t3code):

- **PR #16704** ("typecheck with tsc-rs"): the whole decision tree. Workspaces
  run `tsc-rs --noEmit`; the JS `tsc` with the effect-tsgo patch stays only for
  the editor (`js/ts.tsdk.path`); `@effect/tsgo` is pinned so CLI and editor
  agree on rule names; `unstableApiUsage` / `experimentalApiUsage` are **off**
  for two stated reasons — ~6,000 deliberate unstable-module uses (http, sql)
  and false TS2790 on `delete` of index-signature properties
  (Effect-TS/tsgo#820); code that only TypeScript 7.0.2 accepts (`satisfies`
  replay fixtures) is fixed, not tolerated.
- **PR #19187** ("bump tsc-rs to 0.6.0"): bump landed, `--fast` rejected with
  measurements. No action needed here — this repo already pins 0.6.0 and sets
  no `GOPORT_FAST`.

## Findings to fix (all five from the WARN)

1. **arch-check regex hole.** `EFFECT_SPECIFIER = /^effect(?:\/|$)/` matches
   only the bare package; every `@effect/*` specifier passes with exit 0.
   AGENTS.md claims it "rejects any `effect*` specifier" — it does not. This
   is the only barrier: `effect` resolves from renderer/shared via the root
   symlink, so nothing else would stop a scoped import.
2. **Guard suite is hollow.** 13 of 19 `diagnosticSeverity` keys have no test;
   downgrading `preferSchemaOverJson` to `off` passes every gate green.
3. **Dead/misaimed config.** `cryptoRandomUUID: "error"` cannot fire inside
   Effect code (the engine routes it to the unset `cryptoRandomUUIDInEffect`),
   so a rule reads as enforced and is not.
4. **Wrong in-file rationale.** The comment claims the rules "only bite
   inside Effect code" (the non-`InEffect` globals fire everywhere, which is
   why they are off) and that `main.ts` "must stay dependency-free" (it
   imports electron, electron-store, @ado/shared, node:path).
5. **scripts/ is push-gate-only.** `pnpm typecheck` fans out over workspaces
   only; the guard tests themselves are typechecked solely by the
   `typecheck:all` task in the pre-push gate.

## Decisions

- **Fix the boundary, not the docs' claim.** The regex becomes
  `/^(?:@)?effect(?:\/|$)/` — bare `effect` and every `@effect/*` scoped
  import. New boundary tests for the scoped forms.
- **Match the comment to the config's intent.** The global rules stay `off`
  (plain tooling — main.ts, the probe wrappers — uses node: modules, console
  and process.env outside any Effect). The `*InEffect` counterparts go to
  `error`, so inside Effect code the same discipline is enforced:
  `cryptoRandomUUIDInEffect`, `globalConsoleInEffect`, `globalDateInEffect`,
  `globalFetchInEffect`, `globalRandomInEffect`, `globalTimersInEffect`.
  `nodeBuiltinImport` has no InEffect counterpart and stays off. This makes
  rule 3 dead-config finding disappear by construction, not by exemption.
- **Keep `unstableApiUsage` / `experimentalApiUsage` at `error`** — a
  deliberate, documented deviation from t3code's `off`. Their two reasons do
  not apply here: the Effect surface is one core dep plus one allowlisted
  test dep (`@effect/vitest`, pinned, with an identity test), there is no
  http/sql usage, and the repo contains no `delete` of index-signature
  properties. Default-deny is the repo's stated stance and is strictly
  stronger. Recorded in the tsconfig comment and pinned by the guard test, so
  flipping it is a visible, reviewed decision.
- **`globalTimersInEffect` forces one real change.** `native.ts` schedules a
  hand-rolled `setTimeout` deadline inside `Effect.callback`. The deadline is
  already enforced by `Effect.timeout("2 seconds")` + `orElseSucceed`; the
  timer is redundant. Remove it and let the timeout's interrupt close the
  probe. Fix the producer, not the consumer.
- **scripts/ becomes locally reachable.** Root `typecheck` script becomes
  `vp run typecheck:all` (the existing task = workspace fan-out + scripts
  tsc-rs pass). The toolchain test's root-script assertion is updated to pin
  the new shape.

## Change plan (one commit each, all checks green before advancing)

1. `test(scripts): reject scoped @effect imports at the boundary` — regex +
   boundary tests for `@effect/*` in packages/renderer/preload, allowed in
   main.
2. `refactor(config): enforce the Effect idioms inside Effect code` —
   tsconfig InEffect rules + honest comments; native.ts timer removal.
3. `test(scripts): guard the Effect diagnostics config` — new
   `scripts/effect-diagnostics.test.ts` over `tsconfig.base.json` (rule keys
   must be real, load-bearing rules must be error, off-globals must have an
   error-level InEffect counterpart, allowlist pinned); JSONC reader shared
   with `effect-resolution.test.ts`.
4. `docs: correct the typecheck claims and close the scripts/ gap` —
   README command table, AGENTS.md Effect + typecheck bullets, root
   `typecheck` script, toolchain test update.

## Implementation status: done (2026-10-14)

All four commits landed on `feat/adopt-effect-4` (`6e50a11`, `46e18b8`,
`db172c4`, `177377a`), plus a fifth the push gate forced out (`knip` scanned
the working tree while the architecture tests held a probe fixture — a
transient unused-file report; `knip` now runs after `tests:all`, pinned by a
test). `vp run push-gate` is green end to end, including the built-app e2e.

Evidence (red-then-green per change):

- Boundary: the three new scoped-import tests fail against the old
  `/^effect(?:\/|$)/` and pass against `/^(?:@)?effect(?:\/|$)/`.
- Diagnostics: TS377073 fired on `native.ts`'s `setTimeout` the moment
  `globalTimersInEffect` went to `error`; the guard test goes red on four
  mutations (structural rule downgraded, InEffect key dropped, key
  misspelled, allowlist widened).
- Deadline test: caught that the old timer was a TestClock cheat — `it.effect`
  runs on the TestClock, so the test now forks the probe and advances the
  clock, and runs in milliseconds instead of two seconds.
- Root typecheck: red when the scripts half is dropped from the script.

Notable fallout: `Effect.fork` is `Effect.forkChild` in Effect 4, and
`TestClock` is imported from `effect/testing`, not `effect`.

## CI-green batch (2026-10-14, after PR #1 opened)

The first PR run was red. Root causes, in fix order:

1. **The boundary suite wrote fixtures into the live source tree**
   (`scripts/architecture-check.test.ts`) — one decision, four failures:
   each test spawns a whole-repo ts-morph scan (~3.5-7s on CI runners) and
   blew the 5s vitest default (`Unit tests` failed on all three OSes); a
   timed-out test then leaked `packages/shared/src/__arch-probe.ts` and the
   parallel `vp check` step linted it (TS2307 + `no-unsafe-*`); CodeQL raised
   `js/file-system-race` on both `writeFileSync` calls; CodeRabbit flagged the
   same hole as a nitpick (concurrent vitest files and tools can read the
   probes mid-run). Fix: build a throwaway root — a temp directory with the
   same relative layout and a minimal tsconfig — and run the CLI against it.
   Same code paths through the same rules, no writes into the tree, an order
   of magnitude faster.
2. **Windows path separators.** `relative()` returns `\`-separated paths on
   Windows, so `inPackages`/`inRenderer`/`inPreload` never matched there and
   every boundary rule silently passed with exit 0; `pnpm ls --parseable`
   output has the same shape and the effect store-path regex returned `[]`
   against the expected `["4.0.4"]`. Fix: one `toPosixPath` primitive used by
   both sites, with a unit test that feeds Windows-shaped input on every
   platform so the evidence is not OS-gated.
3. **Scanner ordering the producer fix made dead.** `9f0159b` and `25feda7`
   ordered `knip`/`arch-check` after `tests:all` to dodge the probe race. With
   the race gone at its producer the `dependsOn` is pure cost — CI re-runs the
   root suite inside the arch-check step. Both reverted, pinned by an inverted
   assertion in `scripts/toolchain.test.ts`.
4. **Docs artifacts.** Research doc items 5 (`@effect/tsgo`) and 6
   (`@effect/vitest`) are superseded by this branch — marked as such with the
   reasoning preserved. Judge verdicts: two malformed `recommendation` JSON
   properties and one table row whose regex pipe split the cell.

Deviations: none. The unstable/experimental rules stay at `error` as the
first batch decided.

## Out of scope

- `--fast` / `GOPORT_FAST` (rejected upstream with measurements; nothing set).
- `namespaceImportPackages: ["@effect/platform-node"]` — no such dependency
  today; adding it is inert config. Revisit when platform-node is adopted.
- `.vscode/settings.json` `js/ts.tsdk.path` — the tsc-rs tsserver lives in a
  per-platform package (`@tsc-rs/<os>-<arch>`), so one shared setting cannot
  point at it. The plugin entry already drives the editor's tsserver.
