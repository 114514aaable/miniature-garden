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
import { waitHandler, waitSignature } from "../../engine/core/src/rules/wait.ts";
import { aimHandler, aimSignature } from "../../engine/core/src/rules/aim.ts";
import { enemyTurnHandler, enemyTurnSignature } from "../../engine/core/src/rules/ai.ts";
import {
  strikeHandler,
  strikeSignature,
  windupHandler,
  windupSignature,
} from "../../engine/core/src/rules/enemy-actions.ts";
import { useHandler, useSignature } from "../../engine/core/src/rules/use.ts";
import { BASE_RULES, type RuleEntry } from "./base.ts";

export const RULE_TABLE: readonly RuleEntry[] = [
  { signature: moveSignature, handler: moveHandler },
  { signature: takeSignature, handler: takeHandler },
  { signature: dropSignature, handler: dropHandler },
  { signature: waitSignature, handler: waitHandler },
  { signature: aimSignature, handler: aimHandler },
  { signature: useSignature, handler: useHandler },
  { signature: enemyTurnSignature, handler: enemyTurnHandler },
  { signature: windupSignature, handler: windupHandler },
  { signature: strikeSignature, handler: strikeHandler },
  // base 包提供的规则（劈砍、蓄力）——归属 base，不在这里逐条写
  ...BASE_RULES,
];
