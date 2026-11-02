// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 碰撞规则：谁能挡路。
 *
 * 放在规则层，因为这是「语义」：空间只知道格子里有谁，
 * 不知道为什么有人过不去。
 *
 * v0 只有一种规矩：
 *   有 core.solid 组件 → 挡路，只占自己那一格（0,0）
 *   没有            → 不挡路（地板、掉落物、装饰）
 *
 * 以后要做多格建筑，只改 occupies()，调用方一行不动。
 */

import { type Cell, type SpaceId } from "../space.ts";
import { type WorldView } from "../event/view.ts";

/** 实体是不是实心的。 */
export const SOLID = "core.solid";

export function isSolid(view: WorldView, handle: number): boolean {
  return view.entity(handle).components[SOLID] !== undefined;
}

/**
 * 这个格子里有哪些「阻挡者」。
 *
 * 注意它和 occupantsAt 的区别：后者包括所有东西，包括可以踩过去的地板。
 */
export function blockersAt(view: WorldView, space: SpaceId, cell: Cell): readonly number[] {
  return view.space(space).occupantsAt(cell).filter((handle) => isSolid(view, handle));
}

/** 这个实体占哪些格子。v0 只有自己那一格。 */
export function occupies(view: WorldView, handle: number): readonly Cell[] {
  const entity = view.entity(handle);
  return entity.pos === null ? [] : [entity.pos];
}
