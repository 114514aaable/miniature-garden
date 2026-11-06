// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 迷宫：连通性、边界、确定性、编织。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { generateMaze } from "./maze.ts";

const WALL = 1;
const FLOOR = 3;

function at(terrain: number[], width: number, x: number, y: number): number {
  return terrain[y * width + x];
}

/** 从 (1,1) 洪水填充，返回能走到的地板数量。 */
function reachable(terrain: number[], width: number, height: number): number {
  const seen = new Set<number>();
  const queue: Array<[number, number]> = [[1, 1]];
  if (at(terrain, width, 1, 1) !== FLOOR) return 0;
  seen.add(1 * width + 1);

  while (queue.length > 0) {
    const [x, y] = queue.shift() as [number, number];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (at(terrain, width, nx, ny) !== FLOOR) continue;
      if (seen.has(ny * width + nx)) continue;
      seen.add(ny * width + nx);
      queue.push([nx, ny]);
    }
  }
  return seen.size;
}

function floorCount(terrain: number[]): number {
  return terrain.filter((cell) => cell === FLOOR).length;
}

test("迷宫：边界全是墙", () => {
  const width = 31;
  const height = 21;
  const terrain = generateMaze({ seed: 1, width, height, wall: WALL, floor: FLOOR });

  for (let x = 0; x < width; x += 1) {
    assert.equal(at(terrain, width, x, 0), WALL);
    assert.equal(at(terrain, width, x, height - 1), WALL);
  }
  for (let y = 0; y < height; y += 1) {
    assert.equal(at(terrain, width, 0, y), WALL);
    assert.equal(at(terrain, width, width - 1, y), WALL);
  }
});

test("迷宫：所有通道连通", () => {
  const width = 33;
  const height = 23;
  const terrain = generateMaze({ seed: 7, width, height, wall: WALL, floor: FLOOR });
  assert.equal(reachable(terrain, width, height), floorCount(terrain), "有走不到的地板");
});

test("迷宫：确定性", () => {
  const make = () => generateMaze({ seed: 42, width: 25, height: 17, wall: WALL, floor: FLOOR });
  assert.deepEqual(make(), make());
});

test("迷宫：不同种子不同图", () => {
  const a = generateMaze({ seed: 1, width: 25, height: 17, wall: WALL, floor: FLOOR });
  const b = generateMaze({ seed: 2, width: 25, height: 17, wall: WALL, floor: FLOOR });
  assert.ok(JSON.stringify(a) !== JSON.stringify(b), "不同种子应该不同");
});

test("迷宫：编织会增加通道", () => {
  const plain = generateMaze({ seed: 5, width: 31, height: 21, wall: WALL, floor: FLOOR, braid: 0 });
  const braided = generateMaze({ seed: 5, width: 31, height: 21, wall: WALL, floor: FLOOR, braid: 1 });
  assert.ok(floorCount(braided) > floorCount(plain), "编织后地板应该更多");
  assert.equal(reachable(braided, 31, 21), floorCount(braided), "编织破坏了连通性");
});

test("迷宫：太小的图直接给空", () => {
  const terrain = generateMaze({ seed: 1, width: 4, height: 4, wall: WALL, floor: FLOOR });
  assert.equal(floorCount(terrain), 0);
});
