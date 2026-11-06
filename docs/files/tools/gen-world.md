# `tools/gen-world.mjs`

## 内容

生成一张地图（MVP：噪声 → 群系 → 地形号）。
数据全部来自包：
群系      <pack>/biomes.json
生成参数  <world>/world.json 的 generation 块
地形名    <pack>/terrains.json（名字 → 号）
用法：
node tools/gen-world.mjs --world official.normal --seed 42 --size 40x20
node tools/gen-world.mjs --seed 42 --size 40x20 --out spaces/field.json

行数：136

## 接口

（没有导出）
## 依赖

- [`game/engine/core/src/pack/load.ts`](game/engine/core/src/pack/load.md)
- [`game/engine/core/src/pack/merge.ts`](game/engine/core/src/pack/merge.md)
- [`game/engine/core/src/pack/order.ts`](game/engine/core/src/pack/order.md)
- [`game/engine/core/src/worldgen/noise.ts`](game/engine/core/src/worldgen/noise.md)
- [`game/engine/core/src/worldgen/select.ts`](game/engine/core/src/worldgen/select.md)
- [`tools/pack-reader.mjs`](tools/pack-reader.md)

## 被引用

（没有别的文件引用它）
