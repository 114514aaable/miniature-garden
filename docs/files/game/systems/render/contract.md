# `game/systems/render/contract.ts`

## 内容

渲染契约：渲染器在启动时声明「我需要什么」。
为什么要提前声明：
缺数据要在启动时报错，而不是画到一半血条突然空掉。
而且快照只拷「要画的字段」，不是整份世界。
这个文件属于 system 包（宿主侧代码），不进数据包，也不进核心。

行数：81

## 接口

### 接口 `ComponentNeed`

```ts
interface ComponentNeed {
  readonly name: string;
  readonly required: boolean;
}
```

### 类型 `EntityField`

```ts
type EntityField = "pos" | "template" | "sprite"
```

### 常量 `MAX_COMPONENTS`

```ts
const MAX_COMPONENTS
```

### 常量 `MAX_UI`

```ts
const MAX_UI
```

### 接口 `RenderContract`

```ts
interface RenderContract {
  readonly id: string;
  readonly version: string;
  readonly needs: RenderNeeds;
}
```

### 接口 `RenderNeeds`

```ts
interface RenderNeeds {
  readonly spaces: "all" | "current";
  readonly camera: boolean;
  readonly entityFields: readonly EntityField[];
  readonly components: readonly ComponentNeed[];
  readonly ui: readonly string[];
}
```

### 函数 `validateContract`

```ts
function validateContract(contract: RenderContract): void
```

## 依赖

（无）

## 被引用

- [`game/systems/render/project.ts`](game/systems/render/project.md)
