// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 注册表的测试。
 *
 * 核心那条：**登记顺序不影响链接结果**。
 * 它保证同一个世界包在任何机器上得到同一套编号和同一个哈希。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Registry, type Signature } from "./registry.ts";

function sig(tag: string, overrides: Partial<Signature> = {}): Signature {
  return {
    tag,
    params: { t: "object", fields: { a: { t: "int" } } },
    result: { t: "int" },
    returnsEffects: false,
    needsTimestamp: false,
    ...overrides,
  };
}

test("登记后能查到", () => {
  const r = new Registry();
  r.define(sig("core.sum"));
  assert.equal(r.has("core.sum"), true);
  assert.equal(r.has("core.missing"), false);
});

test("同一个标签登记两次直接报错", () => {
  const r = new Registry();
  r.define(sig("core.sum"));
  assert.throws(() => r.define(sig("core.sum")), /重复登记/);
});

test("标签格式非法直接报错", () => {
  const r = new Registry();
  assert.throws(() => r.define(sig("sum")), /格式非法/);
  assert.throws(() => r.define(sig("Core.Sum")), /格式非法/);
  assert.throws(() => r.define(sig("a.b.c.d.e")), /格式非法/);
});

test("链接按字典序分配编号", () => {
  const r = new Registry();
  r.define(sig("world.weather"));
  r.define(sig("core.move"));
  r.define(sig("core.attack"));

  const table = r.link();
  assert.equal(table.tags.get("core.attack"), 0);
  assert.equal(table.tags.get("core.move"), 1);
  assert.equal(table.tags.get("world.weather"), 2);
  assert.equal(table.signatures[0].tag, "core.attack");
});

test("登记顺序不影响哈希（可复现）", () => {
  const a = new Registry();
  a.define(sig("core.move"));
  a.define(sig("core.attack"));

  const b = new Registry();
  b.define(sig("core.attack"));
  b.define(sig("core.move"));

  assert.equal(a.link().hash, b.link().hash);
});

test("签名内容变了，哈希就变", () => {
  const base = new Registry();
  base.define(sig("core.move"));

  const changed = new Registry();
  changed.define(sig("core.move", { needsTimestamp: true }));

  assert.notEqual(base.link().hash, changed.link().hash);
});

test("重复链接结果稳定", () => {
  const r = new Registry();
  r.define(sig("core.move"));
  assert.equal(r.link().hash, r.link().hash);
});

test("技能元数据会保留在链接表里，并参与哈希", () => {
  const withSkill = new Registry();
  withSkill.define(
    sig("core.move", {
      skill: { name: "走一步", cost: "move", target: { kind: "cell", range: 1 } },
    }),
  );

  const table = withSkill.link();
  assert.equal(table.signatures[0].skill?.name, "走一步");
  assert.equal(table.signatures[0].skill?.target.kind, "cell");

  const bare = new Registry();
  bare.define(sig("core.move"));
  assert.notEqual(withSkill.link().hash, bare.link().hash, "技能信息也是世界的一部分");
});

test("技能元数据不合格时拒绝登记", () => {
  const r = new Registry();
  assert.throws(
    () => r.define(sig("core.a", { skill: { name: "", cost: "x", target: { kind: "self", range: 0 } } })),
    /缺少名字/,
  );
  assert.throws(
    () => r.define(sig("core.b", { skill: { name: "x", cost: "x", target: { kind: "cell", range: 99 } } })),
    /射程/,
  );
});

test("链接表里能按编号找回签名", () => {
  const r = new Registry();
  r.define(sig("core.move", { returnsEffects: true }));

  const table = r.link();
  const sym = table.tags.get("core.move");
  assert.equal(sym, 0);
  assert.equal(table.signatures[0].returnsEffects, true);
});
