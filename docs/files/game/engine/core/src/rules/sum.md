# `game/engine/core/src/rules/sum.ts`

## 内容

第一个规则：求和。
它很傻，但地位重要——它是「规则层」的第一个文件，演示了一条完整链路：
输入 → 校验（不合法就当场报错） → 纯函数算出结果 → 翻译成 Effect
规则层只做这三件事。它不碰时间、不碰存储、不知道事件怎么写。
「把结果落到世界里」是 store 的事。
这里有个刻意的映射：把和写进 (a, b) 这个格子。
位置用参数、值用结果，纯粹是为了让「回馈」看得见——不是游戏设计。

行数：59

## 接口

### 函数 `sum`

```ts
function sum(input: SumInput): number
```

### 函数 `sumEffect`

```ts
function sumEffect(input: SumInput, space: number): Effect
```

### 接口 `SumInput`

```ts
interface SumInput {
  readonly a: number;
  readonly b: number;
}
```

### 函数 `validateSum`

```ts
function validateSum(input: SumInput): void
```

## 依赖

- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)

## 被引用

（没有别的文件引用它）
