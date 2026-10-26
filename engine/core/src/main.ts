// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 第 2 步的可运行示例：三个单位，按先攻轮流行动，每回合发 3 AP。
 *
 * 运行：
 *   node engine/core/src/main.ts
 */

import { Grid, type Point } from "./grid.ts";
import { TurnOrder, makeUnit, type Unit } from "./turn.ts";

const grid = new Grid(10, 6);

const units: Unit[] = [
  makeUnit("a-salt", "老盐", 4, "A", { x: 1, y: 1 }),
  makeUnit("b-tina", "缇娜", 6, "T", { x: 4, y: 3 }),
  makeUnit("c-finger", "断指", 4, "F", { x: 7, y: 1 }),
];

function render(): string {
  const rows: string[] = [];
  for (let y = 0; y < grid.height; y++) {
    let row = "";
    for (let x = 0; x < grid.width; x++) {
      const unit = units.find((u) => u.pos.x === x && u.pos.y === y);
      row += unit ? unit.glyph : ".";
    }
    rows.push(row);
  }
  return rows.join("\n");
}

/** 花 1 AP 向某个方向走一格；返回是否真的动了。 */
function tryStep(unit: Unit, dx: number, dy: number): boolean {
  if (unit.ap < 1) {
    return false;
  }
  const next: Point = grid.step(unit.pos, dx, dy);
  if (next === unit.pos) {
    return false; // 撞墙不扣 AP
  }
  unit.pos = next;
  unit.ap -= 1;
  return true;
}

const order = new TurnOrder(units);
let current = order.start();

console.log(`先攻顺序：${order.order.map((u) => `${u.name}(${u.speed})`).join(" → ")}`);
console.log(render());

for (let turn = 1; turn <= 9; turn++) {
  if (turn > 1) {
    current = order.next();
  }

  console.log(
    `\n第 ${order.roundNumber} 轮 · 第 ${turn} 回合 · ${current.name}` +
      `  AP=${current.ap}  反应=${current.reactions}`,
  );

  // 演示：把自己的 AP 花在「向右走」上，能走几步走几步。
  while (tryStep(current, 1, 0)) {
    /* 一直走到 AP 用完或撞墙 */
  }

  console.log(`  剩余 AP=${current.ap}，位置 (${current.pos.x}, ${current.pos.y})`);
  console.log(render());
}
