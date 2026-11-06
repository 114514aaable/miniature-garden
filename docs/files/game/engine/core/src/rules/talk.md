# `game/engine/core/src/rules/talk.ts`

## 内容

交谈：和「劈砍」一样是一条技能——有目标、有射程、能进快捷栏。
它不产生效果，而是返回一个**场景意图**：
{ ok: true, scene: { op: "push", id: "dialog", params: { script, speaker } } }
宿主拿到 `scene` 才真正压场景——规则不碰场景栈，和「规则不碰 store」一致。

行数：64

## 接口

### 函数 `talkHandler`

```ts
function talkHandler(params: JsonValue, context: EvaluateContext): JsonValue
```

### 常量 `talkSignature`

```ts
const talkSignature: Signature
```

## 依赖

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/rules/base.ts`](game/systems/rules/base.md)
