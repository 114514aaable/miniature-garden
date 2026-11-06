# `game/engine/core/src/rules/collision.ts`

## 内容

碰撞规则：谁能挡路。
放在规则层，因为这是「语义」：空间只知道格子里有谁，
不知道为什么有人过不去。
v0 只有一种规矩：
有 core.solid 组件 → 挡路，只占自己那一格（0,0）
没有            → 不挡路（地板、掉落物、装饰）
以后要做多格建筑，只改 occupies()，调用方一行不动。

行数：41

## 接口

### 函数 `blockersAt`

```ts
function blockersAt(view: WorldView, space: SpaceId, cell: Cell): readonly number[]
```

### 函数 `isSolid`

```ts
function isSolid(view: WorldView, handle: number): boolean
```

### 函数 `occupies`

```ts
function occupies(view: WorldView, handle: number): readonly Cell[]
```

### 常量 `SOLID`

```ts
const SOLID
```

## 依赖

- [`game/engine/core/src/event/view.ts`](game/engine/core/src/event/view.md)
- [`game/engine/core/src/space.ts`](game/engine/core/src/space.md)

## 被引用

- [`game/engine/core/src/rules/ai.ts`](game/engine/core/src/rules/ai.md)
- [`game/engine/core/src/rules/aim.ts`](game/engine/core/src/rules/aim.md)
- [`game/engine/core/src/rules/move.ts`](game/engine/core/src/rules/move.md)
