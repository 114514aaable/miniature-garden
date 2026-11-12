// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/** 资产树：路径 → 页内矩形 / 单文件；越界与重复要报错。 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { parseAssetTree, spriteOf, treeAtlases } from "./tree.ts";

const RAW = {
  version: 1,
  pages: [{ id: "p0", image: "/art/base/pages/p0.svg", width: 128, height: 128 }],
  tree: {
    type: "branch",
    children: {
      terrain: {
        type: "page",
        page: "p0",
        children: {
          floor: { type: "leaf", x: 0, y: 0, w: 64, h: 64 },
        },
      },
      entity: {
        type: "page",
        page: "p0",
        children: {
          rat: { type: "leaf", x: 64, y: 0, w: 32, h: 32 },
        },
      },
      hot: {
        type: "page",
        page: "p0",
        children: {
          draft: { type: "leaf", file: "inbox/draft.svg", w: 20, h: 20 },
        },
      },
    },
  },
};

test("路径解析：页内叶子", () => {
  const tree = parseAssetTree(RAW);
  assert.deepEqual(spriteOf(tree, "terrain.floor"), { sheet: "p0", frame: "terrain.floor" });
  assert.deepEqual(spriteOf(tree, "entity.rat"), { sheet: "p0", frame: "entity.rat" });
});

test("热生成：file 叶子", () => {
  const tree = parseAssetTree(RAW);
  assert.deepEqual(spriteOf(tree, "hot.draft"), { file: "inbox/draft.svg", w: 20, h: 20 });
});

test("展开成页图集：帧名 = 路径", () => {
  const tree = parseAssetTree(RAW);
  const atlases = treeAtlases(tree);
  const atlas = atlases.get("p0") as { frames: Record<string, { frame: { x: number } }> };
  assert.ok(atlas.frames["terrain.floor"]);
  assert.equal(atlas.frames["terrain.floor"].frame.x, 0);
});

test("越界：报错", () => {
  const bad = JSON.parse(JSON.stringify(RAW));
  bad.tree.children.terrain.children.floor.x = 100;
  assert.throws(() => parseAssetTree(bad), /超出图集页/);
});
