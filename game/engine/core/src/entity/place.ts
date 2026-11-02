// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 位置：内核唯一保留的组件名。
 *
 * 为什么必须保留一个：空间索引要知道「谁在哪」，否则没法维护。
 * 所以 `core.place` 不是一个普通的数据组件——写它等于改索引。
 *
 * 但它对外仍然长得像组件：`view.entity(h).components["core.place"]`。
 * 规则看到的是统一的数据，存储是不是字段，与规则无关。
 */

import { type Entity } from "./entity.ts";

export const PLACE = "core.place";

export interface Place {
  readonly space: number;
  readonly x: number;
  readonly y: number;
}

/** 实体在哪；不在空间里（比如躺在背包）返回 null。 */
export function placeOf(entity: Entity): Place | null {
  if (entity.space === null || entity.pos === null) {
    return null;
  }
  return { space: entity.space, x: entity.pos.x, y: entity.pos.y };
}
