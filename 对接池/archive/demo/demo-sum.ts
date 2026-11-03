// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 第一个可运行的切片：求和。
 *
 * 跑法：
 *   node engine/core/src/demo-sum.ts
 *
 * 它做的事很简单，但每一步都是真的：
 *   申请空间 → 校验输入 → 规则计算 → 提交给 store → 时间前进 → 写事件 → 回读世界
 */

import { Space } from "./space.ts";
import { Store } from "./store.ts";
import { sum, sumEffect } from "./rules/sum.ts";

const space = new Space(1, 4, 4);
const store = new Store([space]);

const a = 1;
const b = 1;

console.log("=== 第一个规则：求和 ===");
console.log(`空间 #${space.id}：${space.width}×${space.height}`);
console.log(`输入：a=${a}, b=${b}`);

console.log(`\n校验：通过`);
console.log(`规则：sum = ${sum({ a, b })}`);

const before = store.now();
store.submit(sumEffect({ a, b }, space.id));
const events = store.step();

console.log(`\nstep：时间 ${before} → ${store.now()}`);

for (const event of events) {
  console.log(
    `事件 #${event.id}  kind=${event.kind}  lTick=${event.lTick}  seq=${event.seq}` +
      `  data=${JSON.stringify(event.data)}`,
  );
}

console.log(`\n回读：格子 (${a}, ${b}) 的地形 = ${space.terrainAt({ x: a, y: b })}`);
console.log(`链头：${store.headHash}`);
