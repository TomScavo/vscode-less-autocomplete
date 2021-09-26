/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { readFileSync } from 'fs';

function getTextBeforePosition(document: vscode.TextDocument, position: vscode.Position) {
  const documentText = document.getText();
	const textArr = documentText.split('\r\n');
	
	const beforeTextArr = textArr.slice(0, position.line);
	return beforeTextArr.join('') + textArr[position.line].substring(0, position.character);
}

function isComment(text: string) {
	return text.substring(0, 2) === '//';
}

// 获取提示名称，less文件获取 .mt-lg(); 格式， ts、tsx文件获取 mt-lg 格式
function getClassNames(text: string, isLessFile: boolean) {
	text = text.trim();
	if (isComment(text)) return [];

	const isClassNameLine = text[text.length - 1] === '{';
	if (!isClassNameLine) return [];

	const classNames = text
		.replace('{', '')
		.split(' ')
		.filter(Boolean)
		.map(name => name.split('.').pop())
		.filter(Boolean)
		.filter(name => !name?.includes(':'));

	if (isLessFile) {
		return classNames.map(name => `.${name}();`);
	}

	return classNames;
}

// 获取className对应的样式代码，用作展示
function getClassValues(classNameIndex: number, contentString: string[]) {
	let classValue = '{  \n';
	let finished = false;
	let currentLineIndex = classNameIndex;

	while (!finished) {
		const currentLintValue = contentString[currentLineIndex];
		currentLineIndex++;
		if (currentLintValue) {
			if (currentLintValue.includes('}')) {
				classValue += '}';
			} else {
				classValue += `&nbsp;&nbsp;&nbsp;&nbsp;${currentLintValue}  \n`;
			}
		}
		
		if (currentLintValue.includes('}') && !isComment(currentLintValue)) {
			finished = true;
		}
	}

	return {
		classValue,
		nextIndex: currentLineIndex
	};
}

// 递归读取utils.css文件的每一行，提取出工具类名称和对应的样式代码
function setCompletionMapValue(index: number, contentString: string[], map: Record<string, string>, isLessFile = true) {
	const totalLine = contentString.length;
	const nexIndex = index + 1;
	const currentLine = index + 1;
	const isLastLine = currentLine === totalLine;
	if (isLastLine) return;

	const classNames = getClassNames(contentString[index], isLessFile);
	if (!classNames.length) {
		setCompletionMapValue(nexIndex, contentString, map, isLessFile);
		return;
	}

	const { classValue, nextIndex } = getClassValues(index + 1, contentString);

	classNames.forEach(name => {
		map[name!] = classValue;
	});

	setCompletionMapValue(nextIndex, contentString, map, isLessFile);
}

function getUtilityClassesFilePath(document: vscode.TextDocument) {
  const filePath = document.uri.path;
  const srcIndex = filePath.lastIndexOf('/src');
  let utilityClassesFilePath;
  if (srcIndex !== -1) {
    utilityClassesFilePath = filePath.substring(0, srcIndex);
  } else {
    const forwardSlashIndex = filePath.lastIndexOf('/');
    utilityClassesFilePath = filePath.substring(0, forwardSlashIndex);
  }
  utilityClassesFilePath += '/node_modules/@fuxi/eevee-ui/dist/style/themes/utils.css';
  utilityClassesFilePath = utilityClassesFilePath.split(/\\|\//).filter(Boolean);
  utilityClassesFilePath = path.join(...utilityClassesFilePath);

  return utilityClassesFilePath;
}

function cssFileStringToClassNameValueMap(document: vscode.TextDocument, position: vscode.Position, isLessFile: boolean) {
	const beforeText = getTextBeforePosition(document, position);
	const classNameRegex = /.*(className=([^}])+)$/;
	const isValid = classNameRegex.test(beforeText);
	if (!isValid && !isLessFile) return {};

	try {
    const utilityClassesFilePath = getUtilityClassesFilePath(document);
		const map: Record<string, string> = {};
		const content = readFileSync(utilityClassesFilePath);
		const contentString = content.toString().split('\n').map(item => item.trim());
		setCompletionMapValue(0, contentString, map, isLessFile);
	
		return map;
	} catch(e) {
		return {};
	}
}

function provideCompletionItems({document, position, isLessFile = true}: {document: vscode.TextDocument, position: vscode.Position, isLessFile?: boolean}) {
	const res: vscode.CompletionItem[] = [];
	const classNameValueMap = cssFileStringToClassNameValueMap(document, position, isLessFile);

	Object.entries(classNameValueMap).map(([name, value]) => {
		const snippetCompletion = new vscode.CompletionItem(name);
		snippetCompletion.documentation = new vscode.MarkdownString(value);
		res.push(snippetCompletion);
	});

	return res;
}

export default function autocompleteUtilityClasses(context: vscode.ExtensionContext) {
	const lessFileProvider = vscode.languages.registerCompletionItemProvider('less', {
		provideCompletionItems: (document, position) => provideCompletionItems({document, position})
	});
	context.subscriptions.push(lessFileProvider);

	const jsxProvider = vscode.languages.registerCompletionItemProvider(
		['typescriptreact', 'javascriptreact', 'javascript'],
		{
			provideCompletionItems: (document, position) => provideCompletionItems({document, position, isLessFile: false})
		},'"', "'", " ");
	context.subscriptions.push(jsxProvider);
}
