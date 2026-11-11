// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 世界声明哪些规则，就只启用哪些规则。
 *
 * 语义：
 *   world.json 没写 rules       → 全部规则（向后兼容）
 *   world.json 写了 rules: []   → 一条都不启用
 *   world.json 写了列表         → 只启用列表里的
 *   列表里有未知 tag            → 启动就报错，不静默忽略
 */

import { resolveTags } from "../rules/aliases.ts";

export interface RuleLike {
  readonly signature: { readonly tag: string };
}

export function selectActiveRules<T extends RuleLike>(
  table: readonly T[],
  declared: readonly string[],
  explicit: boolean,
  disabled: ReadonlySet<string>,
): T[] {
  const allowed = new Set(resolveTags(declared));

  if (explicit) {
    for (const tag of allowed) {
      if (!table.some((rule) => rule.signature.tag === tag)) {
        throw new Error(`世界声明了未知规则：${tag}`);
      }
    }
  }

  return table.filter(
    (rule) =>
      !disabled.has(rule.signature.tag) &&
      (!explicit || allowed.has(rule.signature.tag)),
  );
}
