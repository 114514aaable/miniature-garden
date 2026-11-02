// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 加载顺序的测试。
 *
 * 核心两条：
 *   1. 同层按 id 字典序——顺序是数据的函数，不是磁盘的函数；
 *   2. 缺依赖、版本不符、成环，都在加载期报错。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { type PackManifest } from "./manifest.ts";
import { orderPacks, satisfies } from "./order.ts";

function make(id: string, extra: Partial<PackManifest> = {}): PackManifest {
  return { id, kind: "base", version: "1.0.0", ...extra };
}

function ids(order: readonly PackManifest[]): string[] {
  return order.map((pack) => pack.id);
}

test("没有依赖时，按 id 字典序", () => {
  const order = orderPacks([make("world.c"), make("world.a"), make("world.b")]);
  assert.deepEqual(ids(order), ["world.a", "world.b", "world.c"]);
});

test("依赖排在被依赖者后面", () => {
  const order = orderPacks([
    make("world.extra", { requires: { "world.base": "^1.0.0" } }),
    make("world.base"),
  ]);
  assert.deepEqual(ids(order), ["world.base", "world.extra"]);
});

test("同层的多个包按字典序，与输入顺序无关", () => {
  const order = orderPacks([
    make("world.b", { requires: { "world.base": "*" } }),
    make("world.a", { requires: { "world.base": "*" } }),
    make("world.base"),
  ]);
  assert.deepEqual(ids(order), ["world.base", "world.a", "world.b"]);
});

test("缺依赖直接报错", () => {
  assert.throws(
    () => orderPacks([make("world.a", { requires: { "world.missing": "*" } })]),
    /依赖了不存在的包/,
  );
});

test("版本不满足直接报错", () => {
  assert.throws(
    () =>
      orderPacks([
        make("world.base", { version: "1.0.0" }),
        make("world.a", { requires: { "world.base": "^2.0.0" } }),
      ]),
    /要求 world\.base \^2\.0\.0，但实际是 1\.0\.0/,
  );
});

test("成环报错，并指出环上的路径", () => {
  assert.throws(
    () =>
      orderPacks([
        make("world.a", { requires: { "world.b": "*" } }),
        make("world.b", { requires: { "world.a": "*" } }),
      ]),
    /依赖成环：world\.[ab] → world\.[ab] → world\.[ab]/,
  );
});

test("自己依赖自己报错", () => {
  assert.throws(
    () => orderPacks([make("world.a", { requires: { "world.a": "*" } })]),
    /不能依赖自己/,
  );
});

test("包 id 重复报错", () => {
  assert.throws(() => orderPacks([make("world.a"), make("world.a")]), /重复/);
});

test("loadAfter 只影响顺序，不表示依赖", () => {
  const order = orderPacks([
    make("world.b", { loadAfter: ["world.a"] }),
    make("world.a"),
  ]);
  assert.deepEqual(ids(order), ["world.a", "world.b"]);
});

test("provides 别名可以被依赖", () => {
  const order = orderPacks([
    make("world.extra", { requires: { "legacy.base": "*" } }),
    make("world.base", { provides: ["legacy.base"] }),
  ]);
  assert.deepEqual(ids(order), ["world.base", "world.extra"]);
});

test("同一个别名被两个包提供：报错", () => {
  assert.throws(
    () =>
      orderPacks([
        make("world.a", { provides: ["legacy.base"] }),
        make("world.b", { provides: ["legacy.base"] }),
      ]),
    /被两个包同时提供/,
  );
});

test("别名不能占用真实包的名字", () => {
  assert.throws(
    () =>
      orderPacks([
        make("world.a", { provides: ["world.b"] }),
        make("world.b"),
      ]),
    /已经是一个真实的包/,
  );
});

test("版本范围：支持 * / 精确 / ^ / ~ / 比较符", () => {
  assert.equal(satisfies("1.2.3", "*"), true);
  assert.equal(satisfies("1.2.3", "1.2.3"), true);
  assert.equal(satisfies("1.2.4", "1.2.3"), false);
  assert.equal(satisfies("1.9.0", "^1.2.3"), true);
  assert.equal(satisfies("2.0.0", "^1.2.3"), false);
  assert.equal(satisfies("1.2.9", "~1.2.3"), true);
  assert.equal(satisfies("1.3.0", "~1.2.3"), false);
  assert.equal(satisfies("2.0.0", ">=1.0.0"), true);
  assert.equal(satisfies("0.9.0", ">1.0.0"), false);
});

test("不支持的版本范围直接报错", () => {
  assert.throws(() => satisfies("1.0.0", ">=1.0.0 <2.0.0"), /不支持的版本范围/);
});
