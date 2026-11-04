// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 噪声：把「种子 + 坐标」变成 0..1 的值。
 *
 * 三条约束：
 *   1. **确定性**——同样的输入永远同样的输出，不存任何状态；
 *   2. **每格独立**——可以按任意顺序算、可以并行；
 *   3. 不用 Math.random，全用位运算（跨平台一致）。
 *
 * 值噪声是最底层；fbm / ridged 都是它的组合。
 */

/** 32 位混合（和 traversal 那边同一种思路，这里专门给坐标用）。 */
function mix(value: number): number {
  let x = value >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97) >>> 0;
  return (x ^ (x >>> 15)) >>> 0;
}

/** 格点上的伪随机值（0..1）。 */
function lattice(seed: number, x: number, y: number): number {
  const h = mix((seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1)) >>> 0);
  return h / 0x100000000;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * 值噪声：格点随机 + 双线性 + 平滑插值。
 *
 * `scale` = 多少个格子算一个特征（越小越碎）。
 */
export function valueNoise(seed: number, x: number, y: number, scale: number): number {
  const s = Math.max(1, scale);
  const gx = x / s;
  const gy = y / s;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const tx = smooth(gx - x0);
  const ty = smooth(gy - y0);

  const v00 = lattice(seed, x0, y0);
  const v10 = lattice(seed, x0 + 1, y0);
  const v01 = lattice(seed, x0, y0 + 1);
  const v11 = lattice(seed, x0 + 1, y0 + 1);

  const top = v00 + (v10 - v00) * tx;
  const bottom = v01 + (v11 - v01) * tx;
  return top + (bottom - top) * ty;
}

export interface FbmOptions {
  readonly scale: number;
  readonly octaves?: number;
  /** 每个八度缩小多少（默认 0.5）。 */
  readonly persistence?: number;
}

/** 多个八度叠加：大起伏 + 小细节。 */
export function fbm(seed: number, x: number, y: number, options: FbmOptions): number {
  const octaves = Math.max(1, Math.min(8, Math.floor(options.octaves ?? 4)));
  const persistence = options.persistence ?? 0.5;

  let total = 0;
  let amplitude = 1;
  let scale = options.scale;
  let norm = 0;

  for (let octave = 0; octave < octaves; octave += 1) {
    // 每个八度换一个种子，避免不同尺度上出现同样的花纹
    const octaveSeed = (seed + octave * 7919) >>> 0;
    total += valueNoise(octaveSeed, x, y, scale) * amplitude;
    norm += amplitude;
    amplitude *= persistence;
    scale = Math.max(1, scale / 2);
  }

  return total / norm;
}

/** 山脊：把 fbm 折一下，形成「脊线」而不是「丘包」。 */
export function ridged(seed: number, x: number, y: number, options: FbmOptions): number {
  const base = fbm(seed, x, y, options);
  return 1 - Math.abs(base * 2 - 1);
}

/** 按名字取噪声实现（世界配置里写的就是这个名字）。 */
export type NoiseKind = "value" | "fbm" | "ridged";

export const NOISE_KINDS: readonly NoiseKind[] = ["value", "fbm", "ridged"];

export function noiseOf(kind: NoiseKind, seed: number, x: number, y: number, scale: number, octaves = 4): number {
  switch (kind) {
    case "value":
      return valueNoise(seed, x, y, scale);
    case "fbm":
      return fbm(seed, x, y, { scale, octaves });
    case "ridged":
      return ridged(seed, x, y, { scale, octaves });
  }
}
