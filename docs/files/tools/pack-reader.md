# `tools/pack-reader.mjs`

## 内容

读包工具（宿主侧）：把文件夹变成 PackContent。
和 core 的分工：
core 只认识「已经在内存里的 JSON」；
这个脚本负责读磁盘、拼路径、报「哪个文件坏了」。
文件约定：每个文件是一个定义，或者一个定义数组。
spaces/*.json      { id, width, height, terrain }        kind = space
templates/*.json   { id, components }                    kind = template
entities/*.json    { id, template, space, x, y }         kind = entity（id 只用于合并）
terrains/*.json    { id: "0", name, passable }           kind = terrain
world/*.json       { start, rules, onConflict }          kind = world（id 固定 main）
patches/*.json     补丁数组
用法：
node tools/pack-reader.mjs game/worlds/normal

行数：150

## 接口

### 函数 `readPack`

```ts
function readPack(dir)
```

## 依赖

- [`game/engine/core/src/pack/manifest.ts`](game/engine/core/src/pack/manifest.md)

## 被引用

- [`tools/check-data.mjs`](tools/check-data.md)
- [`tools/gen-pack-graph.mjs`](tools/gen-pack-graph.md)
- [`tools/gen-world.mjs`](tools/gen-world.md)
- [`tools/play.mjs`](tools/play.md)
- [`tools/serve.mjs`](tools/serve.md)
- [`tools/worldgen-structures.mjs`](tools/worldgen-structures.md)
