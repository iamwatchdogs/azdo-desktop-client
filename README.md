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

| Command                  | What it does                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`               | `scripts/dev.ts`: renderer dev server on :5173, `vp pack --watch` for main/preload, launches Electron and restarts it on main-process rebuilds |
| `pnpm build`             | builds `@ado/renderer` (dependsOn), packs main/preload, copies the renderer bundle into `dist/renderer`                                        |
| `pnpm start`             | launches Electron against the built bundles                                                                                                    |
| `pnpm test`              | Vitest in every workspace                                                                                                                      |
| `pnpm test:e2e`          | Playwright Electron smoke test on the built app                                                                                                |
| `pnpm typecheck`         | `tsc --noEmit` per workspace (TypeScript 7 native)                                                                                             |
| `pnpm lint` / `pnpm fmt` | Oxlint / Oxfmt via `vp lint -c` / `vp fmt -c`                                                                                                  |
| `pnpm knip`              | Unused files, dependencies, exports                                                                                                            |
| `pnpm arch:check`        | ts-morph architecture guard                                                                                                                    |
| `pnpm check:complexity`  | Cognitive/cyclomatic complexity gate (`oxlint-plugin-complexity`)                                                                              |
| `pnpm hooks:pre-commit`  | Runs the pre-commit gate outside a `git commit`                                                                                                |
| `pnpm hooks:pre-push`    | Runs the pre-push gate outside a `git push`                                                                                                    |
| `pnpm dist`              | electron-builder packaging                                                                                                                     |

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
- **Config files**: `.oxlintrc.json` and `.oxfmtrc.json` are the canonical lint/format
  configs. Vite+ does not auto-discover them (its docs steer lint/fmt config into
  `vite.config.ts`), so scripts and hooks pass `-c` explicitly. The lint config runs
  type-aware (`typeAware`/`typeCheck`) — oxlint-tsgolint ships its own TypeScript 7
  binary, so this works with the native compiler.
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
  `core.hooksPath`. Project-owned scripts: `.vite-hooks/pre-commit` and
  `.vite-hooks/pre-push` — both delegate to `tsx scripts/hooks/*.ts`, which run
  every check concurrently (`Promise.all`, buffered per-check output, all failures
  reported at once). `VP_GIT_HOOKS=0 git commit|push …` bypasses a run.

  **pre-commit** — formatting runs first (`vp staged` rewrites staged files and
  re-stages them), then in parallel: `lint` (oxlint, type-aware), `complexity`
  (cognitive/cyclomatic), `typecheck`, `ast-check` (the ts-morph architecture
  guard), `debug-statements`, `detect-private-key`, `check-added-large-files`,
  `check-merge-conflict`. A branch guard runs first: committing on `main`/`master`
  is refused (override once with `ALLOW_MAIN=1`).
  **pre-push** — in parallel over the resolved push range `base..HEAD`:
  `fmt:check`, `lint`, `complexity`, `typecheck`, `ast-check`, `knip`, `gitleaks`,
  `osv-scanner`, `semgrep`, `check-merge-conflict`, `tests (vitest)`
  (only tests affected by the range), `tests (playwright e2e)` (builds, then only
  changed specs when the range touches app code), `codacy`, `coderabbit-advisory`.
  Tools that aren't installed skip with an install hint instead of failing. Bypass
  individual optional checks with `SKIP_OSV=1`, `SKIP_E2E=1`,
  `CODERABBIT_ADVISORY=1` (opt-in, since it is LLM-driven).
  Install the optional scanners with `brew install gitleaks osv-scanner semgrep`.
  - `.semgrep/` holds the deterministic SAST rules used by the pre-push gate;
    `.coderabbit.yaml` enables the matching non-LLM analyzers for PR reviews.
  - `check-added-large-files` uses a 500 MB staged-blob threshold; override with
    `ADO_HOOKS_MAX_FILE_BYTES`.

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
