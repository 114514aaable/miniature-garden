// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 宿主的「效果入口」：规则 / 场景产出的效果，统一从这里落进 store。
 *
 * 为什么要有这一个函数：
 *   - 以前四处各自 store.submit，拦截（数据写、日志、回放）没地方挂；
 *   - 规则层不该知道「血在哪」——它只产出效果；
 *   - 宿主想改写效果（比如把核心血量的写换成部位实例的写）时，
 *     只改这里，不改任何规则。
 *
 * 两层拦截：
 *   1  效果拦截器：拿一批效果 + 元信息，返回一批新效果（通用管道）
 *   2  数据写拦截器：实体某个属性组要被写时，问一句「谁接管」
 *      —— 接管方标记 consume，然后给出替代写；替代写直接落库，不再拦
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

/** 一次「实体数据要被写」的描述。 */
export interface EntityWrite {
  readonly handle: number;
  /** 属性组名（core.health / core.body / 自定义）。 */
  readonly component: string;
  /** 写之前的值（没有就是 undefined）。 */
  readonly before: unknown;
  /** 规则想让新值变成什么。 */
  readonly after: unknown;
  readonly meta: EffectMeta;
}

/** 接管方返回：consume 表示「原写不要执行」，effects 是替代写。 */
export interface WriteResult {
  readonly consume: boolean;
  readonly effects: readonly Effect[];
}

/** 数据写拦截器：null = 没人接管，原样写。 */
export type WriteResolver = (write: EntityWrite) => WriteResult | null;

/**
 * 把效果交给 store。
 *
 * @param interceptors 按顺序调用；返回空列表就表示「这批效果被吞掉」。
 * @param resolveWrite  实体数据写拦截；替代写直接落库，不再拦。
 */
export function applyEffects(
  sink: EffectSink,
  effects: readonly Effect[],
  meta: EffectMeta = { source: "system" },
  interceptors: readonly EffectInterceptor[] = [],
  resolveWrite: WriteResolver | null = null,
): void {
  let list: readonly Effect[] = effects;

  for (const intercept of interceptors) {
    list = intercept(list, meta);
  }

  for (const effect of list) {
    if (resolveWrite !== null && effect.kind === "patch" && effect.component !== "core.place") {
      const taken = resolveWrite({
        handle: effect.handle,
        component: effect.component,
        before: undefined,
        after: effect.data,
        meta,
      });

      if (taken !== null && taken.consume) {
        for (const replacement of taken.effects) sink.submit(replacement);
        continue;
      }
    }

    sink.submit(effect);
  }
}
