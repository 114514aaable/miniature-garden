// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 随机数：无状态派发。
 *
 * 不用 Math.random，也不用「一个全局流」——而是：
 *
 *   roll(seed, tick, tag, index) = 纯函数
 *
 * 这样：
 *   - 存档不用存随机状态，读回来还是同一串数；
 *   - 同一 tick 里多次取值靠 index 区分；
 *   - tag 让「命中」和「掉落」用不同的流，互不干扰；
 *   - 回放天然成立。
 *
 * 算法：先把 tag 哈希成整数，再把 (seed, tick, hash, index) 用 splitmix32 搅匀。
 * 不是密码学随机，但对游戏足够，而且跨平台完全一致（只做位运算）。
 */

/** 把字符串哈希成 32 位无符号整数（FNV-1a）。 */
export function hashTag(tag: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < tag.length; i += 1) {
    hash ^= tag.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** splitmix32 的一步：把输入搅成下一个 32 位数。纯位运算，处处一致。 */
function mix(value: number): number {
  let x = value >>> 0;
  x = (x + 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0;
  return (x ^ (x >>> 15)) >>> 0;
}

/**
 * 取一个 [0, 1) 的随机数。
 *
 * index 用于同一 tick 内多次取值；不传就是 0。
 */
export function roll(seed: number, tick: number, tag: string, index = 0): number {
  let state = mix(seed >>> 0);
  state = mix((state ^ (tick >>> 0)) >>> 0);
  state = mix((state ^ hashTag(tag)) >>> 0);
  state = mix((state ^ (index >>> 0)) >>> 0);
  state = mix((state ^ 0x5bf03635) >>> 0);

  // 取高位：splitmix32 的低位质量一般
  return (state >>> 8) / 0x1000000;
}

/**
 * 取 [min, max] 的整数（含两端）。
 *
 * roll 落在 [0,1)，乘上格子数再取整就一定是合法下标。
 */
export function rollInt(seed: number, tick: number, tag: string, index: number, min: number, max: number): number {
  if (max < min) {
    throw new Error(`区间反了：min=${min} max=${max}`);
  }
  const value = roll(seed, tick, tag, index);
  return min + Math.floor(value * (max - min + 1));
}

/** 以 probability 的概率返回 true。 */
export function chance(seed: number, tick: number, tag: string, index: number, probability: number): boolean {
  if (probability <= 0) return false;
  if (probability >= 1) return true;
  return roll(seed, tick, tag, index) < probability;
}
