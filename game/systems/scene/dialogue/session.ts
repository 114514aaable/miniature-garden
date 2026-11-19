// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 一次对话的会话状态。
 *
 * 和旧实现（createDialogScene 闭包里的 nodeId）的区别：
 *   - 有 conversationId / turnId
 *   - 有 transcript
 *   - snapshot/restore 完整，存档能回到同一句
 *
 * E0/E1 只做同步选择；异步/提案/校验在 E3/E4 加，不改这个状态形状。
 */

import { type JsonValue } from "../../../engine/core/src/time.ts";
import {
  type DialogueView,
  type PlayerInput,
} from "./contract.ts";
import { type DialogueActor, type DialogueActorResult, ScriptedActor } from "./actor.ts";
import {
  type DialogChoice,
  type DialogNode,
  type DialogScript,
} from "../dialog.ts";

export interface TranscriptEntry {
  readonly speaker: string;
  readonly text: string;
}

export interface DialogueSessionOptions {
  readonly conversationId?: string;
  readonly transcriptLimit?: number;
}

export interface DialogueSessionState {
  readonly conversationId: string;
  readonly turnId: number;
  readonly nodeId: string;
  readonly transcript: readonly TranscriptEntry[];
}

export class DialogueSession {
  readonly script: DialogScript;
  readonly conversationId: string;
  private nodeId: string;
  private turnId = 1;
  private version = 0;
  private pending = false;
  private transcript: TranscriptEntry[] = [];
  private readonly transcriptLimit: number;

  constructor(script: DialogScript, options: DialogueSessionOptions = {}) {
    this.script = script;
    this.conversationId = options.conversationId ?? `conv.${script.id}`;
    this.nodeId = script.start;
    this.transcriptLimit = options.transcriptLimit ?? 50;

    const node = this.node();
    this.remember({ speaker: node.speaker ?? "npc", text: node.text });
  }

  node(): DialogNode {
    return this.script.nodes[this.nodeId] ?? { text: "", choices: [] };
  }

  choices(): readonly DialogChoice[] {
    return this.node().choices;
  }

  view(): DialogueView {
    const node = this.node();
    return {
      conversationId: this.conversationId,
      turnId: this.turnId,
      text: node.text,
      choices: node.choices.map((choice) => ({ id: choice.id, label: choice.text })),
      ...(node.speaker === undefined ? {} : { speaker: node.speaker }),
      state: "awaiting_input",
    };
  }

  /** 按 choiceId 选；找不到返回 null，由场景决定怎么处理。 */
  choose(choiceId: string): DialogChoice | null {
    const choice = this.choices().find((item) => item.id === choiceId);
    if (choice === undefined) return null;

    this.remember({ speaker: "player", text: choice.text });

    if (choice.end === true || choice.next === undefined) {
      return choice;
    }
    if (this.script.nodes[choice.next] === undefined) {
      throw new Error(`对话 ${this.script.id} 指向了不存在的节点：${choice.next}`);
    }

    this.nodeId = choice.next;
    this.turnId += 1;
    this.remember({ speaker: this.node().speaker ?? "npc", text: this.node().text });
    return choice;
  }

  /** 旧命令兼容：choice1..choice9 按当前显示顺序映射。 */
  chooseLegacy(index: number): DialogChoice | null {
    const choice = this.choices()[index];
    if (choice === undefined) return null;
    return this.choose(choice.id);
  }

  /** 有没有一次异步提案在路上。 */
  isPending(): boolean {
    return this.pending;
  }

  /** 取消当前提案：旧响应回来时版本不匹配，会被丢弃。 */
  cancel(): void {
    this.version += 1;
    this.pending = false;
  }

  /** 统一入口：按钮、自由文本、关闭。E1 只处理 choice/close。 */
  submit(input: PlayerInput): DialogChoice | null {
    if (input.kind === "close") return null;
    if (input.kind === "choice") return this.choose(input.choiceId);
    // 自由文本在 E5 接；现在按「无匹配」处理
    return null;
  }

  /**
   * 异步提交：演员可以先想一会儿。
   * 返回 null 表示「忙 / 被取消 / 演员没选」；调用方决定怎么反馈。
   */
  async submitAsync(
    input: PlayerInput,
    actor: DialogueActor = new ScriptedActor(),
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<{ choice: DialogChoice; result: DialogueActorResult } | null> {
    if (input.kind === "close") return null;
    if (this.pending) return null;

    const version = this.version;
    const turnId = this.turnId;
    const nodeId = this.nodeId;
    this.pending = true;

    try {
      const result = await actor.respond(
        { conversationId: this.conversationId, turnId, nodeId, input },
        options,
      );

      // 期间被取消 / 被别的输入推进 → 旧响应作废
      if (version !== this.version || turnId !== this.turnId) return null;

      const choiceId = result.choiceId ?? (input.kind === "choice" ? input.choiceId : undefined);
      if (choiceId === undefined) return null;

      const choice = this.choose(choiceId);
      return choice === null ? null : { choice, result };
    } finally {
      if (version === this.version) this.pending = false;
    }
  }

  snapshot(): JsonValue {
    const state: DialogueSessionState = {
      conversationId: this.conversationId,
      turnId: this.turnId,
      nodeId: this.nodeId,
      transcript: this.transcript,
    };
    return state as unknown as JsonValue;
  }

  restore(state: JsonValue): void {
    if (typeof state !== "object" || state === null || Array.isArray(state)) return;
    const data = state as Record<string, JsonValue>;

    if (typeof data.nodeId === "string" && this.script.nodes[data.nodeId] !== undefined) {
      this.nodeId = data.nodeId;
    } else if (typeof data.node === "string" && this.script.nodes[data.node] !== undefined) {
      // 旧存档只有 { node }
      this.nodeId = data.node;
    }

    if (typeof data.turnId === "number" && Number.isFinite(data.turnId)) {
      this.turnId = data.turnId;
    }
    if (Array.isArray(data.transcript)) {
      this.transcript = data.transcript
        .filter((entry): entry is Record<string, JsonValue> => typeof entry === "object" && entry !== null)
        .map((entry) => ({
          speaker: typeof entry.speaker === "string" ? entry.speaker : "npc",
          text: typeof entry.text === "string" ? entry.text : "",
        }))
        .slice(-this.transcriptLimit);
    }
  }

  private remember(entry: TranscriptEntry): void {
    this.transcript.push(entry);
    if (this.transcript.length > this.transcriptLimit) {
      this.transcript = this.transcript.slice(-this.transcriptLimit);
    }
  }
}
