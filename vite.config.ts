import "vite-plus/test/config";

import { defineConfig } from "vite-plus";

/**
 * Shared by `fmt` and `lint`: oxfmt and oxlint take the same globs, so one list
 * keeps generated and build output out of both.
 */
const IGNORE_PATTERNS = [
  "node_modules",
  "dist",
  "dist-electron",
  "release",
  "pnpm-lock.yaml",
  "*.tsbuildinfo",
  "**/routeTree.gen.ts",
];

/**
 * Single declarative source for format, lint, test, staged-file and task
 * settings. `GITHOOK_BASE` is exported by .vite-hooks/pre-push, so
 * range-scoped checks need no bespoke plumbing. See
 * node_modules/vite-plus/docs/guide/commit-hooks.md and /guide/run.md.
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
    ignorePatterns: IGNORE_PATTERNS,
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
    ignorePatterns: IGNORE_PATTERNS,
    plugins: [
      "eslint",
      "oxc",
      "unicorn",
      "typescript",
      "import",
      "promise",
      "node",
      "react",
      "jsx-a11y",
      "vitest",
    ],
    categories: {
      correctness: "error",
      suspicious: "error",
      pedantic: "error",
      perf: "error",
    },
    jsPlugins: ["@shadcn/lint", "oxlint-plugin-complexity"],
    settings: {
      shadcn: { ui: "apps/renderer/src" },
    },
    rules: {
      eqeqeq: ["error", "always", { null: "ignore" }],

      // oxlint 1.87 has no console rule: `no-console` and `unicorn/no-console`
      // both fail to resolve, and an unknown rule is ignored silently.
      // scripts/hooks/policy.ts enforces it on staged lines instead.
      "no-var": "error",
      "no-eq-null": "error",
      "typescript/no-explicit-any": "error",

      "react-in-jsx-scope": "off",

      "unicorn/prefer-node-protocol": "error",
      "import/no-cycle": "error",
      "import/no-unassigned-import": [
        "error",
        { allow: ["**/*.css", "**/*.scss", "vite-plus/test/config"] },
      ],
      "promise/no-return-wrap": "error",

      "no-await-in-loop": "off",
      "no-else-return": "off",
      "no-inline-comments": "off",
      "no-lonely-if": "off",
      "no-negated-condition": "off",
      "no-redeclare": "off",
      "no-underscore-dangle": "off",
      "no-undef": "off",
      "no-unused-vars": ["error", { caughtErrors: "all", argsIgnorePattern: "^_" }],
      "no-warning-comments": "off",
      "no-useless-return": "off",
      "require-await": "off",
      "require-unicode-regexp": "off",

      "unicorn/consistent-function-scoping": "off",
      "unicorn/explicit-length-check": "off",
      "unicorn/filename-case": "off",
      "unicorn/no-array-callback-reference": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/no-array-reduce": "off",
      "unicorn/no-array-reverse": "off",
      "unicorn/no-hex-escape": "off",
      "unicorn/no-lonely-if": "off",
      "unicorn/no-negated-condition": "off",
      "unicorn/no-process-exit": "off",
      "unicorn/no-static-only-class": "off",
      "unicorn/no-this-assignment": "off",
      "unicorn/prefer-at": "off",
      "unicorn/prefer-code-point": "off",
      "unicorn/prefer-logical-operator-over-ternary": "off",
      "unicorn/prefer-query-selector": "off",
      "unicorn/prefer-single-call": "off",
      "unicorn/prefer-string-replace-all": "off",
      "unicorn/prefer-ternary": "off",
      "unicorn/prefer-top-level-await": "off",

      "typescript/no-confusing-void-expression": "off",
      "typescript/no-unsafe-type-assertion": "off",
      "typescript/prefer-readonly-parameter-types": "off",
      "typescript/require-await": "off",
      "typescript/consistent-type-definitions": ["error", "interface"],

      "promise/always-return": "off",

      "max-classes-per-file": "off",
      "max-depth": ["error", 4],
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-nested-callbacks": "off",
      "max-params": "off",
      "max-statements": "off",
      complexity: "off",
      "complexity/complexity": ["error", { cyclomatic: 20, cognitive: 15, minLines: 5 }],
      "import/max-dependencies": "off",
      "vitest/require-to-throw-message": "off",
      // @effect/vitest's it.effect takes a generator, so the rule cannot see the
      // test boundary and reports every expect inside one as standalone.
      "vitest/no-standalone-expect": "off",

      "shadcn/no-restyle": "off",
      "shadcn/require-static-classes": "off",
      "shadcn/no-arbitrary-values": "off",
      "shadcn/no-unknown-classes": "error",
      "shadcn/no-raw-colors": "error",
    },

    // Globs resolve from this file, so paths name the workspace
    // (`scripts/**`, `apps/desktop/src/main.ts`), not a `cd`'d dir.
    overrides: [
      {
        files: [
          "**/*.{test,spec}.{ts,tsx}",
          "**/test/**",
          "**/tests/**",
          "**/e2e/**",
          "**/__tests__/**",
        ],
        rules: {
          "typescript/no-explicit-any": "off",
          "typescript/no-non-null-assertion": "off",
          "typescript/no-unsafe-assignment": "off",
          "typescript/no-unsafe-member-access": "off",
          "typescript/no-unsafe-call": "off",
          "typescript/no-unsafe-argument": "off",
          "typescript/no-unsafe-return": "off",
        },
      },
      {
        files: ["**/*.d.ts"],
        rules: {
          "typescript/consistent-type-definitions": "off",
          "no-redeclare": "off",
        },
      },
      {
        files: ["apps/renderer/src/**"],
        rules: {
          "shadcn/no-unknown-classes": "error",
          "shadcn/no-raw-colors": "error",
        },
      },
    ],

    options: {
      typeAware: true,
      typeCheck: true,
      reportUnusedDisableDirectives: "error",
    },
  },

  // Hook-policy tests. Root workspace only; each app/package owns its own block.
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
  },

  /**
   * Staged-file checks, run by `vp staged` on every commit. Vite+ bundles
   * lint-staged, so staging, stashing and re-staging are handled for us.
   *
   * `vp check --fix` = format + lint + type-aware lint in one pass.
   */
  staged: {
    "*.{ts,tsx,js,jsx,mjs,cjs,json,jsonc,css,html,yml,yaml,sh,md}": "vp check --fix",
    "**/*": "node scripts/hooks/policies.ts",
  },

  run: {
    // These gates read the working tree and git history; caching would replay a
    // stale result after a change.
    cache: { scripts: false, tasks: false },
    tasks: {
      /**
       * Every workspace plus the hook scripts. Named distinctly from the
       * package.json `typecheck` script: Vite Task refuses to load a task graph
       * when a task and a script share a name.
       */
      "typecheck:all": {
        command: ["vp run -r typecheck", "tsc-rs -p scripts/tsconfig.json"],
        cache: false,
      },
      /** Cognitive/cyclomatic ceiling. */
      complexity: {
        command: "vp lint -c .oxlintrc.complexity.json",
        cache: false,
      },
      /** ts-morph import-boundary guard. */
      "arch-check": { command: "node scripts/architecture-check.ts", cache: false },
      /** Unused files, dependencies, exports. */
      // No dependency on the test suite: the boundary tests probe a throwaway
      // root, so nothing they run ever exists in the tree this scans, and
      // sequencing against them only re-runs the suite (CI would pay for it).
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
       * `--config .osv-scanner.toml` applies three reviewed acceptances for
       * transitive advisories (postcss-selector-parser, sprintf-js, xml2js)
       * that are build-time or unreachable in the shipped app and that no
       * upstream release fixes. Unscoped, osv-scanner exits non-zero on any
       * advisory at any severity, so the gate would block over dependencies
       * nobody can act on.
       *
       * The suppressions name those three IDs, not a severity or package class:
       * a new advisory still fails the gate.
       */
      deps: {
        command:
          'if [ "${SKIP_OSV:-0}" = "1" ]; then echo "skipped (SKIP_OSV=1)"; else osv-scanner scan source --config .osv-scanner.toml --lockfile=pnpm-lock.yaml --format=vertical --verbosity=error; fi',
        cache: false,
      },

      /**
       * Deterministic SAST, diff-scoped via the push base.
       *
       * semgrep and vitest are each memory-hungry; running them concurrently on
       * an 8 GB machine OOM-kills them (exit 137), a false failure that looks
       * flaky. They chain instead: sast -> unit-tests. Declaring them as
       * siblings of `push-gate` is exactly what caused the kill. Cheap checks
       * stay parallel in `push-gate`.
       */
      sast: {
        command:
          'semgrep scan --config .semgrep --metrics=off --disable-version-check --error --exclude=node_modules --exclude=dist --exclude=dist-electron --exclude=release --exclude=.vite-plus --baseline-commit "$GITHOOK_BASE"',
        cache: false,
      },

      /**
       * Test suite narrowed to the specs the current change affects.
       *
       * Driven by `GITHOOK_BASE`: HEAD for pre-commit (so "changed" is the
       * staged delta), the remote SHA for pre-push. Each `vp -C <ws> test run
       * --changed` exits 0 with "no test files" when nothing it owns changed, so
       * a docs-only commit runs no vitest.
       *
       * Deliberately independent of `sast`: this is the inner commit loop and
       * must stay fast. Semgrep and the full matrix belong to the push gate.
       *
       * `apps/desktop` e2e uses Playwright's `--only-changed`. It launches
       * Electron against dist-electron, so a missing build skips rather than
       * fails a commit.
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
       * Full suite, unfiltered, for the merge and push paths where certainty is
       * worth the cost.
       *
       * The root workspace runs unconditionally rather than under `--changed`: it
       * owns the hook-policy tests, which guard the code pre-commit runs. A
       * change to the gate's own logic must not disable the tests checking it.
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
       * The pre-push gate. Vite Task runs the deps concurrently and reports them
       * together, so this is the whole gate in one command. Its own command is a
       * marker that runs only when the deps all pass.
       */
      "push-gate": {
        command: "echo 'push gate passed'",
        dependsOn: ["complexity", "typecheck:all", "arch-check", "knip", "secrets", "tests:all"],
        cache: false,
      },
    },
  },
});
