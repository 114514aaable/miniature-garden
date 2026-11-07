// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 推进：把世界推到目标 tick，同时产帧。
 *
 * 宿主只提供「这一 tick 干什么」（stepTick）和「怎么录帧」（capture / diff），
 * 循环本身（上限、截断、尾帧）放在这里——这样它可测，也不用起服务器。
 */

import type { Frame, FrameEvent } from "./frames.ts";

export interface AdvanceHost {
  /** 现在第几 tick。 */
  now(): number;
  /** 推不动 / 截断时，把「玩家下次能行动」拉回来。 */
  setReadyAt(tick: number): void;
  /** 给玩家看的一句话（截断提示）。 */
  notice(message: string): void;
  /** 写一条调试日志。 */
  devlog(message: string, data: unknown): void;
  /** 本动作累计的帧（宿主持有数组，这里往里 push）。 */
  readonly frames: Frame[];
  /** 本动作累计的事件（step 阶段会往里追加）。 */
  readonly lastEvents: readonly FrameEvent[];
  /** 抓这一 tick 的投影实体。 */
  capture(): Map<number, unknown>;
  /** 前后两拍做差。 */
  diff(prev: ReadonlyMap<number, unknown>, tick: number, events: readonly FrameEvent[]): Frame;
  /** 跑这一 tick 的阶段（通常 = 结算挂起 + 敌人行动 + store.step）。 */
  stepTick(): void;
  /** 把排队的变更落地（不推进时间）。 */
  applyPending(): void;
  /** 最多录多少帧（防超长动作撑爆响应）。 */
  readonly maxFrames?: number;
}

export const MAX_FRAMES = 200;
/** 推进次数上限：防止 stepTick 写坏导致死循环。 */
const MAX_STEPS = 512;

/**
 * 推进到 target。
 *
 * 循环里每 tick 录一帧；循环结束后补一帧「挂起结算」的尾帧，
 * 否则最后一下会直接跳到最终状态、看不到过程。
 */
export function advanceTo(host: AdvanceHost, target: number): void {
  if (!Number.isFinite(target)) {
    host.devlog("调度器", { error: "target 不是数字" });
    return;
  }

  const maxFrames = host.maxFrames ?? MAX_FRAMES;
  let guard = 0;

  while (host.now() < target) {
    const before = host.capture();
    const eventsBefore = host.lastEvents.length;

    if (guard++ > MAX_STEPS) {
      host.devlog("调度器", { error: "推进次数超限" });
      // 没推到目标就把「下次能行动」拉回当前时刻，否则玩家会永远卡在「恢复中」
      host.setReadyAt(host.now());
      host.notice("动作太长，被截断在 " + host.now() + " 回合");
      break;
    }

    host.stepTick();

    const events = host.lastEvents.slice(eventsBefore);
    if (host.frames.length < maxFrames) {
      host.frames.push(host.diff(before, host.now(), events));
    }
  }

  // 循环末尾的挂起效果也要成一帧
  const tailBefore = host.capture();
  const tailEvents = host.lastEvents.length;
  host.applyPending();

  if (host.frames.length < maxFrames) {
    const tail = host.lastEvents.slice(tailEvents);
    if (tail.length > 0 || host.frames.length === 0) {
      host.frames.push(host.diff(tailBefore, host.now(), tail));
    }
  }
}
