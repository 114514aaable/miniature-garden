// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 结构：解析、展开（子结构 / 实体 / 环）、摆放。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseStructure,
  placeStructures,
  resolveStructures,
  stampStructure,
  type RawStructure,
  type StructureDef,
} from "./structures.ts";

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

const HUT = {
  legend: { "#": { terrain: "wall" }, ".": { terrain: "floor" } },
  map: ["####", "#..#", "#..#", "##.#"],
  entities: [{ template: "prop_crate", dx: 1, dy: 1 }],
};

function resolve(list: unknown[]): Map<string, StructureDef> {
  const raws = new Map<string, RawStructure>();
  for (const item of list) {
    const raw = item as { id: string; map?: unknown };
    raws.set(raw.id, parseStructure(item, raw.id));
  }
  return resolveStructures(raws);
}

test("解析：宽高与地形矩阵", () => {
  const def = parseStructure(RUIN, "ruin");
  assert.equal(def.width, 3);
  assert.equal(def.height, 3);
  assert.deepEqual(def.terrain.slice(0, 3), ["wall", "wall", "wall"]);
  assert.equal(def.terrain[4], "floor");
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

test("解析：图例条目必须有 terrain 或 structure", () => {
  assert.throws(() => parseStructure({ legend: { "#": {} }, map: ["#"] }, "bad"), /terrain 或 structure/);
});

test("解析：实体坐标不能在图外", () => {
  assert.throws(
    () => parseStructure({ legend: { "#": { terrain: "wall" } }, map: ["#"], entities: [{ template: "x", dx: 3, dy: 0 }] }, "bad"),
    /不在图里/,
  );
});

test("解析：锚点朝向必须合法", () => {
  assert.throws(
    () => parseStructure({ legend: { "#": { terrain: "wall" } }, map: ["#"], anchors: [{ x: 0, y: 0, facing: "up" }] }, "bad"),
    /facing/,
  );
});

test("展开：子结构居中盖在指定格", () => {
  const defs = resolve([
    { id: "hut", ...HUT },
    {
      id: "village",
      legend: { "#": { terrain: "wall" }, ".": { terrain: "floor" }, h: { structure: "hut", align: "center" } },
      map: ["#######", "#.....#", "#..h..#", "#.....#", "#######"],
    },
  ]);

  const village = defs.get("village");
  assert.ok(village);
  // hut 4×4 居中在 (3,2) → 左上角 (1,0)；hut 的墙盖在 (1,0)
  assert.equal(village.cells[0 * 7 + 1], "wall");
  assert.equal(village.cells[1 * 7 + 2], "floor");
});

test("展开：子结构越界要报错", () => {
  assert.throws(
    () =>
      resolve([
        { id: "hut", ...HUT },
        { id: "village", legend: { "#": { terrain: "wall" }, h: { structure: "hut" } }, map: ["#####", "##h##", "#####"] },
      ]),
    /放不下/,
  );
});

test("展开：引用成环要报错", () => {
  assert.throws(
    () =>
      resolve([
        { id: "a", legend: { b: { structure: "b" } }, map: ["b"] },
        { id: "b", legend: { a: { structure: "a" } }, map: ["a"] },
      ]),
    /成环/,
  );
});

test("展开：子结构的实体和门会平移到父结构坐标", () => {
  const defs = resolve([
    { id: "hut", ...HUT, anchors: [{ x: 3, y: 3, facing: "south" }] },
    {
      id: "yard",
      legend: { "#": { terrain: "wall" }, ".": { terrain: "floor" }, h: { structure: "hut" } },
      map: [".......", ".h.....", ".......", ".......", "......."],
    },
  ]);

  const yard = defs.get("yard");
  assert.ok(yard);
  assert.deepEqual(yard.entities, [{ template: "prop_crate", x: 2, y: 2 }]);
  assert.deepEqual(yard.anchors, [{ x: 4, y: 4, facing: "south" }]);
});
test("盖章：只改 footprint 内的格子", () => {
  const terrain = new Array(25).fill(3);
  const def = resolve([{ id: "ruin", ...RUIN }]).get("ruin")!;
  stampStructure(terrain, 5, 5, def, 1, 1, IDS);

  assert.equal(terrain[1 * 5 + 1], 1); // 左上角墙
  assert.equal(terrain[2 * 5 + 2], 3); // 中间地面
  assert.equal(terrain[0], 3); // footprint 外不动
});

test("盖章：返回实体出生请求；落在墙上跳过并警告", () => {
  const terrain = new Array(25).fill(3);
  const def = resolve([{ id: "hut", ...HUT }]).get("hut")!;
  const warnings: string[] = [];
  const spawns = stampStructure(terrain, 5, 5, def, 0, 0, IDS, warnings);

  assert.equal(spawns.length, 1);
  assert.deepEqual({ template: spawns[0].template, x: spawns[0].x, y: spawns[0].y }, { template: "prop_crate", x: 1, y: 1 });

  // 把实体挪到墙上
  const wallDef: StructureDef = { ...def, entities: [{ template: "prop_crate", x: 0, y: 0 }] };
  const warnings2: string[] = [];
  const spawns2 = stampStructure(terrain, 5, 5, wallDef, 0, 0, IDS, warnings2);
  assert.equal(spawns2.length, 0);
  assert.ok(warnings2.length > 0, "撞墙应该有警告");
});

test("摆放：数量与间距", () => {
  const defs = resolve([{ id: "ruin", ...RUIN }]);
  const terrain = new Array(40 * 30).fill(3);

  const { placements } = placeStructures(terrain, 40, 30, defs, { structures: ["ruin"], count: 3, spacing: 6 }, 7, IDS, codeOf);
  assert.equal(placements.length, 3);

  for (let i = 0; i < placements.length; i += 1) {
    for (let j = i + 1; j < placements.length; j += 1) {
      const a = placements[i];
      const b = placements[j];
      const gap = Math.max(
        Math.max(a.x - (b.x + 3), b.x - (a.x + 3), 0),
        Math.max(a.y - (b.y + 3), b.y - (a.y + 3), 0),
      );
      assert.ok(gap >= 6, `间距不足：${gap}`);
    }
  }
});

test("摆放：只落在允许的地形上", () => {
  const defs = resolve([{ id: "ruin", ...RUIN }]);
  const terrain = new Array(20 * 20).fill(1); // 全是墙
  const { placements } = placeStructures(terrain, 20, 20, defs, { structures: ["ruin"], count: 2, spacing: 2, on: ["floor"] }, 3, IDS, codeOf);
  assert.equal(placements.length, 0, "没有地面就不该摆下去");
});

test("摆放：确定性", () => {
  const defs = resolve([{ id: "ruin", ...RUIN }]);
  const make = () => {
    const terrain = new Array(30 * 30).fill(3);
    const placed = placeStructures(terrain, 30, 30, defs, { structures: ["ruin"], count: 2, spacing: 4 }, 5, IDS, codeOf);
    return { terrain, placed };
  };
  const a = make();
  const b = make();
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("摆放：引用不存在的结构要报错", () => {
  const defs = new Map<string, StructureDef>();
  const terrain = new Array(10 * 10).fill(3);
  assert.throws(
    () => placeStructures(terrain, 10, 10, defs, { structures: ["ghost"], count: 1 }, 1, IDS, codeOf),
    /不存在的结构/,
  );
});
