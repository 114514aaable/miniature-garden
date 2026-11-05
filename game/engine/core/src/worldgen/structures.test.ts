// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 结构的测试：解析、摆放、间距、允许地形。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { parseStructure, placeStructures, stampStructure, type StructureDef } from "./structures.ts";

const IDS = new Map([
  ["floor", 3],
  ["wall", 1],
  ["void", 0],
]);

const codeOf = (id: number): string | undefined => {
  for (const [code, value] of IDS) if (value === id) return code;
  return undefined;
};

const RUIN = {
  legend: { "#": { terrain: "wall" }, ".": { terrain: "floor" } },
  map: ["###", "#.#", "###"],
};

test("解析：宽高与格子", () => {
  const def = parseStructure(RUIN, "ruin");
  assert.equal(def.width, 3);
  assert.equal(def.height, 3);
  assert.deepEqual(def.cells.slice(0, 3), ["wall", "wall", "wall"]);
  assert.equal(def.cells[4], "floor");
});

test("解析：行宽不一致要报错", () => {
  assert.throws(() => parseStructure({ legend: { "#": { terrain: "wall" } }, map: ["##", "#"] }, "bad"), /宽度/);
});

test("解析：符号不在图例里要报错", () => {
  assert.throws(
    () => parseStructure({ legend: { "#": { terrain: "wall" } }, map: ["#?#"] }, "bad"),
    /不在 legend/,
  );
});

test("解析：图例缺 terrain 要报错", () => {
  assert.throws(() => parseStructure({ legend: { "#": {} }, map: ["#"] }, "bad"), /缺少 terrain/);
});

test("盖章：只改 footprint 内的格子", () => {
  const terrain = new Array(25).fill(3);
  const def = parseStructure(RUIN, "ruin");
  stampStructure(terrain, 5, 5, def, 1, 1, IDS);

  assert.equal(terrain[1 * 5 + 1], 1); // 左上角墙
  assert.equal(terrain[2 * 5 + 2], 3); // 中间地面
  assert.equal(terrain[0], 3); // footprint 外不动
});

test("摆放：数量与间距", () => {
  const defs = new Map<string, StructureDef>([["ruin", parseStructure(RUIN, "ruin")]]);
  const terrain = new Array(40 * 30).fill(3);

  const placed = placeStructures(terrain, 40, 30, defs, { structures: ["ruin"], count: 3, spacing: 6 }, 7, IDS, codeOf);
  assert.equal(placed.length, 3);

  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      const a = placed[i];
      const b = placed[j];
      const gap = Math.max(
        Math.max(a.x - (b.x + 3), b.x - (a.x + 3), 0),
        Math.max(a.y - (b.y + 3), b.y - (a.y + 3), 0),
      );
      assert.ok(gap >= 6, `间距不足：${gap}`);
    }
  }
});

test("摆放：只落在允许的地形上", () => {
  const defs = new Map<string, StructureDef>([["ruin", parseStructure(RUIN, "ruin")]]);
  const terrain = new Array(20 * 20).fill(1); // 全是墙
  const placed = placeStructures(terrain, 20, 20, defs, { structures: ["ruin"], count: 2, spacing: 2, on: ["floor"] }, 3, IDS, codeOf);
  assert.equal(placed.length, 0, "没有地面就不该摆下去");
});

test("摆放：确定性", () => {
  const defs = new Map<string, StructureDef>([["ruin", parseStructure(RUIN, "ruin")]]);
  const make = () => {
    const terrain = new Array(30 * 30).fill(3);
    return { terrain, placed: placeStructures(terrain, 30, 30, defs, { structures: ["ruin"], count: 2, spacing: 4 }, 5, IDS, codeOf) };
  };
  const a = make();
  const b = make();
  assert.deepEqual(a.placed, b.placed);
  assert.deepEqual(a.terrain, b.terrain);
});

test("摆放：引用不存在的结构要报错", () => {
  const defs = new Map<string, StructureDef>();
  const terrain = new Array(10 * 10).fill(3);
  assert.throws(
    () => placeStructures(terrain, 10, 10, defs, { structures: ["ghost"], count: 1 }, 1, IDS, codeOf),
    /不存在的结构/,
  );
});
