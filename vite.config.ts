import { defineConfig } from "vite-plus";

/**
 * Single declarative source for formatting, linting, staged-file checks, and
 * the task graph the git hooks execute. See
 * node_modules/vite-plus/docs/guide/commit-hooks.md and /guide/run.md.
 *
 * `GITHOOK_BASE` is exported by .vite-hooks/pre-push and holds the SHA this
 * push is compared against, so range-scoped checks need no bespoke plumbing.
 */
export default defineConfig({
  fmt: {
    arrowParens: "always",
    bracketSameLine: false,
    bracketSpacing: true,
    endOfLine: "lf",
    insertFinalNewline: true,
    jsxSingleQuote: false,
    objectWrap: "preserve",
    printWidth: 100,
    quoteProps: "as-needed",
    semi: true,
    singleAttributePerLine: false,
    singleQuote: false,
    tabWidth: 2,
    trailingComma: "all",
    useTabs: false,
    ignorePatterns: [
      "node_modules",
      "dist",
      "dist-electron",
      "release",
      "pnpm-lock.yaml",
      "*.tsbuildinfo",
      "**/routeTree.gen.ts",
    ],
    sortPackageJson: { sortScripts: true },
    sortImports: {
      groups: [
        "side_effect",
        "side_effect_style",
        "builtin",
        "external",
        ["internal", "subpath"],
        ["parent", "sibling", "index"],
        "style",
        "unknown",
      ],
    },
    sortTailwindcss: { preserveDuplicates: true },
  },

  lint: {
    options: { typeAware: true, typeCheck: true },
  },

  /**
   * Staged-file checks, run by `vp staged` on every commit. Vite+ bundles
   * lint-staged, so staging, stashing, and re-staging are handled for us.
   *
   * `vp check --fix` = format + lint + type-aware lint in one pass.
   */
  staged: {
    "*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,css,html,yml,yaml,sh,md}": "vp check --fix",
    "**/*": "node scripts/hooks/policies.ts",
  },

  run: {
    // These gates inspect the working tree and git history; caching them would
    // replay a stale result after a change.
    cache: { scripts: false, tasks: false },
    tasks: {
      /**
       * Full typecheck: every workspace, then the hook scripts. Named distinctly
       * from the package.json `typecheck` script — Vite Task refuses to load a
       * task graph when a task and a script share a name.
       */
      "typecheck:all": {
        command: ["vp run -r typecheck", "tsc -p scripts/tsconfig.json"],
        cache: false,
      },
      /** Cognitive/cyclomatic complexity ceiling. */
      complexity: {
        command: "vp lint -c .oxlintrc.complexity.json",
        cache: false,
      },
      /** ts-morph import-boundary guard. */
      "arch-check": { command: "node scripts/architecture-check.ts", cache: false },
      /** Unused files, dependencies, exports. */
      knip: {
        command:
          "knip --no-progress --reporter compact --include files,dependencies,unlisted,unresolved,exports",
        cache: false,
      },

      // --- Security gates. .vite-hooks/pre-push refuses to run these when the
      // --- binary is missing, so a scanner can never silently disappear.
      /** Secret scanning over the commits this push introduces (two-dot range). */
      secrets: {
        command:
          'gitleaks git --config .gitleaks.toml --no-banner --redact=50 --exit-code=1 --log-opts "$GITHOOK_BASE..HEAD"',
        cache: false,
      },
      /**
       * Known-vulnerability scan over the lockfile.
       *
       * `--config .osv-scanner.toml` applies the reviewed acceptances for three
       * transitive advisories (postcss-selector-parser, sprintf-js, xml2js) that
       * are build-time or unreachable in the shipped app, and that no upstream
       * release currently fixes. Without it osv-scanner exits non-zero on any
       * advisory at any severity, so the gate would block every push over
       * dependencies nobody can act on.
       *
       * The suppressions are scoped to those three IDs, not to a severity or a
       * package class: a new advisory still fails the gate.
       */
      deps: {
        command:
          'if [ "${SKIP_OSV:-0}" = "1" ]; then echo "skipped (SKIP_OSV=1)"; else osv-scanner scan source --config .osv-scanner.toml --lockfile=pnpm-lock.yaml --format=vertical --verbosity=error; fi',
        cache: false,
      },

      /**
       * Deterministic SAST, diff-scoped via the push base.
       *
       * Heavy scanners, serialized.
       *
       * semgrep and vitest are each memory-hungry; running them concurrently
       * on an 8 GB machine gets them OOM-killed (exit 137), which is a false
       * failure that looks like a flaky gate. They form a chain instead:
       * sast -> unit-tests. Declaring `sast` and `unit-tests` as siblings of
       * `push-gate` runs them together, which is exactly what caused the kill.
       * Cheap checks stay parallel in `push-gate`.
       */
      sast: {
        command:
          'semgrep scan --config .semgrep --metrics=off --disable-version-check --error --exclude=node_modules --exclude=dist --exclude=dist-electron --exclude=release --exclude=.vite-plus --baseline-commit "$GITHOOK_BASE"',
        cache: false,
      },

      /**
       * Test suite, narrowed to the specs affected by the current change.
       *
       * Driven by `GITHOOK_BASE`. For pre-commit that base is `HEAD`, so
       * "changed" means the staged delta; for pre-push it is the remote SHA.
       * Each `vp -C <ws> test run --changed` reports "no test files" with a
       * zero exit code when nothing it owns changed, so a docs-only commit runs
       * no vitest at all.
       *
       * Deliberately does NOT depend on `sast`: this is the inner commit loop
       * and must stay fast. Semgrep and the full matrix belong to the push gate.
       *
       * `apps/desktop` e2e goes through Playwright's `--only-changed`. It
       * launches Electron against dist-electron, so it is skipped when that
       * build is absent rather than failing a commit on a missing artifact.
       */
      "tests:changed": {
        command: [
          'vp -C packages/shared test run --changed "$GITHOOK_BASE" --passWithNoTests',
          'vp -C apps/renderer test run --changed "$GITHOOK_BASE" --passWithNoTests',
          'vp -C apps/desktop test run --changed "$GITHOOK_BASE" --passWithNoTests',
          'if [ -f apps/desktop/dist-electron/main.cjs ]; then vp -C apps/desktop exec playwright test --only-changed "$GITHOOK_BASE"; else echo "e2e: skipped (no dist-electron build)"; fi',
        ],
        cache: false,
      },

      /**
       * The full test suite, unfiltered. Used by the merge and push paths,
       * where the cost of a slow gate is worth paying for certainty.
       *
       * The root workspace runs unconditionally rather than under `--changed`:
       * it owns the hook-policy tests, which guard the code the pre-commit hook
       * runs. A change to the gate's own logic must not be able to disable the
       * tests that check it.
       */
      "tests:all": {
        command: [
          "vp test run --passWithNoTests",
          "vp -C packages/shared test run --passWithNoTests",
          "vp -C apps/renderer test run --passWithNoTests",
          "vp -C apps/desktop test run --passWithNoTests",
          'if [ -f apps/desktop/dist-electron/main.cjs ]; then vp -C apps/desktop exec playwright test; else echo "e2e: skipped (no dist-electron build)"; fi',
        ],
        cache: false,
      },

      /**
       * The pre-push gate. Vite Task runs the dependencies concurrently and
       * reports them together, so this is the whole gate in one command.
       * Its own command is a marker that runs only when the deps all pass.
       */
      "push-gate": {
        command: "echo 'push gate passed'",
        dependsOn: ["complexity", "typecheck:all", "arch-check", "knip", "secrets", "tests:all"],
        cache: false,
      },
    },
  },
});
