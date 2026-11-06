// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 实体投放：按「房间 / 走廊 / 死胡同」的规则往实体图里放东西。
 *
 *   room      落在带指定标签的房间里
 *   corridor  落在房间之外的地板上
 *   deadend   四周只有一个出口的地板（放宝箱/神龛最合适）
 *   floor     任意地板
 *
 * 规则：
 *   - 不压墙（只选地板）
 *   - avoid: start 会在出生点周围留一圈空地
 *   - once：同一间房最多放一个
 *   - 不限制一格几个（先不控制，靠规则自己错开）
 */

import type { Sandbox, SpaceRoom } from "./pipeline.ts";
import { makeRandom } from "./random.ts";

export interface PopulateRule {
  readonly where: "room" | "corridor" | "deadend" | "floor";
  /** room 规则用：房间必须带这些标签。 */
  readonly tags?: readonly string[];
  /** 模板 → 权重（抽一个）。 */
  readonly templates: Readonly<Record<string, number>>;
  /** 每个候选格命中的概率（0..1，默认 0.2）。 */
  readonly density?: number;
  /** 同一间房最多一个（room 规则用）。 */
  readonly once?: boolean;
  /** 规避：出生点周围。 */
  readonly avoid?: readonly "start"[];
  /** 出生点周围留空几格（默认 3）。 */
  readonly startClear?: number;
}

export interface PopulateSpec {
  readonly rules: readonly PopulateRule[];
}

export function populate(
  sandbox: Sandbox,
  spec: PopulateSpec,
  seed: number,
  floorId: number,
): { placed: number; warnings: string[] } {
  const width = sandbox.width;
  const height = sandbox.height;
  const rand = makeRandom(seed >>> 0);
  const warnings: string[] = [];
  let placed = 0;

  const isFloor = (x: number, y: number): boolean => sandbox.terrain[y * width + x] === floorId;

  const roomAt = new Map<number, SpaceRoom>();
  for (const room of sandbox.regions.rooms) {
    for (let y = 0; y < room.h; y += 1) {
      for (let x = 0; x < room.w; x += 1) roomAt.set((room.y + y) * width + room.x + x, room);
    }
  }

  const isDeadEnd = (x: number, y: number): boolean => {
    let exits = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (isFloor(x + dx, y + dy)) exits += 1;
    }
    return exits === 1;
  };

  spec.rules.forEach((rule, ruleIndex) => {
    const density = Math.min(1, Math.max(0, rule.density ?? 0.2));
    const startClear = Math.max(0, Math.floor(rule.startClear ?? 3));
    const usedRooms = new Set<SpaceRoom>();

    const templates = Object.entries(rule.templates).filter(([, weight]) => weight > 0);
    if (templates.length === 0) {
      warnings.push(`populate 规则 ${ruleIndex}：没有可用的模板`);
      return;
    }

    const totalWeight = templates.reduce((sum, [, weight]) => sum + weight, 0);

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        if (!isFloor(x, y)) continue;

        const room = roomAt.get(y * width + x) ?? null;

        if (rule.where === "room") {
          if (room === null) continue;
          if (rule.tags !== undefined && !rule.tags.every((tag) => room.tags.includes(tag))) continue;
        } else if (rule.where === "corridor") {
          if (room !== null) continue;
        } else if (rule.where === "deadend") {
          if (!isDeadEnd(x, y)) continue;
        }

        if (rule.once === true && room !== null && usedRooms.has(room)) continue;

        // 出生点周围留空
        if (sandbox.start !== null) {
          const distance = Math.abs(x - sandbox.start.x) + Math.abs(y - sandbox.start.y);
          if (distance <= startClear) continue;
        }

        if (rand() > density) continue;

        let roll = rand() * totalWeight;
        let template = templates[0][0];
        for (const [id, weight] of templates) {
          roll -= weight;
          if (roll <= 0) {
            template = id;
            break;
          }
        }

        const key = y * width + x;
        const list = sandbox.entities.get(key) ?? [];
        list.push({ template, tags: rule.tags ?? [], source: `populate:${ruleIndex}` });
        sandbox.entities.set(key, list);

        if (room !== null) usedRooms.add(room);
        placed += 1;
      }
    }
  });

  return { placed, warnings };
}
