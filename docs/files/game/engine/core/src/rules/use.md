# `game/engine/core/src/rules/use.ts`

## 内容

使用物品：把背包里的东西「用」出去。
效果写在物品上（组件的 `effects`），不写在规则里——
加一种新药水不需要改代码，只需要给它一个 core.use 组件。
占位符只支持三个：
$self  → 物品自己
$actor → 用东西的人
$cell  → 用东西的人所在格（{ space, x, y }）
现在只支持覆盖语义（patch 用 data 整体替换）。相对值（"+5"）以后再加。

行数：106

## 接口

### 常量 `USE_COMPONENT`

```ts
const USE_COMPONENT
```

### 函数 `useHandler`

```ts
function useHandler(params: JsonValue, context: EvaluateContext): JsonValue
```

### 常量 `useSignature`

```ts
const useSignature: Signature
```

### 接口 `UseSpec`

```ts
interface UseSpec {
  readonly effects: readonly JsonValue[];
  readonly consume: boolean;
}
```

## 依赖

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/rules/index.ts`](game/systems/rules/index.md)
