// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 对接与通行：两边各自声明、初始化时算一次。
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { connectDeclarations } from "./bind.ts";
import { buildPassage, SURFACES } from "../../../systems/rules/passage.ts";

test("对接：编码有交集就连得上", () => {
  const connection = connectDeclarations(
    [{ id: "fish", codes: ["liquid"] }, { id: "human", codes: ["ground"] }],
    [{ id: "water", codes: ["liquid"] }, { id: "floor", codes: ["ground"] }],
    SURFACES,
  );

  assert.equal(connection.isConnected("fish", "water"), true);
  assert.equal(connection.isConnected("fish", "floor"), false);
  assert.equal(connection.isConnected("human", "lake" ), false);
});

test("对接：两边各自加东西，不需要改对方", () => {
  // 只有鱼和地面；水面是新加的
  const before = connectDeclarations([{ id: "human", codes: ["ground"] }], [{ id: "floor", codes: ["ground"] }], SURFACES);
  assert.equal(before.unusedRight.length, 0);

  const after = connectDeclarations(
    [{ id: "human", codes: ["ground"] }, { id: "fish", codes: ["liquid"] }],
    [{ id: "floor", codes: ["ground"] }, { id: "water", codes: ["liquid"] }],
    SURFACES,
  );
  assert.equal(after.isConnected("fish", "water"), true);
  assert.equal(after.isConnected("human", "water"), false);
});

test("对接：拼错的编码会被抓出来", () => {
  const connection = connectDeclarations(
    [{ id: "fish", codes: ["liqiud"] }],
    [{ id: "water", codes: ["liquid"] }],
    SURFACES,
  );

  assert.deepEqual(connection.unknown, ["liqiud"]);
  assert.deepEqual(connection.unusedLeft, ["fish"]);
});

test("对接：空声明谁都不连", () => {
  const connection = connectDeclarations([{ id: "rock", codes: [] }], [{ id: "floor", codes: ["ground"] }], SURFACES);
  assert.equal(connection.isConnected("rock", "floor"), false);
  assert.deepEqual(connection.unusedLeft, ["rock"]);
  assert.deepEqual(connection.unusedRight, ["floor"]);
});

const TERRAINS = [
  { id: 0, code: "air", surface: "air", passable: true },
  { id: 1, code: "wall", surface: "solid", passable: false },
  { id: 2, code: "water", surface: "liquid", passable: false },
  { id: 3, code: "floor", surface: "ground", passable: true },
];

test("通行：人只走地面，鱼只下水", () => {
  const passage = buildPassage(TERRAINS, [
    { id: "human", components: { "core.locomotion": { surfaces: ["ground"] } } },
    { id: "fish", components: { "core.locomotion": { surfaces: ["liquid"] } } },
  ]);

  assert.equal(passage.canEnter("human", 3), true);
  assert.equal(passage.canEnter("human", 2), false);
  assert.equal(passage.canEnter("fish", 2), true);
  assert.equal(passage.canEnter("fish", 3), false);
});

test("通行：两栖都能走", () => {
  const passage = buildPassage(TERRAINS, [
    { id: "frog", components: { "core.locomotion": { surfaces: ["ground", "liquid"] } } },
  ]);

  assert.equal(passage.canEnter("frog", 3), true);
  assert.equal(passage.canEnter("frog", 2), true);
});

test("通行：没有 locomotion 的模板退回地形 passable", () => {
  const passage = buildPassage(TERRAINS, [{ id: "crate", components: {} }]);

  assert.equal(passage.canEnter("crate", 3), true);
  assert.equal(passage.canEnter("crate", 2), false);
});

test("通行：地形没有 surface 也退回 passable", () => {
  const passage = buildPassage([{ id: 9, passable: true }], [
    { id: "human", components: { "core.locomotion": { surfaces: ["ground"] } } },
  ]);

  assert.equal(passage.canEnter("human", 9), true);
});

test("通行：不存在的模板/地形一律不行", () => {
  const passage = buildPassage(TERRAINS, [{ id: "human", components: { "core.locomotion": { surfaces: ["ground"] } } }]);

  assert.equal(passage.canEnter("ghost", 3), false);
  assert.equal(passage.canEnter("human", 42), false);
});

test("通行：拼错的 surface 报成诊断", () => {
  const passage = buildPassage(TERRAINS, [
    { id: "fish", components: { "core.locomotion": { surfaces: ["liqiud"] } } },
  ]);

  assert.ok(passage.diagnostics.some((line: string) => line.includes("未知的 surface")));
});
