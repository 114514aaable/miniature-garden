# `game/engine/core/src/rules/aim.ts`

## 内容

指向：鼠标/键盘选一个格子，问「这个技能能不能落在这里」。
刻意做成通用的：它不认识具体技能，只认三件事：
kind   要「有东西」还是「空地」
range  最远几格
cell   目标格
技能那边声明自己的 target（kind/range），客户端把它填进来。
这样别的世界包换一套技能，指针逻辑不用改。

行数：91

## 接口

### 函数 `aimHandler`

```ts
function aimHandler(params: JsonValue, context: EvaluateContext): JsonValue
```

### 常量 `aimSignature`

```ts
const aimSignature: Signature
```

## 依赖

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/rules/collision.ts`](game/engine/core/src/rules/collision.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)
- [`game/engine/core/src/traversal/filter.ts`](game/engine/core/src/traversal/filter.md)

## 被引用

- [`game/systems/rules/index.ts`](game/systems/rules/index.md)
