# `game/engine/core/src/traversal/shapes.ts`

## 内容

命名形状与命名条件：把 base 的 traversal.json 变成可用的东西。
分工：
算子（circle/rotate…）    代码，在 offsets.ts / transform.ts
形状（touch/around1…）    数据，在 base 的 traversal.json
条件（living/talkable…）  数据，同上
所以「加一种形状」= 改 json，不用改代码。

行数：146

## 接口

### 函数 `conditionOf`

```ts
function conditionOf(spec: TraversalSpec, name: string): Condition
```

### 函数 `matchesNamed`

```ts
function matchesNamed( spec: TraversalSpec, name: string, components: Readonly<Record<string, JsonValue>>, ): boolean
```

### 函数 `offsetsOf`

```ts
function offsetsOf(spec: TraversalSpec, name: string): Offset[]
```

### 函数 `parseTraversal`

```ts
function parseTraversal(raw: JsonValue, path = "$traversal"): TraversalSpec
```

### 接口 `ShapeSpec`

```ts
interface ShapeSpec {
  readonly base: BaseShape;
  readonly range?: number;
  readonly height?: number;
  readonly keep?: "front" | "back" | "left" | "right";
  readonly then?: ReadonlyArray<
  | { readonly op: "rotate90"; readonly turns: number }
  | { readonly op: "mirror"; readonly axis: "x" | "y" | "both" }
  | { readonly op: "translate"; readonly dx: number; readonly dy: number }
  >;
}
```

### 接口 `TraversalSpec`

```ts
interface TraversalSpec {
  readonly shapes: Readonly<Record<string, ShapeSpec>>;
  readonly filters: Readonly<Record<string, Condition>>;
}
```

### 函数 `unknownComponents`

```ts
function unknownComponents(spec: TraversalSpec, known: ReadonlySet<string>): string[]
```

## 依赖

- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)
- [`game/engine/core/src/traversal/filter.ts`](game/engine/core/src/traversal/filter.md)
- [`game/engine/core/src/traversal/offsets.ts`](game/engine/core/src/traversal/offsets.md)
- [`game/engine/core/src/traversal/transform.ts`](game/engine/core/src/traversal/transform.md)

## 被引用

- [`game/engine/core/src/pack/load.ts`](game/engine/core/src/pack/load.md)
- [`tools/serve.mjs`](tools/serve.md)
