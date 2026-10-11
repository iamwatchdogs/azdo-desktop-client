# Azure DevOps App

Desktop scaffold: Electron + React + TypeScript in a pnpm workspace, wired with the
Vite+ (`vite-plus`) toolchain. Tooling choices follow
[pingdotgg/t3code](https://github.com/pingdotgg/t3code).

Layout note: the split follows **t3code** (`apps/*` with the renderer as its own
app — `apps/desktop` holds zero renderer code). ZCode's pattern is different and
deliberately not copied here: ZCode keeps the renderer _inside_ its desktop
package (`packages/desktop/src/renderer`) and puts every package under
`packages/*`, with sharing extracted as layers (`packages/ui` consumed by both the
desktop renderer and the `packages/web` browser client, `packages/rpc`,
`packages/services`). That layout pays off with multiple clients sharing a UI
layer; this scaffold has one client, so the process-boundary split is the simpler
fit. Delivery differs too: t3code's desktop spawns its own backend server that
serves `apps/web` over HTTP (shared with web/mobile clients), while this app loads
its renderer from a static `dist/renderer` build.

## Requirements

- Node.js `^24.13.1` (TypeScript 7's native compiler and Vite+'s staged-file checks
  both need 24.x)
- pnpm `12.11.2` (pinned via `packageManager`; corepack works)

## Getting started

```sh
pnpm install     # also installs the git hook dispatcher via `prepare`
pnpm dev         # renderer dev server + main/preload watch build + Electron
```

| Command                 | What it does                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`              | `scripts/dev.ts`: renderer dev server on :5173, `vp pack --watch` for main/preload, launches Electron and restarts it on main-process rebuilds |
| `pnpm build`            | builds `@ado/renderer` (dependsOn), packs main/preload, copies the renderer bundle into `dist/renderer`                                        |
| `pnpm start`            | launches Electron against the built bundles                                                                                                    |
| `pnpm check`            | `vp check`: format + lint + type-aware lint in one pass                                                                                        |
| `pnpm test`             | Vitest in every workspace                                                                                                                      |
| `pnpm test:e2e`         | Playwright Electron smoke test on the built app                                                                                                |
| `pnpm typecheck`        | `tsc --noEmit` per workspace (TypeScript 7 native)                                                                                             |
| `pnpm knip`             | Unused files, dependencies, exports                                                                                                            |
| `pnpm check:complexity` | Cognitive/cyclomatic complexity gate (`oxlint-plugin-complexity`)                                                                              |
| `pnpm dist`             | electron-builder packaging                                                                                                                     |

## Workspace layout

```
apps/desktop/     backend (Electron host): main process, preload bridge, native
                  integrations, IPC handlers, packaging, e2e
apps/renderer/    frontend: React 19 SPA (TanStack Router, Tailwind v4, Base UI,
                  Zustand) — an ordinary Vite app that could also run in a browser
packages/shared/  contracts: zod-validated settings schema, IPC channel names,
                  the `window.azdo` bridge type
```

### Why frontend and backend are separate packages

Two common Electron patterns exist; this scaffold uses the split:

1. **Split (this repo, like t3code/ZCode):** `apps/desktop` owns everything below the
   renderer boundary (main process, preload, native modules, packaging) and
   `apps/renderer` owns the UI. The renderer is a plain Vite app — it can be
   developed, built, tested and linted on its own, has its own dependency tree, and
   could later be reused for a browser client. The desktop app loads it from
   `dist/renderer` (copied from `apps/renderer/dist` at build time) or the dev server.
2. **Single package (e.g. electron-vite templates):** main/preload/renderer all in one
   `src/renderer` tree. Simpler for a trivial app, but renderer and process code
   share a tsconfig, a lint scope and a dependency tree — the boundaries this scaffold
   enforces (renderer never imports `electron`; process code never imports React) get
   harder to keep as the app grows.

The boundary between them is the **preload bridge**: the renderer has no Node or
Electron access and talks to `window.azdo` (`packages/shared`), which `ipcMain`
handlers in `apps/desktop/src/main.ts` answer. Zod validates every payload at that
boundary, so the renderer cannot persist junk.

### Shared dependencies

Shared versions live in one place — the `catalog:` block of `pnpm-workspace.yaml`.
Every package references them as `"catalog:"` instead of a literal range, so a version
bump happens in exactly one file (t3code's mechanism). The root `package.json` holds
only the toolchain (vite-plus, typescript, tsx, knip, oxlint, oxfmt, ts-morph,
@shadcn/lint); their binaries resolve in every workspace through the `node_modules/.bin`
walk-up. Runtime dependencies belong to the package that imports them. `overrides`
additionally pins `react`/`react-dom`/`vite`/`vite-plus` so the whole workspace
resolves to a single copy.

## Toolchain notes

- **Vite+ is the single toolchain**: `vp lint` (Oxlint), `vp fmt` (Oxfmt), `vp test`
  (Vitest 5), `vp pack` (Rolldown-style bundling), `vp run` (task runner), and the git
  hook dispatcher. The catalog aliases `vite` → `@voidzero-dev/vite-plus-core`, which
  _is_ Vite 8 + Rolldown.
- **Config files**: `vite.config.ts` is the single source for format, lint, test,
  staged-check, and task settings — the `fmt`, `lint`, `test`, `staged`, and
  `run.tasks` blocks. This is what lets `vp check` run format + lint +
  type-aware lint in one pass. It matters more than it looks: Oxlint resolves
  config from the nearest `vite.config.*` that has a `lint` block, so a partial
  `lint` block silently shadows any `.oxlintrc.json` beside it and the whole
  ruleset goes unrun. `.oxlintrc.complexity.json` is the one deliberate
  exception — it stays a separate file because the complexity gate is an
  isolated `vp lint -c` run with its own rule set, not a duplicate.
  oxlint-tsgolint ships its own TypeScript 7 binary, so type-aware linting works
  with the native compiler. `.coderabbit.yaml` enables CodeRabbit's
  deterministic (non-LLM) analyzers for pull-request review; it is not part of
  the hook gate.
- **TypeScript 7** (native compiler) with maximum strictness in
  `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`,
  `noUncheckedSideEffectImports`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, …).
  Both ts-morph and knip are compatible with TS 7 (ts-morph consumes the workspace
  compiler; knip is oxc-based) — no legacy-TypeScript shim is needed.
- **Schema validation: Zod 4.** Zod validates the settings schema and the IPC
  boundary. Effect was evaluated and rejected as overkill for this scaffold: Effect 4
  is days-old with pervasive v3→v4 API breaks, its React integration
  (`@effect/atom-react`) currently fails to resolve against stable `effect`, and it
  costs ~76 KB gzip for `Schema` alone. Error handling uses plain discriminated-union
  results (`CapabilityResult`) — `neverthrow` (20 months stale) and `ts-pattern`
  (unmaintained) add nothing at this size. If bundle size ever matters,
  `packages/shared` can switch to `zod/mini` (same package, 92 KB → 3.6 KB gzip).
- **UI library set** (from the reference repos, unused by the empty shell — consume as
  features land): Base UI + CVA + `cn()`, lucide-react, Motion, tw-animate-css,
  @tailwindcss/typography, cmdk, @dnd-kit (core/sortable/utilities),
  @tanstack/react-virtual. Recharts/mermaid/shiki/swr were left out as
  domain-specific — add when a feature needs them.
- **Git hooks**: `pnpm install` runs `prepare` → `vp config --no-agent`, which
  installs the dispatcher into `.vite-hooks/_` (generated, self-ignored) and sets
  `core.hooksPath`. `VP_GIT_HOOKS=0 git commit|push …` bypasses a run.

  Hook policy is declared in [`vite.config.ts`](/vite.config.ts), not in script:
  the `staged` block drives pre-commit, and the `run.tasks` block defines the
  pre-push gate as a task graph that Vite Task runs concurrently and reports
  together.

  **pre-commit** — refuses commits on `main`/`master` (override once with
  `ALLOW_MAIN=1`), then runs `vp staged`: the `staged` block applies
  `vp check --fix` (format + lint + type-aware lint) and
  `scripts/hooks/policies.ts` (debug statements, private keys, oversized files,
  conflict markers) to the staged files.
  **pre-push** — resolves the push base and exports it as `GITHOOK_BASE`, refuses
  to run if a security scanner is missing (**fail closed** — a scanner that
  cannot run must never report as passing), then `vp run push-gate`:
  `complexity`, `typecheck:all`, `arch-check`, `knip`, `secrets` (gitleaks),
  `deps` (osv-scanner), `sast` (semgrep), `unit-tests` (vitest, narrowed to the
  push range). The heavy scanners are ordered via `dependsOn` so they never
  overlap — running them together OOM-kills them on smaller machines.
  **pre-merge-commit** — guards the merge commit. Git runs it only from the
  `git merge` builtin; when a merge conflicts you finish with `git commit`,
  which runs pre-commit instead and applies the same checks. The case it adds:
  a conflict "resolved" with `git add` but the markers left in place, which git
  accepts and only this check rejects.

  Install the scanners with `brew install gitleaks osv-scanner semgrep`.
  `SKIP_OSV=1` bypasses the dependency scan, which is the documented way to
  triage advisories you did not introduce.
  - `.semgrep/` holds the deterministic SAST rules used by the pre-push gate.
  - `.gitleaks.toml` carries gitleaks' default rules plus a narrow exception for
    test files, which embed literal key markers as fixtures.
  - `policy.ts` enforces a 500 MB staged-blob limit; override with
    `ADO_HOOKS_MAX_FILE_BYTES`, and blocks `debugger`, focused/skipped tests,
    and `console.log`/`debug`/`trace`/`dir`/`time*` on staged lines.

- **Console policy**: oxlint 1.87 ships no console rule (`no-console` and
  `unicorn/no-console` both fail to resolve, and an unknown rule is ignored
  silently), so `policy.ts` is the only thing enforcing it. It applies
  everywhere except test files, which embed `console.log` as fixture data —
  there is no path-based exemption, because the files where intentional
  logging lives are exactly the files where a leftover is indistinguishable
  from it. Intentional output uses `console.warn`/`error`/`info`, or opts a
  single line in with `// debug-statements: allow`. The marker is per-line:
  a file-wide opt-out would launder every other debug statement committed
  beside the marked one.

- **pnpm 12 gates**: `allowBuilds` approves install scripts (electron, ffi-rs,
  keyring, xa11y, electron-winstaller, esbuild). `minimumReleaseAge: 0` disables the
  default 24-hour freshness gate so pinned latest versions install deterministically —
  switch to `1440` (t3code's policy) and maintain a `minimumReleaseAgeExclude` list if
  you want the supply-chain age gate. `permissions` denies `@tanstack/router-plugin`'s
  bundled agent skills so they never land in this repo.
- **Architecture guard**: `pnpm arch:check` (ts-morph) fails on packages→apps imports,
  renderer→electron imports, and React in process code. It runs on every push.

## Packaging

`pnpm dist` runs electron-builder per `electron-builder.yml`. Native modules are
`asarUnpack`ed so their `.node` prebuilds load from disk. Auto-updating is wired
(`electron-updater`, guarded by `app.isPackaged`) but inert until a `publish` provider
is added to `electron-builder.yml`.

## Known follow-ups

- CSP: the renderer runs with Electron's default (no policy). Add a
  `<meta http-equiv="Content-Security-Policy">` in `apps/renderer/index.html` before shipping.
- `scripts/dev.ts` resolves `node_modules/.bin/vp` directly (POSIX only); on Windows,
  run `vp dev` in `apps/renderer` and `vp pack --watch` in `apps/desktop` manually.
- The first feature re-adds `@ado/shared` to `apps/renderer` and consumes the
  `window.azdo` bridge; React Compiler (`babel-plugin-react-compiler`, t3code's choice)
  is not enabled to keep the dependency surface minimal.
