// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 把 TS 转成浏览器能跑的 JS（构建产物放 web/）。
 *
 * 为什么不引打包器：我们只要「把 .ts 变成 .js 并改一下 import 后缀」。
 * TypeScript 本身就能做（transpileModule），而且已经为了类型检查找到它了。
 * 浏览器原生支持 ES 模块，目录结构保持不变即可。
 *
 * 用法：
 *   node tools/build-web.mjs
 *   TSC_PATH=/path/to/typescript.js node tools/build-web.mjs
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { homedir } from "node:os";

/** 找 TypeScript：环境变量 → 已安装的包 → 编辑器自带。 */
function findTypeScript() {
  const candidates = [
    process.env.TSC_PATH,
    join(process.cwd(), "node_modules", "typescript", "lib", "typescript.js"),
    join(homedir(), "AppData", "Local", "Programs", "cursor", "resources", "app", "extensions", "node_modules", "typescript", "lib", "typescript.js"),
    join(homedir(), "AppData", "Local", "Programs", "Microsoft VS Code", "resources", "app", "extensions", "node_modules", "typescript", "lib", "typescript.js"),
    "/usr/lib/node_modules/typescript/lib/typescript.js",
    "/usr/local/lib/node_modules/typescript/lib/typescript.js",
  ].filter((path) => typeof path === "string" && path.length > 0);

  return candidates.find((path) => existsSync(path));
}

const TS_PATH = findTypeScript();
if (TS_PATH === undefined) {
  console.error("找不到 TypeScript。设置 TSC_PATH 指向 typescript.js，或者 npm i -D typescript。");
  process.exit(2);
}

const ts = (await import(pathToFileURL(TS_PATH).href)).default;

const ROOTS = ["systems", "engine/core/src"];
const OUT = "web";

/** 收集 .ts，跳过测试。 */
function collect(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      files.push(...collect(path));
    } else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) {
      files.push(path);
    }
  }
  return files;
}

rmSync(OUT, { recursive: true, force: true });

let count = 0;
for (const root of ROOTS) {
  for (const file of collect(root)) {
    const source = readFileSync(file, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues?.Remove ?? undefined,
      },
      fileName: file,
    }).outputText;

    // 浏览器不认 .ts 后缀，改成 .js（目录结构保持一致）
    const fixed = output.replace(/(from\s+["'][^"']+)\.ts(["'])/g, "$1.js$2");

    const target = join(OUT, file.replace(/\.ts$/, ".js"));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, fixed, "utf8");
    count += 1;
  }
}

console.log(`构建完成：${count} 个文件 → ${OUT}/`);
console.log(`入口：/${relative(".", join(OUT, "systems/render/browser.js"))}`);
