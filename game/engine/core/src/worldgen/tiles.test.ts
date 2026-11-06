// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 拼贴：旋转、门集合、铺满、兜底、连通性。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { findRotation, placeTiles, portsOf, rotateStructure } from "./tiles.ts";
import { parseStructure, resolveStructures, type RawStructure, type StructureDef } from "./structures.ts";

const IDS = new Map([
  ["wall", 1],
  ["floor", 3],
]);

const FOUR_DOORS = {
  id: "cross",
  role: "room",
  legend: { "#": { terrain: "wall" }, ".": { terrain: "floor" } },
  map: [
    "###.###",
    "###.###",
    "###.###",
    ".......",
    "###.###",
    "###.###",
    "###.###",
  ],
  anchors: [
    { kind: "door", x: 3, y: 0, facing: "north" },
    { kind: "door", x: 6, y: 3, facing: "east" },
    { kind: "door", x: 3, y: 6, facing: "south" },
    { kind: "door", x: 0, y: 3, facing: "west" },
  ],
};

const TWO_DOORS = {
  ...FOUR_DOORS,
  id: "ns",
  anchors: [
    { kind: "door", x: 3, y: 0, facing: "north" },
    { kind: "door", x: 3, y: 6, facing: "south" },
  ],
};

function resolve(list: unknown[]): Map<string, StructureDef> {
  const raws = new Map<string, RawStructure>();
  for (const item of list) {
    const raw = item as { id: string };
    raws.set(raw.id, parseStructure(item, raw.id));
  }
  return resolveStructures(raws);
}

function floorCount(terrain: number[]): number {
  return terrain.filter((cell) => cell === 3).length;
}

/** 有没有走不到的地板。 */
function orphans(terrain: number[], width: number, height: number): boolean {
  let start = -1;
  let total = 0;
  for (let index = 0; index < terrain.length; index += 1) {
    if (terrain[index] === 3) {
      total += 1;
      if (start < 0) start = index;
    }
  }
  if (total === 0) return true;

  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const index = queue.pop() as number;
    const x = index % width;
    const y = Math.floor(index / width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (seen.has(next) || terrain[next] !== 3) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen.size !== total;
}

test("旋转：四次回到原样", () => {
  const def = resolve([FOUR_DOORS]).get("cross")!;
  let current = def;
  for (let i = 0; i < 4; i += 1) current = rotateStructure(current);
  assert.deepEqual(current.cells, def.cells);
  assert.equal(current.width, def.width);
  assert.equal(current.height, def.height);
});

test("门集合：四扇门就是 udlr", () => {
  const def = resolve([FOUR_DOORS]).get("cross")!;
  assert.deepEqual([...portsOf(def)].sort(), ["east", "north", "south", "west"]);
});

test("找旋转：四门件能满足四门需求", () => {
  const def = resolve([FOUR_DOORS]).get("cross")!;
  const required = new Set(["north", "east", "south", "west"] as const);
  assert.ok(findRotation(def, required) !== null);
});

test("找旋转：两门件满足不了四门需求", () => {
  const def = resolve([TWO_DOORS]).get("ns")!;
  const required = new Set(["north", "east", "south", "west"] as const);
  assert.equal(findRotation(def, required), null);
});

test("铺满：3×3 个格全部有件，且地板连通", () => {
  const defs = resolve([FOUR_DOORS]);
  const width = 21;
  const height = 21;
  const terrain = new Array<number>(width * height).fill(1);

  const { placements, warnings } = placeTiles(terrain, width, height, defs, ["cross"], 7, IDS);
  assert.equal(placements.length, 9, "3×3 应该是 9 件");
  assert.ok(warnings.length === 0, "不该有警告");
  assert.equal(orphans(terrain, width, height), false, "地板应该连通");

  // 相邻两格的门在边界上对齐：横向边界中点两边都是地板
  for (const y of [3, 10, 17]) {
    for (const x of [6, 13]) {
      assert.equal(terrain[y * width + x], 3, `(${x}, ${y}) 应该是门`);
      assert.equal(terrain[y * width + x + 1], 3, `(${x + 1}, ${y}) 应该是门`);
    }
  }
});

test("兜底：件不足时程序化补，仍然连通", () => {
  const defs = resolve([TWO_DOORS]);
  const width = 21;
  const height = 21;
  const terrain = new Array<number>(width * height).fill(1);

  const { placements, warnings } = placeTiles(terrain, width, height, defs, ["ns"], 3, IDS);
  assert.equal(placements.length, 9);
  assert.ok(warnings.some((line) => line.includes("兜底")), "应该有兜底警告");
  assert.equal(orphans(terrain, width, height), false, "兜底也要连通");
  assert.ok(floorCount(terrain) > 0);
});

test("确定性：同种子同图", () => {
  const defs = resolve([FOUR_DOORS]);
  const make = () => {
    const terrain = new Array<number>(21 * 21).fill(1);
    const result = placeTiles(terrain, 21, 21, defs, ["cross"], 9, IDS);
    return { terrain, placements: result.placements };
  };
  assert.equal(JSON.stringify(make()), JSON.stringify(make()));
});
