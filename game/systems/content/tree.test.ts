// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/** 内容树：目录、层注册表、节点清单与 liveness 校验。 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseContentCatalog,
  parseLayerRegistry,
  parseNodeManifest,
  validateNode,
} from "./tree.ts";

const CATALOG = {
  version: 1,
  root: "node.salt",
  nodes: [
    {
      id: "node.salt",
      parent: null,
      kind: "liveness",
      title: "盐港码头",
      entry: "nodes/node.salt/manifest.json",
      children: [],
    },
  ],
};

const REGISTRY = {
  version: 1,
  layers: [
    { id: "liveness", version: 1, status: "active" },
    { id: "world", version: 1, status: "reserved" },
  ],
};

const MANIFEST = {
  protocol: 1,
  id: "node.salt",
  version: "1.0.0",
  revision: 1,
  kind: "liveness",
  layers: { liveness: "scene.json" },
  requires: { flags: [], items: [] },
  provides: { flags: [] },
  assets: ["entity.npc_salt"],
  license: "CC-BY-SA-4.0",
};

const SCENE = {
  id: "salt_01",
  start: "hi",
  nodes: {
    hi: {
      text: "要买盐吗？",
      choices: [
        { id: "buy", text: "要", next: "buy" },
        { id: "leave", text: "不要", end: true },
      ],
    },
    buy: { text: "拿好。", choices: [{ id: "bye", text: "再见", end: true }] },
  },
};

test("合法内容树：catalog / registry / manifest / liveness 通过", () => {
  const catalog = parseContentCatalog(CATALOG);
  const registry = parseLayerRegistry(REGISTRY);
  const manifest = parseNodeManifest(MANIFEST);
  const result = validateNode(manifest, registry, { liveness: SCENE });

  assert.equal(catalog.root, "node.salt");
  assert.equal(result.errors.length, 0, result.errors.join("\n"));
  assert.ok(result.scene);
  assert.equal(result.scene.start, "hi");
});

test("catalog：parent 成环要报错", () => {
  assert.throws(
    () =>
      parseContentCatalog({
        version: 1,
        root: "a",
        nodes: [
          { id: "a", parent: "b", kind: "x", entry: "a.json", children: [] },
          { id: "b", parent: "a", kind: "x", entry: "b.json", children: [] },
        ],
      }),
    /成环/,
  );
});

test("liveness：next 指向不存在的节点要报错", () => {
  const broken = {
    ...SCENE,
    nodes: {
      hi: { text: "", choices: [{ id: "x", text: "去", next: "nope" }] },
    },
  };
  const result = validateNode(parseNodeManifest(MANIFEST), parseLayerRegistry(REGISTRY), {
    liveness: broken,
  });
  assert.ok(result.errors.some((item) => item.includes("不存在的节点")));
});

test("未知层：保留 + 警告，不报错", () => {
  const result = validateNode(
    parseNodeManifest({ ...MANIFEST, layers: { liveness: "scene.json", "mod.foo": "foo.json" } }),
    parseLayerRegistry(REGISTRY),
    { liveness: SCENE, "mod.foo": { anything: true } },
  );
  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some((item) => item.includes("未知层")));
});

test("保留层：警告但不执行", () => {
  const result = validateNode(
    parseNodeManifest({ ...MANIFEST, layers: { liveness: "scene.json", world: "world.json" } }),
    parseLayerRegistry(REGISTRY),
    { liveness: SCENE, world: {} },
  );
  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some((item) => item.includes("保留层")));
});

test("缺 license：报错", () => {
  const result = validateNode(
    parseNodeManifest({ ...MANIFEST, license: "" }),
    parseLayerRegistry(REGISTRY),
    { liveness: SCENE },
  );
  assert.ok(result.errors.some((item) => item.includes("license")));
});
