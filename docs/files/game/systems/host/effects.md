# `game/systems/host/effects.ts`

## 内容

宿主的「效果入口」：规则 / 场景产出的效果，统一从这里落进 store。
为什么要有这一个函数：
- 以前四处各自 store.submit，拦截（部位伤害、日志、回放）没地方挂；
- 规则层不该知道「血在哪」——它只产出效果；
- 宿主想改写效果（比如把 core.health 的伤害换成部位伤害）时，
只改这里，不改任何规则。
拦截器是纯函数：拿一批效果 + 元信息，返回一批新效果。按安装顺序串起来。

行数：64

## 接口

### 函数 `applyEffects`

```ts
function applyEffects( sink: EffectSink, effects: readonly Effect[], meta: EffectMeta = { source: "system" }, interceptors: readonly EffectInterceptor[] = [], ): void
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

## 依赖

- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
