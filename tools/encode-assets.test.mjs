// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/** 编码器：SVG 拼页、PNG 原样复制、写盘备份与恢复。 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { applyEncoded, encodeTree } from "./encode-assets.mjs";
import { parseAssetTree } from "../game/systems/render/tree.ts";

const TMP = resolve(".tmp/encoder-test");
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function source() {
  const dir = join(TMP, "src");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "terrain"), { recursive: true });
  mkdirSync(join(dir, "entity", "rat"), { recursive: true });
  mkdirSync(join(dir, "ui"), { recursive: true });

  writeFileSync(
    join(dir, "terrain", "floor.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#333"/></svg>',
    "utf8",
  );
  writeFileSync(
    join(dir, "entity", "rat", "idle-1.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#888"/></svg>',
    "utf8",
  );
  writeFileSync(
    join(dir, "entity", "rat", "idle-2.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="#999"/></svg>',
    "utf8",
  );
  writeFileSync(join(dir, "ui", "potion.png"), PNG_1X1);

  return dir;
}

function pack() {
  const dir = join(TMP, "pack");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "pack.json"), JSON.stringify({ id: "test" }), "utf8");
  return dir;
}

test("编码：SVG 按目录分页，PNG 保留为 file 叶子", () => {
  const encoded = encodeTree(source(), { pack: "test" });

  assert.equal(encoded.pages.length, 2); // terrain / entity
  assert.equal(encoded.copied.length, 1); // ui/potion.png

  const tree = parseAssetTree(encoded.tree);
  assert.ok(tree.leaves.has("terrain.floor"));
  assert.ok(tree.leaves.has("entity.rat.idle-1"));
  assert.ok(tree.leaves.has("entity.rat.idle-2"));
  assert.ok(tree.files.has("ui.potion"));

  const page = encoded.pages.find((item) => item.id === "terrain-1");
  assert.ok(page !== undefined);
  assert.ok(page.content.includes("<rect"));
  assert.ok(page.content.startsWith("<svg xmlns="));
});

test("apply：页图、PNG、树文件都落盘，并留备份", () => {
  const encoded = encodeTree(source(), { pack: "test" });
  const packDir = pack();
  const backupDir = join(TMP, "backups");

  const summary = applyEncoded(encoded, packDir, { backupDir });
  assert.equal(summary.pages, 2);
  assert.equal(summary.copied, 1);
  assert.ok(existsSync(join(packDir, "assets.tree.json")));
  assert.ok(existsSync(join(packDir, "art", "pages", "terrain-1.svg")));
  assert.ok(existsSync(join(packDir, "art", "assets", "potion.png")));
  assert.ok(existsSync(join(summary.backupDir, "report.json")));

  const tree = parseAssetTree(JSON.parse(readFileSync(join(packDir, "assets.tree.json"), "utf8")));
  assert.ok(tree.files.has("ui.potion"));
});
