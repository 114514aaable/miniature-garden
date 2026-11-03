// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 界面配置：所有「可能想调」的东西集中在这里。
 *
 * 为什么单独一个模块：
 *   - 以前尺寸散在 pages.mjs 里，改一次要翻十几处；
 *   - 现在默认值在一处，用户改过的存 localStorage，读的时候合并；
 *   - 以后加设置项，只改这个文件 + 设置面板的一行。
 *
 * 这里只放**表现层**的东西。玩法参数（时钟成本、伤害公式）在世界包里，不放这。
 */

export interface Config {
  /** 底部快捷栏格子边长（px）。 */
  readonly hotbarCell: number;
  /** 背包格子边长（px）。 */
  readonly inventoryCell: number;
  /** 背包每行多少个。 */
  readonly inventoryColumns: number;
  /** 背包每页几行。 */
  readonly inventoryRows: number;
  /** 动画速度（格/秒）。 */
  readonly speed: number;
  /** 开发者模式：显示 tick、调度、意图等调试信息。 */
  readonly devMode: boolean;
  /** 按键映射：物理键 → 命令。 */
  readonly bindings: Readonly<Record<string, string>>;
}

export const DEFAULT_CONFIG: Config = {
  hotbarCell: 38,
  inventoryCell: 38,
  inventoryColumns: 8,
  inventoryRows: 5,
  speed: 10,
  devMode: false,
  bindings: {
    KeyW: "move:w",
    KeyA: "move:a",
    KeyS: "move:s",
    KeyD: "move:d",
    KeyE: "ui:talk",
    KeyR: "skill:core.drop",
    KeyF: "skill:core.attack",
    Space: "skill:core.wait",
    Escape: "ui:settings",
    KeyI: "ui:inventory",
  },
};

const STORAGE_KEY = "nw.config";

/** 读配置：默认值 + 用户改动。坏数据一律退回默认。 */
export function loadConfig(storage: Pick<Storage, "getItem"> = localStorage): Config {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_CONFIG;
    const saved = JSON.parse(raw) as Partial<Config>;
    return { ...DEFAULT_CONFIG, ...saved, bindings: { ...DEFAULT_CONFIG.bindings, ...(saved.bindings ?? {}) } };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** 存配置。只写用户改过的字段也可以，读的时候会合并。 */
export function saveConfig(config: Config, storage: Pick<Storage, "setItem"> = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/** 改一项，返回新配置。 */
export function withConfig(config: Config, patch: Partial<Config>): Config {
  return { ...config, ...patch };
}

/** 改一个键位，返回新配置。 */
export function withBinding(config: Config, code: string, command: string | null): Config {
  const bindings = { ...config.bindings };
  if (command === null) delete bindings[code];
  else bindings[code] = command;
  return { ...config, bindings };
}

/** 把数值夹在合理范围，设置面板加减按到边界时不至于失控。 */
export function clampCell(value: number): number {
  if (!Number.isFinite(value)) return 38;
  return Math.min(96, Math.max(24, Math.round(value)));
}
