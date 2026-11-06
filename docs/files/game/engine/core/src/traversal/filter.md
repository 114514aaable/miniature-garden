# `game/engine/core/src/traversal/filter.ts`

## 内容

条件：给定一个实体的组件，判断它算不算目标。
**闭集**——只有布尔组合与字段比较，没有算术、没有变量。
一旦允许算术，它就会长成一门语言；需要算术时写规则。

行数：73

## 接口

### 函数 `componentsOf`

```ts
function componentsOf(condition: Condition, out = new Set<string>()): Set<string>
```

### 类型 `Condition`

```ts
type Condition = | { readonly all: readonly Condition[] } | { readonly any: readonly Condition[] } | { readonly not: Condition } | { readonly component: string; readonly field?: string; readonly eq?: JsonValue; readonly neq?: JsonValue; readonly lt?: number; readonly gt?: number; }
```

### 函数 `matches`

```ts
function matches(condition: Condition, components: Readonly<Record<string, JsonValue>>): boolean
```

## 依赖

- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/engine/core/src/rules/aim.ts`](game/engine/core/src/rules/aim.md)
- [`game/engine/core/src/traversal/select.ts`](game/engine/core/src/traversal/select.md)
- [`game/engine/core/src/traversal/shapes.ts`](game/engine/core/src/traversal/shapes.md)
