// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 统一伤害：攻击/横扫共用一套公式。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { armorOf, damageOf, powerOf, resolveDamage } from "./damage.ts";

test("攻击力默认 1，防御默认 0", () => {
  assert.equal(powerOf(undefined), 1);
  assert.equal(armorOf(undefined), 0);
});

test("伤害至少 1", () => {
  assert.equal(damageOf(1, 5), 1);
  assert.equal(damageOf(5, 5), 1);
});

test("完整结算：攻击 5 打防御 2 → 3", () => {
  const result = resolveDamage({ attack: 5 }, { defense: 2 });
  assert.deepEqual(result, { power: 5, armor: 2, damage: 3 });
});

test("无属性组也能打（默认 1 − 0）", () => {
  const result = resolveDamage(undefined, undefined);
  assert.deepEqual(result, { power: 1, armor: 0, damage: 1 });
});
