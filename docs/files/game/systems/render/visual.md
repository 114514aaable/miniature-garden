# `game/systems/render/visual.ts`

## 内容

视觉投影：渲染位置永远从逻辑位置重算。
三条规则（抄 Kinky Dungeon 的账，但把它的债还掉）：
1. 视觉没有「播放中」状态——每帧拿逻辑位置和视觉位置算一次
2. 落后超过预算就 snap（默认 5 格），玩家会看到跳变，这是设计内行为
3. delta 用 min(now-last, last-last2) 钳住——切 tab 回来不会瞬移半张图
速度单位是「格/秒」：10 格/秒 = 100ms 一格（与 KD 默认一致）。
注意：这个数要和输入节拍一起调，只调一个就会长期处在 snap 边缘。

行数：86

## 接口

### 函数 `clampDelta`

```ts
function clampDelta(now: number, last: number, previous: number): number
```

### 常量 `DEFAULT_VISUAL`

```ts
const DEFAULT_VISUAL: VisualConfig
```

### 函数 `distance`

```ts
function distance(a: Vec2, b: Vec2): number
```

### 函数 `stepVisual`

```ts
function stepVisual( visual: Vec2 | null, target: Vec2, deltaMs: number, config: VisualConfig = DEFAULT_VISUAL, ): Vec2
```

### 接口 `Vec2`

```ts
interface Vec2 {
  readonly x: number;
  readonly y: number;
}
```

### 接口 `VisualConfig`

```ts
interface VisualConfig {
  readonly speed: number;
  readonly snapDistance: number;
}
```

## 依赖

（无）

## 被引用

- [`game/systems/render/browser.ts`](game/systems/render/browser.md)
