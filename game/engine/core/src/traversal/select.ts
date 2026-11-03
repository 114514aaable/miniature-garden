// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 选定核心：从一组格子里挑出「符合条件的目标」。
 *
 * 这是规则里唯一该做「扫格子」的地方——
 * 劈砍、交谈、横扫……都调它，不要各自写一遍 occupantsAt。
 *
 * 条件来自 base 的 filters（livable / talkable…），
 * 所以「谁能被选中」是**数据**，不是规则里写死的组件名。
 */

import { type JsonValue } from "../time.ts";
import { matches, type Condition } from "./filter.ts";

/** 只需要这两样能力，别的都不依赖。 */
export interface SelectorView {
  /** 这一格站着谁（按顺序）。 */
  occupantsAt(cell: { x: number; y: number }): readonly number[];
  /** 某个实体的组件。 */
  componentsOf(handle: number): Readonly<Record<string, JsonValue>>;
}

export interface SelectOptions {
  /** 排除谁（一般传发起者自己）。 */
  readonly exclude?: number;
  /** 最多要几个（不传 = 全部）。 */
  readonly limit?: number;
}

/**
 * 在给定的格子里找目标。
 *
 * 顺序：按格子给出的顺序、格子内按占用顺序——**不重排**，
 * 这样调用方（比如「只打第一个」）能预期结果。
 */
export function selectTargets(
  view: SelectorView,
  cells: readonly { readonly x: number; readonly y: number }[],
  condition: Condition,
  options: SelectOptions = {},
): number[] {
  const out: number[] = [];
  const seen = new Set<number>();

  for (const cell of cells) {
    for (const handle of view.occupantsAt(cell)) {
      if (handle === options.exclude) continue;
      if (seen.has(handle)) continue;
      if (!matches(condition, view.componentsOf(handle))) continue;

      seen.add(handle);
      out.push(handle);
      if (options.limit !== undefined && out.length >= options.limit) return out;
    }
  }

  return out;
}
