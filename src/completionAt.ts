import * as vscode from "vscode";
const getColor = require("get-css-colors");

import utils from "./utils";

function provideCompletionItems(
  document: vscode.TextDocument,
  position: vscode.Position
) {
  // 光标位置不是@不处理
  if (document.lineAt(position).text[position.character - 1] !== "@") {
    return;
  }

  // 文件路径
  const allFile = utils.getLocations();

  // 汇总所有变量
  const allVars = utils.getVarsByFiles(allFile);

  const allDepVars = utils.getDepVars(allVars);

  const total = [];
  for (let key in allDepVars) {
    const documentation = allDepVars[key].reduce((pre, value, index) => {
      return (
        pre +
        `${value.key} : ${value.value} ;${
          index < allDepVars[key].length - 1 ? "\n" : ""
        }`
      );
    }, "");

    const lastColor = getColor(
      allDepVars[key][allDepVars[key].length - 1].value
    );

    if (lastColor && lastColor.length) {
      // 对于 color 属性定义
      total.push({
        detail: lastColor[lastColor.length - 1],
        label: {
          label: `${key}`,
          description: lastColor[lastColor.length - 1],
        },
        kind: vscode.CompletionItemKind.Color,
        documentation,
      });
    } else {
      total.push({
        label: {
          label: `${key}`,
          description: allDepVars[key][0].value,
        },
        kind: vscode.CompletionItemKind.Variable,
        documentation,
      });
    }
  }

  return total.length
    ? (total as any)
    : [
        {
          label: "@less-vars",
          kind: vscode.CompletionItemKind.Text,
          documentation:
            "未找到变量,可在setting.json中设置lessVars.locations为less文件绝对路径",
        },
      ];
}

function resolveCompletionItem() {
  return null;
}

module.exports = function (context: vscode.ExtensionContext) {
  // 注册代码建议提示，只有当按下“@”时才触发
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      "less",
      {
        provideCompletionItems,
        resolveCompletionItem,
      },
      "@"
    )
  );
};
