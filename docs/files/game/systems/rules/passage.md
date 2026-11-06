# `game/systems/rules/passage.ts`

## 内容

通行：物种 × 地形 的对接结果。
两边各自编码：
地形   surface: "ground" | "liquid" | "solid" | "air"
物种   core.locomotion { surfaces: ["ground"] }
「谁和谁能接」用 bind 那个通用模块算一次，运行时只查表。
退回规则（老数据不改也能跑）：
地形没有 surface     → 用它自己的 passable
物种没有 locomotion  → 只看地形的 passable

行数：106

## 接口

### 函数 `buildPassage`

```ts
function buildPassage(terrains: readonly PassageTerrain[], templates: readonly PassageTemplate[]): Passage
```

### 接口 `Passage`

```ts
interface Passage {
  canEnter(templateId: string, terrainId: number): boolean;
  readonly diagnostics: readonly string[];
}
```

### 接口 `PassageTemplate`

```ts
interface PassageTemplate {
  readonly id: string;
  readonly components: Readonly<Record<string, unknown>>;
}
```

### 接口 `PassageTerrain`

```ts
interface PassageTerrain {
  readonly id: number;
  readonly code?: string;
  readonly surface?: string;
  readonly passable: boolean;
}
```

### 常量 `SURFACES`

```ts
const SURFACES
```

## 依赖

- [`game/engine/core/src/bind.ts`](game/engine/core/src/bind.md)

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
