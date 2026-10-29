// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 模板注册表的测试。
 *
 * 重点是：模板里写错东西必须在加载期就炸，而不是等到玩的时候「没生效」。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { type Template, TemplateRegistry } from "./template.ts";

const HEALTH = { t: "object", fields: { max: { t: "int" }, hp: { t: "int" } }, optional: ["hp"] } as const;

function registry(): TemplateRegistry {
  const r = new TemplateRegistry();
  r.defineComponent("core.health", HEALTH);
  r.defineComponent("core.ai", { t: "object", fields: { mode: { t: "str" } } });
  return r;
}

function guard(overrides: Partial<Template> = {}): Template {
  return { id: "npc_guard", components: { "core.health": { max: 20 } }, ...overrides };
}

test("登记组件与模板", () => {
  const r = registry();
  r.defineTemplate(guard());
  assert.equal(r.has("npc_guard"), true);
  assert.deepEqual(r.get("npc_guard").components["core.health"], { max: 20 });
});

test("组件名必须带命名空间", () => {
  const r = new TemplateRegistry();
  assert.throws(() => r.defineComponent("health", { t: "int" }), /组件名非法/);
});

test("组件重复登记报错", () => {
  const r = registry();
  assert.throws(() => r.defineComponent("core.health", { t: "int" }), /重复/);
});

test("模板用了没登记的组件：报错", () => {
  const r = registry();
  assert.throws(
    () => r.defineTemplate({ id: "npc_x", components: { "core.magic": { a: 1 } } }),
    /未登记的组件/,
  );
});

test("模板数据不符合 schema：加载期就炸，带路径", () => {
  const r = registry();
  assert.throws(
    () => r.defineTemplate({ id: "npc_x", components: { "core.health": { max: "二十" } } }),
    /\$npc_x\.core\.health\.max/,
  );
});

test("模板 id 非法报错", () => {
  const r = registry();
  assert.throws(() => r.defineTemplate({ id: "Npc!", components: {} }), /模板 id 非法/);
});

test("模板重复登记报错", () => {
  const r = registry();
  r.defineTemplate(guard());
  assert.throws(() => r.defineTemplate(guard()), /重复/);
});

test("get 返回副本，改它不影响注册表", () => {
  const r = registry();
  r.defineTemplate(guard());

  const copy = r.get("npc_guard") as { components: Record<string, unknown> };
  copy.components["core.health"] = { max: 999 };

  assert.deepEqual(r.get("npc_guard").components["core.health"], { max: 20 });
});

test("不存在的模板报错", () => {
  const r = registry();
  assert.throws(() => r.get("nobody"), /模板不存在/);
});

test("链接哈希与登记顺序无关", () => {
  const a = registry();
  a.defineTemplate(guard());
  a.defineTemplate({ id: "npc_salt", components: { "core.health": { max: 10 } } });

  const b = registry();
  b.defineTemplate({ id: "npc_salt", components: { "core.health": { max: 10 } } });
  b.defineTemplate(guard());

  assert.equal(a.link().hash, b.link().hash);
});

test("内容变了，哈希就变", () => {
  const a = registry();
  a.defineTemplate(guard());

  const b = registry();
  b.defineTemplate(guard({ components: { "core.health": { max: 30 } } }));

  assert.notEqual(a.link().hash, b.link().hash);
});
