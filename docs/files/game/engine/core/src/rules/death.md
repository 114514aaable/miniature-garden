# `game/engine/core/src/rules/death.ts`

## 内容

致死：单独一条规则。写拦截器判定「这次写致死」后广播它。
默认实现只是 despawn；世界包可以换成掉落、倒地、复活……

行数：29

## 接口

### 函数 `deathHandler`

```ts
function deathHandler(params: JsonValue, _context: EvaluateContext): JsonValue
```

### 常量 `deathSignature`

```ts
const deathSignature: Signature
```

## 依赖

- [`game/engine/core/src/event/evaluate.ts`](game/engine/core/src/event/evaluate.md)
- [`game/engine/core/src/event/registry.ts`](game/engine/core/src/event/registry.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/rules/base.ts`](game/systems/rules/base.md)
