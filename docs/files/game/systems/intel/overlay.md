# `game/systems/intel/overlay.ts`

## 内容

情报的「常驻」呈现：画在世界坐标上。
画三样东西，都贴着地面或贴着人：
1. 预警格   敌人起手要打的格子（贴地、越近越亮）
2. 脚底血条  只画受伤的，画在脚下而不是头顶
3. 蓄力条   自己头顶，显示进度
这里不产生任何状态，只读 facts。想加一种常驻信息 = 加一个「有就画」的段。

行数：112

## 接口

### 函数 `drawOverlay`

```ts
function drawOverlay(context: CanvasRenderingContext2D, options: OverlayOptions): void
```

### 函数 `intentAlpha`

```ts
function intentAlpha(inTicks: number, totalTicks: number): number
```

### 函数 `intentCells`

```ts
function intentCells(entity: OverlayEntity): Array<{ x: number; y: number }>
```

### 接口 `OverlayEntity`

```ts
interface OverlayEntity {
  readonly x: number;
  readonly y: number;
  readonly health?: HealthFacts;
  readonly intent?: IntentFacts;
  readonly pending?: PendingFacts;
}
```

### 接口 `OverlayOptions`

```ts
interface OverlayOptions {
  readonly tile: number;
  readonly camera: { readonly x: number; readonly y: number };
  readonly entities: readonly OverlayEntity[];
}
```

## 依赖

- [`game/systems/intel/facts.ts`](game/systems/intel/facts.md)

## 被引用

- [`game/systems/render/browser.ts`](game/systems/render/browser.md)
