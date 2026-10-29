// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 类型校验器的测试。
 *
 * 重点不是「合法的能过」，而是「不合法的过不去，而且报错能指出位置」。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { type Schema, SchemaError, validate } from "./schema.ts";

const int: Schema = { t: "int" };

test("int：接受安全整数，拒绝小数与字符串", () => {
  validate(0, int);
  validate(-42, int);
  assert.throws(() => validate(1.5, int), /安全整数/);
  assert.throws(() => validate("1", int), /安全整数/);
  assert.throws(() => validate(NaN, int), /安全整数/);
});

test("num：拒绝 Infinity 与 NaN", () => {
  validate(1.5, { t: "num" });
  assert.throws(() => validate(Infinity, { t: "num" }), /有限数字/);
  assert.throws(() => validate(NaN, { t: "num" }), /有限数字/);
});

test("str / bool / null", () => {
  validate("a", { t: "str" });
  validate(true, { t: "bool" });
  validate(null, { t: "null" });
  assert.throws(() => validate(1, { t: "str" }), /字符串/);
  assert.throws(() => validate("true", { t: "bool" }), /布尔/);
});

test("enum：只接受列出的值", () => {
  const s: Schema = { t: "enum", values: ["north", "south", 3] };
  validate("north", s);
  validate(3, s);
  assert.throws(() => validate("east", s), /需要/);
});

test("array：逐项校验，并限制长度", () => {
  const s: Schema = { t: "array", of: { t: "int" }, max: 2 };
  validate([1, 2], s);
  assert.throws(() => validate([1, 2, 3], s), /最多 2 项/);
  assert.throws(() => validate([1, "x"], s), /\$\[1\]/);
});

test("object：缺字段要报错", () => {
  const s: Schema = { t: "object", fields: { a: int, b: int } };
  validate({ a: 1, b: 2 }, s);
  assert.throws(() => validate({ a: 1 }, s), /缺少字段 "b"/);
});

test("object：可选字段可以缺席", () => {
  const s: Schema = { t: "object", fields: { a: int, b: int }, optional: ["b"] };
  validate({ a: 1 }, s);
});

test("object：未知字段默认拒绝，x- 前缀放行", () => {
  const s: Schema = { t: "object", fields: { a: int } };
  assert.throws(() => validate({ a: 1, b: 2 }, s), /未知字段 "b"/);
  validate({ a: 1, "x-note": "随便写" }, s);
});

test("嵌套错误带完整路径", () => {
  const s: Schema = {
    t: "object",
    fields: {
      targets: { t: "array", of: { t: "object", fields: { hp: int } } },
    },
  };
  assert.throws(
    () => validate({ targets: [{ hp: 10 }, { hp: "满" }] }, s),
    /\$\.targets\[1\]\.hp/,
  );
});

test("any：只接受 JSON 能表达的值", () => {
  validate({ a: [1, "x", null, true] }, { t: "any" });
  assert.throws(() => validate(undefined, { t: "any" }), /JSON/);
  assert.throws(() => validate(() => 1, { t: "any" }), /JSON/);
  assert.throws(() => validate({ a: undefined }, { t: "any" }), /JSON/);
});

test("嵌套过深直接拒绝", () => {
  let deep: unknown = 1;
  for (let i = 0; i < 20; i++) {
    deep = { next: deep };
  }
  assert.throws(() => validate(deep, { t: "any" }), /嵌套超过/);
});

test("错误对象带 path 字段，方便程序处理", () => {
  try {
    validate({ a: "x" }, { t: "object", fields: { a: int } });
    assert.fail("应该抛错");
  } catch (error) {
    assert.ok(error instanceof SchemaError);
    assert.equal(error.path, "$.a");
  }
});
