// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 页面脚本的「有没有调用不存在的函数」检查。
 *
 * 起因：替换一大段代码时，连带删掉了中间的几个函数定义，
 * 而 node --check 只查语法、查不出「调用了没定义的东西」。
 *
 * 做法：扫 \bname\b( 形式，排除属性访问、导入、局部声明和内置全局。
 * 这是启发式检查，不完美——但能抓住「整段函数被删」这种事故。
 *
 * 用法：node tools/check-client.mjs
 */

import { readFileSync } from "node:fs";

const FILES = [
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
  "alert", "atob", "btoa", "confirm", "prompt", "clearInterval", "clearTimeout", "console", "decodeURIComponent",
  "document", "encodeURIComponent", "fetch", "isNaN", "localStorage", "parseFloat", "parseInt",
  "requestAnimationFrame", "setInterval", "setTimeout", "structuredClone", "window",
  "if", "for", "while", "switch", "catch", "return", "typeof", "function", "await", "new",
  // 以下不是函数调用，是正则/箭头函数的误报
  "async", "Digit",
]);

let failed = 0;

for (const file of FILES) {
  const source = readFileSync(file, "utf8");

  // 定义：function X / const X = / let X = / 解构的参数先不处理
  const defined = new Set();
  for (const match of source.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)|(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)/g)) {
    defined.add(match[1] ?? match[2]);
  }
  // import { a, b as c }
  for (const match of source.matchAll(/import\s*\{([^}]+)\}/g)) {
    for (const piece of match[1].split(",")) {
      const name = piece.trim().split(/\s+as\s+/).pop();
      if (name !== undefined && name.length > 0) defined.add(name.replace(/\s+/g, ""));
    }
  }
  // 对象方法简写与 getter/setter：foo(a) { ... } / get foo() { ... }
  for (const match of source.matchAll(/(?:^|\n)\s*(?:get|set)\s+([A-Za-z0-9_$]+)\s*\(/g)) {
    defined.add(match[1]);
  }
  for (const match of source.matchAll(/(?:^|\n)\s*([A-Za-z0-9_$]+)\s*\([^)]*\)\s*\{/g)) {
    defined.add(match[1]);
  }

  // 函数参数与解构（先按「出现过的名字」一律放过，减少误报）
  for (const match of source.matchAll(/(?:function\s*[A-Za-z0-9_$]*\s*\(([^)]*)\)|\(([^)]*)\)\s*=>)/g)) {
    for (const piece of (match[1] ?? match[2] ?? "").split(",")) {
      const name = piece.trim().split(/[=:]/)[0].replace(/[{}.\s]/g, "");
      if (/^[A-Za-z0-9_$]+$/.test(name)) defined.add(name);
    }
  }

  // 重复声明：同一文件顶层出现两次同名（模块作用域会直接 SyntaxError）
  const seen = new Map();
  const duplicates = [];
  for (const match of source.matchAll(/(?:^|\n)(?:export\s+)?(?:async\s+)?(?:function|const|let|var)\s+([A-Za-z0-9_$]+)/g)) {
    const name = match[1];
    const line = source.slice(0, match.index).split("\n").length;
    if (seen.has(name)) duplicates.push(`${name}（第 ${seen.get(name)} 行与第 ${line} 行）`);
    else seen.set(name, line);
  }

  if (duplicates.length > 0) {
    failed += 1;
    console.log(`${file}: 重复声明`);
    for (const item of duplicates) console.log("  ✗ " + item);
  }

  const missing = new Map();
  for (const match of source.matchAll(/(^|[^.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
    const name = match[2];
    if (defined.has(name) || GLOBALS.has(name)) continue;
    const line = source.slice(0, match.index).split("\n").length;
    if (!missing.has(name)) missing.set(name, line);
  }

  if (missing.size === 0) {
    console.log(`${file}: 没问题`);
  } else {
    failed += 1;
    console.log(`${file}: 可能调用不存在的函数`);
    for (const [name, line] of missing) console.log(`  第 ${line} 行：${name}()`);
  }
}

process.exit(failed === 0 ? 0 : 1);
