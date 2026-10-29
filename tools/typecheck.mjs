// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 离线类型检查。
 *
 * Node 只会剥离类型、不会检查类型，所以需要单独跑一次 tsc。
 *
 * 用法：
 *   node tools/typecheck.mjs                     # 用本地安装的 typescript
 *   TSC_PATH=/path/to/typescript.js node tools/typecheck.mjs   # 用现成的编译器
 *
 * 没装 typescript 也没给 TSC_PATH 时，会打印安装说明并退出。
 */

import { createRequire } from "node:module";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);

function loadTypeScript() {
  const candidates = [process.env.TSC_PATH, "typescript"].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // 继续试下一个
    }
  }
  console.error("找不到 TypeScript 编译器。任选一种：");
  console.error("  1. npm i -D typescript");
  console.error("  2. 设置环境变量 TSC_PATH 指向 typescript.js");
  process.exit(2);
}

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (name.endsWith(".ts")) out.push(full);
  }
  return out;
}

const ts = loadTypeScript();
const options = {
  strict: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  allowImportingTsExtensions: true,
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  skipLibCheck: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  noImplicitReturns: true,
};

const files = [...collect("engine/core/src"), ...collect("engine/core/types")];
const program = ts.createProgram(files, options);
const diagnostics = ts.getPreEmitDiagnostics(program);

for (const d of diagnostics) {
  const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
  if (d.file && d.start !== undefined) {
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
    console.log(`${d.file.fileName}:${line + 1}:${character + 1}  TS${d.code}  ${message}`);
  } else {
    console.log(`TS${d.code}  ${message}`);
  }
}

console.log(`\n${diagnostics.length} 个类型错误`);
process.exit(diagnostics.length === 0 ? 0 : 1);
