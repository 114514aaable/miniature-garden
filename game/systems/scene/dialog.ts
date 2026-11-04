// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 对话框场景。
 *
 * 它是场景（换掉输入与渲染），但**长得像背包**：一块面板、几行字、几个选项。
 *
 * 数据是「节点图」：
 *
 * ```json
 * { "id": "salt_01", "start": "hi",
 *   "nodes": {
 *     "hi":  { "text": "要买盐吗？", "choices": [ { "text": "要", "next": "buy" }, { "text": "不要", "end": true } ] },
 *     "buy": { "text": "拿好。",     "choices": [ { "text": "再见", "end": true } ] }
 *   } }
 * ```
 *
 * 输入固定是 `choice1..choice9` + `close`——**选项数量由当前节点决定**，
 * 场景自己判断越界（发超出范围的 choice 会被当无效）。
 */

import { type JsonValue } from "../../engine/core/src/time.ts";
import { type Scene, type SceneContext, type SceneResult } from "./scene.ts";

const MAX_CHOICES = 9;

export interface DialogChoice {
  readonly text: string;
  readonly next?: string;
  readonly end?: boolean;
}

export interface DialogNode {
  readonly text: string;
  readonly choices: readonly DialogChoice[];
}

export interface DialogScript {
  readonly id: string;
  readonly start: string;
  readonly nodes: Readonly<Record<string, DialogNode>>;
}

/** 客户端要渲染的东西。 */
export interface DialogView {
  readonly text: string;
  readonly choices: readonly string[];
  /** 说话人（模板 id，客户端查名字）。 */
  readonly speaker?: string;
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
    const choices = Array.isArray(node.choices)
      ? node.choices
          .filter((choice): choice is Record<string, JsonValue> => typeof choice === "object" && choice !== null)
          .map((choice) => ({
            text: typeof choice.text === "string" ? choice.text : "…",
            ...(typeof choice.next === "string" ? { next: choice.next } : {}),
            ...(choice.end === true ? { end: true } : {}),
          }))
      : [];
    nodes[key] = { text, choices };
  }

  return { id, start, nodes };
}

/**
 * 造一个对话场景。
 *
 * 注意：当前节点存在闭包里，**没有进 core.scene**——所以存档不会恢复「说到第几句」。
 * 第一版接受这个限制（场景层只保证「在对话里」，不保证「说到哪」）。
 */
export function createDialogScene(script: DialogScript): Scene {
  let nodeId = script.start;

  return {
    id: "dialog",
    input: [...Array.from({ length: MAX_CHOICES }, (_, i) => `choice${i + 1}`), "close"],

    handle(command: string, _context: SceneContext): SceneResult {
      if (command === "close") {
        return { next: { op: "pop" } };
      }

      const node = script.nodes[nodeId];
      if (node === undefined) {
        return { next: { op: "pop" } };
      }

      const index = Number(command.replace("choice", "")) - 1;
      const choice = node.choices[index];
      if (choice === undefined) {
        // 越界：不崩、不静默切场景，留给宿主提示
        return { effects: [] };
      }

      if (choice.end === true || choice.next === undefined) {
        return { next: { op: "pop" } };
      }

      if (script.nodes[choice.next] === undefined) {
        throw new Error(`对话 ${script.id} 指向了不存在的节点：${choice.next}`);
      }

      nodeId = choice.next;
      return { effects: [] };
    },

    /** 存档：只记当前节点 id。 */
    snapshot(): JsonValue {
      return { node: nodeId };
    },

    /** 读档：回到那一句。 */
    restore(state: JsonValue): void {
      const data = typeof state === "object" && state !== null ? (state as Record<string, JsonValue>) : {};
      if (typeof data.node === "string" && script.nodes[data.node] !== undefined) {
        nodeId = data.node;
      }
    },

    /** 给客户端渲染用的视图。 */
    describe(): JsonValue {
      const node = script.nodes[nodeId] ?? { text: "", choices: [] };
      const view: DialogView = { text: node.text, choices: node.choices.map((choice) => choice.text) };
      return view as unknown as JsonValue;
    },
  };
}
