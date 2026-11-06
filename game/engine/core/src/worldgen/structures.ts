// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 结构：带图例的字符画，摆进生成出来的地图里。
 *
 *   图例  { "#": { terrain: "wall" }, ".": { terrain: "floor" } }
 *   地图  ["###", "#.#", "###"]
 *
 * 图例可以指向两种东西：
 *   地形       {"#": { "terrain": "wall" }}
 *   子结构     {"h": { "structure": "hut", "align": "center" }}
 *
 * 子结构在加载期展开成一份「地形矩阵 + 实体列表 + 门」——运行时只认展开后的样子。
 * 引用不能成环（和模板 extends 同一道关）。
 *
 * 摆放（place / rooms）只输出：
 *   地形改了哪些格、实体出生在哪、哪些格子被跳过（撞墙）
 */

import { cellRandom } from "./noise.ts";

export interface StructureEntity {
  /** 模板 id。 */
  readonly template: string;
  /** 相对结构的坐标。 */
  readonly x: number;
  readonly y: number;
}

export interface StructureAnchor {
  readonly x: number;
  readonly y: number;
  readonly facing: string;
}

/** 展开后的结构：运行期只认这个。 */
export interface StructureDef {
  readonly id: string;
  /** prop = 随便摆的景物；room = 房间（rooms 算子的候选）。 */
  readonly role: "prop" | "room";
  readonly width: number;
  readonly height: number;
  /** 每格的地形代号；null = 不改这一格。 */
  readonly cells: ReadonlyArray<string | null>;
  readonly entities: ReadonlyArray<StructureEntity>;
  readonly anchors: ReadonlyArray<StructureAnchor>;
  /** 拼贴时的权重（默认 1）。 */
  readonly weight: number;
}

/** 展开前：图例里可能是地形，也可能是子结构。 */
export interface RawStructure {
  readonly id: string;
  readonly role: "prop" | "room";
  readonly width: number;
  readonly height: number;
  readonly terrain: ReadonlyArray<string | null>;
  readonly subs: ReadonlyArray<{ readonly x: number; readonly y: number; readonly id: string; readonly align: "top-left" | "center" }>;
  readonly entities: ReadonlyArray<StructureEntity>;
  readonly anchors: ReadonlyArray<StructureAnchor>;
  readonly weight: number;
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

/** 一次出生请求：由生成器产出，宿主负责真正放。 */
export interface SpawnRequest {
  readonly template: string;
  readonly x: number;
  readonly y: number;
  /** 来自哪个结构（调试用）。 */
  readonly source: string;
}

const FACINGS = new Set(["north", "south", "east", "west"]);

/** 校验并解析一个结构（子结构还没展开）。 */
export function parseStructure(raw: unknown, idKey: string): RawStructure {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`结构 ${idKey}：应该是对象`);
  }

  const data = raw as {
    map?: unknown;
    legend?: unknown;
    role?: unknown;
    anchors?: unknown;
    entities?: unknown;
    weight?: unknown;
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
    throw new Error(`结构 ${idKey}：缺少 legend（符号 → 地形 / 子结构）`);
  }

  const terrainOf = new Map<string, string>();
  const subOf = new Map<string, { id: string; align: "top-left" | "center" }>();
  for (const [symbol, entry] of Object.entries(legend)) {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`结构 ${idKey}：legend["${symbol}"] 应该是对象`);
    }

    const record = entry as { terrain?: unknown; structure?: unknown; align?: unknown };
    if (typeof record.terrain === "string" && record.terrain.length > 0) {
      terrainOf.set(symbol, record.terrain);
      continue;
    }
    if (typeof record.structure === "string" && record.structure.length > 0) {
      const align = record.align ?? "top-left";
      if (align !== "top-left" && align !== "center") {
        throw new Error(`结构 ${idKey}：legend["${symbol}"] 的 align 只能是 top-left / center`);
      }
      subOf.set(symbol, { id: record.structure, align });
      continue;
    }
    throw new Error(`结构 ${idKey}：legend["${symbol}"] 需要 terrain 或 structure`);
  }

  const terrain: Array<string | null> = [];
  const subs: Array<{ x: number; y: number; id: string; align: "top-left" | "center" }> = [];

  for (const [y, row] of rows.entries()) {
    for (const [x, symbol] of [...row].entries()) {
      if (symbol === " ") {
        terrain.push(null);
        continue;
      }

      const sub = subOf.get(symbol);
      if (sub !== undefined) {
        terrain.push(null);
        subs.push({ x, y, id: sub.id, align: sub.align });
        continue;
      }

      const code = terrainOf.get(symbol);
      if (code === undefined) {
        throw new Error(`结构 ${idKey}：(${x}, ${y}) 的符号 "${symbol}" 不在 legend 里`);
      }
      terrain.push(code);
    }
  }

  return {
    id: idKey,
    role: parseRole(data),
    width,
    height: rows.length,
    terrain,
    subs,
    entities: parseEntities(data, width, rows.length, idKey),
    anchors: parseAnchors(data, width, rows.length, idKey),
    weight: parseWeight(data),
  };
}

/**
 * 把所有结构展开成「地形矩阵 + 实体 + 门」。
 *
 * 子结构按 legend 里的对齐方式盖上，后盖的覆盖先盖的；有环直接报错。
 */
export function resolveStructures(raws: ReadonlyMap<string, RawStructure>): Map<string, StructureDef> {
  const resolved = new Map<string, StructureDef>();
  const visiting = new Set<string>();

  const resolve = (id: string): StructureDef => {
    const done = resolved.get(id);
    if (done !== undefined) return done;

    const raw = raws.get(id);
    if (raw === undefined) throw new Error(`结构不存在："${id}"`);

    if (visiting.has(id)) {
      throw new Error(`结构引用成环：${[...visiting].join(" → ")} → ${id}`);
    }
    visiting.add(id);

    const cells: Array<string | null> = [...raw.terrain];
    const entities: StructureEntity[] = [...raw.entities];
    const anchors: StructureAnchor[] = [...raw.anchors];

    for (const sub of raw.subs) {
      const child = resolve(sub.id);
      const originX = sub.align === "center" ? sub.x - Math.floor(child.width / 2) : sub.x;
      const originY = sub.align === "center" ? sub.y - Math.floor(child.height / 2) : sub.y;

      if (originX < 0 || originY < 0 || originX + child.width > raw.width || originY + child.height > raw.height) {
        throw new Error(`结构 ${id}：子结构 ${sub.id} 放不下（越界）`);
      }

      for (let y = 0; y < child.height; y += 1) {
        for (let x = 0; x < child.width; x += 1) {
          const code = child.cells[y * child.width + x];
          if (code !== null) cells[(originY + y) * raw.width + originX + x] = code;
        }
      }

      for (const entity of child.entities) {
        entities.push({ template: entity.template, x: originX + entity.x, y: originY + entity.y });
      }
      for (const anchor of child.anchors) {
        anchors.push({ x: originX + anchor.x, y: originY + anchor.y, facing: anchor.facing });
      }
    }

    visiting.delete(id);

    const def: StructureDef = {
      id: raw.id,
      role: raw.role,
      width: raw.width,
      height: raw.height,
      cells,
      entities,
      anchors,
      weight: raw.weight,
    };
    resolved.set(id, def);
    return def;
  };

  for (const id of raws.keys()) resolve(id);
  return resolved;
}

/** weight：默认 1，必须 > 0。 */
function parseWeight(data: { weight?: unknown }): number {
  if (data.weight === undefined) return 1;
  if (typeof data.weight !== "number" || !Number.isFinite(data.weight) || data.weight <= 0) {
    throw new Error("结构的 weight 必须是正数");
  }
  return data.weight;
}

/** role：默认 prop。 */
function parseRole(data: { role?: unknown }): "prop" | "room" {
  if (data.role === undefined) return "prop";
  if (data.role === "prop" || data.role === "room") return data.role;
  throw new Error(`结构的 role 只能是 prop / room，收到 "${String(data.role)}"`);
}

/** entities：[{ template, dx, dy }]，坐标必须在图里。 */
function parseEntities(
  data: { entities?: unknown },
  width: number,
  height: number,
  idKey: string,
): StructureEntity[] {
  if (data.entities === undefined) return [];
  if (!Array.isArray(data.entities)) throw new Error(`结构 ${idKey}：entities 应该是数组`);

  return data.entities.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`结构 ${idKey}：entities[${index}] 应该是对象`);
    }
    const { template, dx, dy } = entry as { template?: unknown; dx?: unknown; dy?: unknown };
    if (typeof template !== "string" || template.length === 0) {
      throw new Error(`结构 ${idKey}：entities[${index}] 缺少 template`);
    }
    if (typeof dx !== "number" || typeof dy !== "number" || !Number.isInteger(dx) || !Number.isInteger(dy)) {
      throw new Error(`结构 ${idKey}：entities[${index}] 的 dx / dy 应该是整数`);
    }
    if (dx < 0 || dy < 0 || dx >= width || dy >= height) {
      throw new Error(`结构 ${idKey}：entities[${index}] (${dx}, ${dy}) 不在图里`);
    }
    return { template, x: dx, y: dy };
  });
}

/** anchors：坐标必须在图里，朝向必须是四个方向之一。 */
function parseAnchors(
  data: { anchors?: unknown },
  width: number,
  height: number,
  idKey: string,
): Array<{ x: number; y: number; facing: string }> {
  if (data.anchors === undefined) return [];
  if (!Array.isArray(data.anchors)) throw new Error(`结构 ${idKey}：anchors 应该是数组`);

  return data.anchors.map((anchor, index) => {
    if (typeof anchor !== "object" || anchor === null) {
      throw new Error(`结构 ${idKey}：anchors[${index}] 应该是对象`);
    }
    const { x, y, facing } = anchor as { x?: unknown; y?: unknown; facing?: unknown };
    if (typeof x !== "number" || typeof y !== "number" || !Number.isInteger(x) || !Number.isInteger(y)) {
      throw new Error(`结构 ${idKey}：anchors[${index}] 的 x / y 应该是整数`);
    }
    if (x < 0 || y < 0 || x >= width || y >= height) {
      throw new Error(`结构 ${idKey}：anchors[${index}] (${x}, ${y}) 不在图里`);
    }
    if (typeof facing !== "string" || !FACINGS.has(facing)) {
      throw new Error(`结构 ${idKey}：anchors[${index}] 的 facing 必须是 north / south / east / west`);
    }
    return { x, y, facing };
  });
}

/**
 * 把结构盖进地形数组（越界的格子跳过）。
 *
 * 返回出生请求：落在墙上的实体跳过，并记一条警告。
 */
export function stampStructure(
  terrain: number[],
  mapWidth: number,
  mapHeight: number,
  structure: StructureDef,
  originX: number,
  originY: number,
  terrainIdByCode: ReadonlyMap<string, number>,
  warnings?: string[],
): SpawnRequest[] {
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

  const spawns: SpawnRequest[] = [];
  for (const entity of structure.entities) {
    const x = originX + entity.x;
    const y = originY + entity.y;
    if (x < 0 || y < 0 || x >= mapWidth || y >= mapHeight) {
      warnings?.push(`${structure.id}：实体 ${entity.template} 越界（${x}, ${y}）`);
      continue;
    }

    const cell = terrain[y * mapWidth + x];
    const code = codeOf(terrainIdByCode, cell);
    if (code === "wall") {
      warnings?.push(`${structure.id}：实体 ${entity.template} 落在墙上，跳过（${x}, ${y}）`);
      continue;
    }

    spawns.push({ template: entity.template, x, y, source: `${structure.id}@${originX},${originY}` });
  }

  return spawns;
}

function codeOf(terrainIdByCode: ReadonlyMap<string, number>, id: number): string | undefined {
  for (const [code, value] of terrainIdByCode) if (value === id) return code;
  return undefined;
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
  warnings?: string[],
): { placements: Placement[]; spawns: SpawnRequest[] } {
  const count = Math.max(0, Math.floor(spec.count ?? 1));
  const spacing = Math.max(0, Math.floor(spec.spacing ?? 4));
  const inset = Math.max(0, Math.floor(spec.inset ?? 1));
  const allowed = spec.on === undefined ? null : new Set(spec.on);
  const tries = Math.max(1, Math.floor(spec.tries ?? 200));

  const placements: Placement[] = [];
  const spawns: SpawnRequest[] = [];
  const taken: Array<{ x: number; y: number; w: number; h: number }> = [];

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

      spawns.push(...stampStructure(terrain, width, height, def, x, y, terrainIdByCode, warnings));
      taken.push({ x, y, w: def.width, h: def.height });
      placements.push({ structure: id, x, y });
      break;
    }
  }

  return { placements, spawns };
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
