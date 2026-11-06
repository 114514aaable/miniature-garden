# `tools/worldgen-structures.mjs`

## 内容

读一个世界的「结构」定义（生成期数据，不进运行时加载）。
约定：包目录下 worldgen/structures.json，可以多个包叠加，
后面的包覆盖前面的同名结构；读的时候先把子结构展开、检查引用环。

行数：71

## 接口

### 函数 `loadStructures`

```ts
function loadStructures(worldId)
```

### 函数 `previewStructure`

```ts
function previewStructure(def)
```

## 依赖

- [`game/engine/core/src/worldgen/structures.ts`](game/engine/core/src/worldgen/structures.md)
- [`tools/pack-reader.mjs`](tools/pack-reader.md)

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
