# `game/systems/scene/scene.ts`

## 内容

场景：世界现在处于哪种「玩法状态」。
它和窗口的区别：
场景   换掉玩法（谁在模拟、时间怎么走、输入是什么）  → explore / battle / dialog
窗口   还是同一个玩法，只是盖了一层界面              → 背包 / 设置 / 读档
核心原则：**场景返回「意图」，宿主负责执行。**
和规则返回 effects 是同一个模式——可测、可回放、不产生隐式状态。

行数：171

## 接口

### 接口 `Scene`

```ts
interface Scene {
  readonly id: string;
  readonly input: readonly string[];
  onEnter?(context: SceneContext): readonly Effect[];
  onExit?(context: SceneContext): readonly Effect[];
  handle(command: string, context: SceneContext): SceneResult;
  describe?(): JsonValue;
  snapshot?(): JsonValue;
  restore?(state: JsonValue): void;
}
```

### 接口 `SceneContext`

```ts
interface SceneContext {
  readonly now: number;
  readonly params: JsonValue;
}
```

### 函数 `sceneFromComponent`

```ts
function sceneFromComponent(value: JsonValue | undefined): SceneLayer
```

### 接口 `SceneLayer`

```ts
interface SceneLayer {
  readonly id: string;
  readonly params: JsonValue;
  readonly state?: JsonValue;
}
```

### 接口 `SceneResult`

```ts
interface SceneResult {
  readonly effects?: readonly Effect[];
  readonly next?: {
  readonly op: "push" | "replace" | "pop";
  readonly id?: string;
  readonly params?: JsonValue;
  };
}
```

## 依赖

- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/scene/dialog.ts`](game/systems/scene/dialog.md)
- [`tools/serve.mjs`](tools/serve.md)
