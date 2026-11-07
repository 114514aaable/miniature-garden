// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 宿主的「效果入口」：规则 / 场景产出的效果，统一从这里落进 store。
 *
 * 为什么要有这一个函数：
 *   - 以前四处各自 store.submit，拦截（部位伤害、日志、回放）没地方挂；
 *   - 规则层不该知道「血在哪」——它只产出效果；
 *   - 宿主想改写效果（比如把 core.health 的伤害换成部位伤害）时，
 *     只改这里，不改任何规则。
 *
 * 拦截器是纯函数：拿一批效果 + 元信息，返回一批新效果。按安装顺序串起来。
 */

import type { Effect } from "../../engine/core/src/store.ts";

/** 能接收效果的东西（真实是 Store，测试里是记录器）。 */
export interface EffectSink {
  submit(effect: Effect): void;
}

/** 这批效果从哪来：技能、场景、挂起结算、敌人、系统。 */
export type EffectSource = "skill" | "scene" | "pending" | "enemy" | "system";

export interface EffectMeta {
  readonly source: EffectSource;
  /** 技能 tag（source = skill 时）。 */
  readonly tag?: string;
  /** 施动者 / 目标句柄（有就带上，拦截器会用到）。 */
  readonly actor?: number;
  readonly target?: number;
  /** 攻击伤害（如果规则知道）。 */
  readonly damage?: number;
}

/** 拦截器：可以改写效果列表；不改就原样返回。 */
export type EffectInterceptor = (
  effects: readonly Effect[],
  meta: EffectMeta,
) => readonly Effect[];

/**
 * 把效果交给 store。
 *
 * @param interceptors 按顺序调用；返回空列表就表示「这批效果被吞掉」。
 */
export function applyEffects(
  sink: EffectSink,
  effects: readonly Effect[],
  meta: EffectMeta = { source: "system" },
  interceptors: readonly EffectInterceptor[] = [],
): void {
  let list: readonly Effect[] = effects;

  for (const intercept of interceptors) {
    list = intercept(list, meta);
  }

  for (const effect of list) {
    sink.submit(effect);
  }
}
