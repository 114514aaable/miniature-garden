// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 情报：关于一个实体或一个格子，我们「知道什么」。
 *
 * 这里只有事实，没有像素、没有坐标、没有颜色。
 * 两种呈现消费它：
 *   overlay.ts  常驻：预警格、脚底血条、蓄力条（世界坐标）
 *   probe.ts    按需：悬停信息槽（屏幕坐标）
 *
 * 统一在这里的好处：**文字和图形说的永远是同一件事**。
 */

import { type JsonValue } from "../../engine/core/src/time.ts";

export interface HealthFacts {
  readonly cur: number;
  readonly max: number;
  /** 0..1，满血为 1。 */
  readonly ratio: number;
  readonly hurt: boolean;
  readonly critical: boolean;
}

export interface IntentFacts {
  /** 打哪几格（相对实体的偏移）。 */
  readonly tiles: ReadonlyArray<{ readonly dx: number; readonly dy: number }>;
  readonly damage: number;
  /** 还要几回合结算。 */
  readonly inTicks: number;
  /** 总回合数（用于画「进度感」）。 */
  readonly totalTicks: number;
}

export interface PendingFacts {
  readonly done: number;
  readonly total: number;
  readonly ratio: number;
}

export interface EntityFacts {
  readonly handle: number;
  readonly template: string;
  readonly name: string;
  readonly description: string;
  readonly health?: HealthFacts;
  readonly intent?: IntentFacts;
  readonly pending?: PendingFacts;
}

export interface TerrainFacts {
  readonly id: number;
  readonly name: string;
}

export interface CellFacts {
  readonly x: number;
  readonly y: number;
  readonly terrain: TerrainFacts;
  readonly entities: readonly EntityFacts[];
}

/** 一个实体的原始资料：快照实体 + 语言包查名。 */
export interface EntityInput {
  readonly handle: number;
  readonly template: string;
  readonly components: Readonly<Record<string, JsonValue>>;
}

function asRecord(value: JsonValue | undefined): Record<string, JsonValue> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, JsonValue>;
}

function asNumber(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** 血量事实：只有真受伤才算「hurt」。 */
export function healthFacts(raw: JsonValue | undefined): HealthFacts | undefined {
  const value = asRecord(raw);
  if (value === null) return undefined;

  const hp = asNumber(value.hp) ?? asNumber(value.max) ?? 0;
  const max = asNumber(value.max) ?? hp;
  if (max <= 0) return undefined;

  const ratio = Math.min(1, Math.max(0, hp / max));
  return { cur: hp, max, ratio, hurt: hp < max, critical: ratio <= 1 / 3 };
}

/**
 * 意图事实。
 *
 * 剩余回合由调用方给（`now`），因为 facts 不读时钟。
 */
export function intentFacts(raw: JsonValue | undefined, now: number): IntentFacts | undefined {
  const value = asRecord(raw);
  if (value === null) return undefined;

  const resolveAt = asNumber(value.resolveAt) ?? 0;
  if (resolveAt <= now) return undefined;

  const tiles = Array.isArray(value.tiles)
    ? value.tiles
        .map((tile) => asRecord(tile))
        .filter((tile): tile is Record<string, JsonValue> => tile !== null)
        .map((tile) => ({ dx: asNumber(tile.dx) ?? 0, dy: asNumber(tile.dy) ?? 0 }))
    : [];

  if (tiles.length === 0) return undefined;

  return {
    tiles,
    damage: asNumber(value.damage) ?? 0,
    inTicks: resolveAt - now,
    totalTicks: asNumber(value.totalTicks) ?? Math.max(1, resolveAt - now),
  };
}

/** 蓄力事实：core.pending 的进度。 */
export function pendingFacts(raw: JsonValue | undefined, now: number): PendingFacts | undefined {
  const value = asRecord(raw);
  if (value === null) return undefined;

  const resolveAt = asNumber(value.resolveAt) ?? 0;
  const startedAt = asNumber(value.startedAt) ?? 0;
  if (resolveAt <= now) return undefined;

  const total = Math.max(1, resolveAt - startedAt);
  const done = Math.min(total, Math.max(0, now - startedAt));
  return { done, total, ratio: done / total };
}

export interface FactsContext {
  readonly now: number;
  readonly label: (kind: "template" | "terrain", id: string | number) => string;
  readonly describe: (template: string) => string;
}

/** 从快照实体抽事实。 */
export function entityFacts(input: EntityInput, context: FactsContext): EntityFacts {
  const components = input.components;

  return {
    handle: input.handle,
    template: input.template,
    name: context.label("template", input.template),
    description: context.describe(input.template),
    health: healthFacts(components["core.health"]),
    intent: intentFacts(components["core.intent"], context.now),
    pending: pendingFacts(components["core.pending"], context.now),
  };
}
