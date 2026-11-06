// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 散落地牢：房间自由摆放 + 房间图 + 绕路 + 走廊加宽。
 *
 *   1  房间不贴网格：随机中心、随机旋转，互相不重叠
 *   2  房间图：Delaunay 太脆，先用「Gabriel 图」近似（没有第三个房间
 *      落在两点为直径的圆里就连一条边）——天然带环、不偏向最近邻
 *   3  连边：最近门对；但路本身用「带噪声代价的 A*」走，会自然绕
 *   4  走廊：沿路径随机加宽 1 格，再补一层简单的元胞平滑
 *
 * 和 rooms/layout 的区别：那两个贴网格，这个完全不贴。
 */

import { makeRandom } from "./random.ts";
import { rotateStructure } from "./tiles.ts";
import { stampStructure, type SpawnRequest, type StructureDef } from "./structures.ts";

export interface SprawlSpec {
  /** 候选房间件（role = room，尺寸随意）。 */
  readonly rooms: readonly string[];
  /** 目标房间数（默认 10）。 */
  readonly count?: number;
  /** 摆放尝试次数上限（默认 200）。 */
  readonly tries?: number;
  /** 房间之间至少留几格（默认 1）。 */
  readonly margin?: number;
  /** 走廊地板地形代号（默认 "floor"）。 */
  readonly corridor?: string;
  /** 走廊加宽概率（0..1，默认 0.35）。 */
  readonly widen?: number;
}

export interface SprawlRoom {
  readonly structure: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly doors: ReadonlyArray<{ readonly x: number; readonly y: number; readonly facing: string }>;
}

export function placeSprawl(
  terrain: number[],
  width: number,
  height: number,
  defs: ReadonlyMap<string, StructureDef>,
  spec: SprawlSpec,
  seed: number,
  terrainIdByCode: ReadonlyMap<string, number>,
): { rooms: SprawlRoom[]; spawns: SpawnRequest[]; warnings: string[]; edges: number } {
  const wall = terrainIdByCode.get("wall");
  const floor = terrainIdByCode.get("floor");
  const corridorId = terrainIdByCode.get(spec.corridor ?? "floor");
  if (wall === undefined || floor === undefined || corridorId === undefined) {
    throw new Error("sprawl 需要地形：wall / floor");
  }

  const rand = makeRandom(seed >>> 0);
  const candidates = spec.rooms.map((id) => {
    const def = defs.get(id);
    if (def === undefined) throw new Error(`sprawl 引用了不存在的结构："${id}"`);
    if (def.role !== "room") throw new Error(`结构 "${id}" 的 role 不是 room`);
    return def;
  });
  if (candidates.length === 0) throw new Error("sprawl 至少需要一个房间件");

  terrain.fill(wall);

  const margin = Math.max(0, Math.floor(spec.margin ?? 1));
  const count = Math.max(1, Math.floor(spec.count ?? 10));
  const tries = Math.max(count * 30, Math.floor(spec.tries ?? 200));

  const rooms: SprawlRoom[] = [];
  const spawns: SpawnRequest[] = [];
  const warnings: string[] = [];
  const occupied = new Set<number>();
  const roomMask = new Set<number>();

  for (let attempt = 0; attempt < tries && rooms.length < count; attempt += 1) {
    const base = candidates[Math.floor(rand() * candidates.length)];
    const turns = Math.floor(rand() * 4);
    let def = base;
    for (let i = 0; i < turns; i += 1) def = rotateStructure(def);

    if (def.width + 2 > width || def.height + 2 > height) continue;

    const x = 2 + Math.floor(rand() * (width - def.width - 3));
    const y = 2 + Math.floor(rand() * (height - def.height - 3));

    // 重叠检测（含 1 格边距）
    let free = true;
    for (let dy = -margin; dy < def.height + margin && free; dy += 1) {
      for (let dx = -margin; dx < def.width + margin && free; dx += 1) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        if (occupied.has(py * width + px)) free = false;
      }
    }
    if (!free) continue;

    spawns.push(...stampStructure(terrain, width, height, def, x, y, terrainIdByCode, warnings));

    const doors = def.anchors.map((anchor) => ({
      x: x + anchor.x,
      y: y + anchor.y,
      facing: anchor.facing,
    }));
    if (doors.length === 0) {
      doors.push({ x: x + Math.floor(def.width / 2), y: y + def.height - 1, facing: "south" });
      warnings.push(`${def.id}：没有门，临时在底部开一个`);
    }

    rooms.push({ structure: def.id, x, y, w: def.width, h: def.height, doors });

    for (let dy = 0; dy < def.height; dy += 1) {
      for (let dx = 0; dx < def.width; dx += 1) {
        occupied.add((y + dy) * width + (x + dx));
        roomMask.add((y + dy) * width + (x + dx));
      }
    }
  }

  if (rooms.length < 2) {
    warnings.push("房间太少，连不成图");
    return { rooms, spawns, warnings, edges: 0 };
  }

  // ── 房间图：Gabriel 图 ────────────────────────────────────
  const edges: Array<{ a: number; b: number }> = [];
  for (let a = 0; a < rooms.length; a += 1) {
    for (let b = a + 1; b < rooms.length; b += 1) {
      if (gabriel(rooms, a, b)) edges.push({ a, b });
    }
  }

  // 保证连通：按中心距离补生成树边
  const connected = new Set<number>([0]);
  const pending = new Set<number>(rooms.map((_, index) => index).filter((index) => index !== 0));
  while (pending.size > 0) {
    let best: { a: number; b: number; d: number } | null = null;
    for (const a of connected) {
      for (const b of pending) {
        const d = centerDistance(rooms[a], rooms[b]);
        if (best === null || d < best.d) best = { a, b, d };
      }
    }
    if (best === null) break;
    if (!edges.some((edge) => (edge.a === best!.a && edge.b === best!.b) || (edge.a === best!.b && edge.b === best!.a))) {
      edges.push({ a: best.a, b: best.b });
    }
    connected.add(best.b);
    pending.delete(best.b);
  }

  // ── 修路 ─────────────────────────────────────────────────
  for (const edge of edges) {
    const from = nearestDoor(rooms[edge.a], rooms[edge.b]);
    const to = nearestDoor(rooms[edge.b], rooms[edge.a]);
    if (from === null || to === null) continue;

    const start = stepOut(from);
    const goal = stepOut(to);
    if (start === null || goal === null) continue;

    const path = route(start, goal, roomMask, width, height, from, to, seed + edge.a * 7919 + edge.b);
    if (path === null) {
      warnings.push(`修不通：${edge.a} → ${edge.b}`);
      continue;
    }

    for (const cell of path) {
      if (roomMask.has(cell.y * width + cell.x)) continue;
      terrain[cell.y * width + cell.x] = corridorId;
    }
    terrain[from.y * width + from.x] = corridorId;
    terrain[to.y * width + to.x] = corridorId;
  }

  // ── 加宽 + 平滑 ──────────────────────────────────────────
  widen(terrain, width, height, roomMask, corridorId, rand, spec.widen ?? 0.35);

  return { rooms, spawns, warnings, edges: edges.length };
}

function centerDistance(a: SprawlRoom, b: SprawlRoom): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Gabriel 图判定：没有第三个房间落在两点为直径的圆里。 */
function gabriel(rooms: readonly SprawlRoom[], a: number, b: number): boolean {
  const ax = rooms[a].x + rooms[a].w / 2;
  const ay = rooms[a].y + rooms[a].h / 2;
  const bx = rooms[b].x + rooms[b].w / 2;
  const by = rooms[b].y + rooms[b].h / 2;
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2;
  const radius = Math.hypot(ax - bx, ay - by) / 2;

  for (let index = 0; index < rooms.length; index += 1) {
    if (index === a || index === b) continue;
    const px = rooms[index].x + rooms[index].w / 2;
    const py = rooms[index].y + rooms[index].h / 2;
    if (Math.hypot(px - cx, py - cy) < radius - 0.01) return false;
  }
  return true;
}

function nearestDoor(from: SprawlRoom, to: SprawlRoom): SprawlRoom["doors"][number] | null {
  if (from.doors.length === 0) return null;
  const targetX = to.x + to.w / 2;
  const targetY = to.y + to.h / 2;

  let best = from.doors[0];
  let bestD = Number.POSITIVE_INFINITY;
  for (const door of from.doors) {
    const d = Math.abs(door.x - targetX) + Math.abs(door.y - targetY);
    if (d < bestD) {
      bestD = d;
      best = door;
    }
  }
  return best;
}

function stepOut(door: { x: number; y: number; facing: string }): { x: number; y: number } | null {
  switch (door.facing) {
    case "north":
      return { x: door.x, y: door.y - 1 };
    case "south":
      return { x: door.x, y: door.y + 1 };
    case "east":
      return { x: door.x + 1, y: door.y };
    case "west":
      return { x: door.x - 1, y: door.y };
    default:
      return null;
  }
}

/** 带噪声代价的 A*：会绕、但不会太离谱。 */
function route(
  start: { x: number; y: number },
  goal: { x: number; y: number },
  blockedMask: ReadonlySet<number>,
  width: number,
  height: number,
  doorA: { x: number; y: number },
  doorB: { x: number; y: number },
  seed: number,
): Array<{ x: number; y: number }> | null {
  const key = (x: number, y: number): number => y * width + x;
  const isDoor = (x: number, y: number): boolean =>
    (doorA.x === x && doorA.y === y) || (doorB.x === x && doorB.y === y);

  const walkable = (x: number, y: number): boolean => {
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return false;
    if (!blockedMask.has(key(x, y))) return true;
    return isDoor(x, y);
  };

  if (!walkable(start.x, start.y) || !walkable(goal.x, goal.y)) return null;

  const noise = (x: number, y: number): number => {
    let h = seed ^ (x * 374761393) ^ (y * 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  const open: Array<{ x: number; y: number }> = [start];
  const from = new Map<number, number | null>([[key(start.x, start.y), null]]);
  const cost = new Map<number, number>([[key(start.x, start.y), 0]]);
  const goalKey = key(goal.x, goal.y);

  while (open.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const [index, cell] of open.entries()) {
      const score = (cost.get(key(cell.x, cell.y)) ?? 0) + Math.abs(cell.x - goal.x) + Math.abs(cell.y - goal.y);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const current = open.splice(bestIndex, 1)[0];
    const currentKey = key(current.x, current.y);
    if (currentKey === goalKey) {
      const path: Array<{ x: number; y: number }> = [];
      let cursor: number | null = currentKey;
      while (cursor !== null) {
        path.push({ x: cursor % width, y: Math.floor(cursor / width) });
        cursor = from.get(cursor) ?? null;
      }
      return path.reverse();
    }

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!walkable(nx, ny)) continue;

      const nextKey = key(nx, ny);
      const stepCost = 1 + noise(nx, ny) * 2;
      const nextCost = (cost.get(currentKey) ?? 0) + stepCost;
      if (nextCost >= (cost.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;

      cost.set(nextKey, nextCost);
      from.set(nextKey, currentKey);
      if (!open.some((cell) => cell.x === nx && cell.y === ny)) open.push({ x: nx, y: ny });
    }
  }

  return null;
}

/** 沿走廊随机加宽，再做一轮「邻居多就变地板」的平滑。 */
function widen(
  terrain: number[],
  width: number,
  height: number,
  roomMask: ReadonlySet<number>,
  floor: number,
  rand: () => number,
  chance: number,
): void {
  const additions: Array<{ x: number; y: number }> = [];

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      if (terrain[y * width + x] !== floor) continue;
      if (roomMask.has(y * width + x)) continue;
      if (rand() > chance) continue;

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (roomMask.has(ny * width + nx)) continue;
        if (terrain[ny * width + nx] === floor) continue;
        additions.push({ x: nx, y: ny });
      }
    }
  }

  for (const cell of additions) terrain[cell.y * width + cell.x] = floor;
}
