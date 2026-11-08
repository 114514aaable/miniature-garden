// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 布局：房间 + 走廊混合，房间多格、走廊拼贴。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { placeLayout } from "./layout.ts";
import { parseStructure, resolveStructures, type RawStructure, type StructureDef } from "../structures.ts";

const IDS = new Map([
  ["wall", 1],
  ["floor", 3],
]);

const TILE = {
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

function tileDefs(): Map<string, StructureDef> {
  const raws = new Map<string, RawStructure>([["cross", parseStructure(TILE, "cross")]]);
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

test("布局：房间占多格，地板连通", () => {
  const width = 49;
  const height = 35;
  const terrain = new Array<number>(width * height).fill(1);

  const result = placeLayout(
    terrain, width, height, tileDefs(),
    { tiles: ["cross"], rooms: 3, roomMin: [2, 2], roomMax: [3, 2], loops: 0.2 },
    7, IDS,
  );

  assert.equal(result.rooms.length, 3, "应该摆下 3 间房");
  for (const room of result.rooms) {
    assert.ok(room.w * room.h >= 4, "房间至少 2×2");
  }
  assert.equal(orphans(terrain, width, height), false, "地板应该连通");
  assert.ok(result.warnings.length === 0, "不该有警告");
});

test("布局：没有房间也能铺纯走廊", () => {
  const width = 49;
  const height = 35;
  const terrain = new Array<number>(width * height).fill(1);

  const result = placeLayout(
    terrain, width, height, tileDefs(),
    { tiles: ["cross"], rooms: 0, loops: 0.2 },
    3, IDS,
  );

  assert.equal(result.rooms.length, 0);
  assert.equal(orphans(terrain, width, height), false);
});

test("布局：确定性", () => {
  const make = () => {
    const terrain = new Array<number>(49 * 35).fill(1);
    const result = placeLayout(
      terrain, 49, 35, tileDefs(),
      { tiles: ["cross"], rooms: 2, roomMin: [2, 2], roomMax: [2, 2] },
      11, IDS,
    );
    return { terrain, rooms: result.rooms, placements: result.placements };
  };
  assert.equal(JSON.stringify(make()), JSON.stringify(make()));
});
