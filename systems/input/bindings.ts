// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 按键映射：`event.code` → 命令字符串。
 *
 * 为什么用 code 而不是 key：key 受大小写、输入法、键盘布局影响
 * （「大写键无效」就是这么来的）；code 是物理按键位置，稳定。
 *
 * 命令是字符串，和游戏里的动作同构：
 *   move:w / move:a / skill:core.attack / ui:settings
 *
 * 这样界面只需要「查表 → 分发」，不认识任何规则。
 */

export type Bindings = Readonly<Record<string, string>>;

/** 默认键位。以后设置界面就是改这张表。 */
export const DEFAULT_BINDINGS: Bindings = {
  KeyW: "move:w",
  KeyA: "move:a",
  KeyS: "move:s",
  KeyD: "move:d",
  KeyE: "skill:core.take",
  KeyR: "skill:core.drop",
  KeyF: "skill:core.attack",
  Space: "skill:core.wait",
  Escape: "ui:settings",
  KeyI: "ui:inventory",
};

export interface ParsedCommand {
  readonly kind: string;
  readonly value: string;
}

/** "move:w" → { kind: "move", value: "w" }。没有冒号时 kind 为命令本身。 */
export function parseCommand(command: string): ParsedCommand {
  const at = command.indexOf(":");
  if (at < 0) {
    return { kind: command, value: "" };
  }
  return { kind: command.slice(0, at), value: command.slice(at + 1) };
}

/** 按物理键查命令；没有绑定返回 undefined。 */
export function commandFor(bindings: Bindings, code: string): string | undefined {
  return bindings[code];
}

/** 改一个键位，返回新表（不改原表）。 */
export function bind(bindings: Bindings, code: string, command: string): Bindings {
  return { ...bindings, [code]: command };
}

/** 解绑。 */
export function unbind(bindings: Bindings, code: string): Bindings {
  const next = { ...bindings };
  delete next[code];
  return next;
}

/** 哪些键绑到了同一个命令（用于设置界面提示冲突）。 */
export function boundTo(bindings: Bindings, command: string): string[] {
  return Object.entries(bindings)
    .filter(([, value]) => value === command)
    .map(([code]) => code)
    .sort();
}

/**
 * 合并用户设置：用户表覆盖默认表。
 *
 * 用户没碰过的键沿用默认，改过的以用户为准。
 */
export function resolveBindings(user: Bindings | null | undefined, defaults: Bindings = DEFAULT_BINDINGS): Bindings {
  return { ...defaults, ...(user ?? {}) };
}
