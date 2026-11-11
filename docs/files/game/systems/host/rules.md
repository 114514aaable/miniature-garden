# `game/systems/host/rules.ts`

## 内容

世界声明哪些规则，就只启用哪些规则。
语义：
world.json 没写 rules       → 全部规则（向后兼容）
world.json 写了 rules: []   → 一条都不启用
world.json 写了列表         → 只启用列表里的
列表里有未知 tag            → 启动就报错，不静默忽略

行数：42

## 接口

### 接口 `RuleLike`

```ts
interface RuleLike {
  readonly signature: { readonly tag: string };
}
```

### 函数 `selectActiveRules`

```ts
function selectActiveRules<T extends RuleLike>( table: readonly T[], declared: readonly string[], explicit: boolean, disabled: ReadonlySet<string>, ): T[]
```

## 依赖

- [`game/systems/rules/aliases.ts`](game/systems/rules/aliases.md)

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
