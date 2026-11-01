// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 尺寸策略：把「谁可以让步」压缩成 5 档，翻译成 flex。
 *
 * 为什么只有 5 档：Qt 的七档在纯 flexbox 下有两对不可区分
 * （Fixed≡Minimum、Maximum≡Preferred），保留更常用的名字即可。
 *
 * 这个文件是整套 UI 里唯一需要「判断」的地方，也是唯一必须能单测的地方：
 * 布局出问题时，先用三行断言在这里复现；复现不了，说明 bug 不在布局层。
 */

export type SizePolicy = "fixed" | "fit" | "fill" | "grow" | "ratio";

/** 五档对应的 flex 三元组：grow / shrink / basis。 */
const FLEX: Record<SizePolicy, readonly [number, number, string]> = {
  fixed: [0, 0, "auto"], // 不伸不缩：按钮、图标
  fit: [0, 1, "auto"], // 可压不可长：标签、说明（默认）
  fill: [1, 1, "auto"], // 占满剩余：主区域、滑块
  grow: [1, 0, "auto"], // 只长不缩：至少这么大，富余也要
  ratio: [1, 1, "0"], // 忽略内容，纯比例：等分栏
};

/** 默认档位是 fit：和 CSS 的 `0 1 auto`、Qt 的 Preferred 一致。 */
export const DEFAULT_POLICY: SizePolicy = "fit";

/**
 * 生成 flex 简写。
 *
 * weight 只在 fill / grow / ratio 上生效——fixed 和 fit 没有 grow，
 * 传了也只会被忽略（文档里写清楚，否则会被当成 bug）。
 */
export function flexStyle(policy: SizePolicy = DEFAULT_POLICY, weight = 1): string {
  const triple = FLEX[policy];
  if (triple === undefined) {
    throw new Error(`未知的尺寸策略：${String(policy)}`);
  }
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error(`weight 必须是正数，收到 ${weight}`);
  }

  const [grow, shrink, basis] = triple;
  const scaled = grow === 0 ? 0 : grow * weight;
  return `flex: ${scaled} ${shrink} ${basis}`;
}

/** 这一档会不会吃掉富余空间。 */
export function grows(policy: SizePolicy): boolean {
  return FLEX[policy][0] > 0;
}

/** 这一档会不会被压缩。 */
export function shrinks(policy: SizePolicy): boolean {
  return FLEX[policy][1] > 0;
}
