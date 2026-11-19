// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 校验内容树：catalog + layers + 每个节点的 manifest/层文件。
 *
 * 用法：
 *   node tools/check-content.mjs
 *   node tools/check-content.mjs game/worlds/normal/content
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  parseContentCatalog,
  parseLayerRegistry,
  parseNodeManifest,
  validateNode,
} from "../game/systems/content/tree.ts";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

function contentDirs(args) {
  if (args.length > 0) return args.map((arg) => resolve(arg));

  const roots = [];
  const worlds = "game/worlds";
  for (const name of readdirSync(worlds)) {
    const full = join(worlds, name);
    if (!statSync(full).isDirectory()) continue;
    const dir = join(full, "content");
    if (existsSync(dir)) roots.push(resolve(dir));
  }
  return roots;
}

let failed = 0;

for (const dir of contentDirs(process.argv.slice(2))) {
  console.log(`内容树：${dir}`);
  if (!existsSync(join(dir, "catalog.json"))) {
    console.log("  没有 catalog.json，跳过");
    continue;
  }

  const errors = [];
  const warnings = [];

  let catalog;
  let registry;
  try {
    catalog = parseContentCatalog(readJson(join(dir, "catalog.json")));
    registry = parseLayerRegistry(readJson(join(dir, "layers.json")));
  } catch (error) {
    console.log("  ✗ " + (error instanceof Error ? error.message : String(error)));
    failed += 1;
    continue;
  }

  for (const node of catalog.nodes.values()) {
    const entry = resolve(dir, node.entry);
    if (!existsSync(entry)) {
      errors.push(`${node.id}：manifest 不存在（${node.entry}）`);
      continue;
    }

    let manifest;
    try {
      manifest = parseNodeManifest(readJson(entry));
    } catch (error) {
      errors.push(`${node.id}：${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    if (manifest.id !== node.id) {
      errors.push(`${node.id}：manifest.id 是 ${manifest.id}`);
      continue;
    }

    const layerData = {};
    const nodeDir = dirname(entry);
    for (const [id, file] of Object.entries(manifest.layers)) {
      const path = resolve(nodeDir, file);
      if (!existsSync(path)) {
        errors.push(`${node.id}：层 ${id} 文件不存在（${file}）`);
        continue;
      }
      try {
        layerData[id] = readJson(path);
      } catch (error) {
        errors.push(`${node.id}：层 ${id} JSON 解析失败：${error.message}`);
      }
    }

    const result = validateNode(manifest, registry, layerData);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  for (const error of errors) console.log("  ✗ " + error);
  for (const warning of warnings) console.log("  ! " + warning);
  console.log(`  ${catalog.nodes.size} 个节点 / ${errors.length} 错误 / ${warnings.length} 警告`);
  if (errors.length > 0) failed += 1;
}

process.exit(failed === 0 ? 0 : 1);
