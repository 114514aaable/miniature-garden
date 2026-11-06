// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 拼贴：把 7×7 的房间件按「门口」贴成一张图。
 *
 * 规则：
 *   每个 meta 格需要开哪几条边 = 它在网格里的邻居
 *   候选件里挑「门集合恰好相等」的（可旋转 0/90/180/270）
 *   挑不到 → 程序化挖一个刚好这些开口的十字格（兜底）
 *
 * 门连接是自动的：相邻两格都开同一条边，门就在边界上对齐。
 */

import { makeRandom } from "./random.ts";
import { stampStructure, type SpawnRequest, type StructureDef } from "./structures.ts";

/** 四方向。 */
const SIDES = ["north", "east", "south", "west"] as const;
type Side = (typeof SIDES)[number];

/** 顺时针转 90°。 */
export function rotateStructure(def: StructureDef): StructureDef {
  const width = def.height;
  const height = def.width;
  // (x, y) → (height - 1 - y, x)：顺时针
  const cells = new Array<string | null>(width * height).fill(null);
  for (let y = 0; y < def.height; y += 1) {
    for (let x = 0; x < def.width; x += 1) {
      cells[x * width + (def.height - 1 - y)] = def.cells[y * def.width + x];
    }
  }

  const facingMap: Record<string, Side> = { north: "east", east: "south", south: "west", west: "north" };
  return {
    ...def,
    width,
    height,
    cells,
    anchors: def.anchors.map((anchor) => ({
      x: def.height - 1 - anchor.y,
      y: anchor.x,
      facing: facingMap[anchor.facing] ?? anchor.facing,
    })),
    entities: def.entities.map((entity) => ({
      template: entity.template,
      x: def.height - 1 - entity.y,
      y: entity.x,
    })),
  };
}

/** 一件的门集合（只认贴在边上的门）。 */
export function portsOf(def: StructureDef): Set<Side> {
  const ports = new Set<Side>();
  for (const anchor of def.anchors) {
    const side = sideOf(anchor.x, anchor.y, def.width, def.height);
    if (side !== null) ports.add(side);
  }
  return ports;
}

function sideOf(x: number, y: number, width: number, height: number): Side | null {
  if (y === 0) return "north";
  if (y === height - 1) return "south";
  if (x === 0) return "west";
  if (x === width - 1) return "east";
  return null;
}

/** 所有旋转里挑匹配的；没有就 null。 */
export function findRotation(
  def: StructureDef,
  required: ReadonlySet<Side>,
  boundary: ReadonlySet<Side> = new Set(),
): StructureDef | null {
  let current = def;
  for (let turn = 0; turn < 4; turn += 1) {
    if (matches(portsOf(current), required, boundary)) return current;
    current = rotateStructure(current);
  }
  return null;
}

/** 必需边必须开；多余的门只允许开在边界上（否则会开向邻格的墙）。 */
function matches(ports: ReadonlySet<Side>, required: ReadonlySet<Side>, boundary: ReadonlySet<Side>): boolean {
  for (const side of required) if (!ports.has(side)) return false;
  for (const side of ports) {
    if (required.has(side)) continue;
    if (!boundary.has(side)) return false;
  }
  return true;
}


export interface TilePlacement {
  readonly tile: string;
  readonly metaX: number;
  readonly metaY: number;
  readonly fallback: boolean;
}

/**
 * 把 meta 网格铺满 7×7 的件。
 *
 * 地图尺寸必须是 7 的倍数；不够的部分不铺（保持墙）。
 */
export function placeTiles(
  terrain: number[],
  width: number,
  height: number,
  defs: ReadonlyMap<string, StructureDef>,
  ids: readonly string[],
  seed: number,
  terrainIdByCode: ReadonlyMap<string, number>,
): { placements: TilePlacement[]; spawns: SpawnRequest[]; warnings: string[] } {
  const wall = terrainIdByCode.get("wall");
  const floor = terrainIdByCode.get("floor");
  if (wall === undefined) throw new Error("tiles 需要地形：wall");
  if (floor === undefined) throw new Error("tiles 需要地形：floor");

  if (ids.length === 0) throw new Error("tiles 至少需要一个件");
  const candidates = ids.map((id) => {
    const def = defs.get(id);
    if (def === undefined) throw new Error(`tiles 引用了不存在的结构："${id}"`);
    if (def.width !== 7 || def.height !== 7) throw new Error(`件 "${id}" 不是 7×7`);
    return def;
  });

  const metaW = Math.floor(width / 7);
  const metaH = Math.floor(height / 7);
  if (metaW < 1 || metaH < 1) throw new Error("地图太小，放不下 7×7 的件");

  terrain.fill(wall);

  const rand = makeRandom(seed >>> 0);
  const placements: TilePlacement[] = [];
  const spawns: SpawnRequest[] = [];
  const warnings: string[] = [];

  for (let metaY = 0; metaY < metaH; metaY += 1) {
    for (let metaX = 0; metaX < metaW; metaX += 1) {
      const required = new Set<Side>();
      if (metaY > 0) required.add("north");
      if (metaY < metaH - 1) required.add("south");
      if (metaX > 0) required.add("west");
      if (metaX < metaW - 1) required.add("east");

      // 地图边界：多余的门只允许开在这里
      const boundary = new Set<Side>();
      if (metaY === 0) boundary.add("north");
      if (metaY === metaH - 1) boundary.add("south");
      if (metaX === 0) boundary.add("west");
      if (metaX === metaW - 1) boundary.add("east");

      // 候选：能旋转出这个门集合的件
      const fitting: Array<{ def: StructureDef; weight: number }> = [];
      for (const def of candidates) {
        const rotated = findRotation(def, required, boundary);
        if (rotated !== null) fitting.push({ def: rotated, weight: rotated.weight });
      }

      const originX = metaX * 7;
      const originY = metaY * 7;

      if (fitting.length === 0) {
        // 兜底：程序化挖一个十字，保证这组开口
        carveFallback(terrain, width, height, originX, originY, required, floor, wall);
        placements.push({ tile: "(fallback)", metaX, metaY, fallback: true });
        warnings.push(`(${metaX}, ${metaY}) 没有匹配的件，已用兜底十字`);
        continue;
      }

      const total = fitting.reduce((sum, item) => sum + item.weight, 0);
      let roll = rand() * total;
      let pick = fitting[0];
      for (const item of fitting) {
        roll -= item.weight;
        if (roll <= 0) {
          pick = item;
          break;
        }
      }
      spawns.push(...stampStructure(terrain, width, height, pick.def, originX, originY, terrainIdByCode, warnings));
      placements.push({ tile: pick.def.id, metaX, metaY, fallback: false });
    }
  }

  // 验收：所有地板必须连成一片
  if (hasOrphans(terrain, width, height, floor)) warnings.push("拼出来的图有走不到的地板（件之间门没对齐）");

  return { placements, spawns, warnings };
}

/** 兜底件：外墙 + 十字，按 required 开边。 */
function carveFallback(
  terrain: number[],
  width: number,
  height: number,
  originX: number,
  originY: number,
  required: ReadonlySet<Side>,
  floor: number,
  wall: number,
): void {
  const put = (x: number, y: number, id: number): void => {
    const targetX = originX + x;
    const targetY = originY + y;
    if (targetX < 0 || targetY < 0 || targetX >= width || targetY >= height) return;
    terrain[targetY * width + targetX] = id;
  };

  // 整块先填墙
  for (let y = 0; y < 7; y += 1) for (let x = 0; x < 7; x += 1) put(x, y, wall);

  // 十字走廊
  for (let i = 0; i < 7; i += 1) {
    put(i, 3, floor);
    put(3, i, floor);
  }

  // 没开的边：边界那格补回墙
  if (!required.has("north")) put(3, 0, wall);
  if (!required.has("south")) put(3, 6, wall);
  if (!required.has("west")) put(0, 3, wall);
  if (!required.has("east")) put(6, 3, wall);
}
/** 是否有走不到的地板（true = 有问题）。 */
function hasOrphans(terrain: number[], width: number, height: number, floor: number): boolean {
  let start = -1;
  let total = 0;
  for (let index = 0; index < terrain.length; index += 1) {
    if (terrain[index] === floor) {
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
      if (seen.has(next) || terrain[next] !== floor) continue;
      seen.add(next);
      queue.push(next);
    }
  }

  return seen.size !== total;
}
