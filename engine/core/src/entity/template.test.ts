// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 模板注册表与继承的测试。
 *
 * 重点是加载期就把错挡住：写错组件、写错父模板、继承成环。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { type Template, TemplateRegistry } from "./template.ts";

const HEALTH = {
  t: "object",
  fields: { max: { t: "int" }, hp: { t: "int" } },
  optional: ["hp"],
} as const;

const ITEM = {
  t: "object",
  fields: { stack: { t: "int" }, weight: { t: "int" }, use: { t: "str" } },
  optional: ["use"],
} as const;

function registry(): TemplateRegistry {
  const r = new TemplateRegistry();
  r.defineComponent("core.health", HEALTH);
  r.defineComponent("core.ai", { t: "object", fields: { mode: { t: "str" } } });
  r.defineComponent("core.item", ITEM);
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

// ── 继承 ────────────────────────────────────────────────

test("子模板继承父模板的组件", () => {
  const r = registry();
  r.defineTemplate({ id: "item_base", components: { "core.item": { stack: 1, weight: 1 } } });
  r.defineTemplate({ id: "lamp", extends: "item_base", components: { "core.item": { use: "light" } } });

  assert.deepEqual(r.get("lamp").components["core.item"], {
    stack: 1,
    weight: 1,
    use: "light",
  });
});

test("子模板可以覆盖父模板的字段", () => {
  const r = registry();
  r.defineTemplate({ id: "item_base", components: { "core.item": { stack: 1, weight: 1 } } });
  r.defineTemplate({ id: "rope", extends: "item_base", components: { "core.item": { weight: 3 } } });

  assert.deepEqual(r.get("rope").components["core.item"], { stack: 1, weight: 3 });
});

test("多级继承", () => {
  const r = registry();
  r.defineTemplate({ id: "a_base", components: { "core.item": { stack: 1, weight: 1 } } });
  r.defineTemplate({ id: "b_mid", extends: "a_base", components: { "core.item": { weight: 2 } } });
  r.defineTemplate({ id: "c_leaf", extends: "b_mid", components: { "core.item": { use: "x" } } });

  assert.deepEqual(r.get("c_leaf").components["core.item"], { stack: 1, weight: 2, use: "x" });
});

test("继承成环：报错并指出路径", () => {
  const r = registry();
  r.defineTemplate({ id: "a_one", extends: "b_two", components: {} });
  r.defineTemplate({ id: "b_two", extends: "a_one", components: {} });

  assert.throws(() => r.link(), /模板继承成环：a_one → b_two → a_one/);
});

test("父模板不存在：报错并说明谁引用了它", () => {
  const r = registry();
  r.defineTemplate({ id: "lamp", extends: "ghost", components: {} });

  assert.throws(() => r.get("lamp"), /模板不存在：ghost.*lamp/);
});

test("componentNames 把继承来的组件也算进去", () => {
  const r = registry();
  r.defineTemplate({ id: "item_base", components: { "core.item": { stack: 1, weight: 1 } } });
  r.defineTemplate({ id: "lamp", extends: "item_base", components: {} });

  assert.deepEqual(r.componentNames("lamp"), ["core.item"]);
});

test("继承关系进哈希", () => {
  const flat = registry();
  flat.defineTemplate({ id: "lamp", components: { "core.item": { stack: 1, weight: 1 } } });

  const inherited = registry();
  inherited.defineTemplate({ id: "item_base", components: { "core.item": { stack: 1, weight: 1 } } });
  inherited.defineTemplate({ id: "lamp", extends: "item_base", components: {} });

  assert.notEqual(flat.link().hash, inherited.link().hash);
});
