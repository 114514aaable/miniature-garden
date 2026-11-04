// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 生成流水线：把生成算法拆成「一步一个算子」，串起来跑。
 *
 * 为什么不再用 generation.generator 二选一：
 *   地下洞窟 = 地表（噪声+群系） + 洞穴遮罩 + 混合
 *   需要「多层叠加」，而不是「换一个生成器」。
 *
 * 约定：
 *   - 每个算子只改传入的 sandbox（地形数组 + 具名图层），不返回新世界；
 *   - 算子之间只通过 sandbox 的图层名交流（"biome" / "cave" …）；
 *   - 全部纯函数 + 确定性，同一份输入永远同一张图。
 */

import { generateCaves } from "./caves.ts";
import { generateTerrain, type FieldConfig } from "./generate.ts";
import type { Biome } from "./select.ts";

export interface Sandbox {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  /** 地形号数组（长度 width×height）。 */
  terrain: number[];
  /** 具名图层：来源算子写，混合算子读。 */
  readonly layers: Map<string, readonly number[]>;
  /** 群系号（overworld 算子写）。 */
  biome: number[];
}

export interface PipelineDeps {
  readonly biomes: readonly Biome[];
  readonly terrainIdByCode: ReadonlyMap<string, number>;
}

export type Step =
  | { readonly op: "overworld"; readonly fields?: Record<string, FieldConfig>; readonly levels?: { water?: number; hill?: number } }
  | {
      readonly op: "caves";
      readonly fill?: number;
      readonly iterations?: number;
      readonly spawnClear?: number;
      readonly regions?: number;
      readonly chambers?: number;
      /** 图层名，默认 "cave"。 */
      readonly as?: string;
    }
  | {
      readonly op: "blend";
      /** 用哪个洞穴图层。 */
      readonly cave?: string;
      /** 洞穴里「地」用哪个地形代号。 */
      readonly floor?: string;
      /** 洞穴里「墙」怎么处理：keep = 保留地表，solid = 变成墙。 */
      readonly wall?: "keep" | "solid";
      /** 洞穴只在一个矩形范围内生效（可选）。 */
      readonly inset?: number;
    };

export function createSandbox(seed: number, width: number, height: number, fill: number): Sandbox {
  return {
    seed,
    width,
    height,
    terrain: new Array<number>(width * height).fill(fill),
    layers: new Map(),
    biome: new Array<number>(width * height).fill(0),
  };
}

/** 洞穴图层：1 = 洞，0 = 岩。 */
export const CAVE_LAYER = "cave";

export function runPipeline(
  sandbox: Sandbox,
  steps: readonly Step[],
  deps: PipelineDeps,
): Sandbox {
  for (const step of steps) {
    switch (step.op) {
      case "overworld": {
        const result = generateTerrain({
          seed: sandbox.seed,
          width: sandbox.width,
          height: sandbox.height,
          fields: step.fields ?? {},
          biomes: deps.biomes,
          terrainIdByCode: deps.terrainIdByCode,
          levels: step.levels ?? {},
        });
        sandbox.terrain = [...result.terrain];
        break;
      }

      case "caves": {
        const caves = generateCaves({
          seed: sandbox.seed,
          width: sandbox.width,
          height: sandbox.height,
          fill: step.fill,
          iterations: step.iterations,
          spawnClear: step.spawnClear,
          regions: step.regions,
          chambers: step.chambers,
        });
        // 1 = 洞，0 = 石
        sandbox.layers.set(step.as ?? CAVE_LAYER, caves.walls.map((wall) => (wall ? 0 : 1)));
        break;
      }

      case "blend": {
        const cave = sandbox.layers.get(step.cave ?? CAVE_LAYER);
        if (cave === undefined) {
          throw new Error(`blend 找不到图层 "${step.cave ?? CAVE_LAYER}"`);
        }

        const floor = step.floor === undefined ? undefined : deps.terrainIdByCode.get(step.floor);
        if (step.floor !== undefined && floor === undefined) {
          throw new Error(`地形代号 "${step.floor}" 不在包里`);
        }

        const wallId = deps.terrainIdByCode.get("wall");
        if (step.wall === "solid" && wallId === undefined) {
          throw new Error("blend 需要地形代号 wall");
        }

        const inset = step.inset ?? 0;
        for (let y = inset; y < sandbox.height - inset; y += 1) {
          for (let x = inset; x < sandbox.width - inset; x += 1) {
            const index = y * sandbox.width + x;
            if (cave[index] !== 1) {
              // 洞穴的「岩」：保留地表，或整片变成墙
              if (step.wall === "solid" && wallId !== undefined) sandbox.terrain[index] = wallId;
              continue;
            }
            if (floor !== undefined) sandbox.terrain[index] = floor;
          }
        }
        break;
      }
    }
  }

  return sandbox;
}
