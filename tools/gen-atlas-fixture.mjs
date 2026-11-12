// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 生成 F0 的测试图集：一张 SVG 图集 + TexturePacker JSON hash + assets 清单。
 *
 * 这不是美术，是插座：先证明「图集 → manifest → 渲染器」这条线能通。
 * 贴图 AI 以后只要产出同格式的 PNG/JSON，就能直接替换。
 */

import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("game/worlds/base/art", { recursive: true });

// 128×128，四个 64×64 的帧
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect x="0" y="0" width="64" height="64" fill="#23272f"/>
  <rect x="2" y="2" width="60" height="60" fill="#2b303a"/>
  <rect x="10" y="10" width="12" height="12" fill="#333a46"/>
  <rect x="34" y="30" width="18" height="18" fill="#272c35"/>

  <rect x="64" y="0" width="64" height="64" fill="#2a2f3a"/>
  <rect x="64" y="0" width="64" height="16" fill="#353b48"/>
  <rect x="64" y="32" width="64" height="16" fill="#3a4150"/>
  <rect x="92" y="0" width="16" height="64" fill="#353b48"/>

  <rect x="0" y="64" width="64" height="64" fill="#1b2f45"/>
  <path d="M0 84 Q16 76 32 84 T64 84" stroke="#2a4a6b" stroke-width="6" fill="none"/>
  <path d="M0 104 Q16 96 32 104 T64 104" stroke="#2a4a6b" stroke-width="6" fill="none"/>

  <circle cx="96" cy="96" r="18" fill="#e06c75"/>
  <rect x="90" y="72" width="12" height="10" rx="2" fill="#c9a227"/>
</svg>
`;
writeFileSync("game/worlds/base/art/atlas.svg", svg, "utf8");

const frameNames = [
  ["Terrain/Floor.png", 0, 0],
  ["Terrain/Wall.png", 64, 0],
  ["Terrain/Water.png", 0, 64],
  ["Items/Potion.png", 64, 64],
];

const frames = {};
for (const [name, x, y] of frameNames) {
  frames[name] = {
    frame: { x, y, w: 64, h: 64 },
    rotated: false,
    trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 },
    sourceSize: { w: 64, h: 64 },
  };
}

writeFileSync(
  "game/worlds/base/art/atlas.json",
  JSON.stringify({ frames, meta: { app: "handmade-fixture", image: "atlas.svg", size: { w: 128, h: 128 } } }, null, 2) + "\n",
  "utf8",
);

writeFileSync(
  "game/worlds/base/assets.json",
  JSON.stringify(
    {
      version: 1,
      atlases: [
        { id: "atlas", image: "/art/base/atlas.svg", data: "art/atlas.json" },
      ],
      assets: [
        { id: "terrain.floor", kind: "tile", sheet: "atlas", frame: "Terrain/Floor.png" },
        { id: "terrain.wall", kind: "tile", sheet: "atlas", frame: "Terrain/Wall.png" },
        { id: "terrain.water", kind: "tile", sheet: "atlas", frame: "Terrain/Water.png" },
        { id: "entity.potion", kind: "sprite", sheet: "atlas", frame: "Items/Potion.png" },
      ],
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

console.log("atlas fixture + assets.json");
