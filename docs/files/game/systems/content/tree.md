# `game/systems/content/tree.ts`

## 内容

内容树：目录 + 层注册表 + 节点清单。
第一版只认 `liveness` 层（现在/现场），其它层保留、警告、不执行。
这一层只做解析与校验；读文件在 tools/check-content.mjs。

行数：313

## 接口

### 接口 `ConditionalItems`

```ts
interface ConditionalItems {
  readonly flags: readonly string[];
  readonly items: ReadonlyArray<{ readonly template: string; readonly count: number }>;
}
```

### 接口 `ContentCatalog`

```ts
interface ContentCatalog {
  readonly version: number;
  readonly root: string;
  readonly nodes: ReadonlyMap<string, ContentCatalogNode>;
}
```

### 接口 `ContentCatalogNode`

```ts
interface ContentCatalogNode {
  readonly id: string;
  readonly parent: string | null;
  readonly kind: string;
  readonly title?: string;
  readonly entry: string;
  readonly children: readonly string[];
}
```

### 接口 `LayerDef`

```ts
interface LayerDef {
  readonly id: string;
  readonly version: number;
  readonly status: LayerStatus;
  readonly description?: string;
}
```

### 接口 `LayerRegistry`

```ts
interface LayerRegistry {
  readonly version: number;
  readonly layers: ReadonlyMap<string, LayerDef>;
}
```

### 类型 `LayerStatus`

```ts
type LayerStatus = "active" | "reserved"
```

### 接口 `NodeManifest`

```ts
interface NodeManifest {
  readonly protocol: number;
  readonly id: string;
  readonly version: string;
  readonly revision: number;
  readonly kind: string;
  readonly title?: string;
  readonly layers: Readonly<Record<string, string>>;
  readonly requires: ConditionalItems;
  readonly provides: ConditionalItems;
  readonly assets: readonly string[];
  readonly license: string;
}
```

### 接口 `NodeValidation`

```ts
interface NodeValidation {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly scene?: DialogScript;
}
```

### 函数 `parseContentCatalog`

```ts
function parseContentCatalog(raw: unknown, path = "$catalog"): ContentCatalog
```

### 函数 `parseLayerRegistry`

```ts
function parseLayerRegistry(raw: unknown, path = "$layers"): LayerRegistry
```

### 函数 `parseNodeManifest`

```ts
function parseNodeManifest(raw: unknown, path = "$manifest"): NodeManifest
```

### 函数 `validateNode`

```ts
function validateNode( manifest: NodeManifest, registry: LayerRegistry, layerData: Readonly<Record<string, unknown>>, ): NodeValidation
```

## 依赖

- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)
- [`game/systems/scene/dialog.ts`](game/systems/scene/dialog.md)

## 被引用

- [`tools/check-content.mjs`](tools/check-content.md)
- [`tools/content-loader.mjs`](tools/content-loader.md)
