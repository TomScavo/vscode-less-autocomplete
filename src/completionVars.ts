import * as vscode from "vscode";
import * as css from "css";
import * as fs from "fs";
import { CompletionItem, CompletionList } from "vscode";
import type { Rule, Declaration } from "css";

async function provideCompletionItems(
  document: vscode.TextDocument,
  position: vscode.Position
) {
  const items: vscode.CompletionItem[] = [];
  const files = await vscode.workspace.findFiles("**/*.css", "/node_modules/");
  const allFile = files.map((file) => file.fsPath);
  console.log(allFile);

  allFile.forEach((filePath) => {
    const file = fs.readFileSync(filePath, "utf-8");
    const cssParsed = css.parse(file);
    const rootRule: Rule | undefined = cssParsed.stylesheet?.rules.find(
      (rule: Rule) => {
        const isRuleType = (rule.type = "rule");
        const hasRootSelector = rule?.selectors?.includes(":root");

        return Boolean(isRuleType && hasRootSelector);
      }
    );

    const declarations = rootRule?.declarations;
    const variables = declarations?.filter((declaration: Declaration) => {
      return Boolean(
        declaration.type === "declaration" &&
          declaration?.property?.startsWith("--")
      );
    });

    variables?.forEach((variable: Declaration) => {
      const label = {
        label: variable.property,
        description: variable.value,
      };
      const completionItem = new CompletionItem(
        variable.property!,
        vscode.CompletionItemKind.Variable
      );

      completionItem.label = label as any;
      completionItem.detail = variable.value;
      completionItem.insertText = `var(${variable.property})`;

      items.push(completionItem);
    });
  });

  const firstCharOfLinePosition = new vscode.Position(position.line, 0);
  const beforeCursorText =
    document
      .getText(new vscode.Range(firstCharOfLinePosition, position))
      ?.trim() || "";

  if (!beforeCursorText.match(/--([\w-]*)/)) {
    return null;
  }

  return new CompletionList(items);
}

function resolveCompletionItem() {
  return null;
}

module.exports = function (context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      ["css", "less"],
      {
        provideCompletionItems,
        resolveCompletionItem,
      },
      // TODO 这里设置指定字符才触发上述事件的设定未生效，待修复
      "-"
    )
  );
};
