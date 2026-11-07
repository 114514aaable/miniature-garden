// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 效果入口：顺序、拦截、吞掉、元信息。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { applyEffects, type EffectInterceptor } from "./effects.ts";
import type { Effect } from "../../engine/core/src/store.ts";

function sink() {
  const seen: Effect[] = [];
  return { seen, submit: (effect: Effect) => seen.push(effect) };
}

const A: Effect = { kind: "terrain", space: 1 as never, cell: { x: 1, y: 1 }, value: 3 };
const B: Effect = { kind: "terrain", space: 1 as never, cell: { x: 2, y: 1 }, value: 3 };

test("没有拦截器：原样按顺序提交", () => {
  const store = sink();
  applyEffects(store, [A, B], { source: "skill" });
  assert.deepEqual(store.seen, [A, B]);
});

test("拦截器可以改写效果", () => {
  const store = sink();
  const double: EffectInterceptor = (effects) => [...effects, ...effects];
  applyEffects(store, [A], { source: "pending" }, [double]);
  assert.equal(store.seen.length, 2);
});

test("拦截器可以吞掉效果", () => {
  const store = sink();
  const mute: EffectInterceptor = () => [];
  applyEffects(store, [A, B], { source: "scene" }, [mute]);
  assert.equal(store.seen.length, 0);
});

test("多个拦截器按安装顺序串起来", () => {
  const store = sink();
  const order: string[] = [];
  const first: EffectInterceptor = (effects) => {
    order.push("first");
    return effects;
  };
  const second: EffectInterceptor = (effects) => {
    order.push("second");
    return effects;
  };

  applyEffects(store, [A], { source: "enemy" }, [first, second]);
  assert.deepEqual(order, ["first", "second"]);
});

test("元信息会传给拦截器", () => {
  const store = sink();
  let seenMeta: unknown = null;
  const read: EffectInterceptor = (effects, meta) => {
    seenMeta = meta;
    return effects;
  };

  applyEffects(store, [A], { source: "skill", tag: "base.attack", target: 7 }, [read]);
  assert.deepEqual(seenMeta, { source: "skill", tag: "base.attack", target: 7 });
});

test("拦截器返回空列表时，后续拦截器也拿不到效果", () => {
  const store = sink();
  let got: readonly Effect[] | null = null;
  const mute: EffectInterceptor = () => [];
  const spy: EffectInterceptor = (effects) => {
    got = effects;
    return effects;
  };

  applyEffects(store, [A], { source: "system" }, [mute, spy]);
  assert.deepEqual(got, []);
  assert.equal(store.seen.length, 0);
});
