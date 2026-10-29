// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 文字版：第一条真规则跑在终端里。
 *
 * 跑法：
 *   node engine/core/src/demo-text.ts              # 交互：w/a/s/d 走，q 退出
 *   node engine/core/src/demo-text.ts "d,d,s,q"    # 脚本：按顺序执行
 *
 * 每一步都是完整链路：输入 → 信封 → 求值 → 效果 → store → 世界改变。
 */

import { createInterface } from "node:readline/promises";

import { collectEffects } from "./event/effects.ts";
import { type Envelope, evaluate } from "./event/evaluate.ts";
import { Registry } from "./event/registry.ts";
import { createWorldView } from "./event/view.ts";
import { moveHandler, moveSignature, WALL } from "./rules/move.ts";
import { Space } from "./space.ts";
import { Store } from "./store.ts";

const WIDTH = 8;
const HEIGHT = 6;

const space = new Space(1, WIDTH, HEIGHT);

// 围墙 + 两段内墙，让地图有点形状
for (let x = 0; x < WIDTH; x++) {
  space.setTerrain({ x, y: 0 }, WALL);
  space.setTerrain({ x, y: HEIGHT - 1 }, WALL);
}
for (let y = 0; y < HEIGHT; y++) {
  space.setTerrain({ x: 0, y }, WALL);
  space.setTerrain({ x: WIDTH - 1, y }, WALL);
}
space.setTerrain({ x: 3, y: 1 }, WALL);
space.setTerrain({ x: 3, y: 2 }, WALL);
space.setTerrain({ x: 5, y: 3 }, WALL);

const store = new Store([space], { templates: { has: () => true } });

store.submit({ kind: "spawn", space: 1, cell: { x: 1, y: 1 }, template: "pc" });
store.submit({ kind: "spawn", space: 1, cell: { x: 4, y: 2 }, template: "npc" });
const spawned = store.step();
const player = spawned[0].data.handle as number;

const registry = new Registry();
registry.define(moveSignature);
const link = registry.link();
const handlers = new Map([[link.tags.get("core.move") as number, moveHandler]]);

const GLYPH: Record<string, string> = { pc: "@", npc: "N" };
const DIRECTIONS: Record<string, { dx: number; dy: number }> = {
  w: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
};

function render(): string {
  const rows: string[] = [];
  for (let y = 0; y < HEIGHT; y++) {
    let row = "";
    for (let x = 0; x < WIDTH; x++) {
      const occupants = space.occupantsAt({ x, y });
      if (occupants.length > 0) {
        const template = store.entity(occupants[0]).template;
        row += GLYPH[template] ?? "?";
      } else if (space.terrainAt({ x, y }) === WALL) {
        row += "#";
      } else {
        row += ".";
      }
    }
    rows.push(row);
  }
  return rows.join("\n");
}

let turn = 0;

function play(command: string): string {
  const direction = DIRECTIONS[command];
  if (direction === undefined) {
    return "不懂这个指令（w/a/s/d）";
  }

  const position = store.entity(player).pos;
  if (position === null) {
    return "玩家不在空间里";
  }

  turn += 1;
  const envelope: Envelope = {
    id: turn,
    tag: "core.move",
    params: {
      handle: player,
      space: 1,
      x: position.x + direction.dx,
      y: position.y + direction.dy,
    },
  };

  const view = createWorldView([space], store.now(), { get: (handle) => store.entity(handle) });
  const result = evaluate(envelope, link, handlers, view);

  if (!result.ok) {
    return `规则出错：${result.diagnostics[0]?.message ?? "未知错误"}`;
  }

  const value = result.value as { ok?: boolean; reason?: string };
  if (value.ok !== true) {
    return value.reason ?? "走不了";
  }

  const effects = collectEffects(result.value);
  for (const effect of effects) {
    store.submit(effect);
  }
  if (effects.length > 0) {
    store.step();
  }
  return `走到 (${store.entity(player).pos?.x}, ${store.entity(player).pos?.y})`;
}

async function main(): Promise<void> {
  const script = process.argv[2]?.split(",").filter((s) => s.length > 0) ?? null;

  console.log("=== 文字版：走一格 ===");
  console.log(render());

  if (script !== null) {
    for (const command of script) {
      if (command === "q") break;
      console.log(`\n> ${command}  ${play(command)}`);
      console.log(render());
    }
    console.log(`\n结束：tick=${store.now()}  链头=${store.headHash}`);
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const command = (await rl.question("\nw/a/s/d 走，q 退出 > ")).trim();
      if (command === "q") break;
      console.log(play(command));
      console.log(render());
    }
  } finally {
    rl.close();
  }
  console.log(`\n结束：tick=${store.now()}  链头=${store.headHash}`);
}

await main();
