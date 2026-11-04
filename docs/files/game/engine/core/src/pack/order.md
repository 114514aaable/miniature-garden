# `game/engine/core/src/pack/order.ts`

加载顺序：依赖图 + 拓扑排序。

## 导出

- `PackOrderError`
- `orderPacks`
- `satisfies`

## 依赖

- [`game/engine/core/src/pack/manifest.ts`](game/engine/core/src/pack/manifest.md)

## 被引用

- [`tools/check-data.mjs`](tools/check-data.md)
- [`tools/gen-pack-graph.mjs`](tools/gen-pack-graph.md)
- [`tools/gen-world.mjs`](tools/gen-world.md)
- [`tools/play.mjs`](tools/play.md)
- [`tools/serve.mjs`](tools/serve.md)
