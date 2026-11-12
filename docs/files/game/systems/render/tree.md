# `game/systems/render/tree.ts`

## 内容

资产树：一张（或多张）大图集 + 一个树文件。
树里的目录有两种：
branch  纯逻辑分组，子节点可以跨页
page    对应一张图集页，子节点是「页内矩形」
叶子有两种：
{ x, y, w, h }                 已编码：页内矩形
{ file, w, h }                 热生成：还没进图集的单文件
调用名 = 路径（terrain.floor / entity.rat.idle）。

行数：192

## 接口

### 接口 `AssetPage`

```ts
interface AssetPage {
  readonly id: string;
  readonly image: string;
  readonly width: number;
  readonly height: number;
}
```

### 接口 `AssetTree`

```ts
interface AssetTree {
  readonly pages: ReadonlyMap<string, AssetPage>;
  readonly leaves: ReadonlyMap<string, TreeLeaf>;
  readonly files: ReadonlyMap<string, FileLeaf>;
}
```

### 接口 `FileLeaf`

```ts
interface FileLeaf {
  readonly path: string;
  readonly file: string;
  readonly w: number;
  readonly h: number;
}
```

### 函数 `parseAssetTree`

```ts
function parseAssetTree(raw: unknown, path = "$tree"): AssetTree
```

### 函数 `spriteOf`

```ts
function spriteOf( tree: AssetTree, path: string, ): { sheet: string; frame: string } |
```

### 函数 `treeAtlases`

```ts
function treeAtlases(tree: AssetTree): Map<string, unknown>
```

### 接口 `TreeLeaf`

```ts
interface TreeLeaf {
  readonly path: string;
  readonly page: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
```

## 依赖

（无）

## 被引用

- [`tools/encode-assets.mjs`](tools/encode-assets.md)
- [`tools/encode-assets.test.mjs`](tools/encode-assets.test.md)
- [`tools/serve.mjs`](tools/serve.md)
