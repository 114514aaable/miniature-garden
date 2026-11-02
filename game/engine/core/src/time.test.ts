// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 时间线的测试。
 *
 * 一半测「不能做什么」：不能倒退、不能走半步、不能自己填时间。
 * 另一半测「记录是否可信」：同样输入同样哈希，改一条立刻被发现。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Timeline, type LogEntry, canonicalize, hashText, verifyChain } from "./time.ts";

// ── 时钟部分 ────────────────────────────────────────────

test("默认从 0 开始", () => {
  assert.equal(new Timeline().now(), 0);
});

test("可以从指定刻度恢复（读档）", () => {
  assert.equal(new Timeline(42).now(), 42);
});

test("advance 前进并返回新值，可以一次走多步", () => {
  const t = new Timeline(10);
  assert.equal(t.advance(), 11);
  assert.equal(t.advance(5), 16);
  assert.equal(t.now(), 16);
});

test("只能前进正整数；报错后刻度不变", () => {
  const t = new Timeline(3);
  assert.throws(() => t.advance(0), /正整数/);
  assert.throws(() => t.advance(-1), /正整数/);
  assert.throws(() => t.advance(1.5), /正整数/);
  assert.equal(t.now(), 3);
});

test("起点不能是负数或小数", () => {
  assert.throws(() => new Timeline(-1), /非负整数/);
  assert.throws(() => new Timeline(1.5), /非负整数/);
});

test("两条时间线互不影响（没有全局现在）", () => {
  const a = new Timeline();
  const b = new Timeline();
  a.advance(10);
  assert.equal(a.now(), 10);
  assert.equal(b.now(), 0);
});

test("连续前进严格递增", () => {
  const t = new Timeline();
  const seen: number[] = [];
  for (let i = 0; i < 5; i++) {
    seen.push(t.advance());
  }
  assert.deepEqual(seen, [1, 2, 3, 4, 5]);
});

// ── 记录部分 ────────────────────────────────────────────

test("规范化：键顺序不影响结果", () => {
  assert.equal(canonicalize({ b: 2, a: 1 }), canonicalize({ a: 1, b: 2 }));
  assert.equal(canonicalize({ a: 1, b: 2 }), '{"a":1,"b":2}');
});

test("规范化：嵌套与数组", () => {
  assert.equal(canonicalize({ a: [1, { z: 1, y: 2 }] }), '{"a":[1,{"y":2,"z":1}]}');
});

test("哈希：同样文本同样结果，不同文本不同结果", () => {
  assert.equal(hashText("abc"), hashText("abc"));
  assert.notEqual(hashText("abc"), hashText("abd"));
});

test("空日志头部是 0", () => {
  const t = new Timeline();
  assert.equal(t.size, 0);
  assert.equal(t.headHash, "0");
});

test("事件时间戳由时间线自己盖：lTick = now", () => {
  const t = new Timeline(7);
  const e = t.append({ kind: "move" });
  assert.equal(e.lTick, 7);
  assert.equal(e.seq, 1);
});

test("同一个 tick 内 seq 递增，advance 后重置", () => {
  const t = new Timeline();
  const a = t.append({ kind: "a" });
  const b = t.append({ kind: "b" });
  assert.equal(a.seq, 1);
  assert.equal(b.seq, 2);

  t.advance();
  const c = t.append({ kind: "c" });
  assert.equal(c.lTick, 1);
  assert.equal(c.seq, 1, "新 tick 里序号从头开始");
});

test("id 自增，头部跟着走", () => {
  const t = new Timeline();
  const a = t.append({ kind: "move" });
  const b = t.append({ kind: "attack" });

  assert.equal(a.id, 1);
  assert.equal(b.id, 2);
  assert.equal(a.prevHash, "0");
  assert.equal(b.prevHash, a.hash);
  assert.equal(t.headHash, b.hash);
});

test("两条时间线跑同样的内容，得到同样的哈希链", () => {
  const build = (): Timeline => {
    const t = new Timeline(3);
    t.append({ kind: "move", actor: 1, targets: [2], data: { to: 5 } });
    t.append({ kind: "attack", actor: 1, targets: [2], data: { part: "arm" } });
    return t;
  };
  assert.equal(build().headHash, build().headHash);
});

test("targets 是副本，外部改数组不影响已写入的事件", () => {
  const t = new Timeline();
  const targets = [1, 2];
  const e = t.append({ kind: "hit", targets });
  targets.push(3);
  assert.deepEqual(e.targets, [1, 2]);
});

test("all() 返回深拷贝，改它不影响日志", () => {
  const t = new Timeline();
  t.append({ kind: "a" });
  const copy = t.all() as LogEntry[];
  copy[0] = { ...copy[0], kind: "tampered" };
  assert.equal(t.all()[0].kind, "a");
});

test("未篡改时 verify 返回 -1", () => {
  const t = new Timeline();
  t.append({ kind: "a" });
  t.advance();
  t.append({ kind: "b" });
  assert.equal(t.verify(), -1);
});

test("篡改中间一条，verifyChain 指出它的位置", () => {
  const t = new Timeline();
  t.append({ kind: "a" });
  t.advance();
  t.append({ kind: "b" });
  t.advance();
  t.append({ kind: "c" });

  const tampered = t.all() as LogEntry[];
  tampered[1] = { ...tampered[1], kind: "b-tampered" };
  assert.equal(verifyChain(tampered), 1);
});
