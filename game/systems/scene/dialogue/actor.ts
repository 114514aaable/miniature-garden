// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 对话演员的端口。
 *
 * E3 先用 ScriptedActor（同步、无 AI）；E6 的真 L3 也实现这个端口。
 * 端口只返回「选了哪个 choice / 说了什么」，绝不返回 Effect。
 */

import { type PlayerInput } from "./contract.ts";

export interface DialogueActorRequest {
  readonly conversationId: string;
  readonly turnId: number;
  readonly nodeId: string;
  readonly input: PlayerInput;
}

export interface DialogueActorResult {
  /** 演员建议的选择；脚本演员直接回传入的 choice。 */
  readonly choiceId?: string;
  /** 台词（E4 才用；现在留字段）。 */
  readonly speech?: string;
  readonly emotion?: string;
}

export interface DialogueActor {
  respond(
    request: DialogueActorRequest,
    options?: { readonly signal?: AbortSignal },
  ): Promise<DialogueActorResult> | DialogueActorResult;
}

/** 默认演员：完全按脚本走，不产生任何异步延迟。 */
export class ScriptedActor implements DialogueActor {
  respond(request: DialogueActorRequest): DialogueActorResult {
    if (request.input.kind === "choice") return { choiceId: request.input.choiceId };
    return {};
  }
}
