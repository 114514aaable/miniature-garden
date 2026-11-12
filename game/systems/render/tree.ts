// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 资产树：一张（或多张）大图集 + 一个树文件。
 *
 * 树里的目录有两种：
 *   branch  纯逻辑分组，子节点可以跨页
 *   page    对应一张图集页，子节点是「页内矩形」
 *
 * 叶子有两种：
 *   { x, y, w, h }                 已编码：页内矩形
 *   { file, w, h }                 热生成：还没进图集的单文件
 *
 * 调用名 = 路径（terrain.floor / entity.rat.idle）。
 */

export interface AssetPage {
  readonly id: string;
  /** 浏览器 URL（/art/...）。 */
  readonly image: string;
  readonly width: number;
  readonly height: number;
}

export interface TreeLeaf {
  readonly path: string;
  readonly page: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface FileLeaf {
  readonly path: string;
  /** 相对包 art 目录的路径。 */
  readonly file: string;
  readonly w: number;
  readonly h: number;
}

export interface AssetTree {
  readonly pages: ReadonlyMap<string, AssetPage>;
  readonly leaves: ReadonlyMap<string, TreeLeaf>;
  readonly files: ReadonlyMap<string, FileLeaf>;
}

interface RawLeaf {
  x?: unknown;
  y?: unknown;
  w?: unknown;
  h?: unknown;
  file?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function int(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${where} 需要非负整数`);
  }
  return value;
}

/**
 * 解析 assets.tree.json。
 */
export function parseAssetTree(raw: unknown, path = "$tree"): AssetTree {
  if (!isRecord(raw)) throw new Error(`${path}：需要对象`);
  if (raw.version !== 1) throw new Error(`${path}.version 目前只支持 1`);

  const pages = new Map<string, AssetPage>();
  const pageList = Array.isArray(raw.pages) ? raw.pages : [];
  for (const [index, item] of pageList.entries()) {
    const where = `${path}.pages[${index}]`;
    if (!isRecord(item)) throw new Error(`${where}：需要对象`);
    if (typeof item.id !== "string" || item.id.length === 0) {
      throw new Error(`${where}.id 非法`);
    }
    if (pages.has(item.id)) throw new Error(`${where}.id 重复：${item.id}`);
    if (typeof item.image !== "string" || item.image.length === 0) {
      throw new Error(`${where}.image 缺失`);
    }
    const width = int(item.width, `${where}.width`);
    const height = int(item.height, `${where}.height`);
    pages.set(item.id, { id: item.id, image: item.image, width, height });
  }

  const leaves = new Map<string, TreeLeaf>();
  const files = new Map<string, FileLeaf>();

  const walk = (node: unknown, trail: string[], pageId: string | null): void => {
    if (!isRecord(node)) throw new Error(`树节点 ${trail.join(".") || "<root>"}：需要对象`);
    const kind = node.type;

    if (kind === "branch") {
      if (pageId !== null) throw new Error(`${trail.join(".")}：page 里不能再嵌 branch`);
      const children = node.children;
      if (!isRecord(children)) throw new Error(`${trail.join(".")}：branch 缺少 children`);
      for (const [name, child] of Object.entries(children)) {
        walk(child, [...trail, name], pageId);
      }
      return;
    }

    if (kind === "page") {
      if (typeof node.page !== "string" || !pages.has(node.page)) {
        throw new Error(`${trail.join(".")}：page 引用不存在`);
      }
      const children = node.children;
      if (!isRecord(children)) throw new Error(`${trail.join(".")}：page 缺少 children`);
      for (const [name, child] of Object.entries(children)) {
        walk(child, [...trail, name], node.page);
      }
      return;
    }

    if (kind === "leaf") {
      const leaf = node as RawLeaf;
      const name = trail.join(".");

      if (typeof leaf.file === "string") {
        if (files.has(name) || leaves.has(name)) throw new Error(`资产路径重复：${name}`);
        files.set(name, {
          path: name,
          file: leaf.file,
          w: int(leaf.w, `${name}.w`),
          h: int(leaf.h, `${name}.h`),
        });
        return;
      }

      if (pageId === null) throw new Error(`${name}：页内叶子必须放在 page 节点下`);
      const page = pages.get(pageId) as AssetPage;
      const x = int(leaf.x, `${name}.x`);
      const y = int(leaf.y, `${name}.y`);
      const w = int(leaf.w, `${name}.w`);
      const h = int(leaf.h, `${name}.h`);
      if (x + w > page.width || y + h > page.height) {
        throw new Error(`${name}：超出图集页 ${pageId} 的范围`);
      }
      if (leaves.has(name) || files.has(name)) throw new Error(`资产路径重复：${name}`);
      leaves.set(name, { path: name, page: pageId, x, y, w, h });
      return;
    }

    throw new Error(`${trail.join(".") || "<root>"}：未知节点类型 ${String(kind)}`);
  };

  walk(raw.tree, [], null);
  return { pages, leaves, files };
}

/** 把树展开成「每个页节点对应的 TexturePacker hash」。 */
export function treeAtlases(tree: AssetTree): Map<string, unknown> {
  const framesByPage = new Map<string, Record<string, unknown>>();
  for (const leaf of tree.leaves.values()) {
    const frames = framesByPage.get(leaf.page) ?? {};
    frames[leaf.path] = {
      frame: { x: leaf.x, y: leaf.y, w: leaf.w, h: leaf.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: leaf.w, h: leaf.h },
      sourceSize: { w: leaf.w, h: leaf.h },
    };
    framesByPage.set(leaf.page, frames);
  }

  const out = new Map<string, unknown>();
  for (const [id, frames] of framesByPage) {
    const page = tree.pages.get(id);
    if (page === undefined) continue;
    out.set(id, { meta: { image: page.image, size: { w: page.width, h: page.height } }, frames });
  }
  return out;
}

/** 查一个路径：页内叶子 → sprite {sheet, frame}；单文件 → {file}。 */
export function spriteOf(
  tree: AssetTree,
  path: string,
): { sheet: string; frame: string } | { file: string; w: number; h: number } | null {
  const leaf = tree.leaves.get(path);
  if (leaf !== undefined) return { sheet: leaf.page, frame: leaf.path };
  const file = tree.files.get(path);
  if (file !== undefined) return { file: file.file, w: file.w, h: file.h };
  return null;
}
