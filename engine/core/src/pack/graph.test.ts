// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 结构图的测试：引用边、反向边、规则节点。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildGraph, nodeId } from "./graph.ts";
import { type MergedDefinition, type MergedWorld } from "./merge.ts";

function world(defs: Array<{ kind: string; id: string; data: unknown }>): MergedWorld {
  const map = new Map<string, MergedDefinition>();
  for (const def of defs) {
    map.set(`${def.kind}/${def.id}`, {
      kind: def.kind,
      id: def.id,
      data: def.data as never,
      origin: "test.pack",
      patchedBy: [],
    });
  }
  return { definitions: map } as unknown as MergedWorld;
}

test("模板引用组件，反向边自动算好", () => {
  const graph = buildGraph(
    world([
      { kind: "component", id: "core.health", data: { schema: { t: "object", fields: {} } } },
      { kind: "template", id: "pc", data: { components: { "core.health": { max: 10 } } } },
    ]),
  );

  const pc = graph.byId.get(nodeId("template", "pc"));
  assert.deepEqual(pc?.refs, [nodeId("component", "core.health")]);

  const health = graph.byId.get(nodeId("component", "core.health"));
  assert.deepEqual(health?.usedBy, [nodeId("template", "pc")]);
});

test("实体引用模板与空间", () => {
  const graph = buildGraph(
    world([
      { kind: "space", id: "harbor", data: { width: 1, height: 1, terrain: [0] } },
      { kind: "template", id: "pc", data: { components: {} } },
      { kind: "entity", id: "e1", data: { template: "pc", space: "harbor", x: 0, y: 0 } },
    ]),
  );

  const entity = graph.byId.get(nodeId("entity", "e1"));
  assert.deepEqual(entity?.refs, [nodeId("template", "pc"), nodeId("space", "harbor")]);
});

test("空间引用它用到的地形", () => {
  const graph = buildGraph(
    world([{ kind: "space", id: "harbor", data: { width: 2, height: 1, terrain: [1, 2] } }]),
  );

  const space = graph.byId.get(nodeId("space", "harbor"));
  assert.deepEqual(space?.refs, [nodeId("terrain", 1), nodeId("terrain", 2)]);
});

test("世界引用规则，尤其是代码里的规则", () => {
  const graph = buildGraph(
    world([{ kind: "world", id: "main", data: { start: { space: "harbor", x: 0, y: 0 }, rules: ["core.move"] } }]),
    ["core.move"],
  );

  const rule = graph.byId.get(nodeId("rule", "core.move"));
  assert.equal(rule?.origin, "(代码)");
  assert.ok(graph.byId.get(nodeId("world", "main"))?.refs.includes(nodeId("rule", "core.move")));
});

test("悬空引用不进反向边（加载器负责报错）", () => {
  const graph = buildGraph(
    world([{ kind: "entity", id: "e1", data: { template: "ghost", space: "harbor", x: 0, y: 0 } }]),
  );

  const entity = graph.byId.get(nodeId("entity", "e1"));
  assert.deepEqual(entity?.refs, [nodeId("template", "ghost"), nodeId("space", "harbor")]);
  assert.equal(graph.nodes.length, 1);
});
