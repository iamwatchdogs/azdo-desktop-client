/**
 * ts-morph import guard: packages must not import apps, the renderer must not
 * import electron, and process code must not import react.
 */
import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

import { Project, SyntaxKind } from "ts-morph";

const root = process.cwd();
const tsconfigPath = resolve(root, "tsconfig.json");

if (!existsSync(tsconfigPath)) {
  console.error("architecture-check: run from the repository root");
  process.exit(1);
}

const project = new Project({ tsConfigFilePath: tsconfigPath });
const sourceFiles = project
  .getSourceFiles()
  .filter((file) => !file.isInNodeModules() && !file.isDeclarationFile());

function moduleSpecifiers(file: (typeof sourceFiles)[number]): string[] {
  const staticImports = file
    .getImportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue());
  const staticReExports = file
    .getExportDeclarations()
    .map((declaration) => declaration.getModuleSpecifierValue() ?? "");
  const dynamicImports = file
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((call) => call.getExpression().getText() === "import")
    .map((call) => {
      const [argument] = call.getArguments();
      return argument !== undefined && argument.isKind(SyntaxKind.StringLiteral)
        ? argument.getLiteralValue()
        : "";
    });
  return [...staticImports, ...staticReExports, ...dynamicImports].filter((spec) => spec !== "");
}

const EFFECT_SPECIFIER = /^effect(?:\/|$)/;

/** Mirrors Effect's own agentic reference repo: no Effect past the process edge. */
const EFFECT_BANNED_IN = /(?:^|\/)(?:renderer|preload)\//;

const violations: string[] = [];

for (const file of sourceFiles) {
  const relativePath = relative(root, file.getFilePath());
  if (relativePath.includes("routeTree.gen")) continue;

  const inPackages = relativePath.startsWith("packages/");
  const inRenderer = relativePath.includes("/renderer/");
  const inMainProcess =
    relativePath.startsWith("apps/desktop/src/main") ||
    relativePath.startsWith("apps/desktop/src/preload");

  for (const specifier of moduleSpecifiers(file)) {
    if (inPackages && (specifier.startsWith("@ado/desktop") || specifier.includes("/apps/"))) {
      violations.push(`${relativePath}: shared code must not depend on app code (${specifier})`);
    }
    if (inRenderer && (specifier === "electron" || specifier.startsWith("electron/"))) {
      violations.push(`${relativePath}: renderer must not import electron (${specifier})`);
    }
    if (
      inMainProcess &&
      (specifier === "react" ||
        specifier === "react-dom" ||
        specifier.startsWith("react-dom/") ||
        specifier === "@vitejs/plugin-react")
    ) {
      violations.push(`${relativePath}: process code must not import react (${specifier})`);
    }
    // Effect values do not survive contextBridge: structured clone drops the
    // prototype getters and symbol keys they keep state behind, so a tagged
    // error crosses as a bare {} and an Effect throws DataCloneError. Effect
    // therefore lives only in the main process, and the boundary is a rule
    // rather than a convention so an agent cannot erode it.
    if ((inPackages || EFFECT_BANNED_IN.test(relativePath)) && EFFECT_SPECIFIER.test(specifier)) {
      violations.push(
        `${relativePath}: effect must stay out of shared code and the renderer (${specifier})`,
      );
    }
  }
}

if (violations.length > 0) {
  console.error(`architecture-check: ${violations.length} violation(s)`);
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log(`architecture-check: ok (${sourceFiles.length} files)`); // debug-statements: allow
