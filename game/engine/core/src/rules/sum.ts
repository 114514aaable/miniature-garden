// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 第一个规则：求和。
 *
 * 它很傻，但地位重要——它是「规则层」的第一个文件，演示了一条完整链路：
 *
 *   输入 → 校验（不合法就当场报错） → 纯函数算出结果 → 翻译成 Effect
 *
 * 规则层只做这三件事。它不碰时间、不碰存储、不知道事件怎么写。
 * 「把结果落到世界里」是 store 的事。
 *
 * 这里有个刻意的映射：把和写进 (a, b) 这个格子。
 * 位置用参数、值用结果，纯粹是为了让「回馈」看得见——不是游戏设计。
 */

import type { Effect } from "../store.ts";

export interface SumInput {
  readonly a: number;
  readonly b: number;
}

/**
 * 校验：在算之前，先把不合法的输入挡掉。
 * 错误信息要说人话——它是给玩家和贡献者看的，不是给编译器看的。
 */
export function validateSum(input: SumInput): void {
  if (!Number.isInteger(input.a)) {
    throw new Error(`a 必须是整数，收到 ${input.a}`);
  }
  if (!Number.isInteger(input.b)) {
    throw new Error(`b 必须是整数，收到 ${input.b}`);
  }
  if (input.a < 0 || input.b < 0) {
    throw new Error(`a 和 b 不能是负数，收到 (${input.a}, ${input.b})`);
  }
}

/** 纯函数：同样的输入永远同样的输出，不读世界、不写世界。 */
export function sum(input: SumInput): number {
  validateSum(input);
  return input.a + input.b;
}

/**
 * 把规则的结果翻译成一个对世界的变更。
 * 注意签名：规则不知道「世界在哪」，所以空间 id 是调用方给的。
 */
export function sumEffect(input: SumInput, space: number): Effect {
  return {
    kind: "terrain",
    space,
    cell: { x: input.a, y: input.b },
    value: sum(input),
  };
}
