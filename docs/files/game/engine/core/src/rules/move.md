# `game/engine/core/src/rules/move.ts`

## 内容

第一条真规则：走一格。
它做的事：检查目标格能不能走，然后产出一个 move 效果。
它不做的事：不判输赢、不花 AP、不碰世界——那些以后再说。
拒绝（墙、有人、斜走）不走异常，而是返回 { ok: false, reason }。
「规则说不行」和「规则崩了」是两回事，不能混。

行数：73

## 接口

### 函数 `moveHandler`

```ts
function moveHandler(params: JsonValue, context: EvaluateContext): JsonValue
```

### 常量 `moveSignature`

```ts
const moveSignature: Signature
```

## 依赖

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/rules/collision.ts`](game/engine/core/src/rules/collision.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/rules/index.ts`](game/systems/rules/index.md)
