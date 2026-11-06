# `game/engine/core/src/rules/attack.ts`

## 内容

攻击：相邻 → 扣血 → 血尽则倒。
v0 故意简单：不掷骰、不打部位、不算护甲穿透。
伤害 = 攻击 − 防御，最少 1。
它只产出两种效果：patch 改血，或者 despawn 收尸。
「打不中」以后走命中判定，仍然是规则层的事。

行数：85

## 接口

### 函数 `attackHandler`

```ts
function attackHandler(params: JsonValue, context: EvaluateContext): JsonValue
```

### 常量 `attackSignature`

```ts
const attackSignature: Signature
```

## 依赖

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/rules/base.ts`](game/systems/rules/base.md)
