# `game/engine/core/src/rules/inventory.ts`

## 内容

物品栏规则：捡起、放下。
两条都只做一件事——改组件：
捡起：物品的 core.place = null，玩家的 core.container.items 里加一个句柄
放下：反过来
没有专门的「拾取效果」。物品栏能成立，靠的就是 core.place 支持 null。

行数：113

## 接口

### 函数 `dropHandler`

```ts
function dropHandler(params: JsonValue, context: EvaluateContext): JsonValue
```

### 常量 `dropSignature`

```ts
const dropSignature: Signature
```

### 函数 `takeHandler`

```ts
function takeHandler(params: JsonValue, context: EvaluateContext): JsonValue
```

### 常量 `takeSignature`

```ts
const takeSignature: Signature
```

## 依赖

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/rules/index.ts`](game/systems/rules/index.md)
