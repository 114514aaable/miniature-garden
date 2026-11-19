# `game/systems/scene/dialogue/actor.ts`

## 内容

对话演员的端口。
E3 先用 ScriptedActor（同步、无 AI）；E6 的真 L3 也实现这个端口。
端口只返回「选了哪个 choice / 说了什么」，绝不返回 Effect。

行数：42

## 接口

### 接口 `DialogueActor`

```ts
interface DialogueActor {
  respond(
  request: DialogueActorRequest
  options?: { readonly signal?: AbortSignal }
  ): Promise<DialogueActorResult> | DialogueActorResult;
}
```

### 接口 `DialogueActorRequest`

```ts
interface DialogueActorRequest {
  readonly conversationId: string;
  readonly turnId: number;
  readonly nodeId: string;
  readonly input: PlayerInput;
}
```

### 接口 `DialogueActorResult`

```ts
interface DialogueActorResult {
  readonly choiceId?: string;
  readonly speech?: string;
  readonly emotion?: string;
}
```

## 依赖

- [`game/systems/scene/dialogue/contract.ts`](game/systems/scene/dialogue/contract.md)

## 被引用

- [`game/systems/scene/dialog.ts`](game/systems/scene/dialog.md)
- [`game/systems/scene/dialogue/session.ts`](game/systems/scene/dialogue/session.md)
