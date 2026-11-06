// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 散落地牢：自由摆放、门可达、房间不被啃、确定性。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { placeSprawl } from "./sprawl.ts";
import { parseStructure, resolveStructures, type RawStructure, type StructureDef } from "./structures.ts";

const IDS = new Map([
  ["wall", 1],
  ["floor", 3],
]);

function prefab(id: string, map: string[], anchors: Array<{ x: number; y: number; facing: string }>) {
  return {
    id,
    role: "room",
    legend: { "#": { terrain: "wall" }, ".": { terrain: "floor" } },
    map,
    anchors: anchors.map((anchor) => ({ kind: "door", ...anchor })),
  };
}

const SMALL = prefab("small", ["#####", "#...#", "#...#", "##.##"], [{ x: 2, y: 3, facing: "south" }]);
const WIDE = prefab(
  "wide",
  ["#########", "#.......#", "#.......#", ".........", "#.......#", "#########"],
  [
    { x: 0, y: 3, facing: "west" },
    { x: 8, y: 3, facing: "east" },
  ],
);

function defs(): Map<string, StructureDef> {
  const raws = new Map<string, RawStructure>([
    ["small", parseStructure(SMALL, "small")],
    ["wide", parseStructure(WIDE, "wide")],
  ]);
  return resolveStructures(raws);
}

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

test("散落：房间数量、连通、门是地板", () => {
  const width = 40;
  const height = 30;
  const terrain = new Array<number>(width * height).fill(1);

  const result = placeSprawl(
    terrain, width, height, defs(),
    { rooms: ["small", "wide"], count: 8, margin: 1 },
    7, IDS,
  );

  assert.ok(result.rooms.length >= 6, `房间太少：${result.rooms.length}`);
  assert.equal(orphans(terrain, width, height), false, "地板应该连通");

  for (const room of result.rooms) {
    for (const door of room.doors) {
      assert.equal(terrain[door.y * width + door.x], 3, `门不是地板：(${door.x}, ${door.y})`);
    }
  }
});

test("散落：房间的四角墙不被走廊啃掉", () => {
  const width = 40;
  const height = 30;
  const terrain = new Array<number>(width * height).fill(1);

  const result = placeSprawl(
    terrain, width, height, defs(),
    { rooms: ["small", "wide"], count: 8 },
    3, IDS,
  );

  for (const room of result.rooms) {
    const corners = [
      [room.x, room.y],
      [room.x + room.w - 1, room.y],
      [room.x, room.y + room.h - 1],
      [room.x + room.w - 1, room.y + room.h - 1],
    ];
    for (const [x, y] of corners) {
      assert.equal(terrain[y * width + x], 1, `房间角落被挖穿：(${x}, ${y})`);
    }
  }
});

test("散落：图是连通的（边数 ≥ 房间数-1）", () => {
  const width = 40;
  const height = 30;
  const terrain = new Array<number>(width * height).fill(1);

  const result = placeSprawl(
    terrain, width, height, defs(),
    { rooms: ["small", "wide"], count: 9 },
    5, IDS,
  );

  assert.ok(result.edges >= result.rooms.length - 1, `边太少：${result.edges}`);
});

test("散落：确定性", () => {
  const make = () => {
    const terrain = new Array<number>(40 * 30).fill(1);
    const result = placeSprawl(terrain, 40, 30, defs(), { rooms: ["small", "wide"], count: 6 }, 9, IDS);
    return { terrain, rooms: result.rooms };
  };
  assert.equal(JSON.stringify(make()), JSON.stringify(make()));
});
