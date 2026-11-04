// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 求值器：把一棵信封树跑成结果。
 *
 * 规则（见契约 §6 / §7）：
 *   1. 后序：先算全部子节点，再把结果交给父节点。
 *   2. 深度上限：默认 3，硬上限 8。
 *   3. 子节点失败 → 父节点失败（v0 没有容错语法）。
 *   4. 任何异常都被捕获成诊断，不会把整条管线带崩。
 *
 * 它不写世界：只把结果交回去。世界由 store 落地。
 */

import { type JsonValue } from "../time.ts";
import { type LinkTable } from "./registry.ts";
import { validate } from "./schema.ts";
import { type WorldView } from "./view.ts";

export interface ObjectRef {
  readonly handle: number;
  readonly kind: "entity" | "space";
}

/** 作者写的信封：没有时间、没有来源。 */
export interface Envelope {
  readonly id: number;
  readonly tag: string;
  readonly params: JsonValue;
  readonly refs?: readonly ObjectRef[];
  readonly priority?: number;
  readonly children?: readonly Envelope[];
}

/** 运行期上下文。时间、来源、深度都是框架补的。 */
export interface Frame {
  readonly envelope: Envelope;
  readonly source: string;
  readonly lTick: number;
  readonly seq: number;
  readonly depth: number;
  readonly parentId: number | null;
}

/** 宿主给规则的可选能力（遍历、选定之类，规则自己不实现）。 */
export interface RuleTools {
  /** 命名形状 → 偏移。 */
  offsets?(shape: string): readonly { readonly dx: number; readonly dy: number }[] | undefined;
  /** 在给定格子里按命名过滤挑目标。 */
  select?(
    cells: readonly { readonly x: number; readonly y: number }[],
    filter: string,
    options?: { readonly exclude?: number; readonly limit?: number },
  ): readonly number[];
}

export interface EvaluateContext {
  readonly frame: Frame;
  readonly view: WorldView;
  readonly children: readonly JsonValue[];
  /** 宿主注入的能力（可选）。 */
  readonly tools?: RuleTools;
}

export type Handler = (params: JsonValue, context: EvaluateContext) => JsonValue;

/** sym → 处理器。运行期产物，不参与哈希，也不能发给别人。 */
export type HandlerMap = ReadonlyMap<number, Handler>;

export interface Diagnostic {
  readonly tag: string;
  readonly envelopeId: number;
  readonly lTick: number;
  readonly message: string;
}

export type EvaluateResult =
  | { readonly ok: true; readonly value: JsonValue; readonly diagnostics: readonly Diagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

export interface EvaluateOptions {
  readonly source?: string;
  readonly maxDepth?: number;
  /** 宿主能力，透传给处理器。 */
  readonly tools?: RuleTools;
}

export const DEFAULT_MAX_DEPTH = 3;
export const HARD_MAX_DEPTH = 8;

export function evaluate(
  envelope: Envelope,
  link: LinkTable,
  handlers: HandlerMap,
  view: WorldView,
  options: EvaluateOptions = {},
): EvaluateResult {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > HARD_MAX_DEPTH) {
    throw new Error(`深度上限必须是 1..${HARD_MAX_DEPTH} 的整数，收到 ${maxDepth}`);
  }

  const diagnostics: Diagnostic[] = [];
  let seq = 0;

  const fail = (frame: Frame | null, message: string): null => {
    diagnostics.push({
      tag: frame?.envelope.tag ?? "?",
      envelopeId: frame?.envelope.id ?? -1,
      lTick: view.tick,
      message,
    });
    return null;
  };

  const walk = (node: Envelope, depth: number, parentId: number | null): JsonValue | null => {
    seq += 1;
    const frame: Frame = {
      envelope: node,
      source: options.source ?? "unknown",
      lTick: view.tick,
      seq,
      depth,
      parentId,
    };

    if (depth > maxDepth) {
      return fail(frame, `超过深度上限 ${maxDepth}`);
    }

    const sym = link.tags.get(node.tag);
    if (sym === undefined) {
      return fail(frame, `未注册的标签：${node.tag}`);
    }

    const signature = link.signatures[sym];
    const handler = handlers.get(sym);
    if (handler === undefined) {
      return fail(frame, `标签已注册但没有处理器：${node.tag}`);
    }

    try {
      validate(node.params, signature.params, "$params");
    } catch (error) {
      return fail(frame, describe(error));
    }

    // 后序：先把子节点全算完。任何一个失败，父节点也失败（v0 无容错）。
    const children: JsonValue[] = [];
    for (const child of node.children ?? []) {
      const result = walk(child, depth + 1, node.id);
      if (result === null) {
        return fail(frame, `子节点 ${child.id}（${child.tag}）失败`);
      }
      children.push(result);
    }

    let value: JsonValue;
    try {
      value = handler(node.params, { frame, view, children, ...(options.tools === undefined ? {} : { tools: options.tools }) });
    } catch (error) {
      return fail(frame, describe(error));
    }

    if (!signature.returnsEffects) {
      try {
        validate(value, signature.result, "$result");
      } catch (error) {
        return fail(frame, describe(error));
      }
    }

    return value;
  };

  const value = walk(envelope, 0, null);
  if (value === null) {
    return { ok: false, diagnostics };
  }
  return { ok: true, value, diagnostics };
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
