// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 编码器：把 artdrop 里的「树形文件夹」编译成 assets.tree.json + 页图。
 *
 * 输入：
 *   artdrop/tree/<group>/<...>/name.svg
 *   artdrop/tree/<group>/<...>/name.png
 *
 * 输出：
 *   game/worlds/<pack>/assets.tree.json
 *   game/worlds/<pack>/art/pages/<page>.svg     （SVG 矢量拼接，不栅格化）
 *   game/worlds/<pack>/art/assets/<name>.png    （PNG 原样复制，先当 file 叶子）
 *
 * 安全：
 *   - 默认 --check，只报告不写盘。
 *   - --apply 前先备份现有 tree + pages 到 artdrop/backups/encode-<时间>/。
 *   - 写失败从备份恢复。
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { parseAssetTree } from "../game/systems/render/tree.ts";

const MAX_PAGE = 2048;
const PADDING = 2;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function svgSize(text, where) {
  const open = text.match(/<svg\b([^>]*)>/i);
  if (open === null) throw new Error(`${where}：找不到 <svg>`);
  const attrs = open[1];
  const width = attrs.match(/\bwidth\s*=\s*["']([\d.]+)(?:px)?["']/i);
  const height = attrs.match(/\bheight\s*=\s*["']([\d.]+)(?:px)?["']/i);
  const viewBox = attrs.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);

  let w = width === null ? undefined : Number(width[1]);
  let h = height === null ? undefined : Number(height[1]);
  if ((w === undefined || h === undefined) && viewBox !== null) {
    const parts = viewBox[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4) {
      w = w ?? parts[2];
      h = h ?? parts[3];
    }
  }
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    throw new Error(`${where}：读不到 width/height/viewBox`);
  }
  return { width: Math.ceil(w), height: Math.ceil(h), viewBox: viewBox === null ? null : viewBox[1] };
}

function svgInner(text) {
  const open = text.match(/<svg\b[^>]*>/i);
  if (open === null || open.index === undefined) return "";
  const start = open.index + open[0].length;
  const end = text.lastIndexOf("</svg>");
  return text.slice(start, end < 0 ? text.length : end);
}

function pngSize(buffer, where) {
  if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) {
    throw new Error(`${where}：不是 PNG`);
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function safeName(value) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "-");
}

function groupOf(rel) {
  const parts = rel.split("/");
  return parts.length > 1 ? parts[0] : "assets";
}

function leafName(rel, group) {
  const parts = rel.split("/");
  const tail = (parts[0] === group ? parts.slice(1) : parts).join(".");
  return tail.replace(/\.(svg|png|jpe?g|webp)$/i, "");
}

/** 货架装箱：返回页列表，每页有元素与高度。 */
function pack(items, maxPage) {
  const pages = [];
  let page = { items: [], x: 0, y: 0, rowHeight: 0, width: 0, height: 0 };

  const flush = () => {
    if (page.items.length > 0) pages.push(page);
    page = { items: [], x: 0, y: 0, rowHeight: 0, width: 0, height: 0 };
  };

  for (const item of items) {
    if (page.x + item.width + PADDING > maxPage) {
      page.x = 0;
      page.y += page.rowHeight + PADDING;
      page.rowHeight = 0;
    }
    if (page.y + item.height + PADDING > maxPage) {
      flush();
    }

    const placed = { ...item, x: page.x, y: page.y };
    page.items.push(placed);
    page.x += item.width + PADDING;
    page.rowHeight = Math.max(page.rowHeight, item.height);
    page.width = Math.max(page.width, placed.x + item.width);
    page.height = Math.max(page.height, placed.y + item.height);
  }
  flush();
  return pages;
}

function renderPage(page, maxPage) {
  const width = Math.max(1, Math.min(maxPage, page.width));
  const height = Math.max(1, Math.min(maxPage, page.height));
  const body = page.items
    .map((item) => {
      if (item.viewBox !== null) {
        return `<svg x="${item.x}" y="${item.y}" width="${item.width}" height="${item.height}" viewBox="${item.viewBox}" preserveAspectRatio="none">${item.inner}</svg>`;
      }
      return `<g transform="translate(${item.x},${item.y})">${item.inner}</g>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n${body}\n</svg>\n`;
}

/**
 * 扫描并编码（不写盘）。
 * @param {string} inputDir
 * @param {{ pack?: string, maxPage?: number }} options
 */
export function encodeTree(inputDir, options = {}) {
  const root = resolve(inputDir);
  const packId = options.pack ?? "base";
  const maxPage = options.maxPage ?? MAX_PAGE;

  const files = walk(root);
  if (files.length === 0) throw new Error(`目录是空的：${inputDir}`);

  const groups = new Map();
  const copied = [];

  for (const file of files) {
    const rel = relative(root, file).replaceAll("\\", "/");
    const group = groupOf(rel);
    const list = groups.get(group) ?? [];
    list.push({ file, rel, group });
    groups.set(group, list);
  }

  const treeChildren = {};
  const pages = [];

  for (const [group, list] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const vector = [];
    const raster = [];

    for (const entry of list.sort((a, b) => a.rel.localeCompare(b.rel))) {
      if (extname(entry.file).toLowerCase() === ".svg") {
        const text = readFileSync(entry.file, "utf8");
        const size = svgSize(text, entry.rel);
        vector.push({
          ...entry,
          ...size,
          inner: svgInner(text),
          name: leafName(entry.rel, group),
        });
      } else {
        const buffer = readFileSync(entry.file);
        const size = pngSize(buffer, entry.rel);
        raster.push({ ...entry, ...size, name: leafName(entry.rel, group), buffer });
      }
    }

    const packed = pack(vector, maxPage);
    const pageNodes = [];

    for (const [index, page] of packed.entries()) {
      const pageId = safeName(`${group}-${index + 1}`);
      const image = `/art/${packId}/pages/${pageId}.svg`;
      pages.push({
        id: pageId,
        image,
        width: Math.max(1, Math.min(maxPage, page.width)),
        height: Math.max(1, Math.min(maxPage, page.height)),
        content: renderPage(page, maxPage),
      });

      const children = {};
      for (const item of page.items) {
        children[item.name] = {
          type: "leaf",
          x: item.x,
          y: item.y,
          w: item.width,
          h: item.height,
        };
      }
      pageNodes.push({ type: "page", page: pageId, children });
    }

    const fileLeaves = {};
    for (const item of raster) {
      const target = `assets/${safeName(item.name)}.png`;
      copied.push({ from: item.file, toRelative: target, width: item.width, height: item.height });
      fileLeaves[item.name] = {
        type: "leaf",
        file: target,
        w: item.width,
        h: item.height,
      };
    }

    if (pageNodes.length === 1 && Object.keys(fileLeaves).length === 0) {
      treeChildren[group] = pageNodes[0];
    } else {
      const children = {};
      pageNodes.forEach((node, index) => {
        children[`part-${index + 1}`] = node;
      });
      Object.assign(children, fileLeaves);
      treeChildren[group] = { type: "branch", children };
    }
  }

  const tree = { version: 1, pages: pages.map(({ content, ...page }) => page), tree: { type: "branch", children: treeChildren } };
  parseAssetTree(tree); // 自检：越界 / 引用错误在这里就炸

  return { tree, pages, copied, pack: packId };
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/** 写盘（带备份与恢复）。 */
export function applyEncoded(encoded, packDir, options = {}) {
  const packJson = JSON.parse(readFileSync(join(packDir, "pack.json"), "utf8"));
  const packId = packJson.id;
  const backupRoot = options.backupDir ?? resolve("artdrop/backups");
  const backupDir = join(backupRoot, `encode-${timestamp()}`);
  mkdirSync(backupDir, { recursive: true });

  const treePath = join(packDir, "assets.tree.json");
  const pagesDir = join(packDir, "art", "pages");
  const hadTree = existsSync(treePath);
  const hadPages = existsSync(pagesDir);

  if (hadTree) cpSync(treePath, join(backupDir, "assets.tree.json"));
  if (hadPages) cpSync(pagesDir, join(backupDir, "pages"), { recursive: true });

  try {
    mkdirSync(pagesDir, { recursive: true });
    for (const page of encoded.pages) {
      writeFileSync(join(pagesDir, `${page.id}.svg`), page.content, "utf8");
    }

    mkdirSync(join(packDir, "art", "assets"), { recursive: true });
    for (const file of encoded.copied) {
      cpSync(file.from, join(packDir, "art", file.toRelative));
    }

    writeFileSync(treePath, JSON.stringify(encoded.tree, null, 2) + "\n", "utf8");
  } catch (error) {
    // 恢复：失败时至少回到编码前的状态
    try {
      if (hadTree) cpSync(join(backupDir, "assets.tree.json"), treePath);
      else if (existsSync(treePath)) rmSync(treePath);
      if (hadPages) cpSync(join(backupDir, "pages"), pagesDir, { recursive: true });
    } catch {
      // 恢复失败只能把备份路径报给用户
    }
    throw new Error(`编码写盘失败，已尝试恢复；备份在 ${backupDir}（${error.message}）`);
  }

  writeFileSync(
    join(backupDir, "report.json"),
    JSON.stringify(
      { at: new Date().toISOString(), pack: packId, pages: encoded.pages.map((p) => p.id), copied: encoded.copied.length },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  return { backupDir, pages: encoded.pages.length, copied: encoded.copied.length };
}

function parseArgs(argv) {
  const args = { input: null, pack: "base", apply: false };
  for (const item of argv) {
    if (item === "--apply") args.apply = true;
    else if (item === "--check") args.apply = false;
    else if (item.startsWith("--pack=")) args.pack = item.slice("--pack=".length);
    else if (args.input === null) args.input = item;
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args.input ?? "artdrop/tree";
  const packDir = resolve("game/worlds", args.pack);

  if (!existsSync(input)) {
    console.error("输入目录不存在：" + input);
    process.exit(2);
  }
  if (!existsSync(join(packDir, "pack.json"))) {
    console.error("包不存在：" + packDir);
    process.exit(2);
  }

  const encoded = encodeTree(input, { pack: args.pack });
  console.log(
    `编码计划：${encoded.pages.length} 页 / ${encoded.copied.length} 个原样复制的 PNG`,
  );
  for (const page of encoded.pages) console.log(`  page ${page.id}  ${page.width}×${page.height}`);

  if (args.apply === false) {
    console.log("（--check 模式，没有写盘；加 --apply 生效）");
    return;
  }

  const summary = applyEncoded(encoded, packDir);
  console.log(`已写入：${summary.pages} 页，备份在 ${summary.backupDir}`);
}

const isMain = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) main();
