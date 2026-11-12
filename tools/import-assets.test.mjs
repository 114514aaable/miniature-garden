// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/** 资产导入器：示例批次通过、缺帧/旋转帧被拒、apply 写出正确清单。 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { applyBatch, validateBatch } from "./import-assets.mjs";

const EXAMPLE = resolve("artdrop/inbox/_example");
const BASE = resolve("game/worlds/base");
const TMP = resolve(".tmp/import-assets-test");

function freshTmp(name) {
  const dir = resolve(TMP, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  return dir;
}

test("示例批次校验通过", () => {
  const result = validateBatch(EXAMPLE, { packDir: BASE });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.atlases.length, 1);
  assert.equal(result.assets.length, 2);
});

test("缺帧：整批拒绝", () => {
  const dir = freshTmp("missing-frame");
  cpSync(EXAMPLE, dir, { recursive: true });
  const manifest = JSON.parse(readFileSync(resolve(dir, "assets.json"), "utf8"));
  manifest.assets[0].frame = "Terrain/Missing.png";
  writeFileSync(resolve(dir, "assets.json"), JSON.stringify(manifest), "utf8");

  const result = validateBatch(dir, { packDir: BASE });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.includes("frame") && item.includes("Missing")));
});

test("旋转帧：整批拒绝", () => {
  const dir = freshTmp("rotated");
  cpSync(EXAMPLE, dir, { recursive: true });
  const atlas = JSON.parse(readFileSync(resolve(dir, "atlas.json"), "utf8"));
  atlas.frames["Terrain/Floor.png"].rotated = true;
  writeFileSync(resolve(dir, "atlas.json"), JSON.stringify(atlas), "utf8");

  const result = validateBatch(dir, { packDir: BASE });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.includes("rotated")));
});

test("apply：图集落盘 + 清单合并 + URL 改写", () => {
  const packDir = freshTmp("pack");
  writeFileSync(resolve(packDir, "pack.json"), JSON.stringify({ id: "test" }), "utf8");
  cpSync(resolve(BASE, "terrains.json"), resolve(packDir, "terrains.json"));

  const result = validateBatch(EXAMPLE, { packDir, checkConflicts: true });
  assert.equal(result.ok, true, result.errors.join("\n"));

  const summary = applyBatch(result, packDir, "test");
  assert.equal(summary.atlases, 1);
  assert.equal(summary.assets, 2);

  const manifest = JSON.parse(readFileSync(resolve(packDir, "assets.json"), "utf8"));
  assert.equal(manifest.atlases[0].id, "example");
  assert.equal(manifest.atlases[0].image, "/art/test/art/_example/atlas.svg");
  assert.ok(existsSync(resolve(packDir, "art/_example/atlas.svg")));
  assert.ok(existsSync(resolve(packDir, "art/_example/atlas.json")));
  assert.deepEqual(manifest.assets.map((item) => item.id), ["terrain.floor", "entity.potion"]);

  const copied = JSON.parse(readFileSync(resolve(packDir, "art/_example/atlas.json"), "utf8"));
  assert.equal(copied.meta.image, "/art/test/art/_example/atlas.svg");
});
