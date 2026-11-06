# `game/engine/core/src/rules/clock.ts`

## 内容

游戏时钟：引擎的 tick 和游戏里的「回合」之间的唯一换算处。
为什么现在就要这一层（哪怕两者完全一致）：
规则不该直接读 `lTick`。否则哪天「1 回合 = 10 tick」，
所有规则、所有事件、所有存档都要跟着改。
现在只有这一个文件知道换算关系，改的时候只改这里。
约定：
- 引擎：tick，单调递增的整数，由 store.step() 推进。
- 游戏：round，规则看到的「第几回合」。
- 动作成本也用 round 表示；0 表示零帧（不推进时钟）。

行数：102

## 接口

### 函数 `clampCost`

```ts
function clampCost(rounds: number): number
```

### 接口 `ClockConfig`

```ts
interface ClockConfig {
  readonly costs: Readonly<Record<string, number>>;
  readonly speedBonus: readonly SpeedBonus[];
}
```

### 函数 `costOf`

```ts
function costOf(config: ClockConfig, verb: string, speed: number): number
```

### 常量 `DEFAULT_CLOCK`

```ts
const DEFAULT_CLOCK: ClockConfig
```

### 函数 `isFree`

```ts
function isFree(config: ClockConfig, verb: string, speed: number): boolean
```

### 常量 `MAX_ACTION_COST`

```ts
const MAX_ACTION_COST
```

### 类型 `Round`

```ts
type Round = number
```

### 函数 `roundOf`

```ts
function roundOf(tick: number): Round
```

### 接口 `SpeedBonus`

```ts
interface SpeedBonus {
  readonly atSpeed: number;
  readonly bonus: number;
}
```

### 常量 `TICKS_PER_ROUND`

```ts
const TICKS_PER_ROUND
```

### 函数 `ticksFor`

```ts
function ticksFor(rounds: number): number
```

## 依赖

（无）

## 被引用

- [`tools/check-data.mjs`](tools/check-data.md)
- [`tools/serve.mjs`](tools/serve.md)
