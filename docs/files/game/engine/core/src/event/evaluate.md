# `game/engine/core/src/event/evaluate.ts`

## 内容

求值器：把一棵信封树跑成结果。
规则（见契约 §6 / §7）：
1. 后序：先算全部子节点，再把结果交给父节点。
2. 深度上限：默认 3，硬上限 8。
3. 子节点失败 → 父节点失败（v0 没有容错语法）。
4. 任何异常都被捕获成诊断，不会把整条管线带崩。
它不写世界：只把结果交回去。世界由 store 落地。

行数：192

## 接口

### 常量 `DEFAULT_MAX_DEPTH`

```ts
const DEFAULT_MAX_DEPTH
```

### 接口 `Diagnostic`

```ts
interface Diagnostic {
  readonly tag: string;
  readonly envelopeId: number;
  readonly lTick: number;
  readonly message: string;
}
```

### 接口 `Envelope`

```ts
interface Envelope {
  readonly id: number;
  readonly tag: string;
  readonly params: JsonValue;
  readonly refs?: readonly ObjectRef[];
  readonly priority?: number;
  readonly children?: readonly Envelope[];
}
```

### 函数 `evaluate`

```ts
function evaluate( envelope: Envelope, link: LinkTable, handlers: HandlerMap, view: WorldView, options: EvaluateOptions = {}, ): EvaluateResult
```

### 接口 `EvaluateContext`

```ts
interface EvaluateContext {
  readonly frame: Frame;
  readonly view: WorldView;
  readonly children: readonly JsonValue[];
  readonly tools?: RuleTools;
}
```

### 接口 `EvaluateOptions`

```ts
interface EvaluateOptions {
  readonly source?: string;
  readonly maxDepth?: number;
  readonly tools?: RuleTools;
}
```

### 类型 `EvaluateResult`

```ts
type EvaluateResult = | { readonly ok: true; readonly value: JsonValue; readonly diagnostics: readonly Diagnostic[] } | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] }
```

### 接口 `Frame`

```ts
interface Frame {
  readonly envelope: Envelope;
  readonly source: string;
  readonly lTick: number;
  readonly seq: number;
  readonly depth: number;
  readonly parentId: number | null;
}
```

### 类型 `Handler`

```ts
type Handler = (params: JsonValue, context: EvaluateContext) => JsonValue
```

### 类型 `HandlerMap`

```ts
type HandlerMap = ReadonlyMap<number, Handler>
```

### 常量 `HARD_MAX_DEPTH`

```ts
const HARD_MAX_DEPTH
```

### 接口 `ObjectRef`

```ts
interface ObjectRef {
  readonly handle: number;
  readonly kind: "entity" | "space";
}
```

### 接口 `RuleTools`

```ts
interface RuleTools {
  offsets?(shape: string): readonly { readonly dx: number; readonly dy: number }[] | undefined;
  canEnter?(handle: number, space: number, cell: { readonly x: number; readonly y: number }): boolean;
  select?(
  cells: readonly { readonly x: number; readonly y: number }[]
  filter: string
  options?: { readonly exclude?: number; readonly limit?: number }
  ): readonly number[];
}
```

## 依赖

- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/event/schema.ts`](game/engine/core/src/event/schema.md)
- [`game/engine/core/src/event/view.ts`](game/engine/core/src/event/view.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/engine/core/src/rules/ai.ts`](game/engine/core/src/rules/ai.md)
- [`game/engine/core/src/rules/aim.ts`](game/engine/core/src/rules/aim.md)
- [`game/engine/core/src/rules/attack.ts`](game/engine/core/src/rules/attack.md)
- [`game/engine/core/src/rules/death.ts`](game/engine/core/src/rules/death.md)
- [`game/engine/core/src/rules/enemy-actions.ts`](game/engine/core/src/rules/enemy-actions.md)
- [`game/engine/core/src/rules/inventory.ts`](game/engine/core/src/rules/inventory.md)
- [`game/engine/core/src/rules/move.ts`](game/engine/core/src/rules/move.md)
- [`game/engine/core/src/rules/pending.ts`](game/engine/core/src/rules/pending.md)
- [`game/engine/core/src/rules/rest.ts`](game/engine/core/src/rules/rest.md)
- [`game/engine/core/src/rules/sweep.ts`](game/engine/core/src/rules/sweep.md)
- [`game/engine/core/src/rules/talk.ts`](game/engine/core/src/rules/talk.md)
- [`game/engine/core/src/rules/use.ts`](game/engine/core/src/rules/use.md)
- [`game/systems/rules/base.ts`](game/systems/rules/base.md)
- [`tools/serve.mjs`](tools/serve.md)
