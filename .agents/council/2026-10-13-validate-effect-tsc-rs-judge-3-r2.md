# Judge 3 — Round 2 (stress-testing the unanimous WARN)

> Amended 2026-10-14 (feat/adopt-effect-4, PR #1): the divergent-rule denominators are **14**,
> not 13, and the `globalTimers` claim is narrowed to native source — its one live referent is
> the dbus test double this report itself cites, per the reviewer's finding that the old
> wording contradicted it. The measured costs (5 diagnostics, 3 files) are unchanged.

```json
{
  "judge": "judge-3",
  "verdict": "WARN",
  "confidence": "HIGH",
  "revised_from": "WARN",
  "key_insight": "The consensus holds, and the debate made it more precise rather than softer: restoring upstream parity is a priced, bounded change — I applied the full upstream rule map to this repo's own source and test tree and it costs exactly 5 diagnostics in 3 files, with 9 of the 14 divergent rules costing nothing at all. But the debate also exposed that both other judges mis-measured the cost of their own headline fix: `globalTimersInEffect: \"error\"` (which both recommend adding) breaks `apps/desktop/src/native.ts:77` with TS377073, and Judge 1's claim that the base `globalTimers` `off` value is what makes native.ts:77 legal is empirically false — that rule does not fire on `Effect.callback` bodies at all. The verdict stays WARN not because the rule gap is large but because Judge 2's README:47 finding is categorically worse than anything I found in R1: the repo's own command table names `tsc` for `pnpm typecheck`, handing an agent the exact silent substitution the entire guard suite exists to prevent.",
  "findings": [
    {
      "severity": "significant",
      "description": "Judge 1's claim that the base `off` values are 'justified by real usage - apps/desktop/src/native.ts:77 legitimately calls setTimeout inside an Effect.callback' is empirically false, and the error is load-bearing for the fix design. I ran the verbatim `Effect.callback` shape from native.ts:76-83 with globalTimers/globalConsole/globalDate/globalRandom/nodeBuiltinImport all at \"error\": only console.warn fired (TS377064). ZERO timer diagnostics. The base rule globalTimers does not cover `Effect.callback` bodies. What covers native.ts:77 is `globalTimersInEffect`, which fired TS377073 on the identical file. So (a) `globalTimers: \"off\"` protects no _native_ source code in this repo — its one live\n      referent is the dbus test double at `apps/desktop/test/native.test.ts:20` (TS377072), not native.ts:77\n      — and (b) adding `globalTimersInEffect: \"error\"` - the fix BOTH Judge 1 and Judge 2 recommend - breaks the only Effect file the repo has.",
      "why": "This is not a quibble about a citation. Both judges' recommended remediation ('add the six *InEffect global keys as error while deliberately leaving their base keys off') is a breaking change to working main-process code, and neither stated the cost. A consumer of either report implements that change and hits a red typecheck on native.ts, with no warning that it was coming. It also means the in-file comment at tsconfig.base.json:58-62 - which both judges accepted as an adequate rationale - is wrong about which rule covers which code.",
      "fix": "State the cost with the change: restoring the *InEffect keys to \"error\" requires either rewriting native.ts:77's `setTimeout` to `Effect.sleep`/`Schedule` or a scoped `@effect-diagnostics` suppression with a comment saying why the timer must stay real. Also correct the citation: `globalTimers: \"off\"` is load-bearing via `apps/desktop/test/native.test.ts:20` (a plain `setTimeout(handler, 0)` in a test double), NOT via native.ts:77.",
      "ref": "apps/desktop/src/native.ts:77; scripts/architecture-check.ts:1"
    },
    {
      "severity": "significant",
      "description": "Judge 2's finding that README.md:47 documents `pnpm typecheck` as running \"`tsc --noEmit` per workspace (TypeScript 7 native)\" is verified verbatim and is the single worst doc defect in the repo, worse than any finding I produced in R1. The real compiler is `tsc-rs`. I confirm the mechanism makes this dangerous rather than merely inaccurate: `scripts/toolchain.test.ts:4-6` states the guard's own purpose as preventing \"a workspace or script that falls back to `tsc`\" which \"silently loses every TS377xxx gate while still exiting green\", and I reproduced that silent-green state - a probe importing `effect/http`'s `HttpServerRequest.fromWeb` yields `error TS377136` under tsc-rs and ZERO diagnostics under plain `tsc` 7.0.2. The repo's own command table therefore names, in its most-read document, the compiler whose substitution disables every Effect gate.",
      "why": "Judge 1, Judge 2 and I all ran the same commands and all three of us read AGENTS.md and the tsconfig comments, but only Judge 2 read the README command table. That is the document an agent reads first, and the failure mode it invites is precisely the silent one the repo built a four-assertion test suite to prevent. In an agent-developed repo the docs are the spec, and this one point names the wrong spec.",
      "fix": "Change README.md:47 to `tsc-rs --noEmit` per workspace (TypeScript 7 native, Rust port). One word. Do it before any of the rule-map work.",
      "ref": "README.md:47"
    },
    {
      "severity": "moderate",
      "description": "Full upstream parity is a priced, bounded change, and the price is 5 lines in 3 files. I applied upstream's complete error-severity rule map (all six base globals + nodeBuiltinImport at error, all seven *InEffect keys at error, schemaSyncInEffect and cryptoRandomUuidInEffect at error, deterministicKeys at error) to the repo's own source AND test tree. Exactly five diagnostics result: main.ts:1 (TS377057 node:path), main.ts:114 and main.ts:117 (TS377064 console.warn), native.ts:77 (TS377073 setTimeout in Effect.callback), test/native.test.ts:20 (TS377072 setTimeout in a test double). Nine of the fourteen divergent rules cost nothing whatsoever, because the constructs they police have zero occurrences in the tree: `Date.now`, `fetch(`, `Math.random`, `crypto.randomUuid` all appear nowhere in apps/, packages/ or scripts/ outside node_modules.",
      "why": "Both my R1 finding and both other judges' findings framed this as an open-ended '19-key subset of upstream's 30' weakening, which reads like a hole. Priced, it is a rounding error - and the fact that half the divergent rules are free means the council's own recommendation ('restore the seven *InEffect rules') is cheaper than its framing suggested and more expensive than Judge 1 and Judge 2 stated, simultaneously. A reader needs both halves of that number to act.",
      "fix": "Record the cost matrix next to the rule map so the decision is made with the price visible. If the repo wants parity, expect to touch main.ts (node:path, two console.warn), native.ts (one setTimeout) and test/native.test.ts (one setTimeout) - four suppression comments or four idiomatic rewrites, not a rewrite of the module.",
      "ref": "tsconfig.base.json:63-76"
    },
    {
      "severity": "moderate",
      "description": "Judge 2's closed-list finding upgrades my own R1 mutation result: `scripts/toolchain.test.ts:28-32` hardcodes three workspaces while `pnpm-workspace.yaml:1-3` globs `apps/*` and `packages/*` and `vp run -r` discovers by glob. My R1 mutation M1 proved a LISTED workspace reverting to `tsc` goes RED. That guard cannot see a fourth workspace at all: a new package that forgets to extend tsconfig.base.json, or re-declares `plugins`, or drops `tsc-rs`, loses the entire 19-rule map and both stability gates while `pnpm typecheck` stays green. Judge 1's 16-green-tests result and my 7-of-9-red result are both silent on this because neither of us created a new workspace.",
      "fix": "Replace the closed list with discovery: read pnpm-workspace.yaml's globs, expand them, and assert every discovered workspace package.json's typecheck matches /\\btsc-rs\\b/ and every workspace tsconfig extends tsconfig.base.json with no local `plugins` re-declaration. I verified my own mutation harness could not construct this case, which is exactly why it needs to be a discovery-based test rather than a mutation.",
      "ref": "scripts/toolchain.test.ts:28-32"
    },
    {
      "severity": "moderate",
      "description": "Judge 1's statement that with the missing overrides block 'any test that JSON-parses fails the typecheck' is false as written. `preferSchemaOverJson` fires only inside Effect code, and four test files in scripts/ call `JSON.parse` in plain functions: scripts/toolchain.test.ts:20 and scripts/effect-resolution.test.ts:47,64,99. `npx tsc-rs --noEmit -p scripts/tsconfig.json` emits zero TS377026 on the pristine tree. I independently confirmed the underlying asymmetry in R1 with a two-line A/B (plain-function JSON.parse: silent; Effect-wrapped JSON.parse: TS377026). Judge 1's probe demonstrated the rule fires in a synthetic `.test.ts` they created, which proves the divergence from upstream is real but does not prove any repo test trips it - and Judge 1's own text concedes 'No test trips it today, so it is a latent, not active, failure', contradicting the stronger claim in the same finding.",
      "fix": "Keep the fix (add the upstream overrides block) - I verified with an A/B in a scratch config that tsc-rs 0.6.0 HONORS it: with the block, `probe.test.ts` is exempt and `probe.ts` still fires TS377026; without it, both fire. So the recommendation is actionable, contrary to my own R1 framing that called the gap inert. But correct the severity framing: it is latent, and the cost today is zero.",
      "ref": "scripts/toolchain.test.ts:20; scripts/effect-resolution.test.ts:47,64,99"
    },
    {
      "severity": "minor",
      "description": "Judge 2 accepted the in-file rationale comments as the correct mechanism for the rule-map weakening ('None; the in-file rationale comments are the right mechanism'). That is only true if the comments are accurate. The comment at tsconfig.base.json:58-62 justifying globalConsole/globalDate/globalTimers/globalFetch/globalRandom as `off` is wrong in two ways I verified in R1 and re-verified here: the rules it says 'only bite inside Effect code' in fact fire on non-Effect code (TS377064 on a plain `console.warn`, TS377066 on a plain `Date.now()`), and 'main.ts must stay dependency-free' is literally false since main.ts imports electron, electron-store, electron-updater, @ado/shared and node:path. Three of the six `off` values (globalDate, globalFetch, globalRandom) have no referent anywhere in the tree.",
      "fix": "Rewrite the comment to name the actual referents: nodeBuiltinImport and globalConsole are load-bearing at main.ts:1 and main.ts:114,117; globalTimers is load-bearing at test/native.test.ts:20; globalDate, globalFetch and globalRandom currently guard nothing and are free to set to \"error\". That turns an unexamined weakening into a priced, reviewable one.",
      "ref": "tsconfig.base.json:58-62"
    },
    {
      "severity": "minor",
      "description": "One embedded claim in a guard's own comment checks out, and I verified it rather than trusting it: `scripts/effect-resolution.test.ts:97-98` asserts that 'knip fails the push gate when the plugin is referenced but undeclared'. In a sandbox with `@effect/language-service` removed from root devDependencies, knip reported `Unlisted dependencies (1) / tsconfig.base.json: @effect/language-service` while the same sandbox's baseline reported no such finding - so the mechanism is real. Caveat recorded for honesty: that same sandbox's knip baseline emitted a false `Unused devDependencies: electron-builder` finding because binary resolution differs through the symlinked node_modules; the live `vp run knip` exits 0. I did not report the false positive and no conclusion here rests on it.",
      "why": "This closes the loop on a claim none of the three judges tested, and confirms the config-text-assertion style of these guard suites is coupled to a real secondary enforcement path rather than being purely self-referential.",
      "fix": "None. Recording it so the claim is known to be true.",
      "ref": "scripts/effect-resolution.test.ts:97-98"
    }
  ],
  "recommendation": "WARN, unchanged, HIGH confidence. The evidence bar for changing my verdict was a specific technical detail, code location, or factual error I missed in R1. I found factual errors in both peers' reports and I found a new one (README:47), and none of them move the verdict: everything load-bearing is still configured, live and green, and the mismatches are still real, actionable and cheap. What the debate did change is the shape of the work list, and it is now two tracks rather than one. Track A, do first, all one-liners: README:47 names tsc-rs (Judge 2's finding, adopts my strongest doc defect), widen EFFECT_SPECIFIER to /^@?effect(?:\\/|$)/ plus two arch-check fixtures, and correct AGENTS.md:292-294's runPromise and structuredClone overstatements. Track B, do as one deliberate commit: restore upstream parity on the nine free rules, and for the four load-bearing ones either add scoped `@effect-diagnostics` suppressions or rewrite native.ts:77 to Effect.sleep - but state the cost next to the map first, because Judge 1's and Judge 2's version of this fix silently breaks native.ts. Then add the upstream overrides block (verified honored by tsc-rs 0.6.0) and convert toolchain.test.ts's closed workspace list to glob discovery. Do NOT add @effect/tsgo or effect-tsgo patch; all four of us independently confirmed tsc-rs 0.6.0 carries the 377xxx codes natively and patches the compiler this repo never runs.",
  "debate_notes": {
    "devils_advocate": "The strongest case for PASS is that the council is triple-counting a small number of issues and inflating their severity to reach unanimity. Every load-bearing element is present and live: six distinct TS377xxx diagnostics fire under the shipped config (026, 030, 067, 078, 001, 136), plain tsc 7.0.2 emits none of them for the identical file, and 7 of 9 dismantling mutations go red. Nothing is broken - all four typechecks exit 0, arch-check is clean, `vp run knip` exits 0, and 16 guard tests pass. On the one divergence that carries the council's stated goal, the repo is STRICTER than upstream: upstream leaves `unstableApiUsage`/`experimentalApiUsage` at `off` and this repo sets them to `error`, which is exactly the default-deny gate the research doc called 'adoption is void without it'. The exact-pin `effect` catalog, the single-copy assertion and the @effect/vitest identity proof are all upstream-shaped or better. And I have now priced the rule gap: full parity costs 5 diagnostics in 3 files, and 9 of the 13 divergent rules cost nothing at all because the constructs they police occur nowhere in the tree. So 'a 19-key subset of upstream's 30' is really '4 lines of real code and 9 free keys'. Against the packet's PASS criterion - 'fully configured, at least equivalent to upstream, no actionable gaps' - one can argue there is no gap that is actionable TODAY: the code is green end to end, and every WARN item is either a one-word doc fix or a latent condition requiring a future event (a fourth workspace, a JSON-parsing Effect test, an @effect dep in the wrong workspace) to bite. I reject this for PASS, on one specific ground: the arch-check hole is silent rather than latent, and README:47 actively invites the exact failure the guard suite exists to prevent. A silent hole plus a doc that recommends walking into it is not PASS.",
    "blind_spot": "All three of us treated the rule map as a static set of missing keys and treated 'add the *InEffect rules' as a costless recommendation. Nobody measured it against the only Effect code in the repo. I measured it: `globalTimersInEffect: \"error\"` breaks `apps/desktop/src/native.ts:77` with TS377073, and the base `globalTimers` rule - which Judge 1 cited as the reason the `off` values are 'deliberate and defensible' - does not fire on that line at all. So both peers' remediation is a breaking change to working main-process code, stated as a free improvement. A second, related blind spot in the same area: none of us asked which of the six `off` values are load-bearing. Three (`globalDate`, `globalFetch`, `globalRandom`) protect literally nothing - zero occurrences of `Date.now`, `fetch(` or `Math.random` anywhere in apps/, packages/ or scripts/ - so the 'deliberate, documented weakening' Judge 2 accepted wholesale is half unexamined: neither deliberate-with-a-reason nor load-bearing.",
    "challenges": [
      {
        "target_judge": "judge-1",
        "claim": "Finding 3 and the E3 adjudication: 'the non-Effect half IS justified by real usage - apps/desktop/src/native.ts:77 legitimately calls setTimeout inside an Effect.callback - so the off values at tsconfig.base.json:63-68 are a deliberate, defensible call.'",
        "response": "Empirically false for the rule it is used to justify. I ran the verbatim native.ts:76-83 construct with globalTimers at \"error\": no diagnostic. The base timer rule does not reach `Effect.callback` bodies; `globalTimersInEffect` does, and produced TS377073 on the same file. So `globalTimers: \"off\"` guards no source code here. The load-bearing referent for that key is `apps/desktop/test/native.test.ts:20` - a plain, non-Effect `setTimeout(handler, 0)` in a dbus test double - which I did find by flipping all six base rules to error and diffing: TS377072 at that line. Judge 1's conclusion (the off values are defensible) survives for nodeBuiltinImport and globalConsole at main.ts:1,114,117, but the specific evidence cited is wrong, and it matters because Judge 1's own recommended fix - adding the six *InEffect keys at error - is exactly what breaks native.ts:77."
      },
      {
        "target_judge": "judge-1",
        "claim": "Finding 5: 'The missing upstream overrides block has a live consequence: preferSchemaOverJson errors inside .test.ts ... So any test that JSON-parses fails the typecheck.'",
        "response": "Wrong as stated, and contradicted by four files in the repo. `scripts/toolchain.test.ts:20` and `scripts/effect-resolution.test.ts:47,64,99` all call `JSON.parse`, and `npx tsc-rs --noEmit -p scripts/tsconfig.json` emits zero TS377026 on the pristine tree. The rule fires only inside Effect code - I proved this in R1 with a two-line A/B, and Judge 1's own finding concedes 'No test trips it today, so it is a latent, not active, failure', which contradicts the earlier sentence in the same finding. The fix recommendation is still correct and I verified it is ACTIONABLE: an A/B in a scratch config shows tsc-rs 0.6.0 honours the overrides block (probe.test.ts exempt, probe.ts still TS377026 without it). But it should be recorded as latent, not live, and my own R1 under-rated it by calling it inert - the cheapness of the fix is the point, not the current breakage."
      },
      {
        "target_judge": "judge-2",
        "claim": "Finding 8 (omitted rules / silent weakening): severity minor, fix 'None; the in-file rationale comments are the right mechanism.'",
        "response": "This under-warns, because it accepts the comments as adequate without testing them. The comment at tsconfig.base.json:58-62 says the exempted rules 'only bite inside Effect code' - false, they fire on non-Effect code (TS377064 on a plain console.warn, TS377066 on a plain Date.now(), TS377057 on `import from \"node:path\"`). It says 'main.ts must stay dependency-free' - literally false, main.ts imports five packages at lines 1-14. And three of the six keys it justifies guard nothing at all. 'The in-file rationale comments are the right mechanism' is only sound advice for comments that are true; these are not, so the mechanism is currently failing."
      }
    ],
    "acknowledgments": [
      {
        "source_judge": "judge-2",
        "point": "README.md:47 documents `pnpm typecheck` as \"`tsc --noEmit` per workspace (TypeScript 7 native)\" - naming the compiler whose substitution silently disables every TS377xxx gate.",
        "impact": "This is the single most valuable finding across all three reports and it is categorically worse than anything I produced in R1: my doc findings were about the guard overstating or understating itself, whereas this one hands an agent the exact substitution the guard suite exists to prevent. I verified it verbatim and verified the failure mode is silent (TS377136 under tsc-rs, zero diagnostics under plain tsc on the identical file). I adopt it as a significant finding, raise it to the top of my work list, and note that I read README:94-95 in R1 without reading the command table at :40-60 - a coverage gap in my own method."
      },
      {
        "source_judge": "judge-2",
        "point": "scripts/toolchain.test.ts guards a closed list of three workspaces while pnpm globs and `vp run -r` discover new packages automatically.",
        "impact": "This modifies my R1 mutation conclusion rather than adding to it. My M1 proved a LISTED workspace reverting to plain tsc goes RED; Judge 2's point is that the guard cannot see an UNLISTED workspace at all. My 7-of-9-red result is therefore a necessary-but-insufficient result, and my sandbox could not have constructed the missing case because I only mutated existing entries. It upgrades my R1 test-coverage finding from '13 of 19 keys unguarded' to 'the coverage model itself is enumerative where the build system is glob-based' - and it is the only place in this whole review where the configuration can erode silently as the repo grows."
      },
      {
        "source_judge": "judge-1",
        "point": "`cryptoRandomUuid: \"error\"` is 'dead configuration that reads as live' - it polices non-Effect code only, and there are zero `crypto.randomUuid()` calls anywhere in apps/, packages/ or scripts/.",
        "impact": "I noted this same asymmetry in R1 as a sub-point of my rule-map finding ('the configured rule is real but aimed at the wrong half of the problem'). Judge 1's formulation and the zero-occurrence count sharpen it materially, and I adopt both - it converts an asymmetry observation into a concrete statement that the rule guards an empty set. It also prompted me to run the parity cost matrix, which found the same pattern two more times: globalDate, globalFetch and globalRandom are all configured `off` and all guard empty sets. That reframes the whole finding as 'three rules guard nothing, three guard code the comment does not name, and seven are absent' - which is far more actionable than '13 of 24 missing'."
      },
      {
        "source_judge": "judge-1",
        "point": "The editor plugin (`@effect/language-service@0.87.4`) and the gate (tsc-rs 0.6.0) are two independent rule engines that can silently disagree, with nothing verifying they agree; the JS bundle lacks the stability keys entirely.",
        "impact": "This modifies my R1 assessment of E2. I confirmed E2's plugin-activation chain and concluded the concern was closed once I showed the plugin resolves through all five configs. Judge 1's binary-level scan shows that is the wrong question: the JS plugin would not enforce these rules even if it resolved, so the editor will report a file clean that the push gate rejects. That is a live developer-experience hazard in an agent-developed repo, and it means my R1 finding F6 (nothing in AGENTS.md/README points the editor at the tsc-rs tsdk) is more important than I rated it - I listed the VS Code pointer only as a Judge 2 observation, not as a defect in its own right."
      }
    ]
  }
}
```

---

## 1. Restating my R1 position before reading the peers

My R1 verdict was **WARN / HIGH**, anchored on my own empirical work rather than on any peer's:
six distinct TS377xxx diagnostics reproducing under the shipped `tsconfig.base.json` (026
`preferSchemaOverJson`, 030 `anyUnknownInErrorContext`, 067 `globalDateInEffect`, 078
`cryptoRandomUuid`, 001 `floatingEffect`, 136 `unstableApiUsage`), plain `tsc` 7.0.2 emitting
none of them for an identical file, and a nine-mutation sandbox sweep in which seven mutations
turned a gate red. Against that: 14 of upstream's 24 error-severity rules absent or weakened, the
in-file comment justifying six of them factually wrong in two ways, 13 of 19 configured rule keys
unguarded by any test, AGENTS.md overstating `runPromise` and the structuredClone claim, and the
Effect boundary resting on one regex with no typecheck backstop.

I have not revised that anchor. Everything below either corroborates it, corrects it, or corrects a
peer.

## 2. Devil's advocate — the strongest case for PASS

The strongest case is that the council is triple-counting a handful of issues and inflating
severity to manufacture unanimity.

Every load-bearing element is present and live. Six TS377xxx diagnostics fire under the shipped
config; plain `tsc` emits none of them. Seven of nine dismantling mutations go red. Nothing is
broken: four typechecks exit 0, arch-check is clean, `vp run knip` exits 0, 16 guard tests pass.
On the one divergence carrying the council's stated goal, the repo is **stricter** than upstream —
upstream leaves the two stability rules at `off`, this repo sets them to `error`, which is exactly
the default-deny gate the research doc called "adoption is void without it". The exact-pin catalog,
the single-copy assertion and the `@effect/vitest` identity proof are upstream-shaped or better.

And I have now priced the rule gap, which is the strongest form of the argument. Applying
upstream's complete error-severity map to this repo's own source and test tree costs **5
diagnostics in 3 files**:

| Location                 | Diagnostic | Rule                                                       |
| ------------------------ | ---------- | ---------------------------------------------------------- |
| `main.ts:1`              | TS377057   | `nodeBuiltinImport` (`node:path`)                          |
| `main.ts:114`            | TS377064   | `globalConsole` (`console.warn`)                           |
| `main.ts:117`            | TS377064   | `globalConsole`                                            |
| `native.ts:77`           | TS377073   | `globalTimersInEffect` (`setTimeout` in `Effect.callback`) |
| `test/native.test.ts:20` | TS377072   | `globalTimers` (`setTimeout` in a test double)             |

Nine of the fourteen divergent rules cost nothing, because the constructs they police have **zero
occurrences** anywhere in `apps/`, `packages/` or `scripts/` outside `node_modules`: `Date.now`,
`fetch(`, `Math.random`, `crypto.randomUuid`. So "a 19-key subset of upstream's 30" is really "four
lines of real code and nine free keys".

Against the packet's PASS criterion — _fully configured, at least equivalent to upstream, no
actionable gaps_ — one can argue there is no gap actionable **today**. The tree is green end to end.
Every WARN item is a one-word doc fix or a latent condition needing a future event to bite: a fourth
workspace, a JSON-parsing Effect test, an `@effect/*` dependency in the wrong workspace.

I reject this for PASS on one specific ground, and it is why the verdict does not move: the
arch-check hole is **silent**, not latent, and README:47 **actively invites** it. A hole that
requires nobody to do anything wrong to exist, plus a document recommending the walk into it, is not
"no actionable gaps" — it is the definition of the packet's WARN clause ("documentation/code
mismatches that need action").

## 3. Blind spot — what all three of us missed

**All three of us treated the rule map as a static set of missing keys and treated "add the
`*InEffect` rules" as costless.** Neither Judge 1 nor Judge 2 measured their own headline fix
against the only Effect code in the repo. I measured it:

- The verbatim `native.ts:76-83` `Effect.callback` shape, with `globalTimers` at `error`, produces
  **zero** timer diagnostics. The base rule does not reach `Effect.callback` bodies.
- The same file with `globalTimersInEffect` at `error` produces
  `error TS377073: This Effect code uses setTimeout … effect(globalTimersInEffect)`.

So both peers' remediation — "add the six `*InEffect` global keys as `error` while deliberately
leaving their base keys `off`" — is a **breaking change to working main-process code**, stated as a
free improvement by both of them.

A second blind spot in the same area: **none of us asked which of the six `off` values are
load-bearing.** Three (`globalDate`, `globalFetch`, `globalRandom`) protect literally nothing. So
the "deliberate, documented weakening" Judge 2 accepted wholesale is half unexamined — neither
deliberate-with-a-reason nor load-bearing.

## 4. Challenges

### Judge 1 — "the non-Effect half IS justified by real usage — `native.ts:77`"

Empirically false for the rule it is used to justify, and the error is load-bearing for the fix
design. Running `native.ts`'s own construct with `globalTimers: "error"` yields nothing; running it
with `globalTimersInEffect: "error"` yields TS377073. So `globalTimers: "off"` guards **no source
code** in this repo. The real referent for that key is `apps/desktop/test/native.test.ts:20` — a
plain, non-Effect `setTimeout(handler, 0)` in a dbus test double — which I found by flipping all six
base rules to `error` and diffing (TS377072 at that line).

Judge 1's conclusion survives for `nodeBuiltinImport` and `globalConsole` at `main.ts:1,114,117`, but
the specific evidence cited is wrong, and it matters because Judge 1's own recommended fix is exactly
what breaks `native.ts:77`.

### Judge 1 — "any test that JSON-parses fails the typecheck"

Wrong as stated, and contradicted by four files in the repo. `scripts/toolchain.test.ts:20` and
`scripts/effect-resolution.test.ts:47,64,99` all call `JSON.parse`, and
`tsc-rs -p scripts/tsconfig.json` emits **zero** TS377026 on the pristine tree. The rule fires only
inside Effect code. Judge 1's own finding concedes "No test trips it today, so it is a latent, not
active, failure", which contradicts the earlier sentence in the same finding.

I also verified the fix is **actionable**, which corrects my own R1 framing: an A/B in a scratch
config shows `tsc-rs` 0.6.0 **honours** the upstream `overrides` block — with it, `probe.test.ts` is
exempt and `probe.ts` still fires TS377026; without it, both fire. So Judge 1 and Judge 2's
recommendation is right, and my R1 "inert" label under-rated it.

### Judge 2 — "the in-file rationale comments are the right mechanism"

This under-warns, because it accepts the comments as adequate without testing them. The comment at
`tsconfig.base.json:58-62` claims the exempted rules "only bite inside Effect code" — false, they
fire on non-Effect code (TS377064 on a plain `console.warn`, TS377066 on a plain `Date.now()`,
TS377057 on `import … from "node:path"`). It claims "main.ts must stay dependency-free" — literally
false; `main.ts:1-14` imports five packages. And three of the six keys it justifies guard nothing.

## 5. Acknowledgments

**Judge 2, README.md:47** — verified verbatim: `pnpm typecheck` → "`tsc --noEmit` per workspace
(TypeScript 7 native)". This is categorically worse than anything I produced in R1. My doc findings
were about the guard overstating or understating itself; this one hands an agent the exact
substitution the guard suite exists to prevent, and I verified the failure mode is silent
(TS377136 under `tsc-rs`, zero diagnostics under plain `tsc` on the identical file). I adopt it as
significant, put it at the top of my work list, and note a coverage gap in my own method: I read
README:94-95 in R1 without reading the command table at :40-60.

**Judge 2, closed `WORKSPACES` list** — this _modifies_ my R1 mutation conclusion rather than adding
to it. My M1 proved a **listed** workspace reverting to plain `tsc` goes RED; Judge 2's point is that
the guard cannot see an **unlisted** workspace at all, because `pnpm-workspace.yaml:1-3` and
`vp run -r` discover by glob while `scripts/toolchain.test.ts:28-32` enumerates. My 7-of-9-red
result is necessary but insufficient, and my own sandbox could not construct the missing case. This
is the only place in the review where the configuration can erode silently as the repo grows.

**Judge 1, `cryptoRandomUuid` as "dead configuration that reads as live"** — I noted the same
asymmetry in R1 as a sub-point. Judge 1's formulation and the zero-occurrence count sharpen it, and
adopting it prompted the parity cost matrix, which found the pattern two more times. The finding is
now "three rules guard nothing, three guard code the comment does not name, seven are absent" — far
more actionable than "14 of 24 missing".

**Judge 1, two independent rule engines** — this modifies my E2 assessment. I closed the
plugin-activation question by showing the plugin resolves through all five configs. Judge 1's
binary-level scan shows that is the wrong question: the JS plugin would not enforce these rules even
if it resolved, so an editor will report a file clean that the push gate rejects. That makes the
missing VS Code `js/ts.tsdk.path` pointer a defect in its own right, not a footnote.

## 6. Repo state

No tracked file was modified (`git diff --stat HEAD` is empty). Every probe — the `overrides` A/B
pair, the `Effect.callback` verbatim shape, the two rule-flip tsconfigs, and the mutation sandbox —
was created untracked and deleted; `find . -name "*__j3*"` outside `node_modules` returns nothing.
The only untracked paths are the council's own artifacts.

One methodological note recorded for honesty: my `knip` sandbox produced a false
`Unused devDependencies: electron-builder` finding, because binary resolution differs through the
symlinked `node_modules`. The live `vp run knip` exits 0. I did not report it and no conclusion
rests on it — but the mutation it was running **did** validate
`scripts/effect-resolution.test.ts:97-98`'s claim that knip catches a referenced-but-undeclared
plugin: removing `@effect/language-service` surfaced
`Unlisted dependencies (1) / tsconfig.base.json: @effect/language-service` while the baseline
surfaced no such finding.
