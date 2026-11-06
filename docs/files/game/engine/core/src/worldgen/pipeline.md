# `game/engine/core/src/worldgen/pipeline.ts`

生成流水线：把生成算法拆成「一步一个算子」，串起来跑。

## 导出

- `CAVE_LAYER`
- `EntityPlacement`
- `PipelineDeps`
- `Sandbox`
- `SpaceRoom`
- `Step`
- `createSandbox`
- `runPipeline`

## 依赖

- [`game/engine/core/src/worldgen/caves.ts`](game/engine/core/src/worldgen/caves.md)
- [`game/engine/core/src/worldgen/generate.ts`](game/engine/core/src/worldgen/generate.md)
- [`game/engine/core/src/worldgen/layout.ts`](game/engine/core/src/worldgen/layout.md)
- [`game/engine/core/src/worldgen/maze.ts`](game/engine/core/src/worldgen/maze.md)
- [`game/engine/core/src/worldgen/populate.ts`](game/engine/core/src/worldgen/populate.md)
- [`game/engine/core/src/worldgen/rooms.ts`](game/engine/core/src/worldgen/rooms.md)
- [`game/engine/core/src/worldgen/select.ts`](game/engine/core/src/worldgen/select.md)
- [`game/engine/core/src/worldgen/sprawl.ts`](game/engine/core/src/worldgen/sprawl.md)
- [`game/engine/core/src/worldgen/structures.ts`](game/engine/core/src/worldgen/structures.md)
- [`game/engine/core/src/worldgen/tiles.ts`](game/engine/core/src/worldgen/tiles.md)

## 被引用

- [`game/engine/core/src/worldgen/populate.ts`](game/engine/core/src/worldgen/populate.md)
- [`tools/serve.mjs`](tools/serve.md)
