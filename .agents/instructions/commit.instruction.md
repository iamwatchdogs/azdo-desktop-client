---
description: "commit messages related instructions"
applyTo: ".git/COMMIT_EDITMSG"
---

# Commit Message Guidelines

Keep the commit message simple and straightforward. Write it as a senior
engineer committing their own work, so a junior dev can follow up on it from
the log alone.

Good example:

```text
fix(desktop): validate settings before persisting
```

Bad example:

```text
Fixed the fetched settings save failing with a random exception that turned
out to be caused by some schema validation error.
```

## Commit Structure

Each and every commit must follow the structure below:

```text
[action]([change-related-item]): [simple-straightforward-clear-message]

context:
[explain what happened and why the change is needed]

changes include:
- [specific individual change made to a specific component/file]
- [specific individual change made to a specific component/file]
...

Co-Authored-By: [harness] <email-related-to-harness>
Co-Authored-By: [model] ([context-size], [reasoning-level]) <email-related-to-model>
```

- `action` is the task done: `feat`, `fix`, `docs`, `test`, `chore` or
  `refactor` — the types this repo's history actually uses.
- `change-related-item` names the part of the codebase touched: a workspace
  (`desktop`, `renderer`, `shared`) or a subsystem (`hooks`, `scripts`, `ci`,
  `config`, `tsconfig`, `knip`, `github`). Be specific to the given task.
- `simple-straightforward-clear-message` states the change so a dev recognizes
  it in oneline logs. Lowercase, imperative verb, no trailing period.
- `context` is a short paragraph explaining the problem and how this change
  relates to it — the why, not a restatement of the diff.
- `changes include` lists the specific technical changes, per file or
  component.

For example:

```text
feat(renderer): apply the persisted theme on first paint

context:
Settings already round-trip through the preload bridge and the store, but
nothing consumed them yet, so the theme enum in the shared schema was dead
weight and dark mode never engaged. Reading the bridge in the root route makes
the existing schema load-bearing without adding a second state container.

changes include:
- Read `getSettings()` from `window.azdo` in
  `apps/renderer/src/routes/__root.tsx` and pin `data-theme` on the shell.
- Add a renderer test asserting the shell attribute matches the mocked bridge.
- Extend `AzdoBridge` with an `onSettingsChanged` subscription in
  `packages/shared/src/ipc.ts`.

Co-Authored-By: [harness] <email-related-to-harness>
Co-Authored-By: [model] ([context-size], [reasoning-level]) <email-related-to-model>
```

## Repo rules

- One logical change per commit. The agentic workflow in
  [AGENTS.md](../../../AGENTS.md) commits each modular change only after its
  checks pass — do not batch unrelated changes to save commits.
- Fill the `Co-Authored-By` trailers with the harness and the model that
  actually produced the commit. Never copy a previous commit's trailer and
  never fabricate the values.
- Message format is not a license for vagueness: the subject line and every
  `changes include` bullet must name the real files or components touched.
