// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 合并：模板默认值 + 实例覆盖 = 这个实体此刻的完整数据。
 *
 * 三条规则，必须记死（契约里也要写）：
 *   1. 对象 → 深合并（只改提到的键）；
 *   2. 数组 → 整体替换（不做逐项合并，避免「一半旧一半新」）；
 *   3. 原始值 → 替换。
 *
 * 另外：这个函数是纯的，不改入参。否则模板会被实例污染，
 * 一个玩家受伤，全世界同模板的 NPC 一起掉血——这种 bug 三天查不出来。
 */

import { type JsonValue } from "../time.ts";

export function mergeDeep(base: JsonValue, override: JsonValue): JsonValue {
  if (isPlainObject(base) && isPlainObject(override)) {
    const merged: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(base)) {
      // 必须克隆：直接放引用的话，实例改了值会改到模板身上，
      // 于是「一个玩家受伤，全世界同模板的 NPC 一起掉血」。
      merged[key] = structuredClone(value);
    }
    for (const [key, value] of Object.entries(override)) {
      merged[key] = key in merged ? mergeDeep(merged[key], value) : structuredClone(value);
    }
    return merged;
  }

  // 数组和原始值：整体替换。克隆，避免和调用方共享引用。
  return structuredClone(override);
}

/** 把一组覆盖合并到一组默认值上，得到实体此刻的组件表。 */
export function resolveComponents(
  defaults: Readonly<Record<string, JsonValue>>,
  overrides: Readonly<Record<string, JsonValue>>,
): Record<string, JsonValue> {
  return mergeDeep(defaults, overrides) as Record<string, JsonValue>;
}

function isPlainObject(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
