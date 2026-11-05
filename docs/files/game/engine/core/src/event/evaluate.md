# `game/engine/core/src/event/evaluate.ts`

求值器：把一棵信封树跑成结果。

## 导出

- `DEFAULT_MAX_DEPTH`
- `Diagnostic`
- `Envelope`
- `EvaluateContext`
- `EvaluateOptions`
- `EvaluateResult`
- `Frame`
- `HARD_MAX_DEPTH`
- `Handler`
- `HandlerMap`
- `ObjectRef`
- `RuleTools`
- `evaluate`

## 依赖

- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/event/schema.ts`](game/engine/core/src/event/schema.md)
- [`game/engine/core/src/event/view.ts`](game/engine/core/src/event/view.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/engine/core/src/rules/ai.ts`](game/engine/core/src/rules/ai.md)
- [`game/engine/core/src/rules/aim.ts`](game/engine/core/src/rules/aim.md)
- [`game/engine/core/src/rules/attack.ts`](game/engine/core/src/rules/attack.md)
- [`game/engine/core/src/rules/enemy-actions.ts`](game/engine/core/src/rules/enemy-actions.md)
- [`game/engine/core/src/rules/inventory.ts`](game/engine/core/src/rules/inventory.md)
- [`game/engine/core/src/rules/move.ts`](game/engine/core/src/rules/move.md)
- [`game/engine/core/src/rules/pending.ts`](game/engine/core/src/rules/pending.md)
- [`game/engine/core/src/rules/rest.ts`](game/engine/core/src/rules/rest.md)
- [`game/engine/core/src/rules/sweep.ts`](game/engine/core/src/rules/sweep.md)
- [`game/engine/core/src/rules/talk.ts`](game/engine/core/src/rules/talk.md)
- [`game/engine/core/src/rules/use.ts`](game/engine/core/src/rules/use.md)
- [`game/systems/rules/base.ts`](game/systems/rules/base.md)
- [`tools/serve.mjs`](tools/serve.md)
