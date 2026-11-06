# `game/engine/core/types/node-shim.d.ts`

## 内容

临时的 node 类型声明。
为什么有它：项目零依赖，还没装 @types/node，而测试要用 node:test / node:assert。
这里只声明用到的部分，够类型检查即可。
将来 `npm i -D @types/node` 之后，删掉这个文件，并在 tsconfig 里去掉 "types": []。

行数：48

## 接口

### 函数 `createInterface`

```ts
function createInterface(options: { input: unknown; output: unknown }): Interface; } declare module "node:assert/strict"
```

### 接口 `Interface`

```ts
interface Interface {
  question(query: string): Promise<string>;
  close(): void;
}
```

### 函数 `test`

```ts
function test(name: string, fn: () => void | Promise<void>): void; } /** 演示脚本会用到。装了 @types/node 后删掉。 */ declare const process: { exitCode?: number; argv: string[]; stdin: unknown; stdout: unknown; }; declare module "node:readline/promises"
```

## 依赖

（无）

## 被引用

（没有别的文件引用它）
