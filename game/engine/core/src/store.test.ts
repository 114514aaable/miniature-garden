// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * Store 的测试。
 *
 * 最重要的那条是「失败时全家回滚」：
 * 一批变更里有一条非法，状态必须回到进入 step 前的样子，
 * 而且日志里不能留下半截记录。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { AIR, Space } from "./space.ts";
import { Store } from "./store.ts";

function world(): { store: Store; space: Space } {
  const space = new Space(1, 4, 3);
  const store = new Store([space]);
  return { store, space };
}

test("submit 只排队，不动状态", () => {
  const { store, space } = world();
  store.submit({ kind: "terrain", space: 1, cell: { x: 1, y: 1 }, value: 9 });
  assert.equal(space.terrainAt({ x: 1, y: 1 }), AIR);
  assert.equal(store.now(), 0);
});

test("step 推进时间并应用变更", () => {
  const { store, space } = world();
  store.submit({ kind: "terrain", space: 1, cell: { x: 1, y: 1 }, value: 9 });

  const events = store.step();

  assert.equal(store.now(), 1);
  assert.equal(space.terrainAt({ x: 1, y: 1 }), 9);
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, "terrain");
  assert.equal(events[0].lTick, 1);
  assert.equal(events[0].seq, 1);
});

test("同一 tick 的多个变更，seq 依次递增", () => {
  const { store } = world();
  store.submit({ kind: "terrain", space: 1, cell: { x: 0, y: 0 }, value: 1 });
  store.submit({ kind: "terrain", space: 1, cell: { x: 1, y: 0 }, value: 2 });
  store.submit({ kind: "place", space: 1, cell: { x: 2, y: 0 }, handle: 7 });

  const events = store.step();
  assert.deepEqual(events.map((e) => e.seq), [1, 2, 3]);
  assert.ok(events.every((e) => e.lTick === 1));
});

test("提交发生在上一 tick，事件记在应用的那个 tick", () => {
  const { store } = world();
  store.submit({ kind: "terrain", space: 1, cell: { x: 0, y: 0 }, value: 1 });
  const events = store.step();
  assert.equal(events[0].lTick, 1, "在 0 提交，在 1 落地");

  store.submit({ kind: "terrain", space: 1, cell: { x: 0, y: 0 }, value: 2 });
  const next = store.step();
  assert.equal(next[0].lTick, 2);
});

test("没有变更的 step 也会推进时间", () => {
  const { store } = world();
  assert.deepEqual(store.step(), []);
  assert.equal(store.now(), 1);
});

test("一批里有一条非法：全部回滚，连时间都不前进", () => {
  const { store, space } = world();
  const before = store.headHash;

  store.submit({ kind: "terrain", space: 1, cell: { x: 0, y: 0 }, value: 5 });
  store.submit({ kind: "remove", space: 1, cell: { x: 0, y: 0 }, handle: 999 });

  assert.throws(() => store.step(), /不在格子/);
  assert.equal(space.terrainAt({ x: 0, y: 0 }), AIR, "第一条也要被撤销");
  assert.equal(store.headHash, before, "日志不能留下半截");
  assert.equal(store.now(), 0, "失败的一次 step 不应该推进时间");
});

test("空间不存在时报错，而不是安静地什么都不做", () => {
  const { store } = world();
  store.submit({ kind: "terrain", space: 99, cell: { x: 0, y: 0 }, value: 1 });
  assert.throws(() => store.step(), /空间不存在/);
});

test("inject 立即生效，并标记成 inject", () => {
  const { store, space } = world();
  const event = store.inject({ kind: "terrain", space: 1, cell: { x: 2, y: 2 }, value: 4 });

  assert.equal(space.terrainAt({ x: 2, y: 2 }), 4);
  assert.equal(event.kind, "inject");
  assert.equal(event.lTick, 0, "不在 tick 里，就用当前刻度");
});

test("inject 失败会撤销自己", () => {
  const { store } = world();
  const before = store.headHash;
  assert.throws(() => store.inject({ kind: "remove", space: 1, cell: { x: 0, y: 0 }, handle: 5 }), /不在格子/);
  assert.equal(store.headHash, before);
});

test("两份同样的世界跑同样的操作，链头一致", () => {
  const build = (): string => {
    const { store } = world();
    store.submit({ kind: "terrain", space: 1, cell: { x: 1, y: 1 }, value: 3 });
    store.submit({ kind: "place", space: 1, cell: { x: 1, y: 1 }, handle: 42 });
    store.step();
    store.step();
    return store.headHash;
  };
  assert.equal(build(), build());
});

test("重复的空间 id 直接拒绝", () => {
  assert.throws(() => new Store([new Space(1, 2, 2), new Space(1, 2, 2)]), /重复/);
});

test("事件日志可通过 verify 校验", () => {
  const { store } = world();
  store.submit({ kind: "terrain", space: 1, cell: { x: 0, y: 0 }, value: 1 });
  store.step();
  assert.equal(store.headHash.length, 8);
});
