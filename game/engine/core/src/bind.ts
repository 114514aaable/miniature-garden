// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 「对接」：两边各自声明自己能接什么，再算谁和谁接得上。
 *
 * 为什么单独一个模块：这种结构不止「通行」会用——
 *   通行   物种 surfaces  ×  地形 surface
 *   武器   伤害类型     ×  护甲吸收
 *   语言   说的语种     ×  听得懂的语种
 *
 * 两边**各自编码、互不引用**：加一个物种不用改地形，
 * 加一个地形也不用改物种。对接在初始化时算一次。
 */

export interface Declaration {
  /** 这一方是谁（模板 id、地形名…）。 */
  readonly id: string;
  /** 它声明的接口编码。 */
  readonly codes: readonly string[];
}

export interface Connection {
  /** 两边能不能接上（任意一个编码相同即可）。 */
  isConnected(leftId: string, rightId: string): boolean;
  /** 出现在声明里、但另一边完全没有的编码——多半是拼错了。 */
  readonly unknown: readonly string[];
  /** 接不上任何右边的左边（比如某个物种哪种地形都过不去）。 */
  readonly unusedLeft: readonly string[];
  /** 接不上任何左边的右边（比如某种地形谁都不用它）。 */
  readonly unusedRight: readonly string[];
}

/**
 * @param left   左边（物种 / 武器 / 语言…）
 * @param right  右边（地形 / 护甲 / 语种…）
 * @param vocabulary 可选的已知词表；给了就顺便查出「不在词表里」的编码
 */
export function connectDeclarations(
  left: readonly Declaration[],
  right: readonly Declaration[],
  vocabulary?: readonly string[],
): Connection {
  const rightCodes = new Map(right.map((item) => [item.id, new Set(item.codes)]));

  const links = new Map<string, boolean>();
  const touchedLeft = new Set<string>();
  const touchedRight = new Set<string>();

  const unknown = new Set<string>();
  const known = vocabulary === undefined ? null : new Set(vocabulary);
  const noteUnknown = (codes: readonly string[]) => {
    if (known === null) return;
    for (const code of codes) if (!known.has(code)) unknown.add(code);
  };

  for (const one of left) {
    noteUnknown(one.codes);
    for (const other of right) {
      noteUnknown(other.codes);

      const set = rightCodes.get(other.id) as Set<string>;
      const connected = one.codes.some((code) => set.has(code));
      links.set(one.id + "\u0000" + other.id, connected);
      if (connected) {
        touchedLeft.add(one.id);
        touchedRight.add(other.id);
      }
    }
  }

  return {
    isConnected(leftId, rightId) {
      return links.get(leftId + "\u0000" + rightId) ?? false;
    },
    unknown: [...unknown].sort(),
    unusedLeft: left.filter((item) => !touchedLeft.has(item.id)).map((item) => item.id).sort(),
    unusedRight: right.filter((item) => !touchedRight.has(item.id)).map((item) => item.id).sort(),
  };
}
