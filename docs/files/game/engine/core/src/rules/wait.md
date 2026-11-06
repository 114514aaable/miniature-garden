# `game/engine/core/src/rules/wait.ts`

## 内容

等待：什么都不做，只让时间走。
为什么必须有它：敌人的前摇要 2 回合才结算。如果玩家没有「空过一回合」的手段，
就只能靠移动或攻击顺便把时间推过去——那等于被迫行动，前摇也就不成立了。
它不产生任何效果，成本由 clock 决定（默认 4 回合）。

行数：28

## 接口

### 函数 `waitHandler`

```ts
function waitHandler(_params: JsonValue): JsonValue
```

### 常量 `waitSignature`

```ts
const waitSignature: Signature
```

## 依赖

- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/rules/index.ts`](game/systems/rules/index.md)
