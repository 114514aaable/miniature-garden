// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 求值器的测试。
 *
 * 覆盖四类：正常求值、后序、各类失败、深度限制。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Space } from "../space.ts";
import { type JsonValue } from "../time.ts";
import { evaluate, type Envelope, type HandlerMap } from "./evaluate.ts";
import { Registry, type LinkTable } from "./registry.ts";
import { createWorldView } from "./view.ts";

function obj(value: JsonValue): Record<string, JsonValue> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("不是对象");
  }
  return value;
}

const NO_PARAMS = { t: "object", fields: {} } as const;
const INT = { t: "int" } as const;

function build(): { link: LinkTable; handlers: HandlerMap } {
  const registry = new Registry();
  registry.define({
    tag: "core.sum",
    params: { t: "object", fields: { a: INT, b: INT } },
    result: INT,
    returnsEffects: false,
    needsTimestamp: false,
  });
  registry.define({
    tag: "core.const",
    params: { t: "object", fields: { v: INT } },
    result: INT,
    returnsEffects: false,
    needsTimestamp: false,
  });
  registry.define({
    tag: "core.add2",
    params: NO_PARAMS,
    result: INT,
    returnsEffects: false,
    needsTimestamp: false,
  });

  const link = registry.link();
  const handlers = new Map<number, (params: JsonValue, ctx: { children: readonly JsonValue[] }) => JsonValue>();

  handlers.set(link.tags.get("core.sum") as number, (params) => {
    const p = obj(params);
    return (p.a as number) + (p.b as number);
  });
  handlers.set(link.tags.get("core.const") as number, (params) => obj(params).v as number);
  handlers.set(link.tags.get("core.add2") as number, (_params, ctx) => {
    return (ctx.children[0] as number) + (ctx.children[1] as number);
  });

  return { link, handlers };
}

function view(): ReturnType<typeof createWorldView> {
  return createWorldView([new Space(1, 4, 4)], { tick: 5 });
}

function envelope(partial: Partial<Envelope> & Pick<Envelope, "id" | "tag" | "params">): Envelope {
  return partial;
}

test("最简单的求值：1 + 1 = 2", () => {
  const { link, handlers } = build();
  const result = evaluate(envelope({ id: 1, tag: "core.sum", params: { a: 1, b: 1 } }), link, handlers as never, view());

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value, 2);
  assert.deepEqual(result.diagnostics, []);
});

test("后序：父节点拿得到子节点的结果", () => {
  const { link, handlers } = build();
  const result = evaluate(
    envelope({
      id: 1,
      tag: "core.add2",
      params: {},
      children: [
        { id: 2, tag: "core.const", params: { v: 2 } },
        { id: 3, tag: "core.const", params: { v: 3 } },
      ],
    }),
    link,
    handlers as never,
    view(),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value, 5);
});

test("未注册的标签失败，并给出诊断", () => {
  const { link, handlers } = build();
  const result = evaluate(envelope({ id: 1, tag: "nope.nope", params: {} }), link, handlers as never, view());

  assert.equal(result.ok, false);
  assert.match(result.diagnostics[0].message, /未注册/);
});

test("注册了但没有处理器，失败", () => {
  const { link } = build();
  const result = evaluate(envelope({ id: 1, tag: "core.sum", params: { a: 1, b: 1 } }), link, new Map(), view());

  assert.equal(result.ok, false);
  assert.match(result.diagnostics[0].message, /没有处理器/);
});

test("参数不合法时，处理器根本不会被调用", () => {
  const { link, handlers } = build();
  const result = evaluate(envelope({ id: 1, tag: "core.sum", params: { a: "x", b: 1 } }), link, handlers as never, view());

  assert.equal(result.ok, false);
  assert.match(result.diagnostics[0].message, /\$params\.a/);
});

test("子节点失败，父节点也失败", () => {
  const { link, handlers } = build();
  const result = evaluate(
    envelope({
      id: 1,
      tag: "core.add2",
      params: {},
      children: [
        { id: 2, tag: "core.const", params: { v: 2 } },
        { id: 3, tag: "core.const", params: { v: "x" } },
      ],
    }),
    link,
    handlers as never,
    view(),
  );

  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.length >= 2, "子节点和父节点各有一条诊断");
  assert.match(result.diagnostics.at(-1)?.message ?? "", /子节点 3/);
});

test("处理器抛异常也会被捕获成诊断", () => {
  const { link } = build();
  const handlers = new Map<number, () => JsonValue>();
  handlers.set(link.tags.get("core.sum") as number, () => {
    throw new Error("炸了");
  });

  const result = evaluate(envelope({ id: 1, tag: "core.sum", params: { a: 1, b: 1 } }), link, handlers as never, view());
  assert.equal(result.ok, false);
  assert.match(result.diagnostics[0].message, /炸了/);
});

test("返回值类型不对，失败", () => {
  const { link } = build();
  const handlers = new Map<number, () => JsonValue>();
  handlers.set(link.tags.get("core.sum") as number, () => "不是整数");

  const result = evaluate(envelope({ id: 1, tag: "core.sum", params: { a: 1, b: 1 } }), link, handlers as never, view());
  assert.equal(result.ok, false);
  assert.match(result.diagnostics[0].message, /\$result/);
});

test("深度超限失败", () => {
  const { link, handlers } = build();
  const deep: Envelope = {
    id: 1,
    tag: "core.add2",
    params: {},
    children: [
      {
        id: 2,
        tag: "core.add2",
        params: {},
        children: [
          {
            id: 3,
            tag: "core.add2",
            params: {},
            children: [
              { id: 4, tag: "core.const", params: { v: 1 } },
              { id: 5, tag: "core.const", params: { v: 1 } },
            ],
          },
          { id: 6, tag: "core.const", params: { v: 1 } },
        ],
      },
      { id: 7, tag: "core.const", params: { v: 1 } },
    ],
  };

  const result = evaluate(deep, link, handlers as never, view(), { maxDepth: 2 });
  assert.equal(result.ok, false);
  assert.match(result.diagnostics[0].message, /深度上限/);
});

test("深度上限必须在 1..8 之间", () => {
  const { link, handlers } = build();
  const e = envelope({ id: 1, tag: "core.sum", params: { a: 1, b: 1 } });
  assert.throws(() => evaluate(e, link, handlers as never, view(), { maxDepth: 0 }), /深度上限/);
  assert.throws(() => evaluate(e, link, handlers as never, view(), { maxDepth: 9 }), /深度上限/);
});
