# `game/engine/core/src/time.ts`

时间线：一个单调的时钟 + 它自己的记录。

## 导出

- `Handle`
- `JsonValue`
- `LogEntry`
- `LogEntryInput`
- `Tick`
- `Timeline`
- `canonicalize`
- `hashText`
- `verifyChain`

## 依赖

（无）

## 被引用

- [`game/engine/core/src/entity/entity.ts`](game/engine/core/src/entity/entity.md)
- [`game/engine/core/src/entity/merge.ts`](game/engine/core/src/entity/merge.md)
- [`game/engine/core/src/entity/template.ts`](game/engine/core/src/entity/template.md)
- [`game/engine/core/src/event/effects.ts`](game/engine/core/src/event/effects.md)
- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/event/view.ts`](game/engine/core/src/event/view.md)
- [`game/engine/core/src/pack/definitions.ts`](game/engine/core/src/pack/definitions.md)
- [`game/engine/core/src/pack/graph.ts`](game/engine/core/src/pack/graph.md)
- [`game/engine/core/src/pack/init.ts`](game/engine/core/src/pack/init.md)
- [`game/engine/core/src/pack/load.ts`](game/engine/core/src/pack/load.md)
- [`game/engine/core/src/pack/manifest.ts`](game/engine/core/src/pack/manifest.md)
- [`game/engine/core/src/pack/merge.ts`](game/engine/core/src/pack/merge.md)
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
- [`game/engine/core/src/rules/wait.ts`](game/engine/core/src/rules/wait.md)
- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)
- [`game/engine/core/src/traversal/filter.ts`](game/engine/core/src/traversal/filter.md)
- [`game/engine/core/src/traversal/select.ts`](game/engine/core/src/traversal/select.md)
- [`game/engine/core/src/traversal/shapes.ts`](game/engine/core/src/traversal/shapes.md)
- [`game/systems/intel/facts.ts`](game/systems/intel/facts.md)
- [`game/systems/log/devlog.ts`](game/systems/log/devlog.md)
- [`game/systems/render/project.ts`](game/systems/render/project.md)
- [`game/systems/rules/base.ts`](game/systems/rules/base.md)
- [`game/systems/scene/dialog.ts`](game/systems/scene/dialog.md)
- [`game/systems/scene/scene.ts`](game/systems/scene/scene.md)
