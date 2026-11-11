// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/** 客户端检查器的自测：CSS / 正则不算函数调用，真缺失要报。 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { scanSource, stripNonCode } from "./check-client.mjs";

test("CSS filter 字符串里的函数不算调用", () => {
  const { missing } = scanSource(`
    function draw() {
      const img = document.createElement('img');
      img.style.filter = 'saturate(1.4) sepia(0.3) hue-rotate(-18deg)';
    }
  `);
  assert.deepEqual(missing, []);
});

test("正则字面量不算函数调用", () => {
  const { missing } = scanSource(`
    function pick(event) {
      return event.code.match(/^Digit([1-9])$/);
    }
  `);
  assert.deepEqual(missing, []);
});

test("真的调用了没定义的函数要报出来", () => {
  const { missing } = scanSource(`
    function go() {
      missingFunction(1);
    }
  `);
  assert.ok(missing.some(([name]) => name === "missingFunction"));
});

test("注释里的名字不算", () => {
  const { missing } = scanSource(`
    // ghost() 只是注释
    /* ghost2() 也是 */
    function real() {}
  `);
  assert.deepEqual(missing, []);
});

test("字符串保留换行，行号不漂", () => {
  const stripped = stripNonCode("const a = 'x\\ny';\nfoo();");
  assert.equal(stripped.split("\n").length, 2);
});

test("重复声明仍然能抓到", () => {
  const { duplicates } = scanSource("function a() {}\nfunction a() {}\n");
  assert.equal(duplicates.length, 1);
});
