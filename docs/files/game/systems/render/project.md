# `game/systems/render/project.ts`

## 内容

投影：按契约从世界生成一张「照片」。
照片是值，不是窗口——渲染器拿到之后不许再回查世界。
只拷契约里列的字段和组件，别的一概不碰。
启动握手也在这里：必需的组件缺了直接报错，可选的缺了记警告。

行数：142

## 接口

### 函数 `createProjector`

```ts
function createProjector(contract: RenderContract, templates: TemplateRegistry): Projector
```

### 接口 `FrameSnapshot`

```ts
interface FrameSnapshot {
  readonly tick: number;
  readonly spaces: ReadonlyArray<{
  readonly id: number;
  readonly width: number;
  readonly height: number;
  readonly terrain: Int32Array;
  }>;
  readonly entities: readonly SnapshotEntity[];
}
```

### 接口 `Projector`

```ts
interface Projector {
  readonly warnings: readonly string[];
  snapshot(source: RenderSource): FrameSnapshot;
}
```

### 接口 `RenderSource`

```ts
interface RenderSource {
  readonly tick: number;
  readonly spaces: readonly Space[];
  readonly templates: TemplateRegistry;
  readonly entities: readonly Entity[];
}
```

### 接口 `SnapshotEntity`

```ts
interface SnapshotEntity {
  readonly handle: number;
  readonly x?: number;
  readonly y?: number;
  readonly template?: string;
  readonly sprite?: JsonValue;
  readonly components: Readonly<Record<string, JsonValue>>;
}
```

## 依赖

- [`game/engine/core/src/entity/entity.ts`](game/engine/core/src/entity/entity.md)
- [`game/engine/core/src/entity/merge.ts`](game/engine/core/src/entity/merge.md)
- [`game/engine/core/src/entity/template.ts`](game/engine/core/src/entity/template.md)
- [`game/engine/core/src/space.ts`](game/engine/core/src/space.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)
- [`game/systems/render/contract.ts`](game/systems/render/contract.md)

## 被引用

- [`game/systems/render/browser.ts`](game/systems/render/browser.md)
- [`game/systems/render/draw.ts`](game/systems/render/draw.md)
- [`tools/serve.mjs`](tools/serve.md)
