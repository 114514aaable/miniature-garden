# `game/engine/core/src/rules/pending.ts`

## 内容

挂起动作：现在不做，过几回合再做。
语义只有一条：往 `core.pending` 里写一个信封 + 一个到期时刻，
宿主每 tick 检查一次，到点就求值那个信封。
这样「蓄力」「吟唱」「延迟陷阱」都是同一个机制，不用各写一套。
被打断 = 把 pending 清空（patch 成空），效果自然就不发生了。

行数：94

## 接口

### 函数 `castHandler`

```ts
function castHandler(params: JsonValue, context: EvaluateContext): JsonValue
```

### 常量 `castSignature`

```ts
const castSignature: Signature
```

### 常量 `EMPTY_PENDING`

```ts
const EMPTY_PENDING
```

### 函数 `isActive`

```ts
function isActive(pending: JsonValue | undefined): boolean
```

### 常量 `PENDING`

```ts
const PENDING
```

## 依赖

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/engine/core/src/rules/rest.ts`](game/engine/core/src/rules/rest.md)
- [`game/systems/rules/base.ts`](game/systems/rules/base.md)
- [`tools/serve.mjs`](tools/serve.md)
