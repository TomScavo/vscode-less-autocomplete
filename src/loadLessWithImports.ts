import * as vscode from "vscode";
import { resolve, dirname } from "path";
import { readFileSync } from "fs";

const fileSuffixs = ["css", "less"];

function getRegexpMatches(regexp: RegExp, text: string) {
  const matches = [];
  const lastIndex = regexp.lastIndex;

  let match;
  do {
    match = regexp.exec(text);
    if (match) {
      matches.push(match);
    }
  } while (match && regexp.global);

  regexp.lastIndex = lastIndex;

  return matches;
}

const importRegExp = /^@import\s+(\([A-Za-z\s,]+\))?\s*['"]([^'"]+)['"];$/gm;

export default function getImportsPath(
  uri: vscode.Uri,
  entry: string,
  suffix: string = "less"
) {
  const memo: string[] = [];
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri as any)?.uri
    .fsPath;
  const root = resolve(workspaceFolder || "");

  function loadLessWithImports(entry: string): {
    imports: string[];
  } {
    if (!entry) {
      return {
        imports: [],
      };
    }
    const entryPath = resolve(workspaceFolder || "", entry);
    const input = readFileSync(entryPath, "utf8");
    const m = getRegexpMatches(importRegExp, input);
    const imports: any[] = getRegexpMatches(importRegExp, input).map(
      (match) => {
        const importPath = match[match.length - 1];
        for (const fileSuffix of fileSuffixs) {
          if (
            fileSuffix !== suffix &&
            new RegExp(`\\.${fileSuffix}$`).test(importPath)
          ) {
            return;
          }
        }
        const fullImportPath = new RegExp(`\\.${suffix}$`).test(importPath)
          ? importPath
          : `${importPath}.${suffix}`;
        const resolvedImportPath = /^~/.test(importPath)
          ? /^~@\//.test(importPath)
            ? resolve(root, "src", fullImportPath.slice(3))
            : resolve(root, "node_modules", fullImportPath.slice(1))
          : resolve(dirname(entryPath), fullImportPath);
        if (!memo.includes(resolvedImportPath)) {
          memo.push(resolvedImportPath);
          return {
            match,
            path: resolvedImportPath,
            ...loadLessWithImports(resolvedImportPath),
          };
        }
      }
    );
    return {
      imports: imports
        .filter((value) => value !== undefined)
        .reduce(
          (acc, { path, imports: nestedImports }) => [
            ...acc,
            ...nestedImports,
            path,
          ],
          []
        ),
    };
  }

  return loadLessWithImports(entry).imports;
}
