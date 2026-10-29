// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 效果的测试：能收、能拒、能落地。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { AIR, Space } from "../space.ts";
import { Store } from "../store.ts";
import { type JsonValue } from "../time.ts";
import { collectEffects, submitEffects } from "./effects.ts";

test("没有 effects 字段 = 不改世界", () => {
  assert.deepEqual(collectEffects({ damage: 12 }), []);
});

test("地形效果能解析出来", () => {
  const effects = collectEffects({
    effects: [{ kind: "terrain", space: 1, cell: { x: 2, y: 3 }, value: 7 }],
  });
  assert.deepEqual(effects, [{ kind: "terrain", space: 1, cell: { x: 2, y: 3 }, value: 7 }]);
});

test("放置与移除也能解析", () => {
  const effects = collectEffects({
    effects: [
      { kind: "place", space: 1, cell: { x: 0, y: 0 }, handle: 5 },
      { kind: "remove", space: 1, cell: { x: 0, y: 0 }, handle: 5 },
    ],
  });
  assert.equal(effects.length, 2);
});

test("effects 不是数组就拒绝", () => {
  assert.throws(() => collectEffects({ effects: {} }), /必须是数组/);
});

test("未知的效果类型拒绝", () => {
  assert.throws(
    () => collectEffects({ effects: [{ kind: "explode", space: 1, cell: { x: 0, y: 0 } }] }),
    /未知的效果类型/,
  );
});

test("缺字段拒绝，并指出位置", () => {
  assert.throws(
    () => collectEffects({ effects: [{ kind: "terrain", space: 1, cell: { x: 0, y: 0 } }] }),
    /effects\[0\]\.value/,
  );
});

test("未知字段拒绝，x- 前缀放行", () => {
  assert.throws(
    () =>
      collectEffects({
        effects: [{ kind: "terrain", space: 1, cell: { x: 0, y: 0 }, value: 1, magic: true }],
      }),
    /未知字段 "magic"/,
  );

  const ok = collectEffects({
    effects: [{ kind: "terrain", space: 1, cell: { x: 0, y: 0 }, value: 1, "x-note": "hi" }],
  });
  assert.equal(ok.length, 1);
});

test("效果条数有上限", () => {
  const many = Array.from({ length: 257 }, () => ({
    kind: "terrain",
    space: 1,
    cell: { x: 0, y: 0 },
    value: 1,
  }));
  assert.throws(() => collectEffects({ effects: many as JsonValue }), /最多 256 条/);
});

test("端到端：求值结果 → 效果 → store → 世界真的变了", () => {
  const space = new Space(1, 4, 4);
  const store = new Store([space]);

  const effects = collectEffects({
    effects: [{ kind: "terrain", space: 1, cell: { x: 1, y: 1 }, value: 9 }],
  });

  assert.equal(space.terrainAt({ x: 1, y: 1 }), AIR, "提交之前世界不动");
  submitEffects(store, effects);
  assert.equal(space.terrainAt({ x: 1, y: 1 }), AIR, "step 之前世界还是不动");

  const logs = store.step();
  assert.equal(space.terrainAt({ x: 1, y: 1 }), 9);
  assert.equal(logs.length, 1);
});
