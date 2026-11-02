// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 步进成本：正常动作推进时钟，零帧动作不推进但照样记账。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Space } from "./space.ts";
import { Store } from "./store.ts";

function world(): { store: Store; space: Space } {
  const space = new Space(1, 4, 4);
  return { store: new Store([space]), space };
}

test("默认成本 1：推进一格", () => {
  const { store } = world();
  store.submit({ kind: "terrain", space: 1, cell: { x: 0, y: 0 }, value: 1 });
  store.step();
  assert.equal(store.now(), 1);
});

test("成本 3：一次推进三格", () => {
  const { store } = world();
  store.submit({ kind: "terrain", space: 1, cell: { x: 0, y: 0 }, value: 1 });
  store.step(3);
  assert.equal(store.now(), 3);
});

test("零帧：时钟不动，事件记在同一回合的不同序号", () => {
  const { store } = world();

  store.submit({ kind: "terrain", space: 1, cell: { x: 0, y: 0 }, value: 1 });
  const first = store.step(0);

  store.submit({ kind: "terrain", space: 1, cell: { x: 1, y: 0 }, value: 2 });
  const second = store.step(0);

  assert.equal(store.now(), 0, "零帧不推进时钟");
  assert.equal(first[0].lTick, 0);
  assert.equal(second[0].lTick, 0);
  assert.equal(first[0].seq, 1);
  assert.equal(second[0].seq, 2, "同一个 tick 内序号递增");
});

test("零帧之后再做正常动作，从同一刻往前推", () => {
  const { store } = world();
  store.step(0);
  store.step(2);
  assert.equal(store.now(), 2);
});

test("成本必须是非负整数", () => {
  const { store } = world();
  assert.throws(() => store.step(-1), /非负整数/);
  assert.throws(() => store.step(1.5), /非负整数/);
});
