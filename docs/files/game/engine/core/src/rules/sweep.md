# `game/engine/core/src/rules/sweep.ts`

## 内容

横扫：打「自己周围一圈」里所有活着的目标。
形状与过滤都来自 base（around1 / living）——
规则里不出现半径、也不出现组件名。

行数：74

## 接口

### 函数 `sweepHandler`

```ts
function sweepHandler(params: JsonValue, context: EvaluateContext): JsonValue
```

### 常量 `sweepSignature`

```ts
const sweepSignature: Signature
```

## 依赖

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/rules/base.ts`](game/systems/rules/base.md)
