// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/** 内容树加载器：真实节点 + 编译出的 liveness 场景。 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";

import { loadPackContent } from "./content-loader.mjs";

test("normal/content 能加载 node.salt 并编译场景", () => {
  const result = loadPackContent(resolve("game/worlds/normal"));
  assert.deepEqual(result.errors, []);
  assert.equal(result.nodes.size, 1);
  const node = result.nodes.get("node.salt");
  assert.ok(node);
  assert.ok(node.scene);
  assert.equal(node.scene.start, "hi");
  assert.equal(node.scene.nodes.hi.choices[0].id, "buy");
});
