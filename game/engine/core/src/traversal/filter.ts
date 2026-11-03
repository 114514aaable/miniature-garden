// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 条件：给定一个实体的组件，判断它算不算目标。
 *
 * **闭集**——只有布尔组合与字段比较，没有算术、没有变量。
 * 一旦允许算术，它就会长成一门语言；需要算术时写规则。
 */

import { type JsonValue } from "../time.ts";

export type Condition =
  | { readonly all: readonly Condition[] }
  | { readonly any: readonly Condition[] }
  | { readonly not: Condition }
  | {
      readonly component: string;
      readonly field?: string;
      readonly eq?: JsonValue;
      readonly neq?: JsonValue;
      readonly lt?: number;
      readonly gt?: number;
    };

function asRecord(value: JsonValue | undefined): Record<string, JsonValue> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, JsonValue>;
}

/** 条件是否成立。未知组件 = 不成立（不是报错，加载期另有校验）。 */
export function matches(condition: Condition, components: Readonly<Record<string, JsonValue>>): boolean {
  if ("all" in condition) {
    return condition.all.every((child) => matches(child, components));
  }
  if ("any" in condition) {
    return condition.any.some((child) => matches(child, components));
  }
  if ("not" in condition) {
    return !matches(condition.not, components);
  }

  const component = components[condition.component];
  if (component === undefined) return false;

  // 只看「有没有这个组件」
  if (condition.field === undefined) return true;

  const value = asRecord(component)?.[condition.field];
  if (value === undefined) return false;

  if (condition.eq !== undefined && value !== condition.eq) return false;
  if (condition.neq !== undefined && value === condition.neq) return false;
  if (condition.lt !== undefined && !(typeof value === "number" && value < condition.lt)) return false;
  if (condition.gt !== undefined && !(typeof value === "number" && value > condition.gt)) return false;

  return true;
}

/** 条件里引用到的组件名（加载期校验用）。 */
export function componentsOf(condition: Condition, out = new Set<string>()): Set<string> {
  if ("all" in condition) {
    for (const child of condition.all) componentsOf(child, out);
  } else if ("any" in condition) {
    for (const child of condition.any) componentsOf(child, out);
  } else if ("not" in condition) {
    componentsOf(condition.not, out);
  } else {
    out.add(condition.component);
  }
  return out;
}
