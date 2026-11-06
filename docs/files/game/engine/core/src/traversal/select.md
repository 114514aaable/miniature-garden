# `game/engine/core/src/traversal/select.ts`

## 内容

选定核心：从一组格子里挑出「符合条件的目标」。
这是规则里唯一该做「扫格子」的地方——
劈砍、交谈、横扫……都调它，不要各自写一遍 occupantsAt。
条件来自 base 的 filters（livable / talkable…），
所以「谁能被选中」是**数据**，不是规则里写死的组件名。

行数：61

## 接口

### 接口 `SelectOptions`

```ts
interface SelectOptions {
  readonly exclude?: number;
  readonly limit?: number;
}
```

### 接口 `SelectorView`

```ts
interface SelectorView {
  occupantsAt(cell: { x: number; y: number }): readonly number[];
  componentsOf(handle: number): Readonly<Record<string, JsonValue>>;
}
```

### 函数 `selectTargets`

```ts
function selectTargets( view: SelectorView, cells: readonly { readonly x: number; readonly y: number }[], condition: Condition, options: SelectOptions = {}, ): number[]
```

## 依赖

- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)
- [`game/engine/core/src/traversal/filter.ts`](game/engine/core/src/traversal/filter.md)

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
