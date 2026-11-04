// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 语言包体检：包里每个 id 都应该有名字。
 *
 * 查三类：
 *   1. 组件 / 模板 / 地形 / 世界 —— 有没有 name、desc
 *   2. 规则 —— 只看 RULE_TABLE 里的 tag
 *   3. 语言包里没人用的键（可选，提示用）
 *
 * 用法：node tools/check-locale.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { RULE_TABLE } from "../game/systems/rules/index.ts";

const LOCALE = JSON.parse(readFileSync("game/locales/zh-CN.json", "utf8"));
const WORLDS = "game/worlds";

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function listPackFiles() {
  const out = [];
  for (const pack of readdirSync(WORLDS)) {
    const dir = join(WORLDS, pack);
    if (!statSync(dir).isDirectory()) continue;
    const walk = (path) => {
      for (const name of readdirSync(path)) {
        const full = join(path, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name.endsWith(".json") && name !== "pack.json" && name !== "world.json") out.push(full);
      }
    };
    walk(dir);
  }
  return out;
}

const ids = { component: new Set(), template: new Set(), terrain: new Set(), world: new Set(), space: new Set() };

for (const file of listPackFiles()) {
  const raw = readJson(file);
  const items = Array.isArray(raw) ? raw : [raw];
  for (const item of items) {
    if (typeof item !== "object" || item === null) continue;
    const name = file.replaceAll("\\", "/");

    if (name.endsWith("components.json") && typeof item.id === "string") ids.component.add(item.id);
    else if (name.includes("/templates/") && typeof item.id === "string") ids.template.add(item.id);
    else if (name.endsWith("terrains.json") && item.id !== undefined) ids.terrain.add(String(item.id));
    else if (name.includes("/spaces/") && typeof item.id === "string") ids.space.add(item.id);
  }
}

// 世界：world.json 所在目录名就是 id
for (const pack of readdirSync(WORLDS)) {
  try {
    const manifest = readJson(join(WORLDS, pack, "pack.json"));
    if (statSync(join(WORLDS, pack, "world.json")).isFile()) ids.world.add(manifest.id);
  } catch {
    // 不是能玩的世界
  }
}

const missing = [];
const need = (kind, id, field) => {
  const key = `${kind}.${id}.${field}`;
  if (LOCALE[key] === undefined || String(LOCALE[key]).length === 0) missing.push(key);
};

for (const id of ids.component) {
  need("component", id, "name");
  need("component", id, "desc");
}
for (const id of ids.template) {
  need("template", id, "name");
  need("template", id, "desc");
}
for (const id of ids.terrain) need("terrain", id, "name");
for (const id of ids.world) for (const field of ["name", "desc"]) need("world", id, field);
for (const rule of RULE_TABLE) {
  need("rule", rule.signature.tag, "name");
  need("rule", rule.signature.tag, "desc");
}

if (missing.length === 0) {
  console.log("语言包完整：所有名字都有");
  process.exit(0);
}

console.log(`缺 ${missing.length} 条：`);
for (const key of missing.join("\n").split("\n")) console.log("  " + key);
process.exit(1);
