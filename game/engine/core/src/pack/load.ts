// SPDX-FileCopyrightText: 2026 newworld contributors
// SPDX-License-Identifier: MIT

/**
 * 加载器：把合并后的内容池变成运行时对象。
 *
 * 它做五件事：
 *   1. 按 kind 分派（space / template / entity / terrain / world），未知 kind 直接拒绝；
 *   2. 字符串 id → 数字句柄（空间号、地形号），这就是「重定位」；
 *   3. 建 Space、TemplateRegistry、实体列表、地形表；
 *   4. 整体校验：引用闭合、坐标合法、地形都已声明、出生点能站；
 *   5. 收集世界启用的规则标签——包负责选，宿主负责实现。
 */

import { type Cell, nearestWhere, Space, type SpaceId } from "../space.ts";
import { type JsonValue, canonicalize, hashText } from "../time.ts";
import { type Schema } from "../event/schema.ts";
import { TemplateRegistry } from "../entity/template.ts";
import {
  type ComponentDef,
  type ConflictPolicy,
  type EntityDef,
  isPassable,
  parseComponentDef,
  parseEntityDef,
  parseGroupDef,
  type GroupDef,
  parseSpaceDef,
  parseTemplateDef,
  type SpaceDef,
  type TemplateDef,
  parseTerrainDef,
  type TerrainDef,
  parseWorldDef,
  type WorldDef,
} from "./definitions.ts";
import { type MergedWorld } from "./merge.ts";
import { parseTraversal, type TraversalSpec } from "../traversal/shapes.ts";
import { parseBiomeDef, type BiomeDef } from "./definitions.ts";
import {
  parseBodyPart,
  parseBodyPlan,
  resolveBodyPlans,
  type BodyPartDef,
  type BodyPlanDef,
  type ResolvedBodyPlan,
} from "../body/body.ts";

/** 引擎额外提供的组件。组件现在由包定义，这里一般是空的。 */
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
  readonly terrains: ReadonlyMap<number, TerrainDef>;
  readonly start: { readonly space: SpaceId; readonly pos: Cell };
  /** 出生点被挪过时的说明（没有就不出现）。 */
  readonly startWarning?: string;
  /** 空间名 → 数字句柄。存档和调试都用得上。 */
  readonly spaceIds: ReadonlyMap<string, SpaceId>;
  /** 这个世界启用哪些规则（标签），由宿主对到实现。 */
  readonly rules: readonly string[];
  /** 开局一次性效果（世界包声明，宿主按顺序应用）。 */
  readonly init: readonly JsonValue[];
  /** 存在感策略（世界声明，宿主使用）。 */
  readonly persistence: { readonly activeRadius: number; readonly sweepEvery: number };
  /** 命名形状与条件（来自 base 的 traversal.json）。 */
  readonly traversal: TraversalSpec;
  /** 群系（按声明顺序，先声明先匹配）。 */
  readonly biomes: readonly BiomeDef[];
  /** 预制件：一组实体 + 相对偏移，供 stamp 使用。 */
  readonly groups: ReadonlyMap<string, GroupDef>;
  /** 部位目录：id → 定义。 */
  readonly bodyParts: ReadonlyMap<string, BodyPartDef>;
  /** 身体蓝图：id → 展开后的树。 */
  readonly bodyPlans: ReadonlyMap<string, ResolvedBodyPlan>;
  readonly onConflict: ConflictPolicy;
  readonly world: WorldDef;
  readonly hash: string;
}

const KNOWN_KINDS = new Set([
  "biome",
  "traversal",
  "space",
  "template",
  "entity",
  "terrain",
  "component",
  "group",
  "world",
  "bodypart",
  "bodyplan",
]);

export function loadWorld(
  merged: MergedWorld,
  components: readonly ComponentSpec[] = [],
): LoadedWorld {
  const spaceDefs: SpaceDef[] = [];
  const templateDefs: TemplateDef[] = [];
  const entityDefs: EntityDef[] = [];
  const terrains = new Map<number, TerrainDef>();
  const worldDefs: WorldDef[] = [];
  const componentDefs: ComponentDef[] = [];
  const groupDefs: GroupDef[] = [];
  const biomeDefs: BiomeDef[] = [];
  const bodyPartDefs: BodyPartDef[] = [];
  const bodyPlanDefs: BodyPlanDef[] = [];
  let traversalSpec: TraversalSpec = { shapes: {}, filters: {} };

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
      case "terrain": {
        const terrain = parseTerrainDef(def.data, def.id, `$terrain.${def.id}`);
        terrains.set(terrain.id, terrain);
        break;
      }
      case "biome":
        biomeDefs.push(parseBiomeDef(def.data, def.id, `$biome.${def.id}`));
        break;
      case "traversal":
        traversalSpec = parseTraversal(def.data, `$traversal.${def.id}`);
        break;
      case "group":
        groupDefs.push(parseGroupDef(def.data, def.id, `$group.${def.id}`));
        break;
      case "component":
        componentDefs.push(parseComponentDef(def.data, def.id, `$component.${def.id}`));
        break;
      case "world":
        worldDefs.push(parseWorldDef(def.data, `$world.${def.id}`));
        break;
      case "bodypart":
        bodyPartDefs.push(parseBodyPart(def.data, def.id));
        break;
      case "bodyplan":
        bodyPlanDefs.push(parseBodyPlan(def.data, def.id));
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

  for (const def of sortedSpaces) {
    checkTerrainDeclared(def, terrains);
  }

  const spaces = sortedSpaces.map((def) => buildSpace(def, spaceIds.get(def.id) as SpaceId));

  const templates = new TemplateRegistry();
  // 先注册包定义的组件（这是常态），再注册引擎额外提供的（一般是空的）。
  for (const def of componentDefs) {
    templates.defineComponent(def.name, def.schema);
  }
  for (const component of components) {
    templates.defineComponent(component.name, component.schema);
  }
  for (const def of templateDefs) {
    templates.defineTemplate(def);
  }

  // 部位：先建目录，再展开蓝图（继承 / repeat / delete 都在这一步）
  const bodyParts = new Map(bodyPartDefs.map((def) => [def.id, def]));
  const bodyPlans = resolveBodyPlans(new Map(bodyPlanDefs.map((def) => [def.id, def])), bodyParts);

  const world = worldDefs[0];
  const entities = entityDefs.map((def, index) =>
    normalizeEntity(def, index, spaceIds, spaces, templates, terrains),
  );
  const start = resolveStart(world, spaceIds, spaces, terrains);

  return {
    spaces,
    templates,
    entities,
    terrains,
    start,
    ...(start.warning === undefined ? {} : { startWarning: start.warning }),
    spaceIds,
    rules: world.rules ?? [],
    init: world.init ?? [],
    persistence: {
      activeRadius: world.persistence?.activeRadius ?? 25,
      sweepEvery: world.persistence?.sweepEvery ?? 50,
    },
    groups: new Map(groupDefs.map((def) => [def.id, def])),
    bodyParts,
    bodyPlans,
    traversal: traversalSpec,
    biomes: biomeDefs,
    onConflict: world.onConflict ?? "error",
    world,
    hash: hashOf(merged.hash, sortedSpaces, templateDefs, [...terrains.values()], entities, start),
  };
}

/** 空间里出现的每个地形号，都必须在世界里声明过。 */
function checkTerrainDeclared(def: SpaceDef, terrains: ReadonlyMap<number, TerrainDef>): void {
  const missing = new Set<number>();
  for (const terrain of def.terrain) {
    if (!terrains.has(terrain)) {
      missing.add(terrain);
    }
  }
  if (missing.size > 0) {
    throw new Error(
      `空间 ${def.id} 用了未声明的地形：${[...missing].sort((a, b) => a - b).join(", ")}`,
    );
  }
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
  terrains: ReadonlyMap<number, TerrainDef>,
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
  if (!isPassable(terrains, space.terrainAt(pos))) {
    throw new Error(`实体 #${index}（${def.template}）站在不可通行地形上：(${def.x}, ${def.y})`);
  }

  return { template: def.template, space: spaceId, pos, overrides: def.overrides ?? {} };
}

function resolveStart(
  world: WorldDef,
  spaceIds: ReadonlyMap<string, SpaceId>,
  spaces: readonly Space[],
  terrains: ReadonlyMap<number, TerrainDef>,
): { space: SpaceId; pos: Cell; warning?: string } {
  const spaceId = spaceIds.get(world.start.space);
  if (spaceId === undefined) {
    throw new Error(`出生点引用了不存在的空间：${world.start.space}`);
  }

  const space = spaces.find((item) => item.id === spaceId) as Space;
  const pos = { x: world.start.x, y: world.start.y };
  if (!space.inBounds(pos)) {
    throw new Error(`出生点越界：(${pos.x}, ${pos.y})`);
  }
  if (!isPassable(terrains, space.terrainAt(pos))) {
    // 出生点在水里/墙里：挪到最近的能站格子，别让玩家一开局就掉河里
    const fallback = nearestWhere(space, pos, (cell: Cell) => isPassable(terrains, space.terrainAt(cell)));
    if (fallback === null) {
      throw new Error(`出生点在不可通行地形上，而且这个空间没有能站的地方：(${pos.x}, ${pos.y})`);
    }

    return {
      space: spaceId,
      pos: fallback,
      warning: `出生点 (${pos.x}, ${pos.y}) 不能站，挪到了 (${fallback.x}, ${fallback.y})`,
    };
  }

  return { space: spaceId, pos };
}

function hashOf(
  mergedHash: string,
  spaces: readonly SpaceDef[],
  templates: readonly TemplateDef[],
  terrains: readonly TerrainDef[],
  entities: readonly LoadedEntity[],
  start: { space: SpaceId; pos: Cell },
): string {
  return hashText(
    canonicalize({
      mergedHash,
      spaces,
      templates,
      terrains: [...terrains].sort((a, b) => a.id - b.id),
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
