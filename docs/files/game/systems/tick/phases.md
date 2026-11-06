# `game/systems/tick/phases.ts`

## 内容

每 tick 的阶段表。
原来宿主里躺着三段 if：推进 store、结算挂起、敌人行动。
每加一个「每 tick 该做的事」就要再插一段——顺序会慢慢变成口口相传的知识。
这里把它变成一张**有序的表**：表就是清单，顺序就是语义。

行数：35

## 接口

### 接口 `Phase`

```ts
interface Phase {
  readonly name: string;
  readonly run: (tick: number) => void;
}
```

### 函数 `phaseNames`

```ts
function phaseNames(phases: readonly Phase[]): string[]
```

### 函数 `runPhases`

```ts
function runPhases(phases: readonly Phase[], tick: number): void
```

## 依赖

（无）

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
