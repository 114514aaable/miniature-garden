# `game/systems/scene/dialog.ts`

## 内容

对话框场景。
它是场景（换掉输入与渲染），但**长得像背包**：一块面板、几行字、几个选项。
数据是「节点图」：
```json
{ "id": "salt_01", "start": "hi",
"nodes": {
"hi":  { "text": "要买盐吗？", "choices": [ { "text": "要", "next": "buy" }, { "text": "不要", "end": true } ] },
"buy": { "text": "拿好。",     "choices": [ { "text": "再见", "end": true } ] }
} }
```
输入固定是 `choice1..choice9` + `close`——**选项数量由当前节点决定**，
场景自己判断越界（发超出范围的 choice 会被当无效）。

行数：148

## 接口

### 函数 `createDialogScene`

```ts
function createDialogScene(script: DialogScript): Scene
```

### 接口 `DialogChoice`

```ts
interface DialogChoice {
  readonly text: string;
  readonly next?: string;
  readonly end?: boolean;
}
```

### 接口 `DialogNode`

```ts
interface DialogNode {
  readonly text: string;
  readonly choices: readonly DialogChoice[];
}
```

### 接口 `DialogScript`

```ts
interface DialogScript {
  readonly id: string;
  readonly start: string;
  readonly nodes: Readonly<Record<string, DialogNode>>;
}
```

### 接口 `DialogView`

```ts
interface DialogView {
  readonly text: string;
  readonly choices: readonly string[];
  readonly speaker?: string;
}
```

### 函数 `parseDialogScript`

```ts
function parseDialogScript(raw: JsonValue): DialogScript
```

## 依赖

- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)
- [`game/systems/scene/scene.ts`](game/systems/scene/scene.md)

## 被引用

- [`tools/serve.mjs`](tools/serve.md)
