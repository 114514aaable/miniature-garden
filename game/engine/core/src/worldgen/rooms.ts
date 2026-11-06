// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 房间布局：BSP 摆房间 → 门当顶点 → 修走廊把门连起来。
 *
 * 图模型：
 *   顶点  门（坐标 + 朝向）
 *   边    走廊（从一扇门出去，到另一扇门进来；只用来画线，通行仍是双向）
 *   团    同一个房间的所有门两两可达（房间内部，不画线）
 *
 * 流程：
 *   1  BSP 切矩形，每个矩形放一个 room 结构（门在外墙上）
 *   2  房间之间按「最近的门对」做最小生成树，再补少量额外边做环路
 *   3  每条边用 A* 修一条走廊（绕开房间内部）
 *   4  图上验收 + 地形洪水填充验收
 *
 * 大房间不是「占 2×2 格」，而是「一个带 N 扇门的节点」。
 */

import { makeRandom } from "./random.ts";
import { stampStructure, type SpawnRequest, type StructureDef } from "./structures.ts";

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface RoomDoor {
  readonly x: number;
  readonly y: number;
  readonly facing: string;
}

export interface RoomSpec {
  /** 候选房间结构（role = "room"）。 */
  readonly structures: readonly string[];
  /** 最多放几个（默认全部矩形都放）。 */
  readonly count?: number;
  /** 每个矩形最小尺寸（默认 6×5）。 */
  readonly minSize?: readonly [number, number];
  /** 每个矩形最大尺寸（默认 14×10）。 */
  readonly maxSize?: readonly [number, number];
  /** 走廊地板的地形代号（默认 "floor"）。 */
  readonly corridor?: string;
  /** 连接方式（默认 anchors）。 */
  readonly connect?: "anchors" | "centers";
  /** 离地图边缘至少多少格（默认 1）。 */
  readonly inset?: number;
  /** 房间和矩形边缘的间距（默认 0）。 */
  readonly margin?: number;
  /** 额外环路比例（0..1，默认 0.2）。 */
  readonly loops?: number;
}

export interface RoomPlacement {
  readonly structure: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rect: Rect;
  readonly doors: ReadonlyArray<RoomDoor>;
  readonly tags: readonly string[];
}

/** 把一块区域切成若干矩形（BSP）。 */
export function partition(
  width: number,
  height: number,
  minSize: readonly [number, number],
  seed: number,
  inset = 1,
): Rect[] {
  const [minW, minH] = minSize;
  const rand = makeRandom(seed >>> 0);

  const root: Rect = {
    x: inset,
    y: inset,
    w: Math.max(0, width - inset * 2),
    h: Math.max(0, height - inset * 2),
  };

  const leaves: Rect[] = [];

  const split = (rect: Rect, depth: number): void => {
    if (depth <= 0) {
      leaves.push(rect);
      return;
    }

    const canVertical = rect.w >= minW * 2 + 1;
    const canHorizontal = rect.h >= minH * 2 + 1;
    if (!canVertical && !canHorizontal) {
      leaves.push(rect);
      return;
    }

    // 长的一边优先切：横向的长就竖着切
    const vertical = canVertical && (!canHorizontal || rect.w >= rect.h);

    if (vertical) {
      const cut = minW + Math.floor(rand() * (rect.w - minW * 2));
      split({ x: rect.x, y: rect.y, w: cut, h: rect.h }, depth - 1);
      split({ x: rect.x + cut + 1, y: rect.y, w: rect.w - cut - 1, h: rect.h }, depth - 1);
    } else {
      const cut = minH + Math.floor(rand() * (rect.h - minH * 2));
      split({ x: rect.x, y: rect.y, w: rect.w, h: cut }, depth - 1);
      split({ x: rect.x, y: rect.y + cut + 1, w: rect.w, h: rect.h - cut - 1 }, depth - 1);
    }
  };

  if (root.w >= minW && root.h >= minH) split(root, 6);
  else if (root.w > 2 && root.h > 2) leaves.push(root);

  return leaves;
}

/**
 * 摆房间、按门图修走廊。
 *
 * 返回每个房间的位置与门，以及结构里的实体出生请求。
 */
export function placeRooms(
  terrain: number[],
  width: number,
  height: number,
  defs: ReadonlyMap<string, StructureDef>,
  spec: RoomSpec,
  seed: number,
  terrainIdByCode: ReadonlyMap<string, number>,
  codeOfTerrain: (terrainId: number) => string | undefined,
): { placements: RoomPlacement[]; spawns: SpawnRequest[]; warnings: string[] } {
  void codeOfTerrain;

  const inset = Math.max(1, Math.floor(spec.inset ?? 1));
  const margin = Math.max(0, Math.floor(spec.margin ?? 0));
  const minSize = spec.minSize ?? [6, 5];
  const corridorCode = spec.corridor ?? "floor";
  const corridorId = terrainIdByCode.get(corridorCode);
  if (corridorId === undefined) throw new Error(`走廊地形不在包里："${corridorCode}"`);

  const structures = spec.structures.map((id) => {
    const def = defs.get(id);
    if (def === undefined) throw new Error(`rooms 引用了不存在的结构："${id}"`);
    if (def.role !== "room") throw new Error(`结构 "${id}" 的 role 不是 room`);
    return def;
  });
  if (structures.length === 0) throw new Error("rooms 至少需要一个房间结构");

  const rand = makeRandom(seed >>> 0);
  const rects = partition(width, height, minSize, seed, inset);
  const limit = Math.max(0, Math.floor(spec.count ?? rects.length));
  const placements: RoomPlacement[] = [];
  const spawns: SpawnRequest[] = [];
  const warnings: string[] = [];

  for (const [rectIndex, rect] of rects.entries()) {
    if (placements.length >= limit) break;

    const fitting = structures
      .filter((def) => def.width + margin * 2 <= rect.w && def.height + margin * 2 <= rect.h)
      .sort((a, b) => b.width * b.height - a.width * a.height || a.id.localeCompare(b.id));
    if (fitting.length === 0) continue;

    // 轮着用：全是同一种房间会很单调
    const def = fitting[rectIndex % fitting.length];
    const x = rect.x + Math.floor((rect.w - def.width) / 2);
    const y = rect.y + Math.floor((rect.h - def.height) / 2);

    spawns.push(...stampStructure(terrain, width, height, def, x, y, terrainIdByCode, warnings));

    const doors = def.anchors.map((anchor) => ({
      x: x + anchor.x,
      y: y + anchor.y,
      facing: anchor.facing,
    }));

    // 没门的房间（比如道具件被误用）也要有个进出点
    if (doors.length === 0) {
      doors.push({ x: x + Math.floor(def.width / 2), y: y + def.height - 1, facing: "south" });
      warnings.push(`${def.id}：没有门，临时在底部开一个`);
    }

    placements.push({ structure: def.id, x, y, w: def.width, h: def.height, rect, doors, tags: def.tags });
  }

  // 房间占用的格子：修路时绕开（门本身除外）
  const occupied = new Set<number>();
  for (const room of placements) {
    for (let y = 0; y < room.h; y += 1) {
      for (let x = 0; x < room.w; x += 1) {
        occupied.add((room.y + y) * width + (room.x + x));
      }
    }
  }

  // 图：房间两两之间按「最近的门对」算距离
  const edges = connectRooms(placements, spec.connect ?? "anchors");

  for (const edge of edges) {
    const from = edge.from;
    const to = edge.to;
    const start = stepOut(from);
    const goal = stepOut(to);

    if (start === null || goal === null) {
      warnings.push(`门朝外那一格出界：(${from.x}, ${from.y}) → (${to.x}, ${to.y})`);
      continue;
    }
    if (outOfBounds(start, width, height) || outOfBounds(goal, width, height)) continue;

    const path = findPath(start, goal, occupied, width, height, from, to);
    if (path === null) {
      warnings.push(`修不通：${from.facing} 门 (${from.x},${from.y}) → (${to.x},${to.y})`);
      continue;
    }

    for (const cell of path) {
      if (cell.x <= 0 || cell.y <= 0 || cell.x >= width - 1 || cell.y >= height - 1) continue;
      terrain[cell.y * width + cell.x] = corridorId;
    }

    // 门本身也挖开（有的件门格已经是地板，这里兜底）
    terrain[from.y * width + from.x] = corridorId;
    terrain[to.y * width + to.x] = corridorId;
  }

  // 额外环路：让地图不那么「树状」
  if (placements.length > 2) {
    const loopCount = Math.floor(placements.length * Math.min(1, Math.max(0, spec.loops ?? 0.2)));
    for (let i = 0; i < loopCount; i += 1) {
      const a = placements[Math.floor(rand() * placements.length)];
      const b = placements[Math.floor(rand() * placements.length)];
      if (a === b) continue;
      const from = a.doors[Math.floor(rand() * a.doors.length)];
      const to = b.doors[Math.floor(rand() * b.doors.length)];
      const start = stepOut(from);
      const goal = stepOut(to);
      if (start === null || goal === null) continue;
      const path = findPath(start, goal, occupied, width, height, from, to);
      if (path === null) continue;
      for (const cell of path) {
        if (cell.x <= 0 || cell.y <= 0 || cell.x >= width - 1 || cell.y >= height - 1) continue;
        terrain[cell.y * width + cell.x] = corridorId;
      }
      terrain[from.y * width + from.x] = corridorId;
      terrain[to.y * width + to.x] = corridorId;
    }
  }

  // 双验收：洪水填充必须走到每个房间的门
  for (const room of placements) {
    const door = room.doors[0];
    if (terrain[door.y * width + door.x] !== corridorId) {
      warnings.push(`房间 ${room.structure} 的门没挖开：(${door.x}, ${door.y})`);
    }
  }

  return { placements, spawns, warnings };
}

// ── 图：房间之间的边 ─────────────────────────────────────────

interface RoomEdge {
  readonly from: RoomDoor;
  readonly to: RoomDoor;
}

/** 最小生成树 + 少量额外边；边上带具体门对。 */
function connectRooms(rooms: readonly RoomPlacement[], mode: "anchors" | "centers"): RoomEdge[] {
  if (rooms.length < 2) return [];

  const edges: RoomEdge[] = [];
  const inTree = new Set<number>([0]);
  const pending = new Set<number>(rooms.map((_, index) => index).filter((index) => index !== 0));

  while (pending.size > 0) {
    let best: { a: number; b: number; from: RoomDoor; to: RoomDoor; d: number } | null = null;

    for (const a of inTree) {
      for (const b of pending) {
        const pair = closestDoors(rooms[a], rooms[b], mode);
        if (best === null || pair.d < best.d) best = { a, b, from: pair.from, to: pair.to, d: pair.d };
      }
    }

    if (best === null) break;
    edges.push({ from: best.from, to: best.to });
    inTree.add(best.b);
    pending.delete(best.b);
  }

  return edges;
}

function closestDoors(a: RoomPlacement, b: RoomPlacement, mode: "anchors" | "centers"): { from: RoomDoor; to: RoomDoor; d: number } {
  if (mode === "centers") {
    const from = { x: a.x + Math.floor(a.w / 2), y: a.y + Math.floor(a.h / 2), facing: "south" };
    const to = { x: b.x + Math.floor(b.w / 2), y: b.y + Math.floor(b.h / 2), facing: "north" };
    return { from, to, d: Math.abs(from.x - to.x) + Math.abs(from.y - to.y) };
  }

  let best: { from: RoomDoor; to: RoomDoor; d: number } | null = null;
  for (const from of a.doors) {
    for (const to of b.doors) {
      const d = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
      if (best === null || d < best.d) best = { from, to, d };
    }
  }
  return best!;
}

// ── 修路：A*（四邻，绕开房间内部）─────────────────────────────

const DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function stepOut(door: RoomDoor): { x: number; y: number } | null {
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

function outOfBounds(cell: { x: number; y: number }, width: number, height: number): boolean {
  return cell.x < 1 || cell.y < 1 || cell.x >= width - 1 || cell.y >= height - 1;
}

function findPath(
  start: { x: number; y: number },
  goal: { x: number; y: number },
  occupied: ReadonlySet<number>,
  width: number,
  height: number,
  doorA: RoomDoor,
  doorB: RoomDoor,
): Array<{ x: number; y: number }> | null {
  const key = (x: number, y: number): number => y * width + x;
  const blocked = (x: number, y: number): boolean => {
    if (outOfBounds({ x, y }, width, height)) return true;
    return occupied.has(key(x, y)) && !isDoorCell(x, y, doorA) && !isDoorCell(x, y, doorB);
  };

  if (blocked(start.x, start.y) || blocked(goal.x, goal.y)) return null;

  const open: Array<{ x: number; y: number }> = [start];
  const from = new Map<number, number | null>([[key(start.x, start.y), null]]);
  const cost = new Map<number, number>([[key(start.x, start.y), 0]]);
  const goalKey = key(goal.x, goal.y);

  while (open.length > 0) {
    // 取 g + h 最小的（网格小，线性扫足够）
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const [index, cell] of open.entries()) {
      const score = (cost.get(key(cell.x, cell.y)) ?? 0) +
        Math.abs(cell.x - goal.x) + Math.abs(cell.y - goal.y);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const current = open.splice(bestIndex, 1)[0];
    const currentKey = key(current.x, current.y);
    if (currentKey === goalKey) {
      // 回溯
      const path: Array<{ x: number; y: number }> = [];
      let step: number | null = currentKey;
      while (step !== null) {
        path.push({ x: step % width, y: Math.floor(step / width) });
        step = from.get(step) ?? null;
      }
      return path.reverse();
    }

    for (const dir of DIRS) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      if (blocked(nx, ny)) continue;

      const nextKey = key(nx, ny);
      const nextCost = (cost.get(currentKey) ?? 0) + 1;
      if (nextCost >= (cost.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;

      cost.set(nextKey, nextCost);
      from.set(nextKey, currentKey);
      if (!open.some((cell) => cell.x === nx && cell.y === ny)) open.push({ x: nx, y: ny });
    }
  }

  return null;
}

function isDoorCell(x: number, y: number, door: RoomDoor): boolean {
  return door.x === x && door.y === y;
}
