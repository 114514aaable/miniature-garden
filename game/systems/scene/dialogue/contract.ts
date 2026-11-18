// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 对话的契约类型。
 *
 * 这一层只放「跨层的数据形状」，不依赖 Store / DOM。
 * E0/E1 先用到视图与输入；Proposal / Validator 在 E4 再加。
 */

/** 客户端渲染的一个选项。 */
export interface DialogChoiceView {
  /** 逻辑身份：选它就用这个 id，和显示顺序无关。 */
  readonly id: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/** 客户端渲染的整屏对话。 */
export interface DialogueView {
  readonly conversationId: string;
  readonly turnId: number;
  readonly text: string;
  readonly choices: readonly DialogChoiceView[];
  /** 说话人（模板 id，客户端查名字）。 */
  readonly speaker?: string;
  readonly state: "awaiting_input" | "thinking" | "closed";
}

/** 玩家输入。按钮和自由文本走同一个入口。 */
export type PlayerInput =
  | { readonly kind: "choice"; readonly choiceId: string }
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "close" };
