// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 房间布局：BSP、盖章、走廊连通、确定性。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { partition, placeRooms } from "./rooms.ts";
import { parseStructure, resolveStructures, type StructureDef } from "./structures.ts";

const IDS = new Map([
  ["wall", 1],
  ["floor", 3],
]);

const codeOf = (id: number): string | undefined => {
  for (const [code, value] of IDS) if (value === id) return code;
  return undefined;
};

const CELL = {
  role: "room",
  legend: { "#": { terrain: "wall" }, ".": { terrain: "floor" } },
  map: ["#####", "#...#", "#...#", "##.##"],
  anchors: [{ kind: "door", x: 2, y: 3, facing: "south" }],
};

const HALL = {
  role: "room",
  legend: { "#": { terrain: "wall" }, ".": { terrain: "floor" } },
  map: ["#######", "#.....#", "#.....#", "###.###"],
  anchors: [{ kind: "door", x: 3, y: 3, facing: "south" }],
};

function defs(): Map<string, StructureDef> {
  const raws = new Map([
    ["cell", parseStructure(CELL, "cell")],
    ["hall", parseStructure(HALL, "hall")],
  ]);
  return resolveStructures(raws);
}

test("BSP：切出的矩形都在里面且不小于最小值", () => {
  const rects = partition(41, 31, [6, 5], 7);
  assert.ok(rects.length >= 2, "应该切成多块");

  for (const rect of rects) {
    assert.ok(rect.x >= 1 && rect.y >= 1, "越界（左上）");
    assert.ok(rect.x + rect.w <= 40 && rect.y + rect.h <= 30, "越界（右下）");
    assert.ok(rect.w >= 6 && rect.h >= 5, `矩形太小：${rect.w}×${rect.h}`);
  }
});

test("BSP：确定性", () => {
  assert.deepEqual(partition(41, 31, [6, 5], 9), partition(41, 31, [6, 5], 9));
});

test("房间：都放得下，走廊连通所有房间", () => {
  const width = 41;
  const height = 31;
  const terrain = new Array<number>(width * height).fill(1);
  const { placements } = placeRooms(
    terrain, width, height, defs(),
    { structures: ["cell", "hall"], minSize: [7, 6], corridor: "floor" },
    3, IDS, codeOf,
  );
  assert.ok(placements.length >= 2, "至少放两个房间");

  for (const room of placements) {
    assert.ok(room.x >= 0 && room.y >= 0 && room.x + room.w <= width && room.y + room.h <= height);
  }

  // 从第一个房间中心洪水填充，必须能走到每个房间中心
  const seen = new Set<number>();
  const start = placements[0];
  const queue: Array<[number, number]> = [[start.x + 1, start.y + 1]];
  seen.add((start.y + 1) * width + (start.x + 1));

  while (queue.length > 0) {
    const [x, y] = queue.shift() as [number, number];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (terrain[ny * width + nx] !== 3) continue;
      if (seen.has(ny * width + nx)) continue;
      seen.add(ny * width + nx);
      queue.push([nx, ny]);
    }
  }

  for (const room of placements) {
    const cx = room.x + Math.floor(room.w / 2);
    const cy = room.y + Math.floor(room.h / 2);
    assert.ok(seen.has(cy * width + cx), `房间 ${room.structure} 没连通`);
  }
});

test("门必须是地板，且从任意一扇门能走到所有门", () => {
  const width = 41;
  const height = 31;
  const terrain = new Array<number>(width * height).fill(1);
  const { placements } = placeRooms(terrain, width, height, defs(),
    { structures: ["cell", "hall"], minSize: [7, 6], corridor: "floor" }, 4, IDS, codeOf);

  const doors = placements.flatMap((room) => room.doors);
  assert.ok(doors.length >= 2, "至少要两扇门");

  for (const door of doors) {
    assert.equal(terrain[door.y * width + door.x], 3, `门不是地板：(${door.x}, ${door.y})`);
  }

  // 从第一扇门洪水填充，所有门都要能走到
  const seen = new Set<number>();
  const queue: Array<[number, number]> = [[doors[0].x, doors[0].y]];
  seen.add(doors[0].y * width + doors[0].x);
  while (queue.length > 0) {
    const [x, y] = queue.shift() as [number, number];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (terrain[ny * width + nx] !== 3) continue;
      if (seen.has(ny * width + nx)) continue;
      seen.add(ny * width + nx);
      queue.push([nx, ny]);
    }
  }

  for (const door of doors) {
    assert.ok(seen.has(door.y * width + door.x), `门走不到：(${door.x}, ${door.y})`);
  }
});

test("房间：role 不对要报错", () => {
  const local = resolveStructures(new Map([["ruin", parseStructure({ legend: { "#": { terrain: "wall" } }, map: ["#"] }, "ruin")]]));
  const terrain = new Array<number>(20 * 20).fill(1);
  assert.throws(
    () => placeRooms(terrain, 20, 20, local, { structures: ["ruin"] }, 1, IDS, codeOf),
    /role 不是 room/,
  );
});

test("房间：引用不存在的结构要报错", () => {
  const terrain = new Array<number>(20 * 20).fill(1);
  assert.throws(
    () => placeRooms(terrain, 20, 20, defs(), { structures: ["ghost"] }, 1, IDS, codeOf),
    /不存在的结构/,
  );
});

test("房间：确定性（同样的种子同样的图）", () => {
  const make = () => {
    const terrain = new Array<number>(41 * 31).fill(1);
    const { placements } = placeRooms(terrain, 41, 31, defs(), { structures: ["cell", "hall"], corridor: "floor" }, 5, IDS, codeOf);
    return { terrain, placements };
  };
  const a = make();
  const b = make();
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});
