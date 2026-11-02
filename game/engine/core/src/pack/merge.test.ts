// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 合并的测试。
 *
 * 三条主线：不重、可追溯、与顺序无关。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { type PackManifest } from "./manifest.ts";
import { keyOf, mergePacks, type PackContent } from "./merge.ts";

function pack(id: string): PackManifest {
  return { id, kind: "base", version: "1.0.0" };
}

function content(
  id: string,
  definitions: PackContent["definitions"],
  patches: PackContent["patches"] = [],
): PackContent {
  return { pack: pack(id), definitions, patches };
}

test("单包合并：定义进池子，记来源", () => {
  const world = mergePacks([
    content("official.base", [{ kind: "template", id: "npc_guard", data: { hp: 10 } }]),
  ]);

  const def = world.definitions.get(keyOf("template", "npc_guard"));
  assert.equal(def?.origin, "official.base");
  assert.deepEqual(def?.data, { hp: 10 });
  assert.deepEqual(world.provenance, [
    { action: "add", kind: "template", id: "npc_guard", pack: "official.base" },
  ]);
});

test("不同包的不同 id 可以共存", () => {
  const world = mergePacks([
    content("a.one", [{ kind: "template", id: "x", data: 1 }]),
    content("b.two", [{ kind: "template", id: "y", data: 2 }]),
  ]);
  assert.equal(world.definitions.size, 2);
});

test("重复定义直接报错，并指出两个来源", () => {
  assert.throws(
    () =>
      mergePacks([
        content("a.one", [{ kind: "template", id: "x", data: 1 }]),
        content("b.two", [{ kind: "template", id: "x", data: 2 }]),
      ]),
    /定义重复：template\/x（a\.one 与 b\.two）/,
  );
});

test("不同 kind 同名不算冲突", () => {
  const world = mergePacks([
    content("a.one", [
      { kind: "template", id: "x", data: 1 },
      { kind: "space", id: "x", data: 2 },
    ]),
  ]);
  assert.equal(world.definitions.size, 2);
});

test("补丁 replace 生效，并记录谁改的", () => {
  const world = mergePacks([
    content("official.base", [{ kind: "template", id: "npc_guard", data: { hp: 10 } }]),
    content("player.noir", [], [{ op: "replace", kind: "template", id: "npc_guard", data: { hp: 20 } }]),
  ]);

  const def = world.definitions.get(keyOf("template", "npc_guard"));
  assert.deepEqual(def?.data, { hp: 20 });
  assert.equal(def?.origin, "official.base");
  assert.deepEqual(def?.patchedBy, ["player.noir"]);
});

test("两个包都打补丁：后者赢，两个都记账", () => {
  const world = mergePacks([
    content("official.base", [{ kind: "template", id: "x", data: 1 }]),
    content("a.one", [], [{ op: "replace", kind: "template", id: "x", data: 2 }]),
    content("b.two", [], [{ op: "replace", kind: "template", id: "x", data: 3 }]),
  ]);

  const def = world.definitions.get(keyOf("template", "x"));
  assert.deepEqual(def?.data, 3);
  assert.deepEqual(def?.patchedBy, ["a.one", "b.two"]);
});

test("补丁找不到目标就报错", () => {
  assert.throws(
    () => mergePacks([content("a.one", [], [{ op: "replace", kind: "template", id: "ghost", data: 1 }])]),
    /补丁找不到目标/,
  );
});

test("补丁 remove 生效", () => {
  const world = mergePacks([
    content("official.base", [{ kind: "template", id: "x", data: 1 }]),
    content("a.one", [], [{ op: "remove", kind: "template", id: "x" }]),
  ]);
  assert.equal(world.definitions.size, 0);
  assert.equal(world.provenance.at(-1)?.action, "remove");
});

test("同名定义的数据是副本，外部改不到池子里", () => {
  const data = { hp: 10 };
  const world = mergePacks([content("a.one", [{ kind: "template", id: "x", data }])]);
  data.hp = 999;

  assert.deepEqual(world.definitions.get(keyOf("template", "x"))?.data, { hp: 10 });
});

test("哈希只由内容决定，与插入顺序无关", () => {
  const a = mergePacks([
    content("a.one", [{ kind: "template", id: "x", data: 1 }]),
    content("b.two", [{ kind: "template", id: "y", data: 2 }]),
  ]);
  const b = mergePacks([
    content("b.two", [{ kind: "template", id: "y", data: 2 }]),
    content("a.one", [{ kind: "template", id: "x", data: 1 }]),
  ]);
  assert.equal(a.hash, b.hash);
});

test("内容变了，哈希就变", () => {
  const a = mergePacks([content("a.one", [{ kind: "template", id: "x", data: 1 }])]);
  const b = mergePacks([content("a.one", [{ kind: "template", id: "x", data: 2 }])]);
  assert.notEqual(a.hash, b.hash);
});

test("补丁历史也进哈希", () => {
  const base = content("official.base", [{ kind: "template", id: "x", data: 1 }]);
  const a = mergePacks([base]);
  const b = mergePacks([base, content("a.one", [], [{ op: "replace", kind: "template", id: "x", data: 1 }])]);
  assert.notEqual(a.hash, b.hash, "内容一样，但改过就是不同的世界");
});

test("默认策略下，重复定义仍然报错（并提示可以调策略）", () => {
  assert.throws(
    () =>
      mergePacks([
        content("a.one", [{ kind: "template", id: "x", data: 1 }]),
        content("b.two", [{ kind: "template", id: "x", data: 2 }]),
      ]),
    /onConflict/,
  );
});

test("warn：后加载者覆盖，但记一条警告，出处仍然追溯到最初的定义者", () => {
  const world = mergePacks(
    [
      content("a.one", [{ kind: "template", id: "x", data: 1 }]),
      content("b.two", [{ kind: "template", id: "x", data: 2 }]),
    ],
    { onConflict: "warn" },
  );

  const def = world.definitions.get(keyOf("template", "x"));
  assert.deepEqual(def?.data, 2);
  assert.equal(def?.origin, "a.one", "最初的定义者不会被覆盖掉");
  assert.deepEqual(def?.patchedBy, ["b.two"]);
  assert.deepEqual(world.warnings, [
    { kind: "template", id: "x", previousOrigin: "a.one", newOrigin: "b.two" },
  ]);
});

test("override：覆盖但不记警告", () => {
  const world = mergePacks(
    [
      content("a.one", [{ kind: "template", id: "x", data: 1 }]),
      content("b.two", [{ kind: "template", id: "x", data: 2 }]),
    ],
    { onConflict: "override" },
  );

  assert.deepEqual(world.definitions.get(keyOf("template", "x"))?.data, 2);
  assert.deepEqual(world.warnings, []);
});

test("warn / override 也会改变哈希（覆盖过的世界不是原版）", () => {
  const strict = mergePacks([content("a.one", [{ kind: "template", id: "x", data: 1 }])]);
  const overridden = mergePacks(
    [
      content("a.one", [{ kind: "template", id: "x", data: 1 }]),
      content("b.two", [{ kind: "template", id: "x", data: 1 }]),
    ],
    { onConflict: "override" },
  );
  assert.notEqual(strict.hash, overridden.hash);
});
