# `game/engine/core/src/pack/manifest.ts`

## 内容

包清单（pack.json）：一个内容包的自述。
三种包，各有各的规矩：
base    定义世界。不能依赖别人，也不能被谁"扩展"。
overlay 给某个世界加内容。必须声明 extends（它扩展谁）。
bridge  把两个以上的世界接起来。requires 至少两个。
id 是身份，永远不改。合并时合并的是「内容池」，不是名字。
这个文件只做「解析 + 校验」，不读磁盘——core 不认识文件系统。

行数：225

## 接口

### 函数 `isManifest`

```ts
function isManifest(raw: JsonValue): boolean
```

### 常量 `PACK_ID_PATTERN`

```ts
const PACK_ID_PATTERN
```

### 接口 `PackFiles`

```ts
interface PackFiles {
  readonly spaces?: readonly string[];
  readonly templates?: readonly string[];
  readonly entities?: readonly string[];
  readonly terrains?: readonly string[];
  readonly components?: readonly string[];
  readonly groups?: readonly string[];
  readonly traversal?: readonly string[];
  readonly biomes?: readonly string[];
  readonly bodyparts?: readonly string[];
  readonly bodyplans?: readonly string[];
  readonly world?: readonly string[];
  readonly patches?: readonly string[];
}
```

### 类型 `PackKind`

```ts
type PackKind = "base" | "overlay" | "bridge"
```

### 接口 `PackManifest`

```ts
interface PackManifest {
  readonly id: string;
  readonly kind: PackKind;
  readonly version: string;
  readonly name?: string;
  readonly description?: string;
  readonly license?: string;
  readonly engine?: string;
  readonly requires?: Readonly<Record<string, string>>;
  readonly provides?: readonly string[];
  readonly loadAfter?: readonly string[];
  readonly loadBefore?: readonly string[];
  readonly extends?: string;
  readonly parent?: string;
  readonly scope?: PackScope;
  readonly tags?: readonly string[];
  readonly files?: PackFiles;
}
```

### 类型 `PackScope`

```ts
type PackScope = "local" | "shared"
```

### 函数 `parseManifest`

```ts
function parseManifest(raw: unknown): PackManifest
```

## 依赖

- [`game/engine/core/src/event/schema.ts`](game/engine/core/src/event/schema.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/engine/core/src/pack/merge.ts`](game/engine/core/src/pack/merge.md)
- [`game/engine/core/src/pack/order.ts`](game/engine/core/src/pack/order.md)
- [`tools/pack-reader.mjs`](tools/pack-reader.md)
