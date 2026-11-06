# `game/engine/core/src/event/schema.ts`

## 内容

极小类型语言：校验数据包里的参数和返回值。
为什么不用 JSON Schema：
- 规范本身太大，实现一遍要好几天；
- 我们只需要「够校验」，不需要 $ref / 组合器 / 注解那一套。
设计原则：
1. 未知字段默认拒绝（防止打错字悄悄失效）；
2. 私有扩展必须放在 "x-" 开头的字段里；
3. 错误信息必须带路径（`$.targets[0]`），否则调试等于盲猜。
这个文件不认识世界、不认识时间，只认识「值」和「形状」。

行数：209

## 接口

### 常量 `MAX_ARRAY`

```ts
const MAX_ARRAY
```

### 常量 `MAX_DEPTH`

```ts
const MAX_DEPTH
```

### 类型 `Schema`

```ts
type Schema = | { readonly t: "int" } | { readonly t: "num" } | { readonly t: "str" } | { readonly t: "bool" } | { readonly t: "null" } | { readonly t: "enum"; readonly values: readonly (string | number)[] } | { readonly t: "array"; readonly of: Schema; readonly max?: number } | { readonly t: "object"; readonly fields: Readonly<Record<string, Schema>>; readonly optional?: readonly string[]; } /** 键名不固定的映射，比如「依赖包 id → 版本范围」。 */ | { readonly t: "record"; readonly of: Schema; readonly max?: number } | { readonly t: "any" }
```

### 函数 `validate`

```ts
function validate(value: unknown, schema: Schema, path = "$"): void
```

## 依赖

（无）

## 被引用

- [`game/engine/core/src/entity/template.ts`](game/engine/core/src/entity/template.md)
- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/pack/definitions.ts`](game/engine/core/src/pack/definitions.md)
- [`game/engine/core/src/pack/load.ts`](game/engine/core/src/pack/load.md)
- [`game/engine/core/src/pack/manifest.ts`](game/engine/core/src/pack/manifest.md)
