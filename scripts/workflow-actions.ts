/**
 * `uses:` references inside a GitHub Actions workflow file.
 *
 * Text scan, not a YAML parse: the repo has no YAML parser dependency, and a
 * `uses:` value is always one line of `owner/repo[/path]@ref`, which no YAML
 * feature can reshape. The version comment this repo keeps after the pin is
 * stripped, so `uses: owner/repo@sha # v1.2.3` yields the action and its ref.
 */
export interface ActionReference {
  /** Everything before the `@`: `owner/repo`, `owner/repo/path`, or `./local`. */
  action: string;
  /** Everything after the `@`, or `null` for a local action, which carries none. */
  ref: string | null;
}

const USES_PATTERN = /^\s*uses:\s*(\S+)(?:\s+#.*)?\s*$/;

const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function actionReferencesIn(workflow: string): ActionReference[] {
  const references: ActionReference[] = [];

  for (const line of workflow.split("\n")) {
    const match = USES_PATTERN.exec(line);
    if (match === null) continue;

    const value = match[1] ?? "";
    const separator = value.lastIndexOf("@");
    references.push(
      separator === -1
        ? { action: value, ref: null }
        : { action: value.slice(0, separator), ref: value.slice(separator + 1) },
    );
  }

  return references;
}

/**
 * The actions a workflow runs without pinning them to a full commit SHA.
 *
 * A tag is mutable: it can be repointed at another commit, so a workflow that
 * uses `@v1.2.3` executes whatever that tag says on the day the job runs — which
 * is also how a compromised release gets in. Local actions carry no ref and
 * cannot move, so they are never reported.
 */
export function unpinnedReferences(references: ActionReference[]): ActionReference[] {
  return references.filter(({ ref }) => ref !== null && !SHA_PATTERN.test(ref));
}
