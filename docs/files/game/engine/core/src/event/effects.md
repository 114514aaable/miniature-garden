# `game/engine/core/src/event/effects.ts`

## 内容

效果：结果里的「我要改世界」的描述（契约 §9）。
效果是数据，不是函数调用——所以它可以被校验、被记录、被丢弃、被父节点合并。
这里负责最后一段：把求值结果里的 effects 解析成 store 认识的 Effect。
规则：
1. 没有 effects 字段 = 这次求值不改世界；
2. effects 必须是数组，最多 256 条；
3. 每条都要形状正确，未知 kind、未知字段一律拒绝。
解析完不提交——提交是调用方的事。求值器不碰 store。

行数：143

## 接口

### 函数 `collectEffects`

```ts
function collectEffects(value: JsonValue): Effect[]
```

### 常量 `MAX_EFFECTS`

```ts
const MAX_EFFECTS
```

### 函数 `submitEffects`

```ts
function submitEffects(store: Store, effects: readonly Effect[]): void
```

## 依赖

- [`game/engine/core/src/space.ts`](game/engine/core/src/space.md)
- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
