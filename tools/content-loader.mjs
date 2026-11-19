// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 内容树的宿主侧加载器：读文件、调用纯校验、返回可运行节点。
 *
 * 放在 tools/ 而不是 core：只有宿主知道磁盘路径。
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

/**
 * 读一个包里所有 content/ 节点。
 * @param {string} packDir
 */
export function loadPackContent(packDir) {
  const dir = resolve(packDir, "content");
  const empty = { nodes: new Map(), registry: null, errors: [], warnings: [] };
  if (!existsSync(dir) || !existsSync(join(dir, "catalog.json"))) return empty;

  const errors = [];
  const warnings = [];
  let catalog;
  let registry;
  try {
    catalog = parseContentCatalog(readJson(join(dir, "catalog.json")));
    registry = parseLayerRegistry(readJson(join(dir, "layers.json")));
  } catch (error) {
    return {
      nodes: new Map(),
      registry: null,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings,
    };
  }

  const nodes = new Map();
  for (const entry of catalog.nodes.values()) {
    const manifestPath = resolve(dir, entry.entry);
    if (!existsSync(manifestPath)) {
      errors.push(`${entry.id}：manifest 不存在（${entry.entry}）`);
      continue;
    }

    let manifest;
    try {
      manifest = parseNodeManifest(readJson(manifestPath));
    } catch (error) {
      errors.push(`${entry.id}：${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    const layerData = {};
    const nodeDir = dirname(manifestPath);
    for (const [id, file] of Object.entries(manifest.layers)) {
      const path = resolve(nodeDir, file);
      if (!existsSync(path)) {
        errors.push(`${entry.id}：层 ${id} 文件不存在（${file}）`);
        continue;
      }
      try {
        layerData[id] = readJson(path);
      } catch (error) {
        errors.push(`${entry.id}：层 ${id} JSON 解析失败：${error.message}`);
      }
    }

    const result = validateNode(manifest, registry, layerData);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    nodes.set(entry.id, {
      id: entry.id,
      title: manifest.title ?? entry.title,
      manifest,
      layers: layerData,
      ...(result.scene === undefined ? {} : { scene: result.scene }),
    });
  }

  return { nodes, registry, errors, warnings };
}

/** 按加载顺序读多个包的 content，后加载的覆盖同名节点。 */
export function loadPacksContent(packDirs) {
  const nodes = new Map();
  let registry = null;
  const errors = [];
  const warnings = [];

  for (const packDir of packDirs) {
    const result = loadPackContent(packDir);
    if (result.registry !== null && registry === null) registry = result.registry;
    for (const [id, node] of result.nodes) nodes.set(id, node);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return { nodes, registry, errors, warnings };
}

/** 扫 worlds/*\/content，合并节点（后加载的覆盖同名）。 */
export function loadWorldsContent(worldsDir = "game/worlds") {
  const nodes = new Map();
  let registry = null;
  const errors = [];
  const warnings = [];

  for (const name of readdirSync(worldsDir)) {
    const full = join(worldsDir, name);
    if (!statSync(full).isDirectory()) continue;
    const result = loadPackContent(full);
    if (result.registry !== null && registry === null) registry = result.registry;
    for (const [id, node] of result.nodes) nodes.set(id, node);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
  }

  return { nodes, registry, errors, warnings };
}
