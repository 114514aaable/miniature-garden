# `game/engine/core/src/entity/place.ts`

## 内容

位置：内核唯一保留的组件名。
为什么必须保留一个：空间索引要知道「谁在哪」，否则没法维护。
所以 `core.place` 不是一个普通的数据组件——写它等于改索引。
但它对外仍然长得像组件：`view.entity(h).components["core.place"]`。
规则看到的是统一的数据，存储是不是字段，与规则无关。

行数：31

## 接口

### 接口 `Place`

```ts
interface Place {
  readonly space: number;
  readonly x: number;
  readonly y: number;
}
```

### 常量 `PLACE`

```ts
const PLACE
```

### 函数 `placeOf`

```ts
function placeOf(entity: Entity): Place | null
```

## 依赖

- [`game/engine/core/src/entity/entity.ts`](game/engine/core/src/entity/entity.md)

## 被引用

- [`game/engine/core/src/event/view.ts`](game/engine/core/src/event/view.md)
- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)
