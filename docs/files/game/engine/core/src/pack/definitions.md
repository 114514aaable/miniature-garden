# `game/engine/core/src/pack/definitions.ts`

## 内容

世界内容的定义格式：空间、模板、实体、地形、世界。
这几种东西都是数据，写在包的 JSON 文件里。加载器只认这些 kind，
它们长什么样由这里说了算——别处不许「顺手加个字段」。
地形为什么是独立定义而不是 world 的一部分：
预设包（official.base）要提供标准地形，世界只能在此基础上加。
放在 world 里，预设包就没法贡献任何地形了。

行数：402

## 接口

### 接口 `BiomeDef`

```ts
interface BiomeDef {
  readonly id: string;
  readonly ranges: Readonly<Record<string, readonly [number, number]>>;
  readonly terrain: Readonly<Record<string, string>>;
  readonly structures?: readonly string[];
  readonly tags?: readonly string[];
  readonly color?: string;
}
```

### 接口 `ComponentDef`

```ts
interface ComponentDef {
  readonly name: string;
  readonly schema: Schema;
}
```

### 类型 `ConflictPolicy`

```ts
type ConflictPolicy = "error" | "warn" | "override"
```

### 接口 `EntityDef`

```ts
interface EntityDef {
  readonly template: string;
  readonly space: string;
  readonly x: number;
  readonly y: number;
  readonly overrides?: Readonly<Record<string, JsonValue>>;
}
```

### 接口 `GroupDef`

```ts
interface GroupDef {
  readonly id: string;
  readonly entities: ReadonlyArray<{
  readonly template: string;
  readonly dx: number;
  readonly dy: number;
  readonly overrides?: Readonly<Record<string, JsonValue>>;
  }>;
}
```

### 函数 `isPassable`

```ts
function isPassable(terrains: ReadonlyMap<number, TerrainDef>, terrain: number): boolean
```

### 函数 `parseBiomeDef`

```ts
function parseBiomeDef(raw: unknown, idKey: string, path = "$biome"): BiomeDef
```

### 函数 `parseComponentDef`

```ts
function parseComponentDef(raw: unknown, idKey: string, path = "$component"): ComponentDef
```

### 函数 `parseEntityDef`

```ts
function parseEntityDef(raw: unknown, path = "$entity"): EntityDef
```

### 函数 `parseGroupDef`

```ts
function parseGroupDef(raw: unknown, idKey: string, path = "$group"): GroupDef
```

### 函数 `parseSchemaValue`

```ts
function parseSchemaValue(raw: unknown, path = "$schema"): Schema
```

### 函数 `parseSpaceDef`

```ts
function parseSpaceDef(raw: unknown, path = "$space"): SpaceDef
```

### 函数 `parseTemplateDef`

```ts
function parseTemplateDef(raw: unknown, path = "$template"): TemplateDef
```

### 函数 `parseTerrainDef`

```ts
function parseTerrainDef(raw: unknown, idKey: string, path = "$terrain"): TerrainDef
```

### 函数 `parseWorldDef`

```ts
function parseWorldDef(raw: unknown, path = "$world"): WorldDef
```

### 接口 `SpaceDef`

```ts
interface SpaceDef {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly cellSize: number;
  readonly terrain: readonly number[];
}
```

### 接口 `TemplateDef`

```ts
interface TemplateDef {
  readonly id: string;
  readonly components: Readonly<Record<string, JsonValue>>;
}
```

### 接口 `TerrainDef`

```ts
interface TerrainDef {
  readonly id: number;
  readonly name: string;
  readonly passable: boolean;
  readonly code?: string;
  readonly surface?: string;
}
```

### 接口 `WorldDef`

```ts
interface WorldDef {
  readonly start: { readonly space: string; readonly x: number; readonly y: number };
  readonly rules?: readonly string[];
  readonly init?: readonly JsonValue[];
  readonly generation?: JsonValue;
  readonly startMenu?: JsonValue;
  readonly persistence?: {
  readonly activeRadius?: number;
  readonly sweepEvery?: number;
  };
  readonly onConflict?: ConflictPolicy;
}
```

## 依赖

- [`game/engine/core/src/event/schema.ts`](game/engine/core/src/event/schema.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/engine/core/src/pack/load.ts`](game/engine/core/src/pack/load.md)
