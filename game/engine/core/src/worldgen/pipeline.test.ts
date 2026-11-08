// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 流水线测试：叠加两层能出「地表 + 洞穴」。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { CAVE_LAYER, createSandbox, runPipeline, type Step } from "./pipeline.ts";
import type { Biome } from "./generators/select.ts";

const IDS = new Map([
  ["floor", 3],
  ["water", 2],
  ["wall", 1],
  ["cave_floor", 4],
]);

const BIOMES: Biome[] = [{ id: "dry", ranges: {}, terrain: { base: "floor", water: "water", hill: "wall" } }];

test("只跑地表：地形里有 floor/water/wall", () => {
  const sandbox = createSandbox(1, 20, 12, 0);
  runPipeline(sandbox, [{ op: "overworld" }], { biomes: BIOMES, terrainIdByCode: IDS });

  assert.equal(sandbox.terrain.length, 240);
  assert.ok(sandbox.terrain.every((id) => [1, 2, 3].includes(id)));
});

test("洞穴图层被写进 sandbox", () => {
  const sandbox = createSandbox(3, 24, 16, 0);
  runPipeline(sandbox, [{ op: "caves", fill: 0.5 }], { biomes: BIOMES, terrainIdByCode: IDS });

  const cave = sandbox.layers.get(CAVE_LAYER);
  assert.ok(cave !== undefined);
  assert.ok(cave.some((cell) => cell === 1), "应该有洞");
  assert.ok(cave.some((cell) => cell === 0), "应该有岩");
});

test("叠加：地表 + 洞穴 → 洞里换地形，岩保留地表", () => {
  const sandbox = createSandbox(5, 30, 20, 0);
  const steps: Step[] = [
    { op: "overworld" },
    { op: "caves", fill: 0.5 },
    { op: "blend", floor: "cave_floor", wall: "keep" },
  ];

  runPipeline(sandbox, steps, { biomes: BIOMES, terrainIdByCode: IDS });

  const cave = sandbox.layers.get(CAVE_LAYER) as readonly number[];
  for (let index = 0; index < cave.length; index += 1) {
    if (cave[index] === 1) assert.equal(sandbox.terrain[index], 4, "洞里应该是 cave_floor");
    else assert.notEqual(sandbox.terrain[index], 4, "岩不该被换成洞地形");
  }
});

test("叠加顺序无关？不——后写的覆盖先写的", () => {
  const sandbox = createSandbox(5, 16, 12, 0);
  runPipeline(
    sandbox,
    [
      { op: "overworld" },
      { op: "caves", fill: 0.5 },
      { op: "blend", floor: "cave_floor", wall: "solid" },
    ],
    { biomes: BIOMES, terrainIdByCode: IDS },
  );

  const cave = sandbox.layers.get(CAVE_LAYER) as readonly number[];
  for (let index = 0; index < cave.length; index += 1) {
    assert.equal(sandbox.terrain[index], cave[index] === 1 ? 4 : 1);
  }
});

test("blend 找不到图层要报错", () => {
  const sandbox = createSandbox(1, 8, 8, 0);
  assert.throws(() => runPipeline(sandbox, [{ op: "blend", floor: "cave_floor" }], { biomes: BIOMES, terrainIdByCode: IDS }), /找不到图层/);
});

test("blend 用了不存在的地形代号要报错", () => {
  const sandbox = createSandbox(1, 8, 8, 0);
  assert.throws(
    () => runPipeline(sandbox, [{ op: "caves" }, { op: "blend", floor: "lava" }], { biomes: BIOMES, terrainIdByCode: IDS }),
    /不在包里/,
  );
});
test("洞穴：默认直接写地形，as 才写图层", () => {
  const ids = new Map([["wall", 1], ["floor", 3]]);
  const biome = { id: "b", terrain: 3 };

  const direct = createSandbox(7, 20, 12, 3);
  runPipeline(direct, [{ op: "caves", fill: 0.5 }], { biomes: [], terrainIdByCode: ids });
  const kinds = new Set(direct.terrain);
  assert.ok(kinds.has(1) && kinds.has(3), "地形里应该有墙和地板");

  const layered = createSandbox(7, 20, 12, 3);
  runPipeline(layered, [{ op: "caves", fill: 0.5, as: "cave" }], { biomes: [], terrainIdByCode: ids });
  assert.equal(new Set(layered.terrain).size, 1, "as 模式不该改地形");
  assert.ok(layered.layers.has("cave"), "应该有洞穴图层");
  void biome;
});
