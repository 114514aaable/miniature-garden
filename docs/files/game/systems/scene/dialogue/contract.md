# `game/systems/scene/dialogue/contract.ts`

## 内容

对话的契约类型。
这一层只放「跨层的数据形状」，不依赖 Store / DOM。
E0/E1 先用到视图与输入；Proposal / Validator 在 E4 再加。

行数：35

## 接口

### 接口 `DialogChoiceView`

```ts
interface DialogChoiceView {
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
}
```

### 接口 `DialogueView`

```ts
interface DialogueView {
  readonly conversationId: string;
  readonly turnId: number;
  readonly text: string;
  readonly choices: readonly DialogChoiceView[];
  readonly speaker?: string;
  readonly state: "awaiting_input" | "thinking" | "closed";
}
```

### 类型 `PlayerInput`

```ts
type PlayerInput = | { readonly kind: "choice"; readonly choiceId: string } | { readonly kind: "text"; readonly text: string } | { readonly kind: "close" }
```

## 依赖

（无）

## 被引用

- [`game/systems/scene/dialog.ts`](game/systems/scene/dialog.md)
- [`game/systems/scene/dialogue/actor.ts`](game/systems/scene/dialogue/actor.md)
- [`game/systems/scene/dialogue/session.ts`](game/systems/scene/dialogue/session.md)
