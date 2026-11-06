# `game/engine/core/src/pack/merge.ts`

## 内容

合并：把多个包的内容并进同一个池子。
三条规则：
1. 默认拒绝重复——同一个 (kind, id) 出现两次就是错。
2. 覆盖只能走显式补丁，并且要记账（谁改了谁）。
3. 顺序 = 拓扑序（见 order.ts），所以结果与安装顺序无关。
这一层只管「池子」，不知道每种 kind 的数据长什么样——
那是加载器逐类校验的事。这里只保证：不重、不丢、可追溯。

行数：188

## 接口

### 接口 `Definition`

```ts
interface Definition {
  readonly kind: string;
  readonly id: string;
  readonly data: JsonValue;
}
```

### 函数 `keyOf`

```ts
function keyOf(kind: string, id: string): string
```

### 接口 `MergedWorld`

```ts
interface MergedWorld {
  readonly definitions: ReadonlyMap<string, MergedDefinition>;
  readonly provenance: readonly ProvenanceEntry[];
  readonly warnings: readonly MergeWarning[];
  readonly hash: string;
}
```

### 接口 `MergeOptions`

```ts
interface MergeOptions {
  readonly onConflict?: "error" | "warn" | "override";
}
```

### 函数 `mergePacks`

```ts
function mergePacks( contents: readonly PackContent[], options: MergeOptions = {}, ): MergedWorld
```

### 接口 `MergeWarning`

```ts
interface MergeWarning {
  readonly kind: string;
  readonly id: string;
  readonly previousOrigin: string;
  readonly newOrigin: string;
}
```

### 接口 `PackContent`

```ts
interface PackContent {
  readonly pack: PackManifest;
  readonly definitions: readonly Definition[];
  readonly patches?: readonly Patch[];
}
```

### 类型 `Patch`

```ts
type Patch = | { readonly op: "replace"; readonly kind: string; readonly id: string; readonly data: JsonValue } | { readonly op: "remove"; readonly kind: string; readonly id: string }
```

### 接口 `ProvenanceEntry`

```ts
interface ProvenanceEntry {
  readonly action: "add" | "replace" | "remove";
  readonly kind: string;
  readonly id: string;
  readonly pack: string;
}
```

## 依赖

- [`game/engine/core/src/pack/manifest.ts`](game/engine/core/src/pack/manifest.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/engine/core/src/pack/graph.ts`](game/engine/core/src/pack/graph.md)
- [`game/engine/core/src/pack/load.ts`](game/engine/core/src/pack/load.md)
- [`tools/check-data.mjs`](tools/check-data.md)
- [`tools/gen-pack-graph.mjs`](tools/gen-pack-graph.md)
- [`tools/gen-world.mjs`](tools/gen-world.md)
- [`tools/play.mjs`](tools/play.md)
- [`tools/serve.mjs`](tools/serve.md)
