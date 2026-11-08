// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 布局：在 meta 网格上摆「房间」和「走廊」，边决定门口。
 *
 *   节点   一个 meta 格；成片的格子可以是一间大房间
 *   边     相邻格之间要不要通（先做生成树，再补环路）
 *   房间   程序化：内部地板 + 一圈墙 + 边上开门
 *   走廊   单格，用 7×7 的件按门口拼（旋转、加权、兜底）
 *
 * 这样大房间（2×2、3×2）和走廊能混在一张图里。
 */

import { makeRandom } from "../random.ts";
import { bestRotation } from "./tiles.ts";
import { stampStructure, type SpawnRequest, type StructureDef } from "../structures.ts";

export interface LayoutSpec {
  /** 走廊格可用的 7×7 件。 */
  readonly tiles: readonly string[];
  /** 大房间的数量（默认 0 = 全走廊）。 */
  readonly rooms?: number;
  /** 房间最小/最大尺寸（格，默认 2×2 / 3×2）。 */
  readonly roomMin?: readonly [number, number];
  readonly roomMax?: readonly [number, number];
  /** 额外环路比例（默认 0.15）。 */
  readonly loops?: number;
}

export interface LayoutRoom {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface LayoutResult {
  readonly placements: Array<{ tile: string; metaX: number; metaY: number; fallback: boolean }>;
  readonly rooms: LayoutRoom[];
  readonly spawns: SpawnRequest[];
  readonly warnings: string[];
}

type Side = "north" | "east" | "south" | "west";

const NEIGHBORS: Array<{ side: Side; dx: number; dy: number; opposite: Side }> = [
  { side: "north", dx: 0, dy: -1, opposite: "south" },
  { side: "south", dx: 0, dy: 1, opposite: "north" },
  { side: "west", dx: -1, dy: 0, opposite: "east" },
  { side: "east", dx: 1, dy: 0, opposite: "west" },
];

export function placeLayout(
  terrain: number[],
  width: number,
  height: number,
  defs: ReadonlyMap<string, StructureDef>,
  spec: LayoutSpec,
  seed: number,
  terrainIdByCode: ReadonlyMap<string, number>,
): LayoutResult {
  const wall = terrainIdByCode.get("wall");
  const floor = terrainIdByCode.get("floor");
  if (wall === undefined) throw new Error("layout 需要地形：wall");
  if (floor === undefined) throw new Error("layout 需要地形：floor");

  const metaW = Math.floor(width / 7);
  const metaH = Math.floor(height / 7);
  if (metaW < 2 || metaH < 2) throw new Error("地图太小，至少要 2×2 个 7×7 格");

  const rand = makeRandom(seed >>> 0);
  const keyOf = (x: number, y: number): number => y * metaW + x;

  // ── 1) 摆房间 ─────────────────────────────────────────────
  const roomAt = new Map<number, number>(); // meta 格 → 房间号
  const rooms: LayoutRoom[] = [];

  const roomMin = spec.roomMin ?? [2, 2];
  const roomMax = spec.roomMax ?? [3, 2];
  const wanted = Math.max(0, Math.floor(spec.rooms ?? 0));

  for (let attempt = 0; attempt < wanted * 12 && rooms.length < wanted; attempt += 1) {
    const w = roomMin[0] + Math.floor(rand() * (roomMax[0] - roomMin[0] + 1));
    const h = roomMin[1] + Math.floor(rand() * (roomMax[1] - roomMin[1] + 1));
    if (w > metaW - 1 || h > metaH - 1) continue;

    const x = Math.floor(rand() * (metaW - w + 1));
    const y = Math.floor(rand() * (metaH - h + 1));

    // 允许房间贴在一起：共用墙上开门就是「房间直连」
    let free = true;
    for (let dy = 0; dy < h && free; dy += 1) {
      for (let dx = 0; dx < w && free; dx += 1) {
        if (roomAt.has(keyOf(x + dx, y + dy))) free = false;
      }
    }
    if (!free) continue;

    const id = rooms.length;
    for (let dy = 0; dy < h; dy += 1) {
      for (let dx = 0; dx < w; dx += 1) roomAt.set(keyOf(x + dx, y + dy), id);
    }
    rooms.push({ x, y, w, h });
  }

  // ── 2) 生成树 + 环路 ─────────────────────────────────────
  const edges = new Set<string>();
  const edgeKey = (ax: number, ay: number, bx: number, by: number): string => {
    const a = keyOf(ax, ay);
    const b = keyOf(bx, by);
    return a < b ? a + ":" + b : b + ":" + a;
  };

  const visited = new Set<number>([keyOf(0, 0)]);
  let frontier: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];

  while (visited.size < metaW * metaH && frontier.length > 0) {
    const from = frontier[Math.floor(rand() * frontier.length)];
    const options = NEIGHBORS
      .map((dir) => ({ x: from.x + dir.dx, y: from.y + dir.dy }))
      .filter((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < metaW && cell.y < metaH)
      .filter((cell) => !visited.has(keyOf(cell.x, cell.y)));

    if (options.length === 0) {
      frontier = frontier.filter((cell) => cell !== from);
      continue;
    }

    const next = options[Math.floor(rand() * options.length)];
    edges.add(edgeKey(from.x, from.y, next.x, next.y));
    visited.add(keyOf(next.x, next.y));
    frontier.push(next);
  }

  // 补环路
  const loopCount = Math.floor(metaW * metaH * Math.min(1, Math.max(0, spec.loops ?? 0.15)));
  for (let i = 0; i < loopCount; i += 1) {
    const x = Math.floor(rand() * metaW);
    const y = Math.floor(rand() * metaH);
    const dir = NEIGHBORS[Math.floor(rand() * NEIGHBORS.length)];
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    if (nx < 0 || ny < 0 || nx >= metaW || ny >= metaH) continue;
    edges.add(edgeKey(x, y, nx, ny));
  }

  // ── 3) 每格的门口 ────────────────────────────────────────
  const ports = new Map<number, Set<Side>>();

  for (let y = 0; y < metaH; y += 1) {
    for (let x = 0; x < metaW; x += 1) ports.set(keyOf(x, y), new Set<Side>());
  }

  for (const edge of edges) {
    const [a, b] = edge.split(":").map(Number);
    const ax = a % metaW;
    const ay = Math.floor(a / metaW);
    const bx = b % metaW;
    const by = Math.floor(b / metaW);
    if (bx === ax + 1) {
      ports.get(a)?.add("east");
      ports.get(b)?.add("west");
    } else if (bx === ax - 1) {
      ports.get(a)?.add("west");
      ports.get(b)?.add("east");
    } else if (by === ay + 1) {
      ports.get(a)?.add("south");
      ports.get(b)?.add("north");
    } else if (by === ay - 1) {
      ports.get(a)?.add("north");
      ports.get(b)?.add("south");
    }
  }

  // ── 4) 画房间 / 贴走廊 ───────────────────────────────────
  terrain.fill(wall);
  const placements: LayoutResult["placements"] = [];
  const spawns: SpawnRequest[] = [];
  const warnings: string[] = [];

  for (const room of rooms) {
    carveRoom(terrain, width, metaW, room, ports, floor, wall);
  }

  // 走廊格：交给 tiles 那套（复用匹配/旋转/兜底）
  const corridorCells: Array<{ x: number; y: number; required: Set<Side> }> = [];

  for (let y = 0; y < metaH; y += 1) {
    for (let x = 0; x < metaW; x += 1) {
      if (roomAt.has(keyOf(x, y))) continue;
      const required = new Set<Side>(ports.get(keyOf(x, y)));
      corridorCells.push({ x, y, required });
    }
  }

  for (const cell of corridorCells) {
    const boundary = new Set<Side>();
    if (cell.y === 0) boundary.add("north");
    if (cell.y === metaH - 1) boundary.add("south");
    if (cell.x === 0) boundary.add("west");
    if (cell.x === metaW - 1) boundary.add("east");

    const fitting: Array<{ def: StructureDef; extras: Set<Side>; weight: number }> = [];
    for (const id of spec.tiles) {
      const def = defs.get(id);
      if (def === undefined) throw new Error(`layout 引用了不存在的件："${id}"`);
      if (def.width !== 7 || def.height !== 7) throw new Error(`件 "${id}" 不是 7×7`);
      const rotated = bestRotation(def, cell.required, boundary);
      if (rotated !== null) fitting.push({ def: rotated.def, extras: rotated.extras, weight: rotated.def.weight });
    }

    const originX = cell.x * 7;
    const originY = cell.y * 7;

    if (fitting.length === 0) {
      carveCorridorCell(terrain, width, height, originX, originY, cell.required, floor, wall);
      placements.push({ tile: "(fallback)", metaX: cell.x, metaY: cell.y, fallback: true });
      warnings.push(`(${cell.x}, ${cell.y}) 没有匹配的件，已用兜底十字`);
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

    // 把没需求的门砌上：否则会开向邻格的墙
    for (const side of pick.extras) {
      const spot = doorSpot(pick.def, side, originX, originY);
      if (spot !== null) terrain[spot.y * width + spot.x] = wall;
    }
    placements.push({ tile: pick.def.id, metaX: cell.x, metaY: cell.y, fallback: false });
  }

  // ── 5) 连通验收 ──────────────────────────────────────────
  if (hasOrphans(terrain, width, height, floor)) {
    warnings.push("布局里有走不到的地板");
  }

  return { placements, rooms, spawns, warnings };
}

/** 画一间大房间：内部地板 + 一圈墙 + 门。 */
/** 旋转后的件在某个边上的门格（全局坐标）。 */
function doorSpot(
  def: StructureDef,
  side: Side,
  originX: number,
  originY: number,
): { x: number; y: number } | null {
  for (const anchor of def.anchors) {
    if (anchor.facing !== side) continue;
    return { x: originX + anchor.x, y: originY + anchor.y };
  }
  return null;
}

function carveRoom(
  terrain: number[],
  width: number,
  metaW: number,
  room: LayoutRoom,
  ports: ReadonlyMap<number, ReadonlySet<Side>>,
  floor: number,
  wall: number,
): void {
  const startX = room.x * 7;
  const startY = room.y * 7;
  const endX = (room.x + room.w) * 7;
  const endY = (room.y + room.h) * 7;

  // 房间内部：地板
  for (let y = startY + 1; y < endY - 1; y += 1) {
    for (let x = startX + 1; x < endX - 1; x += 1) {
      terrain[y * width + x] = floor;
    }
  }

  // 外墙
  for (let x = startX; x < endX; x += 1) {
    terrain[startY * width + x] = wall;
    terrain[(endY - 1) * width + x] = wall;
  }
  for (let y = startY; y < endY; y += 1) {
    terrain[y * width + startX] = wall;
    terrain[y * width + endX - 1] = wall;
  }

  // 门：每个 meta 格的边中点
  for (let dy = 0; dy < room.h; dy += 1) {
    for (let dx = 0; dx < room.w; dx += 1) {
      const cellX = room.x + dx;
      const cellY = room.y + dy;
      const sides = ports.get(cellY * metaW + cellX);
      if (sides === undefined) continue;

      const baseX = cellX * 7;
      const baseY = cellY * 7;

      if (sides.has("north")) openDoor(terrain, width, baseX + 3, baseY, floor);
      if (sides.has("south")) openDoor(terrain, width, baseX + 3, baseY + 6, floor);
      if (sides.has("west")) openDoor(terrain, width, baseX, baseY + 3, floor);
      if (sides.has("east")) openDoor(terrain, width, baseX + 6, baseY + 3, floor);
    }
  }
}

function openDoor(terrain: number[], width: number, x: number, y: number, floor: number): void {
  terrain[y * width + x] = floor;
}

/** 走廊兜底：十字 + 只开需要的边。 */
function carveCorridorCell(
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
    const tx = originX + x;
    const ty = originY + y;
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return;
    terrain[ty * width + tx] = id;
  };

  for (let y = 0; y < 7; y += 1) for (let x = 0; x < 7; x += 1) put(x, y, wall);
  for (let i = 0; i < 7; i += 1) {
    put(i, 3, floor);
    put(3, i, floor);
  }
  if (!required.has("north")) put(3, 0, wall);
  if (!required.has("south")) put(3, 6, wall);
  if (!required.has("west")) put(0, 3, wall);
  if (!required.has("east")) put(6, 3, wall);
}

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
