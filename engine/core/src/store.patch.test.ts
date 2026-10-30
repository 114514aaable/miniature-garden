// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * patch 效果的测试：改组件、只改覆盖、失败能回滚。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { TemplateRegistry } from "./entity/template.ts";
import { createWorldView } from "./event/view.ts";
import { Space } from "./space.ts";
import { Store } from "./store.ts";

function setup() {
  const space = new Space(1, 4, 4);

  const templates = new TemplateRegistry();
  templates.defineComponent("core.health", {
    t: "object",
    fields: { max: { t: "int" }, hp: { t: "int" } },
    optional: ["hp"],
  });
  templates.defineTemplate({ id: "pc", components: { "core.health": { max: 20, hp: 20 } } });

  const store = new Store([space], { templates });

  store.submit({ kind: "spawn", space: 1, cell: { x: 1, y: 1 }, template: "pc" });
  const handle = store.step()[0].data.handle as number;

  return { space, templates, store, handle };
}

function componentsOf(space: Space, templates: TemplateRegistry, store: Store, handle: number) {
  const view = createWorldView([space], {
    tick: store.now(),
    entities: { get: (h) => store.entity(h) },
    templates,
  });
  return view.entity(handle).components;
}

test("patch 改组件：只写覆盖，模板默认值还在", () => {
  const { space, templates, store, handle } = setup();

  store.submit({ kind: "patch", handle, component: "core.health", data: { hp: 7 } });
  store.step();

  assert.deepEqual(store.entity(handle).overrides["core.health"], { hp: 7 });
  assert.deepEqual(componentsOf(space, templates, store, handle)["core.health"], { max: 20, hp: 7 });
});

test("连续 patch 会深合并", () => {
  const { space, templates, store, handle } = setup();

  store.submit({ kind: "patch", handle, component: "core.health", data: { max: 30 } });
  store.step();
  store.submit({ kind: "patch", handle, component: "core.health", data: { hp: 3 } });
  store.step();

  assert.deepEqual(componentsOf(space, templates, store, handle)["core.health"], { max: 30, hp: 3 });
});

test("patch 会给不存在的组件报错，不凭空造组件", () => {
  const { store, handle } = setup();

  store.submit({ kind: "patch", handle, component: "core.mana", data: { value: 5 } });
  assert.throws(() => store.step(), /没有组件 core\.mana/);
});

test("patch 失败时整体回滚（实体表快照）", () => {
  const { store, handle } = setup();

  store.submit({ kind: "patch", handle, component: "core.health", data: { hp: 1 } });
  store.submit({ kind: "patch", handle, component: "core.mana", data: { value: 9 } });

  assert.throws(() => store.step(), /没有组件 core\.mana/);
  assert.deepEqual(store.entity(handle).overrides["core.health"], undefined, "血量必须回到原样");
});

test("patch 会进事件日志", () => {
  const { store, handle } = setup();

  store.submit({ kind: "patch", handle, component: "core.health", data: { hp: 5 } });
  const events = store.step();

  assert.equal(events[0].kind, "patch");
  assert.equal(events[0].data.component, "core.health");
  assert.deepEqual(events[0].data.value, { hp: 5 });
});
