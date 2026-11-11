// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 页面脚本的「有没有调用不存在的函数」检查。
 *
 * 起因：替换一大段代码时，连带删掉了中间的几个函数定义；
 * node --check 只查语法，查不出「调用了没定义的东西」。
 *
 * 做法：先剥掉字符串 / 模板字符串 / 注释，再扫 name( 形式，
 * 排除属性访问、导入、局部声明和内置全局。
 * 这是个启发式检查，不完美，但能抓住「整段函数被删」这种事故。
 *
 * 用法：node tools/check-client.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const FILES = [
  "tools/client/game.js",
  "tools/client/launcher.js",
  "tools/client/shared.js",
  "tools/client/hud/quickbar.js",
  "tools/client/hud/status.js",
  "tools/client/hud/minimap.js",
  "tools/client/hud/aim.js",
  "tools/client/windows/settings.js",
  "tools/client/windows/inventory.js",
];

const GLOBALS = new Set([
  "Array", "Boolean", "Date", "Element", "Error", "HTMLElement", "Intl", "JSON", "Map", "Math",
  "Number", "Object", "Promise", "Set", "String", "URLSearchParams", "WeakMap",
  "alert", "atob", "btoa", "confirm", "prompt", "clearInterval", "clearTimeout", "console",
  "decodeURIComponent", "document", "encodeURIComponent", "fetch", "isNaN", "localStorage",
  "parseFloat", "parseInt", "requestAnimationFrame", "setInterval", "setTimeout",
  "structuredClone", "window",
  "if", "for", "while", "switch", "catch", "return", "typeof", "function", "await", "new",
  "async",
]);

/**
 * 把字符串、模板字符串、注释替换成空格，保留换行（行号不变）。
 * 否则 CSS 里的 grayscale(...) 会被当成 JS 调用。
 */
export function stripNonCode(source) {
  let out = "";
  let i = 0;
  let mode = null;
  let inClass = false;
  // 上一个「代码字符」，用来判断 / 是除法还是正则开头
  let lastCode = "";

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (mode === null) {
      if (ch === "'") {
        mode = "single";
        out += " ";
      } else if (ch === '"') {
        mode = "double";
        out += " ";
      } else if (ch === "`") {
        mode = "template";
        out += " ";
      } else if (ch === "/" && next === "/") {
        mode = "line";
        out += "  ";
        i += 1;
      } else if (ch === "/" && next === "*") {
        mode = "block";
        out += "  ";
        i += 1;
      } else if (ch === "/" && /^([([{:;,=!&|?+\-*%^~<>]|)$/.test(lastCode)) {
        // 正则字面量：/^Digit([1-9])$/ 不是函数调用
        mode = "regex";
        inClass = false;
        out += " ";
      } else {
        out += ch;
        if (!/\s/.test(ch)) lastCode = ch;
      }
    } else if (mode === "regex") {
      if (ch === "\\") {
        out += "  ";
        i += 1;
      } else if (ch === "[") {
        inClass = true;
        out += " ";
      } else if (ch === "]") {
        inClass = false;
        out += " ";
      } else if (ch === "/" && !inClass) {
        mode = null;
        out += " ";
        lastCode = "/";
      } else {
        out += ch === "\n" ? "\n" : " ";
      }
    } else if (mode === "single" || mode === "double") {
      const quote = mode === "single" ? "'" : '"';
      if (ch === "\\") {
        out += "  ";
        i += 1;
      } else if (ch === quote) {
        mode = null;
        out += " ";
      } else {
        out += ch === "\n" ? "\n" : " ";
      }
    } else if (mode === "template") {
      if (ch === "\\") {
        out += "  ";
        i += 1;
      } else if (ch === "`") {
        mode = null;
        out += " ";
      } else {
        out += ch === "\n" ? "\n" : " ";
      }
    } else if (mode === "line") {
      if (ch === "\n") {
        mode = null;
        out += "\n";
      } else {
        out += " ";
      }
    } else {
      if (ch === "*" && next === "/") {
        mode = null;
        out += "  ";
        i += 1;
      } else {
        out += ch === "\n" ? "\n" : " ";
      }
    }

    i += 1;
  }

  return out;
}

/** 扫一段源码，返回缺失函数与重复声明。 */
export function scanSource(source) {
  const code = stripNonCode(source);

  // 定义：function X / const X = / let X =
  const defined = new Set();
  for (const match of code.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)|(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)/g)) {
    defined.add(match[1] ?? match[2]);
  }

  // import { a, b as c }
  for (const match of code.matchAll(/import\s*\{([^}]+)\}/g)) {
    for (const piece of match[1].split(",")) {
      const name = piece.trim().split(/\s+as\s+/).pop();
      if (name !== undefined && name.length > 0) defined.add(name.replace(/\s+/g, ""));
    }
  }

  // 对象方法 / getter / setter
  for (const match of code.matchAll(/(?:^|\n)\s*(?:get|set)\s+([A-Za-z0-9_$]+)\s*\(/g)) {
    defined.add(match[1]);
  }
  for (const match of code.matchAll(/(?:^|\n)\s*([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{/g)) {
    defined.add(match[1]);
  }

  // 函数参数（宁可放过，减少误报）
  for (const match of code.matchAll(/(?:function\s*[A-Za-z0-9_$]*\s*\(([^)]*)\)|\(([^)]*)\)\s*=>)/g)) {
    for (const piece of (match[1] ?? match[2] ?? "").split(",")) {
      const name = piece.trim().split(/[=:]/)[0].replace(/[{}.\s]/g, "");
      if (/^[A-Za-z0-9_$]+$/.test(name)) defined.add(name);
    }
  }

  // 重复声明（模块作用域会直接 SyntaxError）
  const seen = new Map();
  const duplicates = [];
  for (const match of code.matchAll(/(?:^|\n)(?:export\s+)?(?:async\s+)?(?:function|const|let|var)\s+([A-Za-z0-9_$]+)/g)) {
    const name = match[1];
    const line = code.slice(0, match.index).split("\n").length;
    if (seen.has(name)) duplicates.push(`${name}（第 ${seen.get(name)} 行与第 ${line} 行）`);
    else seen.set(name, line);
  }

  // 调用了但没定义
  const missing = new Map();
  for (const match of code.matchAll(/(^|[^.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
    const name = match[2];
    if (defined.has(name) || GLOBALS.has(name)) continue;
    const line = code.slice(0, match.index).split("\n").length;
    if (!missing.has(name)) missing.set(name, line);
  }

  return { missing: [...missing.entries()], duplicates };
}

function main() {
  let failed = 0;

  for (const file of FILES) {
    const { missing, duplicates } = scanSource(readFileSync(file, "utf8"));

    if (duplicates.length > 0) {
      failed += 1;
      console.log(`${file}: 重复声明`);
      for (const item of duplicates) console.log("  ✗ " + item);
    }

    if (missing.length === 0) {
      console.log(`${file}: 没问题`);
    } else {
      failed += 1;
      console.log(`${file}: 可能调用不存在的函数`);
      for (const [name, line] of missing) console.log(`  第 ${line} 行：${name}()`);
    }
  }

  return failed;
}

const isMain = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) process.exit(main() === 0 ? 0 : 1);
