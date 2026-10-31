// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * CSV → 模板 JSON（宿主侧工具）。
 *
 * 为什么是 CSV 而不是 XML：
 *   内核只认 JSON。多一种格式就多一套解析、报错、校验和两份真相。
 *   所以「快速造物品」这件事放在工具里做：读表格，吐 JSON。
 *
 * 用法：
 *   node tools/import-csv.mjs items.csv             # 打到 stdout
 *   node tools/import-csv.mjs items.csv -o out.json # 写文件
 *
 * 表头约定：
 *   id        必填，模板 id
 *   extends   可选，父模板 id（继承）
 *   其余列    形如 core.item.stack（组件名.字段名）
 *
 * 例：
 *   id,extends,core.item.stack,core.item.weight,core.item.use
 *   lamp,item_base,1,1,light
 *   rope,item_base,1,3,
 */

import { readFileSync, writeFileSync } from "node:fs";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/** "1" → 1，"true" → true，空 → 跳过，其他当字符串。 */
function coerce(text) {
  const value = text.trim();
  if (value === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^-?\d+\.\d+$/.test(value)) return Number(value);
  return value;
}

export function csvToTemplates(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("CSV 是空的");

  const header = rows[0].map((cell) => cell.trim());
  if (!header.includes("id")) throw new Error("表头缺少 id 列");

  const columnIndex = new Map();
  for (const [index, name] of header.entries()) {
    if (name === "id" || name === "extends") continue;
    // core.item.stack → 组件 core.item，字段 stack
    const parts = name.split(".");
    const field = parts.pop();
    const component = parts.join(".");
    if (parts.length < 2 || field === undefined || !/^[a-z][a-z0-9_]*$/.test(field)) {
      throw new Error(`列名非法："${name}"，应形如 core.item.stack`);
    }
    columnIndex.set(index, { component, field });
  }

  return rows.slice(1).map((cells, rowNumber) => {
    const id = cells[header.indexOf("id")]?.trim();
    if (id === undefined || id === "") {
      throw new Error(`第 ${rowNumber + 2} 行缺少 id`);
    }

    const template = { id, components: {} };
    const extendAt = header.indexOf("extends");
    const parent = extendAt >= 0 ? cells[extendAt]?.trim() : "";
    if (parent !== undefined && parent !== "") {
      template.extends = parent;
    }

    for (const [index, { component, field }] of columnIndex) {
      const value = coerce(cells[index] ?? "");
      if (value === undefined) continue;
      template.components[component] = { ...(template.components[component] ?? {}), [field]: value };
    }

    return template;
  });
}

// 直接运行时
if (process.argv[1]?.endsWith("import-csv.mjs")) {
  const args = process.argv.slice(2);
  const input = args[0];
  if (input === undefined) {
    console.error("用法：node tools/import-csv.mjs <items.csv> [-o out.json]");
    process.exit(2);
  }

  const templates = csvToTemplates(readFileSync(input, "utf8"));
  const json = JSON.stringify(templates, null, 2) + "\n";

  const outAt = args.indexOf("-o");
  if (outAt >= 0 && args[outAt + 1] !== undefined) {
    writeFileSync(args[outAt + 1], json, "utf8");
    console.log(`写出 ${templates.length} 个模板：${args[outAt + 1]}`);
  } else {
    process.stdout.write(json);
  }
}
