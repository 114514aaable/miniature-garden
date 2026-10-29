// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 注册表：标签 → 签名，以及加载期的「链接」。
 *
 * 这一层只做三件事：
 *   1. 登记签名（同一个标签登记两次就报错）；
 *   2. 链接：按标签字典序分配整数编号（sym），产出不可变的链接表；
 *   3. 算哈希：让「这份链接」成为世界身份的一部分。
 *
 * 为什么编号要按字典序：
 *   同样一组标签，不管你在代码里先 define 谁，链接结果必须一样。
 *   否则同一个世界包在两台机器上会得到不同的 sym，存档和回放全废。
 */

import { type Schema } from "./schema.ts";
import { type JsonValue, canonicalize, hashText } from "../time.ts";

export interface Signature {
  readonly tag: string;
  /** 参数结构。payload 必须长成这样。 */
  readonly params: Schema;
  /** 返回类型。 */
  readonly result: Schema;
  /** 返回的是不是 Effect[]（效果是数据，见契约 §9）。 */
  readonly returnsEffects: boolean;
  /** 函数自己声明需不需要时间戳，不由包声明。 */
  readonly needsTimestamp: boolean;
}

export interface LinkTable {
  /** 标签名 → 整数编号。 */
  readonly tags: ReadonlyMap<string, number>;
  /** 编号 → 签名，下标就是 sym。 */
  readonly signatures: readonly Signature[];
  /** 链接内容的哈希，参与世界身份。 */
  readonly hash: string;
}

/** 标签格式：小写、至少两段（命名空间 + 动词）、最多四段。 */
const TAG_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){1,3}$/;

export class Registry {
  private readonly pending = new Map<string, Signature>();

  /** 登记一个签名。同一标签登记两次直接报错——不允许悄悄覆盖。 */
  define(signature: Signature): void {
    if (!TAG_PATTERN.test(signature.tag)) {
      throw new Error(
        `标签格式非法："${signature.tag}"，应为小写命名空间形式，如 "core.move"`,
      );
    }
    if (this.pending.has(signature.tag)) {
      throw new Error(`标签重复登记："${signature.tag}"`);
    }
    this.pending.set(signature.tag, signature);
  }

  has(tag: string): boolean {
    return this.pending.has(tag);
  }

  /** 链接：分配编号、产出不可变表、算哈希。可以重复调用，结果一致。 */
  link(): LinkTable {
    const sorted = [...this.pending.values()].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));

    const tags = new Map<string, number>();
    sorted.forEach((signature, sym) => tags.set(signature.tag, sym));

    const manifest = sorted.map((signature, sym) => ({
      sym,
      tag: signature.tag,
      params: signature.params,
      result: signature.result,
      returnsEffects: signature.returnsEffects,
      needsTimestamp: signature.needsTimestamp,
    }));

    return {
      tags,
      signatures: sorted,
      hash: hashText(canonicalize(manifest as unknown as JsonValue)),
    };
  }
}
