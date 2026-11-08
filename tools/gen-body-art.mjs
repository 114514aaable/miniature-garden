// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 一次性脚本：生成人形立绘的占位部件（SVG）+ rig 布局。
 *
 * 真美术以后可以直接替换同名 SVG/PNG；rig 的坐标是归一化前的画布像素。
 */

import { mkdirSync, writeFileSync } from "node:fs";

const CANVAS = [256, 400];

/** 每个部件：文件、尺寸、在画布上的位置、深度、绘制内容。 */
const PARTS = [
  { file: "torso", w: 120, h: 146, x: 68, y: 108, depth: 30,
    body: '<rect x="0" y="0" width="120" height="146" rx="26" fill="#b98a68"/>' },

  { file: "neck", w: 30, h: 26, x: 113, y: 92, depth: 28,
    body: '<rect x="0" y="0" width="30" height="26" fill="#cf9f7c"/>' },

  { file: "head", w: 76, h: 76, x: 90, y: 22, depth: 40,
    body: '<circle cx="38" cy="38" r="36" fill="#e0b090"/>' },

  { file: "eye", w: 16, h: 16, x: 108, y: 50, depth: 45,
    body: '<circle cx="8" cy="8" r="7" fill="#ffffff"/><circle cx="8" cy="8" r="3.4" fill="#1b1f27"/>' },

  { file: "ear", w: 14, h: 24, x: 86, y: 52, depth: 39,
    body: '<ellipse cx="7" cy="12" rx="6" ry="11" fill="#cf9f7c"/>' },

  { file: "mouth", w: 26, h: 10, x: 115, y: 74, depth: 44,
    body: '<rect x="0" y="3" width="26" height="4" rx="2" fill="#8d5b52"/>' },

  { file: "upper_arm", w: 26, h: 74, x: 44, y: 118, depth: 26,
    body: '<rect x="0" y="0" width="26" height="74" rx="12" fill="#b98a68"/>' },

  { file: "hand", w: 30, h: 32, x: 40, y: 188, depth: 27,
    body: '<ellipse cx="15" cy="16" rx="13" ry="15" fill="#cf9f7c"/>' },

  { file: "thigh", w: 34, h: 84, x: 82, y: 246, depth: 20,
    body: '<rect x="0" y="0" width="34" height="84" rx="14" fill="#6b7d8f"/>' },

  { file: "shin", w: 30, h: 70, x: 84, y: 324, depth: 18,
    body: '<rect x="0" y="0" width="30" height="70" rx="12" fill="#596a7a"/>' },

  { file: "foot", w: 38, h: 18, x: 76, y: 388, depth: 16,
    body: '<ellipse cx="19" cy="9" rx="17" ry="8" fill="#3b444f"/>' },
];

const outDir = "game/worlds/base/art/parts";
mkdirSync(outDir, { recursive: true });

for (const part of PARTS) {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${part.w}" height="${part.h}" viewBox="0 0 ${part.w} ${part.h}">`,
    part.body,
    "</svg>",
  ].join("");
  writeFileSync(`${outDir}/${part.file}.svg`, svg + "\n", "utf8");
}

/** rig：把部件摆到画布上（左右成对给不同 offset）。 */
const layers = [];
const add = (part, file, x, y, depth) => {
  layers.push({ part, image: `parts/${file}.svg`, x, y, depth });
};

add("torso", "torso", 68, 108, 30);
add("neck", "neck", 113, 92, 28);
add("head", "head", 90, 22, 40);
add("eye_1", "eye", 108, 50, 45);
add("eye_2", "eye", 140, 50, 45);
add("ear_1", "ear", 86, 52, 39);
add("ear_2", "ear", 156, 52, 39);
add("mouth", "mouth", 115, 74, 44);
add("upper_arm_l", "upper_arm", 44, 118, 26);
add("upper_arm_r", "upper_arm", 186, 118, 26);
add("hand_l", "hand", 40, 188, 27);
add("hand_r", "hand", 186, 188, 27);
add("thigh_l", "thigh", 82, 246, 20);
add("thigh_r", "thigh", 140, 246, 20);
add("shin_l", "shin", 84, 324, 18);
add("shin_r", "shin", 142, 324, 18);
add("foot_l", "foot", 76, 388, 16);
add("foot_r", "foot", 142, 388, 16);

const rig = {
  id: "humanoid",
  canvas: CANVAS,
  layers,
};

mkdirSync("game/worlds/base/rigs", { recursive: true });
writeFileSync("game/worlds/base/rigs/humanoid.json", JSON.stringify(rig, null, 2) + "\n", "utf8");

console.log("生成", PARTS.length, "个部件 SVG + rig/humanoid.json（", layers.length, "层）");
