// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * base 包的规则：劈砍、蓄力劈砍。
 *
 * **归属约定**（见 docs/systems/runtime.md）：
 *   core.*   内核语义（目前只有 core.place）
 *   base.*   base 包提供的基础玩法
 *   <world>.* 世界专属
 *
 * 代码暂时还放在 engine/core/src/rules 里（我们只有这一个仓库）；
 * 「冷加载」指的是：世界激活时才组装进运行时，而不是热更新。
 * 以后 base 有自己的代码目录，这里就改成 import 那个目录。
 */

import { attackHandler, attackSignature } from "../../engine/core/src/rules/attack.ts";
import { castHandler, castSignature } from "../../engine/core/src/rules/pending.ts";
import { talkHandler, talkSignature } from "../../engine/core/src/rules/talk.ts";
import { sweepHandler, sweepSignature } from "../../engine/core/src/rules/sweep.ts";

import { type Signature } from "../../engine/core/src/event/registry.ts";
import { type EvaluateContext } from "../../engine/core/src/event/evaluate.ts";
import { type JsonValue } from "../../engine/core/src/time.ts";

export interface RuleEntry {
  readonly signature: Signature;
  readonly handler: (params: JsonValue, context: EvaluateContext) => JsonValue;
}

/** base 包提供的规则（tag 前缀 base.）。 */
export const BASE_RULES: readonly RuleEntry[] = [
  { signature: attackSignature, handler: attackHandler },
  { signature: castSignature, handler: castHandler },
  { signature: talkSignature, handler: talkHandler },
  { signature: sweepSignature, handler: sweepHandler },
];
