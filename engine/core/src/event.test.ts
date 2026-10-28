// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 事件日志的测试。
 *
 * 这里最重要的是两条：
 *   1. 同样的内容，算出同样的哈希（规范化 + 确定性）。
 *   2. 改中间一条，链条立刻对不上（可验证）。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { EventLog, type Event, canonicalize, hashText, verifyChain } from "./event.ts";

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
  assert.equal(hashText("").length, 8);
});

test("空日志头部是 0", () => {
  const log = new EventLog();
  assert.equal(log.size, 0);
  assert.equal(log.headHash, "0");
});

test("追加事件：id 自增，头部跟着走", () => {
  const log = new EventLog();
  const a = log.append({ kind: "move" }, 0, 1);
  const b = log.append({ kind: "attack" }, 0, 2);

  assert.equal(a.id, 1);
  assert.equal(b.id, 2);
  assert.equal(a.prevHash, "0");
  assert.equal(b.prevHash, a.hash);
  assert.equal(log.headHash, b.hash);
  assert.equal(log.size, 2);
});

test("两个日志跑同样的内容，得到同样的哈希链", () => {
  const build = (): EventLog => {
    const log = new EventLog();
    log.append({ kind: "move", actor: 1, targets: [2], data: { to: 5 } }, 3, 1);
    log.append({ kind: "attack", actor: 1, targets: [2], data: { part: "arm" } }, 3, 2);
    return log;
  };
  assert.equal(build().headHash, build().headHash);
});

test("内容是副本，外部改数组不影响已写入的事件", () => {
  const log = new EventLog();
  const targets = [1, 2];
  const e = log.append({ kind: "hit", targets }, 0, 1);

  targets.push(3);
  assert.deepEqual(e.targets, [1, 2]);
});

test("未篡改时 verify 返回 -1", () => {
  const log = new EventLog();
  log.append({ kind: "a" }, 0, 1);
  log.append({ kind: "b" }, 1, 1);
  assert.equal(log.verify(), -1);
});

test("all() 返回深拷贝，改它不影响日志", () => {
  const log = new EventLog();
  log.append({ kind: "a", targets: [1] }, 0, 1);

  const copy = log.all() as Event[];
  copy[0] = { ...copy[0], kind: "tampered" };

  assert.equal(log.all()[0].kind, "a");
});

test("篡改中间一条，verify 指出它的位置", () => {
  const log = new EventLog();
  log.append({ kind: "a" }, 0, 1);
  log.append({ kind: "b" }, 1, 1);
  log.append({ kind: "c" }, 2, 1);

  const tampered = log.all() as Event[];
  tampered[1] = { ...tampered[1], kind: "b-tampered" };

  assert.equal(verifyChain(tampered), 1);
});

test("lTick 和 seq 必须是合法整数", () => {
  const log = new EventLog();
  assert.throws(() => log.append({ kind: "a" }, -1, 1), /lTick/);
  assert.throws(() => log.append({ kind: "a" }, 0, 0), /seq/);
  assert.throws(() => log.append({ kind: "a" }, 0.5, 1), /lTick/);
});
