# 引用树

> 由 `node tools/gen-tree.mjs` 生成。不含测试文件。

## 分层概览

| 层 | 文件数 |
|---|---|
| 内核 | 39 |
| 系统 | 23 |
| 宿主工具 | 9 |
| 页面脚本 | 3 |

## tools/serve.mjs

```
tools/serve.mjs
  └─ game/engine/core/src/event/effects.ts
    └─ game/engine/core/src/space.ts
    └─ game/engine/core/src/store.ts
      └─ game/engine/core/src/entity/entity.ts
        └─ game/engine/core/src/space.ts  (已展开)
        └─ game/engine/core/src/time.ts
      └─ game/engine/core/src/entity/merge.ts
        └─ game/engine/core/src/time.ts  (已展开)
      └─ game/engine/core/src/entity/place.ts
        └─ game/engine/core/src/entity/entity.ts  (已展开)
      └─ game/engine/core/src/space.ts  (已展开)
      └─ game/engine/core/src/time.ts  (已展开)
    └─ game/engine/core/src/time.ts  (已展开)
  └─ game/engine/core/src/event/evaluate.ts
    └─ game/engine/core/src/event/registry.ts
      └─ game/engine/core/src/event/schema.ts
      └─ game/engine/core/src/time.ts  (已展开)
    └─ game/engine/core/src/event/schema.ts  (已展开)
    └─ game/engine/core/src/event/view.ts
      └─ game/engine/core/src/entity/entity.ts  (已展开)
      └─ game/engine/core/src/entity/merge.ts  (已展开)
      └─ game/engine/core/src/entity/place.ts  (已展开)
      └─ game/engine/core/src/entity/template.ts
        └─ game/engine/core/src/entity/merge.ts  (已展开)
        └─ game/engine/core/src/event/schema.ts  (已展开)
        └─ game/engine/core/src/time.ts  (已展开)
      └─ game/engine/core/src/space.ts  (已展开)
      └─ game/engine/core/src/time.ts  (已展开)
    └─ game/engine/core/src/time.ts  (已展开)
  └─ game/engine/core/src/event/registry.ts  (已展开)
  └─ game/engine/core/src/event/view.ts  (已展开)
  └─ game/engine/core/src/pack/graph.ts
    └─ game/engine/core/src/pack/merge.ts
      └─ game/engine/core/src/pack/manifest.ts
        └─ game/engine/core/src/event/schema.ts  (已展开)
        └─ game/engine/core/src/time.ts  (已展开)
      └─ game/engine/core/src/time.ts  (已展开)
    └─ game/engine/core/src/time.ts  (已展开)
  └─ game/engine/core/src/pack/init.ts
    └─ game/engine/core/src/pack/load.ts
      └─ game/engine/core/src/entity/template.ts  (已展开)
      └─ game/engine/core/src/event/schema.ts  (已展开)
      └─ game/engine/core/src/pack/definitions.ts
        └─ game/engine/core/src/event/schema.ts  (已展开)
        └─ game/engine/core/src/time.ts  (已展开)
      └─ game/engine/core/src/pack/merge.ts  (已展开)
      └─ game/engine/core/src/space.ts  (已展开)
      └─ game/engine/core/src/time.ts  (已展开)
    └─ game/engine/core/src/store.ts  (已展开)
    └─ game/engine/core/src/time.ts  (已展开)
  └─ game/engine/core/src/pack/load.ts  (已展开)
  └─ game/engine/core/src/pack/merge.ts  (已展开)
  └─ game/engine/core/src/pack/order.ts
    └─ game/engine/core/src/pack/manifest.ts  (已展开)
  └─ game/engine/core/src/rules/clock.ts
  └─ game/engine/core/src/rules/pending.ts
    └─ game/engine/core/src/event/evaluate.ts  (已展开)
    └─ game/engine/core/src/event/registry.ts  (已展开)
    └─ game/engine/core/src/time.ts  (已展开)
  └─ game/engine/core/src/rules/scheduler.ts
  └─ game/engine/core/src/store.ts  (已展开)
  └─ game/systems/log/devlog.ts
    └─ game/engine/core/src/time.ts  (已展开)
  └─ game/systems/render/project.ts
    └─ game/engine/core/src/entity/entity.ts  (已展开)
    └─ game/engine/core/src/entity/merge.ts  (已展开)
    └─ game/engine/core/src/entity/template.ts  (已展开)
    └─ game/engine/core/src/space.ts  (已展开)
    └─ game/engine/core/src/time.ts  (已展开)
    └─ game/systems/render/contract.ts
  └─ game/systems/rules/aliases.ts
  └─ game/systems/rules/index.ts
    └─ game/engine/core/src/rules/ai.ts
      └─ game/engine/core/src/event/evaluate.ts  (已展开)
      └─ game/engine/core/src/event/registry.ts  (已展开)
      └─ game/engine/core/src/rules/collision.ts
        └─ game/engine/core/src/event/view.ts  (已展开)
        └─ game/engine/core/src/space.ts  (已展开)
      └─ game/engine/core/src/time.ts  (已展开)
    └─ game/engine/core/src/rules/aim.ts
      └─ game/engine/core/src/event/evaluate.ts  (已展开)
      └─ game/engine/core/src/event/registry.ts  (已展开)
      └─ game/engine/core/src/rules/collision.ts  (已展开)
      └─ game/engine/core/src/time.ts  (已展开)
    └─ game/engine/core/src/rules/enemy-actions.ts
      └─ game/engine/core/src/event/evaluate.ts  (已展开)
      └─ game/engine/core/src/event/registry.ts  (已展开)
      └─ game/engine/core/src/time.ts  (已展开)
    └─ game/engine/core/src/rules/inventory.ts
      └─ game/engine/core/src/event/evaluate.ts  (已展开)
      └─ game/engine/core/src/event/registry.ts  (已展开)
      └─ game/engine/core/src/time.ts  (已展开)
    └─ game/engine/core/src/rules/move.ts
      └─ game/engine/core/src/event/evaluate.ts  (已展开)
      └─ game/engine/core/src/event/registry.ts  (已展开)
      └─ game/engine/core/src/rules/collision.ts  (已展开)
      └─ game/engine/core/src/time.ts  (已展开)
    └─ game/engine/core/src/rules/use.ts
      └─ game/engine/core/src/event/evaluate.ts  (已展开)
      └─ game/engine/core/src/event/registry.ts  (已展开)
      └─ game/engine/core/src/time.ts  (已展开)
    └─ game/engine/core/src/rules/wait.ts
      └─ game/engine/core/src/event/registry.ts  (已展开)
      └─ game/engine/core/src/time.ts  (已展开)
    └─ game/systems/rules/base.ts
      └─ game/engine/core/src/event/evaluate.ts  (已展开)
      └─ game/engine/core/src/event/registry.ts  (已展开)
      └─ game/engine/core/src/rules/attack.ts
        └─ game/engine/core/src/event/evaluate.ts  (已展开)
        └─ game/engine/core/src/event/registry.ts  (已展开)
        └─ game/engine/core/src/time.ts  (已展开)
      └─ game/engine/core/src/rules/pending.ts  (已展开)
      └─ game/engine/core/src/rules/talk.ts
        └─ game/engine/core/src/event/evaluate.ts  (已展开)
        └─ game/engine/core/src/event/registry.ts  (已展开)
        └─ game/engine/core/src/time.ts  (已展开)
      └─ game/engine/core/src/time.ts  (已展开)
  └─ game/systems/scene/dialog.ts
    └─ game/engine/core/src/time.ts  (已展开)
    └─ game/systems/scene/scene.ts
      └─ game/engine/core/src/store.ts  (已展开)
      └─ game/engine/core/src/time.ts  (已展开)
  └─ game/systems/scene/scene.ts  (已展开)
  └─ game/systems/tick/phases.ts
  └─ tools/pack-reader.mjs
    └─ game/engine/core/src/pack/manifest.ts  (已展开)
  └─ tools/pages.mjs
```

## tools/client/game.js

```
tools/client/game.js
  └─ game/systems/config/config.ts
  └─ game/systems/input/bindings.ts
  └─ game/systems/render/browser.ts
    └─ game/systems/camera/camera.ts
    └─ game/systems/intel/facts.ts
      └─ game/engine/core/src/time.ts  (已展开)
    └─ game/systems/intel/overlay.ts
      └─ game/systems/intel/facts.ts  (已展开)
    └─ game/systems/render/atlas.ts
    └─ game/systems/render/draw.ts
      └─ game/systems/render/atlas.ts  (已展开)
      └─ game/systems/render/project.ts  (已展开)
    └─ game/systems/render/project.ts  (已展开)
    └─ game/systems/render/visual.ts
  └─ game/systems/ui/dom.ts
    └─ game/systems/ui/spec.ts
      └─ game/systems/ui/flex.ts
  └─ game/systems/ui/minimap.ts
  └─ game/systems/ui/spec.ts  (已展开)
  └─ tools/client/shared.js
```

## tools/client/launcher.js

```
tools/client/launcher.js
  └─ game/systems/ui/dom.ts  (已展开)
  └─ game/systems/ui/spec.ts  (已展开)
  └─ tools/client/shared.js  (已展开)
```

## tools/client/shared.js

```
└─ tools/client/shared.js  (已展开)
```

## tools/play.mjs

```
tools/play.mjs
  └─ game/engine/core/src/pack/init.ts  (已展开)
  └─ game/engine/core/src/pack/load.ts  (已展开)
  └─ game/engine/core/src/pack/merge.ts  (已展开)
  └─ game/engine/core/src/pack/order.ts  (已展开)
  └─ game/engine/core/src/store.ts  (已展开)
  └─ tools/pack-reader.mjs  (已展开)
```

## tools/build-web.mjs

```
tools/build-web.mjs
```

## 被谁引用（引用数最多的 20 个）

| 文件 | 被引用 |
|---|---|
| `game/engine/core/src/time.ts` | 31 处：`game/engine/core/src/demo-event.ts`, `game/engine/core/src/entity/entity.ts`, `game/engine/core/src/entity/merge.ts`, `game/engine/core/src/entity/template.ts` … |
| `game/engine/core/src/event/registry.ts` | 15 处：`tools/serve.mjs`, `game/engine/core/src/demo-event.ts`, `game/engine/core/src/demo-text.ts`, `game/engine/core/src/event/evaluate.ts` … |
| `game/engine/core/src/event/evaluate.ts` | 13 处：`tools/serve.mjs`, `game/engine/core/src/demo-event.ts`, `game/engine/core/src/demo-text.ts`, `game/engine/core/src/rules/ai.ts` … |
| `game/engine/core/src/space.ts` | 11 处：`game/engine/core/src/demo-event.ts`, `game/engine/core/src/demo-sum.ts`, `game/engine/core/src/demo-text.ts`, `game/engine/core/src/entity/entity.ts` … |
| `game/engine/core/src/store.ts` | 9 处：`tools/play.mjs`, `tools/serve.mjs`, `game/engine/core/src/demo-event.ts`, `game/engine/core/src/demo-sum.ts` … |
| `game/engine/core/src/event/schema.ts` | 6 处：`game/engine/core/src/entity/template.ts`, `game/engine/core/src/event/evaluate.ts`, `game/engine/core/src/event/registry.ts`, `game/engine/core/src/pack/definitions.ts` … |
| `game/engine/core/src/event/view.ts` | 5 处：`tools/serve.mjs`, `game/engine/core/src/demo-event.ts`, `game/engine/core/src/demo-text.ts`, `game/engine/core/src/event/evaluate.ts` … |
| `game/engine/core/src/pack/merge.ts` | 4 处：`tools/play.mjs`, `tools/serve.mjs`, `game/engine/core/src/pack/graph.ts`, `game/engine/core/src/pack/load.ts` |
| `game/engine/core/src/entity/entity.ts` | 4 处：`game/engine/core/src/entity/place.ts`, `game/engine/core/src/event/view.ts`, `game/engine/core/src/store.ts`, `game/systems/render/project.ts` |
| `game/engine/core/src/entity/merge.ts` | 4 处：`game/engine/core/src/entity/template.ts`, `game/engine/core/src/event/view.ts`, `game/engine/core/src/store.ts`, `game/systems/render/project.ts` |
| `game/systems/ui/spec.ts` | 3 处：`tools/client/game.js`, `tools/client/launcher.js`, `game/systems/ui/dom.ts` |
| `game/engine/core/src/pack/manifest.ts` | 3 处：`tools/pack-reader.mjs`, `game/engine/core/src/pack/merge.ts`, `game/engine/core/src/pack/order.ts` |
| `game/engine/core/src/pack/load.ts` | 3 处：`tools/play.mjs`, `tools/serve.mjs`, `game/engine/core/src/pack/init.ts` |
| `game/engine/core/src/event/effects.ts` | 3 处：`tools/serve.mjs`, `game/engine/core/src/demo-event.ts`, `game/engine/core/src/demo-text.ts` |
| `game/systems/render/project.ts` | 3 处：`tools/serve.mjs`, `game/systems/render/browser.ts`, `game/systems/render/draw.ts` |
| `game/engine/core/src/entity/template.ts` | 3 处：`game/engine/core/src/event/view.ts`, `game/engine/core/src/pack/load.ts`, `game/systems/render/project.ts` |
| `game/engine/core/src/rules/collision.ts` | 3 处：`game/engine/core/src/rules/ai.ts`, `game/engine/core/src/rules/aim.ts`, `game/engine/core/src/rules/move.ts` |
| `game/systems/ui/dom.ts` | 2 处：`tools/client/game.js`, `tools/client/launcher.js` |
| `tools/client/shared.js` | 2 处：`tools/client/game.js`, `tools/client/launcher.js` |
| `game/systems/rules/index.ts` | 2 处：`tools/gen-docs.mjs`, `tools/serve.mjs` |

## 没有被引用的文件

- `tools/gen-docs.mjs`
- `tools/gen-tree.mjs`
- `tools/import-csv.mjs`
- `tools/typecheck.mjs`
- `game/engine/core/src/demo-event.ts`
- `game/engine/core/src/demo-sum.ts`
- `game/engine/core/src/demo-text.ts`
- `game/engine/core/src/rules/rng.ts`
- `game/engine/core/src/stencils.ts`
- `game/engine/core/types/node-shim.d.ts`
- `game/systems/i18n/i18n.ts`

> 共 74 个源文件，176 条引用。
