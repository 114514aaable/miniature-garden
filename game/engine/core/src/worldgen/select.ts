// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 选：把「若干场」翻译成「群系」，再把群系翻译成「地形」。
 *
 * 两条规则：
 *   1. 群系按声明顺序取第一个匹配（顺序有意义）；
 *   2. 地形按高度分档：水 / 山 / 底 —— 阈值来自生成器配置。
 *
 * 这里不碰文件、不碰随机，纯数据进纯数据出。
 */

export interface BiomeRange {
  readonly [field: string]: readonly [number, number];
}

export interface Biome {
  readonly id: string;
  readonly ranges: BiomeRange;
  /** 语义 → 地形名（如 { base: "grass", water: "water" }）。 */
  readonly terrain: Readonly<Record<string, string>>;
  readonly structures?: readonly string[];
  readonly tags?: readonly string[];
  readonly color?: string;
}

/** 采样：某个坐标上各场的值。 */
export type Sample = Readonly<Record<string, number>>;

/** 区间是闭区间；缺某个场就当匹配失败。 */
export function matchesRange(range: BiomeRange, sample: Sample): boolean {
  for (const [field, [min, max]] of Object.entries(range)) {
    const value = sample[field];
    if (value === undefined) return false;
    if (value < min || value > max) return false;
  }
  return true;
}

/** 按顺序取第一个匹配的群系；没有就是 null（调用方决定怎么兜底）。 */
export function pickBiome(biomes: readonly Biome[], sample: Sample): Biome | null {
  for (const biome of biomes) {
    if (matchesRange(biome.ranges, sample)) return biome;
  }
  return null;
}

export interface TerrainLevels {
  /** 低于它算水。 */
  readonly water?: number;
  /** 高于它算山。 */
  readonly hill?: number;
}

/**
 * 群系 + 高度 → 地形名。
 *
 * 语义键固定三个：`water` / `hill` / `base`。
 * 群系没声明某个键时退回 `base`，再没有就返回 null。
 */
export function terrainFor(biome: Biome, height: number, levels: TerrainLevels = {}): string | null {
  const water = levels.water;
  const hill = levels.hill;

  if (water !== undefined && height < water) {
    return biome.terrain.water ?? biome.terrain.base ?? null;
  }
  if (hill !== undefined && height > hill) {
    return biome.terrain.hill ?? biome.terrain.base ?? null;
  }
  return biome.terrain.base ?? null;
}
