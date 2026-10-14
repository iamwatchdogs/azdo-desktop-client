```json
{
  "judge": "judge-1",
  "verdict": "WARN",
  "confidence": "HIGH",
  "revised_from": "WARN",
  "key_insight": "The consensus holds, but the risk model is wrong in one direction and one rule was never audited. Wrong direction: the setup is STRONGER than the rule map implies - I verified floatingEffect fires as error TS377001 completely unconfigured, and an invalid rule key emits warning TS377134, so the 19 configured keys are all recognized and the map cannot silently typo. Never audited: the council applied its adversarial technique to the Effect rule in scripts/architecture-check.ts and never re-ran it against the sibling React rule in the same file, which has the identical structural gap - inMainProcess at :55 excludes apps/desktop/src/native.ts, definitively process code, and a React import there passes arch-check with exit 0, masked today by exactly the same incidental 'not declared' fact that masks the Effect boundary. And the highest-severity doc defect was missed by all three judges: README.md:47 instructs every reader that pnpm typecheck runs `tsc --noEmit` when the compiler is tsc-rs, which hands an agent the exact silent-green-lie the whole guard suite exists to prevent.",
  "findings": [
    {
      "severity": "significant",
      "description": "README.md:47 documents `pnpm typecheck` as running \"`tsc --noEmit` per workspace (TypeScript 7 native)\". The compiler is `tsc-rs` (Rust port, catalog 0.6.0) in all four paths - apps/desktop/package.json:12, apps/renderer/package.json:10, packages/shared/package.json:11 and vite.config.ts:241. Verified verbatim in the command table. This is not a stale adjective: `npx tsc --noEmit -p apps/desktop/tsconfig.json` exits 0 with zero diagnostics on an unstable `effect/http` import, because plain tsc drops the plugins array entirely. The one document an agent reads before running anything names the exact compiler the entire toolchain.test.ts guard exists to keep out.",
      "fix": "Change README.md:47 to `tsc-rs --noEmit` per workspace (TypeScript 7 native, Rust port). This is the single highest-value edit in the whole review and costs one word.",
      "why": "AGENTS.md tells agents to read local docs \"not the web\", so a wrong local doc is the operative spec. scripts/toolchain.test.ts:5-8 states the failure mode in its own words - \"a workspace or script that falls back to `tsc` silently loses every TS377xxx gate while still exiting green\" - and the top-level command table invites precisely it.",
      "ref": "README.md:47"
    },
    {
      "severity": "significant",
      "description": "`cryptoRandomUuid: \"error\"` at tsconfig.base.json:57 is misaimed. The rule engine routes in-Effect usage to a separate key, `cryptoRandomUuidInEffect`, which is omitted from the 19-key map and therefore defaults to non-error. Verified empirically in R1 and independently corroborated by Judge 3: `crypto.randomUuid()` at module scope yields `error TS377078 ... effect(cryptoRandomUuid)`; the identical call inside `Effect.sync(() => crypto.randomUuid())` yields NO diagnostic; adding `cryptoRandomUuidInEffect: \"error\"` yields `error TS377079 ... effect(cryptoRandomUuidInEffect)`. There are zero `crypto.randomUuid()` calls anywhere in `apps/`, `packages/` or `scripts/`, so the configured rule guards an empty set while the context it exists for is unguarded.",
      "fix": "Add `\"cryptoRandomUuidInEffect\": \"error\"` and audit every paired `X` / `XInEffect` key in the map for the same inversion, or delete `cryptoRandomUuid: \"error\"` so the config stops implying a guard it does not provide.",
      "why": "A rule that reads as enforced and is silent in the only context that matters is an enforcement defect, not a prose one. tsconfig.base.json:69-71 claims \"anything else fails the typecheck instead of breaking silently\"; this rule breaks silently by construction.",
      "ref": "tsconfig.base.json:57"
    },
    {
      "severity": "significant",
      "description": "The Effect import boundary is enforced by exactly one regex and by nothing else, and the regex has a hole. EFFECT_SPECIFIER = /^effect(?:\\/|$)/ (scripts/architecture-check.ts:42, applied at :78) covers bare `effect` and its subpaths only; it returns false for every `@effect/*` specifier. Verified end-to-end: a fixture `import { Schema } from \"@effect/language-service/schema\"` placed in packages/shared/src produced `architecture-check: ok (38 files)` and exit 0, while the bare-`effect` control produced `1 violation(s)`. The lead has now independently confirmed the other half of the risk model: `require.resolve('effect/package.json')` succeeds from both apps/renderer and packages/shared via the root symlink, and `npx tsc-rs --noEmit -p apps/renderer/tsconfig.json` exits 0 with zero diagnostics on a bare `effect` import in the renderer. So arch-check is the ONLY barrier for the entire Effect boundary, and it has the hole. Meanwhile AGENTS.md:290-291 claims arch-check \"rejects any `effect*` specifier\".",
      "fix": "Widen to /^@?effect(?:\\/|$)/ and add an `@effect/*` fixture to scripts/architecture-check.test.ts, whose four existing fixtures all use the bare specifier. Optionally back it at the manifest level by asserting that no `effect`/`@effect/*` entry is declared by apps/renderer or packages/shared.",
      "why": "The bridge is the one boundary whose failure destroys data silently - structuralClone strips the prototype getters and symbol keys behind an Effect, so a bridged tagged error crosses as a bare {} and throws DataCloneError. A single point of failure with a known hole in it is not 'materiality not met'.",
      "ref": "scripts/architecture-check.ts:42,78; AGENTS.md:290-291"
    },
    {
      "severity": "moderate",
      "description": "The entire `*InEffect` rule family is omitted, so Effect code is unguarded for every global-I/O surface where upstream sets `error`. Omitted upstream-`error` keys (7): schemaSyncInEffect, cryptoRandomUuidInEffect, globalDateInEffect, globalConsoleInEffect, globalRandomInEffect, globalTimersInEffect, globalFetchInEffect. Verified empirically with the repo's exact map: inside `Effect.sync`, `Date.now()`, `console.log`, `setTimeout`, `fetch`, `Math.random()` and `require(\"node:fs\")` all produce ZERO diagnostics, while adding `globalDateInEffect: \"error\"` produces TS377067 and `globalConsoleInEffect: \"error\"` produces TS377065. The non-Effect half IS justified by real usage - apps/desktop/src/native.ts:77 legitimately calls `setTimeout` inside an `Effect.callback`, and upstream would reject that file outright - so the six `off` values at tsconfig.base.json:63-68 are a defensible deliberate call. The gap is specifically the missing in-Effect counterparts.",
      "fix": "Add the seven `*InEffect` keys as `\"error\"` while keeping the base rules `off`. That keeps main.ts and native.ts's callback plumbing legal while making genuinely impure code inside Effect.gen / Effect.sync fail.",
      "why": "This is the largest single divergence from the t3code baseline and it lands on exactly the surface the Effect rules exist to police. It is invisible today only because the one Effect source file does not trip it.",
      "ref": "tsconfig.base.json:47-77"
    },
    {
      "severity": "moderate",
      "description": "The guard suite is real but partial in a way that matters, and no judge tested it in R1 - Judge 3 did, and I reproduced it independently. Mutation M3: `preferSchemaOverJson: \"error\"` -> `\"off\"` in tsconfig.base.json leaves all 16 guard tests across toolchain.test.ts, effect-resolution.test.ts and architecture-check.test.ts GREEN. A four-key mutation (cryptoRandomUuid -> off, instanceOfSchema -> warning, deterministicKeys -> off, and leakingRequirements deleted entirely) turns exactly one test red - and only because that test also asserts the stability pair. So roughly 6 of the 19 configured rule keys are actually guarded, and the unguarded set includes preferSchemaOverJson, the single highest-yield rule in practice, which fires on any JSON.parse inside an Effect. I ran this in a `git archive HEAD` sandbox outside the repo with a symlinked node_modules; no tracked file was touched.",
      "fix": "Replace the per-key assertions in scripts/effect-resolution.test.ts:106-126 with a frozen full-map assertion - capture `diagnosticSeverity` and `expect(severities).toEqual(FROZEN_EXPECTED)` - plus `expect(namespaceImportPackages).toEqual([\"effect\"])`. One assertion covers all 19 keys and fails loudly on any drift, including typos.",
      "why": "preferSchemaOverJson being downgraded to off is a one-line change that every gate in this repo waves through, and it is the rule most likely to be annoyed by first. The suite looks authoritative - 16 green tests - which is precisely why the partial coverage is dangerous.",
      "ref": "scripts/effect-resolution.test.ts:106-126"
    },
    {
      "severity": "moderate",
      "description": "BLIND SPOT all three judges missed: the React boundary rule in the same guard has the identical structural gap, and the council never re-ran its own technique against it. `inMainProcess = relativePath.startsWith(\"apps/desktop/src/main\") || inPreload` (scripts/architecture-check.ts:55) - so the React rule applies only to files under apps/desktop/src/main/ and to preload. apps/desktop/src/native.ts is definitively process code: it is imported by main.ts:14 and bundled through the `entry: [\"src/main.ts\"]` build at apps/desktop/vite.config.ts:38, and it contains the keychain/dbus/ffi lazy imports. Appending `import * as React from \"react\"; export const __probeReact: unknown = React;` to native.ts produced `architecture-check: ok (35 files)` with exit 0. AGENTS.md:277 documents \"process code (`main` / `preload`) never imports React\" and the parenthetical is being read as a definition of process code, but native.ts is process code and is excluded.",
      "fix": "Define process code once, structurally, instead of by two path prefixes - e.g. every file reachable from the `src/main.ts` entry plus preload, or at minimum `apps/desktop/src/**` excluding the renderer subtree - and add a fixture asserting a React import in native.ts is rejected.",
      "why": "The gap is masked today by exactly the same incidental fact that masked the Effect boundary: `react` is not a declared dependency of apps/desktop, so knip's `unlisted` check and TS2307 both fire (I verified both). Adding `react` to apps/desktop for a React-based settings window - a plausible Electron feature - makes the gap live with no gate catching it. The audit was scoped to Effect and never tested the sibling rule in the same file.",
      "ref": "scripts/architecture-check.ts:55; apps/desktop/src/native.ts"
    },
    {
      "severity": "moderate",
      "description": "The editor/LSP parity gap is not closable by a tsdk pointer, which makes Judge 2's proposed remedy unactionable. Judge 2 correctly diagnoses that the JS plugin lacks the stability rules and correctly notes no tsdk pointer is documented anywhere (I verified: zero hits for `tsdk`, `.vscode` or `language-service` in README.md and AGENTS.md, and `.vscode/` is gitignored at .gitignore:35). But the suggested fix - point `js/ts.tsdk.path` at `node_modules/@tsc-rs/<platform>/lib`, per tsc-rs README:46-57 - cannot work: that directory contains only `lib.*.d.ts` files and a single 44 MB native `tsc` executable, with zero `.js` files; the platform package's `exports` is `{\"./package.json\"}` only and its `bin` is undefined; and a recursive search of the entire tsc-rs tree finds no `tsserver` anywhere. A tsdk directory must contain a spawnable `tsserver.js`.",
      "fix": "Do not document a tsdk pointer. Instead state plainly in AGENTS.md or README that the TS377135/377136 stability diagnostics are visible only through the push gate, and make the doc fix at README.md:47 load-bearing precisely because the editor gives no signal.",
      "why": "The gap is worse than 'point it elsewhere': there is currently no path to editor visibility for these rules at all. That raises the weight of the documentation fixes, because the typecheck is the only signal anyone gets - and README.md:47 currently misdescribes that one signal.",
      "ref": "node_modules/tsc-rs/README.md:46-57"
    },
    {
      "severity": "moderate",
      "description": "The comment justifying the six `off` global rules is factually wrong in two independent ways (Judge 3's finding, which I verified). tsconfig.base.json:58-62 reads: \"The main process entrypoint and dev scripts are plain imperative tooling by design: main.ts must stay dependency-free so a logging failure can never take down the handler that reports it. The Effect idiom rules therefore only bite inside Effect code, where the structural rules above do the real work.\" First, \"main.ts must stay dependency-free\" is literally false - main.ts:1-14 imports node:path, @ado/shared, electron, electron-store, electron-updater and ./native. Second, \"the Effect idiom rules therefore only bite inside Effect code\" is backwards for the bare `global*` family, which I established fires on NON-Effect code: `crypto.randomUuid()` in a plain function yields error TS377078. The bare family and the `*InEffect` family have opposite scoping, and one sentence cannot describe both.",
      "fix": "Rewrite to state the real reason and the real cost: the global rules are off because main.ts must keep reporting errors when everything else has failed, so its console.warn and node:path usage is exempt; the Effect-side equivalents are governed by the separate `*InEffect` keys, which are currently omitted - so close that pairing deliberately rather than by default.",
      "why": "A rationale that does not describe the code it justifies cannot be reviewed. The next agent reading \"the Effect idiom rules only bite inside Effect code\" will conclude the opposite of the truth and either re-enable the wrong rules or trust the wrong ones. This means the decision to turn the six off has never actually been argued on its merits.",
      "ref": "tsconfig.base.json:58-62"
    },
    {
      "severity": "moderate",
      "description": "AGENTS.md:292-293 overstates the implementation: \"Every `ipcMain` handler still ends in one `runPromise`\" is false. `runPromise` occurs exactly once in the entire desktop source tree, at native.ts:113. The handlers registered at main.ts:28-54 (appVersion, getSettings, setSettings, getSecret, setSecret, accessibilityCheck, ffiProbe) are plain `async` functions. The neighbouring claim that \"every bridge return type stays structuredClone-safe\" is likewise asserted for four hand-picked cases in packages/shared/test/ipc.test.ts, not for the eight AzdoBridge methods declared at packages/shared/src/ipc.ts:21-30.",
      "fix": "Soften the sentence to what is true - \"the Effect boundary terminates in exactly one runPromise, at native.ts:113, which returns a plain serializable value\" - or close the gap by iterating the AzdoBridge method names in a structuredClone round-trip spec.",
      "why": "AGENTS.md is written as a list of machine-enforced invariants and is the first file every agent in this repo reads. An agent relying on \"every handler ends in one runPromise\" will write a new handler assuming a convention that is not in force.",
      "ref": "AGENTS.md:292-294"
    },
    {
      "severity": "minor",
      "description": "Three low-cost guard gaps confirmed from other judges. (a) scripts/toolchain.test.ts:28-32 enumerates WORKSPACES as a hard-coded array of three, while pnpm-workspace.yaml:1-3 and `vp run -r` discover new packages by glob - a fourth workspace whose tsconfig forgets `extends tsconfig.base.json`, or re-declares `plugins`, silently loses the entire 19-rule map while every gate stays green. (b) Nothing asserts that `tsc-rs` is a declared dependency, even though all four typechecks are single-word shell invocations resolving it from PATH as a root-only devDep; knip does not check binaries. (c) README.md:94-95 lists the arch-check failure modes as packages->apps, renderer->electron and React-in-process-code, omitting the Effect rule that architecture-check.ts:78 actually enforces.",
      "fix": "Assert by discovery rather than by list for (a); extend toolchain.test.ts to assert the root manifest declares tsc-rs for (b); add the Effect clause to README.md:94-95 for (c).",
      "why": "All three are one-assertion or one-clause fixes that close the paths by which the configuration erodes silently as the repo grows - which is the failure mode this whole guard suite exists to prevent.",
      "ref": "scripts/toolchain.test.ts:28-32; README.md:94-95"
    },
    {
      "severity": "minor",
      "description": "`namespaceImportPackages` narrows upstream's [\"@effect/platform-node\", \"effect\"] to [\"effect\"]. Inert today: no @effect/platform-* dependency exists anywhere in the tree, and Judge 3 verified in both directions that listing the package while it is uninstalled produces no error, no warning and no diagnostic of any kind - there is no resolution-time validation of the list. Harmless, but the safety is a coincidence of the current dependency set rather than a design decision.",
      "fix": "No change needed while the dependency set stays at `effect` + `@effect/vitest`. Record the reasoning so the next dependency addition is a decision rather than an accident.",
      "why": "The narrowing is safe only because the dependency set is small; nothing would remind anyone to revisit it if @effect/platform-* were ever added (which unstableApiUsage would block first, so the risk is theoretical).",
      "ref": "tsconfig.base.json:41"
    }
  ],
  "recommendation": "WARN unchanged, confidence HIGH, and the case for WARN is now stronger than in R1 because three of the previously-unexamined directions turned out worse rather than better. Order of work: (1) README.md:47 - one word, `tsc` -> `tsc-rs`, because it is the only doc that invites the silent-green-lie every other guard exists to prevent and the editor gives no compensating signal. (2) Widen EFFECT_SPECIFIER to /^@?effect(?:\\/|$)/ and add an `@effect/*` fixture; arch-check is the ONLY barrier for the Effect boundary now that the lead has confirmed the isolated-linker mask does not exist. (3) Fix the cryptoRandomUuid inversion and add the seven `*InEffect` keys while deliberately keeping the base globals `off` - native.ts:77 proves the `off` half is a real decision. (4) Replace the per-key assertions in effect-resolution.test.ts with one frozen full-map assertion; I reproduced that a four-key mutation leaves all 16 guard tests effectively green. (5) Audit the sibling React rule in architecture-check.ts against the same technique - native.ts passes a React import today, masked by the same 'not declared' accident that masks Effect. (6) Rewrite the tsconfig comment at :58-62, which is wrong on both of its factual claims. (7) Correct the two AGENTS.md overstatements (runPromise, structuredClone) and add the Effect rule to README.md:94-95. Do NOT add `@effect/tsgo` or `effect-tsgo patch` - E4 and Judges 2 and 3 are all right, and tsc-rs carries the 377xxx codes natively, which I fired myself. In fairness to the implementation: two things are better than the rule map suggests and should be recorded as strengths, not gaps - `floatingEffect` fires as error TS377001 completely unconfigured (verified), and an unrecognized rule key emits warning TS377134 (verified), so the map cannot silently typo.",
  "debate_notes": {
    "devils_advocate": "The strongest PASS case, at full strength: every question the target actually asks is answered yes and answered by machine gates I re-ran green. The compiler is tsc-rs in all four typecheck paths with no bare tsc in the task graph; the plugin resolves in five of five tsconfigs and none shadows it; all four typechecks exit 0; 16 guard tests and 9 desktop tests pass; arch-check and knip are clean. On the two rules that matter most this repo is STRICTER than upstream, not laxer - unstableApiUsage and experimentalApiUsage are `error` here versus `off` in t3code, which is the whole point of the exercise, and I fired both (TS377136 on effect/http/HttpServerRequest#fromWeb, TS377135 on effect/net/Dns) to prove they bite. Two upstream rules are in force for free and nobody asked for them: floatingEffect fires as error TS377001 unconfigured, and an unrecognized rule key emits warning TS377134, so the 19 configured keys are all genuine and the map cannot silently typo. The mechanism is newer and architecturally better than the baseline - tsc-rs's native 377xxx port instead of patching the plain `typescript` package, which would be patching a compiler this repo never invokes. `effect` is exact-pinned 4.0.4 with exactly one installed copy across every workspace, precisely because two copies means two module instances and a Layer built against one is rejected by the other. The `@effect/vitest` allowlist is load-bearing, not decorative: I removed it in a scratch config and the repo's own test files stopped compiling. Every WARN finding reduces to documentation or guard-coverage, not enforcement - and by the packet's own criteria, the materiality bar for WARN (\"material gaps ... that need action\") is arguably not met: the `@effect/*` hole is unexploited today because no @effect package is reachable from the renderer or shared; six of the weakened rules are explicitly justified by an in-file rationale and used by real code; the missing overrides block currently costs nothing, which Judge 3 proved by enumerating every test file and finding zero JSON.parse inside an Effect; and 13 of my own R1 findings were one-assertion fixes. Calling that WARN over-warns and teaches the team to discount the verdict.",
    "devils_advocate_rebuttal": "The devil's advocate is right about the substance and wrong about the consequence, for four reasons. (1) The cryptoRandomUuid inversion is not a documentation issue: a rule that reads as enforced and is silent in the only context that matters is an enforcement defect, and it is the exact failure mode tsconfig.base.json:69-71 claims to prevent - \"anything else fails the typecheck instead of breaking silently\". It guards an empty set. (2) With the lead's confirmation that the isolated-linker mask does not exist, arch-check is the ONLY barrier for the entire Effect boundary, and it has a hole; a single point of failure with a known hole is not 'unexploited today', it is one dependency declaration away, as the React analogue in the same file demonstrates. (3) README.md:47 is not an adjective: `npx tsc --noEmit -p apps/desktop/tsconfig.json` exits 0 on an unstable import, so the doc hands an agent a command that silently disables every gate - in a repo whose AGENTS.md instructs agents to read local docs and not the web, and where I have now established there is no editor signal to compensate. (4) The guard suite's 16 green tests are partly cosmetic in exactly the place that matters: I reproduced that a four-key mutation to the rule map leaves all 16 green. A suite that looks authoritative but does not cover the highest-yield rule is worse than no suite, because it buys false confidence. WARN is the correct calibration: nothing is broken, but four things need action before this is called done.",
    "blind_spot": "The council scoped its adversarial technique to the Effect rule and never re-ran it against the sibling rules in the same guard. `inMainProcess` at scripts/architecture-check.ts:55 gates the React rule on two path prefixes - apps/desktop/src/main and preload - which excludes apps/desktop/src/native.ts, definitively process code (imported by main.ts:14, bundled through the `entry: [\"src/main.ts\"]` build at apps/desktop/vite.config.ts:38). I appended a React import to native.ts and arch-check reported `ok (35 files)` with exit 0. That is the identical structural gap, in the identical file, produced by the identical technique the council used on Effect - and nobody tested it. Second, relatedly: the guard suite has never been mutation-tested by anyone but Judge 3, and when I reproduced the sweep the partial coverage was worse than the green count implies - roughly 6 of 19 rule keys are actually pinned, and the unguarded set includes preferSchemaOverJson, the highest-yield rule. Both blind spots share a root cause: the council audited the configuration the target named, and never asked the same questions of the subsystem that enforces it.",
    "challenges": [
      {
        "target_judge": "judge-3",
        "claim": "E5 is REJECTed on the ground that \"the documented phrase read as a glob means specifiers beginning with `effect` - i.e. `effect` and `effect/...`. EFFECT_SPECIFIER implements exactly that. `@effect/vitest` is a different scoped package name and does not begin with `effect`, so E5's own regex table demonstrates the code matching the doc, not the doc exceeding the code.\"",
        "response": "Over-confident and internally contradicted. The reading is only available if you ignore the sentence's subject. AGENTS.md:290-291 reads: \"**Effect 4 lives in the main process only** (`effect`, t3code-style). It never crosses the bridge (`arch-check` rejects any `effect*` specifier ...)\". The guarantee on offer is about Effect crossing the bridge; `@effect/vitest`, `@effect/schema` and `@effect/platform-*` are Effect packages whose values are destroyed by structuredClone exactly as bare `effect`'s are. The `(`effect`, t3code-style)` parenthetical names the mechanism, it does not narrow the guarantee. Judge 3's own invariant table row 17 concedes precisely this, printing \"YES as written; NO for `@effect/*`\" - which cannot be reconciled with a REJECT label. And the practical harm of the label is real: it frames a one-character regex widening, closing a hole in the app's central architectural boundary, as a semantic quibble about glob semantics. Judge 3 does go on to carry the substance as its own findings, so we agree on the technical hole completely; the disagreement is about labeling and urgency, and on those the REJECT is wrong."
      },
      {
        "target_judge": "judge-3",
        "claim": "\"13 of upstream t3code's 24 error-severity rules are absent or weakened\" - stated in the key_insight and again in finding 1.",
        "response": "Arithmetic slip; the number is 14. Judge 3's own decomposition table says 7 present-but-weakened (6 globals to off, deterministicKeys to warning) plus 7 omitted entirely. I recomputed from the upstream map quoted in the packet: 30 keys total, 24 at error and 6 at off; the repo's 19 keys decompose as 10 identical to upstream, 2 stricter (unstableApiUsage, experimentalApiUsage), 7 weakened, and 7 upstream-error keys dropped; the 11 keys not carried over are the 4 that were upstream-`off` plus those 7. So 7 weakened + 7 omitted = 14, not 13. The conclusion is unaffected and the direction of the finding is right, but the figure is quoted twice and feeds the severity framing, so it should be corrected. Worth noting the correct number is more unfavourable to the config, not less - which is the opposite of the usual direction of an arithmetic slip."
      },
      {
        "target_judge": "judge-2",
        "claim": "The editor parity fix: \"Document in AGENTS.md/README: point the editor at `node_modules/@tsc-rs/<platform>-<arch>/lib` (tsc-rs README's own VS Code section).\"",
        "response": "The diagnosis is right and well-evidenced - the @effect/language-service JS bundle genuinely lacks unstableApiUsage, experimentalApiUsage, allowedUnstableApis, allowedExperimentalApis, 377135 and 377136, and no tsdk pointer exists anywhere in the docs - but the remedy is not actionable. `node_modules/.pnpm/@tsc-rs+darwin-arm64@0.6.0/node_modules/@tsc-rs/darwin-arm64/lib` contains only `lib.*.d.ts` files and a single 44 MB native `tsc` executable, with zero `.js` files; that package's `exports` is `{\"./package.json\"}` only and its `bin` is undefined; and a recursive search of the whole tsc-rs tree finds no `tsserver` anywhere - `dist/vscode/` holds extensionApi.js, moduleLoader.js and protocol.generated.js, the building blocks of an extension rather than a spawnable language service. A `js/ts.tsdk.path` directory must contain a `tsserver.js` for the TypeScript extension to spawn. The correct conclusion is more adverse than Judge 2's: there is presently no path to editor visibility for these rules at all, so the typecheck is the only signal anyone gets - which is exactly why the README.md:47 doc defect matters more than Judge 2 already argued, and why the fix should be to say so in the docs rather than to point tsdk somewhere that cannot work."
      }
    ],
    "acknowledgments": [
      {
        "source_judge": "judge-3",
        "point": "`floatingEffect` fires as `error TS377001` without being configured anywhere in the map, so the council research doc's \"load-bearing condition ... Adoption is void without it\" is satisfied by compiler default rather than by an explicit key.",
        "impact": "Materially strengthens the PASS-facing case and corrects a framing error of mine. I initially probed this with an exported binding and saw nothing, which would have led me to call the claim wrong; a genuinely discarded Effect (`Effect.succeed(42);` as a statement) does fire TS377001. It also means the rule map understates the enforcement: one further upstream rule is in force for free, which partially offsets the 14 weakened or omitted. I recorded it as a strength in my recommendation rather than a gap."
      },
      {
        "source_judge": "judge-3",
        "point": "An unrecognized diagnosticSeverity key emits `warning TS377134: Unknown Effect diagnostic rule`, and the shipped config produces no TS377134 across all four typechecks - so all 19 configured keys are genuine rule names in tsc-rs 0.6.0 rather than silently-ignored typos.",
        "impact": "Verified independently by me with a bogus key. This closes a failure mode I had not considered - that the 19-key map might contain misspelled keys that do nothing - and it is the cheapest possible evidence that the map is not silently rotten. It also gives the frozen-map assertion in my finding 5 a guarantee: a typo in the expected object will be caught by TS377134 as well as by the assertion."
      },
      {
        "source_judge": "judge-2",
        "point": "scripts/toolchain.test.ts:28-32 guards a closed list of three workspaces while pnpm-workspace.yaml's `apps/*` / `packages/*` globs and `vp run -r` discover packages dynamically, so a fourth workspace whose tsconfig fails to extend tsconfig.base.json would silently lose the entire 19-rule map and both stability gates while every gate stayed green.",
        "impact": "A real erosion vector I missed in R1 - I verified both halves (the hard-coded array at toolchain.test.ts:28-32, the globs at pnpm-workspace.yaml:1-3). It generalizes my R1 finding about unasserted configuration: the guard does not merely fail to assert that tsc-rs is declared, it cannot see a workspace that did not exist when it was written. Folded into my revised minor finding."
      },
      {
        "source_judge": "judge-3",
        "point": "The missing upstream `overrides` block currently costs nothing: enumerating every typechecked test and spec file, there are zero `JSON.parse` occurrences inside an Effect, so `preferSchemaOverJson` never fires in a test file in this repo.",
        "impact": "Corrects my R1 framing, where I rated this moderate on the strength of having reproduced TS377026 inside a .test.ts. The reproduction was real but the consequence was latent, not active - the rule fires only inside Effect contexts and no test has JSON.parse inside one. I have demoted this from a standalone finding to a latent divergence, and note that E3's original phrasing overstated it in the same way I did. It remains worth the four-line fix because the ADO REST client is the next planned conversion and will return JSON through an Effect pipeline."
      },
      {
        "source_judge": "judge-3",
        "point": "Both guard suites are configuration-text assertions rather than behavioural ones - they read package.json, pnpm-workspace.yaml, vite.config.ts and tsconfig.base.json and assert on parsed values. Nothing in either suite runs a compiler and asserts a diagnostic is produced.",
        "impact": "This modifies how much weight I put on my R1 statement that \"the guard suite is real, not a taxidermy test\". That statement was correct about the specific assertions I inspected - they are able to fail, and I verified the arch-check and regex ones by exercising them directly - but Judge 3's mutation sweep shows the suite is partial, and my own four-key reproduction confirms it. The honest formulation is: the suite genuinely guards what it guards, and what it guards is about six of nineteen rule keys plus the compiler identity, which is the most important part. The typecheck itself is the behavioural gate, and it runs only at push."
      }
    ]
  }
}
```

# Judge 1 — Round 2: stress-testing the WARN/HIGH consensus

## 1. Restated R1 position (before reading the other judges)

**WARN, confidence HIGH.** The setup is genuinely wired end-to-end and genuinely enforced — not a
paper config. I proved all four load-bearing rules actually fire: `unstableApiUsage` (TS377136 on
`effect/http/HttpServerRequest#fromWeb`), `experimentalApiUsage` (TS377135 on `effect/net/Dns`),
`preferSchemaOverJson` (TS377026 on `JSON.parse` inside `Effect.sync`), and the
`allowedUnstableApis: ["@effect/vitest"]` allowlist itself, which fails the repo's own test files
when removed. WARN rather than PASS on three factual mismatches: `cryptoRandomUuid: "error"` is
misaimed and polices only non-Effect code; the whole `*InEffect` family is omitted so Effect code is
unguarded for Date/console/timers/fetch/random; and arch-check's `/^effect(?:\/|$)/` passes
`@effect/*` imports with exit 0 while AGENTS.md:290-291 claims otherwise — with `arch-check` the
only barrier, since `effect` resolves fine from the renderer and shared workspaces.

I did not change that verdict. Everything below either corroborates it or adds to it.

## 2. What I verified from the other judges

Rather than take their numbers on trust, I re-ran the ones that would move me. All mutations were
done in a `git archive HEAD` sandbox outside the repo with a symlinked `node_modules`, so no tracked
file was touched.

| Claim                                                         | Judge     | My verification                | Outcome                                                                                              |
| ------------------------------------------------------------- | --------- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| README.md:47 says `pnpm typecheck` runs `tsc --noEmit`        | J2        | read README.md:47              | **CONFIRMED, verbatim**                                                                              |
| tsconfig comment "main.ts must stay dependency-free" is false | J3        | read main.ts:1-14              | **CONFIRMED** — imports node:path, @ado/shared, electron, electron-store, electron-updater, ./native |
| `runPromise` occurs exactly once                              | J3        | `rg runPromise apps/desktop`   | **CONFIRMED** — native.ts:113 only                                                                   |
| `floatingEffect` fires unconfigured as TS377001               | J3        | probe in sandbox               | **CONFIRMED**, but only after two attempts (below)                                                   |
| Invalid rule key emits TS377134                               | J3        | bogus key in sandbox           | **CONFIRMED**                                                                                        |
| `preferSchemaOverJson → off` leaves all guards green          | J3        | mutation in sandbox            | **CONFIRMED** — 16/16 green                                                                          |
| Guard coverage is ~6 of 19 keys                               | J3        | four-key mutation              | **CONFIRMED and generalised**                                                                        |
| No tsdk/`.vscode`/`language-service` guidance in docs         | J2        | `rg` over README + AGENTS      | **CONFIRMED** — zero hits                                                                            |
| `toolchain.test.ts` guards a closed WORKSPACES list           | J2        | read toolchain.test.ts:28-32   | **CONFIRMED**                                                                                        |
| Missing `overrides` block currently costs nothing             | J3        | enumerated test files          | **CONFIRMED** — demoted my own R1 finding                                                            |
| `@effect/vitest` unstable exports are real                    | J2        | read dist/index.d.ts           | **CONFIRMED** — `@stability unstable` on `effect` (:170) and `it` (:261)                             |
| Linker mask does not exist                                    | E5 / lead | `require.resolve` with control | **CONFIRMED**, now lead-verified end-to-end                                                          |

Two methodological notes worth recording, because both nearly produced a wrong answer.

**The `floatingEffect` probe needs to be genuinely floating.** My first attempt was
`export const floating = Effect.succeed(1)` — an exported binding, which the rule does not treat as
floating — and produced nothing. I would have called Judge 3 wrong. A statement-form discarded
Effect fires it immediately:

```
float.ts(4,3): error TS377001: This Effect value is neither yielded nor used in an assignment.
```

**A `types: ["node"]` entry without a resolvable `@types/node` silently disables the whole 377xxx
checker.** Judge 3 hit this in a scratch config (`TS2688`) and I hit the same class of failure in
mine. It is worth propagating: anyone debugging this toolchain in a scratch directory should know
that an unresolved `types` entry does not merely add an error, it suppresses every Effect
diagnostic in the program, which looks exactly like "the rules are not firing".

## 3. Devil's advocate — the strongest PASS case, and why it still loses

The full-strength PASS argument is in the JSON. Its core: everything the target asks is done and
machine-enforced, this repo is _stricter_ than upstream on the two rules that matter, two further
upstream rules are in force for free, the mechanism is architecturally better than the baseline, and
every residual item is a one-word or one-assertion doc fix.

It loses on four points. The `cryptoRandomUuid` inversion is an enforcement defect, not a prose one
— it is the precise failure mode the config's own comment claims to prevent, and it guards an empty
set. With the lead's confirmation that the linker mask does not exist, `arch-check` is the _only_
barrier for the Effect boundary and it has a hole; "unexploited today" is a description of a single
undeclared dependency, not of a design. README.md:47 is not an adjective — it hands an agent a
command that exits 0 on an unstable import, in a repo that instructs agents to read local docs and
where I have now established there is no editor signal to compensate. And the guard suite's
authority is partly cosmetic: I reproduced that a four-key mutation to the rule map leaves all 16
tests green, so the highest-yield rule in the set is unpinned.

## 4. Blind spot the council shared

The council scoped its adversarial technique to the Effect rule and never re-ran it against the
sibling rules in the same guard. `inMainProcess` at `scripts/architecture-check.ts:55` gates the
React rule on two path prefixes, which excludes `apps/desktop/src/native.ts` — definitively process
code, imported by main.ts:14 and bundled through the `entry: ["src/main.ts"]` build. I appended a
React import to it and got:

```
$ vp run arch-check
architecture-check: ok (35 files)
```

exit 0. That is the identical structural gap, in the identical file, produced by the identical
technique the council used on Effect. Today it is masked by the same incidental fact that masked
Effect — `react` is not a declared dependency of `apps/desktop`, so knip's `unlisted` check and
TS2307 both fire, which I verified. Adding `react` to `apps/desktop` for a React-based settings
window makes it live with no gate catching it.

The second shared blind spot is the guard suite's own coverage, covered above.

## 5. Where I push back on the other judges

**Judge 3's REJECT of E5 is over-confident and internally contradicted.** The narrow glob reading is
available only if you ignore the sentence's subject, which is Effect crossing the bridge; and Judge
3's own invariant table row 17 prints "YES as written; NO for `@effect/*`", which cannot be
reconciled with a REJECT label. We agree completely on the technical hole — Judge 3 carries it as
its own findings — so the disagreement is about labeling and urgency, and on those the REJECT
mis-frames a one-character fix as a semantic quibble.

**Judge 3's "13" is 14.** Their own table decomposes 7 weakened + 7 omitted. I recomputed from the
upstream map in the packet (30 keys, 24 error / 6 off) and got 7 + 7 = 14. Unusually for an
arithmetic slip, the correct number is _more_ unfavourable to the config.

**Judge 2's editor fix is not actionable.** The diagnosis is right and well-evidenced, but
`node_modules/@tsc-rs/darwin-arm64/lib` contains only `lib.*.d.ts` files plus a 44 MB native `tsc`
binary — zero `.js`, `exports` is `{"./package.json"}` only, `bin` undefined — and there is no
`tsserver` anywhere in the tsc-rs tree. `js/ts.tsdk.path` must point at a spawnable `tsserver.js`.
The honest conclusion is worse than Judge 2's: there is currently no path to editor visibility for
these rules, which raises the weight of the README.md:47 doc defect rather than offering a
compensating remedy.

## 6. Verdict

**WARN, confidence HIGH — unchanged.** The R1 evidence still stands, every explorer claim I relied on
reproduced, and the three newly examined directions (doc accuracy, guard coverage, sibling-rule
coverage) each added findings rather than resolving them. The lead's confirmation on the linker mask
escalates the Effect boundary finding from "one of three masks is incidental" to "arch-check is the
only barrier, and it has the hole."

Two things are better than the rule map suggests and should be recorded as strengths, not gaps:
`floatingEffect` fires as `error TS377001` completely unconfigured, and an unrecognized rule key
emits `warning TS377134`, so the map cannot silently typo.

## 7. Repo state

All probes deleted; the mutation work ran in a `git archive HEAD` sandbox outside the repo, now
removed. `git status --porcelain` shows only the three council artifacts (the packet and the judge
output files) — no probe of mine survives.
