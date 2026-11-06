# `game/engine/core/src/space.ts`

## 内容

空间：一个网格容器，属于数据层。
它只负责三件事：
1. 存：地形（稠密）与占用者（稀疏）；
2. 取：按坐标拿下标、拿内容；
3. 遍历接口：给一组「偏移」，按偏移访问格子。
它**不存遍历规则** —— 四邻接、八邻接、骑士步、锥形视野，全部是上层给的偏移集。
空间负责「能不能找到」，规则负责「算不算邻居」。
── 已知限制 ────────────────────────────────────────────
当前只有二维。要加第三维，需要改三处：
1. `strides` 追加一项 width * height；
2. `index()` 改成按坐标点乘 strides；
3. 遍历用的偏移集换成六邻接或二十六邻接。
但寻路与视野是**另一个故事**：它们不是通用的，三维要重写。
────────────────────────────────────────────────────────

行数：250

## 接口

### 常量 `AIR`

```ts
const AIR
```

### 接口 `Cell`

```ts
interface Cell {
  readonly x: number;
  readonly y: number;
}
```

### 类型 `EntityHandle`

```ts
type EntityHandle = number
```

### 函数 `nearestWhere`

```ts
function nearestWhere( space: Space, from: Cell, ok: (cell: Cell) => boolean, ): Cell | null
```

### 接口 `Offset`

```ts
interface Offset {
  readonly dx: number;
  readonly dy: number;
}
```

### 类型 `SpaceId`

```ts
type SpaceId = number
```

### 类型 `Visitor`

```ts
type Visitor = (cell: Cell, index: number) => void | boolean
```

## 依赖

（无）

## 被引用

- [`game/engine/core/src/entity/entity.ts`](game/engine/core/src/entity/entity.md)
- [`game/engine/core/src/event/effects.ts`](game/engine/core/src/event/effects.md)
- [`game/engine/core/src/event/view.ts`](game/engine/core/src/event/view.md)
- [`game/engine/core/src/pack/load.ts`](game/engine/core/src/pack/load.md)
- [`game/engine/core/src/rules/collision.ts`](game/engine/core/src/rules/collision.md)
- [`game/engine/core/src/stencils.ts`](game/engine/core/src/stencils.md)
- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)
- [`game/systems/render/project.ts`](game/systems/render/project.md)
- [`tools/serve.mjs`](tools/serve.md)
