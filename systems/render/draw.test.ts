// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 绘制指令的测试：不碰浏览器，只看产出的命令对不对。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { type FrameSnapshot } from "./project.ts";
import { buildFrame, DEFAULT_STYLE, type FrameSpec } from "./draw.ts";

function snapshot(overrides: Partial<FrameSnapshot> = {}): FrameSnapshot {
  return {
    tick: 1,
    spaces: [
      {
        id: 1,
        width: 3,
        height: 2,
        terrain: new Int32Array([3, 3, 3, 3, 1, 3]),
      },
    ],
    entities: [{ handle: 0, x: 1, y: 0, template: "pc", components: {} }],
    ...overrides,
  };
}

function spec(overrides: Partial<FrameSpec> = {}): FrameSpec {
  return {
    tile: 32,
    viewport: { width: 96, height: 64 },
    camera: { x: 0, y: 0 },
    style: DEFAULT_STYLE,
    ...overrides,
  };
}

test("第一个命令永远是背景", () => {
  const [first] = buildFrame(snapshot(), spec());
  assert.equal(first.kind, "rect");
  assert.equal(first.kind === "rect" ? first.color : "", DEFAULT_STYLE.background);
});

test("每个可见格子一个矩形，颜色来自地形表", () => {
  const commands = buildFrame(snapshot(), spec());
  const rects = commands.filter((command) => command.kind === "rect");

  // 背景 + 6 个格子
  assert.equal(rects.length, 7);

  const wall = rects.find((command) => command.kind === "rect" && command.color === "#2a2f3a");
  assert.deepEqual(wall, { kind: "rect", x: 32, y: 32, w: 32, h: 32, color: "#2a2f3a" });
});

test("实体画在格子上，位置由镜头决定", () => {
  const commands = buildFrame(snapshot(), spec({ camera: { x: 1, y: 0 } }));
  const player = commands.find((command) => command.kind === "text" && command.text === "@");

  assert.ok(player !== undefined);
  // 玩家在 (1,0)，镜头左移一格，所以画在屏幕 x=0 的半格处
  assert.equal(player.kind === "text" ? player.x : -1, 16);
});

test("视野外的实体不画", () => {
  const far = snapshot({
    entities: [{ handle: 0, x: 99, y: 99, template: "pc", components: {} }],
  });
  const commands = buildFrame(far, spec());
  assert.equal(commands.some((command) => command.kind === "text" && command.text === "@"), false);
});

test("未知模板用兜底字符", () => {
  const unknown = snapshot({
    entities: [{ handle: 0, x: 0, y: 0, template: "npc_ghost", components: {} }],
  });
  const commands = buildFrame(unknown, spec());
  const ghost = commands.find((command) => command.kind === "text" && command.text === "?");
  assert.ok(ghost !== undefined);
});

test("同样的输入产出同样的指令（可复现）", () => {
  assert.deepEqual(buildFrame(snapshot(), spec()), buildFrame(snapshot(), spec()));
});
