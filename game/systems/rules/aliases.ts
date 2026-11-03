// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 旧 tag 的别名表。
 *
 * 改 tag 是必要的（core.* → base.*），但会打断三类引用：
 *   1. 世界包 world.json 的 rules 列表
 *   2. 存档里的 disabled 列表
 *   3. 浏览器里存的快捷栏绑定
 *
 * 所以启动时统一过一遍别名表——**一处映射，三处引用都不用改**。
 */

export const LEGACY_TAGS: Readonly<Record<string, string>> = {
  "core.attack": "base.attack",
  "core.cast": "base.cast",
};

/** 把旧 tag 换成新 tag；不认识的原样返回。 */
export function resolveTag(tag: string): string {
  return LEGACY_TAGS[tag] ?? tag;
}

/** 批量解析（去重前先映射）。 */
export function resolveTags(tags: readonly string[]): string[] {
  return tags.map(resolveTag);
}
