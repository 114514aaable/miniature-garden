// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 图集解析的测试：TexturePacker JSON hash。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { frameOf, parseAtlas } from "./atlas.ts";

const SAMPLE = {
  frames: {
    "Enemies/Skeleton.png": {
      frame: { x: 10, y: 20, w: 32, h: 48 },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: 4, y: 6, w: 32, h: 48 },
      sourceSize: { w: 64, h: 96 },
    },
    "Items/Lamp.png": {
      frame: { x: 100, y: 0, w: 16, h: 16 },
      trimmed: false,
      sourceSize: { w: 16, h: 16 },
    },
  },
  animations: {
    "Models/Arms": ["Models/Arms1.png", "Models/Arms2.png"],
  },
  meta: { image: "atlasA0.webp", size: { w: 2048, h: 2048 }, scale: "0.5" },
};

test("解析帧与图片路径", () => {
  const atlas = parseAtlas(SAMPLE);
  assert.equal(atlas.image, "atlasA0.webp");
  assert.equal(atlas.frames.size, 2);

  const skeleton = frameOf(atlas, "Enemies/Skeleton.png");
  assert.deepEqual(skeleton, {
    x: 10,
    y: 20,
    w: 32,
    h: 48,
    sourceW: 64,
    sourceH: 96,
    offsetX: 4,
    offsetY: 6,
    trimmed: true,
  });
});

test("没裁边的帧：偏移是 0", () => {
  const atlas = parseAtlas(SAMPLE);
  const lamp = frameOf(atlas, "Items/Lamp.png");
  assert.equal(lamp?.offsetX, 0);
  assert.equal(lamp?.trimmed, false);
});

test("动画表按名字聚合", () => {
  const atlas = parseAtlas(SAMPLE);
  assert.deepEqual(atlas.animations.get("Models/Arms"), [
    "Models/Arms1.png",
    "Models/Arms2.png",
  ]);
});

test("查不到的帧返回 undefined（由调用方兜底）", () => {
  const atlas = parseAtlas(SAMPLE);
  assert.equal(frameOf(atlas, "Enemies/Ghost.png"), undefined);
});

test("缺 frames 直接报错", () => {
  assert.throws(() => parseAtlas({ meta: { image: "a.png" } }), /缺少 frames/);
});

test("缺图片路径直接报错", () => {
  assert.throws(() => parseAtlas({ frames: {} }), /缺少图集图片路径/);
});

test("旋转帧暂不支持，直接报错", () => {
  assert.throws(
    () =>
      parseAtlas({
        frames: { "a.png": { frame: { x: 0, y: 0, w: 1, h: 1 }, rotated: true } },
        meta: { image: "a.png" },
      }),
    /不支持旋转帧/,
  );
});
