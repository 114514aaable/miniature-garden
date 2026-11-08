// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 开局选生成器：世界包提供一组「生成方案」，玩家在开始菜单里挑。
 *
 *   generation.pipeline            默认方案
 *   generation.variants            可选方案（名字 → 一串算子）
 *
 * 选不到就退回默认；连默认都没有就报错，不静默生成空图。
 */

import type { Step } from "./pipeline.ts";

export interface GenerationConfig {
  readonly pipeline?: readonly Step[];
  readonly variants?: Readonly<Record<string, readonly Step[]>>;
}

export interface PickedPipeline {
  /** 实际使用的方案名（默认方案叫 "default"）。 */
  readonly name: string;
  readonly steps: readonly Step[];
}

/** 从世界配置 + 开局选项里挑一条流水线。 */
export function pickPipeline(
  generation: GenerationConfig,
  generator: string | undefined,
): PickedPipeline {
  const variants = generation.variants ?? {};

  if (generator !== undefined && generator.length > 0) {
    const chosen = variants[generator];
    if (chosen === undefined) {
      throw new Error(
        `没有这个生成方案："${generator}"（可选：${Object.keys(variants).join(" / ") || "无"}）`,
      );
    }
    return { name: generator, steps: chosen };
  }

  if (generation.pipeline !== undefined && generation.pipeline.length > 0) {
    return { name: "default", steps: generation.pipeline };
  }

  const first = Object.keys(variants)[0];
  if (first !== undefined) return { name: first, steps: variants[first] };

  throw new Error("世界的 generation 既没有 pipeline 也没有 variants");
}
