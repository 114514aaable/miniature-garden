# `game/systems/camera/camera.ts`

## 内容

相机：把「看哪儿」从渲染里拆出来。
三条规矩：
1. 相机只认「格子」和「像素」，不认实体、不认游戏规则；
2. 它跟着**视觉位置**走，不跟逻辑位置——否则补间时画面会抖；
3. 地图比视口小的时候居中，比视口大的时候夹在边界内。
所以渲染、HUD、点击换算全都从它这里取坐标，谁也不自己算。

行数：89

## 接口

### 函数 `cameraFor`

```ts
function cameraFor( target: Vec, viewport: Viewport, map: MapSize, tile: number, mode: CameraMode = "player", ): Vec
```

### 类型 `CameraMode`

```ts
type CameraMode = "player" | "map"
```

### 函数 `cellsInView`

```ts
function cellsInView(viewport: Viewport, tile: number): { width: number; height: number }
```

### 接口 `MapSize`

```ts
interface MapSize {
  readonly width: number;
  readonly height: number;
}
```

### 函数 `screenToWorld`

```ts
function screenToWorld(point: Vec, camera: Vec, tile: number): Vec
```

### 接口 `Vec`

```ts
interface Vec {
  readonly x: number;
  readonly y: number;
}
```

### 接口 `Viewport`

```ts
interface Viewport {
  readonly width: number;
  readonly height: number;
}
```

### 函数 `worldToScreen`

```ts
function worldToScreen(cell: Vec, camera: Vec, tile: number): Vec
```

## 依赖

（无）

## 被引用

- [`game/systems/render/browser.ts`](game/systems/render/browser.md)
