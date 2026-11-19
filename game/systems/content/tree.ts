// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 内容树：目录 + 层注册表 + 节点清单。
 *
 * 第一版只认 `liveness` 层（现在/现场），其它层保留、警告、不执行。
 * 这一层只做解析与校验；读文件在 tools/check-content.mjs。
 */

import { type JsonValue } from "../../engine/core/src/time.ts";
import { parseDialogScript, type DialogScript } from "../scene/dialog.ts";

export type LayerStatus = "active" | "reserved";

export interface ContentCatalogNode {
  readonly id: string;
  readonly parent: string | null;
  readonly kind: string;
  readonly title?: string;
  readonly entry: string;
  readonly children: readonly string[];
}

export interface ContentCatalog {
  readonly version: number;
  readonly root: string;
  readonly nodes: ReadonlyMap<string, ContentCatalogNode>;
}

export interface LayerDef {
  readonly id: string;
  readonly version: number;
  readonly status: LayerStatus;
  readonly description?: string;
}

export interface LayerRegistry {
  readonly version: number;
  readonly layers: ReadonlyMap<string, LayerDef>;
}

export interface ConditionalItems {
  readonly flags: readonly string[];
  readonly items: ReadonlyArray<{ readonly template: string; readonly count: number }>;
}

export interface NodeManifest {
  readonly protocol: number;
  readonly id: string;
  readonly version: string;
  readonly revision: number;
  readonly kind: string;
  readonly title?: string;
  readonly layers: Readonly<Record<string, string>>;
  readonly requires: ConditionalItems;
  readonly provides: ConditionalItems;
  readonly assets: readonly string[];
  readonly license: string;
}

export interface NodeValidation {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  /** liveness 层编译出的剧本；没有就是 undefined。 */
  readonly scene?: DialogScript;
}

const ID = /^[a-z][a-z0-9_.-]*$/;

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown, where: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${where} 应该是字符串数组`);
  }
  return [...value];
}

function parseConditional(raw: unknown, where: string): ConditionalItems {
  if (raw === undefined) return { flags: [], items: [] };
  if (!isRecord(raw)) throw new Error(`${where} 应该是对象`);

  const flags = asStringArray(raw.flags, `${where}.flags`);
  const items = [];
  if (raw.items !== undefined) {
    if (!Array.isArray(raw.items)) throw new Error(`${where}.items 应该是数组`);
    for (const [index, item] of raw.items.entries()) {
      if (
        !isRecord(item) ||
        typeof item.template !== "string" ||
        typeof item.count !== "number" ||
        !Number.isInteger(item.count) ||
        item.count < 1
      ) {
        throw new Error(`${where}.items[${index}] 需要 template + count(>=1)`);
      }
      items.push({ template: item.template, count: item.count });
    }
  }

  return { flags, items };
}

export function parseContentCatalog(raw: unknown, path = "$catalog"): ContentCatalog {
  if (!isRecord(raw)) throw new Error(`${path}：需要对象`);
  if (raw.version !== 1) throw new Error(`${path}.version 只支持 1`);
  if (typeof raw.root !== "string" || !ID.test(raw.root)) {
    throw new Error(`${path}.root 非法`);
  }
  if (!Array.isArray(raw.nodes)) throw new Error(`${path}.nodes 需要数组`);

  const nodes = new Map<string, ContentCatalogNode>();
  for (const [index, item] of raw.nodes.entries()) {
    const where = `${path}.nodes[${index}]`;
    if (!isRecord(item)) throw new Error(`${where}：需要对象`);
    if (typeof item.id !== "string" || !ID.test(item.id)) throw new Error(`${where}.id 非法`);
    if (nodes.has(item.id)) throw new Error(`${where}.id 重复：${item.id}`);
    if (item.parent !== null && typeof item.parent !== "string") {
      throw new Error(`${where}.parent 需要 string 或 null`);
    }
    if (typeof item.kind !== "string" || item.kind.length === 0) {
      throw new Error(`${where}.kind 缺失`);
    }
    if (typeof item.entry !== "string" || item.entry.length === 0) {
      throw new Error(`${where}.entry 缺失`);
    }

    nodes.set(item.id, {
      id: item.id,
      parent: item.parent as string | null,
      kind: item.kind,
      ...(typeof item.title === "string" ? { title: item.title } : {}),
      entry: item.entry,
      children: asStringArray(item.children, `${where}.children`),
    });
  }

  if (!nodes.has(raw.root)) throw new Error(`${path}.root 指向不存在的节点：${raw.root}`);

  // parent 引用 + 不能成环
  for (const node of nodes.values()) {
    if (node.parent !== null && !nodes.has(node.parent)) {
      throw new Error(`${path}：${node.id} 的 parent 不存在：${node.parent}`);
    }
    const seen = new Set<string>();
    let cursor: string | null = node.id;
    while (cursor !== null) {
      if (seen.has(cursor)) throw new Error(`${path}：parent 成环（${node.id}）`);
      seen.add(cursor);
      cursor = nodes.get(cursor)?.parent ?? null;
    }
    for (const child of node.children) {
      if (!nodes.has(child)) {
        throw new Error(`${path}：${node.id} 的 child 不存在：${child}`);
      }
    }
  }

  return { version: 1, root: raw.root, nodes };
}

export function parseLayerRegistry(raw: unknown, path = "$layers"): LayerRegistry {
  if (!isRecord(raw)) throw new Error(`${path}：需要对象`);
  if (raw.version !== 1) throw new Error(`${path}.version 只支持 1`);
  if (!Array.isArray(raw.layers)) throw new Error(`${path}.layers 需要数组`);

  const layers = new Map<string, LayerDef>();
  for (const [index, item] of raw.layers.entries()) {
    const where = `${path}.layers[${index}]`;
    if (!isRecord(item)) throw new Error(`${where}：需要对象`);
    if (typeof item.id !== "string" || !ID.test(item.id)) throw new Error(`${where}.id 非法`);
    if (layers.has(item.id)) throw new Error(`${where}.id 重复：${item.id}`);
    if (typeof item.version !== "number" || !Number.isInteger(item.version)) {
      throw new Error(`${where}.version 需要整数`);
    }
    if (item.status !== "active" && item.status !== "reserved") {
      throw new Error(`${where}.status 只能是 active / reserved`);
    }

    layers.set(item.id, {
      id: item.id,
      version: item.version,
      status: item.status,
      ...(typeof item.description === "string" ? { description: item.description } : {}),
    });
  }

  return { version: 1, layers };
}

export function parseNodeManifest(raw: unknown, path = "$manifest"): NodeManifest {
  if (!isRecord(raw)) throw new Error(`${path}：需要对象`);
  if (raw.protocol !== 1) throw new Error(`${path}.protocol 只支持 1`);
  if (typeof raw.id !== "string" || !ID.test(raw.id)) throw new Error(`${path}.id 非法`);
  if (typeof raw.version !== "string" || raw.version.length === 0) {
    throw new Error(`${path}.version 缺失`);
  }
  if (typeof raw.revision !== "number" || !Number.isInteger(raw.revision) || raw.revision < 1) {
    throw new Error(`${path}.revision 需要正整数`);
  }
  if (typeof raw.kind !== "string" || raw.kind.length === 0) {
    throw new Error(`${path}.kind 缺失`);
  }
  if (!isRecord(raw.layers)) throw new Error(`${path}.layers 需要对象`);

  const layers: Record<string, string> = {};
  for (const [id, file] of Object.entries(raw.layers)) {
    if (!ID.test(id)) throw new Error(`${path}.layers 的层 id 非法：${id}`);
    if (typeof file !== "string" || file.length === 0) {
      throw new Error(`${path}.layers["${id}"] 需要文件路径`);
    }
    layers[id] = file;
  }

  return {
    protocol: 1,
    id: raw.id,
    version: raw.version,
    revision: raw.revision,
    kind: raw.kind,
    ...(typeof raw.title === "string" ? { title: raw.title } : {}),
    layers,
    requires: parseConditional(raw.requires, `${path}.requires`),
    provides: parseConditional(raw.provides, `${path}.provides`),
    assets: asStringArray(raw.assets, `${path}.assets`),
    license: typeof raw.license === "string" ? raw.license : "",
  };
}

/**
 * 校验一个节点的清单 + 层数据。
 * 层数据由调用方读文件后传入（layer id → 解析后的 JSON）。
 */
export function validateNode(
  manifest: NodeManifest,
  registry: LayerRegistry,
  layerData: Readonly<Record<string, unknown>>,
): NodeValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const prefix = `节点 ${manifest.id}`;
  let scene: DialogScript | undefined;

  if (manifest.license.trim().length === 0) {
    errors.push(`${prefix}：缺少 license`);
  }

  const names = Object.keys(manifest.layers);
  if (names.length === 0) errors.push(`${prefix}：layers 为空`);

  for (const [id, file] of Object.entries(manifest.layers)) {
    const def = registry.layers.get(id);
    if (def === undefined) {
      warnings.push(`${prefix}：未知层 ${id}（保留但不执行）`);
      continue;
    }
    if (def.status === "reserved") {
      warnings.push(`${prefix}：${id} 是保留层（不执行）`);
      continue;
    }

    const data = layerData[id];
    if (data === undefined) {
      errors.push(`${prefix}：层 ${id} 没有数据（${file}）`);
      continue;
    }

    if (id === "liveness") {
      const result = validateLiveness(data, `${prefix}.liveness`);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
      if (result.scene !== undefined && scene === undefined) {
        scene = result.scene;
      }
    }
  }

  return { errors, warnings, ...(scene === undefined ? {} : { scene }) };
}

function validateLiveness(
  raw: unknown,
  where: string,
): { errors: string[]; warnings: string[]; scene?: DialogScript } {
  const errors: string[] = [];
  const warnings: string[] = [];

  let scene: DialogScript;
  try {
    scene = parseDialogScript(raw as JsonValue);
  } catch (error) {
    return { errors: [`${where}：${error instanceof Error ? error.message : String(error)}`], warnings };
  }

  if (scene.nodes[scene.start] === undefined) {
    errors.push(`${where}：start 指向不存在的节点 ${scene.start}`);
  }

  for (const [nodeId, node] of Object.entries(scene.nodes)) {
    for (const choice of node.choices) {
      if (choice.next !== undefined && scene.nodes[choice.next] === undefined) {
        errors.push(`${where}：节点 ${nodeId} 选项 ${choice.id} 指向不存在的节点 ${choice.next}`);
      }
    }
  }

  return { errors, warnings, scene };
}
