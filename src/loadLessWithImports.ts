import * as vscode from "vscode";
import { resolve, dirname } from "path";
import { readFileSync } from "fs";

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

const importRegExp = /^@import\s+['"]([^'"]+)['"];$/gm;

export default function getImportsPath(uri: vscode.Uri, entry: string) {
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
    const imports: any[] = getRegexpMatches(importRegExp, input).map(
      (match) => {
        const importPath = match[1];
        const fullImportPath = /\.less$/.test(importPath)
          ? importPath
          : `${importPath}.less`;
        const resolvedImportPath = /^~/.test(importPath)
          ? resolve(root, "node_modules", fullImportPath.slice(1))
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
      imports:
        imports[0] !== undefined
          ? imports.reduce(
              (acc, { path, imports: nestedImports }) => [
                ...acc,
                ...nestedImports,
                path,
              ],
              []
            )
          : [],
    };
  }

  return loadLessWithImports(entry).imports;
}
