# `game/engine/core/src/worldgen/maze.ts`

## 内容

迷宫生成（迭代回溯 + 可选编织）。
思路和「房间」相反：房间是挖出一块块空地，迷宫是**在实心墙里挖一条条通道**。
格子   (1,1) (3,1) (5,1) …
通道   格子和相邻格子之间挖开一格
边界   最外一圈永远是墙
编织（braid）：挖完以后，把死胡同按概率打通到旁边——迷宫不再只有一条路，
走起来没那么折磨，也更像天然洞穴。
全部确定性：随机数只来自 (seed, 计数器)，不读时钟、不依赖调用顺序。

行数：136

## 接口

### 函数 `generateMaze`

```ts
function generateMaze(config: MazeConfig): number[]
```

### 接口 `MazeConfig`

```ts
interface MazeConfig {
  readonly seed: number;
  readonly width: number;
  readonly height: number;
  readonly wall: number;
  readonly floor: number;
  readonly braid?: number;
  readonly inset?: number;
  readonly seedOffset?: number;
}
```

## 依赖

（无）

## 被引用

- [`game/engine/core/src/worldgen/pipeline.ts`](game/engine/core/src/worldgen/pipeline.md)
