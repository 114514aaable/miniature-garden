// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 情报的「常驻」呈现：画在世界坐标上。
 *
 * 画三样东西，都贴着地面或贴着人：
 *   1. 预警格   敌人起手要打的格子（贴地、越近越亮）
 *   2. 脚底血条  只画受伤的，画在脚下而不是头顶
 *   3. 蓄力条   自己头顶，显示进度
 *
 * 这里不产生任何状态，只读 facts。想加一种常驻信息 = 加一个「有就画」的段。
 */

import { type HealthFacts, type IntentFacts, type PendingFacts } from "./facts.ts";

export interface OverlayEntity {
  readonly x: number;
  readonly y: number;
  readonly health?: HealthFacts;
  readonly intent?: IntentFacts;
  readonly pending?: PendingFacts;
}

export interface OverlayOptions {
  /** 一格多少像素。 */
  readonly tile: number;
  /** 相机左上角所在的格子。 */
  readonly camera: { readonly x: number; readonly y: number };
  readonly entities: readonly OverlayEntity[];
}

/** 预警格的颜色：离结算越近越亮。 */
export function intentAlpha(inTicks: number, totalTicks: number): number {
  const total = Math.max(1, totalTicks);
  const remaining = Math.min(total, Math.max(0, inTicks));
  return 0.15 + 0.25 * (1 - remaining / total);
}

/** 预警格画在哪（世界格坐标）。 */
export function intentCells(entity: OverlayEntity): Array<{ x: number; y: number }> {
  if (entity.intent === undefined) return [];
  return entity.intent.tiles.map((tile) => ({ x: entity.x + tile.dx, y: entity.y + tile.dy }));
}

export function drawOverlay(context: CanvasRenderingContext2D, options: OverlayOptions): void {
  const { tile, camera, entities } = options;

  // 1) 预警格：先画，贴在地面上
  for (const entity of entities) {
    if (entity.intent === undefined) continue;
    const alpha = intentAlpha(entity.intent.inTicks, entity.intent.totalTicks);

    for (const cell of intentCells(entity)) {
      const sx = (cell.x - camera.x) * tile;
      const sy = (cell.y - camera.y) * tile;
      context.fillStyle = `rgba(200,60,45,${alpha.toFixed(3)})`;
      context.fillRect(sx, sy, tile, tile);
      context.strokeStyle = "rgba(230,90,70,0.55)";
      context.lineWidth = 1;
      context.strokeRect(sx + 0.5, sy + 0.5, tile - 1, tile - 1);
    }
  }

  // 2) 脚底血条：只画受伤的
  const bars = new Map<string, number>();
  for (const entity of entities) {
    if (entity.health === undefined || !entity.health.hurt) continue;

    const key = `${entity.x},${entity.y}`;
    const stack = bars.get(key) ?? 0;
    bars.set(key, stack + 1);

    const sx = (entity.x - camera.x) * tile;
    const sy = (entity.y - camera.y) * tile;
    const width = Math.round(tile * 0.7);
    const x = sx + Math.round((tile - width) / 2);
    const y = sy + tile - 6 - stack * 4;

    context.fillStyle = "rgba(10,12,16,0.75)";
    context.fillRect(x, y, width, 3);

    const filled = Math.max(1, Math.round(width * entity.health.ratio));
    context.fillStyle = entity.health.critical ? "#e04a3a" : "#c96a5a";
    context.fillRect(x, y, filled, 3);
  }

  // 3) 蓄力条：贴在头顶
  for (const entity of entities) {
    if (entity.pending === undefined) continue;

    const sx = (entity.x - camera.x) * tile;
    const sy = (entity.y - camera.y) * tile;
    const width = Math.round(tile * 0.7);
    const x = sx + Math.round((tile - width) / 2);
    const y = sy - 6;

    context.fillStyle = "rgba(10,12,16,0.75)";
    context.fillRect(x, y, width, 3);

    context.fillStyle = "#f0c674";
    context.fillRect(x, y, Math.max(1, Math.round(width * entity.pending.ratio)), 3);
  }
}
