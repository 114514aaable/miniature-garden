# `game/engine/core/src/rules/enemy-actions.ts`

## 内容

敌人的三个动作：起手、命中、走位。
关键设计：**意图是数据**（core.intent 组件），不是画出来的。
命中判定读它，渲染也读它——所以「画的和打的」永远不会错位。
玩家在 resolveAt 之前走开，就真的躲掉。

行数：143

## 接口

### 函数 `strikeHandler`

```ts
function strikeHandler(params: JsonValue, context: EvaluateContext): JsonValue
```

### 常量 `strikeSignature`

```ts
const strikeSignature: Signature
```

### 函数 `windupHandler`

```ts
function windupHandler(params: JsonValue, context: EvaluateContext): JsonValue
```

### 常量 `windupSignature`

```ts
const windupSignature: Signature
```

## 依赖

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/rules/index.ts`](game/systems/rules/index.md)
