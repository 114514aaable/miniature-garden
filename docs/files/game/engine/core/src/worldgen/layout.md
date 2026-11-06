# `game/engine/core/src/worldgen/layout.ts`

## 内容

布局：在 meta 网格上摆「房间」和「走廊」，边决定门口。
节点   一个 meta 格；成片的格子可以是一间大房间
边     相邻格之间要不要通（先做生成树，再补环路）
房间   程序化：内部地板 + 一圈墙 + 边上开门
走廊   单格，用 7×7 的件按门口拼（旋转、加权、兜底）
这样大房间（2×2、3×2）和走廊能混在一张图里。

行数：379

## 接口

### 接口 `LayoutResult`

```ts
interface LayoutResult {
  readonly placements: Array<{ tile: string; metaX: number; metaY: number; fallback: boolean }>;
  readonly rooms: LayoutRoom[];
  readonly spawns: SpawnRequest[];
  readonly warnings: string[];
}
```

### 接口 `LayoutRoom`

```ts
interface LayoutRoom {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
```

### 接口 `LayoutSpec`

```ts
interface LayoutSpec {
  readonly tiles: readonly string[];
  readonly rooms?: number;
  readonly roomMin?: readonly [number, number];
  readonly roomMax?: readonly [number, number];
  readonly loops?: number;
}
```

### 函数 `placeLayout`

```ts
function placeLayout( terrain: number[], width: number, height: number, defs: ReadonlyMap<string, StructureDef>, spec: LayoutSpec, seed: number, terrainIdByCode: ReadonlyMap<string, number>, ): LayoutResult
```

## 依赖

- [`game/engine/core/src/worldgen/random.ts`](game/engine/core/src/worldgen/random.md)
- [`game/engine/core/src/worldgen/structures.ts`](game/engine/core/src/worldgen/structures.md)
- [`game/engine/core/src/worldgen/tiles.ts`](game/engine/core/src/worldgen/tiles.md)

## 被引用

- [`game/engine/core/src/worldgen/pipeline.ts`](game/engine/core/src/worldgen/pipeline.md)
