// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 开发日志：给「排查问题的人」看，不是给玩家看。
 *
 * 和玩家日志的区别：
 *   开发日志   完整、结构化、每条效果都记，可以拿来回放
 *   玩家日志   有取舍、有人话、可以合并（以后单独做）
 *
 * 所以这里不做好看的事：只保证「谁在什么时候，因为什么，改了什么」都能查到。
 */

import { type LogEntry } from "../../engine/core/src/time.ts";
import { type JsonValue } from "../../engine/core/src/time.ts";

export interface DevLogLine {
  readonly tick: number;
  readonly seq: number;
  /** "action" 表示一次意图，"effect" 表示一次落地。 */
  readonly phase: "action" | "effect";
  readonly text: string;
}

export interface DevLogOptions {
  /** 只保留最近多少条，默认 500。 */
  readonly limit?: number;
}

/**
 * 环形缓冲：满了丢最旧的。
 *
 * 不丢的话，玩一小时的日志能把内存吃光——而排查问题只需要最近的那一段。
 */
export class DevLog {
  private readonly limit: number;
  private buffer: DevLogLine[] = [];

  constructor(options: DevLogOptions = {}) {
    this.limit = options.limit ?? 500;
  }

  /** 一次意图：谁想做什么，带什么参数。 */
  action(tick: number, tag: string, params: JsonValue): void {
    this.push({ tick, seq: 0, phase: "action", text: `→ ${tag} ${compact(params)}` });
  }

  /** 一条落地的事件。 */
  effect(entry: LogEntry): void {
    this.push({
      tick: entry.lTick,
      seq: entry.seq,
      phase: "effect",
      text: `${entry.kind} ${compact(entry.data)}`,
    });
  }

  lines(): readonly DevLogLine[] {
    return this.buffer;
  }

  /** 最近 n 条，给界面用。 */
  tail(n: number): readonly DevLogLine[] {
    return this.buffer.slice(-n);
  }

  clear(): void {
    this.buffer = [];
  }

  private push(line: DevLogLine): void {
    this.buffer.push(line);
    if (this.buffer.length > this.limit) {
      this.buffer = this.buffer.slice(this.buffer.length - this.limit);
    }
  }
}

/** 紧凑 JSON：去掉空格，长字符串截断。 */
export function compact(value: JsonValue, max = 160): string {
  const text = JSON.stringify(value);
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…`;
}

/** 一条日志行的人类可读形式（控制台 / 面板都用它）。 */
export function formatLine(line: DevLogLine): string {
  const tick = String(line.tick).padStart(4, " ");
  const seq = String(line.seq).padStart(3, " ");
  return `[${tick}.${seq}] ${line.text}`;
}
