# `game/systems/ui/minimap.ts`

## 内容

小地图：把一整个空间压成一张缩略图。
它只做「画」——数据从快照来，不读世界。
和套件里其它部件一样，属于表现层：世界怎么变它不知道，给它什么就画什么。

行数：67

## 接口

### 常量 `DEFAULT_TERRAIN_COLORS`

```ts
const DEFAULT_TERRAIN_COLORS: Readonly<Record<number, string>>
```

### 函数 `drawMinimap`

```ts
function drawMinimap(context: CanvasRenderingContext2D, options: MinimapOptions): void
```

### 接口 `MinimapMark`

```ts
interface MinimapMark {
  readonly x: number;
  readonly y: number;
  readonly color: string;
}
```

### 接口 `MinimapOptions`

```ts
interface MinimapOptions {
  readonly space: MinimapSpace;
  readonly cell?: number;
  readonly colors?: Readonly<Record<number, string>>;
  readonly marks?: readonly MinimapMark[];
}
```

### 函数 `minimapSize`

```ts
function minimapSize(space: MinimapSpace, cell = 4): { width: number; height: number }
```

### 接口 `MinimapSpace`

```ts
interface MinimapSpace {
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly number[];
}
```

## 依赖

（无）

## 被引用

- [`tools/client/hud/minimap.js`](tools/client/hud/minimap.md)
