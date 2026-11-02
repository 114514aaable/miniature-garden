// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 包清单的测试：三种包各自的规矩，以及路径安全。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { isManifest, parseManifest } from "./manifest.ts";

function base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: "official.grey-harbor", kind: "base", version: "0.1.0", ...overrides };
}

test("合法的 base 包", () => {
  const m = parseManifest(base({ tags: ["harbor"] }));
  assert.equal(m.id, "official.grey-harbor");
  assert.equal(m.kind, "base");
});

test("包 id 必须带命名空间", () => {
  assert.throws(() => parseManifest(base({ id: "greyharbor" })), /id 非法/);
  assert.throws(() => parseManifest(base({ id: "Official.Grey" })), /id 非法/);
});

test("版本必须是 x.y.z", () => {
  assert.throws(() => parseManifest(base({ version: "1.0" })), /x\.y\.z/);
  assert.throws(() => parseManifest(base({ version: "v1.0.0" })), /x\.y\.z/);
});

test("未知字段默认拒绝", () => {
  assert.throws(() => parseManifest(base({ magic: true })), /未知字段/);
});

test("base 不能扩展别人，也不能依赖别人", () => {
  assert.throws(() => parseManifest(base({ extends: "x.y" })), /base 包不能扩展/);
  assert.throws(() => parseManifest(base({ requires: { "a.b": "^1.0.0" } })), /base 包不能依赖/);
});

test("overlay 必须声明 extends", () => {
  assert.throws(
    () => parseManifest({ id: "player.ww114", kind: "overlay", version: "0.1.0" }),
    /必须声明它扩展哪个世界/,
  );

  const m = parseManifest({
    id: "player.ww114",
    kind: "overlay",
    version: "0.1.0",
    extends: "official.grey-harbor@0.1.0",
    scope: "local",
  });
  assert.equal(m.scope, "local");
});

test("bridge 至少要连接两个包", () => {
  assert.throws(
    () =>
      parseManifest({
        id: "bridge.one",
        kind: "bridge",
        version: "0.1.0",
        requires: { "official.grey-harbor": "^0.1.0" },
      }),
    /至少要连接两个包/,
  );

  const m = parseManifest({
    id: "bridge.two",
    kind: "bridge",
    version: "0.1.0",
    requires: { "official.grey-harbor": "^0.1.0", "official.mine": "^0.1.0" },
  });
  assert.equal(Object.keys(m.requires ?? {}).length, 2);
});

test("依赖的 id 与版本范围都要合法", () => {
  assert.throws(
    () => parseManifest(base({ kind: "overlay", extends: "a.b", requires: { "BAD": "^1.0.0" } })),
    /依赖的包 id 非法/,
  );
  assert.throws(
    () => parseManifest(base({ kind: "overlay", extends: "a.b", requires: { "a.c": "  " } })),
    /版本范围不能为空/,
  );
});

test("包内路径不能是绝对路径，也不能跳出目录", () => {
  assert.throws(() => parseManifest(base({ files: { spaces: ["/etc/passwd"] } })), /相对路径/);
  assert.throws(() => parseManifest(base({ files: { spaces: ["../outside.json"] } })), /跳出包目录/);
  assert.throws(() => parseManifest(base({ files: { entities: ["a/../../b.json"] } })), /跳出包目录/);

  const ok = parseManifest(base({ files: { spaces: ["spaces/dock.json"] } }));
  assert.deepEqual(ok.files?.spaces, ["spaces/dock.json"]);
});

test("isManifest 只做类型判断，不抛错", () => {
  assert.equal(isManifest(base() as never), true);
  assert.equal(isManifest({ id: "x" } as never), false);
});
