# Judge 3 — Completeness & Self-Consistency

```json
{
  "judge": "judge-3",
  "verdict": "WARN",
  "confidence": "HIGH",
  "key_insight": "The setup is genuinely configured and genuinely enforced — I reproduced TS377026/TS377067/TS377078/TS377136/TS377001 firing and 7 of 9 mutations going red — but 13 of upstream's 24 error-severity rules are absent or weakened, every one of them demonstrably bites this repo's own code shapes, and the in-file comment justifying the six downgraded ones is factually wrong in two independent ways. Meanwhile 13 of the 19 configured rule keys (including preferSchemaOverJson, the highest-yield rule) are unguarded by any test, and AGENTS.md overstates the implementation in two places.",
  "findings": [
    {
      "severity": "moderate",
      "description": "13 of upstream t3code's 24 error-severity rules are absent or weakened. Six are downgraded to off (nodeBuiltinImport, globalConsole, globalDate, globalTimers, globalFetch, globalRandom); seven upstream-error keys are omitted entirely (schemaSyncInEffect, cryptoRandomUUIDInEffect, globalDateInEffect, globalConsoleInEffect, globalRandomInEffect, globalTimersInEffect, globalFetchInEffect); deterministicKeys is downgraded error->warning. I verified that every one of these rules DOES fire on this repo's code shapes: nodeBuiltinImport (TS377057 on `import ... from \"node:fs\"`), globalConsole (TS377064 on plain `console.log`), globalDate (TS377066 on plain `Date.now()`), cryptoRandomUUID (TS377078 on plain `crypto.randomUUID()`), globalDateInEffect (TS377067 on `Effect.sync(() => Date.now())`). So the omissions are not inert rules being tidied away — they are live gates being dropped.",
      "fix": "Either restore upstream parity (set the six global rules to \"error\" and add the seven *InEffect keys as \"error\"), or keep the exemptions but (a) write a comment that names each one and its true reason and (b) add test assertions pinning the chosen severities so the exemptions cannot silently widen. My recommendation: restore the seven *InEffect rules, because tsconfig.base.json:60-62 itself concedes that 'the Effect idiom rules ... only bite inside Effect code' — i.e. those seven are precisely the surface this repo is now writing (native.ts's probeOpenBus and the planned ADO REST client).",
      "why": "These are the rules that encode the council research doc's load-bearing claim (line 189: '20 ecosystem modules are @stability unstable; mitigated only by ... allowedUnstableApis: []'). A repo that default-denies unstable modules but permits ambient `Date.now()`, `console.log`, `setTimeout` and `crypto.randomUUID()` inside its Effects has closed the door it cares about and left the side door open. Worse, the asymmetry is inverted: the rules that would constrain plain imperative main-process code are switched off, and the rules that would constrain Effect code are omitted — the weakening is concentrated exactly where the Effect code lives.",
      "ref": "tsconfig.base.json:47-77"
    },
    {
      "severity": "moderate",
      "description": "The comment justifying the six `off` rules is factually wrong in two independent ways. It reads: 'The main process entrypoint and dev scripts are plain imperative tooling by design: main.ts must stay dependency-free so a logging failure can never take down the handler that reports it. The Effect idiom rules therefore only bite inside Effect code, where the structural rules above do the real work.' (tsconfig.base.json:58-62). First, the second sentence is false: globalConsole/globalDate/globalTimers/globalFetch/globalRandom/nodeBuiltinImport fire on NON-Effect code — I triggered TS377064, TS377066 and TS377057 on plain `console.log`, `Date.now()` and `import from \"node:fs\"` in ordinary functions with no Effect in scope. Second, 'main.ts must stay dependency-free' is literally false: main.ts imports electron, electron-store, electron-updater, @ado/shared and node:path (main.ts:1-14).",
      "fix": "Rewrite the comment to state the real reason and the real cost. Something like: 'main.ts is the one module that must keep working when everything else has failed, so its `console.warn` (main.ts:112,114,117) and `node:path` usage (main.ts:1) are exempt. Turning these on would force Clock/Logger/Crypto wrappers into the error-reporting path itself, which is the wrong place to spend indirection. The Effect-side equivalents are enforced by the *InEffect rules.' That is defensible; what is there now is not.",
      "why": "This is a self-consistency defect, not just a wording one. A rationale that does not describe the code it justifies cannot be reviewed, and the next agent that reads 'the Effect idiom rules only bite inside Effect code' will conclude the opposite of the truth and either re-enable the wrong rules or trust the wrong ones. It also means the decision to turn these six off has never actually been argued on its merits.",
      "ref": "tsconfig.base.json:58-62"
    },
    {
      "severity": "moderate",
      "description": "13 of the 19 configured rule keys are unguarded by any machine test. I ran a full mutation sweep over all 19 keys (severity downgraded to \"warning\", then key deleted) against scripts/toolchain.test.ts + scripts/effect-resolution.test.ts. Only 6 go RED: anyUnknownInErrorContext, leakingRequirements, nodeBuiltinImport, globalConsole, unstableApiUsage, experimentalApiUsage. The unguarded 13 include preferSchemaOverJson — the single highest-yield rule in practice, which I triggered on my first attempt with a 3-line file — plus cryptoRandomUUID, instanceOfSchema, unsafeEffectTypeAssertion, missingEffectServiceDependency, globalErrorInEffectCatch, globalErrorInEffectFailure, unknownInEffectCatch, globalDate, globalTimers, globalFetch, globalRandom, deterministicKeys. (The apparent RED on deleting deterministicKeys is a JSON SyntaxError artifact from a dangling comma, not a real guard.) namespaceImportPackages is also entirely unguarded: deleting it leaves all gates green.",
      "fix": "Extend scripts/effect-resolution.test.ts:106-118 to assert the whole rule map — e.g. capture `diagnosticSeverity` and assert it equals a frozen expected object, or at minimum pin `preferSchemaOverJson: \"error\"`, `deterministicKeys: \"warning\"`, `cryptoRandomUUID: \"error\"`, `instanceOfSchema: \"error\"` and `namespaceImportPackages: [\"effect\"]`. A frozen-object assertion is cheaper to write than the individual expectations and fails loudly on any drift.",
      "why": "The tests that exist are real and well-shaped (see the mutation table below), which makes the partial coverage the more surprising: someone deliberately built a gate and then left the most-used rule outside it. preferSchemaOverJson being downgraded to \"off\" is a one-line change that every gate in this repo would wave through, and it is the rule most likely to be annoyed by first (it fires on any JSON.parse inside an Effect).",
      "ref": "scripts/effect-resolution.test.ts:106-118"
    },
    {
      "severity": "moderate",
      "description": "AGENTS.md:292-294 overstates the implementation twice. (a) 'Every `ipcMain` handler still ends in one `runPromise`' is false: only probeDbus does (native.ts:112-113). The seven handlers registered at main.ts:28-54 — appVersion, getSettings, setSettings, getSecret, setSecret, accessibilityCheck, ffiProbe — are plain `async` functions returning `Promise.resolve(...)`. `runPromise` appears exactly once in the whole desktop source tree. (b) 'every bridge return type stays structuredClone-safe (asserted in packages/shared/test/ipc.test.ts)' is asserted for four hand-picked cases (ipc.test.ts:15-42) — IPC_CHANNELS strings, DEFAULT_APP_SETTINGS, AppSettingsSchema.parse, and two ad-hoc CapabilityResult literals — not for 'every' return type. AzdoBridge (packages/shared/src/ipc.ts:21-30) declares 8 methods and the test does not enumerate or reflect over them.",
      "fix": "Either soften the AGENTS.md sentence to what is true ('the Effect boundary terminates in exactly one runPromise, at native.ts:112, which returns a plain serializable value'), or close the gap in the test. For the second half, the council research doc's recommendation (line 165-167) was a structuralClone round-trip over each shared schema — that is cheap to write properly by iterating the AzdoBridge method names.",
      "why": "AGENTS.md is the file every agent in this repo reads first, and it is written as a list of machine-enforced invariants. Two of those invariants are stated more strongly than the code delivers. An agent that relies on 'every ipcMain handler ends in one runPromise' will write a new handler assuming a convention that is not in force, and an agent that relies on 'every bridge return type is asserted clone-safe' will believe the bridge is structurally protected when only four samples are.",
      "ref": "AGENTS.md:292-294"
    },
    {
      "severity": "moderate",
      "description": "The 'Effect never crosses the bridge' boundary is enforced by exactly one regex, and the repo's own typecheck does not back it up. ARCH_SPECIFIER = /^effect(?:\\/|$)/ (scripts/architecture-check.ts:42) is applied at :78 to packages/, apps/renderer/ and preload. I verified it works for bare `effect` (a stray import in apps/desktop/src/preload*.ts raised a violation). But: (a) the root node_modules/effect symlink resolves `effect` and `effect/http` from apps/renderer and packages/shared, so a stray `import { Effect } from \"effect\"` in apps/renderer/src produces NO typecheck diagnostic — the packet's claim that resolution 'fails from renderer and shared' is factually wrong; (b) arch-check passes `@effect/vitest` in apps/renderer/src and `@effect/schema` in packages/shared/src with exit 0. Practical exposure today is nil only because those @effect packages are not installed anywhere renderer/shared can reach (@effect/vitest gives TS2307 there — verified).",
      "fix": "One character fixes the regex: change EFFECT_SPECIFIER to /^@?effect(?:\\/|$)/. Then add two fixtures to scripts/architecture-check.test.ts — one bare `effect`, one `@effect/*` — since E5 is correct that the existing four fixtures all use the bare specifier. This is the cheapest high-value fix in the whole review: it closes a silent hole in the only gate protecting the boundary.",
      "why": "This is the single load-bearing architectural rule of the whole adoption — the research doc's decisive local evidence was that Effect values are destroyed by contextBridge (Data.TaggedError -> {}). The rule is correct as far as it goes and the comment at architecture-check.ts:73-77 explaining it is excellent. But its coverage is one regex, with no typecheck backstop for the bare specifier and no coverage at all for the scoped family. The moment anyone declares a dependency in the wrong workspace, the typecheck will no longer catch it and arch-check will not either.",
      "ref": "scripts/architecture-check.ts:42"
    },
    {
      "severity": "minor",
      "description": "README.md:94-95 lists the arch-check failure modes as 'packages->apps imports, renderer->electron imports, and React in process code' and omits the Effect rule entirely. AGENTS.md:290-292 documents it, so the two top-level docs disagree on what the boundary guard does.",
      "fix": "Add a fourth clause to README.md:94-95: 'and Effect in shared code, the renderer, or preload'.",
      "why": "README is the outward-facing description of the architecture and the place a new contributor looks to find what is enforced. Omitting the rule that encodes the app's single most consequential architectural decision makes the doc under-describe the system.",
      "ref": "README.md:94-95"
    },
    {
      "severity": "minor",
      "description": "`scripts/` is the only workspaces-tree whose typecheck runs exclusively in the pre-push gate, not in `pnpm typecheck`. scripts/ has no package.json (verified), so `vp run -r typecheck` (package.json:17) does not reach it; only the `typecheck:all` task does (vite.config.ts:241). This is the deliberate route documented in scripts/toolchain.test.ts:7-9 — t3code instead makes scripts a workspace of its own. The cost: a developer running `pnpm typecheck` — the exact command AGENTS.md:299-300 names as the gate for the Effect rules — does not typecheck the directory that contains the two Effect-guard test files themselves.",
      "fix": "Either accept it (and it is defensible: the toolchain.test.ts header argues the case explicitly and correctly), or add `scripts` as a pnpm workspace with its own `typecheck:tsc-rs --noEmit` script to match t3code. A middle option: have the root `typecheck` script be `vp run typecheck:all` so the local command matches the gate.",
      "why": "AGENTS.md points agents at `pnpm typecheck` as the command that enforces the Effect rules. For the three suites that contain Effect code it does. For scripts/ it does not, which means the guards themselves are only checked at push. Small, but it is a completeness gap in the command the docs promise.",
      "ref": "vite.config.ts:240-243"
    },
    {
      "severity": "minor",
      "description": "The council research doc is now stale in three places, and nothing marks it superseded. (1) It recommends `@effect/tsgo@0.51.1` by name (line 150); the shipped route is `tsc-rs@0.6.0`, whose built-in 377xxx diagnostics node_modules/tsc-rs/README.md:31-44 describes as 'a port of Effect-TS/tsgo 0.51.1' — substantively equivalent, and newer (installed tscVersion 7.1.0-dev vs upstream's 0.4.0). (2) It requires `floatingEffect: \"error\"` and calls it 'the load-bearing condition ... Adoption is void without it' (line 150-153). I verified this condition is in fact MET, but by default rather than by configuration: an unconfigured floating Effect yields `error TS377001: effect(floatingEffect)` under the shipped config. (3) It forbids `@effect/vitest` (line 154-157, citing #6129); the implementation adopts it (apps/desktop/package.json:26 plus allowedUnstableApis). That reversal is well-evidenced — apps/desktop/test/effect-bridge.test.ts:18-20 asserts object identity between vitest.TestRunner and vite-plus/test.TestRunner, which is exactly the right shape of proof — and explained at tsconfig.base.json:42-45.",
      "fix": "Add a short 'Superseded in implementation' note to the research doc covering the tsgo->tsc-rs substitution, that floatingEffect is met by default, and that the @effect/vitest ban was reversed on vite-plus 1.1.0 with the identity probe as evidence. Or fold the note into README.md.",
      "why": "The research doc is the artefact a future reader will consult to learn why the toolchain is shaped this way. Three of its named conditions no longer describe the repo, and one of them (the tsgo mechanism) is the one it leans on hardest. A reader who follows the doc literally will look for `@effect/tsgo`, not find it, and conclude the load-bearing gate is missing — which is false.",
      "ref": ".agents/council/2026-10-13-research-adopt-effect-4.md:150-157"
    }
  ],
  "recommendation": "WARN. The target is met: the Effect 4 + tsc-rs setup is configured, it is at least equivalent to upstream on the rules that matter most (unstableApiUsage and experimentalApiUsage are strictly STRICTER than upstream's off, the exact-pin catalog rule is upstream-shaped, and the plugin resolves through all five tsconfigs with tsc-rs as the compiler in every typecheck path), and it is genuinely enforced rather than decorative — I reproduced five distinct TS377xxx diagnostics firing under the shipped config and 7 of 9 mutations going red. The WARN is for the divergence surface, not the core. Three fixes are worth doing before this is called done, in this order: (1) widen EFFECT_SPECIFIER to /^@?effect(?:\\/|$)/ and add the two missing arch-check fixtures — one character, closes the only silent hole in the app's central architectural boundary; (2) pin the remaining rule map in scripts/effect-resolution.test.ts so preferSchemaOverJson cannot be downgraded unnoticed; (3) rewrite the tsconfig comment at :58-62 so the stated reason matches what the rules actually do, and decide the seven omitted *InEffect rules on their merits rather than by default. Then correct the two AGENTS.md overstatements (main.ts's runPromise, the structuredClone claim) and add the Effect rule to README.md:94-95.",
  "explorer_adjudication": [
    {
      "explorer": "E1",
      "status": "CONFIRM",
      "rationale": "Independently verified. tsc-rs is the compiler in all three workspace typecheck scripts (apps/desktop/package.json:12, apps/renderer/package.json:10, packages/shared/package.json:11, all `tsc-rs --noEmit`), root package.json:17 fans out with `vp run -r typecheck`, and vite.config.ts:241 adds `tsc-rs -p scripts/tsconfig.json`. `npx tsc-rs --version` prints 7.1.0-dev. Both guard test files run inside the push-gate via vite.config.ts:351 -> tests:all -> `vp test run` (vite.config.ts:335). Both caveats are accurate and I add evidence for the first: scripts/ has no package.json, so it is not a pnpm workspace and `vp run -r typecheck` genuinely cannot reach it."
    },
    {
      "explorer": "E2",
      "status": "CONFIRM",
      "rationale": "Independently reproduced every load-bearing claim. `tsc-rs -p <config> --showConfig` resolves `plugins:[{\"name\":\"@effect/language-service\"}]` for all five configs (apps/desktop, apps/renderer, packages/shared, scripts, root); plain `tsc` 7.0.2 returns nothing for all five. The compiler-vs-editor split is real and decisive: a probe importing `effect/http`'s `HttpServerRequest.fromWeb` produced `error TS377136 ... is an unstable API` under tsc-rs and zero output under plain tsc for the identical file and project. I add one fact E2 did not: tsc-rs emits `warning TS377134: Unknown Effect diagnostic rule` for a bogus key, and the shipped config produces no TS377134 across all four typechecks — so all 19 configured keys are genuinely recognized rule names in tsc-rs 0.6.0, not silently-ignored typos."
    },
    {
      "explorer": "E3",
      "status": "CONFIRM",
      "rationale": "The arithmetic is exactly right and I recomputed it independently: upstream's 30 diagnosticSeverity keys split 24 error / 6 off; the repo's 19-key map is 10 identical-error, 7 present-but-weakened (6 global rules to off, deterministicKeys to warning) and 7 upstream-error keys omitted entirely — 10+7+7 = 24. The stricter-than-upstream pair (unstableApiUsage, experimentalApiUsage at error vs upstream off) and the two added options are both correct. Its `namespaceImportPackages` inertness claim I verified in both directions: adding \"@effect/platform-node\" to the list with the package NOT installed produces no error and no warning. I reproduced TS377026 as an error and TS377136 as an error. One qualification: E3's closing note that preferSchemaOverJson 'fired as an ERROR inside a .test.ts file, which upstream would have exempted' overstates the practical impact — I verified the rule only fires inside Effect code, and no .test.ts in this repo has JSON.parse inside an Effect, so the missing overrides block currently costs nothing (see my analysis of 2b)."
    },
    {
      "explorer": "E4",
      "status": "CONFIRM",
      "rationale": "Independently reproduced. node_modules/tsc-rs/README.md:20-44 verbatim states the 377xxx codes are built in, are 'a port of [Effect-TS/tsgo] 0.51.1', and that the stability rules report 'as warnings by default' — which is exactly what makes the repo's explicit \"error\" load-bearing rather than inherited. Installed tsc-rs is 0.6.0 (tscVersion 7.1.0-dev), newer than upstream's 0.4.0. Root package.json:13 is `vp config --no-agent` with no `effect-tsgo patch`. I reproduced the decisive file-level comparison myself: TS377136 under tsc-rs, silence under plain tsc. One correction to E4's phrasing: a repo-wide search finds zero occurrences of `effect-tsgo` or `@effect/tsgo` outside node_modules — including the council research doc, which writes it as `@effect/tsgo` only, so 'ONLY in the stale council research doc' is right in substance but the string count is 1 family, not 2."
    },
    {
      "explorer": "E5",
      "status": "REJECT",
      "rationale": "E5's central claim is that AGENTS.md:290-292 asserts arch-check 'rejects any effect* specifier' while 'the code covers strictly less than the documented claim'. The documented phrase read as a glob means specifiers beginning with `effect` — i.e. `effect` and `effect/...`. EFFECT_SPECIFIER = /^effect(?:\\/|$)/ (architecture-check.ts:42) implements exactly that. `@effect/vitest` is a different scoped package name and does not begin with `effect`, so E5's own regex table (`@effect/vitest => false`) demonstrates the code matching the doc, not the doc exceeding the code. The only literal sliver is that a glob `effect*` would also match hypothetical words like `effectful`, which the regex does not — immaterial. However E5's secondary finding is real and I confirm it independently and strengthen it: README.md:94-95 omits the Effect rule from the arch-check failure list entirely, and the boundary rests on that one regex with no typecheck backstop — I verified a stray `import { Effect } from \"effect\"` in apps/renderer/src typechecks clean because the root node_modules/effect symlink resolves from every workspace, and that arch-check exits 0 on `@effect/vitest` in renderer and `@effect/schema` in packages/shared. I carry the README gap and the regex widening as my own findings F5/F6."
    }
  ]
}
```

---

## 1. Method and what I actually ran

Everything below is either a file/line read or a command I executed in this repo. All probe files
were created untracked and deleted; `git diff --stat HEAD` is empty and the only `??` entries in
`git status --porcelain` are the council's own pre-existing artifacts (the packet and judge-1's
file), which I did not create.

The mutation experiments in section 5 were run in a sandbox **outside** the repo
(`git archive HEAD | tar -x`, plus a symlink to the real `node_modules`), so no tracked file was
ever modified.

Rule-liveness probes were run both in-repo (authoritative: real `@types/node`, real `effect`
resolution) and in a scratch config outside the repo. One methodological note worth recording: in
my first scratch config I set `"types": ["node"]` without making `@types/node` resolvable, and got
`TS2688: Cannot find type definition file for 'node'`. That single error silently suppressed every
Effect diagnostic in that project — the positive control (`preferSchemaOverJson` on a 3-line
`JSON.parse`) stopped firing. Anyone debugging this toolchain should know that an unresolved `types`
entry does not just add an error, it disables the whole 377xxx checker for the program.

## 2. Task 2a — the missing upstream-error rules, and whether the omission is justified

Upstream t3code's `diagnosticSeverity` map has **30 keys: 24 at `error`, 6 at `off`**. This repo has
**19 keys**. Decomposing:

| Category                            | Count | Keys                                                                                                                                                                                                                                           |
| ----------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identical to upstream (all `error`) | 10    | anyUnknownInErrorContext, unsafeEffectTypeAssertion, instanceOfSchema, missingEffectServiceDependency, leakingRequirements, globalErrorInEffectCatch, globalErrorInEffectFailure, unknownInEffectCatch, preferSchemaOverJson, cryptoRandomUUID |
| Stricter than upstream              | 2     | unstableApiUsage (`off`→`error`), experimentalApiUsage (`off`→`error`)                                                                                                                                                                         |
| Present but weakened                | 7     | nodeBuiltinImport, globalConsole, globalDate, globalTimers, globalFetch, globalRandom (all `error`→`off`); deterministicKeys (`error`→`warning`)                                                                                               |
| Omitted entirely                    | 7     | **schemaSyncInEffect, cryptoRandomUUIDInEffect, globalDateInEffect, globalConsoleInEffect, globalRandomInEffect, globalTimersInEffect, globalFetchInEffect**                                                                                   |

10 + 2 + 7 + 7 = 26, of which 24 correspond to upstream's 24 error keys (2 of the 10 are the
stricter pair, so 10 error-equivalents include 2 that were `off` upstream). E3's arithmetic holds.

### The seven omitted rules — justified or unexamined?

I checked whether each omission is covered by an explicit in-repo decision, and then whether the
rule even fires. The answer is the same for all seven: **no in-file comment mentions any of them, and
every one of them fires.**

The only comment near them is at `tsconfig.base.json:58-62`, and it is attached to the six
_weakened_ keys, not to the omitted ones. It reads:

> "The main process entrypoint and dev scripts are plain imperative tooling by design: main.ts must
> stay dependency-free so a logging failure can never take down the handler that reports it. The
> Effect idiom rules therefore only bite inside Effect code, where the structural rules above do the
> real work."

Taking that at face value, it is a decision about the six keys below it. It says nothing about
`schemaSyncInEffect`, `cryptoRandomUUIDInEffect` or any of the five `global*InEffect` rules, which sit
nowhere in the file. So by the packet's own test — "justified by an explicit in-repo decision (quote
the in-file comment) or an unexamined gap" — **all seven omissions are unexamined gaps.**

Moreover the comment cannot be stretched to cover them, and I verified why: the omitted rules are
context-scoped to Effect code, and they fire there. Concretely, under a config with the shipped map
plus `globalDateInEffect: "error"`:

```
probe.ts(3,58): error TS377067: This Effect code uses `Date.now()`, time access in Effect code is
represented through `Clock` from Effect. effect(globalDateInEffect)
```

whereas with the shipped map (no `globalDateInEffect` key), the identical line produces **nothing**.
So omission is equivalent to `off`, and the code this repo is actually writing —
`Effect.gen`/`Effect.acquireRelease`/`Effect.callback` in `native.ts:60-98` — is exactly the surface
the rule would have guarded.

I also established the counterpart for `cryptoRandomUUID`, which makes the picture less tidy than
either E3 or the comment suggests:

| Construct                                              | Diagnostic under the shipped config                |
| ------------------------------------------------------ | -------------------------------------------------- |
| `crypto.randomUUID()` in a plain (non-Effect) function | **`error TS377078: effect(cryptoRandomUuid)`**     |
| `Effect.sync(() => crypto.randomUUID())`               | **none**                                           |
| `Date.now()` in a plain function                       | none (rule is `off`)                               |
| `Date.now()` inside an Effect                          | none (rule omitted)                                |
| `JSON.parse` inside an Effect                          | **`error TS377026: effect(preferSchemaOverJson)`** |
| `console.log` inside an Effect                         | none (both variants off/omitted)                   |
| `setTimeout` / `Math.random` inside an Effect          | none (both variants off/omitted)                   |

So `cryptoRandomUUID: "error"` guards only the non-Effect call site — the Effect-side call site is
covered solely by `cryptoRandomUUIDInEffect`, which is omitted. The configured rule is real but
aimed at the wrong half of the problem.

**Verdict on 2a:** 13 of upstream's 24 error rules are absent or weakened; all 13 demonstrably fire
on this repo's shapes; exactly **zero** of them is justified by an in-file comment. The six weakened
ones have a comment that does not fit them (see F2); the seven omitted ones have no comment at all.

## 3. Task 2b — the missing `overrides` test-file exemption: the real cost

Upstream exempts `**/*.test.ts` / `**/*.test.tsx` from `preferSchemaOverJson`
(`"preferSchemaOverJson": "off"`). This repo has no `overrides` block. What does that actually cost?

The answer depends entirely on when the rule fires, which I established empirically. In an in-repo
probe:

```ts
export const plainJsonParse = (): unknown => JSON.parse('{"a":1}'); // NO diagnostic
export const effectJsonParse = Effect.sync(() => JSON.parse('{"a":1}')); // error TS377026
```

`preferSchemaOverJson` fires **only inside Effect code**. It does not fire on a plain function that
calls `JSON.parse`. (The same is true of the `*InEffect` family; the bare `global*` family is the
reverse — it fires only on non-Effect code.)

Enumerating every typechecked test/spec file in the repo — `apps/desktop/test/e2e/app.spec.ts`,
`apps/desktop/test/effect-bridge.test.ts`, `apps/desktop/test/native.test.ts`,
`apps/renderer/test/utils.test.ts`, `packages/shared/test/ipc.test.ts`,
`packages/shared/test/settings.test.ts`, `scripts/architecture-check.test.ts`,
`scripts/effect-resolution.test.ts`, `scripts/hooks/policy.test.ts`,
`scripts/toolchain.test.ts`, `scripts/workflow-actions.test.ts` — and searching for
`JSON.parse` / `applyJsonDiff` inside `apps/desktop/test`, `packages/shared/test` and the other test
directories:

**Zero hits.** The only `JSON.parse` in any test file is in `scripts/toolchain.test.ts:20` and
`scripts/effect-resolution.test.ts:47,64,99`, all in plain non-Effect helper functions — and I
verified all four are clean under the shipped config (`tsc-rs -p scripts/tsconfig.json` emits no
TS377026). The one test file that _does_ use Effect, `apps/desktop/test/effect-bridge.test.ts`,
touches no JSON at all.

**Real cost today: none.** The missing `overrides` block is currently inert, and E3's observation that
`preferSchemaOverJson` "fired as an ERROR inside a `.test.ts` file" does not translate into a live
problem for this repo.

The cost is latent and specific: the first time someone writes an Effect-based test that parses a
JSON payload — a natural thing to do when the ADO REST client starts returning JSON through an Effect
pipeline, which is the next planned conversion — that test will fail typecheck with TS377026 and the
developer will have nowhere to point. Upstream would have exempted it. It is a one-line, low-severity
divergence worth recording, not a defect.

## 4. Task 2c — `namespaceImportPackages` omitting `@effect/platform-node`: inert or a trap?

**Inert, in both directions.** This repo has no `@effect/platform-node` dependency anywhere (a
repo-wide search for `platform-node` outside `node_modules` finds exactly one hit: a comment in
`scripts/effect-resolution.test.ts:20` recounting t3code's history with
`@effect/platform-node-shared`). `pnpm ls` shows no such package installed.

I tested what would happen if it _were_ listed: with `"namespaceImportPackages":
["@effect/platform-node", "effect"]` and the package not installed, tsc-rs produces **no error, no
warning, no diagnostic of any kind** — identical output to the shipped config. There is no
resolution-time validation of the package list, and no `TS377134`-style unknown-option warning for
it.

So the omission is not a latent trap in the "silently breaks later" sense. It is a latent trap only
in the weaker "the config no longer describes reality" sense: if anyone ever adds
`@effect/platform-node` (which the research doc explicitly recommends against, line 158-162, because
its lazy `import("./Undici.js")` would be inlined into `dist-electron/main.cjs`), the namespace rule
list would need updating and nothing would remind them. Note that adding it would trip
`unstableApiUsage: "error"` first — every module outside `effect` is `@stability unstable` per
MIGRATION.md — so the package is blocked by a different, stronger gate regardless.

## 5. Doc-vs-code invariant table

Every documented invariant in AGENTS.md, README.md, the tsconfig comments and the
`toolchain.test.ts` header that bears on Effect 4 + tsc-rs, and whether code actually enforces it.

| #   | Invariant (as documented)                                                                                                           | Source                                      | Code actually enforces it?               | Evidence                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `tsc-rs` has the 377xxx codes built in, so the plugins block is a real typecheck gate, not editor UX                                | `tsconfig.base.json:31-37`                  | **YES**                                  | TS377026, TS377030, TS377078, TS377136, TS377001 all fire under `tsc-rs --noEmit` in-repo                                                                                                                                                                                                         |
| 2   | "The two stability rules are the load-bearing ones: they default-deny the unstable and experimental modules"                        | `tsconfig.base.json:34-36`                  | **YES**                                  | `error TS377136: effect/http/HttpServerRequest#fromWeb is an unstable API` (reproduced); plain tsc emits nothing for the same file                                                                                                                                                                |
| 3   | "The one sanctioned unstable edge: @effect/vitest"                                                                                  | `tsconfig.base.json:42-45`                  | **YES**                                  | `allowedUnstableApis: ["@effect/vitest"]`; deleting it turns `effect-bridge.test.ts`'s import into an error (mutation M9 → RED)                                                                                                                                                                   |
| 4   | main.ts is imperative by design; the Effect idiom rules only bite inside Effect code                                                | `tsconfig.base.json:58-62`                  | **NO — the comment is factually wrong**  | `globalConsole`/`globalDate`/`nodeBuiltinImport` fire on **non-Effect** code (TS377064/TS377066/TS377057 on plain `console.log`, `Date.now()`, `node:fs`); and main.ts imports electron, electron-store, electron-updater, @ado/shared, node:path (`main.ts:1-14`), so "dependency-free" is false |
| 5   | "anything else fails the typecheck instead of breaking silently" (unstable/experimental)                                            | `tsconfig.base.json:69-71`                  | **YES**                                  | verified above; also verified `apiStabilityLeak` is not enabled but is `off` by default and is a library-maintainer rule, correctly unnecessary for an app                                                                                                                                        |
| 6   | "Prefer deterministic keys so a service object never silently drops a field"                                                        | `tsconfig.base.json:74-76`                  | **PARTLY — set to `warning`, unguarded** | key exists; nothing asserts it; deleting it turns all gates green                                                                                                                                                                                                                                 |
| 7   | `tsc-rs` is the compiler; JS tsc ignores the plugins array, so a fallback to `tsc` silently loses every TS377xxx gate               | `scripts/toolchain.test.ts:1-9`             | **YES**                                  | tsc-rs resolves the plugin for 5/5 configs; plain tsc 7.0.2 resolves 0/5; mutations M1 and M8 → RED                                                                                                                                                                                               |
| 8   | t3code makes scripts a workspace; here scripts/ is checked by a task, so the task is what must be asserted                          | `scripts/toolchain.test.ts:7-9`             | **YES**                                  | `vite.config.ts:241` contains `tsc-rs -p scripts/tsconfig.json`; M8 (reverting it to `tsc`) → RED on two tests                                                                                                                                                                                    |
| 9   | Every workspace typecheck uses tsc-rs; root fans out rather than invoking                                                           | `scripts/toolchain.test.ts:35-43`           | **YES**                                  | M1 → RED; M5 (root → `tsc-rs -b .`) → RED                                                                                                                                                                                                                                                         |
| 10  | No plain `tsc` invocation anywhere in the task graph                                                                                | `scripts/toolchain.test.ts:55-63`           | **YES for the task graph**               | scans all `command:` entries in vite.config.ts; but note it does **not** scan workspace `package.json` scripts, which is why #9 exists separately                                                                                                                                                 |
| 11  | effect is pinned exactly so no workspace can float it                                                                               | `scripts/effect-resolution.test.ts:82-86`   | **YES**                                  | M4 (`4.0.4` → `^4.0.4`) → RED on 2 tests                                                                                                                                                                                                                                                          |
| 12  | Exactly one `effect` copy across every workspace                                                                                    | `scripts/effect-resolution.test.ts:88-90`   | **YES**                                  | `pnpm ls effect --depth Infinity --parseable` → 3 lines, one of which matches the store-path regex → `["4.0.4"]` = catalog pin                                                                                                                                                                    |
| 13  | The plugin tsc-rs runs is declared, so knip fails if it is referenced but undeclared                                                | `scripts/effect-resolution.test.ts:96-104`  | **YES**                                  | M6 (delete plugins block) → RED on 3 tests                                                                                                                                                                                                                                                        |
| 14  | Default-denies unstable Effect APIs except the one proven edge                                                                      | `scripts/effect-resolution.test.ts:106-118` | **YES for 6 keys**                       | M2 and M9 → RED; 13 other keys unguarded (see section 6)                                                                                                                                                                                                                                          |
| 15  | Does not relax the global-I/O rules the main process needs                                                                          | `scripts/effect-resolution.test.ts:120-126` | **YES**                                  | asserts `nodeBuiltinImport`/`globalConsole` === `off`; flipping either to `error` → RED                                                                                                                                                                                                           |
| 16  | "Effect 4 lives in the main process only"                                                                                           | `AGENTS.md:290-292`                         | **PARTLY**                               | true of dependencies (`effect` is a runtime dep of apps/desktop only); true of imports in shipped code (native.ts only); but the renderer **typecheck accepts** a stray `effect` import (root `node_modules/effect` resolves from every workspace) — the boundary rests on arch-check alone       |
| 17  | "arch-check rejects any `effect*` specifier under packages/, apps/renderer/ and preload/"                                           | `AGENTS.md:291`                             | **YES as written; NO for `@effect/*`**   | `EFFECT_SPECIFIER = /^effect(?:\/\|$)/` implements exactly the glob `effect*`; verified it catches bare `effect` in preload; verified it passes `@effect/vitest` in renderer and `@effect/schema` in packages/shared (exit 0)                                                                     |
| 18  | "Every `ipcMain` handler still ends in one `runPromise`"                                                                            | `AGENTS.md:292-293`                         | **NO — overstated**                      | only `native.ts:113`; the 7 handlers at `main.ts:28-54` are plain `async`/`Promise.resolve`; `runPromise` occurs exactly once in the desktop tree                                                                                                                                                 |
| 19  | "every bridge return type stays structuredClone-safe (asserted in packages/shared/test/ipc.test.ts)"                                | `AGENTS.md:293-294`                         | **PARTLY**                               | four hand-picked cases (`ipc.test.ts:15-42`), not the 8 `AzdoBridge` methods (`packages/shared/src/ipc.ts:21-30`)                                                                                                                                                                                 |
| 20  | Read the pinned effect's AGENTS.md / ai-docs, never effect.website                                                                  | `AGENTS.md:295-298`                         | **NO — advisory only**                   | no gate checks this; `node_modules/effect/AGENTS.md` and `ai-docs/` do exist (research doc line 92), so the advice is actionable, just unenforced                                                                                                                                                 |
| 21  | "`tsconfig.base.json` enforces the Effect rules via `tsc-rs` … so an unstable or experimental module import fails `pnpm typecheck`" | `AGENTS.md:298-300`                         | **YES**                                  | precisely true: apps/desktop is in `pnpm typecheck`'s fan-out and the TS377136 reproduction was in that workspace                                                                                                                                                                                 |
| 22  | "Import-boundary guard … fails on packages→apps imports, renderer→electron imports, and React in process code"                      | `README.md:94-95`                           | **INCOMPLETE — omits the Effect rule**   | the rule exists (`architecture-check.ts:78`) and works; README simply does not list it                                                                                                                                                                                                            |
| 23  | Single toolchain: vite.config.ts is the declarative source, do not split into .oxlintrc.json / Makefile                             | `README.md:85-89`, `AGENTS.md:311-314`      | **NO gate found**                        | no test asserts the absence of `.oxlintrc.json`; enforced by review only (and by the exception for `.oxlintrc.complexity.json`)                                                                                                                                                                   |
| 24  | Catalog-only versioning; never pin a literal that exists in the catalog                                                             | `README.md:90-93`, `AGENTS.md:309-310`      | **PARTLY**                               | `effect-resolution.test.ts` pins `effect`; knip covers unused/undeclared deps; no general test enforces the rule across all packages                                                                                                                                                              |

Count: 13 fully enforced, 6 partly, 5 not. The five "not" are 4, 18, 20, 22, 23 — of which 4 and 18 are
wrong rather than merely advisory, and 22 is an omission.

## 6. Task 2e — are the machine tests real gates or decorative?

**Real gates, with a specific and surprising blind spot.** I did not reason about this; I ran it.

Baseline in a sandbox copy (`git archive HEAD`, symlinked `node_modules`):
`2 test files, 12 tests, all passing`. Then I mutated the copy and re-ran.

| #   | Mutation                                                                 | Result                                                        |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| M1  | `apps/desktop/package.json` typecheck `tsc-rs --noEmit` → `tsc --noEmit` | **RED** — `typechecks apps/desktop/package.json with tsc-rs`  |
| M2  | `unstableApiUsage: "error"` → `"warning"`                                | **RED** — `default-denies unstable Effect APIs…`              |
| M3  | `preferSchemaOverJson: "error"` → `"off"`                                | **GREEN — GAP**                                               |
| M4  | catalog `"effect": 4.0.4` → `^4.0.4`                                     | **RED** — two tests (pin shape + one-copy)                    |
| M5  | root typecheck `vp run -r typecheck` → `tsc-rs --noEmit -b .`            | **RED** — `fans the root typecheck out…`                      |
| M6  | entire `plugins` block deleted from tsconfig.base.json                   | **RED** — three tests (declaration, default-deny, global-I/O) |
| M7  | `namespaceImportPackages` deleted from the plugin                        | **GREEN — GAP**                                               |
| M8  | `typecheck:all` `tsc-rs -p scripts/tsconfig.json` → `tsc -p …`           | **RED** — two tests                                           |
| M9  | `allowedUnstableApis: ["@effect/vitest"]` → `[]`                         | **RED** — `default-denies unstable Effect APIs…`              |

Seven of nine go red, and the two that do not (M3, M7) are exactly the blind spots. Answering the
packet's two specific hypotheses directly: **a workspace typecheck reverting to plain `tsc` goes RED
(M1), and the stability severity being downgraded goes RED (M2).**

I then swept all 19 rule keys twice each (severity → `warning`, then key deleted):

| Key                            | sev→warning | key deleted |
| ------------------------------ | ----------- | ----------- |
| anyUnknownInErrorContext       | RED         | RED         |
| leakingRequirements            | RED         | RED         |
| nodeBuiltinImport              | RED         | RED         |
| globalConsole                  | RED         | RED         |
| unstableApiUsage               | RED         | RED         |
| experimentalApiUsage           | RED         | RED         |
| deterministicKeys              | GREEN       | RED*        |
| unsafeEffectTypeAssertion      | GREEN       | GREEN       |
| instanceOfSchema               | GREEN       | GREEN       |
| missingEffectServiceDependency | GREEN       | GREEN       |
| globalErrorInEffectCatch       | GREEN       | GREEN       |
| globalErrorInEffectFailure     | GREEN       | GREEN       |
| unknownInEffectCatch           | GREEN       | GREEN       |
| **preferSchemaOverJson**       | **GREEN**   | **GREEN**   |
| cryptoRandomUUID               | GREEN       | GREEN       |
| globalDate                     | GREEN       | GREEN       |
| globalTimers                   | GREEN       | GREEN       |
| globalFetch                    | GREEN       | GREEN       |
| globalRandom                   | GREEN       | GREEN       |

\* the `deterministicKeys` deletion RED is an artifact: removing the final key leaves a dangling
comma, so the test fails with `SyntaxError: Expected double-quoted property name in JSON`, not with
an assertion. It is not a real guard — I confirmed the SyntaxError message directly.

So **6 of 19 keys are genuinely guarded; 13 are not**, and the unguarded set includes the rule most
likely to be triggered in practice. This is the single most actionable finding of the review.

One further note on the tests' shape, because it affects how much the green means: both suites are
**configuration-text assertions**, not behavioural ones. They read `package.json`,
`pnpm-workspace.yaml`, `vite.config.ts` and `tsconfig.base.json` and assert on the parsed values.
Nothing in either suite runs a compiler and asserts that a diagnostic is produced. That is a
defensible design for a toolchain guard (it is fast and deterministic), but it means the tests verify
the _configuration_, and the configuration's _effect_ is verified only by whatever agent happens to
run the typecheck. The strongest available behavioural guard in the repo is
`scripts/toolchain.test.ts`'s assertion that the `typecheck:all` command actually contains
`tsc-rs -p scripts/tsconfig.json` — an indirect proof that the compiler is wired, not that it bites.

I verified the bite myself, which is what lets me call the overall configuration genuine rather than
merely tidy: five distinct TS377xxx diagnostics (026 preferSchemaOverJson, 030
anyUnknownInErrorContext, 067 globalDateInEffect, 078 cryptoRandomUUID, 001 floatingEffect, 136
unstableApiUsage — six, in fact) all fire as errors under the shipped `tsconfig.base.json`, and a
control file produces none of them under plain `tsc` 7.0.2. Notably `floatingEffect` fires as
`error TS377001` **without being configured at all** — which means the council research doc's
"load-bearing condition" (line 150-153, `floatingEffect: "error"`, "Adoption is void without it") is
in fact satisfied, just by the compiler default rather than by an explicit key. That is worth
recording, because a future reader of the research doc will otherwise conclude the gate is missing.

## 7. Task 2f — what is now STALE relative to the council research doc

The research doc (`2026-10-13-research-adopt-effect-4.md`, consensus WARN) recommends
`@effect/tsgo@0.51.1` **by name**. The shipped implementation uses `tsc-rs@0.6.0` instead. Where the
doc and the code disagree:

| Research doc says                                                                                                                                                    | Shipped implementation                                                                                                                                                  | Assessment                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Line 150: "Ship `@effect/tsgo@0.51.1` as a blocking pre-push gate"                                                                                                   | `tsc-rs@0.6.0` with built-in 377xxx; `node_modules/tsc-rs/README.md:31-44`: "The rules, options and `@effect-diagnostics` comments are a port of Effect-TS/tsgo 0.51.1" | **Substantively met.** Same rule set, newer port (installed `tscVersion` 7.1.0-dev vs upstream's 0.4.0). Only the named mechanism differs. Nothing in the repo records this substitution — the closest is `toolchain.test.ts:1-9`, which argues the tsc/tsc-rs split but never mentions tsgo. |
| Line 150-151: `allowedUnstableApis: []`, `allowedExperimentalApis: []`                                                                                               | `allowedExperimentalApis: []` ✓; `allowedUnstableApis: ["@effect/vitest"]`                                                                                              | **Deliberate reversal, well-evidenced.** Justified at `tsconfig.base.json:42-45` and proven by `effect-bridge.test.ts:18-20`, which asserts `Vitest.TestRunner === VitePlusTest.TestRunner` — object identity, not a `typeof` check. I accept this reversal. The doc is stale on it.          |
| Line 152-153: `floatingEffect: "error"` … "Adoption is void without it"                                                                                              | Not configured in the map                                                                                                                                               | **Condition is met anyway.** `error TS377001: effect(floatingEffect)` fires unconfigured. Stale in the doc, satisfied in fact.                                                                                                                                                                |
| Line 154-157: "Do not adopt `@effect/vitest`" (#6129 closed not planned)                                                                                             | Adopted (`apps/desktop/package.json:26`)                                                                                                                                | **Reversal, evidenced** as above. Stale in the doc.                                                                                                                                                                                                                                           |
| Line 158-162: exclude `@effect/platform-node` and `effect/http`'s Node client                                                                                        | No such dependency; `namespaceImportPackages` omits platform-node                                                                                                       | **Met.**                                                                                                                                                                                                                                                                                      |
| Line 139-144: scope `apps/desktop/src/**` only; convert `native.ts` first, then the ADO REST client, then `main.ts` handlers, each ending in one `Effect.runPromise` | `native.ts`'s `probeOpenBus`/`probeDbus` converted (`native.ts:60-119`); `main.ts` handlers still plain `async`                                                         | **Partially met, and the doc's phrasing is now wrong in AGENTS.md too** — see finding F4. This is not a defect against the _target_ (the target is the toolchain setup, not the migration), but it is a staleness in the prose.                                                               |
| Line 145-149: zero Effect in renderer / preload / shared; keep Zod at the boundary                                                                                   | `packages/shared` and `apps/renderer` declare nothing Effect; `effect` is a runtime dep of `apps/desktop` only; arch-check has the rule                                 | **Met**, with the caveat in F5 that the enforcement is one regex.                                                                                                                                                                                                                             |
| Line 163-169: three artifacts — arch-check rule, a structuralClone spec over each shared schema, an AGENTS.md note pointing at `node_modules/effect/AGENTS.md`       | arch-check rule ✓; AGENTS.md note ✓ (`AGENTS.md:295-298`); structuralClone spec shipped as four hand-picked cases ✗                                                     | **2 of 3 met.**                                                                                                                                                                                                                                                                               |

The single most consequential staleness: a reader following the doc literally will search for
`@effect/tsgo`, fail to find it, and conclude the load-bearing gate is absent. It is not absent — it
is inside the compiler, which is the stronger arrangement. The doc should say so.

## 8. Verdict

**WARN**, confidence **HIGH**.

The target question is "has the Effect 4 + tsc-rs setup used upstream in t3code been configured in
this repo?" — and on the substance the answer is yes, more strongly than upstream in the two places
that matter most (the stability rules are `error` here and `off` upstream, and the exact-pin catalog
rule is enforced by a test). It is not decorative: I reproduced six TS377xxx diagnostics firing under
the shipped config and seven of nine dismantling mutations going red.

But "at least equivalent to upstream" is not true of the rule map — 13 of 24 error rules are weaker
or absent — and four of the documented invariants are wrong or overstated in the docs that every
agent in this repo reads first. The gaps are all fixable, and three of them are small: a one-character
regex widening, a frozen-object assertion in an existing test, and a comment rewrite. That profile is
WARN, not PASS, and it is not FAIL because nothing that matters is unenforced or broken.
