// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 每个源文件生成一篇 md（docs/files/...）。
 *
 * 为什么自动生成：手写的文件说明一定会和代码分叉。
 * 这里只写「机器能确定的东西」：
 *   文件头的说明、导出了什么、依赖谁、被谁依赖、有没有测试。
 *
 * 「为什么这么写」这类判断留给 docs/areas 与 docs/systems（手写）。
 *
 * 用法：node tools/gen-file-docs.mjs
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOTS = ["game", "tools"];
const OUT = "docs/files";
const SKIP = /(^|\/)(node_modules|web|\_|\.)/;

function listFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(process.cwd(), full).replaceAll("\\", "/");
    if (SKIP.test(name)) continue;
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === "web") continue;
      listFiles(full, out);
    } else if (/\.(ts|mjs|js)$/.test(name) && !/\.test\.(ts|js)$/.test(name)) {
      out.push(rel);
    }
  }
  return out;
}

/** 文件头注释：第一个块注释或连续 // 行。 */
function headerOf(source) {
  // 跳过文件头的 SPDX 行与空行，再找块注释
  const stripped = source
    .replace(/^\uFEFF/, "")
    .replace(/^(?:\s*\/\/[^\n]*\n)+/, "")
    .replace(/^\s+/, "");
  const block = stripped.match(/^\/\*\*([\s\S]*?)\*\//);
  if (block !== null) {
    return block[1]
      .split("\n")
      .map((line) => line.replace(/^\s*\*\s?/, "").trim())
      .filter((line) => line.length > 0 && !line.startsWith("SPDX"))
      .join("\n");
  }
  const lines = source.split("\n");
  const collected = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) collected.push(trimmed.replace(/^\/\/\s?/, ""));
    else if (trimmed.length > 0) break;
  }
  return collected.filter((line) => !line.startsWith("SPDX")).join("\n");
}

function exportsOf(source) {
  const names = [];
  for (const match of source.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class|interface|type)\s+([A-Za-z0-9_$]+)/g)) {
    names.push(match[1]);
  }
  return [...new Set(names)].sort();
}

/** 相对/浏览器路径 → 仓库内路径。 */
function resolveSpecifier(fromFile, spec) {
  if (spec.startsWith("/web/")) {
    const rel = spec.slice("/web/".length).replace(/\.js$/, ".ts");
    for (const candidate of [rel, rel.replace(/\.ts$/, ".js")]) {
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        // 试下一个
      }
    }
    return null;
  }
  if (spec.startsWith("/client/")) {
    const rel = "tools/client/" + spec.slice("/client/".length);
    try {
      if (statSync(rel).isFile()) return rel;
    } catch {
      return null;
    }
    return rel;
  }
  if (!spec.startsWith(".")) return null;

  const base = spec.replace(/^\.\.?\//, "");
  void base;
  const target = join(dirname(fromFile), spec);
  for (const candidate of [target, target + ".ts", target + ".js", target + ".mjs", join(target, "index.ts")]) {
    try {
      if (statSync(candidate).isFile()) return relative(process.cwd(), candidate).replaceAll("\\", "/");
    } catch {
      // 试下一个
    }
  }
  return null;
}

function importsOf(file) {
  const source = readFileSync(file, "utf8");
  const specs = [];
  for (const match of source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
    const resolved = resolveSpecifier(file, match[1]);
    if (resolved !== null) specs.push(resolved);
  }
  return [...new Set(specs)].sort();
}

function main() {
  const files = ROOTS.flatMap((root) => (statSync(root).isDirectory() ? listFiles(root) : []));
  const imports = new Map(files.map((file) => [file, importsOf(file)]));

  const reverse = new Map();
  for (const [file, deps] of imports) {
    for (const dep of deps) {
      if (!reverse.has(dep)) reverse.set(dep, []);
      reverse.get(dep).push(file);
    }
  }

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const index = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const header = headerOf(source);
    const exports = exportsOf(source);
    const deps = imports.get(file) ?? [];
    const users = reverse.get(file) ?? [];
    const test = files.includes(`${file.replace(/\.(ts|mjs|js)$/, "")}.test.ts`)
      ? file.replace(/\.(ts|mjs|js)$/, ".test.ts")
      : null;

    const summary = header.split("\n").find((line) => line.trim().length > 0) ?? "";

    const lines = [
      `# \`${file}\``,
      "",
      summary,
      "",
      "## 导出",
      "",
      ...(exports.length === 0 ? ["（没有导出）"] : exports.map((name) => `- \`${name}\``)),
      "",
      "## 依赖",
      "",
      ...(deps.length === 0 ? ["（无）"] : deps.map((dep) => `- [\`${dep}\`](${toDocPath(dep)})`)),
      "",
      "## 被引用",
      "",
      ...(users.length === 0 ? ["（没有别的文件引用它）"] : users.map((user) => `- [\`${user}\`](${toDocPath(user)})`)),
      "",
    ];

    if (test !== null) {
      lines.push("## 测试", "", `- \`${test}\``, "");
    }

    const outFile = join(OUT, file.replace(/\.(ts|mjs|js)$/, ".md"));
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, lines.join("\n"), "utf8");

    index.push(`| \`${file}\` | ${summary} | [md](${toDocPath(file)}) |`);
  }

  const readme = [
    "# 文件说明（自动生成）",
    "",
    "> 由 `node tools/gen-file-docs.mjs` 生成，**不要手改**。",
    "> 只写机器能确定的东西（导出、依赖、被引用、测试）。",
    "> 「为什么这么写」见 [areas](../areas) 与 [systems](../systems)。",
    "",
    `共 ${files.length} 个文件。`,
    "",
    "| 文件 | 一句话 | 说明 |",
    "|---|---|---|",
    ...index,
    "",
  ];
  writeFileSync(join(OUT, "README.md"), readme.join("\n"), "utf8");

  console.log(`生成 ${files.length} 篇文件说明 → ${OUT}/`);
}

function toDocPath(file) {
  return relative(OUT, join(OUT, file)).replaceAll("\\", "/").replace(/\.(ts|mjs|js)$/, ".md");
}

main();
