// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 相机：把「看哪儿」从渲染里拆出来。
 *
 * 三条规矩：
 *   1. 相机只认「格子」和「像素」，不认实体、不认游戏规则；
 *   2. 它跟着**视觉位置**走，不跟逻辑位置——否则补间时画面会抖；
 *   3. 地图比视口小的时候居中，比视口大的时候夹在边界内。
 *
 * 所以渲染、HUD、点击换算全都从它这里取坐标，谁也不自己算。
 */

export interface Vec {
  readonly x: number;
  readonly y: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

export interface MapSize {
  readonly width: number;
  readonly height: number;
}

/** 视口能装下多少格（浮点：窗口尺寸不一定被 tile 整除）。 */
export function cellsInView(viewport: Viewport, tile: number): { width: number; height: number } {
  return { width: viewport.width / tile, height: viewport.height / tile };
}

/**
 * 算出相机左上角（单位：格，浮点）。
 *
 * - 地图比视口小：居中（相机可以是负数）；
 * - 地图比视口大：把目标放在正中，再夹进边界。
 */
export function cameraFor(target: Vec, viewport: Viewport, map: MapSize, tile: number): Vec {
  const view = cellsInView(viewport, tile);

  const axis = (targetAt: number, mapSize: number, viewSize: number): number => {
    if (mapSize <= viewSize) {
      // 居中：地图左边留白
      return (mapSize - viewSize) / 2;
    }
    const desired = targetAt + 0.5 - viewSize / 2;
    return clamp(desired, 0, mapSize - viewSize);
  };

  return {
    x: axis(target.x, map.width, view.width),
    y: axis(target.y, map.height, view.height),
  };
}

/** 格子坐标 → 屏幕像素（左上角）。 */
export function worldToScreen(cell: Vec, camera: Vec, tile: number): Vec {
  return { x: (cell.x - camera.x) * tile, y: (cell.y - camera.y) * tile };
}

/** 屏幕像素 → 格子坐标（向下取整，给点击用）。 */
export function screenToWorld(point: Vec, camera: Vec, tile: number): Vec {
  return {
    x: Math.floor(point.x / tile + camera.x),
    y: Math.floor(point.y / tile + camera.y),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
