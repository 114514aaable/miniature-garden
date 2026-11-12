// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 资产导入器：把 artdrop 里的一批交付校验并合并进世界包。
 *
 * 用法：
 *   node tools/import-assets.mjs artdrop/inbox/<batch> --check
 *   node tools/import-assets.mjs artdrop/inbox/<batch> --pack base --apply
 *
 * 它不生成图、不改图、不猜缺失帧；失败就整批拒绝。
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PROTOCOL = 1;
const MAX_ASSETS = 256;
const MAX_FILE = 32 * 1024 * 1024;
const KINDS = new Set(["tile", "sprite", "icon", "portrait"]);
const IMAGE_EXT = new Set([".png", ".svg", ".jpg", ".jpeg", ".webp"]);

function inside(root, path) {
  const rel = relative(root, path);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function readJson(path, errors, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    errors.push(`${label}：读不到或不是 JSON（${error.message}）`);
    return null;
  }
}

function isSize(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1]) &&
    value[0] > 0 &&
    value[1] > 0
  );
}

function frameRect(frame) {
  const rect = frame && typeof frame === "object" ? frame.frame : undefined;
  if (
    rect === undefined ||
    !Number.isInteger(rect.x) ||
    !Number.isInteger(rect.y) ||
    !Number.isInteger(rect.w) ||
    !Number.isInteger(rect.h)
  ) {
    return null;
  }
  return rect;
}

/**
 * 校验一个批次。不写仓库。
 * @param {string} batchDir
 * @param {{ packDir?: string, checkConflicts?: boolean }} options
 */
export function validateBatch(batchDir, options = {}) {
  const root = resolve(batchDir);
  const errors = [];
  const warnings = [];
  const assets = [];
  const atlases = [];

  if (!existsSync(root)) {
    return { ok: false, errors: [`批次目录不存在：${batchDir}`], warnings, assets, atlases, batch: null, source: null };
  }

  const manifest = readJson(join(root, "assets.json"), errors, "assets.json");
  if (manifest === null) {
    return { ok: false, errors, warnings, assets, atlases, batch: null, source: null };
  }

  if (manifest.protocol !== PROTOCOL) {
    errors.push(`assets.json.protocol 必须是 ${PROTOCOL}`);
  }
  const batch = typeof manifest.batch === "string" && manifest.batch.length > 0
    ? manifest.batch
    : basename(root);

  const source = manifest.source;
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    errors.push("assets.json.source 缺失");
  } else {
    if (typeof source.license !== "string" || source.license.trim().length === 0) {
      errors.push("assets.json.source.license 缺失（许可证是必填）");
    }
    if (typeof source.provider !== "string" || source.provider.length === 0) {
      warnings.push("source.provider 建议填写");
    }
  }

  const atlasList = Array.isArray(manifest.atlases) ? manifest.atlases : [];
  if (atlasList.length === 0) errors.push("assets.json.atlases 至少要有一张图集");

  const atlasById = new Map();
  for (const [index, entry] of atlasList.entries()) {
    const where = `atlases[${index}]`;
    if (typeof entry !== "object" || entry === null) {
      errors.push(`${where} 应该是对象`);
      continue;
    }
    const id = entry.id;
    if (typeof id !== "string" || id.length === 0) {
      errors.push(`${where}.id 缺失`);
      continue;
    }
    if (atlasById.has(id)) errors.push(`图集 id 重复：${id}`);

    const imagePath = typeof entry.image === "string" ? resolve(root, entry.image) : null;
    const dataPath = typeof entry.data === "string" ? resolve(root, entry.data) : null;
    if (imagePath === null || !inside(root, imagePath)) {
      errors.push(`${where}.image 必须是批次内的相对路径`);
      continue;
    }
    if (dataPath === null || !inside(root, dataPath)) {
      errors.push(`${where}.data 必须是批次内的相对路径`);
      continue;
    }
    if (!existsSync(imagePath)) {
      errors.push(`${where}.image 不存在：${entry.image}`);
      continue;
    }
    if (!existsSync(dataPath)) {
      errors.push(`${where}.data 不存在：${entry.data}`);
      continue;
    }
    if (!IMAGE_EXT.has(extname(imagePath).toLowerCase())) {
      errors.push(`${where}.image 格式不支持：${entry.image}`);
    }
    if (statSync(imagePath).size > MAX_FILE) {
      errors.push(`${where}.image 超过 32MB`);
    }

    const data = readJson(dataPath, errors, `${where}.data`);
    if (data === null) continue;
    if (typeof data.frames !== "object" || data.frames === null || Array.isArray(data.frames)) {
      errors.push(`${where}.data 缺少 frames`);
      continue;
    }

    const frames = new Map();
    for (const [name, frame] of Object.entries(data.frames)) {
      if (frame && frame.rotated === true) {
        errors.push(`${where} 的帧 ${name} 是 rotated，导入器不支持`);
        continue;
      }
      const rect = frameRect(frame);
      if (rect === null) {
        errors.push(`${where} 的帧 ${name} 缺少合法 frame 矩形`);
        continue;
      }
      frames.set(name, rect);
    }

    const size = isSize(entry.size)
      ? entry.size
      : isSize(data.meta?.size)
        ? [data.meta.size.w, data.meta.size.h]
        : null;
    if (size === null) {
      warnings.push(`${where} 没有声明图集尺寸，跳过越界检查`);
    } else {
      for (const [name, rect] of frames) {
        if (rect.x + rect.w > size[0] || rect.y + rect.h > size[1]) {
          errors.push(`${where} 的帧 ${name} 超出图集范围`);
        }
      }
    }

    atlasById.set(id, { id, imagePath, dataPath, data, frames });
    atlases.push({
      id,
      image: basename(imagePath),
      data: basename(dataPath),
      dataObject: data,
      imagePath,
      dataPath,
      frames: [...frames.keys()],
    });
  }

  const assetList = Array.isArray(manifest.assets) ? manifest.assets : [];
  if (assetList.length === 0) errors.push("assets.json.assets 至少有一个资产");
  if (assetList.length > MAX_ASSETS) errors.push(`一批最多 ${MAX_ASSETS} 个资产`);

  const seen = new Set();
  for (const [index, entry] of assetList.entries()) {
    const where = `assets[${index}]`;
    if (typeof entry !== "object" || entry === null) {
      errors.push(`${where} 应该是对象`);
      continue;
    }
    const id = entry.id;
    if (typeof id !== "string" || id.length === 0) {
      errors.push(`${where}.id 缺失`);
      continue;
    }
    if (seen.has(id)) errors.push(`资产 id 重复：${id}`);
    seen.add(id);

    if (KINDS.has(entry.kind) === false) {
      errors.push(`${where}.kind 非法：${entry.kind}`);
    }

    const atlas = atlasById.get(entry.sheet);
    if (atlas === undefined) {
      errors.push(`${where}.sheet 找不到图集：${entry.sheet}`);
      continue;
    }
    const rect = atlas.frames.get(entry.frame);
    if (rect === undefined) {
      errors.push(`${where}.frame 在图集里不存在：${entry.frame}`);
      continue;
    }

    if (entry.size !== undefined && !isSize(entry.size)) {
      errors.push(`${where}.size 必须是 [w, h] 正整数`);
    }
    if (entry.kind === "tile") {
      if (!isSize(entry.size)) {
        errors.push(`${where}.size 是 tile 的必填项`);
      } else if (entry.size[0] !== rect.w || entry.size[1] !== rect.h) {
        errors.push(`${where}.size 与帧尺寸不一致（${rect.w}×${rect.h}）`);
      }
    }

    if (typeof id === "string" && id.startsWith("terrain.")) {
      const code = id.slice("terrain.".length);
      if (options.packDir !== undefined) {
        const terrainsPath = join(options.packDir, "terrains.json");
        const terrains = existsSync(terrainsPath)
          ? JSON.parse(readFileSync(terrainsPath, "utf8"))
          : [];
        const codes = new Set((Array.isArray(terrains) ? terrains : []).map((item) => item.code));
        if (!codes.has(code)) {
          errors.push(`${where}.id 指向不存在的地形 code：${code}`);
        }
      }
    }

    assets.push({ ...entry });
  }

  // 与包内已有资产冲突
  if (options.checkConflicts === true && options.packDir !== undefined) {
    const existingPath = join(options.packDir, "assets.json");
    if (existsSync(existingPath)) {
      const existing = JSON.parse(readFileSync(existingPath, "utf8"));
      const oldIds = new Set((existing.assets ?? []).map((item) => item.id));
      const oldAtlas = new Set((existing.atlases ?? []).map((item) => item.id));
      for (const entry of assets) {
        if (oldIds.has(entry.id)) errors.push(`资产 id 与包内已有冲突：${entry.id}`);
      }
      for (const atlas of atlases) {
        if (oldAtlas.has(atlas.id)) errors.push(`图集 id 与包内已有冲突：${atlas.id}`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings, assets, atlases, batch, source, root };
}

/** 把校验通过的批次写进包。返回摘要。 */
export function applyBatch(result, packDir, packId) {
  if (!result.ok) throw new Error("批次没有通过校验");

  const target = join(packDir, "art", result.batch);
  mkdirSync(target, { recursive: true });

  const manifestPath = join(packDir, "assets.json");
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : { version: 1, atlases: [], assets: [] };
  manifest.atlases = Array.isArray(manifest.atlases) ? manifest.atlases : [];
  manifest.assets = Array.isArray(manifest.assets) ? manifest.assets : [];

  for (const atlas of result.atlases) {
    copyFileSync(atlas.imagePath, join(target, atlas.image));

    // 帧表复制一份，并把图片路径改成浏览器 URL
    const data = JSON.parse(JSON.stringify(atlas.dataObject));
    data.meta = data.meta ?? {};
    data.meta.image = `/art/${packId}/art/${result.batch}/${atlas.image}`;
    writeFileSync(join(target, atlas.data), JSON.stringify(data, null, 2) + "\n", "utf8");

    manifest.atlases.push({
      id: atlas.id,
      image: `/art/${packId}/art/${result.batch}/${atlas.image}`,
      data: `art/${result.batch}/${atlas.data}`,
    });
  }

  for (const asset of result.assets) {
    manifest.assets.push(asset);
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  return {
    batch: result.batch,
    atlases: result.atlases.length,
    assets: result.assets.length,
    target,
  };
}

/** 把批次目录移到 processed/ 或 rejected/。 */
export function archiveBatch(batchDir, outcome, reason) {
  const archiveRoot = resolve("artdrop", outcome === "processed" ? "processed" : "rejected");
  mkdirSync(archiveRoot, { recursive: true });
  const name = basename(resolve(batchDir));
  let target = join(archiveRoot, name);
  if (existsSync(target)) target = `${target}-${Date.now()}`;

  if (outcome === "rejected" && reason !== undefined) {
    writeFileSync(join(resolve(batchDir), "reason.json"), JSON.stringify(reason, null, 2) + "\n", "utf8");
  }

  renameSync(resolve(batchDir), target);
  return target;
}

function parseArgs(argv) {
  const args = { batch: null, pack: "base", apply: false, check: false };
  for (const item of argv) {
    if (item === "--apply") args.apply = true;
    else if (item === "--check") args.check = true;
    else if (item.startsWith("--pack=")) args.pack = item.slice("--pack=".length);
    else if (args.batch === null) args.batch = item;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.batch === null) {
    console.error("用法：node tools/import-assets.mjs <batch-dir> [--pack base] [--check|--apply]");
    process.exit(2);
  }

  const packDir = resolve("game/worlds", args.pack);
  if (!existsSync(packDir)) {
    console.error("包不存在：" + packDir);
    process.exit(2);
  }
  const packJson = JSON.parse(readFileSync(join(packDir, "pack.json"), "utf8"));

  const result = validateBatch(args.batch, {
    packDir,
    checkConflicts: args.apply,
  });

  for (const warning of result.warnings) console.warn("[warn] " + warning);
  for (const error of result.errors) console.error("[error] " + error);

  if (!result.ok) {
    if (args.apply) {
      archiveBatch(args.batch, "rejected", { at: new Date().toISOString(), errors: result.errors });
    }
    process.exit(1);
  }

  if (args.apply === false) {
    console.log(`校验通过：${result.batch}（${result.atlases.length} 张图集 / ${result.assets.length} 个资产）`);
    return;
  }

  const summary = applyBatch(result, packDir, packJson.id);
  const archived = archiveBatch(args.batch, "processed");
  console.log(
    `已导入：${summary.batch} → ${summary.target}（图集 ${summary.atlases} / 资产 ${summary.assets}）`,
  );
  console.log("归档：" + archived);
}

const isMain = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) main();
