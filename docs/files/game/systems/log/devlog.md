# `game/systems/log/devlog.ts`

## 内容

开发日志：给「排查问题的人」看，不是给玩家看。
和玩家日志的区别：
开发日志   完整、结构化、每条效果都记，可以拿来回放
玩家日志   有取舍、有人话、可以合并（以后单独做）
所以这里不做好看的事：只保证「谁在什么时候，因为什么，改了什么」都能查到。

行数：94

## 接口

### 函数 `compact`

```ts
function compact(value: JsonValue, max = 160): string
```

### 接口 `DevLogLine`

```ts
interface DevLogLine {
  readonly tick: number;
  readonly seq: number;
  readonly phase: "action" | "effect";
  readonly text: string;
}
```

### 接口 `DevLogOptions`

```ts
interface DevLogOptions {
  readonly limit?: number;
}
```

### 函数 `formatLine`

```ts
function formatLine(line: DevLogLine): string
```

## 依赖

- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
