// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 数据体检：数据化之后，规则要的字段，包里到底有没有。
 *
 * 起因：敌人伤害数据化后，AI 改成必须有 core.melee，
 * 但模板没跟上——规则每回合静默返回「不知道打多重」，
 * 表现出来就是「敌人不动手」，查了很久。
 *
 * 这里只做「组合看起来不对」的检查，不代替人工判断。
 *
 * 用法：node tools/check-data.mjs [世界 id]
 */

import { readPack } from "./pack-reader.mjs";
import { loadWorld } from "../game/engine/core/src/pack/load.ts";
import { mergePacks } from "../game/engine/core/src/pack/merge.ts";
import { orderPacks } from "../game/engine/core/src/pack/order.ts";
import { RULE_TABLE } from "../game/systems/rules/index.ts";
import { DEFAULT_CLOCK } from "../game/engine/core/src/rules/clock.ts";

const worldId = process.argv[2] ?? "official.normal";

function loadPacks(id) {
  const root = readPack("game/worlds/" + id);
  const contents = [root];
  const seen = new Set([root.pack.id]);
  const queue = Object.keys(root.pack.requires ?? {});

  while (queue.length > 0) {
    const next = queue.shift();
    if (seen.has(next)) continue;
    seen.add(next);
    const content = readPack("game/worlds/" + next);
    contents.push(content);
    queue.push(...Object.keys(content.pack.requires ?? {}));
  }

  const byId = new Map(contents.map((content) => [content.pack.id, content]));
  const ordered = orderPacks(contents.map((content) => content.pack)).map((pack) => byId.get(pack.id));
  return loadWorld(mergePacks(ordered));
}

const loaded = loadPacks(worldId);
const templateIds = [...loaded.templates.ids()].sort();

const problems = [];
const notes = [];

for (const id of templateIds) {
  const template = loaded.templates.get(id);
  const has = (name) => template.components[name] !== undefined;

  // 会掉血但不会还手：要么是靶子，要么忘了 core.melee
  if (has("core.health") && !has("core.melee") && !has("core.item")) {
    notes.push(`${id}：有 core.health 但没有 core.melee——它只能挨打，不会还手`);
  }

  // 有阵营但不会掉血
  if (has("core.disposition") && !has("core.health") && !has("core.dialog")) {
    problems.push(`${id}：有 core.disposition 但没有 core.health——点击它按「敌对」处理，却打不掉`);
  }

  // 能对话但没有阵营：点击默认行为拿不到分类
  if (has("core.dialog") && !has("core.disposition")) {
    notes.push(`${id}：有 core.dialog 但没有 core.disposition——点击时会按「中立」算`);
  }

  // 能捡但不能用
  if (has("core.item") && !has("core.use")) {
    notes.push(`${id}：有 core.item 但没有 core.use——捡起来用不了`);
  }

  // 有行动方式但地表不存在这种面
  if (has("core.locomotion")) {
    const surfaces = template.components["core.locomotion"].surfaces ?? [];
    for (const surface of surfaces) {
      const known = [...loaded.terrains.values()].some((terrain) => terrain.surface === surface);
      if (!known) problems.push(`${id}：行动方式用了 surface "${surface}"，但没有任何地形是这个面`);
    }
  }
}

// 技能：成本键必须在时钟表里（写错会 500）
for (const rule of RULE_TABLE) {
  const skill = rule.signature.skill;
  if (skill === undefined) continue;
  if (DEFAULT_CLOCK.costs[skill.cost] === undefined) {
    problems.push(`技能 ${rule.signature.tag}：成本键 "${skill.cost}" 不在时钟表里`);
  }
}

// 地形：没有 surface 就只能退回 passable（人和鱼都按同一套判断）
for (const terrain of loaded.terrains.values()) {
  if (terrain.surface === undefined) {
    notes.push(`地形 ${terrain.id}（${terrain.code ?? terrain.name}）：没有 surface，通行只能退回 passable`);
  }
}

// 技能：声明的形状/过滤必须存在（写错了会静默「谁都能打」）
for (const rule of RULE_TABLE) {
  const target = rule.signature.skill?.target;
  if (target === undefined) continue;
  if (target.shape !== undefined && loaded.traversal.shapes[target.shape] === undefined) {
    problems.push(`技能 ${rule.signature.tag}：形状 "${target.shape}" 不在 base 的 traversal 里`);
  }
  if (target.filter !== undefined && loaded.traversal.filters[target.filter] === undefined) {
    problems.push(`技能 ${rule.signature.tag}：过滤 "${target.filter}" 不在 base 的 traversal 里`);
  }
}

// 规则：world.rules 里写了但库里没有
for (const tag of loaded.rules) {
  if (!tag.startsWith("base.") && !tag.startsWith("core.")) {
    notes.push(`规则 ${tag}：命名不像内置规则，确认它已注册`);
  }
}

for (const entity of loaded.entities) {
  const space = loaded.spaces[entity.space];
  if (space === undefined) continue;
  const terrain = loaded.terrains.get(space.terrainAt(entity.pos));
  if (terrain !== undefined && !terrain.passable) {
    notes.push(`实体 ${entity.template} @(${entity.pos.x}, ${entity.pos.y})：站在不可通行地形上`);
  }
}

console.log(`世界：${worldId}`);
console.log(`模板：${templateIds.length} 个 → ${templateIds.join(", ")}`);
console.log("");

if (problems.length === 0) {
  console.log("没发现明显问题");
} else {
  console.log(`问题（${problems.length}）：`);
  for (const line of problems) console.log("  ✗ " + line);
}

if (notes.length > 0) {
  console.log("");
  console.log(`提醒（${notes.length}）：`);
  for (const line of notes) console.log("  · " + line);
}

process.exit(problems.length === 0 ? 0 : 1);
