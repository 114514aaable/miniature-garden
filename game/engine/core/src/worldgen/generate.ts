// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 生成一片地形：种子 + 尺寸 + 场参数 + 群系 → 地形号数组。
 *
 * 纯函数、确定性：同样的输入永远同样的地图。
 * 离线工具（tools/gen-world.mjs）和开局现场生成都用它。
 *
 * 尺寸上限 200×200——再大就不是「故事地图」而是沙盒了。
 */

import { noiseOf, type NoiseKind } from "./noise.ts";
import { pickBiome, terrainFor, type Biome } from "./select.ts";

export const MAX_SIZE = 200;
export const MIN_SIZE = 4;

export interface FieldConfig {
  readonly noise?: NoiseKind;
  readonly scale?: number;
  readonly octaves?: number;
  /** 每个场一个偏移，避免两个场「长得一样」。 */
  readonly seedOffset?: number;
}

export interface GenerateOptions {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  /** 场名 → 参数（height / moisture …）。 */
  readonly fields: Readonly<Record<string, FieldConfig>>;
  /** 群系，按声明顺序匹配；最后一个应当是 catch-all。 */
  readonly biomes: readonly Biome[];
  /** 地形代号 → 地形号。 */
  readonly terrainIdByCode: ReadonlyMap<string, number>;
  /** 高度分档。 */
  readonly levels?: { readonly water?: number; readonly hill?: number };
}

export interface GenerateResult {
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly number[];
  /** 群系分布（调试用）。 */
  readonly stats: Readonly<Record<string, number>>;
}

export function clampSize(value: number): number {
  if (!Number.isFinite(value)) return MIN_SIZE;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.floor(value)));
}

export function generateTerrain(options: GenerateOptions): GenerateResult {
  const width = clampSize(options.width);
  const height = clampSize(options.height);
  const levels = options.levels ?? {};

  if (options.biomes.length === 0) {
    throw new Error("没有群系，生成不了地形");
  }

  // 兜底群系：ranges 为空的那个（没有就明确报错，不静默挑一个）
  const fallback = options.biomes.find((biome) => Object.keys(biome.ranges).length === 0);
  if (fallback === undefined) {
    throw new Error("群系里需要一个 ranges 为空的兜底群系");
  }

  const terrain: number[] = [];
  const stats: Record<string, number> = {};

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sample: Record<string, number> = {};
      for (const [name, config] of Object.entries(options.fields)) {
        sample[name] = noiseOf(
          config.noise ?? "fbm",
          (options.seed + (config.seedOffset ?? 0)) >>> 0,
          x,
          y,
          config.scale ?? 8,
          config.octaves ?? 4,
        );
      }

      const biome = pickBiome(options.biomes, sample) ?? fallback;
      const code = terrainFor(biome, sample.height ?? 0.5, levels);
      if (code === null) {
        throw new Error(`群系 ${biome.id} 没给 base 地形`);
      }

      const id = options.terrainIdByCode.get(code);
      if (id === undefined) {
        throw new Error(
          `地形代号 "${code}" 不在包里（可用：${[...options.terrainIdByCode.keys()].join(" / ")}）`,
        );
      }

      terrain.push(id);
      stats[biome.id] = (stats[biome.id] ?? 0) + 1;
    }
  }

  return { width, height, terrain, stats };
}
