// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 结构：带图例的字符画，摆进生成出来的地图里。
 *
 * 第一批只做「地形」：
 *   图例  { "#": { terrain: "wall" }, ".": { terrain: "floor" } }
 *   地图  ["###", "#.#", "###"]
 *
 * 摆放规则（全部确定性）：
 *   - 只落在允许的地形上（on 里的代号）
 *   - 彼此至少隔 spacing 格（切比雪夫距离）
 *   - 不出边界、不重叠
 *
 * 以后再加：实体、子结构、锚点、旋转。
 */

import { cellRandom } from "./noise.ts";

export interface StructureDef {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  /** 每格的地形代号；null = 不改这一格。 */
  readonly cells: ReadonlyArray<string | null>;
}

export interface PlaceSpec {
  readonly structures: readonly string[];
  readonly count?: number;
  /** 彼此至少隔多少格（切比雪夫）。 */
  readonly spacing?: number;
  /** 只摆在这些地形代号上。 */
  readonly on?: readonly string[];
  /** 离地图边缘至少多少格。 */
  readonly inset?: number;
  /** 最多尝试多少次候选点（防止死循环）。 */
  readonly tries?: number;
}

export interface Placement {
  readonly structure: string;
  readonly x: number;
  readonly y: number;
}

/** 校验并解析一个结构定义。 */
export function parseStructure(raw: unknown, idKey: string): StructureDef {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`结构 ${idKey}：应该是对象`);
  }

  const data = raw as {
    map?: unknown;
    legend?: unknown;
  };

  if (!Array.isArray(data.map) || data.map.length === 0) {
    throw new Error(`结构 ${idKey}：缺少 map`);
  }

  const rows = data.map.map((row, index) => {
    if (typeof row !== "string" || row.length === 0) {
      throw new Error(`结构 ${idKey}：map 第 ${index} 行应该是非空字符串`);
    }
    return row;
  });

  const width = rows[0].length;
  for (const [index, row] of rows.entries()) {
    if (row.length !== width) {
      throw new Error(`结构 ${idKey}：第 ${index} 行宽度 ${row.length}，应为 ${width}`);
    }
  }

  const legend = data.legend;
  if (typeof legend !== "object" || legend === null || Array.isArray(legend)) {
    throw new Error(`结构 ${idKey}：缺少 legend（符号 → 地形）`);
  }

  const terrainOf = new Map<string, string>();
  for (const [symbol, entry] of Object.entries(legend)) {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`结构 ${idKey}：legend["${symbol}"] 应该是对象`);
    }
    const terrain = (entry as { terrain?: unknown }).terrain;
    if (typeof terrain !== "string" || terrain.length === 0) {
      throw new Error(`结构 ${idKey}：legend["${symbol}"] 缺少 terrain`);
    }
    terrainOf.set(symbol, terrain);
  }

  const cells: Array<string | null> = [];
  for (const [y, row] of rows.entries()) {
    for (const [x, symbol] of [...row].entries()) {
      if (symbol === " ") {
        cells.push(null);
        continue;
      }
      const terrain = terrainOf.get(symbol);
      if (terrain === undefined) {
        throw new Error(`结构 ${idKey}：(${x}, ${y}) 的符号 "${symbol}" 不在 legend 里`);
      }
      cells.push(terrain);
    }
  }

  return { id: idKey, width, height: rows.length, cells };
}

/** 把结构盖进地形数组（越界的格子跳过）。 */
export function stampStructure(
  terrain: number[],
  mapWidth: number,
  mapHeight: number,
  structure: StructureDef,
  originX: number,
  originY: number,
  terrainIdByCode: ReadonlyMap<string, number>,
): void {
  for (let y = 0; y < structure.height; y += 1) {
    for (let x = 0; x < structure.width; x += 1) {
      const code = structure.cells[y * structure.width + x];
      if (code === null) continue;

      const targetX = originX + x;
      const targetY = originY + y;
      if (targetX < 0 || targetY < 0 || targetX >= mapWidth || targetY >= mapHeight) continue;

      const id = terrainIdByCode.get(code);
      if (id === undefined) throw new Error(`地形代号 "${code}" 不在包里`);

      terrain[targetY * mapWidth + targetX] = id;
    }
  }
}

/**
 * 按规格摆一批结构。
 *
 * 随机点由 (seed, 第几个结构, 第几次尝试) 决定，纯粹按坐标派发——可复现。
 */
export function placeStructures(
  terrain: number[],
  width: number,
  height: number,
  defs: ReadonlyMap<string, StructureDef>,
  spec: PlaceSpec,
  seed: number,
  terrainIdByCode: ReadonlyMap<string, number>,
  codeOfTerrain: (terrainId: number) => string | undefined,
): Placement[] {
  const count = Math.max(0, Math.floor(spec.count ?? 1));
  const spacing = Math.max(0, Math.floor(spec.spacing ?? 4));
  const inset = Math.max(0, Math.floor(spec.inset ?? 1));
  const allowed = spec.on === undefined ? null : new Set(spec.on);
  const tries = Math.max(1, Math.floor(spec.tries ?? 200));

  const placed: Placement[] = [];
  const taken: Array<{ x: number; y: number; w: number; h: number; id: string }> = [];

  for (let index = 0; index < count; index += 1) {
    const id = spec.structures[index % spec.structures.length];
    const def = defs.get(id);
    if (def === undefined) throw new Error(`place 引用了不存在的结构："${id}"`);

    for (let attempt = 0; attempt < tries; attempt += 1) {
      const maxX = width - inset - def.width;
      const maxY = height - inset - def.height;
      if (maxX < inset || maxY < inset) break;

      const x = inset + Math.floor(cellRandom(seed + index * 7919, attempt, 1) * (maxX - inset + 1));
      const y = inset + Math.floor(cellRandom(seed + index * 7919, attempt, 2) * (maxY - inset + 1));

      if (!fits(terrain, width, allowed, codeOfTerrain, def, x, y)) continue;
      if (!spaced(taken, def, x, y, spacing)) continue;

      stampStructure(terrain, width, height, def, x, y, terrainIdByCode);
      taken.push({ x, y, w: def.width, h: def.height, id });
      placed.push({ structure: id, x, y });
      break;
    }
  }

  return placed;
}

/** 整个 footprint 都在允许的地形上吗？ */
function fits(
  terrain: number[],
  width: number,
  allowed: Set<string> | null,
  codeOfTerrain: (terrainId: number) => string | undefined,
  def: StructureDef,
  originX: number,
  originY: number,
): boolean {
  if (allowed === null) return true;

  for (let y = 0; y < def.height; y += 1) {
    for (let x = 0; x < def.width; x += 1) {
      const code = codeOfTerrain(terrain[(originY + y) * width + originX + x]);
      if (code === undefined || !allowed.has(code)) return false;
    }
  }
  return true;
}

/** 和已经摆下的结构至少隔 spacing 格（按矩形边缘算）。 */
function spaced(
  taken: ReadonlyArray<{ x: number; y: number; w: number; h: number }>,
  def: StructureDef,
  x: number,
  y: number,
  spacing: number,
): boolean {
  for (const other of taken) {
    const gapX = Math.max(other.x - (x + def.width), x - (other.x + other.w), 0);
    const gapY = Math.max(other.y - (y + def.height), y - (other.y + other.h), 0);
    if (Math.max(gapX, gapY) < spacing) return false;
  }
  return true;
}
