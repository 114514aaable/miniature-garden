// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 规则清单：一条规则 = 签名 + 处理器。
 *
 * 宿主用它注册；文档生成器用它列目录。
 * **只有这一处清单**——加规则只改这里，注册和文档自动跟上。
 */

import { moveHandler, moveSignature } from "../../engine/core/src/rules/move.ts";
import { dropHandler, dropSignature, takeHandler, takeSignature } from "../../engine/core/src/rules/inventory.ts";
import { attackHandler, attackSignature } from "../../engine/core/src/rules/attack.ts";
import { waitHandler, waitSignature } from "../../engine/core/src/rules/wait.ts";
import { aimHandler, aimSignature } from "../../engine/core/src/rules/aim.ts";
import { enemyTurnHandler, enemyTurnSignature } from "../../engine/core/src/rules/ai.ts";
import {
  strikeHandler,
  strikeSignature,
  windupHandler,
  windupSignature,
} from "../../engine/core/src/rules/enemy-actions.ts";
import { castHandler, castSignature } from "../../engine/core/src/rules/pending.ts";
import { type Signature } from "../../engine/core/src/event/registry.ts";
import { type EvaluateContext } from "../../engine/core/src/event/evaluate.ts";
import { type JsonValue } from "../../engine/core/src/time.ts";

export interface RuleEntry {
  readonly signature: Signature;
  readonly handler: (params: JsonValue, context: EvaluateContext) => JsonValue;
}

export const RULE_TABLE: readonly RuleEntry[] = [
  { signature: moveSignature, handler: moveHandler },
  { signature: takeSignature, handler: takeHandler },
  { signature: dropSignature, handler: dropHandler },
  { signature: attackSignature, handler: attackHandler },
  { signature: waitSignature, handler: waitHandler },
  { signature: aimSignature, handler: aimHandler },
  { signature: castSignature, handler: castHandler },
  { signature: enemyTurnSignature, handler: enemyTurnHandler },
  { signature: windupSignature, handler: windupHandler },
  { signature: strikeSignature, handler: strikeHandler },
];
