# `game/engine/core/src/rules/ai.ts`

## 内容

敌人 AI：只做「选择」，不做「判定」。
它产出的是**信封**，不是效果——真正的判定还是 core.move / base.attack 做的。
这样敌人和玩家走的是同一条路：同一套规则、同一份日志、同样的回放。
v0 的决策很简单：
相邻 → 打
否则 → 朝玩家走一格（贪心，撞墙就试横向，再不行就等）

行数：115

## 接口

### 函数 `enemyTurnHandler`

```ts
function enemyTurnHandler(params: JsonValue, context: EvaluateContext): JsonValue
```

### 常量 `enemyTurnSignature`

```ts
const enemyTurnSignature: Signature
```

## 依赖

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/rules/collision.ts`](game/engine/core/src/rules/collision.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/rules/index.ts`](game/systems/rules/index.md)
