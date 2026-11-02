// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 读包工具（宿主侧）：把文件夹变成 PackContent。
 *
 * 和 core 的分工：
 *   core 只认识「已经在内存里的 JSON」；
 *   这个脚本负责读磁盘、拼路径、报「哪个文件坏了」。
 *
 * 文件约定：每个文件是一个定义，或者一个定义数组。
 *   spaces/*.json      { id, width, height, terrain }        kind = space
 *   templates/*.json   { id, components }                    kind = template
 *   entities/*.json    { id, template, space, x, y }         kind = entity（id 只用于合并）
 *   terrains/*.json    { id: "0", name, passable }           kind = terrain
 *   world/*.json       { start, rules, onConflict }          kind = world（id 固定 main）
 *   patches/*.json     补丁数组
 *
 * 用法：
 *   node tools/pack-reader.mjs worlds/official.normal
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseManifest } from "../engine/core/src/pack/manifest.ts";

const KIND_BY_FOLDER = {
  spaces: "space",
  templates: "template",
  entities: "entity",
  terrains: "terrain",
  components: "component",
  groups: "group",
  world: "world",
};

export function readPack(dir) {
  const manifestPath = join(dir, "pack.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`不是包目录（缺少 pack.json）：${dir}`);
  }

  const manifest = parseManifest(readJson(manifestPath));
  const definitions = [];
  const patches = [];

  for (const [folder, kind] of Object.entries(KIND_BY_FOLDER)) {
    for (const file of filesOf(dir, manifest, folder)) {
      const raw = readJson(file);
      const items = Array.isArray(raw) ? raw : [raw];

      for (const [index, item] of items.entries()) {
        const where = `${file}#${index}`;
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          throw new Error(`${where}：应该是对象`);
        }
        definitions.push(toDefinition(kind, item, where));
      }
    }
  }

  for (const file of filesOf(dir, manifest, "patches")) {
    const raw = readJson(file);
    const items = Array.isArray(raw) ? raw : [raw];
    for (const [index, item] of items.entries()) {
      patches.push(item);
    }
  }

  return { pack: manifest, definitions, patches };
}

function toDefinition(kind, item, where) {
  if (kind === "world") {
    return { kind, id: "main", data: item };
  }

  const id = item.id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error(`${where}：缺少 id`);
  }

  // entity / terrain / component 的 id 只用于合并与补丁定位，不进运行时数据。
  if (kind === "entity" || kind === "terrain" || kind === "component" || kind === "group") {
    const { id: _ignored, ...data } = item;
    return { kind, id, data };
  }

  return { kind, id, data: item };
}

/** 清单里列了就按清单读，没列就按文件夹约定扫。 */
function filesOf(dir, manifest, folder) {
  const listed = manifest.files?.[folder];
  if (listed !== undefined) {
    return listed.map((relative) => {
      const full = join(dir, relative);
      if (!existsSync(full)) {
        throw new Error(`清单指定的文件不存在：${relative}（包 ${manifest.id}）`);
      }
      return full;
    });
  }

  const folderPath = join(dir, folder);
  if (!existsSync(folderPath)) {
    return [];
  }

  return readdirSync(folderPath)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => join(folderPath, name));
}

function readJson(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(`读不到文件：${path}`);
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${path}：JSON 解析失败 —— ${error.message}`);
  }
}

// 直接运行时：读一个包，打印摘要。
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (dir === undefined) {
    console.error("用法：node tools/pack-reader.mjs <包目录>");
    process.exit(2);
  }
  const content = readPack(dir);
  console.log(`包：${content.pack.id}@${content.pack.version}（${content.pack.kind}）`);
  for (const definition of content.definitions) {
    console.log(`  ${definition.kind.padEnd(8)} ${definition.id}`);
  }
  console.log(`补丁：${content.patches.length} 条`);
}
