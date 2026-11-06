# `game/engine/core/src/rules/rest.ts`

## 内容

休息：和蓄力同一套机制——点一下挂 pending，到点结算。
激活    0 回合，挂一个 4 回合后的「回血」
中间    玩家自己点等待（客户端会按节奏自动点）
到点    base.rest_finish 结算，回 2 点血
以前它用 time.mode "sequence"，一次跳 4 回合；现在拆成看得见的 4 步。

行数：115

## 接口

### 函数 `restFinishHandler`

```ts
function restFinishHandler(params: JsonValue, context: EvaluateContext): JsonValue
```

### 常量 `restFinishSignature`

```ts
const restFinishSignature: Signature
```

### 函数 `restHandler`

```ts
function restHandler(params: JsonValue, context: EvaluateContext): JsonValue
```

### 常量 `restSignature`

```ts
const restSignature: Signature
```

## 依赖

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/rules/pending.ts`](game/engine/core/src/rules/pending.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/rules/base.ts`](game/systems/rules/base.md)
