# `game/engine/core/src/pack/order.ts`

## 内容

加载顺序：依赖图 + 拓扑排序。
三条原则：
1. 顺序必须是数据的函数，不是磁盘的函数——同层按 id 字典序。
2. 缺依赖、版本不符、成环，都在加载期报错，不猜。
3. provides 只是别名：依赖可以指向别名，但最终解析到真正提供它的包。
版本范围只支持单个比较符（`*` / 精确 / `^` / `~` / `>=` / `<`）。
复合范围（`>=1.0.0 <2.0.0`）留到真有人需要时再加——**语法要窄**。

行数：210

## 接口

### 函数 `orderPacks`

```ts
function orderPacks(packs: readonly PackManifest[]): readonly PackManifest[]
```

### 函数 `satisfies`

```ts
function satisfies(version: string, range: string): boolean
```

## 依赖

- [`game/engine/core/src/pack/manifest.ts`](game/engine/core/src/pack/manifest.md)

## 被引用

- [`tools/check-data.mjs`](tools/check-data.md)
- [`tools/gen-pack-graph.mjs`](tools/gen-pack-graph.md)
- [`tools/gen-world.mjs`](tools/gen-world.md)
- [`tools/play.mjs`](tools/play.md)
- [`tools/serve.mjs`](tools/serve.md)
