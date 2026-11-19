# `game/systems/scene/dialogue/session.ts`

## 内容

一次对话的会话状态。
和旧实现（createDialogScene 闭包里的 nodeId）的区别：
- 有 conversationId / turnId
- 有 transcript
- snapshot/restore 完整，存档能回到同一句
E0/E1 只做同步选择；异步/提案/校验在 E3/E4 加，不改这个状态形状。

行数：208

## 接口

### 接口 `DialogueSessionOptions`

```ts
interface DialogueSessionOptions {
  readonly conversationId?: string;
  readonly transcriptLimit?: number;
}
```

### 接口 `DialogueSessionState`

```ts
interface DialogueSessionState {
  readonly conversationId: string;
  readonly turnId: number;
  readonly nodeId: string;
  readonly transcript: readonly TranscriptEntry[];
}
```

### 接口 `TranscriptEntry`

```ts
interface TranscriptEntry {
  readonly speaker: string;
  readonly text: string;
}
```

## 依赖

- [`game/engine/core/src/time.ts`](game/engine/core/src/time.md)
- [`game/systems/scene/dialog.ts`](game/systems/scene/dialog.md)
- [`game/systems/scene/dialogue/actor.ts`](game/systems/scene/dialogue/actor.md)
- [`game/systems/scene/dialogue/contract.ts`](game/systems/scene/dialogue/contract.md)

## 被引用

- [`game/systems/scene/dialog.ts`](game/systems/scene/dialog.md)
