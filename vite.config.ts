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
      /** Known-vulnerability scan over the lockfile. */
      deps: {
        command:
          'if [ "${SKIP_OSV:-0}" = "1" ]; then echo "skipped (SKIP_OSV=1)"; else osv-scanner scan source --lockfile=pnpm-lock.yaml --format=vertical --verbosity=error; fi',
        cache: false,
      },
      /** Deterministic SAST, diff-scoped via the push base. */
      sast: {
        command:
          'semgrep scan --config .semgrep --metrics=off --disable-version-check --error --exclude=node_modules --exclude=dist --exclude=dist-electron --exclude=release --exclude=.vite-plus --baseline-commit "$GITHOOK_BASE"',
        cache: false,
      },

      /** Unit tests, narrowed to those affected by the push range. */
      /**
       * Heavy scanners, serialized.
       *
       * osv-scanner, semgrep and vitest are each memory-hungry; running them
       * concurrently on an 8 GB machine gets them OOM-killed (exit 137), which
       * is a false failure that looks like a flaky gate. Declaring `sast`
       * dependsOn `deps` makes Vite Task order them, and `unit-tests` depends
       * on `sast` so the three never overlap. Cheap checks stay parallel in
       * `push-gate`.
       */
      "unit-tests": {
        command: [
          'vp -C packages/shared test run --changed "$GITHOOK_BASE" --passWithNoTests',
          'vp -C apps/renderer test run --changed "$GITHOOK_BASE" --passWithNoTests',
          'vp -C apps/desktop test run --changed "$GITHOOK_BASE" --passWithNoTests',
        ],
        dependsOn: ["sast"],
        cache: false,
      },

      /**
       * The pre-push gate. Vite Task runs the dependencies concurrently and
       * reports them together, so this is the whole gate in one command.
       * Its own command is a marker that runs only when the deps all pass.
       */
      "push-gate": {
        command: "echo 'push gate passed'",
        dependsOn: [
          "complexity",
          "typecheck:all",
          "arch-check",
          "knip",
          "secrets",
          "deps",
          "unit-tests",
        ],
        cache: false,
      },
    },
  },
});
