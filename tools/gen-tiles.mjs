// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 一次性脚本：生成 7 张 7×7 测试件。
 *
 * 结构：四象限（3×3）+ 中间一横一竖的十字走廊。
 *   - 十字永远开，四边中点就是门
 *   - 象限按需要打开/关闭，做出 7 种能一眼看出来的房间
 */

import { writeFileSync } from "node:fs";

const SIZE = 7;

/** 四象限的左上角。 */
const QUADRANTS = {
  NW: { x: 0, y: 0 },
  NE: { x: 4, y: 0 },
  SW: { x: 0, y: 4 },
  SE: { x: 4, y: 4 },
};

const VARIANTS = [
  { id: "tile_cross", quadrants: [] },
  { id: "tile_room_nw", quadrants: ["NW"] },
  { id: "tile_hall_north", quadrants: ["NW", "NE"] },
  { id: "tile_diagonal", quadrants: ["NW", "SE"] },
  { id: "tile_three", quadrants: ["NW", "NE", "SW"] },
  { id: "tile_hall", quadrants: ["NW", "NE", "SW", "SE"] },
  { id: "tile_pillar", quadrants: ["NW", "NE", "SW", "SE"], pillar: true },
];

const DOORS = [
  { x: 3, y: 0, facing: "north" },
  { x: 6, y: 3, facing: "east" },
  { x: 3, y: 6, facing: "south" },
  { x: 0, y: 3, facing: "west" },
];

function makeTile(variant) {
  const grid = Array.from({ length: SIZE }, () => new Array(SIZE).fill("#"));

  // 十字走廊
  for (let i = 0; i < SIZE; i += 1) {
    grid[3][i] = ".";
    grid[i][3] = ".";
  }

  // 象限
  for (const name of variant.quadrants) {
    const origin = QUADRANTS[name];
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) grid[origin.y + y][origin.x + x] = ".";
    }
  }

  // 柱子：把 NW 象限中间留一个 2×2 的墙
  if (variant.pillar) {
    for (let y = 1; y <= 2; y += 1) {
      for (let x = 1; x <= 2; x += 1) grid[y][x] = "#";
    }
  }

  // 外墙：除门以外一律墙（象限碰到边也裁掉）
  for (let i = 0; i < SIZE; i += 1) {
    grid[0][i] = "#"; grid[SIZE - 1][i] = "#";
    grid[i][0] = "#"; grid[i][SIZE - 1] = "#";
  }

  // 门：四边中点
  const anchors = [];
  for (const door of DOORS) {
    grid[door.y][door.x] = ".";
    anchors.push({ kind: "door", x: door.x, y: door.y, facing: door.facing });
  }

  return {
    id: variant.id,
    role: "room",
    legend: { "#": { terrain: "wall" }, ".": { terrain: "floor" } },
    map: grid.map((row) => row.join("")),
    anchors,
    weight: 1,
  };
}

const tiles = VARIANTS.map(makeTile);
writeFileSync("game/worlds/base/worldgen/tiles.json", JSON.stringify(tiles, null, 2) + "\n", "utf8");

for (const tile of tiles) console.log(tile.id + "\n" + tile.map.join("\n") + "\n");
