// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 第一个规则的测试：从输入一路走到「世界里能读回来」。
 *
 * 这里不只测 sum(1,1)=2，还测：
 *   - 非法输入进不了世界；
 *   - 结果是经过 store、经过时间、留下事件之后才落地的。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { AIR, Space } from "../space.ts";
import { Store } from "../store.ts";
import { sum, sumEffect, validateSum } from "./sum.ts";

function world(): { store: Store; space: Space } {
  const space = new Space(1, 4, 4);
  return { store: new Store([space]), space };
}

test("纯函数：1 + 1 = 2", () => {
  assert.equal(sum({ a: 1, b: 1 }), 2);
});

test("校验：非整数、负数都挡在门外", () => {
  assert.throws(() => validateSum({ a: 1.5, b: 1 }), /整数/);
  assert.throws(() => validateSum({ a: 1, b: -1 }), /负数/);
});

test("完整链路：输入 1 和 1，世界里读回 2", () => {
  const { store, space } = world();

  store.submit(sumEffect({ a: 1, b: 1 }, 1));
  const events = store.step();

  assert.equal(space.terrainAt({ x: 1, y: 1 }), 2, "回馈：格子里是 2");
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "terrain");
  assert.equal(events[0].lTick, 1);
  assert.equal(events[0].data.value, 2);
});

test("非法输入不会产生任何事件，也不会改世界", () => {
  const { store, space } = world();

  assert.throws(() => sumEffect({ a: -1, b: 1 }, 1), /负数/);
  assert.equal(space.terrainAt({ x: 0, y: 0 }), AIR);
  assert.equal(store.headHash, "0");
});

test("结果落到空间之外时，store 拒绝，世界保持原样", () => {
  const { store, space } = world();
  const before = store.headHash;

  store.submit(sumEffect({ a: 9, b: 9 }, 1));
  assert.throws(() => store.step(), /越界/);

  assert.equal(store.now(), 0);
  assert.equal(store.headHash, before);
  assert.equal(space.terrainAt({ x: 0, y: 0 }), AIR);
});

test("两步求和，时间线依次推进", () => {
  const { store, space } = world();

  store.submit(sumEffect({ a: 1, b: 1 }, 1));
  store.step();
  store.submit(sumEffect({ a: 2, b: 3 }, 1));
  store.step();

  assert.equal(space.terrainAt({ x: 1, y: 1 }), 2);
  assert.equal(space.terrainAt({ x: 2, y: 3 }), 5);
  assert.equal(store.now(), 2);
});
