// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 场景：世界现在处于哪种「玩法状态」。
 *
 * 它和窗口的区别：
 *   场景   换掉玩法（谁在模拟、时间怎么走、输入是什么）  → explore / battle / dialog
 *   窗口   还是同一个玩法，只是盖了一层界面              → 背包 / 设置 / 读档
 *
 * 核心原则：**场景返回「意图」，宿主负责执行。**
 * 和规则返回 effects 是同一个模式——可测、可回放、不产生隐式状态。
 */

import { type JsonValue } from "../../engine/core/src/time.ts";
import { type Effect } from "../../engine/core/src/store.ts";

/** 场景想做的事：改世界（effects）或切场景（next）。 */
export interface SceneResult {
  readonly effects?: readonly Effect[];
  readonly next?: {
    readonly op: "push" | "replace" | "pop";
    /** push / replace 必填；pop 不用。 */
    readonly id?: string;
    readonly params?: JsonValue;
  };
}

export interface SceneContext {
  /** 当前 tick。 */
  readonly now: number;
  /** core.scene.params 原样传进来（npc 句柄、脚本 id…）。 */
  readonly params: JsonValue;
}

/**
 * 一个场景。
 *
 * `input` 是这个场景认的命令集合——AI 问「现在能做什么」时，
 * 答案就是栈顶场景的这张表（见 docs/systems/agent.md）。
 */
export interface Scene {
  readonly id: string;
  readonly input: readonly string[];
  onEnter?(context: SceneContext): readonly Effect[];
  onExit?(context: SceneContext): readonly Effect[];
  handle(command: string, context: SceneContext): SceneResult;
  /** 给客户端的渲染数据（形状由场景自己决定）。 */
  describe?(): JsonValue;
}

/** 场景栈的一层。 */
export interface SceneLayer {
  readonly id: string;
  readonly params: JsonValue;
}

/**
 * 场景栈。
 *
 * 一开始只有一层（explore），但**结构上就是栈**——
 * 以后「对话里开店」不用改结构。
 */
export class SceneStack {
  private layers: SceneLayer[] = [];
  private readonly registry: ReadonlyMap<string, Scene>;

  constructor(registry: ReadonlyMap<string, Scene>, start: SceneLayer) {
    this.registry = registry;
    this.push(start.id, start.params);
  }

  /** 栈顶场景。 */
  top(): Scene {
    const layer = this.layers[this.layers.length - 1];
    const scene = this.registry.get(layer.id);
    if (scene === undefined) {
      throw new Error(`没有这个场景：${layer.id}`);
    }
    return scene;
  }

  /** 栈顶的层（带 params）。 */
  topLayer(): SceneLayer {
    return this.layers[this.layers.length - 1];
  }

  /** 当前可用的命令（栈顶声明的）。 */
  input(): readonly string[] {
    return this.top().input;
  }

  depth(): number {
    return this.layers.length;
  }

  /** 全部层（调试与存档用）。 */
  all(): readonly SceneLayer[] {
    return [...this.layers];
  }

  push(id: string, params: JsonValue = {}): void {
    if (!this.registry.has(id)) {
      throw new Error(`没有这个场景：${id}`);
    }
    this.layers.push({ id, params });
  }

  replace(id: string, params: JsonValue = {}): void {
    if (!this.registry.has(id)) {
      throw new Error(`没有这个场景：${id}`);
    }
    this.layers[this.layers.length - 1] = { id, params };
  }

  /** 弹出栈顶；只剩一层时保持在那一层（explore 永远在）。 */
  pop(): void {
    if (this.layers.length > 1) {
      this.layers.pop();
    }
  }

  /** 把一次输入交给栈顶，返回它的意图。 */
  handle(command: string, now: number): SceneResult {
    const scene = this.top();
    if (!scene.input.includes(command)) {
      throw new Error(`场景 ${scene.id} 不认识命令：${command}`);
    }
    return scene.handle(command, { now, params: this.topLayer().params });
  }
}

/** 从 core.scene 组件读初始层；没有就用 explore。 */
export function sceneFromComponent(value: JsonValue | undefined): SceneLayer {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { id: "explore", params: {} };
  }
  const data = value as Record<string, JsonValue>;
  const id = typeof data.id === "string" && data.id.length > 0 ? data.id : "explore";
  return { id, params: data.params ?? {} };
}
