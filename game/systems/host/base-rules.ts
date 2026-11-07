// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 基础数据写规则：核心血量的 hp 夹在 0..max，写到 0 视为致死。
 *
 * 这只是一份「数据」——部位模式会用它自己的一套规则替换，
 * 拦截入口和致死广播都不变。
 */

import type { WriteRule } from "./writes.ts";

export const baseWriteRules: readonly WriteRule[] = [
  {
    component: "core.health",
    field: "hp",
    mode: "clamp",
    min: 0,
    maxField: "max",
    deathAtOrBelow: 0,
  },
];
