# Azure DevOps Desktop Client

A desktop client for Azure DevOps — Electron + React 19 + TypeScript in a pnpm
workspace, running on the Vite+ (`vite-plus` / `vp`) toolchain.

> **Status: scaffold.** The shell works — settings persistence, OS keychain
> storage for the Azure DevOps PAT, and native capability probes — but there are
> no Azure DevOps domain features yet. The renderer's index route renders
> nothing. Treat this repo as the foundation the first feature lands on.

## Scope

- **Type**: Electron desktop app (`apps/desktop` host + `apps/renderer` React SPA).
- **Renderer is an ordinary Vite app.** It has no Electron or Node access; later
  it could be extracted into a browser client without changes.
- **One IPC channel crosses the process boundary**: the `window.azdo` preload
  bridge (`packages/shared`). Everything else is local.

## Requirements

- Node.js `^24.13.1` — TypeScript 7's native compiler and Vite+'s staged-file
  checks both need 24.x.
- pnpm `12.11.2` — pinned via `packageManager`; corepack works.
- `gitleaks`, `osv-scanner`, `semgrep` — installed by the pre-push gate. Skip
  `osv-scanner` with `SKIP_OSV=1` when triaging advisories you did not
  introduce. Install: `brew install gitleaks osv-scanner semgrep`.

## Setup

```sh
pnpm install   # also installs the git hook dispatcher via `prepare`
pnpm dev       # renderer dev server (:5173) + main/preload watch build + Electron
```

`pnpm install` runs `prepare` → `vp config --no-agent`, which installs the hook
dispatcher and sets `core.hooksPath`. `VP_GIT_HOOKS=0 git commit|push …` bypasses
a single run.

## Commands

| Command                 | What it does                                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`              | `scripts/dev.ts`: renderer dev server on :5173, `vp pack --watch` for main/preload, launches Electron and restarts it on main rebuilds |
| `pnpm build`            | builds `@ado/renderer` (dependsOn), packs main/preload, copies the renderer bundle into `dist/renderer`                                |
| `pnpm start`            | launches Electron against the built bundles                                                                                            |
| `pnpm check`            | `vp check`: format + lint + type-aware lint in one pass                                                                                |
| `pnpm typecheck`        | `tsc --noEmit` per workspace (TypeScript 7 native)                                                                                     |
| `pnpm check:complexity` | cognitive complexity gate (max 15)                                                                                                     |
| `pnpm test`             | Vitest in every workspace                                                                                                              |
| `pnpm test:e2e`         | Playwright Electron smoke test on the built app                                                                                        |
| `vp run knip`           | unused files, dependencies, exports                                                                                                    |
| `vp run arch-check`     | import-boundary guard (see below)                                                                                                      |
| `vp run secrets`        | gitleaks over the push range                                                                                                           |
| `vp run push-gate`      | full pre-push gate (see below)                                                                                                         |
| `pnpm dist`             | electron-builder packaging                                                                                                             |

## Project layout

```
apps/desktop/     Electron host: main process, preload bridge, native
                  integrations, IPC handlers, packaging, e2e
apps/renderer/    React 19 SPA (TanStack Router, Tailwind v4, Base UI,
                  Zustand) — a plain Vite app
packages/shared/  contracts between the two: zod settings schema, IPC
                  channel names, the window.azdo bridge type
scripts/          dev script, git hook policies
```

### Architecture

**Why desktop and renderer are separate packages** (the split used by
t3code/ZCode, not the electron-vite single-`src/` layout): `apps/desktop` owns
everything below the renderer boundary and `apps/renderer` owns the UI. Each
side gets its own tsconfig, lint scope, and dependency tree, and the boundaries
this repo enforces — renderer never imports `electron`, process code never
imports React — stay checkable as the app grows.

- **The preload bridge** (`packages/shared`): the renderer talks to
  `window.azdo`; `ipcMain` handlers in `apps/desktop/src/main.ts` answer. Zod
  validates every payload at that boundary, so the renderer cannot persist junk.
- **Errors are values, not exceptions**: probes and capabilities return
  `CapabilityResult` (`{ ok, detail }`) instead of throwing across the bridge.
  Native modules are lazy-imported inside their functions so a missing platform
  prebuild cannot kill the main process.
- **Single toolchain**: `vite.config.ts` is the declarative source for format,
  lint, test, staged-check, and task settings. Oxlint resolves config from the
  nearest `vite.config.*` with a `lint` block, so a partial second config would
  silently shadow the whole ruleset — `.oxlintrc.complexity.json` is the one
  deliberate exception (an isolated `vp lint -c` gate).
- **Shared dependency versions** live in the `catalog:` block of
  `pnpm-workspace.yaml`; every package references `"catalog:"`, so a bump
  happens in exactly one file. Never pin a literal version that exists in the
  catalog.
- **Import-boundary guard**: `vp run arch-check` (ts-morph) fails on
  packages→apps imports, renderer→electron imports, and React in process code.
- **No debug statements** in application code. `console.log`/`debug`/`trace`/
  `dir`/`time*`, `debugger`, and focused or skipped tests are blocked on staged
  lines by `scripts/hooks/policies.ts`; intentional output uses
  `console.warn`/`error`/`info` or a per-line `// debug-statements: allow`.

## Local gates

Git hooks are declared in `vite.config.ts` (the `staged` block drives
pre-commit, the `run.tasks` block the pre-push gate), not in script, so config
and hooks cannot drift.

| Stage              | What runs                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pre-commit`       | refuses commits on `main` (override once with `ALLOW_MAIN=1`), then `vp check --fix` (format + lint + type-aware lint) and hook policies on staged files                                               |
| `pre-merge-commit` | guards the merge commit from conflict markers left in place after `git add`                                                                                                                            |
| `pre-push`         | resolves the push base as `GITHOOK_BASE`, fails closed if a security scanner is missing, then runs `push-gate`: `complexity`, `typecheck:all`, `arch-check`, `knip`, `secrets` (gitleaks), `tests:all` |

`sast` (semgrep) and `deps` (osv-scanner) are declared but parked out of the
gate; run them by hand with `vp run sast` / `vp run deps`.

## Continuous integration

`.github/workflows/` gates every push and pull request:

| Workflow                    | Gate                                                                                                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci.yml`                    | path-filtered lint (Action workflows via actionlint), static analysis, multi-OS unit tests, Electron e2e, security scanners; collapses into one required `CI Status` check that fails closed |
| `codeql.yml`                | `security-extended` scanning + a weekly run for new queries                                                                                                                                  |
| `dependency-review.yml`     | blocks PRs introducing moderate-or-worse CVEs                                                                                                                                                |
| `zizmor.yml`                | GitHub Actions security analysis (upload-only)                                                                                                                                               |
| `scorecard.yml`             | OpenSSF supply-chain grade, pushed to the Security tab                                                                                                                                       |
| `dependabot-auto-merge.yml` | auto-merges only Dependabot semver-patch PRs via a four-gate policy                                                                                                                          |
| `cd.yml`                    | tag or release → re-runs `ci.yml` with `run-all: true`, builds for 3 platforms, publishes a GitHub Release                                                                                   |

Path filtering means a docs-only change skips the TypeScript jobs; `CI Status`
still passes a skipped job only when `detect-changes` explicitly reported the
filter as `false`.

## Packaging

`pnpm dist` runs electron-builder per `electron-builder.yml`. Native modules are
`asarUnpack`ed so their `.node` prebuilds load from disk. Auto-updating is wired
(`electron-updater`, guarded by `app.isPackaged`) but inert until a `publish`
provider is added to `electron-builder.yml`.

## Known follow-ups

- **CSP**: the renderer runs with Electron's default (no policy). Add a
  `<meta http-equiv="Content-Security-Policy">` in `apps/renderer/index.html`
  before shipping.
- **Windows dev loop**: `scripts/dev.ts` resolves `node_modules/.bin/vp`
  directly (POSIX only); on Windows run `vp dev` in `apps/renderer` and
  `vp pack --watch` in `apps/desktop` manually.
- **First feature** re-adds `@ado/shared` to `apps/renderer` and consumes the
  `window.azdo` bridge. React Compiler (`babel-plugin-react-compiler`) is not
  enabled, to keep the dependency surface minimal.

## License

[MIT](LICENSE). Copyright © 2026 Shamith Nakka.
