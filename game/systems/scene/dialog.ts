// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 对话框场景。
 *
 * 数据是「节点图」：
 *
 * ```json
 * { "id": "salt_01", "start": "hi",
 *   "nodes": {
 *     "hi":  { "speaker": "salt", "text": "要买盐吗？",
 *              "choices": [ { "id": "buy", "text": "要", "next": "buy" },
 *                           { "id": "leave", "text": "不要", "end": true } ] },
 *     "buy": { "text": "拿好。", "choices": [ { "id": "bye", "text": "再见", "end": true } ] }
 *   } }
 * ```
 *
 * E0：选项有了逻辑身份 `id`，不再用显示顺序当 key。
 * E1：当前节点、turnId、transcript 都在 DialogueSession 里，存档能恢复。
 *
 * 输入：
 *   `choice:<id>`   按逻辑身份选（新客户端）
 *   `choice1..9`    旧客户端兼容，按当前显示顺序映射
 *   `close`         离开
 */

import { type JsonValue } from "../../engine/core/src/time.ts";
import { type Scene, type SceneContext, type SceneResult } from "./scene.ts";
import { DialogueSession } from "./dialogue/session.ts";
import { type DialogueView } from "./dialogue/contract.ts";

const MAX_CHOICES = 9;

export interface DialogChoice {
  /** 逻辑身份；不写时解析成 c1..cN。 */
  readonly id: string;
  readonly text: string;
  readonly next?: string;
  readonly end?: boolean;
}

export interface DialogNode {
  readonly text: string;
  readonly choices: readonly DialogChoice[];
  /** 说话人（模板 id）。 */
  readonly speaker?: string;
}

export interface DialogScript {
  readonly id: string;
  readonly start: string;
  readonly nodes: Readonly<Record<string, DialogNode>>;
}

export function parseDialogScript(raw: JsonValue): DialogScript {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("对话脚本必须是对象");
  }
  const data = raw as Record<string, JsonValue>;
  const id = typeof data.id === "string" ? data.id : "dialog";
  const start = typeof data.start === "string" ? data.start : "start";
  const rawNodes = data.nodes;
  if (typeof rawNodes !== "object" || rawNodes === null || Array.isArray(rawNodes)) {
    throw new Error("对话脚本缺少 nodes");
  }

  const nodes: Record<string, DialogNode> = {};
  for (const [key, value] of Object.entries(rawNodes as Record<string, JsonValue>)) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) continue;
    const node = value as Record<string, JsonValue>;
    const text = typeof node.text === "string" ? node.text : "";
    const speaker = typeof node.speaker === "string" ? node.speaker : undefined;

    const seen = new Set<string>();
    const choices: DialogChoice[] = [];
    for (const [index, rawChoice] of (Array.isArray(node.choices) ? node.choices : []).entries()) {
      if (typeof rawChoice !== "object" || rawChoice === null) continue;
      const choice = rawChoice as Record<string, JsonValue>;
      const choiceId = typeof choice.id === "string" && choice.id.length > 0
        ? choice.id
        : `c${index + 1}`;
      if (seen.has(choiceId)) {
        throw new Error(`对话 ${id} 的节点 ${key} 选项 id 重复：${choiceId}`);
      }
      seen.add(choiceId);

      choices.push({
        id: choiceId,
        text: typeof choice.text === "string" ? choice.text : "…",
        ...(typeof choice.next === "string" ? { next: choice.next } : {}),
        ...(choice.end === true ? { end: true } : {}),
      });
    }

    nodes[key] = {
      text,
      choices,
      ...(speaker === undefined ? {} : { speaker }),
    };
  }

  return { id, start, nodes };
}

/**
 * 造一个对话场景。
 *
 * 状态归 DialogueSession；场景只负责把命令翻译成选择、把结果翻译成 SceneResult。
 */
export function createDialogScene(script: DialogScript): Scene {
  const session = new DialogueSession(script);

  return {
    id: "dialog",

    get input(): readonly string[] {
      const ids = session.choices().map((choice) => `choice:${choice.id}`);
      // 旧客户端还会发 choice1..9；保留一个版本
      const legacy = Array.from({ length: MAX_CHOICES }, (_, index) => `choice${index + 1}`);
      return [...ids, "close", ...legacy];
    },

    handle(command: string, _context: SceneContext): SceneResult {
      if (command === "close") {
        return { next: { op: "pop" } };
      }

      const choice = command.startsWith("choice:")
        ? session.choose(command.slice("choice:".length))
        : session.chooseLegacy(Number(command.replace("choice", "")) - 1);

      // 越界/未知：不崩、不静默切场景，留给宿主提示
      if (choice === null) {
        return { effects: [] };
      }

      if (choice.end === true || choice.next === undefined) {
        return { next: { op: "pop" } };
      }

      return { effects: [] };
    },

    /** 存档：节点 + turnId + transcript。 */
    snapshot(): JsonValue {
      return session.snapshot();
    },

    /** 读档：兼容旧存档的 { node }。 */
    restore(state: JsonValue): void {
      session.restore(state);
    },

    /** 给客户端渲染用的视图。 */
    describe(): JsonValue {
      const view: DialogueView = session.view();
      return view as unknown as JsonValue;
    },
  };
}
