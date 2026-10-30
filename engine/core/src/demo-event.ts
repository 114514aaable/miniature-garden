// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * Event 管线的第一次完整跑通。
 *
 * 跑法：
 *   node engine/core/src/demo-event.ts
 *
 * 链路：信封 → 求值（后序）→ 效果汇聚 → 提交 → step → 世界真的变了
 *
 * 这个 demo 故意用「父节点 + 两个子节点」，为了展示契约 §9 的那条：
 * 效果是数据，子节点产生、父节点合并，只有根节点的效果才会落地。
 */

import { Space } from "./space.ts";
import { Store } from "./store.ts";
import { type JsonValue } from "./time.ts";
import { collectEffects, submitEffects } from "./event/effects.ts";
import { type Envelope, evaluate, type EvaluateContext, type HandlerMap } from "./event/evaluate.ts";
import { Registry } from "./event/registry.ts";
import { createWorldView } from "./event/view.ts";

const space = new Space(1, 4, 4);
const store = new Store([space]);

const registry = new Registry();

registry.define({
  tag: "core.paint",
  params: {
    t: "object",
    fields: { space: { t: "int" }, x: { t: "int" }, y: { t: "int" }, value: { t: "int" } },
  },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
});

registry.define({
  tag: "core.paint2",
  params: { t: "object", fields: {} },
  result: { t: "any" },
  returnsEffects: true,
  needsTimestamp: false,
});

const link = registry.link();

function effectsOf(value: JsonValue): JsonValue[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }
  const effects = (value as Record<string, JsonValue>).effects;
  return Array.isArray(effects) ? effects : [];
}

const handlers: HandlerMap = new Map([
  [
    link.tags.get("core.paint") as number,
    (params: JsonValue): JsonValue => {
      const p = params as Record<string, JsonValue>;
      return {
        effects: [
          {
            kind: "terrain",
            space: p.space,
            cell: { x: p.x, y: p.y },
            value: p.value,
          },
        ],
      };
    },
  ],
  [
    link.tags.get("core.paint2") as number,
    (_params: JsonValue, context: EvaluateContext): JsonValue => {
      // 父节点把子节点的效果合并起来——这是「效果是数据」的意义。
      const merged: JsonValue[] = [];
      for (const child of context.children) {
        merged.push(...effectsOf(child));
      }
      return { effects: merged };
    },
  ],
]);

const envelope: Envelope = {
  id: 1,
  tag: "core.paint2",
  params: {},
  children: [
    { id: 2, tag: "core.paint", params: { space: 1, x: 1, y: 1, value: 2 } },
    { id: 3, tag: "core.paint", params: { space: 1, x: 2, y: 2, value: 3 } },
  ],
};

console.log("=== Event 管线 ===");
console.log(`信封：${envelope.tag}，子节点 ${envelope.children?.length ?? 0} 个`);

const view = createWorldView([space], { tick: store.now() });
const result = evaluate(envelope, link, handlers, view);

if (!result.ok) {
  console.error("求值失败：");
  for (const d of result.diagnostics) {
    console.error(`  [${d.tag}#${d.envelopeId}] ${d.message}`);
  }
  process.exitCode = 1;
} else {
  const effects = collectEffects(result.value);
  console.log(`求值：ok，效果 ${effects.length} 条`);

  submitEffects(store, effects);
  const logs = store.step();

  console.log(`step：时间 → ${store.now()}，落地 ${logs.length} 条记录`);
  for (const entry of logs) {
    console.log(`  #${entry.id} ${entry.kind} lTick=${entry.lTick} seq=${entry.seq} ${JSON.stringify(entry.data)}`);
  }

  console.log(`回读：(1,1)=${space.terrainAt({ x: 1, y: 1 })}  (2,2)=${space.terrainAt({ x: 2, y: 2 })}`);
  console.log(`链头：${store.headHash}`);
}
