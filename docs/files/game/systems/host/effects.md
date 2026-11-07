# `game/systems/host/effects.ts`

## 内容

宿主的「效果入口」：规则 / 场景产出的效果，统一从这里落进 store。
为什么要有这一个函数：
- 以前四处各自 store.submit，拦截（数据写、日志、回放）没地方挂；
- 规则层不该知道「血在哪」——它只产出效果；
- 宿主想改写效果（比如把核心血量的写换成部位实例的写）时，
只改这里，不改任何规则。
两层拦截：
1  效果拦截器：拿一批效果 + 元信息，返回一批新效果（通用管道）
2  数据写拦截器：实体某个属性组要被写时，问一句「谁接管」
—— 接管方标记 consume，然后给出替代写；替代写直接落库，不再拦

行数：105

## 接口

### 函数 `applyEffects`

```ts
function applyEffects( sink: EffectSink, effects: readonly Effect[], meta: EffectMeta = { source: "system" }, interceptors: readonly EffectInterceptor[] = [], resolveWrite: WriteResolver | null = null, ): void
```

### 类型 `EffectInterceptor`

```ts
type EffectInterceptor = ( effects: readonly Effect[], meta: EffectMeta, ) => readonly Effect[]
```

### 接口 `EffectMeta`

```ts
interface EffectMeta {
  readonly source: EffectSource;
  readonly tag?: string;
  readonly actor?: number;
  readonly target?: number;
  readonly damage?: number;
}
```

### 接口 `EffectSink`

```ts
interface EffectSink {
  submit(effect: Effect): void;
}
```

### 类型 `EffectSource`

```ts
type EffectSource = "skill" | "scene" | "pending" | "enemy" | "system"
```

### 接口 `EntityWrite`

```ts
interface EntityWrite {
  readonly handle: number;
  readonly component: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly meta: EffectMeta;
}
```

### 类型 `WriteResolver`

```ts
type WriteResolver = (write: EntityWrite) => WriteResult | null
```

### 接口 `WriteResult`

```ts
interface WriteResult {
  readonly consume: boolean;
  readonly effects: readonly Effect[];
}
```

## 依赖

- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)

## 被引用

- [`game/systems/host/health-write.ts`](game/systems/host/health-write.md)
- [`tools/serve.mjs`](tools/serve.md)
