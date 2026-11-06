// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 房间布局：BSP 分区 → 每个矩形里放一个 room 结构 → 走廊连起来。
 *
 * 「房间」不是数据结构，是一种结构（structure 的 role = "room"）；
 * 这里只负责**摆放与连接**，房间长什么样由数据决定。
 *
 * 连接规则：
 *   两个房间都有门 → 门对门（L 形走廊）
 *   否则           → 中心对中心
 */

import { makeRandom, randomInt } from "./random.ts";
import { stampStructure, type StructureDef } from "./structures.ts";

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
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
}

export interface RoomPlacement {
  readonly structure: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rect: Rect;
  readonly doors: ReadonlyArray<{ readonly x: number; readonly y: number; readonly facing: string }>;
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
      const cut = randomInt(rand, minW, rect.w - minW - 1);
      split({ x: rect.x, y: rect.y, w: cut, h: rect.h }, depth - 1);
      split({ x: rect.x + cut + 1, y: rect.y, w: rect.w - cut - 1, h: rect.h }, depth - 1);
    } else {
      const cut = randomInt(rand, minH, rect.h - minH - 1);
      split({ x: rect.x, y: rect.y, w: rect.w, h: cut }, depth - 1);
      split({ x: rect.x, y: rect.y + cut + 1, w: rect.w, h: rect.h - cut - 1 }, depth - 1);
    }
  };

  if (root.w >= minW && root.h >= minH) split(root, 6);
  else if (root.w > 2 && root.h > 2) leaves.push(root);

  return leaves;
}

/**
 * 在矩形里放房间、挖走廊。
 *
 * 返回每个房间的位置与门——后续 fill / 传送可以直接用。
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
): RoomPlacement[] {
  void codeOfTerrain;

  const inset = Math.max(1, Math.floor(spec.inset ?? 1));
  const margin = Math.max(0, Math.floor(spec.margin ?? 0));
  const minSize = spec.minSize ?? [6, 5];
  const corridorCode = spec.corridor ?? "floor";
  const corridorId = terrainIdByCode.get(corridorCode);
  if (corridorId === undefined) throw new Error(`走廊地形不在包里："${corridorCode}"`);

  const rooms = spec.structures.map((id) => {
    const def = defs.get(id);
    if (def === undefined) throw new Error(`rooms 引用了不存在的结构："${id}"`);
    if (def.role !== "room") throw new Error(`结构 "${id}" 的 role 不是 room`);
    return def;
  });
  if (rooms.length === 0) throw new Error("rooms 至少需要一个房间结构");

  const rects = partition(width, height, minSize, seed, inset);
  const limit = Math.max(0, Math.floor(spec.count ?? rects.length));
  const placements: RoomPlacement[] = [];

  for (const rect of rects) {
    if (placements.length >= limit) break;

    // 挑一个放得下的房间：优先大的（面积接近），同样大按 id 稳定排序
    const fitting = rooms
      .filter((def) => def.width + margin * 2 <= rect.w && def.height + margin * 2 <= rect.h)
      .sort((a, b) => b.width * b.height - a.width * a.height || a.id.localeCompare(b.id));

    if (fitting.length === 0) continue;

    const def = fitting[0];
    const x = rect.x + Math.floor((rect.w - def.width) / 2);
    const y = rect.y + Math.floor((rect.h - def.height) / 2);

    stampStructure(terrain, width, height, def, x, y, terrainIdByCode);

    const doors = def.anchors.map((anchor) => ({
      x: x + anchor.x,
      y: y + anchor.y,
      facing: anchor.facing,
    }));

    placements.push({ structure: def.id, x, y, w: def.width, h: def.height, rect, doors });
  }

  // 连走廊：按中心距离做最小生成树（Prim），避免绕路
  const connected = new Set<number>([0]);
  const pending = new Set<number>(placements.map((_, index) => index).filter((index) => index !== 0));

  while (pending.size > 0 && placements.length > 0) {
    let bestA = -1;
    let bestB = -1;
    let bestD = Number.POSITIVE_INFINITY;

    for (const a of connected) {
      for (const b of pending) {
        const d = Math.abs(centerOf(placements[a]).x - centerOf(placements[b]).x) +
          Math.abs(centerOf(placements[a]).y - centerOf(placements[b]).y);
        if (d < bestD) {
          bestD = d;
          bestA = a;
          bestB = b;
        }
      }
    }

    if (bestA < 0 || bestB < 0) break;

    const from = pickExit(placements[bestA], placements[bestB], spec.connect ?? "anchors");
    const to = pickExit(placements[bestB], placements[bestA], spec.connect ?? "anchors");
    carveCorridor(terrain, width, height, from, to, corridorId);

    connected.add(bestB);
    pending.delete(bestB);
  }

  return placements;
}

function centerOf(room: RoomPlacement): { x: number; y: number } {
  return { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
}

/** 出发格：优先门，没有就中心。 */
function pickExit(room: RoomPlacement, toward: RoomPlacement, mode: "anchors" | "centers"): { x: number; y: number } {
  if (mode === "anchors" && room.doors.length > 0) {
    const target = centerOf(toward);
    let best = room.doors[0];
    let bestD = Number.POSITIVE_INFINITY;
    for (const door of room.doors) {
      const d = Math.abs(door.x - target.x) + Math.abs(door.y - target.y);
      if (d < bestD) {
        bestD = d;
        best = door;
      }
    }
    return { x: best.x, y: best.y };
  }
  return centerOf(room);
}

/** L 形走廊：先横后竖（或反过来，随机由距离决定）。 */
function carveCorridor(
  terrain: number[],
  width: number,
  height: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  floor: number,
): void {
  const put = (x: number, y: number): void => {
    if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) return;
    terrain[y * width + x] = floor;
  };

  const midX = to.x;
  for (let x = Math.min(from.x, midX); x <= Math.max(from.x, midX); x += 1) put(x, from.y);
  for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y += 1) put(midX, y);
}
