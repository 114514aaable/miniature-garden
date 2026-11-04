# `game/engine/core/src/worldgen/generate.ts`

生成一片地形：种子 + 尺寸 + 场参数 + 群系 → 地形号数组。

## 导出

- `FieldConfig`
- `GenerateOptions`
- `GenerateResult`
- `MAX_SIZE`
- `MIN_SIZE`
- `clampSize`
- `generateTerrain`

## 依赖

- [`game/engine/core/src/worldgen/noise.ts`](game/engine/core/src/worldgen/noise.md)
- [`game/engine/core/src/worldgen/select.ts`](game/engine/core/src/worldgen/select.md)

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
