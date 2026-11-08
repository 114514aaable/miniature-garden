# `game/engine/core/src/worldgen/generators/sprawl.ts`

## 内容

散落地牢：房间自由摆放 + 房间图 + 绕路 + 走廊加宽。
1  房间不贴网格：随机中心、随机旋转，互相不重叠
2  房间图：Delaunay 太脆，先用「Gabriel 图」近似（没有第三个房间
落在两点为直径的圆里就连一条边）——天然带环、不偏向最近邻
3  连边：最近门对；但路本身用「带噪声代价的 A*」走，会自然绕
4  走廊：沿路径随机加宽 1 格，再补一层简单的元胞平滑
和 rooms/layout 的区别：那两个贴网格，这个完全不贴。

行数：350

## 接口

### 函数 `placeSprawl`

```ts
function placeSprawl( terrain: number[], width: number, height: number, defs: ReadonlyMap<string, StructureDef>, spec: SprawlSpec, seed: number, terrainIdByCode: ReadonlyMap<string, number>, ): { rooms: SprawlRoom[]; spawns: SpawnRequest[]; warnings: string[]; edges: number }
```

### 接口 `SprawlRoom`

```ts
interface SprawlRoom {
  readonly structure: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly doors: ReadonlyArray<{ readonly x: number; readonly y: number; readonly facing: string }>;
  readonly tags: readonly string[];
}
```

### 接口 `SprawlSpec`

```ts
interface SprawlSpec {
  readonly rooms: readonly string[];
  readonly count?: number;
  readonly tries?: number;
  readonly margin?: number;
  readonly corridor?: string;
  readonly widen?: number;
}
```

## 依赖

- [`game/engine/core/src/worldgen/generators/tiles.ts`](game/engine/core/src/worldgen/generators/tiles.md)
- [`game/engine/core/src/worldgen/random.ts`](game/engine/core/src/worldgen/random.md)
- [`game/engine/core/src/worldgen/structures.ts`](game/engine/core/src/worldgen/structures.md)

## 被引用

- [`game/engine/core/src/worldgen/pipeline.ts`](game/engine/core/src/worldgen/pipeline.md)
