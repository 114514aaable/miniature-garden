// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 临时的 node 类型声明。
 *
 * 为什么有它：项目零依赖，还没装 @types/node，而测试要用 node:test / node:assert。
 * 这里只声明用到的部分，够类型检查即可。
 *
 * 将来 `npm i -D @types/node` 之后，删掉这个文件，并在 tsconfig 里去掉 "types": []。
 */

declare module "node:test" {
  export function test(name: string, fn: () => void | Promise<void>): void;
}

declare module "node:assert/strict" {
  interface Assert {
    (value: unknown, message?: string): asserts value;
    ok(value: unknown, message?: string): asserts value;
    equal(actual: unknown, expected: unknown, message?: string): void;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    throws(fn: () => unknown, expected?: RegExp | Error, message?: string): void;
    fail(message?: string): never;
  }

  const assert: Assert;
  export default assert;
}
