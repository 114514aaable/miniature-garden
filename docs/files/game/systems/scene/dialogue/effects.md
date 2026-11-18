# `game/systems/scene/dialogue/effects.ts`

## 内容

剧本里的效果：只允许现有六种 Effect，句柄可以用占位符。
"$actor"    玩家/发起者（push scene 的 actor）
"$speaker"  当前对话对象
"$target"   同 $speaker
加载期只校验形状；运行期替换句柄。不要在这里发明新 Effect。

行数：156

## 接口

### 类型 `EffectPlaceholder`

```ts
type EffectPlaceholder = "$actor" | "$speaker" | "$target"
```

### 函数 `parseScriptEffects`

```ts
function parseScriptEffects(raw: unknown, where: string): readonly JsonValue[]
```

### 函数 `resolveScriptEffects`

```ts
function resolveScriptEffects( effects: readonly JsonValue[] | undefined, params: SceneParams, ): Effect[]
```

### 接口 `SceneParams`

```ts
interface SceneParams {
  readonly actor?: number;
  readonly speaker?: number;
}
```

## 依赖

- [`game/engine/core/src/store.ts`](game/engine/core/src/store.md)
- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`game/systems/scene/dialog.ts`](game/systems/scene/dialog.md)
