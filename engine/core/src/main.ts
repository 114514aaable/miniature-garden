// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 第 1 步的可运行示例：一个 8×6 的格子世界，一个「@」，走几步给你看。
 *
 * 运行：
 *   node engine/core/src/main.ts
 *
 * 不需要编译，也不需要装任何东西——Node 24 能直接跑 .ts 文件。
 */

import { Grid, type Point } from "./grid.ts";

const grid = new Grid(8, 6);
let player: Point = { x: 0, y: 0 };

/** 把当前世界画成字符画。真正做游戏时，这个函数会被换成 Canvas 渲染。 */
function render(): string {
  const rows: string[] = [];
  for (let y = 0; y < grid.height; y++) {
    let row = "";
    for (let x = 0; x < grid.width; x++) {
      row += x === player.x && y === player.y ? "@" : ".";
    }
    rows.push(row);
  }
  return rows.join("\n");
}

/** 每一步：中文标签、x 方向、y 方向。最后一步会撞墙。 */
const moves: ReadonlyArray<readonly [string, number, number]> = [
  ["右", 1, 0],
  ["右", 1, 0],
  ["下", 0, 1],
  ["左", -1, 0],
  ["上", 0, -1],
  ["上", 0, -1],
];

console.log("起点");
console.log(render());

for (const [label, dx, dy] of moves) {
  const before = player;
  player = grid.step(player, dx, dy);

  const moved = player.x !== before.x || player.y !== before.y;
  const note = moved ? "" : "  ← 被边界挡住了";

  console.log(`\n向${label}走一步，位置 (${player.x}, ${player.y})${note}`);
  console.log(render());
}
