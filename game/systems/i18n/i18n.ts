// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * i18n：界面文字走 key，不写死在代码里。
 *
 * 三条规矩：
 *   1. 找不到 key 时**显示 key 本身**，不显示空白——空白最难查；
 *   2. 参数用 `{name}` 占位，保持简单，不做 ICU 复数规则（需要时再加）；
 *   3. 语言包是普通对象，可以用 JSON 存，也可以让 mod 覆盖。
 */

export type Messages = Readonly<Record<string, string>>;

export interface Translator {
  /** 当前语言，例如 "zh-CN"。 */
  readonly locale: string;
  t(key: string, params?: Readonly<Record<string, string | number>>): string;
  has(key: string): boolean;
}

/** 缺少翻译时的行为：返回 key（便于一眼看出漏了哪条）。 */
export const MISSING = Symbol("missing");

export function createTranslator(locale: string, messages: Messages): Translator {
  return {
    locale,
    has(key) {
      return Object.prototype.hasOwnProperty.call(messages, key);
    },
    t(key, params) {
      const template = messages[key];
      if (template === undefined) {
        return key;
      }
      if (params === undefined) {
        return template;
      }
      return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
        const value = params[name];
        return value === undefined ? whole : String(value);
      });
    },
  };
}

/**
 * 合并多个语言包：后面的覆盖前面的。
 *
 * 用来做「内置中文 + mod 覆盖」——mod 只需要写它改的那几条。
 */
export function mergeMessages(...layers: readonly Messages[]): Messages {
  return Object.assign({}, ...layers) as Record<string, string>;
}
