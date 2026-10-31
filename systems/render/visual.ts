// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 视觉投影：渲染位置永远从逻辑位置重算。
 *
 * 三条规则（抄 Kinky Dungeon 的账，但把它的债还掉）：
 *   1. 视觉没有「播放中」状态——每帧拿逻辑位置和视觉位置算一次
 *   2. 落后超过预算就 snap（默认 5 格），玩家会看到跳变，这是设计内行为
 *   3. delta 用 min(now-last, last-last2) 钳住——切 tab 回来不会瞬移半张图
 *
 * 速度单位是「格/秒」：10 格/秒 = 100ms 一格（与 KD 默认一致）。
 * 注意：这个数要和输入节拍一起调，只调一个就会长期处在 snap 边缘。
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface VisualConfig {
  /** 视觉速度，格/秒。 */
  readonly speed: number;
  /** 落后超过多少格直接瞬移。 */
  readonly snapDistance: number;
}

export const DEFAULT_VISUAL: VisualConfig = {
  speed: 10,
  snapDistance: 5,
};

/**
 * 钳住帧间隔。
 *
 * 不钳的话：切出去十分钟再回来，delta 是 600000ms，
 * 所有东西会在一帧内滑到终点——看起来像瞬移。
 */
export function clampDelta(now: number, last: number, previous: number): number {
  const raw = now - last;
  const lastFrame = last - previous;
  if (!Number.isFinite(raw) || raw < 0) return 0;
  if (!Number.isFinite(lastFrame) || lastFrame <= 0) return raw;
  return Math.min(raw, lastFrame);
}

/** 两个位置差多少格（切比雪夫距离，和格子移动一致）。 */
export function distance(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * 让视觉位置朝目标走一步。
 *
 * visual 为 null 表示第一次见到这个实体——直接对齐，不做动画。
 */
export function stepVisual(
  visual: Vec2 | null,
  target: Vec2,
  deltaMs: number,
  config: VisualConfig = DEFAULT_VISUAL,
): Vec2 {
  if (visual === null) {
    return { x: target.x, y: target.y };
  }

  const gap = distance(visual, target);
  if (gap === 0) {
    return visual;
  }
  if (gap > config.snapDistance) {
    return { x: target.x, y: target.y };
  }

  const budget = (config.speed * Math.max(0, deltaMs)) / 1000;
  if (budget >= gap) {
    return { x: target.x, y: target.y };
  }

  const k = budget / gap;
  return {
    x: visual.x + (target.x - visual.x) * k,
    y: visual.y + (target.y - visual.y) * k,
  };
}
