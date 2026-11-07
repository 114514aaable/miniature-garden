// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 致死：单独一条规则。写拦截器判定「这次写致死」后广播它。
 *
 * 默认实现只是 despawn；世界包可以换成掉落、倒地、复活……
 */

import { type JsonValue } from "../time.ts";
import { type Signature } from "../event/registry.ts";
import { type EvaluateContext } from "../event/evaluate.ts";

export const deathSignature: Signature = {
  tag: "base.death",
  params: {
    t: "object",
    fields: { handle: { t: "int" }, cause: { t: "str" } },
  },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
};

export function deathHandler(params: JsonValue, _context: EvaluateContext): JsonValue {
  const handle = (params as Record<string, number>).handle;
  return { ok: true, effects: [{ kind: "despawn", handle }] };
}
