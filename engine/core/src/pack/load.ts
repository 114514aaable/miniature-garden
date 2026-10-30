// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 加载器：把合并后的内容池变成运行时对象。
 *
 * 它做四件事：
 *   1. 按 kind 分派（space / template / entity / world），未知 kind 直接拒绝；
 *   2. 字符串 id → 数字句柄（空间号），这就是「重定位」；
 *   3. 建 Space、TemplateRegistry、实体列表；
 *   4. 整体校验：引用闭合、坐标合法、实体不能站在不可通行地形上、出生点能站。
 *
 * 加载器本身不认识具体的 kind 怎么造——那是注册表的事。
 * 以后接别的格式（比如 RPG Maker 的地图），注册一个新 kind 就行。
 */

import { type Cell, Space, type SpaceId } from "../space.ts";
import { type JsonValue, canonicalize, hashText } from "../time.ts";
import { type Schema } from "../event/schema.ts";
import { TemplateRegistry } from "../entity/template.ts";
import {
  type EntityDef,
  isPassable,
  parseEntityDef,
  parseSpaceDef,
  parseTemplateDef,
  type SpaceDef,
  type TemplateDef,
  parseWorldDef,
  type WorldDef,
} from "./definitions.ts";
import { type MergedWorld } from "./merge.ts";

/** 组件是代码里的原语（L2），由引擎提供；世界只能使用，不能定义。 */
export interface ComponentSpec {
  readonly name: string;
  readonly schema: Schema;
}

export interface LoadedEntity {
  readonly template: string;
  readonly space: SpaceId;
  readonly pos: Cell;
  readonly overrides: Readonly<Record<string, JsonValue>>;
}

export interface LoadedWorld {
  readonly spaces: readonly Space[];
  readonly templates: TemplateRegistry;
  readonly entities: readonly LoadedEntity[];
  readonly start: { readonly space: SpaceId; readonly pos: Cell };
  /** 空间名 → 数字句柄。存档和调试都用得上。 */
  readonly spaceIds: ReadonlyMap<string, SpaceId>;
  readonly world: WorldDef;
  readonly hash: string;
}

const KNOWN_KINDS = new Set(["space", "template", "entity", "world"]);

export function loadWorld(
  merged: MergedWorld,
  components: readonly ComponentSpec[],
): LoadedWorld {
  const spaceDefs: SpaceDef[] = [];
  const templateDefs: TemplateDef[] = [];
  const entityDefs: EntityDef[] = [];
  const worldDefs: WorldDef[] = [];

  for (const [key, def] of merged.definitions) {
    if (!KNOWN_KINDS.has(def.kind)) {
      throw new Error(`未知的定义类型："${def.kind}"（来自 ${def.origin}，键 ${key}）`);
    }
    switch (def.kind) {
      case "space":
        spaceDefs.push(parseSpaceDef(def.data, `$space.${def.id}`));
        break;
      case "template":
        templateDefs.push(parseTemplateDef(def.data, `$template.${def.id}`));
        break;
      case "entity":
        entityDefs.push(parseEntityDef(def.data, `$entity.${entityDefs.length}`));
        break;
      case "world":
        worldDefs.push(parseWorldDef(def.data, `$world.${def.id}`));
        break;
    }
  }

  if (worldDefs.length === 0) {
    throw new Error("这个内容池里没有 world 定义，不知道从哪开始");
  }
  if (worldDefs.length > 1) {
    throw new Error(`一个世界只能有一个 world 定义，收到 ${worldDefs.length} 个`);
  }

  // 字符串 id → 数字句柄。按名字排序后分配，保证任何机器都一样。
  const spaceIds = new Map<string, SpaceId>();
  const sortedSpaces = [...spaceDefs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  sortedSpaces.forEach((def, index) => {
    spaceIds.set(def.id, index + 1);
  });

  const spaces = sortedSpaces.map((def) => buildSpace(def, spaceIds.get(def.id) as SpaceId));

  const templates = new TemplateRegistry();
  for (const component of components) {
    templates.defineComponent(component.name, component.schema);
  }
  for (const def of templateDefs) {
    templates.defineTemplate(def);
  }

  const world = worldDefs[0];
  const entities = entityDefs.map((def, index) => normalizeEntity(def, index, spaceIds, spaces, templates, world));
  const start = resolveStart(world, spaceIds, spaces);

  return {
    spaces,
    templates,
    entities,
    start,
    spaceIds,
    world,
    hash: hashOf(merged.hash, sortedSpaces, templateDefs, entities, start),
  };
}

function buildSpace(def: SpaceDef, id: SpaceId): Space {
  const space = new Space(id, def.width, def.height, def.cellSize);
  for (let y = 0; y < def.height; y++) {
    for (let x = 0; x < def.width; x++) {
      space.setTerrain({ x, y }, def.terrain[y * def.width + x]);
    }
  }
  return space;
}

function normalizeEntity(
  def: EntityDef,
  index: number,
  spaceIds: ReadonlyMap<string, SpaceId>,
  spaces: readonly Space[],
  templates: TemplateRegistry,
  world: WorldDef,
): LoadedEntity {
  if (!templates.has(def.template)) {
    throw new Error(`实体 #${index} 用了不存在的模板：${def.template}`);
  }

  const spaceId = spaceIds.get(def.space);
  if (spaceId === undefined) {
    throw new Error(`实体 #${index} 引用了不存在的空间：${def.space}`);
  }

  const space = spaces.find((item) => item.id === spaceId) as Space;
  const pos = { x: def.x, y: def.y };
  if (!space.inBounds(pos)) {
    throw new Error(`实体 #${index} 的坐标越界：(${def.x}, ${def.y})`);
  }
  if (!isPassable(world, space.terrainAt(pos))) {
    throw new Error(`实体 #${index}（${def.template}）站在不可通行地形上：(${def.x}, ${def.y})`);
  }

  return { template: def.template, space: spaceId, pos, overrides: def.overrides ?? {} };
}

function resolveStart(
  world: WorldDef,
  spaceIds: ReadonlyMap<string, SpaceId>,
  spaces: readonly Space[],
): { space: SpaceId; pos: Cell } {
  const spaceId = spaceIds.get(world.start.space);
  if (spaceId === undefined) {
    throw new Error(`出生点引用了不存在的空间：${world.start.space}`);
  }

  const space = spaces.find((item) => item.id === spaceId) as Space;
  const pos = { x: world.start.x, y: world.start.y };
  if (!space.inBounds(pos)) {
    throw new Error(`出生点越界：(${pos.x}, ${pos.y})`);
  }
  if (!isPassable(world, space.terrainAt(pos))) {
    throw new Error(`出生点在不可通行地形上：(${pos.x}, ${pos.y})`);
  }

  return { space: spaceId, pos };
}

function hashOf(
  mergedHash: string,
  spaces: readonly SpaceDef[],
  templates: readonly TemplateDef[],
  entities: readonly LoadedEntity[],
  start: { space: SpaceId; pos: Cell },
): string {
  return hashText(
    canonicalize({
      mergedHash,
      spaces,
      templates,
      entities: entities.map((entity) => ({
        template: entity.template,
        space: entity.space,
        x: entity.pos.x,
        y: entity.pos.y,
        overrides: entity.overrides,
      })),
      start: { space: start.space, x: start.pos.x, y: start.pos.y },
    } as unknown as JsonValue),
  );
}
