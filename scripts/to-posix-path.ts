/**
 * Windows reports paths with backslashes from both `path.relative` and
 * `pnpm ls --parseable`, while every prefix check and regex in this repo's
 * tooling is written for `/`. Normalize once here: without it the
 * architecture boundary rules silently pass on Windows (`inPackages` never
 * matches `packages\shared\...`) and the effect store-path regex matches
 * nothing.
 */
export function toPosixPath(path: string): string {
  return path.replaceAll("\\", "/");
}
