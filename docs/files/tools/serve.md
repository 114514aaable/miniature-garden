# `tools/serve.mjs`

## 内容

调试台 / 启动器（宿主侧）。
分工：
服务端：读包、加载世界、求值规则、生成绘制指令
页面：  只负责画（Canvas + DOM），不碰世界
启动方式：
node tools/serve.mjs                     # 启动器：列出 worlds/ 下的世界
node tools/serve.mjs worlds/a worlds/b   # 直接进某个世界（开发用）

行数：2344

## 接口

（没有导出）
## 依赖

- [`game/engine/core/src/event/effects.ts`](game/engine/core/src/event/effects.md)
- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/event/view.ts`](game/engine/core/src/event/view.md)
- [`game/engine/core/src/pack/graph.ts`](game/engine/core/src/pack/graph.md)
- [`game/engine/core/src/pack/init.ts`](game/engine/core/src/pack/init.md)
- [`game/engine/core/src/pack/load.ts`](game/engine/core/src/pack/load.md)
- [`game/engine/core/src/pack/merge.ts`](game/engine/core/src/pack/merge.md)
- [`game/engine/core/src/pack/order.ts`](game/engine/core/src/pack/order.md)
- [`game/engine/core/src/rules/clock.ts`](game/engine/core/src/rules/clock.md)
- [`game/engine/core/src/rules/pending.ts`](game/engine/core/src/rules/pending.md)
- [`game/engine/core/src/rules/scheduler.ts`](game/engine/core/src/rules/scheduler.md)
- [`game/engine/core/src/space.ts`](game/engine/core/src/space.md)
- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)
- [`game/engine/core/src/traversal/resolve.ts`](game/engine/core/src/traversal/resolve.md)
- [`game/engine/core/src/traversal/select.ts`](game/engine/core/src/traversal/select.md)
- [`game/engine/core/src/traversal/shapes.ts`](game/engine/core/src/traversal/shapes.md)
- [`game/engine/core/src/worldgen/generators/generate.ts`](game/engine/core/src/worldgen/generators/generate.md)
- [`game/engine/core/src/worldgen/pipeline.ts`](game/engine/core/src/worldgen/pipeline.md)
- [`game/engine/core/src/worldgen/variants.ts`](game/engine/core/src/worldgen/variants.md)
- [`game/systems/host/advance.ts`](game/systems/host/advance.md)
- [`game/systems/host/base-rules.ts`](game/systems/host/base-rules.md)
- [`game/systems/host/effects.ts`](game/systems/host/effects.md)
- [`game/systems/host/frames.ts`](game/systems/host/frames.md)
- [`game/systems/host/rules.ts`](game/systems/host/rules.md)
- [`game/systems/host/writes.ts`](game/systems/host/writes.md)
- [`game/systems/log/devlog.ts`](game/systems/log/devlog.md)
- [`game/systems/render/draw.ts`](game/systems/render/draw.md)
- [`game/systems/render/project.ts`](game/systems/render/project.md)
- [`game/systems/render/tree.ts`](game/systems/render/tree.md)
- [`game/systems/rules/aliases.ts`](game/systems/rules/aliases.md)
- [`game/systems/rules/index.ts`](game/systems/rules/index.md)
- [`game/systems/rules/passage.ts`](game/systems/rules/passage.md)
- [`game/systems/scene/dialog.ts`](game/systems/scene/dialog.md)
- [`game/systems/scene/scene.ts`](game/systems/scene/scene.md)
- [`game/systems/tick/phases.ts`](game/systems/tick/phases.md)
- [`tools/pack-reader.mjs`](tools/pack-reader.md)
- [`tools/pages.mjs`](tools/pages.md)
- [`tools/worldgen-structures.mjs`](tools/worldgen-structures.md)

## 被引用

（没有别的文件引用它）
