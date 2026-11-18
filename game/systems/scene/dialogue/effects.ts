// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 剧本里的效果：只允许现有六种 Effect，句柄可以用占位符。
 *
 *   "$actor"    玩家/发起者（push scene 的 actor）
 *   "$speaker"  当前对话对象
 *   "$target"   同 $speaker
 *
 * 加载期只校验形状；运行期替换句柄。不要在这里发明新 Effect。
 */

import { type Effect } from "../../../engine/core/src/store.ts";
import { type JsonValue } from "../../../engine/core/src/time.ts";

export type EffectPlaceholder = "$actor" | "$speaker" | "$target";

export interface SceneParams {
  readonly actor?: number;
  readonly speaker?: number;
}

const KINDS = new Set(["terrain", "place", "remove", "spawn", "despawn", "patch"]);

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCell(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.x === "number" &&
    typeof value.y === "number" &&
    Number.isInteger(value.x) &&
    Number.isInteger(value.y)
  );
}

function isHandle(value: unknown): boolean {
  return (
    (typeof value === "number" && Number.isInteger(value) && value >= 0) ||
    value === "$actor" ||
    value === "$speaker" ||
    value === "$target"
  );
}

/** 加载期校验；不合法直接抛，带路径。 */
export function parseScriptEffects(raw: unknown, where: string): readonly JsonValue[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`${where} 应该是效果数组`);

  for (const [index, effect] of raw.entries()) {
    const at = `${where}[${index}]`;
    if (!isRecord(effect)) throw new Error(`${at} 应该是对象`);
    if (typeof effect.kind !== "string" || !KINDS.has(effect.kind)) {
      throw new Error(`${at}.kind 不是合法效果`);
    }

    switch (effect.kind) {
      case "terrain":
        if (typeof effect.space !== "number" || !isCell(effect.cell) || typeof effect.value !== "number") {
          throw new Error(`${at}：terrain 需要 space / cell / value`);
        }
        break;
      case "place":
      case "remove":
        if (typeof effect.space !== "number" || !isCell(effect.cell) || !isHandle(effect.handle)) {
          throw new Error(`${at}：${effect.kind} 需要 space / cell / handle`);
        }
        break;
      case "spawn":
        if (typeof effect.space !== "number" || !isCell(effect.cell) || typeof effect.template !== "string") {
          throw new Error(`${at}：spawn 需要 space / cell / template`);
        }
        break;
      case "despawn":
        if (!isHandle(effect.handle)) throw new Error(`${at}：despawn 需要 handle`);
        break;
      case "patch":
        if (!isHandle(effect.handle) || typeof effect.component !== "string") {
          throw new Error(`${at}：patch 需要 handle / component`);
        }
        break;
    }
  }

  return raw as readonly JsonValue[];
}

function handleOf(value: unknown, params: SceneParams, where: string): number {
  if (typeof value === "number") return value;
  if (value === "$actor") {
    if (params.actor === undefined) throw new Error(`${where}：没有 actor，无法替换 $actor`);
    return params.actor;
  }
  if (value === "$speaker" || value === "$target") {
    if (params.speaker === undefined) throw new Error(`${where}：没有 speaker，无法替换 ${value}`);
    return params.speaker;
  }
  throw new Error(`${where}：未知句柄 ${String(value)}`);
}

/** 运行期替换占位符，返回真正的 Effect。 */
export function resolveScriptEffects(
  effects: readonly JsonValue[] | undefined,
  params: SceneParams,
): Effect[] {
  if (effects === undefined) return [];

  return effects.map((raw, index) => {
    const where = `effect[${index}]`;
    const effect = raw as Record<string, JsonValue>;
    switch (effect.kind) {
      case "terrain":
        return {
          kind: "terrain",
          space: Number(effect.space) as never,
          cell: { x: Number((effect.cell as Record<string, JsonValue>).x), y: Number((effect.cell as Record<string, JsonValue>).y) },
          value: Number(effect.value),
        } as Effect;
      case "place":
      case "remove":
        return {
          kind: effect.kind,
          space: Number(effect.space) as never,
          cell: { x: Number((effect.cell as Record<string, JsonValue>).x), y: Number((effect.cell as Record<string, JsonValue>).y) },
          handle: handleOf(effect.handle, params, `${where}.handle`) as never,
        } as Effect;
      case "spawn":
        return {
          kind: "spawn",
          space: Number(effect.space) as never,
          cell: { x: Number((effect.cell as Record<string, JsonValue>).x), y: Number((effect.cell as Record<string, JsonValue>).y) },
          template: String(effect.template),
          ...(effect.overrides === undefined ? {} : { overrides: effect.overrides }),
        } as Effect;
      case "despawn":
        return {
          kind: "despawn",
          handle: handleOf(effect.handle, params, `${where}.handle`) as never,
        } as Effect;
      case "patch":
        return {
          kind: "patch",
          handle: handleOf(effect.handle, params, `${where}.handle`) as never,
          component: String(effect.component),
          data: effect.data ?? null,
        } as Effect;
      default:
        throw new Error(`${where}：未知效果 ${String(effect.kind)}`);
    }
  });
}
