// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 世界结构图：把「这个包里到底有什么、谁引用谁」画出来。
 *
 * 它不参与加载，是一张只读的图——所以启动器能拿它做结构预览，
 * 以后也能拿它做「关掉这一块会破坏什么」的分析。
 *
 * 节点 id 形如 "template:pc"，引用边是 id 字符串。
 */

import { type JsonValue } from "../time.ts";
import { type MergedWorld } from "./merge.ts";

export type NodeKind = "component" | "template" | "entity" | "space" | "terrain" | "rule" | "world";

export interface GraphNode {
  readonly id: string;
  readonly kind: NodeKind;
  readonly label: string;
  /** 来自哪个包。规则没有来源包。 */
  readonly origin: string;
  /** 它引用了谁。 */
  readonly refs: readonly string[];
  /** 谁引用了它（反向边，构建时算好）。 */
  readonly usedBy: readonly string[];
}

export interface WorldGraph {
  readonly nodes: readonly GraphNode[];
  readonly byId: ReadonlyMap<string, GraphNode>;
}

export function nodeId(kind: NodeKind, id: string | number): string {
  return `${kind}:${id}`;
}

/**
 * 从合并后的定义建图。
 *
 * rules 是宿主注册的规则标签——它们不在数据里，但要出现在图上，
 * 否则「世界用了哪些规则」看不出来。
 */
export function buildGraph(merged: MergedWorld, rules: readonly string[] = []): WorldGraph {
  const nodes = new Map<string, GraphNode>();

  for (const definition of merged.definitions.values()) {
    const id = nodeId(definition.kind as NodeKind, definition.id);
    nodes.set(id, {
      id,
      kind: definition.kind as NodeKind,
      label: definition.id,
      origin: definition.origin,
      refs: refsOf(definition.kind, definition.data),
      usedBy: [],
    });
  }

  for (const rule of rules) {
    const id = nodeId("rule", rule);
    nodes.set(id, {
      id,
      kind: "rule",
      label: rule,
      origin: "(代码)",
      refs: [],
      usedBy: [],
    });
  }

  // 反算 usedBy
  const usedBy = new Map<string, string[]>();
  for (const node of nodes.values()) {
    for (const ref of node.refs) {
      if (!nodes.has(ref)) continue; // 悬空引用留给加载器报错
      const list = usedBy.get(ref) ?? [];
      list.push(node.id);
      usedBy.set(ref, list);
    }
  }

  const result: GraphNode[] = [...nodes.values()].map((node) => ({
    ...node,
    usedBy: usedBy.get(node.id) ?? [],
  }));

  return { nodes: result, byId: new Map(result.map((node) => [node.id, node])) };
}

/** 按 kind 解析引用边。 */
function refsOf(kind: string, data: JsonValue): string[] {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return [];
  const def = data as Record<string, JsonValue>;
  const refs: string[] = [];

  if (kind === "template") {
    if (typeof def.extends === "string") refs.push(nodeId("template", def.extends));
    if (isObject(def.components)) {
      for (const name of Object.keys(def.components)) {
        refs.push(nodeId("component", name));
      }
    }
  }

  if (kind === "entity") {
    if (typeof def.template === "string") refs.push(nodeId("template", def.template));
    if (typeof def.space === "string") refs.push(nodeId("space", def.space));
  }

  if (kind === "space" && Array.isArray(def.terrain)) {
    for (const value of new Set(def.terrain)) {
      if (typeof value === "number") refs.push(nodeId("terrain", value));
    }
  }

  if (kind === "world") {
    if (Array.isArray(def.rules)) {
      for (const rule of def.rules) {
        if (typeof rule === "string") refs.push(nodeId("rule", rule));
      }
    }
    if (isObject(def.start) && typeof def.start.space === "string") {
      refs.push(nodeId("space", def.start.space));
    }
  }

  return [...new Set(refs)];
}

function isObject(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
