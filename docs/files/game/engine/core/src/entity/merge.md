# `game/engine/core/src/entity/merge.ts`

## 内容

合并：模板默认值 + 实例覆盖 = 这个实体此刻的完整数据。
三条规则，必须记死（契约里也要写）：
1. 对象 → 深合并（只改提到的键）；
2. 数组 → 整体替换（不做逐项合并，避免「一半旧一半新」）；
3. 原始值 → 替换。
另外：这个函数是纯的，不改入参。否则模板会被实例污染，
一个玩家受伤，全世界同模板的 NPC 一起掉血——这种 bug 三天查不出来。

行数：47

## 接口

### 函数 `mergeDeep`

```ts
function mergeDeep(base: JsonValue, override: JsonValue): JsonValue
```

### 函数 `resolveComponents`

```ts
function resolveComponents( defaults: Readonly<Record<string, JsonValue>>, overrides: Readonly<Record<string, JsonValue>>, ): Record<string, JsonValue>
```

## 依赖

- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/engine/core/src/entity/template.ts`](game/engine/core/src/entity/template.md)
- [`game/engine/core/src/event/view.ts`](game/engine/core/src/event/view.md)
- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)
- [`game/systems/render/project.ts`](game/systems/render/project.md)
