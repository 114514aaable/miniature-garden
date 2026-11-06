// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 实体投放：只落地板、出生点留空、标签过滤、确定性。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { populate } from "./populate.ts";
import type { Sandbox } from "./pipeline.ts";

const WIDTH = 20;
const HEIGHT = 14;
const FLOOR = 3;
const WALL = 1;

function makeSandbox(): Sandbox {
  return {
    seed: 1,
    width: WIDTH,
    height: HEIGHT,
    terrain: new Array<number>(WIDTH * HEIGHT).fill(WALL),
    layers: new Map(),
    biome: new Array<number>(WIDTH * HEIGHT).fill(0),
    spawns: [],
    entities: new Map(),
    regions: {
      rooms: [
        { x: 2, y: 2, w: 5, h: 4, tags: ["treasure"], structure: "vault" },
        { x: 11, y: 2, w: 5, h: 4, tags: [], structure: "cell" },
      ],
    },
    start: { x: 3, y: 3 },
  };
}

function carve(sandbox: Sandbox, x: number, y: number): void {
  sandbox.terrain[y * WIDTH + x] = FLOOR;
}

function carveRoom(sandbox: Sandbox, x: number, y: number, w: number, h: number): void {
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) carve(sandbox, x + dx, y + dy);
  }
}

test("投放：只落在地板上", () => {
  const sandbox = makeSandbox();
  carveRoom(sandbox, 2, 2, 5, 4);
  carveRoom(sandbox, 11, 2, 5, 4);

  const result = populate(sandbox, { rules: [{ where: "floor", templates: { crate: 1 }, density: 1 }] }, 5, FLOOR);
  assert.ok(result.placed > 0);

  for (const key of sandbox.entities.keys()) {
    assert.equal(sandbox.terrain[key], FLOOR, "实体落在了非地板上");
  }
});

test("投放：出生点周围留空", () => {
  const sandbox = makeSandbox();
  carveRoom(sandbox, 2, 2, 5, 4);
  carveRoom(sandbox, 11, 2, 5, 4);

  populate(sandbox, { rules: [{ where: "floor", templates: { crate: 1 }, density: 1 }] }, 5, FLOOR);

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      if (Math.abs(x - 3) + Math.abs(y - 3) > 3) continue;
      assert.equal(sandbox.entities.has(y * WIDTH + x), false, `出生点旁边有东西：(${x}, ${y})`);
    }
  }
});

test("投放：room + tags 只在对应房间", () => {
  const sandbox = makeSandbox();
  carveRoom(sandbox, 2, 2, 5, 4);
  carveRoom(sandbox, 11, 2, 5, 4);

  populate(
    sandbox,
    { rules: [{ where: "room", tags: ["treasure"], templates: { chest: 1 }, density: 1 }] },
    3, FLOOR,
  );

  for (const key of sandbox.entities.keys()) {
    const x = key % WIDTH;
    const y = Math.floor(key / WIDTH);
    assert.ok(x >= 2 && x <= 6 && y >= 2 && y <= 5, `投到了错误的房间：(${x}, ${y})`);
  }
});

test("投放：确定了就不再变", () => {
  const run = () => {
    const sandbox = makeSandbox();
    carveRoom(sandbox, 2, 2, 5, 4);
    carveRoom(sandbox, 11, 2, 5, 4);
    populate(sandbox, { rules: [{ where: "floor", templates: { crate: 1, lamp: 1 }, density: 0.5 }] }, 9, FLOOR);
    return [...sandbox.entities.entries()].map(([key, list]) => key + ":" + list.map((e) => e.template).join(","));
  };
  assert.deepEqual(run(), run());
});
