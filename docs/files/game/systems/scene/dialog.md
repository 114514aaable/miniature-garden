# `game/systems/scene/dialog.ts`

## 内容

对话框场景。
数据是「节点图」：
```json
{ "id": "salt_01", "start": "hi",
"nodes": {
"hi":  { "speaker": "salt", "text": "要买盐吗？",
"choices": [ { "id": "buy", "text": "要", "next": "buy" },
{ "id": "leave", "text": "不要", "end": true } ] },
"buy": { "text": "拿好。", "choices": [ { "id": "bye", "text": "再见", "end": true } ] }
} }
```
E0：选项有了逻辑身份 `id`，不再用显示顺序当 key。
E1：当前节点、turnId、transcript 都在 DialogueSession 里，存档能恢复。
输入：
`choice:<id>`   按逻辑身份选（新客户端）
`choice1..9`    旧客户端兼容，按当前显示顺序映射
`close`         离开

行数：162

## 接口

### 函数 `createDialogScene`

```ts
function createDialogScene(script: DialogScript): Scene
```

### 接口 `DialogChoice`

```ts
interface DialogChoice {
  readonly id: string;
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
  readonly speaker?: string;
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

### 函数 `parseDialogScript`

```ts
function parseDialogScript(raw: JsonValue): DialogScript
```

## 依赖

- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)
- [`game/systems/scene/dialogue/contract.ts`](game/systems/scene/dialogue/contract.md)
- [`game/systems/scene/dialogue/session.ts`](game/systems/scene/dialogue/session.md)
- [`game/systems/scene/scene.ts`](game/systems/scene/scene.md)

## 被引用

- [`game/systems/scene/dialogue/session.ts`](game/systems/scene/dialogue/session.md)
- [`tools/serve.mjs`](tools/serve.md)
